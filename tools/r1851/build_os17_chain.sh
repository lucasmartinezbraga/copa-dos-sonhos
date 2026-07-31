#!/usr/bin/env bash
# OS-17 · CADEIA. Aplica OS-12 -> OS-16B -> OS-14 sobre a build promovida.
# CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
set -euo pipefail
BASE="dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html"
T=$(mktemp -d)
node tools/r1851/patch_os12_cross_needs_target.js --in="$BASE"   --out="$T/a.html"
node tools/r1851/patch_os16_carry.js --limiar=55 --teto=2 --in="$T/a.html" --out="$T/b.html"
node tools/r1851/patch_os14_penalty.js --in="$T/b.html" --out="dist/COPA DOS SONHOS - R18.50 - OS17 CADEIA.html"
rm -rf "$T"
