#!/usr/bin/env bash
# BATERIA OFICIAL · protocolo espelho_30, SEIS bases, 48 partidas por base.
#
# 48 e nao 24. Motivo medido na OS-107 (HANDOFF §3.2b): entre duas metades da
# MESMA base com a MESMA build, gols chegam a diferir 0,7916 -- e a folga da
# build promovida acima do piso do gate e 0,075. Com 24 partidas por base o gate
# reprova build boa e passaria build ruim; a propria OS-107 reprovou com 24 e
# passou nos tres gates com 48.
#
# Uso:  tools/r1896/bateria_oficial.sh <build.html> [partidas]
# Saida: uma linha JSON por base, mais o resumo com os tres gates.
set -u
BUILD="${1:?uso: bateria_oficial.sh <build.html> [partidas]}"
N="${2:-48}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

BASES="4200000 8400000 1260000 2100000 6300000 3150000"
echo "bateria oficial · $N partidas x 6 bases = $((N*6)) partidas"
echo "build: $BUILD"
echo

for s in $BASES; do
  node "$AQUI/bateria_espelho30.js" --build="$BUILD" --matches="$N" --semente="$s" > "$TMP/$s.json" 2>&1 &
done
wait

python3 - "$TMP" $BASES <<'PY'
import json, sys, os
tmp = sys.argv[1]; bases = sys.argv[2:]
g = []; x = []; c = []; ch = []
print('%9s %8s %8s %8s %8s' % ('semente', 'gols', 'xG', 'escant', 'chutes'))
for s in bases:
    d = json.load(open(os.path.join(tmp, s + '.json')))['media']
    g.append(d['gols']); x.append(d['xg']); c.append(d['escanteios']); ch.append(d['chutes'])
    print('%9s %8.4f %8.4f %8.4f %8.2f' % (s, d['gols'], d['xg'], d['escanteios'], d['chutes']))
print('%9s %8.4f %8.4f %8.4f %8.2f' % ('media', sum(g)/6, sum(x)/6, sum(c)/6, sum(ch)/6))
print('%9s %8.4f %8.4f %8.4f' % ('pior', min(g), max(x), min(c)))
print()
def gate(nome, ok, ruins):
    print('%-22s %s' % (nome, 'PASSA 6/6' if ok else 'REPROVA -> ' + ' '.join(ruins)))
gate('gols 1,8-3,0', all(1.8 <= v <= 3.0 for v in g),
     ['%s=%.4f' % (bases[i], v) for i, v in enumerate(g) if not 1.8 <= v <= 3.0])
gate('ECO-02  xG <= 2,7', all(v <= 2.7 for v in x),
     ['%s=%.4f' % (bases[i], v) for i, v in enumerate(x) if v > 2.7])
gate('ECO-05  escant 4-10', all(4 <= v <= 10 for v in c),
     ['%s=%.4f' % (bases[i], v) for i, v in enumerate(c) if not 4 <= v <= 10])
print()
print('Gate e rede de seguranca, nao objetivo. Diferenca de gol menor que ~0,3')
print('nao e resolvida nem com esta amostra -- olhe a CONSISTENCIA entre as seis')
print('bases (mesmo sinal em todas) antes de acreditar em qualquer media.')
PY
