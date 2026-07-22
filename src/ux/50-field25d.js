/* Copa dos Sonhos · Motor Visual 2.5D (camada de apresentação)
 * ---------------------------------------------------------------------------
 * Perspectiva REAL sobre o Canvas 2D existente, na direção da referência
 * aprovada: pitch trapezoidal com profundidade exata (1/d), gols de pé em 3D,
 * arquibancada ao redor, jogadores EM PÉ com camisa/shorts/cabeça e escala por
 * profundidade, bola com gomos + fio bola↔sombra + anel de queda + rastro em
 * arco. Consumida por paintField() via patches de delegação (build RC-UX).
 * NUNCA decide futebol: só desenha o estado que o motor já calculou. */
(function (root) {
  'use strict';
  if (root.CDS_F25D) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── PROJEÇÃO ────────────────────────────────────────────────────────────
   * Plano do campo visto por câmera de TV alta. Coordenadas de entrada são as
   * lógicas planas do jogo (canvas 1024×500, campo com margem M). A borda
   * próxima (embaixo) mantém a largura; a distante encolhe para R0 — com
   * interpolação perspectiva exata (largura ∝ 1/profundidade). */
  const G = {
    CW: 1024, CH: 500, M: 12,          // corrigidos no 1º grass()
    R0: 0.72,                          // largura distante / próxima
    topY: 46, bottomY: 497,            // faixa vertical do pitch projetado
    ready: false,
  };
  function setGeom(M, fW, fH) {
    G.M = M; G.CW = fW + 2 * M; G.CH = fH + 2 * M;
    G.topY = M + 34; G.bottomY = G.CH - 3;
    G.ready = true;
  }
  function project(fx, fy) {
    const fW = G.CW - 2 * G.M, fH = G.CH - 2 * G.M;
    const u = (fx - G.M) / fW;                 // 0..1 esquerda→direita
    const vn = (fy - G.M) / fH;                // 0 topo(longe) .. 1 base(perto)
    const D = 1 / G.R0;
    const d = 1 + (D - 1) * (1 - vn);          // profundidade: perto=1, longe=D
    const s = 1 / d;
    const Yn = (1 - s) / (1 - G.R0);           // 0 perto .. 1 longe (persp. exata)
    return {
      x: G.CW / 2 + (u - 0.5) * fW * s,
      y: G.bottomY - Yn * (G.bottomY - G.topY),
      s,
    };
  }

  /* ── PALCO ESTÁTICO (estádio + gramado + linhas + gols) ─────────────────
   * Pré-renderizado uma vez; 1 drawImage por frame. */
  const stage = { key: '', cv: null };
  function P(fx, fy) { return project(fx, fy); }
  function line(g, ax, ay, bx, by, w, style) {
    const a = P(ax, ay), b = P(bx, by);
    g.strokeStyle = style; g.lineWidth = w * (a.s + b.s) / 2;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
  function sampled(g, pts, w, style, close) {
    g.strokeStyle = style; g.lineWidth = w;
    g.beginPath();
    pts.forEach((q, i) => { const p = P(q[0], q[1]); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
    if (close) g.closePath();
    g.stroke();
  }
  function circlePts(cx0, cy0, r, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; out.push([cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r]); }
    return out;
  }
  function buildStage() {
    const { CW, CH, M } = G, fW = CW - 2 * M, fH = CH - 2 * M;
    const cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    const g = cv.getContext('2d');

    // céu/arena de fundo
    const sky = g.createLinearGradient(0, 0, 0, CH);
    sky.addColorStop(0, '#050b16'); sky.addColorStop(.5, '#081120'); sky.addColorStop(1, '#0a1523');
    g.fillStyle = sky; g.fillRect(0, 0, CW, CH);

    // arquibancada: anel de arquibancada atrás do gramado (faixas + torcida pontilhada)
    const standTop = 0, standBot = G.topY + 8;
    const st = g.createLinearGradient(0, standTop, 0, standBot);
    st.addColorStop(0, '#0b1524'); st.addColorStop(1, '#13233a');
    g.fillStyle = st; g.fillRect(0, standTop, CW, standBot - standTop);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0; row < 5; row++) {
      const y = 8 + row * ((standBot - 14) / 5);
      for (let x = 6; x < CW - 6; x += 5) {
        if (rnd() < 0.72) {
          const c = rnd();
          g.fillStyle = c < .06 ? 'rgba(255,203,69,.5)' : c < .12 ? 'rgba(56,189,248,.45)' : `rgba(${170 + (c * 60) | 0},${175 + (c * 50) | 0},${190 + (c * 40) | 0},.30)`;
          g.fillRect(x + rnd() * 2, y + rnd() * 3, 2, 2);
        }
      }
    }
    // placas de publicidade na linha de fundo distante
    const farL = P(M, M), farR = P(CW - M, M);
    g.fillStyle = '#0d1b2e';
    g.fillRect(farL.x - 14, farL.y - 13, (farR.x - farL.x) + 28, 11);
    g.fillStyle = 'rgba(56,225,255,.5)';
    g.font = '700 7px "Barlow Condensed",Arial';
    g.textAlign = 'center';
    for (let i = 0; i < 7; i++) {
      g.fillText('COPA DOS SONHOS', farL.x + ((farR.x - farL.x) / 7) * (i + .5), farL.y - 5);
    }

    // avental de gramado ao redor do campo (mundo estendido além das linhas)
    const ap = 26;
    g.fillStyle = '#12622f';
    g.beginPath();
    [[M - ap, M - ap * .6], [CW - M + ap, M - ap * .6], [CW - M + ap * 1.5, CH - M + ap * .8], [M - ap * 1.5, CH - M + ap * .8]]
      .forEach((q, i) => { const p = P(q[0], q[1]); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
    g.closePath(); g.fill();

    // gramado listrado (trapézios em perspectiva)
    const nS = 8, sw = fW / nS;
    for (let i = 0; i < nS; i++) {
      const x0 = M + i * sw, x1 = x0 + sw;
      const c00 = P(x0, M), c10 = P(x1, M), c11 = P(x1, CH - M), c01 = P(x0, CH - M);
      const lg = g.createLinearGradient(0, c00.y, 0, c01.y);
      if (i % 2 === 0) { lg.addColorStop(0, '#1d7f45'); lg.addColorStop(1, '#27a45c'); }
      else { lg.addColorStop(0, '#187038'); lg.addColorStop(1, '#209150'); }
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(c00.x, c00.y); g.lineTo(c10.x, c10.y); g.lineTo(c11.x, c11.y); g.lineTo(c01.x, c01.y);
      g.closePath(); g.fill();
    }
    // luz de holofote + vinheta
    const mid = P(CW / 2, CH / 2);
    const lite = g.createRadialGradient(mid.x, mid.y, 40, mid.x, mid.y, CW * .58);
    lite.addColorStop(0, 'rgba(255,255,240,.08)'); lite.addColorStop(1, 'rgba(255,255,240,0)');
    g.fillStyle = lite; g.fillRect(0, 0, CW, CH);
    const vig = g.createLinearGradient(0, G.topY, 0, CH);
    vig.addColorStop(0, 'rgba(0,8,4,.30)'); vig.addColorStop(.4, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,8,4,.16)');
    g.fillStyle = vig; g.fillRect(0, 0, CW, CH);

    // marcações
    const L = 'rgba(240,250,255,.78)', Ls = 'rgba(240,250,255,.55)';
    g.lineJoin = 'round'; g.lineCap = 'round';
    sampled(g, [[M, M], [CW - M, M], [CW - M, CH - M], [M, CH - M]], 1.7, L, true);
    line(g, CW / 2, M, CW / 2, CH - M, 1.7, L);
    sampled(g, circlePts(CW / 2, CH / 2, (9.15 / 68) * fH, 44), 1.5, L);
    const dotc = P(CW / 2, CH / 2);
    g.fillStyle = L; g.beginPath(); g.arc(dotc.x, dotc.y, 2.2, 0, TAU); g.fill();
    const paW = (16.5 / 105) * fW, paH = (40.32 / 68) * fH;
    const gaW = (5.5 / 105) * fW, gaH = (18.32 / 68) * fH;
    for (const side of [0, 1]) {
      const gx = side ? CW - M : M, dir = side ? -1 : 1;
      // grande área
      sampled(g, [[gx, (CH - paH) / 2], [gx + dir * paW, (CH - paH) / 2], [gx + dir * paW, (CH + paH) / 2], [gx, (CH + paH) / 2]], 1.5, L);
      // pequena área
      sampled(g, [[gx, (CH - gaH) / 2], [gx + dir * gaW, (CH - gaH) / 2], [gx + dir * gaW, (CH + gaH) / 2], [gx, (CH + gaH) / 2]], 1.3, Ls);
      // marca do pênalti
      const ps = P(gx + dir * (11 / 105) * fW, CH / 2);
      g.fillStyle = L; g.beginPath(); g.arc(ps.x, ps.y, 2, 0, TAU); g.fill();
      // meia-lua: só o arco frontal fora da área
      const arc2 = [];
      for (let i = 0; i <= 18; i++) {
        const a = -Math.PI / 3.1 + (i / 18) * (2 * Math.PI / 3.1);
        const px = gx + dir * ((11 / 105) * fW + Math.cos(a) * (9.15 / 105) * fW);
        if ((dir > 0 && px < gx + paW) || (dir < 0 && px > gx - paW)) continue;
        arc2.push([px, CH / 2 + Math.sin(a) * (9.15 / 68) * fH]);
      }
      if (arc2.length > 2) sampled(g, arc2, 1.3, Ls);

      // GOL EM PÉ (3D): postes verticais + travessão + rede
      const goalH = (7.32 / 68) * fH;
      const y0 = (CH - goalH) / 2, y1 = (CH + goalH) / 2;
      const b0 = P(gx, y0), b1 = P(gx, y1);
      const hPx = 30 * ((b0.s + b1.s) / 2);          // altura visual do gol
      const back = 9 * ((b0.s + b1.s) / 2) * dir;    // profundidade da rede
      // rede (atrás)
      g.strokeStyle = 'rgba(220,235,255,.20)'; g.lineWidth = .7;
      for (let i = 0; i <= 4; i++) {
        const yy = b0.y + (b1.y - b0.y) * (i / 4);
        const xx = b0.x + (b1.x - b0.x) * (i / 4);
        g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - back, yy - hPx * .78); g.stroke();
      }
      g.beginPath(); g.moveTo(b0.x - back, b0.y - hPx * .78); g.lineTo(b1.x - back, b1.y - hPx * .78); g.stroke();
      // moldura branca
      g.strokeStyle = '#f4f9ff'; g.lineWidth = 2.4 * ((b0.s + b1.s) / 2);
      g.beginPath();
      g.moveTo(b0.x, b0.y); g.lineTo(b0.x, b0.y - hPx);
      g.lineTo(b1.x, b1.y - hPx); g.lineTo(b1.x, b1.y);
      g.stroke();
    }
    // bandeirinhas de escanteio
    for (const c of [[M, M], [CW - M, M], [M, CH - M], [CW - M, CH - M]]) {
      const p = P(c[0], c[1]);
      g.strokeStyle = '#f4f9ff'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 9 * p.s); g.stroke();
      g.fillStyle = '#ffcb45';
      g.beginPath(); g.moveTo(p.x, p.y - 9 * p.s); g.lineTo(p.x + 5 * p.s, p.y - 7.4 * p.s); g.lineTo(p.x, p.y - 5.8 * p.s);
      g.closePath(); g.fill();
    }
    return cv;
  }
  function grass(ctx, M, fW, fH) {
    const key = M + ':' + fW + 'x' + fH;
    if (stage.key !== key) { setGeom(M, fW, fH); stage.cv = buildStage(); stage.key = key; }
    ctx.drawImage(stage.cv, 0, 0);
  }
  function pitch() { /* marcações já estão no palco pré-renderizado */ }

  /* ── ATLETA EM PÉ ────────────────────────────────────────────────────────
   * Centrado em (x,y) como o círculo antigo: número (desenhado pela base) cai
   * na camisa; pill de nome fica sob os pés; sombra nos pés (patch próprio). */
  const dirCache = new Map();
  function shade(hex, f) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16);
    const ch = s => clamp(Math.round(((n >> s) & 255) * (1 + f)), 0, 255);
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }
  function rr(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad);
    else ctx.rect(x, y, w, h);
  }
  function body(ctx, o) {
    const { x, y, r } = o;
    const jersey = o.isGK ? o.gkC : o.pc;
    const dark = shade(jersey, -0.36), lite = shade(jersey, 0.26);

    // inclinação sutil na direção do deslocamento (vida, sem esqueleto)
    let d = dirCache.get(o.key);
    if (!d) { d = { x, y, lean: 0 }; dirCache.set(o.key, d); }
    const lean = clamp((x - d.x) * .55 + d.lean * .72, -2.4, 2.4);
    d.lean = lean; d.x = x; d.y = y;

    ctx.save();
    ctx.translate(x, y);
    if (o.divePose) ctx.rotate(Math.PI / 2);

    // pernas + meias
    ctx.fillStyle = '#17202e';
    ctx.fillRect(-r * .34, r * .40, r * .26, r * .46);
    ctx.fillRect(r * .08, r * .40, r * .26, r * .46);
    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(-r * .36, r * .78, r * .30, r * .22);
    ctx.fillRect(r * .06, r * .78, r * .30, r * .22);
    // shorts
    ctx.fillStyle = dark;
    rr(ctx, -r * .5, r * .12, r, r * .38, r * .1); ctx.fill();
    // torso (camisa) com luz
    const tg = ctx.createLinearGradient(0, -r * .56, 0, r * .34);
    tg.addColorStop(0, lite); tg.addColorStop(.58, jersey); tg.addColorStop(1, dark);
    ctx.fillStyle = tg;
    rr(ctx, -r * .56, -r * .52, r * 1.12, r * .92, r * .26); ctx.fill();
    ctx.lineWidth = o.hasBall ? 2 : 1;
    ctx.strokeStyle = o.hasBall ? '#ffffff' : 'rgba(255,255,255,.34)';
    rr(ctx, -r * .56, -r * .52, r * 1.12, r * .92, r * .26); ctx.stroke();
    // mangas
    ctx.fillStyle = jersey;
    rr(ctx, -r * .8, -r * .46, r * .26, r * .58, r * .09); ctx.fill();
    rr(ctx, r * .54, -r * .46, r * .26, r * .58, r * .09); ctx.fill();
    // cabeça + cabelo
    ctx.beginPath(); ctx.arc(lean * .4, -r * .82, r * .34, 0, TAU);
    ctx.fillStyle = '#e9b98b'; ctx.fill();
    ctx.beginPath(); ctx.arc(lean * .4, -r * .88, r * .31, Math.PI, TAU);
    ctx.fillStyle = 'rgba(38,25,14,.85)'; ctx.fill();
    ctx.restore();
  }

  /* ── RASTRO EM ARCO (projetado) ─────────────────────────────────────── */
  function trail(ctx, pts, cx, cy) {
    if (!pts.length) return;
    ctx.save();
    for (let i = pts.length - 1; i >= 0; i--) {
      const tp = pts[i], f = 1 - i / pts.length;
      const p = project(cx(tp.x), cy(tp.y));
      const py = p.y - (tp.z || 0) * 22 * p.s;
      ctx.shadowColor = 'rgba(255,215,50,.9)'; ctx.shadowBlur = 10 * f;
      ctx.fillStyle = 'rgba(255,224,90,' + (f * 0.7).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, py, Math.max(0.6, (4.4 - i * .5)) * p.s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ── BOLA PRO (projetada, altura legível) ───────────────────────────── */
  function ball(ctx, o) {
    const g0 = project(o.gx, o.gy);
    const s = g0.s, z = o.z || 0, air = clamp(z / 3.2, 0, 1);
    const bx = g0.x, by = g0.y - z * 22 * s;

    // anel de queda no destino (não para chutes)
    if (o.tv && o.tv.kind !== 'shot' && z > 0.35) {
      const t = project(o.tv.tx, o.tv.ty);
      const pulse = 1 + Math.sin(performance.now() / 130) * .18;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,64,.85)'; ctx.lineWidth = 2 * t.s;
      ctx.beginPath(); ctx.ellipse(t.x, t.y, 8.5 * pulse * t.s, 3.9 * pulse * t.s, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,64,.35)'; ctx.lineWidth = 1 * t.s;
      ctx.beginPath(); ctx.ellipse(t.x, t.y, 13 * pulse * t.s, 6 * pulse * t.s, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // sombra ancorada no gramado
    ctx.save();
    ctx.globalAlpha = .32 - air * .14;
    ctx.beginPath(); ctx.ellipse(bx, g0.y + 2 * s, (5.6 - air * 1.8) * s, (2.6 - air * .9) * s, 0, 0, TAU);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    // fio bola↔sombra
    if (z > 0.5) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,230,120,.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(bx, g0.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
    }

    // halo de leitura
    ctx.save();
    const halo = ctx.createRadialGradient(bx, by, 0, bx, by, 13 * s);
    halo.addColorStop(0, 'rgba(255,238,140,.42)'); halo.addColorStop(1, 'rgba(255,238,140,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(bx, by, 13 * s, 0, TAU); ctx.fill();
    ctx.restore();

    // corpo da bola
    const rb = (6.2 + air * 2.6) * s;
    const bg = ctx.createRadialGradient(bx - rb * .36, by - rb * .36, 0, bx, by, rb);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(.75, '#e9e9e9'); bg.addColorStop(1, '#b9bcc4');
    ctx.beginPath(); ctx.arc(bx, by, rb, 0, TAU);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = '#3d3f46'; ctx.lineWidth = .8; ctx.stroke();
    // gomos girando com o deslocamento
    const rot = (o.gx + o.gy) * 0.045;
    ctx.save();
    ctx.translate(bx, by); ctx.rotate(rot);
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

  root.CDS_F25D = Object.freeze({ version: '2.0.0', project, grass, pitch, body, trail, ball });
})(typeof window !== 'undefined' ? window : globalThis);
