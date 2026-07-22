#!/usr/bin/env python3
"""
Gera src/ux/patches.json — patches de APRESENTAÇÃO aplicados pelo build_ux.py
sobre a base R13 (precedente: inject_r13.js). Extrai os trechos 'from' do
próprio módulo para garantir correspondência exata, e valida unicidade.
Rode após qualquer mudança na base: python3 tools/ux/make_patches.py

Camada 2.5D: o campo é reprojetado em perspectiva (window.CDS_F25D.project),
com pitch/gols/arquibancada pré-renderizados, jogadores em pé com escala por
profundidade e ordenação por worldY. Tudo apresentação — o motor não muda.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# 'mod' = TODO o JS embutido (base + camadas R7..R13), na ordem do manifesto.
# É contra isso que o build_ux aplica os patches — então _turnover ativo (R13),
# desarme ativo (R12) etc. são encontrados aqui, não só a função-base morta.
_MAN = json.loads((ROOT / 'manifests/r13-build-manifest.json').read_text(encoding='utf-8'))
mod = "\n".join((ROOT / b['module']).read_text(encoding='utf-8')
                for b in _MAN['blocks'] if b['module'].endswith('.js'))

def block(start_marker, end_marker):
    i = mod.index(start_marker)
    j = mod.index(end_marker, i) + len(end_marker)
    return mod[i:j]

patches = []

# ── câmera: alvo de pan segue a BOLA PROJETADA (senão o zoom mobile erra o centro)
patches.append({"id": "cam-target-replay",
    "from": "      const tx = cx(rframe.ball.x), ty = cy(rframe.ball.y);",
    "to":   "      let tx = cx(rframe.ball.x), ty = cy(rframe.ball.y);\n"
            "      if (window.CDS_F25D) { const _pj = window.CDS_F25D.project(tx, ty); tx = _pj.x; ty = _pj.y; }"})
patches.append({"id": "cam-target-live",
    "from": "      const tx = cx(sb.x), ty = cy(sb.y);",
    "to":   "      let tx = cx(sb.x), ty = cy(sb.y);\n"
            "      if (window.CDS_F25D) { const _pj = window.CDS_F25D.project(tx, ty); tx = _pj.x; ty = _pj.y; }"})

# ── gramado + estádio (pré-renderizado; cobre o canvas todo)
p_from = block("  /* gramado listrado */", "ctx.fillRect(M+i*sw, M, sw, fH);\n  }")
patches.append({"id": "grass", "from": p_from, "to":
    "  /* gramado listrado (delegado ao palco 2.5D quando presente) */\n"
    "  if (window.CDS_F25D) { window.CDS_F25D.grass(ctx, M, fW, fH); } else {\n"
    + p_from.replace("  /* gramado listrado */\n", "") + " }"})

# ── marcações + gols: no 2.5D já estão no palco pré-renderizado
p_from = block("  /* marcações */", "  ctx.strokeRect(CW-M,(CH-goalH)/2,7,goalH);")
patches.append({"id": "pitch-markings", "from": p_from, "to":
    "  if (!window.CDS_F25D) {\n" + p_from + "\n  }"})

# ── profundidade: um único grupo ordenado por worldY (quem está atrás desenha antes)
p_from = ("  const groups = playersToDraw\n"
          "    ? [{ color: null, players: playersToDraw }]\n"
          "    : st.teams.map(t => ({ color: t.color, players: t.players }));")
patches.append({"id": "depth-sort", "from": p_from, "to":
    p_from.replace("  const groups", "  let groups") + "\n"
    "  if (window.CDS_F25D) {\n"
    "    const _all = [];\n"
    "    for (const g of groups) for (const pl of g.players) { if (g.color && pl.color == null) pl.color = g.color; _all.push(pl); }\n"
    "    _all.sort((a, b) => a.y - b.y);\n"
    "    groups = [{ color: null, players: _all }];\n"
    "  }"})

# ── coordenadas do jogador: projeta o ponto de chão e escala o raio
patches.append({"id": "player-project",
    "from": "      const groundX=_rx, groundY=_ry;\n"
            "      let x=groundX, y=groundY, r=13, divePose=false, actionWave=0;",
    "to":   "      let groundX=_rx, groundY=_ry, _ps=1;\n"
            "      if (window.CDS_F25D) { const _pj=window.CDS_F25D.project(_rx,_ry); groundX=_pj.x; groundY=_pj.y; _ps=_pj.s; }\n"
            "      let x=groundX, y=groundY, r=13*_ps, divePose=false, actionWave=0;"})

# ── sombra do atleta em pé: elipse fina nos PÉS (o corpo sobe a partir dela)
patches.append({"id": "player-shadow",
    "from": "      ctx.beginPath(); ctx.ellipse(groundX,groundY+5,r*(1+actionWave*.18),r*.72,0,0,Math.PI*2);",
    "to":   "      ctx.beginPath();\n"
            "      if (window.CDS_F25D) ctx.ellipse(groundX,groundY+r*.98,r*.82*(1+actionWave*.18),r*.34,0,0,Math.PI*2);\n"
            "      else ctx.ellipse(groundX,groundY+5,r*(1+actionWave*.18),r*.72,0,0,Math.PI*2);"})

# ── mini-atleta em pé (kit completo) no lugar do círculo
p_from = block("      // corpo: no mergulho do goleiro",
               "ctx.strokeStyle = p.hasBall ? '#fff' : 'rgba(255,255,255,.42)';\n      ctx.stroke();")
patches.append({"id": "player-body", "from": p_from, "to":
    "      // corpo: delegado ao atleta em pé 2.5D quando presente (apresentação)\n"
    "      if (window.CDS_F25D) { window.CDS_F25D.body(ctx, { x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0)), act: p._act||'', pose: (motion&&motion.type)||'', wave: actionWave }); } else {\n"
    + p_from + " }"})

# ── pill perto da bola: a distância usa a bola PROJETADA
patches.append({"id": "pill-dist-project",
    "from": "      const _bs = st.ball;\n      const _bd = Math.hypot(x - cx(_bs.x), y - cy(_bs.y));",
    "to":   "      const _bs = st.ball;\n"
            "      let _bpx = cx(_bs.x), _bpy = cy(_bs.y);\n"
            "      if (window.CDS_F25D) { const _bp = window.CDS_F25D.project(_bpx, _bpy); _bpx = _bp.x; _bpy = _bp.y; }\n"
            "      const _bd = Math.hypot(x - _bpx, y - _bpy);"})

# ── trajetória de passe/chute: delegação total (arco aéreo passa pela bola)
_traj_head = "    const x1=cx(bT.from.x), y1=cy(bT.from.y), x2=cx(bT.target.x), y2=cy(bT.target.y);"
p_traj = block(_traj_head, "    ctx.closePath(); ctx.fill();\n    ctx.restore();")
p_traj_body = p_traj[len(_traj_head):]
patches.append({"id": "traj-project", "from": p_traj, "to":
    "    if (window.CDS_F25D) {\n"
    "      window.CDS_F25D.traj(ctx, { fx: bT.from.x, fy: bT.from.y, tx: bT.target.x, ty: bT.target.y,\n"
    "        gx: bT.x, gy: bT.y, z: bT.z || 0, kind: bT.kind, cx, cy });\n"
    "    } else {\n"
    "    const x1=cx(bT.from.x), y1=cy(bT.from.y), x2=cx(bT.target.x), y2=cy(bT.target.y);"
    + p_traj_body + " }"})

# ── vfx no ponto projetado
patches.append({"id": "vfx-project",
    "from": "    const x = cx(v.x), y = cy(v.y);",
    "to":   "    let x = cx(v.x), y = cy(v.y);\n"
            "    if (window.CDS_F25D) { const _pj = window.CDS_F25D.project(x, y); x = _pj.x; y = _pj.y; }"})

# ── rastro em arco (projetado + z)
p_from = block("  if (!rframe) { ctx.save(); ctx.shadowColor = 'rgba(255,215,50,.9)';",
               "ctx.restore();\n  }")
patches.append({"id": "trail-arc", "from": p_from, "to":
    "  if (!rframe) { if (window.CDS_F25D) { window.CDS_F25D.trail(ctx, trailPts, cx, cy); } else {"
    + p_from[len("  if (!rframe) {"):] + " }"})

# ── bola pro projetada (fio bola-sombra, anel de queda, gomos, escala)
p_from = block("  // #brilho da bola — halo suave",
               "ctx.beginPath(); ctx.arc(bx,by,4,0,Math.PI*2); ctx.stroke();")
patches.append({"id": "ball-pro", "from": p_from, "to":
    "  if (window.CDS_F25D) {\n"
    "    const _tv = (!rframe && bT && bT.traveling && bT.target) ? { tx: cx(bT.target.x), ty: cy(bT.target.y), kind: bT.kind } : null;\n"
    "    window.CDS_F25D.ball(ctx, { gx: cx(b.x), gy: cy(b.y), z: b.z || 0, tv: _tv });\n"
    "  } else {\n" + p_from + " }"})

# ── trail guarda z (para o arco aéreo)
patches.append({"id": "trail-z",
    "from": "  trailPts.unshift({ x: b.x, y: b.y });",
    "to":   "  trailPts.unshift({ x: b.x, y: b.y, z: b.z || 0 });"})

# ── ATL-037: número da camisa ESCALA com a profundidade (fonte ∝ s = r/13)
patches.append({"id": "num-depth-scale",
    "from": "      ctx.font = `bold 10px Arial,sans-serif`;\n      ctx.textAlign='center'; ctx.textBaseline='middle';\n      ctx.fillText(p.num||'', x, y);",
    "to":   "      ctx.font = `bold ${Math.max(7, Math.min(12, 10 * r / 13)).toFixed(1)}px Arial,sans-serif`;\n      ctx.textAlign='center'; ctx.textBaseline='middle';\n      ctx.fillText(p.num||'', x, y);"})

# ── pill de nome clampada ao campo (não corta na borda da câmera)
patches.append({"id": "pill-clamp-decl",
    "from": "      const pw = tw + 8, ph2 = 11, py2 = y + r + 2;",
    "to":   "      const pw = tw + 8, ph2 = 11, py2 = y + r + 2, pxc = Math.max(M + pw/2 + 2, Math.min(CW - M - pw/2 - 2, x));"})
patches.append({"id": "pill-clamp-rect",
    "from": "      ctx.roundRect(x - pw/2, py2, pw, ph2, 6);",
    "to":   "      ctx.roundRect(pxc - pw/2, py2, pw, ph2, 6);"})
patches.append({"id": "pill-clamp-text",
    "from": "      ctx.fillText(nm, x, py2 + ph2/2 + 0.5);",
    "to":   "      ctx.fillText(nm, pxc, py2 + ph2/2 + 0.5);"})

# ── FIX pré-existente da R13.0: placar do header não atualizava após gol
patches.append({"id": "score-resync",
    "from": "  el.textContent=`${ph} ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;",
    "to":   "  el.textContent=`${ph} ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;\n"
            "  const scEl=$('#score'); const scTxt=`${sim.score[0]}–${sim.score[1]}`;\n"
            "  if (scEl && scEl.textContent !== scTxt) scEl.textContent = scTxt;"})

# ── POSES DE AÇÃO (ATL-021): dispara motions visuais 'kick'/'tackle' nos eventos do
# motor. É o MESMO consumidor render-side que já chama motionAt('dive'/'claim'/'jump');
# roda só no navegador (nunca no runner headless do golden) e não usa RNG → balanço-neutro.
patches.append({"id": "pose-tackle",
    "from": "  if (e.type === 'tackle' && e.by) fxAt(e.by, 'star', 0.7);",
    "to":   "  if (e.type === 'tackle' && e.by) { fxAt(e.by, 'star', 0.7); motionAt(e.by, 'tackle', 0.5); }"})
patches.append({"id": "pose-shot",
    "from": "  if (e.type === 'shot_taken' && e.by) fxAt(e.by, 'ring', 0.5);   // #impacto: anel de força no chute",
    "to":   "  if (e.type === 'shot_taken' && e.by) { fxAt(e.by, 'ring', 0.5); motionAt(e.by, 'kick', 0.42); }   // #impacto: anel + pose de chute"})
patches.append({"id": "pose-cross",
    "from": "  if (e.type === 'cross' && e.by) fxAt(e.by, 'arrow', 0.7);",
    "to":   "  if (e.type === 'cross' && e.by) { fxAt(e.by, 'arrow', 0.7); motionAt(e.by, 'kick', 0.42); }"})
patches.append({"id": "pose-freekick",
    "from": "  if (e.type === 'legend' && e.by) fxAt(e.by, 'fire', 1.6);",
    "to":   "  if (e.type === 'legend' && e.by) fxAt(e.by, 'fire', 1.6);\n"
            "  if (e.type === 'freekick' && e.by) motionAt(e.by, 'kick', 0.46);   // pose de cobrança de falta no 2.5D"})
patches.append({"id": "pose-pass",
    "from": "  if (e.type === 'pass') {\n    if (passNarrCd <= 0 && vrand() < 0.6) {",
    "to":   "  if (e.type === 'pass') {\n    if (e.by) motionAt(e.by, 'kick', 0.32);\n    if (passNarrCd <= 0 && vrand() < 0.6) {"})

# ── (PRO-031..035) As cenas dedicadas de falta/pênalti (drawFkScene/drawPenScene,
# atrás-do-gol) serão REDESENHADAS pelo usuário depois — NÃO reskinar agora. Em PARTIDA,
# faltas e pênaltis JÁ resolvem no motor 2.5D (minigame desativado em _requestSetPiece,
# ret. false). O trabalho aqui é dar uma ANIMAÇÃO de falta no palco 2.5D como o escanteio.

# ── UX-031..035: draft NUNCA trava em 10/11 (UI, fora do motor). Helper de progresso +
# reroll de emergência + roleta enviesada p/ time com peça compatível.
patches.append({"id": "draft-canprogress",
    "from": "function canPlay(player, slot){ return player.elig.indexOf(slot) !== -1; }",
    "to":   "function canPlay(player, slot){ return player.elig.indexOf(slot) !== -1; }\n"
            "function _draftCanProgress(d){\n"
            "  if(!d||!d.cur||!d.cur.pl) return true;\n"
            "  const taken = pickedIds();\n"
            "  const avail = d.cur.pl.filter(p=>!taken.has(p.id));\n"
            "  return d.slots.filter(s=>!s.p).every(s=> avail.some(p=>canPlay(p,s.pos)));\n"
            "}"})
patches.append({"id": "draft-emergency",
    "from": "  const team = d.cur;\n  const nPick = Math.min(filled() + 1, 11);",
    "to":   "  const team = d.cur;\n"
            "  // UX-031: nunca trava — sem peça compatível p/ um slot vazio e sem rerolls,\n"
            "  // concede reroll de EMERGÊNCIA (roleta enviesada p/ time compatível em rollTeam).\n"
            "  if (d.cur && filled() < 11 && d.rerolls <= 0 && !_draftCanProgress(d)) {\n"
            "    d.rerolls = 1; toast('Reroll de emergência: elenco sem peça compatível.');\n"
            "  }\n"
            "  const nPick = Math.min(filled() + 1, 11);"})
patches.append({"id": "draft-reroll-bias",
    "from": "  if (!pool.length) { d.used = new Set(); pool = all.slice(); }\n  d.cur = rnd(pool);",
    "to":   "  if (!pool.length) { d.used = new Set(); pool = all.slice(); }\n"
            "  // UX-031: havendo slots vazios, prioriza times que TÊM peça compatível (evita travar)\n"
            "  const _need = d.slots.filter(s=>!s.p).map(s=>s.pos);\n"
            "  if (_need.length) {\n"
            "    const _taken = pickedIds();\n"
            "    const _good = pool.filter(t => (t.pl||[]).some(p=>!_taken.has(p.id) && _need.some(pos=>canPlay(p,pos))));\n"
            "    if (_good.length) pool = _good;\n"
            "  }\n"
            "  d.cur = rnd(pool);"})

# ═══ (SEM PATCH DE MOTOR) — o dwell é CARGA do balanço da R13.0, provado 2x ═══════════
# A "bola presa entre dois jogadores" (dwell) é REAL e pré-existente (207/284 travas de
# 2 jogadores, até 45s de jogo em estilos), mas é INTRÍNSECA ao equilíbrio validado:
#   • 1ª tentativa — afastar pra FRENTE (11,5 m/s): ppgRange 0,893, |saldo| 0,679  FAIL
#   • 2ª tentativa — SAÍDA SEGURA (_safePass), neutra por design: ppgRange 0,929        FAIL
#   • Golden R13.0 (mesmo config, 98 partidas, repeats=2): ppgRange 0,571  PASS
#   • Sonda reproduz o golden byte a byte (40/40 diversas idênticas) → medição válida.
# Qualquer intervenção que PROLONGUE ou REDIRECIONE a posse no dwell muda a distribuição
# de desfechos (o dwell termina em desarme/perda ~naturalmente, e isso É parte do saldo):
# manter posse infla gols (+0,36/jogo), soltar pra frente cria chance. NÃO existe conserto
# de MOTOR balanço-neutro. Como o usuário exigiu "USE OS MESMOS GATES", o motor fica
# BYTE-FIEL à R13.0 e a percepção de "trava" é tratada na CAMADA VISUAL (src/ux):
# legibilidade da posse + suavização de jank. Evidência: reports/ux/ + probe_balllock.

ok = True
for p in patches:
    n = mod.count(p["from"])
    tag = ' [MOTOR]' if p.get('engine') else ''
    print(f"  {p['id']:<26} ocorrências: {n}{tag}")
    if n != 1: ok = False
if not ok:
    sys.exit("ERRO: patch não-único — ajuste os marcadores")

out = ROOT / 'src/ux/patches.json'
out.write_text(json.dumps(patches, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"\n{out} gravado com {len(patches)} patches")
