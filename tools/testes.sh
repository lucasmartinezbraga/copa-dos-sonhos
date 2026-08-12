#!/usr/bin/env bash
# A suite inteira, num comando. Sem isto ninguem roda tudo — e foi por isso que
# tres coisas ficaram quebradas sem ninguem ver ate 2026-08-12:
#
#   - tests/browser_smoke.py  morria com ModuleNotFoundError (o Playwright deste
#     ambiente e o de Node), e o CLAUDE.md mandava roda-lo a cada commit
#   - tests/dev_server_smoke.py  citado no CLAUDE.md, NAO EXISTE
#   - tests/phase2_engine_smoke.js  quebrado desde o D03, porque o core sozinho
#     deixou de ser uma configuracao que roda
#
# Este script NAO mede desempenho de jogo — isso e `tools/aceitar.sh`, que roda
# 300 partidas. Aqui e so "esta tudo de pe?", em menos de dois minutos.
#
# Uso:  bash tools/testes.sh
set -uo pipefail
cd "$(dirname "$0")/.."

verde() { printf '\033[32m%s\033[0m\n' "$*"; }
vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
titulo() { printf '\n\033[1m── %s\033[0m\n' "$*"; }

falhas=0
nomes=()

roda() {
  local nome="$1"; shift
  titulo "$nome"
  if "$@" >/tmp/cds-teste.log 2>&1; then
    verde "  ok"
  else
    vermelho "  FALHOU (exit $?)"
    tail -12 /tmp/cds-teste.log | sed 's/^/    /'
    falhas=$((falhas + 1)); nomes+=("$nome")
  fi
}

# verify RECONSTROI o dist/. Nunca rode isto com uma bateria medindo — ja
# contaminou uma linha de base inteira (armadilha D2).
if pgrep -f 'bateria\.js' >/dev/null 2>&1; then
  vermelho "ha uma bateria medindo AGORA. tools/verify.py reconstroi o dist/ e"
  vermelho "contaminaria a medicao. Espere ela terminar."
  exit 2
fi

roda "verify — build, sintaxe dos 89 blocos, lint de escopo" python3 tools/verify.py
roda "balistica — unidade"                                   node tests/fisica_balistica.js
roda "browser smoke — Chromium de verdade"                   node tests/browser_smoke.js
roda "motor sem DOM — integridade V3, goleiros, estado"      node tests/phase2_engine_smoke.js
roda "grafo de inclusoes da versao de dev"                   python3 tests/dev_graph_check.py
roda "portao de design — reprova o que deve"                 python3 tests/regressao_design_test.py
roda "catalogo — ancoras e secoes ainda casam"               python3 tools/defeitos.py --check

echo
if [ "$falhas" -eq 0 ]; then
  verde "7/7 passaram."
  echo "Isto diz que esta tudo de pe. NAO diz que o jogo ficou melhor —"
  echo "para isso: bash tools/aceitar.sh --antes / --depois"
  exit 0
fi
vermelho "$falhas de 7 falharam:"
for n in "${nomes[@]}"; do vermelho "  - $n"; done
exit 1
