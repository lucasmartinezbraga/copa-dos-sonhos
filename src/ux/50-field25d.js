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

  /* altura (bola/rastro/trajetória) em Y de tela COM TETO no horizonte: uma bola
   * muito alta (tiro de meta, lançamento, cruzamento) nunca é desenhada dentro da
   * arquibancada — corrige o P0 "bola alta invadindo o estádio". */
  function liftY(baseY, z, s) {
    return Math.max(G.topY + 8, baseY - (z || 0) * 22 * s);   // piso = base da arquibancada
  }

  /* PLANO DE CHÃO ÚNICO.
     O atleta é desenhado CENTRADO no ponto projetado: os pés dele caem em
     groundY + r*0.98, com r = 13*s. A bola era desenhada no próprio ponto
     projetado, ou seja ~10,7*s pixels ACIMA dos pés — a altura do peito.
     Por isso a bola parecia colada no peito e nunca no pé. Aqui a bola passa a
     usar o MESMO plano do atleta. */
  const FOOT = 13 * 0.98 - 2;          // 10.74 — diferença entre os dois planos
  const groundY = (py, s) => py + FOOT * s;

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
    if (stage.key !== key) {
      setGeom(M, fW, fH); stage.cv = buildStage(); stage.key = key;
      dirCache.clear(); gradCache.clear();   // PRF-031: caches limpos na fronteira de layout
    }
    ctx.drawImage(stage.cv, 0, 0);
  }
  function pitch() { /* marcações já estão no palco pré-renderizado */ }

  /* ── ATLETA EM PÉ ────────────────────────────────────────────────────────
   * Centrado em (x,y) como o círculo antigo: número (desenhado pela base) cai
   * na camisa; pill de nome fica sob os pés; sombra nos pés (patch próprio). */
  const dirCache = new Map();
  // gradiente do torso é local (só depende de r e da cor) → cacheia por cor|raio
  // em vez de recriar 22×/frame (jank). Gradientes são reutilizáveis entre fills.
  const gradCache = new Map();
  function torsoGrad(ctx, jersey, lite, dark, r) {
    const key = jersey + '|' + (r | 0);
    let g = gradCache.get(key);
    if (!g) {
      g = ctx.createLinearGradient(0, -r * .56, 0, r * .34);
      g.addColorStop(0, lite); g.addColorStop(.58, jersey); g.addColorStop(1, dark);
      gradCache.set(key, g);
      if (gradCache.size > 96) gradCache.clear();       // teto de segurança
    }
    return g;
  }
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
  /* Envelope de amplitude por FASE da ação (R14). O antigo `wave` era uma rampa
     única 0..1 que não sabia onde ficava o contato; aqui a preparação sobe até o
     pico, o CONTATO é o pico (é o tick em que a bola sai), a continuidade desce
     e a recuperação volta a zero. É o que faz o pé encontrar a bola. */
  function animWave(state, phase) {
    const p = clamp(phase || 0, 0, 1);
    if (/_prepare$/.test(state)) return p;                 // carrega o movimento
    if (/_contact$/.test(state)) return 1;                 // pico: bola sai aqui
    if (/followthrough$/.test(state) || state === 'cross') return 1 - p * 0.6;
    if (/_recover$/.test(state)) return 0.4 * (1 - p);
    if (/tackle$/.test(state) || state === 'header' || state === 'block') return Math.sin(p * Math.PI);
    if (/^gk_(low_dive|high_dive|catch|parry|punch|smother|foot_save)$/.test(state)) return Math.sin(p * Math.PI);
    if (state === 'lose_control' || state === 'heavy_touch') return 0.5 * (1 - p);
    return 0;
  }

  function body(ctx, o) {
    const { x, y, r } = o;
    const jersey = o.isGK ? o.gkC : o.pc;
    const dark = shade(jersey, -0.36), lite = shade(jersey, 0.26);

    // inclinação + PASSADA + POSES DE AÇÃO (ATL-021): a passada anima as pernas ao
    // deslocar; chute/passe/cruzamento (kick), carrinho (tackle) e cabeceio (jump)
    // ganham pose PRÓPRIA dirigida pelos eventos do motor (o.pose/o.act/o.wave). Parado
    // e sem ação, descansa. Corrige "boneco deslizando" e "ação sem causa visual".
    let d = dirCache.get(o.key);
    if (!d) { if (dirCache.size > 48) dirCache.clear(); d = { x, y, lean: 0, gait: 0, spd: 0, face: 1 }; dirCache.set(o.key, d); }
    const mvx = x - d.x, mvy = y - d.y, mv = Math.hypot(mvx, mvy);
    const lean = clamp(mvx * .55 + d.lean * .72, -2.4, 2.4);
    d.spd = d.spd * .6 + mv * .4;                       // velocidade de tela suavizada
    d.gait += Math.min(mv, r * 1.2) / Math.max(4, r * .5);   // passada ∝ distância (cap anti-teleporte)
    if (Math.abs(mvx) > 0.4) d.face = Math.sign(mvx);  // direção que o atleta encara (persistida)
    d.lean = lean; d.x = x; d.y = y;
    const face = d.face || 1;
    // R14 · a máquina de estados (Fase 3) manda quando existe: ela é dirigida
    // pelo CONTRATO do motor, então a fase de contato cai no tick em que a bola
    // sai. O caminho antigo (o.pose/o.act/o.wave) fica como queda para builds
    // sem a camada de animação.
    const A = (root.__CDS_ANIM_BY_KEY && root.__CDS_ANIM_BY_KEY[o.key]) || null;
    const st = A ? A.state : '';
    const w = o.divePose ? 0 : (A ? animWave(st, A.phase) : (o.wave || 0));
    const act = o.act || '', pose = o.pose || '';
    const kicking = A ? /^(pass|shot)_(prepare|contact|followthrough)$|^cross$/.test(st)
                      : ((pose === 'kick' || act === 'shoot') && w > 0.02);
    const tackling = A ? /tackle$/.test(st) : (pose === 'tackle' && w > 0.02);
    const heading = A ? (st === 'header') : (pose === 'jump' && w > 0.02);
    const dribbling = A ? /^(carry|dribble_|body_feint|inside_cut|outside_cut|burst_touch)/.test(st)
                        : (act === 'dribble' && !kicking && !tackling);
    const amp = (o.divePose || kicking || tackling) ? 0 : clamp(d.spd / 1.5, 0, 1);   // 0 parado … 1 correndo
    const sw = Math.sin(d.gait) * amp;                  // -1..1 alterna as pernas
    const bob = Math.abs(sw) * r * .05 - (tackling ? r * .16 : 0) + (dribbling ? r * .10 : 0);

    ctx.save();
    ctx.translate(x, y - bob);
    if (o.divePose) ctx.rotate(Math.PI / 2);

    // ── PERNAS conforme a ação
    ctx.fillStyle = '#17202e';
    if (kicking) {
      const back = -face * r * .28, front = face * (r * .06 + w * r * .52);
      ctx.fillRect(back - r * .13, r * .40, r * .26, r * .46);                  // apoio
      ctx.fillRect(front - r * .13, r * .40 - w * r * .12, r * .26, r * .46);   // perna de chute
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(back - r * .15, r * .78, r * .30, r * .20);
      ctx.fillRect(front - r * .15, r * .78 - w * r * .12, r * .30, r * .20);
    } else if (tackling) {
      const front = face * (r * .22 + w * r * .60);
      ctx.fillRect(-face * r * .06 - r * .13, r * .50, r * .26, r * .40);       // dobrada sob o corpo
      ctx.fillRect(Math.min(front, front) - r * .20, r * .62, r * .46, r * .22);// estendida no deslize
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(front + face * r * .20 - r * .14, r * .62, r * .28, r * .20);
    } else {
      const llY = r * .40 - Math.max(0, sw) * r * .20;
      const rlY = r * .40 - Math.max(0, -sw) * r * .20;
      const spr = dribbling ? r * .06 : 0;                                      // drible: base mais aberta
      ctx.fillRect(-r * .34 - spr, llY, r * .26, r * .46);
      ctx.fillRect(r * .08 + spr, rlY, r * .26, r * .46);
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(-r * .36 - spr, llY + r * .38, r * .30, r * .22);
      ctx.fillRect(r * .06 + spr, rlY + r * .38, r * .30, r * .22);
    }
    // shorts
    ctx.fillStyle = dark;
    rr(ctx, -r * .5, r * .12, r, r * .38, r * .1); ctx.fill();
    // TORSO (camisa) — leve inclinação à frente no drible; recuo no chute
    const tl = (dribbling ? face * r * .06 : 0) + (kicking ? -face * r * .05 : 0);
    ctx.save(); ctx.translate(tl, 0);
    ctx.fillStyle = torsoGrad(ctx, jersey, lite, dark, r);
    rr(ctx, -r * .56, -r * .52, r * 1.12, r * .92, r * .26); ctx.fill();
    ctx.lineWidth = o.hasBall ? 2 : 1;
    ctx.strokeStyle = o.hasBall ? '#ffffff' : 'rgba(255,255,255,.34)';
    rr(ctx, -r * .56, -r * .52, r * 1.12, r * .92, r * .26); ctx.stroke();
    ctx.restore();
    // MANGAS/braços — GOLEIRO tem prontidão/encaixe + LUVAS (ATL-032); linha de campo
    // ergue no cabeceio e abre no chute (equilíbrio).
    const gk = o.isGK;
    const gkClaim = gk && (pose === 'claim' || pose === 'jump') && w > 0.02;
    ctx.fillStyle = jersey;
    if (gkClaim) {                                       // goleiro no ENCAIXE: braços ao alto
      const up = r * (.72 + w * .36);
      rr(ctx, -r * .48, -up, r * .24, r * .58, r * .09); ctx.fill();
      rr(ctx, r * .24, -up, r * .24, r * .58, r * .09); ctx.fill();
    } else if (gk) {                                     // goleiro em PRONTIDÃO: braços abertos
      rr(ctx, -r * .94, -r * .36, r * .24, r * .52, r * .09); ctx.fill();
      rr(ctx, r * .70, -r * .36, r * .24, r * .52, r * .09); ctx.fill();
    } else if (heading) {
      rr(ctx, -r * .88, -r * .74 - w * r * .32, r * .24, r * .52, r * .09); ctx.fill();
      rr(ctx, r * .64, -r * .74 - w * r * .32, r * .24, r * .52, r * .09); ctx.fill();
    } else if (kicking) {
      rr(ctx, -r * .86 - face * w * r * .12, -r * .46, r * .24, r * .56, r * .09); ctx.fill();
      rr(ctx, r * .62 - face * w * r * .12, -r * .46, r * .24, r * .56, r * .09); ctx.fill();
    } else {
      rr(ctx, -r * .8 + tl, -r * .46, r * .26, r * .58, r * .09); ctx.fill();
      rr(ctx, r * .54 + tl, -r * .46, r * .26, r * .58, r * .09); ctx.fill();
    }
    if (gk) {                                            // LUVAS do goleiro nas pontas dos braços
      ctx.fillStyle = '#eef3ff';
      if (gkClaim) {
        const up = r * (.72 + w * .36);
        ctx.beginPath(); ctx.arc(-r * .36, -up - r * .02, r * .19, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * .36, -up - r * .02, r * .19, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(-r * .82, r * .16, r * .18, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * .82, r * .16, r * .18, 0, TAU); ctx.fill();
      }
    }
    // CABEÇA + cabelo — inclina à frente no cabeceio/drible
    const hx = lean * .4 + tl + (heading ? face * r * .26 : 0) + (dribbling ? face * r * .10 : 0);
    const hy = -r * .82 + (heading ? w * r * .10 : 0);
    ctx.beginPath(); ctx.arc(hx, hy, r * .34, 0, TAU);
    ctx.fillStyle = '#e9b98b'; ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy - r * .06, r * .31, Math.PI, TAU);
    ctx.fillStyle = 'rgba(38,25,14,.85)'; ctx.fill();
    ctx.restore();
  }

  /* ── RASTRO EM ARCO (projetado) ─────────────────────────────────────── */
  function trail(ctx, pts, cx, cy) {
    if (!pts.length) return;
    ctx.save();
    // glow barato: halo em alfa + núcleo (sem shadowBlur, que é caminho lento no
    // canvas e era refeito por ponto/frame — principal fonte de jank do render).
    for (let i = pts.length - 1; i >= 0; i--) {
      const tp = pts[i], f = 1 - i / pts.length;
      const p = project(cx(tp.x), cy(tp.y));
      const py = liftY(p.y, tp.z, p.s);
      const rad = Math.max(0.6, (4.4 - i * .5)) * p.s;
      ctx.fillStyle = 'rgba(255,224,90,' + (f * 0.20).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, py, rad * 2.1, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,238,150,' + (f * 0.78).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, py, rad, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ── TRAJETÓRIA (cruzamentos/lançamentos em ARCO que passa pela bola) ──
   * Rasteiro: reta projetada (visual clássico). Aéreo: Bézier quadrática que
   * passa EXATAMENTE pela posição atual da bola — parte percorrida sólida,
   * restante tracejado, seta tangente no destino. Só leitura de estado. */
  function traj(ctx, o) {
    const A = project(o.cx(o.fx), o.cy(o.fy));
    const D = project(o.cx(o.tx), o.cy(o.ty));
    const g = project(o.cx(o.gx), o.cy(o.gy));
    const z = o.z || 0;
    const isShot = o.kind === 'shot';
    // VFX-021: chute ALTO (cavadinha/cobertura/chip) também arqueia; chute rasteiro
    // segue reto. Antes o arco excluía kind=shot mesmo com z alto.
    const aerial = z > 0.45 && (!isShot || z > 1.1);
    const col = isShot ? '255,255,255' : '255,220,40';
    ctx.save();
    if (aerial) {
      const B = { x: g.x, y: liftY(g.y, z, g.s) };
      const du = Math.hypot(D.x - A.x, D.y - A.y) || 1;
      let u = Math.hypot(g.x - A.x, g.y - A.y) / du;
      u = clamp(u, .08, .92);
      const w = 2 * u * (1 - u);
      const C = { x: (B.x - (1 - u) * (1 - u) * A.x - u * u * D.x) / w,
                  y: (B.y - (1 - u) * (1 - u) * A.y - u * u * D.y) / w };
      const AC = { x: A.x + (C.x - A.x) * u, y: A.y + (C.y - A.y) * u };
      const CD = { x: C.x + (D.x - C.x) * u, y: C.y + (D.y - C.y) * u };
      // percorrido: sólido suave até a bola
      ctx.strokeStyle = 'rgba(' + col + ',.42)'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(AC.x, AC.y, B.x, B.y); ctx.stroke();
      // restante: tracejado vivo da bola ao ponto de queda
      ctx.strokeStyle = 'rgba(' + col + ',.9)'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.quadraticCurveTo(CD.x, CD.y, D.x, D.y); ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(D.y - CD.y, D.x - CD.x);
      ctx.fillStyle = 'rgba(' + col + ',.95)';
      ctx.beginPath();
      ctx.moveTo(D.x, D.y);
      ctx.lineTo(D.x - 9 * Math.cos(ang - 0.42), D.y - 9 * Math.sin(ang - 0.42));
      ctx.lineTo(D.x - 9 * Math.cos(ang + 0.42), D.y - 9 * Math.sin(ang + 0.42));
      ctx.closePath(); ctx.fill();
    } else {
      if (isShot) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.setLineDash([]); }
      else { ctx.strokeStyle = 'rgba(255,220,40,.9)'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); }
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(D.x, D.y); ctx.stroke();
      const ang = Math.atan2(D.y - A.y, D.x - A.x);
      ctx.setLineDash([]);
      ctx.fillStyle = isShot ? 'rgba(255,255,255,.85)' : 'rgba(255,220,40,.95)';
      ctx.beginPath();
      ctx.moveTo(D.x, D.y);
      ctx.lineTo(D.x - 9 * Math.cos(ang - 0.42), D.y - 9 * Math.sin(ang - 0.42));
      ctx.lineTo(D.x - 9 * Math.cos(ang + 0.42), D.y - 9 * Math.sin(ang + 0.42));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ── BOLA PRO (projetada, altura legível) ───────────────────────────── */
  function ball(ctx, o) {
    const g0 = project(o.gx, o.gy);
    const s = g0.s, z = o.z || 0, air = clamp(z / 3.2, 0, 1);
    const gy = groundY(g0.y, s);          // mesmo plano de chão dos atletas
    const bx = g0.x, by = liftY(gy, z, s);
    if (window.__ballProbe) window.__ballProbe(z, by, G.topY, s);   // hook de auditoria (PRO-021)

    // anel de queda no destino (não para chutes)
    if (o.tv && o.tv.kind !== 'shot' && z > 0.35) {
      const t = project(o.tv.tx, o.tv.ty);
      // VFX-026: pulso ESCALA com a velocidade do jogo — a tempo de parede constante
      // ele piscava freneticamente em 4X/TURBO. Período cresce com G.speed → calmo.
      const sp = Math.max(1, (window.G && window.G.speed) || 1);
      const pulse = 1 + Math.sin(performance.now() / (130 * sp)) * .18;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,64,.85)'; ctx.lineWidth = 2 * t.s;
      ctx.beginPath(); ctx.ellipse(t.x, groundY(t.y, t.s), 8.5 * pulse * t.s, 3.9 * pulse * t.s, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,64,.35)'; ctx.lineWidth = 1 * t.s;
      ctx.beginPath(); ctx.ellipse(t.x, groundY(t.y, t.s), 13 * pulse * t.s, 6 * pulse * t.s, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // sombra ancorada no gramado
    ctx.save();
    ctx.globalAlpha = .32 - air * .14;
    ctx.beginPath(); ctx.ellipse(bx, gy + 2 * s, (5.6 - air * 1.8) * s, (2.6 - air * .9) * s, 0, 0, TAU);
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

  root.CDS_F25D = Object.freeze({ version: '2.1.0', project, grass, pitch, body, trail, ball, traj });
})(typeof window !== 'undefined' ? window : globalThis);
