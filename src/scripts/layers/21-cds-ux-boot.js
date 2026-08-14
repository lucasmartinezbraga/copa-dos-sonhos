
/* Copa dos Sonhos · Camada UX · boot (não invasivo)
 * Liga o "modo dev" (revela os overlays de ferramentas) quando ?dev=1 na URL
 * ou localStorage cds_dev==='1'. ?dev=0 desliga. Nada aqui toca o motor. */
(function () {
  'use strict';
  try {
    var params = new URLSearchParams(location.search || '');
    var flag = params.get('dev');
    var dev = false;
    try { dev = localStorage.getItem('cds_dev') === '1'; } catch (e) {}
    if (flag === '1') { dev = true; try { localStorage.setItem('cds_dev', '1'); } catch (e) {} }
    if (flag === '0') { dev = false; try { localStorage.removeItem('cds_dev'); } catch (e) {} }
    if (dev) document.documentElement.classList.add('cds-dev');
  } catch (e) { /* silencioso: UX nunca deve travar o boot do jogo */ }
})();

/* ── A11-011..015: feed vivo de eventos para leitor de tela ──────────────────
 * Regiões aria-live persistentes + window.__cdsAnnounce(texto, urgente). O motor
 * chama isso nos eventos-chave (gol/cartão/substituição) via patch render-side.
 * Grande parte da partida é canvas; este é o canal textual acessível. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;   // headless/VM (runner do golden): sem DOM
  function inject() {
    if (!document.body || document.getElementById('cds-a11y-live')) return;
    var mk = function (id, mode) {
      var el = document.createElement('div');
      el.id = id; el.className = 'cds-sr-only';
      el.setAttribute('aria-live', mode);
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('role', mode === 'assertive' ? 'alert' : 'status');
      document.body.appendChild(el);
      return el;
    };
    var polite = mk('cds-a11y-live', 'polite');
    var urgent = mk('cds-a11y-alert', 'assertive');
    window.__cdsAnnounce = function (txt, isUrgent) {
      try {
        var el = isUrgent ? urgent : polite;
        el.textContent = '';                       // limpa p/ forçar re-anúncio
        setTimeout(function () { el.textContent = String(txt || ''); }, 30);
      } catch (e) {}
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();

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
    /* D24 · A FAIXA DO GRAMADO PROJETADO E FIXA E ANCORADA EMBAIXO.
       ------------------------------------------------------------
       Antes: `topY = M + 34` e `bottomY = G.CH - 3`. A faixa media
       (CH-3) - (M+34) = 449 px com CH=500, e CRESCIA JUNTO com CH. Foi isso
       que quebrou a tela quando tentei um canvas mais alto: com CH=673 a
       faixa virou 624 px e a mesma razao de perspectiva (R0=0,72) se espalhou
       por 38% mais altura — o gramado saiu como um trapezio torto.

       A forma do campo NAO depende de CH: `vn = (fy - M) / fH` normaliza a
       altura logica antes de projetar. Quem decide o desenho e fW, topY,
       bottomY e R0. Fixando a faixa, o canvas pode ter a altura que quiser e o
       gramado sai identico; o que sobrar acima vira ceu e arquibancada, que o
       palco ja desenha de 0 ate standBot.

       Com CH=500 isto devolve topY=48 e bottomY=497 — exatamente os valores
       anteriores. A mudanca e nula ate alguem mexer em CH. */
    var CH_REF = 500;
    G.bottomY = G.CH - 3;
    G.topY = G.bottomY - ((CH_REF - 3) - (M + 34));
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
  /* ALTURA NA TELA · escala 1:1 embaixo, comprimida em cima (OS-200).
     Os 22 px/m foram calibrados quando a bola nao passava de 2,35 m — o motor
     travava a altura ali. Com balistica real um lancamento chega a 6-10 m, e
     em escala linear ele batia no teto `G.topY + 8` e ficava GRUDADO na
     arquibancada em vez de subir e descer.

     A faixa que precisa de fidelidade e a da meta: ate ~2,6 m o mapeamento
     continua exatamente 1:1, senao uma bola por cima do travessao nao PARECE
     por cima do travessao. Acima disso a curva satura suavemente, entao o ceu
     inteiro cabe na tela sem comprimir o que importa. */
  const Z_FIEL = 2.6, Z_FOLGA = 3.4;
  function alturaVisual(z) {
    const a = Math.max(0, z || 0);
    if (a <= Z_FIEL) return a;
    const e = a - Z_FIEL;
    return Z_FIEL + e / (1 + e / Z_FOLGA);
  }
  function liftY(baseY, z, s) {
    return Math.max(G.topY + 8, baseY - alturaVisual(z) * 22 * s);
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

    /* OS-61 · a arquibancada existia SO na faixa de cima; nas laterais e
       embaixo sobrava o ceu, que colado no gramado vira vazio escuro. Com o
       campo inteiro em quadro isso nunca aparecia — com a camera de TV da
       OS-57, aparece em cheio. Agora ela envolve o canvas todo. */
    const standTop = 0, standBot = G.topY + 8;
    const st = g.createLinearGradient(0, standTop, 0, standBot);
    st.addColorStop(0, '#0b1524'); st.addColorStop(1, '#13233a');
    g.fillStyle = st; g.fillRect(0, standTop, CW, standBot - standTop);
    /* anel completo: tudo o que nao for gramado recebe arquibancada */
    const stAll = g.createLinearGradient(0, standBot, 0, CH);
    stAll.addColorStop(0, '#13233a'); stAll.addColorStop(1, '#0a1524');
    g.fillStyle = stAll; g.fillRect(0, standBot, CW, CH - standBot);
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
    /* torcida das laterais e do fundo proximo, mesma regra e mesma semente */
    for (let y = standBot + 4; y < CH - 4; y += 6) {
      for (let x = 4; x < CW - 4; x += 5) {
        if (rnd() < 0.55) {
          const c = rnd();
          g.fillStyle = c < .06 ? 'rgba(255,203,69,.40)' : c < .12 ? 'rgba(56,189,248,.35)' : `rgba(${160 + (c * 60) | 0},${168 + (c * 50) | 0},${185 + (c * 40) | 0},.22)`;
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

    /* OS-61 · avental maior: com a arquibancada fechando o anel, o gramado
       precisa avancar o suficiente para nao deixar costura visivel entre a
       linha lateral e a torcida. */
    const ap = 64;
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
    /* §fix REPLAY ESCURO: durante o replay de gol um `ctx.save()` sem `restore()`
       deixava globalAlpha < 1 vazar para o frame seguinte; como grass() e o
       primeiro e dominante desenho do campo, o gramado saia a ~25% sobre o fundo
       preto e o campo ficava escurecido — e assim FICAVA depois do replay. Como
       grass roda todo frame antes de tudo, resetar aqui zera qualquer vazamento
       de estado e garante o campo sempre em opacidade cheia. */
    ctx.globalAlpha = 1;
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
    /* §D39 · A INTERCEPTACAO NAO TINHA GESTO.
       A camada 69 pede `pede(this, data.by, 'intercept')` no evento, a maquina
       de animacao entra no estado — e este `animWave` nao conhecia a palavra:
       caia no `return 0` de baixo e o jogador interceptava SEM MOVIMENTO
       NENHUM. A bola trocava de dono e o corpo nem reagia.

       O gesto e curto e assimetrico, ao contrario do carrinho: sobe rapido
       (o pe/corpo estica para a linha de passe) e desce devagar (recomposicao).
       Por isso nao e `sin(p*PI)`, que e simetrico e parece um chute. */
    if (state === 'intercept') return p < .3 ? p / .3 : 1 - (p - .3) / .7 * .85;
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
    if (!d) { if (dirCache.size > 48) dirCache.clear(); d = { x, y, lean: 0, gait: 0, spd: 0, vms: 0, face: 1 }; dirCache.set(o.key, d); }
    const mvx = x - d.x, mvy = y - d.y, mv = Math.hypot(mvx, mvy);
    const lean = clamp(mvx * .55 + d.lean * .72, -2.4, 2.4);
    d.spd = d.spd * .6 + mv * .4;                       // velocidade de tela suavizada
    /* §D38 · A PASSADA — três defeitos que se somavam.
       ---------------------------------------------------------------------
       [1] A fase NUNCA voltava ao neutro. Ao parar, `mv → 0` e `d.gait`
           congelava onde estivesse: o jogador ficava com as pernas ABERTAS,
           paradas no meio do passo. O `amp` some com a velocidade e disfarça,
           mas a transição é um corte, não uma parada.
       [2] A cadência era LINEAR na distância (`mv / 4`). Correndo, as pernas
           batem rápido demais e viram borrão; no futebol real a passada CRESCE
           com a velocidade — o atleta dá passos maiores, não infinitamente
           mais rápidos.
       [3] A subida do corpo era 0,09·r e quase não se lia.

       Agora: cadência sublinear (raiz), fase que relaxa para o neutro quando o
       jogador para, e passo com leitura. Só desenho — não toca no motor. */
    /* §D40/§D41 · A PASSADA PASSA A SER BIOMECANICA, EM METROS.
       ---------------------------------------------------------------------
       MEDIDO em `tools/fisica/tela/passada.js`, interceptando a chamada real
       de `CDS_F25D.body` (7.876 pares de quadro por velocidade):

         1X   3,66 m/s   6,13 passos/s desenhados   contra 3,09 do alvo  (1,98x)
         3X   3,30 m/s   7,80 passos/s desenhados   contra 2,93 do alvo  (2,66x)

       Sao DOIS defeitos somados, nao um:

       [1] A cadencia nunca teve unidade fisica. `sqrt(mv / (r*.16)) * .62` foi
           ajustada no olho, em pixels, e saiu com o DOBRO da frequencia de um
           corredor de verdade — passada implicada de 0,60 m, quando um atleta a
           3,7 m/s da passos de ~1,19 m. O jogador nao corria: miudava.

       [2] A velocidade de EXIBICAO entrava na conta. O runtime faz
           `acc += dt * G.speed` e roda N passos de simulacao por quadro
           desenhado, entao em 3X o deslocamento de TELA por quadro triplica —
           e a perna, calculada a partir dele, triplicava junto. O tremor
           anti-cardume, que eu suspeitava ser a causa, foi medido e nao e:
           responde por 2% de `mv`.

       Agora a fase sai de onde tem que sair: `pi` de fase por PASSO, e o passo
       tem comprimento em metros que cresce com a velocidade (0,60 + 0,16·v,
       que devolve 1,19 m a 3,7 m/s e 1,88 m a 8 m/s). Assim os pes acompanham
       o chao em vez de patinar, em qualquer zoom e qualquer canvas.

       O `_mult` sobrevive so para o avanco rapido: em 3X a cadencia HONESTA
       seria 3x (e o que fast-forward de video e), mas isso e a vibracao de que
       o jogador reclamou. A raiz deixa 1,73x — corrida rapida, nao borrao — e
       o teto de 0,30 rad/quadro garante que nem em 6X vire tremor. */
    var _pxM = 9.5;                       // px logicos por metro, ja com perspectiva
    try {
      var _fW = G.CW - 2 * G.M, _FL = +root.FL || 105;
      /* r = 13*s e a largura util e fW: a razao entre os dois nao depende do
         viewport porque o canvas do jogo e logico (1024x500). Conferido contra
         a medicao: formula 7,98 px/m, medido 7,82 px/m. */
      if (_fW > 0 && _FL > 0 && r > 0) _pxM = (_fW / _FL) * (r / 13);
    } catch (_) {}
    var _vel = 1;
    try {
      var _g = root.G;
      if (_g && isFinite(+_g.speed) && +_g.speed > 0) _vel = Math.max(1, +_g.speed);
    } catch (_) {}
    var _dm = mv / Math.max(0.5, _pxM);                    // metros andados no quadro
    /* velocidade FISICA do atleta: nao muda quando o jogador troca o 1X pelo 3X */
    var _vms = Math.min(_dm * 60 / _vel, 12);
    d.vms = (d.vms || 0) * .6 + _vms * .4;
    var _passoM = 0.60 + 0.16 * d.vms;                     // comprimento do passo, em m
    var _dfase = Math.PI * (_dm / _passoM) / Math.sqrt(_vel);
    if (_dfase > 0.03) {                  // ~0,05 px de tela: o mesmo limiar de antes
      d.gait += Math.min(_dfase, 0.30);   // teto: 5,7 passos/s, acima disso e tremor
    } else if (d.gait !== 0) {
      /* parou: fecha as pernas pelo caminho mais curto até o próximo neutro */
      var _alvo = Math.round(d.gait / Math.PI) * Math.PI;
      d.gait += (_alvo - d.gait) * .22;
      if (Math.abs(_alvo - d.gait) < .02) d.gait = _alvo;
    }
    /* OS-49 · antes, `face` so mudava com deslocamento LATERAL maior que
       0,4 px, entao quem corria para cima ou para baixo do campo mantinha a
       orientacao antiga e descia o gramado encarando o lado. Agora a direcao
       sai do VETOR inteiro, com angulo suavizado. */
    if (mv > 0.08) {
      const _a = Math.atan2(mvy, mvx);
      if (d.ang == null) d.ang = _a;
      else {
        let _dd = _a - d.ang;
        while (_dd > Math.PI) _dd -= Math.PI * 2;
        while (_dd < -Math.PI) _dd += Math.PI * 2;
        d.ang += _dd * .35;
      }
      const _c = Math.cos(d.ang);
      if (Math.abs(_c) > .12) d.face = _c >= 0 ? 1 : -1;
    }
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
    /* §D39 · a interceptacao usa a pose de bote, mas SEM o agachamento do
       carrinho: o corpo estica na direcao da linha de passe e volta. Entra aqui
       para o desenho reagir, alem da onda que o animWave passou a devolver. */
    const intercepting = A ? (st === 'intercept') : false;
    const dribbling = A ? /^(carry|dribble_|body_feint|inside_cut|outside_cut|burst_touch)/.test(st)
                        : (act === 'dribble' && !kicking && !tackling);
    /* OS-60 · os quatro estados de drible caiam no mesmo desenho. Agora cada um
       tem pose propria, dirigida pela FASE do controlador. */
    const dphase = A ? clamp(A.phase || 0, 0, 1) : 0;
    const feint  = A && st === 'body_feint';
    const cutting= A && (st === 'inside_cut' || st === 'outside_cut');
    const bursting = A && st === 'burst_touch';
    const blocking = A ? (st === 'block') : false;
    /* §D41 · A AMPLITUDE TAMBEM DEPENDIA DO BOTAO DE VELOCIDADE.
       `d.spd` e o deslocamento de TELA suavizado, entao ele triplica em 3X: a
       mesma corrida saia com perna de 0,31 de amplitude em 1X (o jogador
       miudava com as pernas quase fechadas) e 0,87 em 3X. Medido:
       mv = 0,470 px/quadro em 1X contra 1,309 em 3X, o mesmo atleta a ~3,5 m/s.
       Agora vem de `d.vms`, que e a velocidade FISICA em m/s: 4,2 m/s abre a
       perna por inteiro, em qualquer velocidade de exibicao. */
    const amp = (o.divePose || kicking || tackling) ? 0
              : clamp(d.vms / 4.2, 0, 1) * (bursting ? 1.35 : 1);   // 0 parado … 1 correndo
    const sw = Math.sin(d.gait) * amp;                  // -1..1 alterna as pernas
    /* OS-58 · a subida do corpo a cada passada era quase imperceptivel. */
    /* §D38 · 0,09·r nao se lia. O corpo sobe DUAS vezes por ciclo (uma por
       perna de apoio), que e o que da a leitura de passo em vez de deslize. */
    const bob = Math.abs(sw) * r * .16 - (tackling ? r * .16 : 0) + (dribbling ? r * .10 : 0)
              - (intercepting ? r * .07 * w : 0)   /* §D39 · estica, nao agacha */
              - (blocking ? r * .12 * Math.sin(dphase * Math.PI) : 0);   /* OS-60 · agacha no bloqueio */

    /* OS-47 · GIRO DE 360. Em vista 2,5D o giro se le pelo estreitamento: o
       corpo afina ate o perfil, passa de costas e volta. cos(theta) faz isso em
       uma linha, e casa com a passada e a inclinacao que ja existem. O fator e
       mantido longe de zero porque ctx.scale(0,1) colapsa a matriz. */
    const spinning = A && (st === 'turn_dribble' || st === 'protect_turn');
    const spinTh = spinning ? Math.max(0, Math.min(1, A.phase || 0)) * Math.PI * 2 : 0;
    /* OS-49 · o tronco passa a inclinar para onde corre, e a corrida vertical
       ganha perspectiva: visto mais de frente/costas, o corpo estreita. Sem
       isto, correr para cima e correr para o lado sao o mesmo desenho. */
    const _oa = (d.ang == null) ? 0 : d.ang;
    const _cos = Math.cos(_oa), _sin = Math.sin(_oa);
    /* §D41 · a inclinacao do tronco e o estreitamento de perspectiva saiam da
       mesma `d.spd` de tela: o jogador se jogava para a frente ao apertar 3X e
       endireitava ao voltar para 1X, sem mudar de velocidade no campo. */
    const _vig = (o.divePose || spinning) ? 0 : Math.max(0, Math.min(1, d.vms / 4.2));
    ctx.save();
    ctx.translate(x, y - bob - (spinning ? r * .16 * Math.sin(spinTh / 2) : 0));
    if (!o.divePose && !spinning && _vig > .02) {
      /* OS-60 · corte joga o peso para fora antes de sair para dentro;
         arrancada projeta o tronco a frente. */
      const _extra = cutting  ? -face * .30 * Math.sin(dphase * Math.PI)
                   : bursting ?  face * .26 * Math.min(1, dphase * 2.4)
                   : 0;
      ctx.rotate(_cos * _vig * 0.20 + _extra);
      const _sq = 1 - Math.abs(_sin) * _vig * 0.22;
      ctx.scale(_sq < .5 ? .5 : _sq, 1);
    }
    if (o.divePose) ctx.rotate(Math.PI / 2);
    else if (spinning) {
      const _c = Math.cos(spinTh);
      ctx.scale(Math.abs(_c) < .16 ? (_c < 0 ? -.16 : .16) : _c, 1);
    }

    // ── PERNAS conforme a ação
    ctx.fillStyle = '#17202e';
    if (kicking) {
      const back = -face * r * .28, front = face * (r * .06 + w * r * .52);
      ctx.fillRect(back - r * .13, r * .40, r * .26, r * .46);                  // apoio
      ctx.fillRect(front - r * .13, r * .40 - w * r * .12, r * .26, r * .46);   // perna de chute
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(back - r * .15, r * .78, r * .30, r * .20);
      ctx.fillRect(front - r * .15, r * .78 - w * r * .12, r * .30, r * .20);
    } else if (blocking) {
      /* OS-60 · MEDIDO: o estado de bloqueio desenhava exatamente igual ao de
         corrida — tinha 100% de cobertura de evento e nenhuma pose. Agora o
         atleta se joga na frente: base larga, corpo baixo, perna estendida na
         linha da bola. */
      const _bw = Math.sin(dphase * Math.PI);
      ctx.fillRect(-r * .46 - _bw * r * .22, r * .46, r * .28, r * .44);
      ctx.fillRect(r * .18 + _bw * r * .22, r * .46, r * .28, r * .44);
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(-r * .50 - _bw * r * .22, r * .84, r * .32, r * .20);
      ctx.fillRect(r * .16 + _bw * r * .22, r * .84, r * .32, r * .20);
    } else if (tackling) {
      const front = face * (r * .22 + w * r * .60);
      ctx.fillRect(-face * r * .06 - r * .13, r * .50, r * .26, r * .40);       // dobrada sob o corpo
      ctx.fillRect(Math.min(front, front) - r * .20, r * .62, r * .46, r * .22);// estendida no deslize
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(front + face * r * .20 - r * .14, r * .62, r * .28, r * .20);
    } else {
      /* OS-58 · a passada movia a perna SO em Y, por r*.20 — com r ~ 30 px sao
         6 px de diferenca entre as duas pernas, quase nada. Agora ha TESOURA:
         uma perna vai a frente e a outra atras, e a amplitude vertical sobe. */
      const llY = r * .40 - Math.max(0, sw) * r * .30;
      const rlY = r * .40 - Math.max(0, -sw) * r * .30;
      const spr = (dribbling ? r * .06 : 0)
                + (cutting ? r * .22 * Math.sin(dphase * Math.PI) : 0);          // OS-60 · corte planta e abre
      const lsx = sw * r * .20 * face, rsx = -sw * r * .20 * face;
      ctx.fillRect(-r * .34 - spr + lsx, llY, r * .26, r * .46);
      ctx.fillRect(r * .08 + spr + rsx, rlY, r * .26, r * .46);
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(-r * .36 - spr + lsx, llY + r * .38, r * .30, r * .22);
      ctx.fillRect(r * .06 + spr + rsx, rlY + r * .38, r * .30, r * .22);
    }
    // shorts
    ctx.fillStyle = dark;
    rr(ctx, -r * .5, r * .12, r, r * .38, r * .1); ctx.fill();
    // TORSO (camisa) — leve inclinação à frente no drible; recuo no chute
    /* OS-60 · na finta o TRONCO vai para um lado e volta — e o corpo enganando.
       Nos outros dribles fica o deslocamento leve de sempre. */
    const tl = (dribbling ? face * r * .06 : 0) + (kicking ? -face * r * .05 : 0)
             + (feint ? Math.sin(dphase * Math.PI * 2) * r * .34 * face : 0);
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
      /* OS-58 · os bracos eram dois retangulos FIXOS, sem nenhuma dependencia
         da passada. Braco parado e o que mais denuncia "boneco deslizando".
         Agora balancam em contrafase com a perna, em Y e em X. */
      const abY = -sw * r * .26, abX = -sw * r * .10 * face;
      rr(ctx, -r * .8 + tl + abX, -r * .46 + abY, r * .26, r * .58, r * .09); ctx.fill();
      rr(ctx, r * .54 + tl - abX, -r * .46 - abY, r * .26, r * .58, r * .09); ctx.fill();
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

  /* D24 · a faixa do gramado, para quem precisa enquadrar (a camera do runtime).
     Sem isto o `paintField` so tem CH, que passou a nao dizer onde o campo
     esta. */
  function faixa() { return { topY: G.topY, bottomY: G.bottomY, ready: G.ready }; }
  root.CDS_F25D = Object.freeze({ version: '2.2.0', project, grass, pitch, body, trail, ball, traj, faixa });
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Copa dos Sonhos · R14 · MÁQUINA DE ESTADOS DE ANIMAÇÃO (Fase 3)
 *
 * O que existia: motionAt() empurrava poses numa lista GLOBAL de no máximo 10
 * entradas, com janela em performance.now() e uma única rampa 0..1. Sem estados
 * de locomoção, sem prioridade, sem interrupção e sem vínculo com as fases da
 * ação — a pose de chute podia ser truncada por outro jogador entrar na lista.
 *
 * Aqui cada atleta tem seu próprio controlador. Os estados de AÇÃO são dirigidos
 * pelo contrato da Fase 2 (start/contact/end), então o quadro de contato coincide
 * com a saída da bola por construção, não por coincidência de tempo. Os estados
 * de LOCOMOÇÃO derivam da velocidade e são o piso: sempre há um estado válido.
 *
 * Prioridade cresce com o tier. Um estado só é interrompido por tier igual ou
 * maior, ou por interrupção explícita do motor (desarme durante o preparo).
 * Isso é o que impede a troca de pose no meio de um movimento comprometido.
 *
 * Procedural em Canvas: não há sprite. O controlador diz QUAL estado e em QUE
 * fase; o desenho fica com CDS_F25D.body.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CDS_ANIM = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const VERSION = '1.0.0-R14';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);

  /* ── TIERS ────────────────────────────────────────────────────────────────
     0 locomoção · 1 com bola · 2 defesa · 3 ação comprometida · 4 goleiro    */
  const T_LOCO = 0, T_BALL = 1, T_DEF = 2, T_ACTION = 3, T_GK = 4;

  /* Cada estado: tier, duração padrão (s) e se é cíclico (locomoção não termina).
     As durações de AÇÃO são substituídas pelo contrato quando ele existe. */
  const STATES = {
    // locomoção
    idle:        { tier: T_LOCO, loop: true },
    walk:        { tier: T_LOCO, loop: true },
    jog:         { tier: T_LOCO, loop: true },
    run:         { tier: T_LOCO, loop: true },
    sprint:      { tier: T_LOCO, loop: true },
    accelerate:  { tier: T_LOCO, dur: 0.30 },
    decelerate:  { tier: T_LOCO, dur: 0.30 },
    turn:        { tier: T_LOCO, dur: 0.26 },
    strafe:      { tier: T_LOCO, loop: true },
    backpedal:   { tier: T_LOCO, loop: true },
    // com bola
    receive_prepare: { tier: T_BALL, dur: 0.16 },
    receive_contact: { tier: T_BALL, dur: 0.10 },
    receive_control: { tier: T_BALL, dur: 0.22 },
    carry:           { tier: T_BALL, loop: true },
    protect:         { tier: T_BALL, loop: true },
    heavy_touch:     { tier: T_BALL, dur: 0.30 },
    lose_control:    { tier: T_BALL, dur: 0.34 },
    // passe
    pass_prepare:     { tier: T_ACTION, dur: 0.15 },
    pass_contact:     { tier: T_ACTION, dur: 0.07 },
    pass_followthrough: { tier: T_ACTION, dur: 0.10 },
    pass_recover:     { tier: T_ACTION, dur: 0.12 },
    first_touch_pass: { tier: T_ACTION, dur: 0.18 },
    long_pass:        { tier: T_ACTION, dur: 0.26 },
    cross:            { tier: T_ACTION, dur: 0.26 },
    // chute
    shot_prepare:       { tier: T_ACTION, dur: 0.22 },
    shot_contact:       { tier: T_ACTION, dur: 0.08 },
    shot_followthrough: { tier: T_ACTION, dur: 0.20 },
    shot_recover:       { tier: T_ACTION, dur: 0.22 },
    placed_shot:        { tier: T_ACTION, dur: 0.26 },
    power_shot:         { tier: T_ACTION, dur: 0.30 },
    volley:             { tier: T_ACTION, dur: 0.24 },
    header:             { tier: T_ACTION, dur: 0.30 },
    // drible
    dribble_prepare: { tier: T_BALL, dur: 0.14 },
    body_feint:      { tier: T_BALL, dur: 0.24 },
    inside_cut:      { tier: T_BALL, dur: 0.22 },
    outside_cut:     { tier: T_BALL, dur: 0.22 },
    turn_dribble:    { tier: T_BALL, dur: 0.26 },
    burst_touch:     { tier: T_BALL, dur: 0.20 },
    protect_turn:    { tier: T_BALL, dur: 0.26 },
    dribble_success: { tier: T_BALL, dur: 0.22 },
    dribble_failure: { tier: T_BALL, dur: 0.26 },
    // defesa
    press:           { tier: T_DEF, loop: true },
    jockey:          { tier: T_DEF, loop: true },
    intercept:       { tier: T_DEF, dur: 0.24 },
    standing_tackle: { tier: T_DEF, dur: 0.30 },
    slide_tackle:    { tier: T_DEF, dur: 0.52 },
    block:           { tier: T_DEF, dur: 0.26 },
    body_duel:       { tier: T_DEF, dur: 0.30 },
    recover:         { tier: T_DEF, dur: 0.30 },
    // goleiro
    gk_ready:         { tier: T_GK, loop: true },
    gk_shift:         { tier: T_GK, loop: true },
    gk_set:           { tier: T_GK, dur: 0.20 },
    gk_low_dive:      { tier: T_GK, dur: 0.70 },
    gk_high_dive:     { tier: T_GK, dur: 0.90 },
    gk_catch:         { tier: T_GK, dur: 0.60 },
    gk_parry:         { tier: T_GK, dur: 0.50 },
    gk_punch:         { tier: T_GK, dur: 0.50 },
    gk_foot_save:     { tier: T_GK, dur: 0.44 },
    gk_smother:       { tier: T_GK, dur: 0.66 },
    gk_ground_recover:{ tier: T_GK, dur: 0.60 },
    gk_throw:         { tier: T_GK, dur: 0.50 },
    gk_kick:          { tier: T_GK, dur: 0.56 }
  };

  /* Sequências de ação: o contrato dá start/contact/end e as fases são
     derivadas dele, para que o CONTATO caia exatamente na saída da bola. */
  const SEQ = {
    pass:  ['pass_prepare', 'pass_contact', 'pass_followthrough', 'pass_recover'],
    cross: ['pass_prepare', 'pass_contact', 'cross', 'pass_recover'],
    shot:  ['shot_prepare', 'shot_contact', 'shot_followthrough', 'shot_recover']
  };

  /* limiares de locomoção em m/s */
  const LOCO = [[0.25, 'idle'], [1.6, 'walk'], [3.6, 'jog'], [5.8, 'run'], [Infinity, 'sprint']];

  function locoFor(speed, prev) {
    let s = 'idle';
    for (const [lim, name] of LOCO) { if (speed < lim) { s = name; break; } }
    return s;
  }

  function Controller(id) {
    this.id = id;
    this.state = 'idle';
    this.tier = T_LOCO;
    this.t = 0;          // tempo dentro do estado
    this.dur = 0;        // 0 = cíclico
    this.seq = null;     // sequência de ação em curso
    this.seqIdx = 0;
    this.contract = null;
    this.interrupted = false;
    this.history = [];
  }

  Controller.prototype._enter = function (state, dur, now) {
    const def = STATES[state];
    if (!def) return false;
    this.state = state;
    this.tier = def.tier;
    this.t = 0;
    this.dur = def.loop ? 0 : finite(dur, def.dur || 0.25);
    this.history.push({ state: state, at: finite(now) });
    if (this.history.length > 32) this.history.shift();
    return true;
  };

  /* Uma transição só passa se o tier for >= ao atual, ou se o estado atual já
     terminou. É a regra que impede trocar de pose no meio de um comprometimento. */
  Controller.prototype.request = function (state, now, opts) {
    const def = STATES[state];
    if (!def) return false;
    const force = !!(opts && opts.force);
    const finished = this.dur > 0 && this.t >= this.dur;
    const cyclic = this.dur === 0;
    if (!force && def.tier < this.tier && !finished && !cyclic) return false;
    if (!force && def.tier === this.tier && this.seq && !finished) return false;
    if (this.seq && (force || def.tier > this.tier)) { this.seq = null; this.contract = null; }
    return this._enter(state, opts && opts.dur, now);
  };

  /* Dirige a sequência de ação a partir do contrato da Fase 2. As durações vêm
     do motor: prepare = contact-start, e o resto do próprio contrato. */
  Controller.prototype.beginAction = function (contract, now) {
    const seq = SEQ[contract && contract.action];
    if (!seq) return false;
    this.seq = seq.slice();
    this.seqIdx = 0;
    this.contract = contract;
    this.interrupted = false;
    const prep = Math.max(0.02, finite(contract.prepareDuration, 0.15));
    this._enter(seq[0], prep, now);
    this.tier = T_ACTION;
    return true;
  };

  Controller.prototype.interrupt = function (now, reason) {
    if (!this.seq) return false;
    this.seq = null;
    this.contract = null;
    this.interrupted = true;
    this._enter(reason === 'tackled' ? 'lose_control' : 'decelerate', null, now);
    return true;
  };

  /* speed em m/s; gk marca o atleta como goleiro (piso vira gk_ready). */
  Controller.prototype.update = function (dt, now, ctx) {
    ctx = ctx || {};
    this.t += finite(dt);
    if (this.dur > 0 && this.t >= this.dur) {
      if (this.seq) {
        this.seqIdx++;
        if (this.seqIdx < this.seq.length) {
          const next = this.seq[this.seqIdx];
          const c = this.contract || {};
          const d = next.indexOf('_contact') > 0 ? 0.07
                  : next.indexOf('followthrough') > 0 || next === 'cross' ? finite(c.followThroughDuration, 0.12)
                  : finite(c.recoveryDuration, 0.14);
          this._enter(next, d, now);
          return this.snapshot();
        }
        this.seq = null;
        this.contract = null;
      }
      // caiu para o piso: locomoção (ou prontidão do goleiro)
      const base = ctx.isGK ? 'gk_ready' : locoFor(finite(ctx.speed), this.state);
      this.tier = ctx.isGK ? T_GK : T_LOCO;
      this._enter(base, null, now);
    } else if (this.dur === 0) {
      // estado cíclico acompanha a velocidade sem reiniciar a fase à toa
      const base = ctx.isGK ? 'gk_ready'
                 : ctx.hasBall ? (finite(ctx.speed) > 0.3 ? 'carry' : 'protect')
                 : locoFor(finite(ctx.speed), this.state);
      if (base !== this.state && this.tier <= T_BALL) {
        this._enter(base, null, now);
      }
    }
    return this.snapshot();
  };

  Controller.prototype.snapshot = function () {
    const def = STATES[this.state] || {};
    const phase = this.dur > 0 ? clamp(this.t / this.dur, 0, 1) : 0;
    const seg = this.seq ? this.seq[this.seqIdx] : null;
    return {
      state: this.state,
      tier: this.tier,
      phase: +phase.toFixed(4),
      loop: !!def.loop,
      inAction: !!this.seq,
      segment: seg,
      interrupted: this.interrupted,
      actionId: this.contract ? this.contract.actionId : null
    };
  };

  function Machine() { this.byId = Object.create(null); }
  Machine.prototype.of = function (id) {
    return this.byId[id] || (this.byId[id] = new Controller(id));
  };
  Machine.prototype.update = function (dt, now, ctxById) {
    const out = Object.create(null);
    for (const id in this.byId) {
      out[id] = this.byId[id].update(dt, now, (ctxById && ctxById[id]) || {});
    }
    return out;
  };

  return {
    version: VERSION,
    STATES: STATES,
    SEQ: SEQ,
    TIERS: { LOCO: T_LOCO, BALL: T_BALL, DEF: T_DEF, ACTION: T_ACTION, GK: T_GK },
    locoFor: locoFor,
    Controller: Controller,
    Machine: Machine,
    create: function () { return new Machine(); },
    stateCount: Object.keys(STATES).length
  };
});

/*
 * Copa dos Sonhos · R14 · PONTE MOTOR -> MÁQUINA DE ANIMAÇÃO (Fase 3)
 *
 * Liga os eventos do contrato de ação (Fase 2) ao controlador por atleta.
 * É apresentação pura: envolve _emit apenas para OBSERVAR. Nenhuma decisão do
 * motor depende disto, e o runner headless nem carrega esta camada.
 *
 * O ganho sobre motionAt(): a pose de contato é agendada pela duração que o
 * MOTOR declarou no contrato, então o quadro em que o pé toca a bola é o mesmo
 * tick em que a bola parte — não um palpite de 0,42s fixo.
 */
(function (root) {
  'use strict';
  if (!root || root.__CDS_ANIM_BRIDGE__) return;

  function install() {
    const M = root.MatchSim, A = root.CDS_ANIM;
    if (!M || !M.prototype || !A || M.prototype.__CDS_ANIM_BRIDGE__) return false;
    M.prototype.__CDS_ANIM_BRIDGE__ = true;
    root.__CDS_ANIM_BRIDGE__ = true;

    // Qualificado por TIME: p.idx é numerado por equipe e o nome pode repetir,
    // então ids sem o time colidiam entre os dois lados e dois atletas
    // dividiam o mesmo controlador (22 jogadores viravam 17 estados).
    const idOf = p => (p ? (p.team != null ? p.team : '?') + ':' +
                          ((p.ref && (p.ref.id || p.ref.n)) || p.id || p.idx) : null);

    const oldEmit = M.prototype._emit;
    M.prototype._emit = function (type, data) {
      try {
        if (!this.__anim) this.__anim = A.create();
        const now = Number(this.t) || 0;
        if (type === 'action_prepare' && data && data.by) {
          // guarda o preparo; o contrato completo chega no contato
          this.__animPending = { id: idOf(data.by), action: data.action,
                                 prepareDuration: data.prepareDuration, actionId: data.actionId };
          const c = this.__anim.of(this.__animPending.id);
          c.beginAction({ actionId: data.actionId, action: data.action,
                          prepareDuration: data.prepareDuration,
                          followThroughDuration: 0.12, recoveryDuration: 0.14 }, now);
        } else if (type === 'action_contact' && data && data.by && data.contract) {
          const c = this.__anim.of(idOf(data.by));
          if (!c.seq) c.beginAction(data.contract, now);
        } else if (type === 'action_interrupted' && data && data.by) {
          this.__anim.of(idOf(data.by)).interrupt(now, 'tackled');
        } else if (data && data.by && (type === 'tackle' || type === 'slide_tackle')) {
          this.__anim.of(idOf(data.by)).request('standing_tackle', now, { force: true });
        } else if (data && data.gk) {
          const map = { gk_save: 'gk_parry', gk_claim: 'gk_catch', gk_punch: 'gk_punch',
                        gk_claim_miss: 'gk_ground_recover' };
          if (map[type]) this.__anim.of(idOf(data.gk)).request(map[type], now, { force: true });
        }
      } catch (_) { /* apresentação nunca derruba o motor */ }
      return oldEmit.apply(this, arguments);
    };

    /* Avança os controladores junto do relógio do motor e publica o estado por
       atleta para o desenhista consultar. */
    const oldStep = M.prototype.step;
    M.prototype.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      try {
        if (this.__anim) {
          const ctx = Object.create(null);
          for (const tm of this.teams) {
            for (const p of tm.players) {
              if (p.red) continue;
              // garante controlador para TODO atleta em campo: sem isto, só quem
              // recebe um evento de ação ganha estado, e os demais ficam sem
              // locomoção nenhuma para o desenhista consultar
              this.__anim.of(idOf(p));
              ctx[idOf(p)] = {
                speed: Math.hypot(Number(p.vx) || 0, Number(p.vy) || 0),
                hasBall: this.ball && this.ball.owner === p,
                isGK: !!p.isGK
              };
            }
          }
          this.__animState = this.__anim.update(Number(dt) || 0, Number(this.t) || 0, ctx);
          // Publica também pela CHAVE DE DESENHO (a mesma que CDS_F25D.body e o
          // dirCache já usam), para o desenhista consultar o estado sem precisar
          // do objeto do jogador nem da instância da partida.
          const byKey = Object.create(null);
          for (const tm of this.teams) {
            for (const p of tm.players) {
              if (p.red) continue;
              const s = this.__animState[idOf(p)];
              if (s) byKey[(p.ref && p.ref.n) || p.n || ('#' + (p.num || 0))] = s;
            }
          }
          root.__CDS_ANIM_BY_KEY = byKey;
        }
      } catch (_) { }
      return r;
    };

    /* Consulta usada pelo desenhista: estado + fase do atleta. */
    M.prototype.animOf = function (p) {
      const s = this.__animState;
      return (s && s[idOf(p)]) || null;
    };
    return true;
  }

  if (!install()) {
    // o bundle do motor pode ainda não ter sido avaliado quando esta camada carrega
    let tries = 0;
    const t = setInterval(function () {
      if (install() || ++tries > 100) clearInterval(t);
    }, 50);
  }
})(typeof window !== 'undefined' ? window : null);

