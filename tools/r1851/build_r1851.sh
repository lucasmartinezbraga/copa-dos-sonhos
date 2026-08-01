#!/usr/bin/env bash
# R18.51 · cadeia completa das candidatas que MEDIRAM efeito.
# Fora: OS-11 (separacao) — medida e nao cumpriu.
set -euo pipefail
BASE="dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html"
OUT="dist/COPA DOS SONHOS - R18.82 - JOGO DE FUTEBOL.html"
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
node tools/r1851/patch_os22_clockrate.js --clockRate=0.16 --in="$T/10.html" --out="$T/11.html"
node tools/r1851/patch_os23_xg_and_corners.js      --in="$T/11.html" --out="$T/12.html"
node tools/r1851/patch_os25_marking_reach.js       --in="$T/12.html" --out="$T/13.html"
node tools/r1851/patch_os26_lane_spread.js         --in="$T/13.html" --out="$T/14.html"
node tools/r1851/patch_os27_cut_inside.js          --in="$T/14.html" --out="$T/15.html"
node tools/r1851/patch_os31_freekick_sense.js      --in="$T/15.html" --out="$T/16.html"
node tools/r1851/patch_os36_freekick_distance.js   --in="$T/16.html" --out="$T/17.html"
node tools/r1851/patch_os37_smooth_corrections.js --vcorr=5 --in="$T/17.html" --out="$T/18.html"
node tools/r1851/patch_os39_block_on_flight.js     --in="$T/18.html" --out="$T/19.html"
# OS-40 REPROVADA (trava de profundidade nao era a causa) — fora da cadeia.
node tools/r1851/patch_os41_threat_range.js        --in="$T/19.html" --out="$T/20.html"
node tools/r1851/patch_os42_contest_the_cross.js   --in="$T/20.html" --out="$T/21.html"
node tools/r1851/patch_os43_aerial_duel.js         --in="$T/21.html" --out="$T/22.html"
node tools/r1851/patch_os44_aerial_duel_distance.js --in="$T/22.html" --out="$T/23.html"
node tools/r1851/patch_os45_cross_accuracy.js      --in="$T/23.html" --out="$T/24.html"
node tools/r1851/patch_os46_anim_wiring.js         --in="$T/24.html" --out="$T/25.html"
node tools/r1851/patch_os47_spin_move.js           --in="$T/25.html" --out="$T/26.html"
node tools/r1851/patch_os48_carry_flow.js          --in="$T/26.html" --out="$T/27.html"
node tools/r1851/patch_os49_body_360.js            --in="$T/27.html" --out="$T/28.html"
node tools/r1851/patch_os50_setpiece_clean.js      --in="$T/28.html" --out="$T/29.html"
node tools/r1851/patch_os51_beaten_defender.js     --in="$T/29.html" --out="$T/30.html"
node tools/r1851/patch_os52_clockrate_retune.js    --in="$T/30.html" --out="$T/31.html"
node tools/r1851/patch_os53_freekick_angle.js      --in="$T/31.html" --out="$T/32.html"
node tools/r1851/patch_os54_dribble_propensity.js  --in="$T/32.html" --out="$T/33.html"
node tools/r1851/patch_os55_penalty_on_pitch.js    --in="$T/33.html" --out="$T/34.html"
node tools/r1851/patch_os56_label_inside.js        --in="$T/34.html" --out="$T/35.html"
node tools/r1851/patch_os57_desktop_camera.js      --in="$T/35.html" --out="$T/36.html"
node tools/r1851/patch_os58_run_cycle.js           --in="$T/36.html" --out="$T/37.html"
node tools/r1851/patch_os59_header_pose.js         --in="$T/37.html" --out="$T/38.html"
node tools/r1851/patch_os60_dribble_poses.js       --in="$T/38.html" --out="$T/39.html"
node tools/r1851/patch_os61_stadium_wrap.js        --in="$T/39.html" --out="$T/40.html"
node tools/r1851/patch_os62_label_decollide.js     --in="$T/40.html" --out="$T/41.html"
# OS-63 (arbitro + padrao de camisa) SAIU DA CADEIA na OS-66.
#   Observacao de campo: "a 81 quebrou tambem, a parte grafica ficou estranha".
#   Comparadas as bonecas isoladas da R18.80 e da R18.81 lado a lado, o padrao
#   de camisa era pintado com a cor ESCURA do time a 55% sobre metade da area
#   do tronco; no tamanho real de ~20 px isso nao le como listra, le como
#   sujeira, e a cor do time fica encardida. E o arbitro entrava como um vulto
#   preto MENOR que os atletas colado na bola o tempo todo.
#   O script continua no repositorio; so nao entra na build.
# node tools/r1851/patch_os63_ref_and_kits.js      --in="$T/41.html" --out="$T/42.html"
node tools/r1851/patch_os64_overlay_matrix.js      --in="$T/41.html" --out="$T/42.html"
node tools/r1851/patch_os65_effort_by_ball.js      --in="$T/42.html" --out="$OUT"
echo "-> $OUT"
