#!/usr/bin/env bash
# ACEITAR — o unico comando que decide se uma mudanca entra.
#
# Por que existe
# -------------
# Por vinte releases nao houve como saber se uma mudanca melhorou o jogo. Sem
# isso, a unica jogada segura e ACRESCENTAR: nunca remover, nunca substituir,
# sempre empilhar mais uma camada. Foi o que aconteceu, 82 vezes.
#
# Este script poe a medicao NO CAMINHO do commit, em vez de na disciplina de
# quem edita. Enquanto ele for opcional, ele volta a nao ser usado.
#
# Uso:
#   bash tools/aceitar.sh --antes          # guarda a medicao ANTES de editar
#   bash tools/aceitar.sh --depois         # constroi, testa, mede e COMPARA
#   bash tools/aceitar.sh --depois --identico
#       # exige as 14 metricas IDENTICAS ao digito (para mudancas que nao
#       # devem mudar comportamento: D03, D04, D17, D18, D33)
#   bash tools/aceitar.sh --fixar          # promove a medicao atual a REFERENCIA
#
# Variaveis:
#   PARTIDAS=300   quantas partidas por medicao
#   WORKERS=8
set -uo pipefail
cd "$(dirname "$0")/.."

PARTIDAS="${PARTIDAS:-300}"
# Medido: com mais workers do que nucleos a bateria fica 2-3x mais lenta e nao
# muda o resultado (verificado com 3, 4 e 8 workers: as 14 metricas identicas).
WORKERS="${WORKERS:-$(nproc 2>/dev/null || echo 4)}"
ANTES="reports/_aceitar-antes.json"
DEPOIS="reports/_aceitar-depois.json"
REFERENCIA="reports/REFERENCIA.json"

vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
verde()    { printf '\033[32m%s\033[0m\n' "$*"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$*"; }

construir_e_testar() {
  echo "── build + verify ─────────────────────────────────────────────"
  python3 tools/build.py  >/dev/null || { vermelho "build.py FALHOU"; exit 1; }
  python3 tools/verify.py >/dev/null || { vermelho "verify.py FALHOU"; exit 1; }
  python3 tools/defeitos.py --check    || { vermelho "ancoras do catalogo envelheceram — atualize tools/defeitos.py"; exit 1; }
  node tests/fisica_balistica.js >/dev/null || { vermelho "balistica FALHOU"; exit 1; }
  echo "── browser smoke (Chromium real) ──────────────────────────────"
  node tests/browser_smoke.js || { vermelho "o jogo NAO SOBE no navegador"; exit 1; }
  verde "build ok · sha256 $(sha256sum dist/index.html | cut -c1-16)"
}

medir() {
  local saida="$1"
  echo "── bateria: $PARTIDAS partidas, $WORKERS workers ──────────────"
  node tools/fisica/bateria.js --build=dist/index.html \
    --matches="$PARTIDAS" --workers="$WORKERS" --out="$saida" >/dev/null \
    || { vermelho "bateria FALHOU"; exit 1; }
}

case "${1:-}" in
  --antes)
    construir_e_testar
    medir "$ANTES"
    verde "medicao ANTES guardada em $ANTES"
    amarelo "agora edite src/ — NUNCA dist/ — e rode:  bash tools/aceitar.sh --depois"
    ;;

  --depois)
    IDENTICO=0
    [ "${2:-}" = "--identico" ] && IDENTICO=1
    construir_e_testar
    medir "$DEPOIS"
    base="$ANTES"; [ -f "$base" ] || base="$REFERENCIA"
    [ -f "$base" ] || { vermelho "sem base de comparacao. Rode --antes primeiro."; exit 1; }
    echo
    echo "── comparacao contra $base ────────────────────────────────────"
    python3 tools/comparar.py "$base" "$DEPOIS" $([ "$IDENTICO" = 1 ] && echo --identico)
    veredito=$?
    echo
    echo "── placar de design ───────────────────────────────────────────"
    python3 tools/fisica/placar.py "$DEPOIS" | tail -6
    # As 14 metricas agregadas NAO contem drawRate, zeroZeroRate, blowoutRate
    # nem averageEndingStamina. No D11 o criterio de 2 SE aprovou uma mudanca
    # que levou o placar de design de 12/13 para 10/13. Este portao existe por
    # causa daquele dia.
    python3 tools/regressao_design.py "$base" "$DEPOIS"
    veredito_design=$?
    echo "── placar do futebol real ─────────────────────────────────────"
    python3 tools/fisica/futebol_real.py "$DEPOIS" | tail -6
    echo
    if [ "$veredito" -ne 0 ]; then
      vermelho "REPROVADO — nao faca commit. Leia a comparacao acima."
      exit 1
    fi
    if [ "$veredito_design" -ne 0 ]; then
      vermelho "REPROVADO pelo placar de design — nao faca commit."
      vermelho "Passar em 2 SE e necessario, nao suficiente."
      exit 1
    fi
    verde "APROVADO pelo criterio de 2 SE e pelo placar de design."
    amarelo "Se voce mexeu em TRAJETORIA, isto ainda nao basta:"
    amarelo "  node tools/fisica/tela/pinga.js dist/index.html 60"
    amarelo "Se voce mexeu em MOVIMENTACAO:"
    amarelo "  node tools/fisica/tela/forma.js dist/index.html 90"
    ;;

  --fixar)
    [ -f "$DEPOIS" ] || { vermelho "nao ha $DEPOIS para promover."; exit 1; }
    # A referencia SO pode ser uma medicao do build atual. Ja aconteceu de ela
    # ser um arquivo antigo, medido antes da ultima mudanca de calibracao, e o
    # --identico passou a reprovar mudancas inocentes.
    cp "$DEPOIS" "$REFERENCIA"
    verde "REFERENCIA atualizada. So faca isto quando a mudanca foi ACEITA."
    ;;

  *)
    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
