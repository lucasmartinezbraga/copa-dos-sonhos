#!/usr/bin/env python3
"""
Gera src/ux/patches.json — patches de APRESENTAÇÃO aplicados pelo build_ux.py
sobre a base R13 (precedente: inject_r13.js). Extrai os trechos 'from' do
próprio módulo para garantir correspondência exata, e valida unicidade.
Rode após qualquer mudança na base: python3 tools/ux/make_patches.py
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
mod = (ROOT / 'src/r13/scripts/10-base-bundle.js').read_text(encoding='utf-8')

def block(start_marker, end_marker):
    i = mod.index(start_marker)
    j = mod.index(end_marker, i) + len(end_marker)
    return mod[i:j]

patches = []

# gramado rico (offscreen cache no layer)
p_from = block("  /* gramado listrado */", "ctx.fillRect(M+i*sw, M, sw, fH);\n  }")
patches.append({"id": "grass", "from": p_from, "to":
    "  /* gramado listrado (delegado ao kit 2.5D quando presente) */\n"
    "  if (window.CDS_F25D) { window.CDS_F25D.grass(ctx, M, fW, fH); } else {\n"
    + p_from.replace("  /* gramado listrado */\n", "") + " }"})

# mini-atleta top-down
p_from = block("      // corpo: no mergulho do goleiro",
               "ctx.strokeStyle = p.hasBall ? '#fff' : 'rgba(255,255,255,.42)';\n      ctx.stroke();")
patches.append({"id": "player-body", "from": p_from, "to":
    "      // corpo: delegado ao mini-atleta 2.5D quando presente (apresentação)\n"
    "      if (window.CDS_F25D) { window.CDS_F25D.body(ctx, { x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0)) }); } else {\n"
    + p_from + " }"})

# rastro em arco (usa z)
p_from = block("  if (!rframe) { ctx.save(); ctx.shadowColor = 'rgba(255,215,50,.9)';",
               "ctx.restore();\n  }")
patches.append({"id": "trail-arc", "from": p_from, "to":
    "  if (!rframe) { if (window.CDS_F25D) { window.CDS_F25D.trail(ctx, trailPts, cx, cy); } else {"
    + p_from[len("  if (!rframe) {"):] + " }"})

# bola pro (fio bola-sombra, anel de queda, gomos, escala por altura)
p_from = block("  // #brilho da bola — halo suave",
               "ctx.beginPath(); ctx.arc(bx,by,4,0,Math.PI*2); ctx.stroke();")
patches.append({"id": "ball-pro", "from": p_from, "to":
    "  if (window.CDS_F25D) {\n"
    "    const _tv = (!rframe && bT && bT.traveling && bT.target) ? { tx: cx(bT.target.x), ty: cy(bT.target.y), kind: bT.kind } : null;\n"
    "    window.CDS_F25D.ball(ctx, { bx, by, gx: cx(b.x), gy: cy(b.y), z: b.z || 0, tv: _tv });\n"
    "  } else {\n" + p_from + " }"})

# trail guarda z (para o arco aéreo)
patches.append({"id": "trail-z",
    "from": "  trailPts.unshift({ x: b.x, y: b.y });",
    "to":   "  trailPts.unshift({ x: b.x, y: b.y, z: b.z || 0 });"})

# pill de nome clampada ao campo (não corta na borda da câmera)
patches.append({"id": "pill-clamp-decl",
    "from": "      const pw = tw + 8, ph2 = 11, py2 = y + r + 2;",
    "to":   "      const pw = tw + 8, ph2 = 11, py2 = y + r + 2, pxc = Math.max(M + pw/2 + 2, Math.min(CW - M - pw/2 - 2, x));"})
patches.append({"id": "pill-clamp-rect",
    "from": "      ctx.roundRect(x - pw/2, py2, pw, ph2, 6);",
    "to":   "      ctx.roundRect(pxc - pw/2, py2, pw, ph2, 6);"})
patches.append({"id": "pill-clamp-text",
    "from": "      ctx.fillText(nm, x, py2 + ph2/2 + 0.5);",
    "to":   "      ctx.fillText(nm, pxc, py2 + ph2/2 + 0.5);"})

# FIX pré-existente da R13.0: o placar do header não atualizava após gol
# (motor [0,1] x header "0–0", confirmado no build autoritativo puro em
# navegador real). O tick de UI de 0,35s re-sincroniza o placar com o motor.
patches.append({"id": "score-resync",
    "from": "  el.textContent=`${ph} ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;",
    "to":   "  el.textContent=`${ph} ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;\n"
            "  const scEl=$('#score'); const scTxt=`${sim.score[0]}–${sim.score[1]}`;\n"
            "  if (scEl && scEl.textContent !== scTxt) scEl.textContent = scTxt;"})

ok = True
for p in patches:
    n = mod.count(p["from"])
    print(f"  {p['id']:<18} ocorrências: {n}")
    if n != 1: ok = False
if not ok:
    sys.exit("ERRO: patch não-único — ajuste os marcadores")

out = ROOT / 'src/ux/patches.json'
out.write_text(json.dumps(patches, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"\n{out} gravado com {len(patches)} patches")
