/* Copa dos Sonhos · Campo 2.5D "Canvas 2D Pro" (camada de apresentação)
 * ---------------------------------------------------------------------------
 * Renderização nova de gramado, jogadores, bola e rastro, consumida por
 * paintField() via delegação (patches do build RC-UX). Segue a referência
 * aprovada: leitura clara de altura (fio bola↔sombra, anel de queda, rastro
 * em arco), jogadores como mini-atletas top-down com camisa e cabeça.
 * NUNCA decide futebol: só desenha o estado que o motor já calculou. */
(function (root) {
  'use strict';
  if (root.CDS_F25D) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── GRAMADO ─────────────────────────────────────────────────────────────
   * Pré-renderizado num canvas offscreen (1 drawImage por frame). */
  const grassCache = { key: '', cv: null };
  function buildGrass(fW, fH) {
    const cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.round(fW)); cv.height = Math.max(2, Math.round(fH));
    const g = cv.getContext('2d');
    const nS = 8, sw = fW / nS;
    for (let i = 0; i < nS; i++) {
      const lg = g.createLinearGradient(0, 0, 0, fH);
      if (i % 2 === 0) { lg.addColorStop(0, '#249a55'); lg.addColorStop(.5, '#1f8f4c'); lg.addColorStop(1, '#1c8446'); }
      else { lg.addColorStop(0, '#1e8b49'); lg.addColorStop(.5, '#1a8143'); lg.addColorStop(1, '#17773d'); }
      g.fillStyle = lg;
      g.fillRect(i * sw, 0, sw + 1, fH);
      // linha de corte entre faixas
      g.fillStyle = 'rgba(0,0,0,.05)';
      g.fillRect(i * sw, 0, 1.5, fH);
    }
    // luz central (holofote) + vinheta de borda
    const lite = g.createRadialGradient(fW / 2, fH / 2, fH * .15, fW / 2, fH / 2, fW * .62);
    lite.addColorStop(0, 'rgba(255,255,240,.07)'); lite.addColorStop(1, 'rgba(255,255,240,0)');
    g.fillStyle = lite; g.fillRect(0, 0, fW, fH);
    const vig = g.createRadialGradient(fW / 2, fH / 2, fH * .34, fW / 2, fH / 2, fW * .72);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,10,4,.30)');
    g.fillStyle = vig; g.fillRect(0, 0, fW, fH);
    return cv;
  }
  function grass(ctx, M, fW, fH) {
    const key = fW + 'x' + fH;
    if (grassCache.key !== key) { grassCache.cv = buildGrass(fW, fH); grassCache.key = key; }
    ctx.drawImage(grassCache.cv, M, M);
  }

  /* ── JOGADORES (mini-atleta top-down) ────────────────────────────────────
   * Direção de corrida inferida da própria tela (cache local, só visual). */
  const dirCache = new Map();
  function shade(hex, f) {
    // clareia (f>0) ou escurece (f<0) uma cor #rrggbb
    const n = parseInt(hex.slice(1), 16);
    const ch = s => clamp(Math.round(((n >> s) & 255) * (1 + f)), 0, 255);
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }
  function body(ctx, o) {
    const { x, y, r } = o;
    const jersey = o.isGK ? o.gkC : o.pc;
    const isHex = /^#[0-9a-fA-F]{6}$/.test(jersey);
    const dark = isHex ? shade(jersey, -0.34) : jersey;
    const lite = isHex ? shade(jersey, 0.22) : jersey;

    // direção (só visual)
    let d = dirCache.get(o.key);
    if (!d) { d = { x, y, a: -Math.PI / 2 }; dirCache.set(o.key, d); }
    const dx = x - d.x, dy = y - d.y, mv = Math.hypot(dx, dy);
    if (mv > 0.7) d.a = Math.atan2(dy, dx);
    d.x = x; d.y = y;
    const a = o.divePose ? Math.PI / 2 : d.a;

    ctx.save();
    ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    // braços (ombros) — dois nós laterais
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(-r * .88, -r * .05, r * .30, r * .42, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * .88, -r * .05, r * .30, r * .42, 0, 0, TAU); ctx.fill();
    // torso (camisa) com luz frontal
    const tg = ctx.createLinearGradient(0, -r, 0, r);
    tg.addColorStop(0, lite); tg.addColorStop(.55, jersey); tg.addColorStop(1, dark);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (o.divePose ? 1.34 : 0.92), r * (o.divePose ? 0.62 : 1.02), 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = o.hasBall ? 2.4 : 1.2;
    ctx.strokeStyle = o.hasBall ? '#ffffff' : 'rgba(255,255,255,.4)';
    ctx.stroke();
    // cabeça adiantada na direção da corrida (deixa o centro livre p/ o número)
    const hy = -r * (o.divePose ? 0.95 : 0.68), hr = r * .38;
    ctx.beginPath(); ctx.arc(0, hy, hr, 0, TAU);
    ctx.fillStyle = '#e9b98b'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, hy + hr * .28, hr, Math.PI * 0.12, Math.PI * 0.88);
    ctx.fillStyle = 'rgba(52,32,16,.45)'; ctx.fill();
    ctx.restore();
  }

  /* ── RASTRO EM ARCO ──────────────────────────────────────────────────────
   * Usa o z gravado no trail: o cometa acompanha a bola no ar. */
  function trail(ctx, pts, cx, cy) {
    if (!pts.length) return;
    ctx.save();
    for (let i = pts.length - 1; i >= 0; i--) {
      const tp = pts[i], f = 1 - i / pts.length;
      const px = cx(tp.x), py = cy(tp.y) - (tp.z || 0) * 22;
      ctx.shadowColor = 'rgba(255,215,50,.9)'; ctx.shadowBlur = 10 * f;
      ctx.fillStyle = 'rgba(255,224,90,' + (f * 0.7).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, 4.4 - i * .5), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ── BOLA PRO (altura legível) ───────────────────────────────────────────
   * Sombra ancora no chão; fio tracejado bola↔sombra; anel de queda pulsante
   * no destino de passes/cruzamentos aéreos; bola cresce sutilmente com z. */
  function ball(ctx, o) {
    const z = o.z || 0, air = clamp(z / 3.2, 0, 1);

    // anel de queda no destino (não para chutes: o destino é o gol)
    if (o.tv && o.tv.kind !== 'shot' && z > 0.35) {
      const pulse = 1 + Math.sin(performance.now() / 130) * .18;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,64,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(o.tv.tx, o.tv.ty, 8.5 * pulse, 4.6 * pulse, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,64,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(o.tv.tx, o.tv.ty, 13 * pulse, 7 * pulse, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // sombra no gramado (menor e mais leve quanto mais alta a bola)
    ctx.save();
    ctx.globalAlpha = .32 - air * .14;
    ctx.beginPath(); ctx.ellipse(o.gx, o.gy + 2.5, 5.6 - air * 1.8, 2.9 - air * 1.0, 0, 0, TAU);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    // fio bola↔sombra
    if (z > 0.5) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,230,120,.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(o.gx, o.gy); ctx.lineTo(o.bx, o.by); ctx.stroke();
      ctx.restore();
    }

    // halo de leitura
    ctx.save();
    const halo = ctx.createRadialGradient(o.bx, o.by, 0, o.bx, o.by, 13);
    halo.addColorStop(0, 'rgba(255,238,140,.42)'); halo.addColorStop(1, 'rgba(255,238,140,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(o.bx, o.by, 13, 0, TAU); ctx.fill();
    ctx.restore();

    // corpo da bola (cresce sutilmente com a altura)
    const rb = 6.4 + air * 2.4;
    const bg = ctx.createRadialGradient(o.bx - rb * .36, o.by - rb * .36, 0, o.bx, o.by, rb);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(.75, '#e9e9e9'); bg.addColorStop(1, '#b9bcc4');
    ctx.beginPath(); ctx.arc(o.bx, o.by, rb, 0, TAU);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = '#3d3f46'; ctx.lineWidth = .8; ctx.stroke();
    // gomos: pentágono central + costuras, girando com o deslocamento
    const rot = (o.gx + o.gy) * 0.045;
    ctx.save();
    ctx.translate(o.bx, o.by); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(40,44,52,.78)';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + i * TAU / 5;
      const px = Math.cos(an) * rb * .34, py = Math.sin(an) * rb * .34;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,74,84,.5)'; ctx.lineWidth = .7;
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + i * TAU / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(an) * rb * .34, Math.sin(an) * rb * .34);
      ctx.lineTo(Math.cos(an) * rb * .86, Math.sin(an) * rb * .86);
      ctx.stroke();
    }
    ctx.restore();
  }

  root.CDS_F25D = Object.freeze({ version: '1.0.0', grass, body, trail, ball });
})(typeof window !== 'undefined' ? window : globalThis);
