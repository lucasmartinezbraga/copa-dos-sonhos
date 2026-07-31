#!/usr/bin/env bash
# R18.51 · cadeia completa das candidatas que MEDIRAM efeito.
# Fora: OS-11 (separacao) — medida e nao cumpriu.
set -euo pipefail
BASE="dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html"
OUT="dist/COPA DOS SONHOS - R18.58 - JOGO DE FUTEBOL.html"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
node tools/r1851/patch_field_name_suffix.js        --in="$BASE"     --out="$T/1.html"
node tools/r1851/patch_os08_oop_role_reconnect.js  --in="$T/1.html" --out="$T/2.html"
node tools/r1851/patch_os10_foul_funnel.js         --in="$T/2.html" --out="$T/3.html"
node tools/r1851/patch_os12_cross_needs_target.js  --in="$T/3.html" --out="$T/4.html"
node tools/r1851/patch_os16_carry.js --limiar=55 --teto=2 --in="$T/4.html" --out="$T/5.html"
node tools/r1851/patch_os14_penalty.js             --in="$T/5.html" --out="$T/6.html"
node tools/r1851/patch_os18_blockable_shots.js     --in="$T/6.html" --out="$T/7.html"
node tools/r1851/patch_os19_gk_angle.js            --in="$T/7.html" --out="$T/8.html"
node tools/r1851/patch_os20_setpiece_hud.js        --in="$T/8.html" --out="$T/9.html"
node tools/r1851/patch_os21_wall_and_taker.js      --in="$T/9.html" --out="$T/10.html"
node tools/r1851/patch_os22_clockrate.js --clockRate=0.20 --in="$T/10.html" --out="$T/11.html"
node tools/r1851/patch_os23_xg_and_corners.js      --in="$T/11.html" --out="$T/12.html"
node tools/r1851/patch_os25_marking_reach.js       --in="$T/12.html" --out="$OUT"
echo "-> $OUT"
