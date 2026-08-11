#!/usr/bin/env bash
# DOUTOR — o ambiente esta pronto para trabalhar neste repositorio?
#
# Rode isto ANTES de qualquer coisa. Cada verificacao que falha aqui vira meia
# hora perdida depois, e uma IA que descobre no meio da tarefa que nao tem
# Chromium vai reportar "pronto" sem ter provado nada.
#
# Uso:  bash tools/doutor.sh
set -uo pipefail
cd "$(dirname "$0")/.."

ok=0; falhou=0; avisos=0
verde()   { printf '  \033[32m✓\033[0m %s\n' "$*"; ok=$((ok+1)); }
vermelho(){ printf '  \033[31m✗\033[0m %s\n' "$*"; falhou=$((falhou+1)); }
amarelo() { printf '  \033[33m!\033[0m %s\n' "$*"; avisos=$((avisos+1)); }

echo
echo "DOUTOR — Copa dos Sonhos"
echo "════════════════════════════════════════════════════════════════"
echo
echo "Ferramentas"

if command -v python3 >/dev/null; then verde "python3 $(python3 -V 2>&1 | cut -d' ' -f2)"
else vermelho "python3 AUSENTE — build.py, verify.py e os placares nao rodam"; fi

if command -v node >/dev/null; then
  v=$(node -v); verde "node $v"
  maior=$(echo "$v" | sed 's/v\([0-9]*\).*/\1/')
  [ "$maior" -lt 18 ] && amarelo "node $v e antigo; a bateria foi testada em 22.x"
else vermelho "node AUSENTE — bateria, pilha e sondas nao rodam"; fi

if command -v git >/dev/null; then verde "git $(git -v | cut -d' ' -f3)"
else amarelo "git ausente — voce nao vai conseguir commitar"; fi

echo
echo "Chromium (as sondas de tela e o unico teste que prova que o jogo sobe)"
PW=/opt/node22/lib/node_modules/playwright
if [ -d "$PW" ]; then verde "playwright em $PW"
else
  if node -e "require('playwright')" 2>/dev/null; then verde "playwright resolvivel por require"
  else vermelho "playwright AUSENTE — browser_smoke.js e tools/fisica/tela/* nao rodam"; fi
fi
if [ -x /opt/pw-browsers/chromium ] || [ -d /opt/pw-browsers ]; then
  verde "navegador em /opt/pw-browsers"
else
  amarelo "/opt/pw-browsers nao existe; se o smoke falhar, e por aqui (NAO rode 'playwright install' sem checar antes)"
fi

echo
echo "Arvore do repositorio"
for f in src/scripts/40-match-engine-and-manager-ai.js \
         tools/build.py tools/verify.py tools/aceitar.sh tools/defeitos.py \
         tools/fisica/bateria.js tools/fisica/pilha.js \
         tests/browser_smoke.js tests/fisica_balistica.js \
         reports/LEIA-PRIMEIRO.md reports/INVESTIGACAO-COMPLETA-2026-08.md; do
  [ -f "$f" ] && verde "$f" || vermelho "$f AUSENTE"
done
[ -f reports/REFERENCIA.json ] && verde "reports/REFERENCIA.json (linha de base)" \
  || amarelo "reports/REFERENCIA.json ausente — 'aceitar.sh --depois' sem '--antes' nao tem contra o que comparar"

echo
echo "Catalogo de defeitos"
if python3 tools/defeitos.py --check >/tmp/_doutor 2>&1; then
  verde "$(cat /tmp/_doutor)"
else
  vermelho "as ancoras do catalogo envelheceram:"; sed 's/^/      /' /tmp/_doutor
fi

echo
echo "Estado do build"
if [ -f dist/index.html ]; then
  sha=$(sha256sum dist/index.html | cut -c1-16)
  verde "dist/index.html presente · sha256 $sha"
  [ "$sha" = "ff808761f5797656" ] && verde "bate com o build da investigacao" \
    || amarelo "difere do build da investigacao (ff808761f5797656) — normal se alguem ja mexeu"
else
  amarelo "dist/index.html ausente — rode: python3 tools/build.py"
fi

echo
echo "════════════════════════════════════════════════════════════════"
printf "  %d ok · %d aviso(s) · %d falha(s)\n\n" "$ok" "$avisos" "$falhou"
if [ "$falhou" -gt 0 ]; then
  printf '\033[31m  NAO comece a trabalhar. Resolva as falhas acima primeiro.\033[0m\n\n'
  exit 1
fi
cat <<'FIM'
  Ambiente pronto. Proximo passo:

    cat reports/LEIA-PRIMEIRO.md          # 2 paginas, as regras
    python3 tools/defeito.py --proximo    # o que fazer agora

FIM
