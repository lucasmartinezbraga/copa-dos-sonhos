
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
    /* §D49 · CAMERA DE TV. Era 0,72 — perspectiva branda, jogo quase visto de
       cima. 0,54 baixa a camera para o angulo de transmissao, e foi escolhido
       comparando o MESMO quadro congelado em quatro alturas: 0,62 muda pouco,
       0,46 comprime demais o lado distante. Ajustavel por `CDS_CAM_TUNE`. */
    R0: 0.54,                          // largura distante / próxima
    R0_BASE: 0.72,                     // §D49 · referencia dos 22 px/m de altura
    topY0: 46,                         // §D49 · faixa antes do achatamento
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
    G.topY0 = G.bottomY - ((CH_REF - 3) - (M + 34));   // §D49 · faixa de referencia
    G.topY = G.topY0;
    G.ready = true;
  }
  /* §D49 · A CAMERA DE TV: baixar E angular.
     ---------------------------------------------------------------------
     Duas coisas separadas, e so as duas juntas dao a camera de transmissao:

       R0     razao entre a largura da borda DISTANTE e a da proxima. 1,0 seria
              planta baixa (camera no zenite); quanto menor, mais baixa a
              camera, porque o fundo encolhe mais. Estava fixo em 0,72.
       faixa  quanto da altura de tela o gramado ocupa. Camera baixa ACHATA o
              campo na vertical — sem isto o campo so fica trapezoidal, e
              continua parecendo visto de cima.

     Aplicados MUTANDO `G` uma vez por quadro, no inicio do `grass()`, em vez de
     lidos em cada consumidor. E o unico jeito que mantem todo mundo de acordo:
     `G.topY` e lido pela projecao, pelo teto de altura da bola, pela base da
     arquibancada, pela vinheta e pelo `faixa()` publico. Se so a projecao
     soubesse da camera nova, os jogadores andariam num gramado que o desenho
     poe em outro lugar.

     ATENCAO, e ja custou uma tentativa: baixar a camera sem mexer na ALTURA nao
     funciona. Os 22 px por metro do `liftY` foram calibrados para R0=0,72 — com
     a camera mais baixa, um metro tem que ocupar mais tela, senao a bola alta
     fica rasteira e a balistica da OS-200 deixa de se ler. A escala de altura
     acompanha `R0_BASE / R0`. */
  function camKey() {
    var t = root.CDS_CAM_TUNE;
    return t ? (t.R0 + '/' + t.faixa) : 'base';
  }
  function aplicarCam() {
    var t = root.CDS_CAM_TUNE;
    var r0 = G.R0_BASE, fx = 1;
    if (t) {
      var a = +t.R0;    if (isFinite(a) && a >= 0.30 && a <= 0.95) r0 = a;
      var b = +t.faixa; if (isFinite(b) && b >= 0.45 && b <= 1.30) fx = b;
    }
    G.R0 = r0;
    G.topY = G.bottomY - (G.bottomY - G.topY0) * fx;
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
  /* §OS-236 · A CURVA DO LANCAMENTO ERA UMA CUPULA ACHATADA
     ------------------------------------------------------------------------
     RELATO: "a curva da bola na hora do lancamento ta estranha".

     Nao e a fisica. Medido em partida (`tools/fisica/tela/voo-da-bola.js`), o
     lancamento sai a 40 graus com apice de 6,97 m em 34,8 m de alcance -- que
     e bola alcada de futebol, e confere com a conta a mao.

     O defeito esta em como essa altura vira PIXEL. Com Z_FIEL 2,6 e
     Z_FOLGA 3,4, um apice de 7 m era desenhado como 4,52 m (35% a menos), e o
     que estraga a leitura nao e nem o encolhimento: e a DERIVADA. A inclinacao
     da curva em 7 m cai para 0,19 do valor 1:1, entao a bola sobe depressa
     perto do chao e quase PARA de subir no alto. Uma parabola desenhada assim
     vira cupula achatada -- que e exatamente "estranha".

     E o lancamento vive justamente na faixa saturada: 2,6 m e menos da metade
     do apice tipico dele.

     A compressao existia para "o ceu inteiro caber na tela". Mas o apice maximo
     medido numa partida inteira e ~11 m: a 22 px/m sao 242 px de um quadro de
     768. Cabe com folga. A compressao estava conservadora demais.

     Agora a faixa fiel cobre o lancamento inteiro COM FOLGA (9 m) e a saturacao
     so age acima disso, para o chutao ocasional nao furar o topo do campo. Nao
     ha risco de a bola invadir a arquibancada porque a altura desenhada ja
     escala com a profundidade (`* s` em `liftY`): no campo distante, onde a
     linha do chao esta la em cima, `s` vale ~0,54 e os 7 m viram 83 px, nao 154. O travessao (2,44 m)
     segue dentro da faixa 1:1 nos dois casos, entao a invariante da §D50 --
     bola por cima do travessao PARECE por cima -- fica intacta.

     Ajustavel em execucao por `CDS_ZFIEL`, para a sonda medir antes e depois na
     mesma partida. Apresentacao pura: bloco pulado pela bateria. */
  const Z_FIEL_PADRAO = 9.0, Z_FOLGA_PADRAO = 8.0;
  function alturaVisual(z) {
    const a = Math.max(0, z || 0);
    const zf = typeof root.CDS_ZFIEL === 'number' ? root.CDS_ZFIEL : Z_FIEL_PADRAO;
    const zg = typeof root.CDS_ZFOLGA === 'number' ? root.CDS_ZFOLGA : Z_FOLGA_PADRAO;
    if (a <= zf) return a;
    const e = a - zf;
    return zf + e / (1 + e / zg);
  }
  /* §D50 · UMA escala de altura, para a bola E para o gol.
     ---------------------------------------------------------------------
     O travessao era desenhado com `hPx = 30 * s`, um numero solto, enquanto a
     bola sobe a 22 px por metro. 30 / 22 = **1,36 m**: o travessao desenhado
     estava na altura de um travessao de 1,36 m, e o real tem 2,44 m.

     A consequencia se ve em campo: uma bola a 2,0 m esta CONFORTAVELMENTE sob o
     travessao para a fisica e e desenhada a 44 px, bem ACIMA da barra de 30 px.
     Defesa embaixo da trave parecia bola por cima. O laudo da OS-200 chega a
     dizer que ate 2,6 m o mapeamento e 1:1 "senao uma bola por cima do
     travessao nao PARECE por cima do travessao" — a intencao estava escrita, o
     gol e que nao seguia.

     Agora os dois saem de `alturaPxM()`, que tambem carrega a compensacao de
     camera da §D49. */
  const ALT_PX_M = 22, TRAVESSAO_M = 2.44;
  function alturaPxM() { return ALT_PX_M * (G.R0_BASE / G.R0); }
  function liftY(baseY, z, s) {
    return Math.max(G.topY + 8, baseY - alturaVisual(z) * alturaPxM() * s);
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
      /* §D50 · era `30 * s` — 1,36 m na escala em que a bola sobe. */
      const hPx = TRAVESSAO_M * alturaPxM() * ((b0.s + b1.s) / 2);   // altura visual do gol
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
    /* §D49 · a camera entra ANTES do palco: `buildStage` desenha arquibancada e
       ceu a partir de `G.topY`, entao mudar a camera depois deixaria o estadio
       no lugar antigo com o gramado no novo. */
    const key = M + ':' + fW + 'x' + fH + ':' + camKey();
    if (stage.key !== key) {
      setGeom(M, fW, fH); aplicarCam(); stage.cv = buildStage(); stage.key = key;
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

  /* §OS-237 · MEMBROS COM ARTICULACAO
     ========================================================================
     RELATO do dono: "o problema principal e a qualidade das animacoes", e
     depois, explicitamente, "se voce achar melhor mude os bonecos, reconstrua
     a parte grafica".

     O teto de qualidade nao era a maquina de estados nem a fisica: era o
     DESENHO. Cada perna e cada braco eram um `fillRect` ALINHADO AOS EIXOS.
     Um retangulo alinhado nao gira -- ele so translada. Entao a passada movia
     blocos para cima e para baixo, e nenhuma quantidade de envelope, fase ou
     mistura faz um bloco que nao gira parecer uma perna.

     E o que o olho usa para ler corrida e justamente o ANGULO: a coxa abre, o
     joelho dobra, o pe acompanha. Sem joelho nao ha corrida, ha deslize.

     Agora cada membro tem dois segmentos e uma juncao:

         quadril --(coxa, angulo)--> joelho --(canela, angulo+dobra)--> pe
         ombro   --(braco, angulo)--> cotovelo --(antebraco, +dobra)--> mao

     A dobra do joelho nao e decorativa: ela cresce quando o membro vai para
     TRAS, que e o que um corredor faz (o calcanhar sobe atras e a perna estende
     na frente). E o que separa correr de marchar.

     Ajustavel por `CDS_ARTIC = false`, que devolve o desenho antigo -- e por
     isso as tiras de comparacao saem do MESMO build, sem variancia. */
  function _pontaDe(x, y, ang, comp) {
    return [x + Math.sin(ang) * comp, y + Math.cos(ang) * comp];
  }
  function _segmento(ctx, x, y, ang, comp, larg, raio) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    rr(ctx, -larg / 2, -larg * 0.18, larg, comp + larg * 0.18, raio); ctx.fill();
    ctx.restore();
  }
  /* Uma perna. `ang` e medido a partir da vertical, positivo para a FRENTE do
     atleta (ja multiplicado por `face` por quem chama). */
  function _perna(ctx, hx, hy, ang, dobra, r, corPerna, corPe, face) {
    const _C = _corpo();
    const coxa = r * _C.coxa, canela = r * _C.canela, larg = r * 0.23;
    ctx.fillStyle = corPerna;
    _segmento(ctx, hx, hy, ang, coxa, larg, larg * 0.46);
    const j = _pontaDe(hx, hy, ang, coxa);
    const angC = ang + dobra;
    _segmento(ctx, j[0], j[1], angC, canela, larg * 0.88, larg * 0.42);
    const t = _pontaDe(j[0], j[1], angC, canela);
    ctx.fillStyle = corPe;
    ctx.save(); ctx.translate(t[0], t[1]); ctx.rotate(angC * 0.30);
    rr(ctx, face >= 0 ? -r * 0.07 : -r * 0.17, -r * 0.015, r * 0.24, r * 0.135, r * 0.055);
    ctx.fill(); ctx.restore();
    return t;
  }
  /* Um braco. Mesma ideia, mais curto e mais fino; a dobra do cotovelo cresce
     quando o braco vem para a FRENTE, ao contrario do joelho. */
  function _braco(ctx, sx, sy, ang, dobra, r, cor, corMao) {
    const sup = r * 0.30, ante = r * 0.28, larg = r * 0.20;
    ctx.fillStyle = cor;
    _segmento(ctx, sx, sy, ang, sup, larg, larg * 0.46);
    const c = _pontaDe(sx, sy, ang, sup);
    const angA = ang + dobra;
    _segmento(ctx, c[0], c[1], angA, ante, larg * 0.86, larg * 0.42);
    if (corMao) {
      const m = _pontaDe(c[0], c[1], angA, ante);
      ctx.fillStyle = corMao;
      ctx.beginPath(); ctx.arc(m[0], m[1], r * 0.10, 0, TAU); ctx.fill();
    }
  }
  function _articulado() { return root.CDS_ARTIC !== false; }

  /* §OS-238 · PROPORCAO DO BONECO
     ========================================================================
     Com os membros ja articulados, a folha de poses ampliada mostrou que o que
     mais atrapalha a leitura nao e detalhe nenhum: e a PROPORCAO. O atleta era
     um torso enorme com tocos embaixo.

         antes:  cabeca 0,68 r  ·  torso 0,92 r  ·  pernas 0,69 r
                 -> a perna era 30% da altura do corpo

     Num corpo humano a perna e ~48% da altura. Com 30%, qualquer passada fica
     escondida: o olho ve um bloco que desliza, porque o pedaco que se move e
     pequeno demais na silhueta.

     A altura total nao muda (o boneco continua ocupando o mesmo espaco no
     gramado, ~2,1 r): o que muda e a REPARTICAO -- torso mais curto e estreito,
     perna mais longa. A 13 px de raio, que e o tamanho real em jogo, e a
     silhueta que carrega a animacao, e nao o desenho fino.

     Tudo em unidades de `r` e num lugar so, entao a proxima mudanca de
     proporcao e uma tabela, nao uma cacada por numeros soltos.
     Ajustavel por `CDS_PROP = false` para comparar no mesmo build. */
  const CORPO_NOVO = {
    torsoX: 0.46, torsoTopo: -0.56, torsoAlt: 0.66, torsoRaio: 0.22,
    shortsX: 0.40, shortsY: 0.02, shortsAlt: 0.30,
    ombroX: 0.56, ombroY: -0.40,
    quadrilX: 0.17, quadrilY: 0.14,
    coxa: 0.42, canela: 0.40,
    cabecaY: -0.84, cabecaR: 0.30,
  };
  const CORPO_ANTIGO = {
    torsoX: 0.56, torsoTopo: -0.52, torsoAlt: 0.92, torsoRaio: 0.26,
    shortsX: 0.50, shortsY: 0.12, shortsAlt: 0.38,
    ombroX: 0.62, ombroY: -0.36,
    quadrilX: 0.19, quadrilY: 0.24,
    coxa: 0.35, canela: 0.34,
    cabecaY: -0.82, cabecaR: 0.34,
  };
  function _corpo() { return root.CDS_PROP === false ? CORPO_ANTIGO : CORPO_NOVO; }
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
    /* §OS-207 · o tombo bate forte e sustenta (o corpo vai ao chao e fica),
       o levantar sobe do chao e devolve o atleta a locomocao — envelopes
       espelhados, por isso um cresce e o outro decai. */
    if (state === 'fouled') return p < .22 ? p / .22 : 1 - (p - .22) / .78 * .30;
    if (state === 'get_up') return 1 - p;
    /* §D39 · A INTERCEPTACAO NAO TINHA GESTO.
       A camada 69 pede `pede(this, data.by, 'intercept')` no evento, a maquina
       de animacao entra no estado — e este `animWave` nao conhecia a palavra:
       caia no `return 0` de baixo e o jogador interceptava SEM MOVIMENTO
       NENHUM. A bola trocava de dono e o corpo nem reagia.

       O gesto e curto e assimetrico, ao contrario do carrinho: sobe rapido
       (o pe/corpo estica para a linha de passe) e desce devagar (recomposicao).
       Por isso nao e `sin(p*PI)`, que e simetrico e parece um chute. */
    if (state === 'intercept') return p < .3 ? p / .3 : 1 - (p - .3) / .7 * .85;
    /* §D48 · as VARIANTES de chute e passe nao tinham envelope: `animWave` nao
       conhecia a palavra e devolvia 0, entao mesmo depois de fiadas elas
       chegariam ao desenho com onda zero — sem perna de chute, exatamente o
       defeito que a §D39 achou na interceptacao. Gesto completo: carrega, bate
       no pico, desce. */
    if (/^(power_shot|placed_shot|volley|long_pass|first_touch_pass)$/.test(state)) {
      return Math.sin(p * Math.PI);
    }
    return 0;
  }

  /* §D42 · TABELA DE POSTURA — uma silhueta por estado, sem 15 ramos de desenho
     ------------------------------------------------------------------------
     MEDIDO por `tools/fisica/tela/gestos.js`, que grava a sequencia de
     operacoes de desenho e a compara com a nuvem da corrida: **cinco estados
     entravam e pintavam a silhueta da corrida, identica** — `protect`,
     `shot_recover`, `intercept`, `lose_control` e `heavy_touch`. E outros 32
     dos 62 declarados nunca chegavam a ser desenhados.

     Sobre o `intercept`: a §D39 deu a ele uma onda e um `bob`, e eu dei o caso
     por resolvido. A sonda mostra que o gesto inteiro era um deslocamento
     VERTICAL do corpo de 0,07·r — os membros nao se mexiam. Nao era pose, era
     empurrao. Um gesto que so translada o boneco nao e um gesto.

     Em vez de mais um `else if` por estado, os parametros abaixo modulam o
     desenho de corrida que ja existe:

       esc     escala da tesoura das pernas (1 = passada normal)
       spr     afastamento lateral dos pes, em raios
       inc     inclinacao extra do tronco (+ para a frente, - para tras)
       agacha  quanto o corpo baixa, em raios
       braco   escala do balanco dos bracos
       estica  perna estendida a frente, em raios (alcance) */
  /* §OS-215 · teto de cadencia em passos por segundo DE TELA. Acima de ~4,6
     o olho perde a perna individual e le borrao -- e o borrao e o que o dono
     chamou de poluicao. Abaixo disso a passada continua acompanhando a
     velocidade de verdade. */
  const CAD_MAX = 4.6;

  const POSE = {
    /* locomocao de transicao */
    accelerate: { esc: 0.80, spr: 0.00, inc:  0.28, agacha: 0.10, braco: 1.25, estica: 0.00 },
    decelerate: { esc: 0.50, spr: 0.22, inc: -0.26, agacha: 0.16, braco: 1.10, estica: 0.20 },
    turn:       { esc: 0.55, spr: 0.18, inc:  0.00, agacha: 0.10, braco: 0.90, estica: 0.00 },
    strafe:     { esc: 0.35, spr: 0.32, inc:  0.00, agacha: 0.12, braco: 0.80, estica: 0.00 },
    backpedal:  { esc: 0.55, spr: 0.12, inc: -0.30, agacha: 0.08, braco: 0.55, estica: 0.00 },
    /* defesa sem bola */
    press:      { esc: 1.10, spr: 0.00, inc:  0.20, agacha: 0.00, braco: 1.30, estica: 0.00 },
    jockey:     { esc: 0.25, spr: 0.36, inc:  0.08, agacha: 0.22, braco: 1.35, estica: 0.00 },
    recover:    { esc: 0.90, spr: 0.00, inc:  0.30, agacha: 0.04, braco: 1.20, estica: 0.00 },
    body_duel:  { esc: 0.30, spr: 0.30, inc:  0.16, agacha: 0.16, braco: 1.45, estica: 0.00 },
    /* os cinco que a sonda pegou desenhando a corrida */
    protect:    { esc: 0.20, spr: 0.32, inc: -0.12, agacha: 0.14, braco: 1.50, estica: 0.00 },
    shot_recover:{esc: 0.45, spr: 0.10, inc: -0.20, agacha: 0.06, braco: 0.70, estica: 0.26 },
    intercept:  { esc: 0.35, spr: 0.10, inc:  0.34, agacha: 0.04, braco: 1.20, estica: 0.62 },
    lose_control:{esc: 0.40, spr: 0.28, inc: -0.26, agacha: 0.02, braco: 1.60, estica: 0.16 },
    heavy_touch:{ esc: 0.95, spr: 0.06, inc:  0.30, agacha: 0.00, braco: 1.15, estica: 0.44 },
    /* §D43 · familia do drible. Os tres `dribble_*` casam com o regex de
       `dribbling` e por isso desenhavam como `carry` — mesma armadilha dos
       cinco mudos da §D42, um nivel abaixo. */
    dribble_prepare: { esc: 0.35, spr: 0.18, inc:  0.12, agacha: 0.14, braco: 1.10, estica: 0.10 },
    dribble_success: { esc: 1.00, spr: 0.00, inc:  0.26, agacha: 0.02, braco: 1.15, estica: 0.00 },
    dribble_failure: { esc: 0.40, spr: 0.26, inc: -0.26, agacha: 0.06, braco: 1.50, estica: 0.22 },
    /* §D45 · goleiro. A `braco` nao vale para ele — o braco do goleiro sai do
       ramo `gk` do desenho, nao do balanco de corrida — mas base, agachamento e
       inclinacao valem, e sao o que separa deslocar de esperar o chute. */
    /* `gl`/`gr` = altura do braco ESQUERDO e DIREITO em raios (negativo sobe),
       `gx` = abertura extra para fora. Sem isto os estados de goleiro sao
       indistinguiveis: o tronco dele e grande e os bracos ficavam sempre na
       mesma posicao em T, entao `esc`/`spr`/`agacha` mexiam so no que estava
       escondido atras do tronco. Conferido na folha de poses. */
    gk_ready:    { esc: 0.15, spr: 0.24, inc:  0.00, agacha: 0.10, braco: 1.00, estica: 0.00, gl:  0.00, gr:  0.00, gx: 0.00 },
    gk_shift:    { esc: 0.45, spr: 0.32, inc:  0.00, agacha: 0.16, braco: 1.00, estica: 0.00, gl:  0.14, gr:  0.14, gx: 0.10 },
    gk_set:      { esc: 0.05, spr: 0.44, inc:  0.14, agacha: 0.30, braco: 1.00, estica: 0.00, gl:  0.40, gr:  0.40, gx: 0.16 },
    gk_throw:    { esc: 0.30, spr: 0.20, inc:  0.24, agacha: 0.04, braco: 1.00, estica: 0.20, gl:  0.36, gr: -0.72, gx: 0.06 },
    gk_kick:     { esc: 0.50, spr: 0.12, inc:  0.20, agacha: 0.00, braco: 1.00, estica: 0.42, gl: -0.24, gr:  0.28, gx: 0.20 },
    gk_smother:  { esc: 0.20, spr: 0.36, inc:  0.30, agacha: 0.34, braco: 1.00, estica: 0.34, gl:  0.58, gr:  0.58, gx: 0.22 },
    gk_ground_recover: { esc: 0.20, spr: 0.34, inc: -0.32, agacha: 0.30, braco: 1.00, estica: 0.00, gl: 0.52, gr: 0.52, gx: 0.00 },
    gk_foot_save:{ esc: 0.25, spr: 0.30, inc:  0.10, agacha: 0.22, braco: 1.00, estica: 0.66, gl:  0.30, gr:  0.30, gx: 0.26 },
    gk_parry:    { esc: 0.20, spr: 0.34, inc:  0.16, agacha: 0.18, braco: 1.00, estica: 0.24, gl: -0.66, gr:  0.20, gx: 0.14 },
    /* §OS-207 · a falta sofrida. O corpo perde a base: pernas param de
       tesourar (`esc` baixo), a base abre, o tronco vai para TRAS (`inc`
       negativo, empurrado) e os bracos sobem procurando equilibrio. O
       levantar e o mesmo corpo agachado voltando ao eixo. */
    fouled:     { esc: 0.10, spr: 0.40, inc: -0.34, agacha: 0.30, braco: 1.70, estica: 0.34 },
    get_up:     { esc: 0.18, spr: 0.30, inc:  0.22, agacha: 0.34, braco: 1.15, estica: 0.00 },
    /* recepcao */
    receive_prepare: { esc: 0.30, spr: 0.24, inc:  0.10, agacha: 0.14, braco: 1.40, estica: 0.30 },
    receive_contact: { esc: 0.15, spr: 0.20, inc:  0.18, agacha: 0.18, braco: 1.20, estica: 0.50 },
    receive_control: { esc: 0.40, spr: 0.16, inc:  0.06, agacha: 0.10, braco: 1.10, estica: 0.14 },
  };

  /* §OS-235 · A POSE PASSA A SER MISTURADA — O CORTE SECO ERA O DEFEITO
     ------------------------------------------------------------------------
     RELATO do dono, depois de tudo o que ja foi corrigido: "o problema
     principal e a qualidade das animacoes" -- o pulo, o desarme, a falta, a
     bola. Varias animacoes, a mesma sensacao.

     Nao sao varias. E UMA.

     Ate aqui o desenho lia `POSE[st]` DIRETO, no estado do quadro. Quando o
     estado mudava, os seis parametros da silhueta trocavam de valor de uma vez:
     `esc`, `spr`, `inc`, `agacha`, `braco` e `estica` saltavam no mesmo quadro.
     Como `bob` carrega `- r * P.agacha`, o boneco AFUNDA e volta a subir em um
     quadro; como `_rotTot` carrega `face * P.inc`, o tronco chicoteia.

     Ou seja: TODA troca de gesto era um corte. Nao existe pose boa o bastante
     para sobreviver a isso -- e por isso a queixa e "varias animacoes" em vez
     de uma. O carrinho comeca com solavanco, o pulo termina com solavanco, a
     falta idem.

     Agora a silhueta desenhada persegue a do estado por MISTURA, com smoothstep
     sobre `T_MISTURA` de relogio de PAREDE por atleta -- o mesmo `_dtP` da
     passada, entao quadro irregular e botao de velocidade nao mexem na duracao
     da transicao.

     A pose neutra e exatamente o que os oito usos de `P` ja faziam quando
     `POSE[st]` nao existia (`esc` 1, `braco` 1, o resto 0), entao em REGIME
     nada muda: o desenho fica identico ao de antes. So a troca deixa de ser
     um degrau.

     A ONDA (`animWave`) e misturada com criterio diferente. Ela e o envelope do
     gesto, e a maioria ja nasce em zero (`sin(p*PI)`), onde misturar seria
     amolecer um golpe que deve ser seco. Entao so se mistura quando existe
     DEGRAU DE VERDADE -- o caso real e `fouled` (que termina em 0,70) para
     `get_up` (que comeca em 1,0), e todo gesto que cai num estado sem envelope,
     onde `animWave` devolve 0 e o corpo apagava de um quadro para o outro.

     Apresentacao pura: este bloco (`cds-ux-boot`) e pulado pela bateria. */
  const POSE_NEUTRA = { esc: 1, spr: 0, inc: 0, agacha: 0, braco: 1, estica: 0 };
  const T_MISTURA_PADRAO = 0.11;   // s de parede -- ~3 quadros a 30 fps
  const DEGRAU_ONDA = 0.15;        // abaixo disto a onda nao e misturada
  /* A duracao e ajustavel em tempo de execucao por `CDS_MIX_T`. Com 0 a
     mistura desaparece e o desenho volta a ser EXATAMENTE o de antes -- e por
     isso a sonda consegue medir controle e tratamento na MESMA partida, sem
     variancia de build entre as duas medicoes. */
  const AUDIT = { quadros: 0, trocas: 0, soma: 0, pico: 0 };
  root.CDS_ANIM_MIX = {
    get t() { return typeof root.CDS_MIX_T === 'number' ? root.CDS_MIX_T : T_MISTURA_PADRAO; },
    auditoria: AUDIT,
    zerar: function () { AUDIT.quadros = 0; AUDIT.trocas = 0; AUDIT.soma = 0; AUDIT.pico = 0; }
  };

  function misturarPose(d, st, ondaCrua, dtP) {
    const alvo = POSE[st] || POSE_NEUTRA;
    if (d.__poseSt !== st) {
      /* parte de onde o corpo ESTAVA desenhado, e nao da tabela do estado
         velho: se a troca pegou uma mistura pela metade, ela segue de onde
         estava, em vez de recomecar de um degrau novo */
      d.__poseDe = d.__poseAtual || { esc: alvo.esc, spr: alvo.spr, inc: alvo.inc,
                                      agacha: alvo.agacha, braco: alvo.braco, estica: alvo.estica };
      const ant = (typeof d.__ondaAtual === 'number') ? d.__ondaAtual : ondaCrua;
      d.__ondaDe = ant;
      d.__ondaMistura = Math.abs(ondaCrua - ant) >= DEGRAU_ONDA;
      d.__poseSt = st;
      d.__poseK = 0;
      AUDIT.trocas++;
    }
    const _T = typeof root.CDS_MIX_T === 'number' ? root.CDS_MIX_T : T_MISTURA_PADRAO;
    d.__poseK = _T > 0 ? Math.min(1, (d.__poseK || 0) + Math.max(0, dtP || 0) / _T) : 1;
    const k = d.__poseK, e = k * k * (3 - 2 * k);        // smoothstep
    const de = d.__poseDe || alvo;
    const fora = {
      esc:    de.esc    + (alvo.esc    - de.esc)    * e,
      spr:    de.spr    + (alvo.spr    - de.spr)    * e,
      inc:    de.inc    + (alvo.inc    - de.inc)    * e,
      agacha: de.agacha + (alvo.agacha - de.agacha) * e,
      braco:  de.braco  + (alvo.braco  - de.braco)  * e,
      estica: de.estica + (alvo.estica - de.estica) * e
    };
    /* AUDITORIA · o salto de silhueta DESENHADO de um quadro para o outro.
       E esta a grandeza da queixa: um degrau grande aqui e o solavanco que se
       ve. Somam-se os seis parametros em modulo. */
    const ant = d.__poseAnterior;
    if (ant) {
      const salto = Math.abs(fora.esc - ant.esc) + Math.abs(fora.spr - ant.spr)
                  + Math.abs(fora.inc - ant.inc) + Math.abs(fora.agacha - ant.agacha)
                  + Math.abs(fora.braco - ant.braco) + Math.abs(fora.estica - ant.estica);
      AUDIT.quadros++; AUDIT.soma += salto;
      if (salto > AUDIT.pico) AUDIT.pico = salto;
    }
    d.__poseAnterior = fora;
    d.__poseAtual = fora;
    d.__ondaAtual = d.__ondaMistura ? (d.__ondaDe + (ondaCrua - d.__ondaDe) * e) : ondaCrua;
    return fora;
  }

  function body(ctx, o) {
    /* §OS-242 · CADA ATLETA TEM O PORTE DELE
       ---------------------------------------------------------------------
       Os 22 em campo eram desenhados com EXATAMENTE o mesmo corpo: `r = 13*s`
       para todo mundo. Um time de futebol nao e assim, e o dado para corrigir
       ja existe e ja e calculado -- `ref.profileV3.heightCmSim`, estimado dos
       atributos em `25-data-integrity-v3.js`, com `bodyType` junto.

       Nao e enfeite: e o que faz o campo ler como onze pessoas em vez de onze
       copias. O zagueiro de 1,93 m tem de aparecer maior que o ponta de 1,70,
       ainda mais agora que o cabeceio tem pulo -- disputa aerea entre corpos
       iguais nao diz quem ganha.

       A faixa e estreita de proposito (0,90 a 1,10 sobre a altura media de
       180 cm): o boneco tem 26 px, entao 10% ja e um pixel e meio de diferenca
       visivel, e mais que isso desmontaria a escala do gramado.

       O PONTO DE APOIO NAO PODE MUDAR. O atleta e desenhado centrado no ponto
       projetado e os pes caem em `y + r*0,98`; crescer `r` sem compensar
       enterraria o jogador alto no gramado. Por isso a origem sobe pela mesma
       diferenca. */
    if (o.alturaCm != null) {
      const _cm = Number(o.alturaCm);
      if (isFinite(_cm) && _cm > 120) {
        const _e = clamp(_cm / 180, 0.90, 1.10);
        if (Math.abs(_e - 1) > 0.005) {
          const _rn = o.r * _e;
          o = Object.assign({}, o, { r: _rn, y: o.y - (_rn - o.r) * 0.98 });
        }
      }
    }
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
    /* §OS-215 · o relogio de parede DESTE atleta, medido. Precisa vir antes de
       `vms`, porque a formula antiga (`_dm * 60`) assumia 60 fps cravados: num
       quadro de 33 ms ela reportava METADE da velocidade real, e `vms` manda na
       amplitude da perna e no comprimento do passo. Era a mesma raiz do tremor,
       um degrau acima. */
    var _agora = performance.now();
    var _dtP = (d.t ? (_agora - d.t) : 16.7) / 1000;
    d.t = _agora;
    if (!(_dtP > 0) || _dtP > 0.25) _dtP = 1 / 60;        // aba em segundo plano
    /* velocidade FISICA do atleta: nao muda quando o jogador troca o 1X pelo 3X */
    var _vms = Math.min(_dm / Math.max(1e-3, _dtP * _vel), 12);
    /* §OS-215 · suavizacao mais firme (era .6/.4). `vms` manda na amplitude da
       perna e no comprimento do passo; com peso alto no quadro corrente, cada
       tranco de deslocamento virava tranco de perna. */
    d.vms = (d.vms || 0) * .82 + _vms * .18;
    var _passoM = 0.60 + 0.16 * d.vms;                     // comprimento do passo, em m
    /* §OS-215 · A PASSADA ANDAVA NO RELOGIO ERRADO.
       -------------------------------------------------------------------
       RELATO DO DONO: "o movimento dos bracos e das pernas polui o jogo, tem
       hora que o framerate deles e estranho".

       Ele descreveu o defeito com precisao. A fase da passada era avancada
       pelo DESLOCAMENTO DE TELA DAQUELE QUADRO (`_dm`), e nao pelo tempo. Sao
       tres fontes de tremor somadas, todas invisiveis no codigo antigo:

         1. o rAF nao entrega quadros de duracao igual;
         2. o runtime acumula `dt * G.speed` e roda um numero VARIAVEL de
            passos de simulacao por quadro desenhado -- as vezes 1, as vezes 3;
         3. o balanco #anti-cardume entra em `_dm` (ele mexe a posicao
            desenhada), entao a perna respondia ao proprio tremor decorativo.

       Com isso, um atleta correndo a velocidade CONSTANTE recebia incrementos
       de fase irregulares: a perna acelerava e travava sem que nada no jogo
       mudasse. E exatamente a leitura de "framerate estranho".

       O `/ sqrt(_vel)` era o curativo: como a 3X o deslocamento por quadro
       triplica, a passada triplicava junto e virava borrao, entao dividia-se
       pela raiz da velocidade para segurar. Curativo em cima de sintoma.

       AGORA A FASE ANDA NO TEMPO, que e o que ela sempre deveria ter feito.
       Cadencia = velocidade / comprimento do passo, em passos por segundo; a
       fase avanca `pi x cadencia x dt`, com `dt` medido em relogio de PAREDE
       por atleta. Quadro irregular deixa de importar: dois quadros somando
       33 ms produzem a mesma passada que um de 33 ms.

       O teto passa a ser em passos por segundo DE TELA (`CAD_MAX`), que e a
       unidade em que "borrao" faz sentido -- e nao um limite de radianos por
       quadro, que muda de significado com o framerate. */
    var _cadJogo = d.vms / Math.max(0.35, _passoM);      // passos por s de JOGO
    var _cadTela = Math.min(_cadJogo * _vel, CAD_MAX);   // ... e de tela, com teto
    var _dfase = Math.PI * _cadTela * _dtP;
    if (d.vms > 0.12) {
      d.gait += _dfase;
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
    /* §OS-220 · O ATLETA PASSA A OLHAR PARA A BOLA.
       `face` so vinha do deslocamento LATERAL: um jogador parado, ou correndo
       para frente, ficava virado para o lado em que andou por ultimo — de
       costas para o jogo, com frequencia. E o detalhe que mais separa "onze
       bonecos se deslocando" de "um time jogando": no futebol todo mundo
       olha a bola, o tempo todo, tenha ela ou nao.
       Quem corre de verdade continua virado para onde corre (o corpo lidera a
       corrida); quem esta parado ou trotando vira para a bola. O portador nao
       entra: ele olha para onde conduz. */
    if (o.ballX != null && !o.hasBall && d.vms < 3.2) {
      const _db = o.ballX - x;
      if (Math.abs(_db) > r * .35) d.face = _db >= 0 ? 1 : -1;
    }
    d.lean = lean; d.x = x; d.y = y;
    const face = d.face || 1;
    // R14 · a máquina de estados (Fase 3) manda quando existe: ela é dirigida
    // pelo CONTRATO do motor, então a fase de contato cai no tick em que a bola
    // sai. O caminho antigo (o.pose/o.act/o.wave) fica como queda para builds
    // sem a camada de animação.
    const A = (root.__CDS_ANIM_BY_KEY && root.__CDS_ANIM_BY_KEY[o.key]) || null;
    const st = A ? A.state : '';
    /* §D45 · O MERGULHO DA MAQUINA DE ESTADOS NAO ERA DESENHADO COMO MERGULHO.
       `o.divePose` vem de `activeMotion` — o caminho LEGADO de poses. Quando a
       maquina da R14 entra em `gk_low_dive`/`gk_high_dive` sem que o caminho
       antigo tenha agendado um `dive`, o goleiro voava de pe. */
    const mergulho = o.divePose || (A && /^gk_(low|high)_dive$/.test(st));
    const _ondaCrua = mergulho ? 0 : (A ? animWave(st, A.phase) : (o.wave || 0));
    /* §OS-235 · a mistura roda UMA vez por atleta por quadro, aqui, porque
       ela avanca o relogio da transicao; `P` la embaixo so le o resultado. */
    const _poseMix = misturarPose(d, st, _ondaCrua, _dtP);
    const w = (typeof d.__ondaAtual === 'number') ? d.__ondaAtual : _ondaCrua;
    const act = o.act || '', pose = o.pose || '';
    /* §D48 · as variantes entram no ramo de CHUTE do desenho: sem isto elas
       cairiam na modulacao de corrida e o atleta "bateria" correndo. */
    const kicking = A ? /^(pass|shot)_(prepare|contact|followthrough)$|^cross$|^(power_shot|placed_shot|volley|long_pass|first_touch_pass)$/.test(st)
                      : ((pose === 'kick' || act === 'shoot') && w > 0.02);
    const tackling = A ? /tackle$/.test(st) : (pose === 'tackle' && w > 0.02);
    const heading = A ? (st === 'header') : (pose === 'jump' && w > 0.02);
    /* o goleiro que sobe para encaixar cruzamento tambem sai do chao; a
       variavel `gkClaim` completa so nasce mais abaixo, entao aqui basta o
       teste de ESTADO, que e o que decide o salto. */
    const gkClaimPre = !!(o.isGK && A && /^gk_(catch|punch|high_dive)$/.test(st));
    /* §D39/§D42 · a interceptacao TINHA aqui uma bandeira propria que so mexia
       no `bob` — 0,07·r de deslocamento vertical do boneco inteiro. A sonda de
       silhueta mostrou que os membros nao se moviam e o gesto lia como corrida.
       Agora ela sai da tabela POSE, com perna estendida na linha do passe. */
    const dribbling = A ? /^(carry|dribble_|body_feint|inside_cut|outside_cut|burst_touch)/.test(st)
                        : (act === 'dribble' && !kicking && !tackling);
    /* OS-60 · os quatro estados de drible caiam no mesmo desenho. Agora cada um
       tem pose propria, dirigida pela FASE do controlador. */
    const dphase = A ? clamp(A.phase || 0, 0, 1) : 0;
    /* §OS-241 · QUEM SOFRE FALTA CAI. Ate aqui `fouled` era `agacha 0,30` e
       `inc -0,34`: quatro pixels de agachamento e 19 graus de tronco. Isso e
       cambalear, nao levar falta. O gesto principal da falta -- o unico que se
       olha no momento em que o juiz apita -- praticamente nao existia, e e por
       isso que "a falta nao me agrada nada".
       Agora o corpo GIRA para perto da horizontal e DESCE ate o gramado, e o
       `get_up` desfaz o mesmo caminho. A mecanica ja existia no jogo: e a
       mesma do mergulho do goleiro (`ctx.rotate`), que sempre leu bem. */
    const caindo = !!(A && (st === 'fouled' || st === 'get_up'));
    const _kQueda = !caindo ? 0
                  : (st === 'fouled' ? Math.min(1, dphase / 0.45)
                                     : Math.max(0, 1 - dphase / 0.72));
    const feint  = A && st === 'body_feint';
    const cutting= A && (st === 'inside_cut' || st === 'outside_cut');
    /* §D43 · os dois cortes desenhavam IDENTICOS: `cutting` nao olhava para
       qual dos dois era. Agora o peso vai para o lado oposto conforme o corte,
       que e a unica coisa que distingue um do outro. */
    const cutLado = (st === 'outside_cut') ? -1 : 1;
    const bursting = A && st === 'burst_touch';
    const blocking = A ? (st === 'block') : false;
    /* §D41 · A AMPLITUDE TAMBEM DEPENDIA DO BOTAO DE VELOCIDADE.
       `d.spd` e o deslocamento de TELA suavizado, entao ele triplica em 3X: a
       mesma corrida saia com perna de 0,31 de amplitude em 1X (o jogador
       miudava com as pernas quase fechadas) e 0,87 em 3X. Medido:
       mv = 0,470 px/quadro em 1X contra 1,309 em 3X, o mesmo atleta a ~3,5 m/s.
       Agora vem de `d.vms`, que e a velocidade FISICA em m/s: 4,2 m/s abre a
       perna por inteiro, em qualquer velocidade de exibicao. */
    const amp = (mergulho || kicking || tackling) ? 0
              : clamp(d.vms / 4.2, 0, 1) * (bursting ? 1.35 : 1);   // 0 parado … 1 correndo
    const sw = Math.sin(d.gait) * amp;                  // -1..1 alterna as pernas
    /* §D42 · a postura do estado modula a corrida em vez de substitui-la */
    const P = _poseMix;   /* §OS-235 · silhueta misturada, nunca mais o degrau */
    const swL = P ? sw * P.esc : sw;                    // tesoura das pernas
    /* §OS-215 · o braco vinha com a MESMA amplitude da perna vezes `P.braco`,
       que chega a 1,7 -- ou seja, mais que a perna. No futebol o braco
       acompanha, nao lidera. 0,62 e o fator que o poe abaixo da perna sem
       apagar o balanco, que e o que da vida ao boneco parado. */
    const swB = (P ? sw * P.braco : sw) * 0.62;        // balanco dos bracos
    /* OS-58 · a subida do corpo a cada passada era quase imperceptivel. */
    /* §D38 · 0,09·r nao se lia. O corpo sobe DUAS vezes por ciclo (uma por
       perna de apoio), que e o que da a leitura de passo em vez de deslize. */
    /* §OS-240 · O CABECEIO NAO TINHA PULO.
       RELATO do dono: "o pulo do jogador ta estranho tambem".

       Estava estranho porque nao existia. O estado `header` mexia em tres
       coisas -- bracos ao alto, cabeca empurrada para a frente e cabeca subindo
       0,10 r -- e em nenhuma delas o CORPO saia do chao. O atleta cabeceava
       plantado, e as pernas seguiam no ciclo de corrida porque `heading` nunca
       entrou na cadeia de pernas.

       Um cabeceio e um salto: o corpo sobe, as pernas RECOLHEM debaixo dele e
       ele volta. Sem a subida, o gesto e so um boneco levantando o braco.

       `Math.sin(fase * PI)` da a subida e a descida numa expressao so, e o pico
       cai na mesma fase em que a onda do gesto vale 1 -- que e o quadro em que
       a bola sai. O goleiro que sai para encaixar cruzamento sobe junto, pelo
       mesmo motivo. */
    const _pulo = heading ? r * .62 * Math.sin(dphase * Math.PI)
                : (gkClaimPre ? r * .46 * Math.sin(dphase * Math.PI) : 0);
    const bob = Math.abs(swL) * r * .16 - (tackling ? r * .16 : 0) + (dribbling ? r * .10 : 0)
              - (P ? r * P.agacha : 0)             /* §D42 · o agachamento do estado */
              - (blocking ? r * .12 * Math.sin(dphase * Math.PI) : 0)   /* OS-60 · agacha no bloqueio */
              + _pulo                              /* §OS-240 · o salto do cabeceio */
              - r * .46 * _kQueda;                 /* §OS-241 · o corpo vai ao chao */

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
    const _vig = (mergulho || spinning) ? 0 : Math.max(0, Math.min(1, d.vms / 4.2));
    let _rotTot = 0;
    ctx.save();
    ctx.translate(x, y - bob - (spinning ? r * .16 * Math.sin(spinTh / 2) : 0));
    /* §D42 · o portao era so `_vig > .02` (velocidade de tela). Postura parada —
       `jockey`, `protect`, `receive_*` — acontece justamente com pouca
       velocidade: sem abrir o portao para ela, a inclinacao do estado nunca
       chegava a ser aplicada. */
    if (!mergulho && !spinning && (_vig > .02 || (P && P.inc !== 0))) {
      /* OS-60 · corte joga o peso para fora antes de sair para dentro;
         arrancada projeta o tronco a frente. */
      const _extra = cutting  ? -face * cutLado * .30 * Math.sin(dphase * Math.PI)
                   : bursting ?  face * .26 * Math.min(1, dphase * 2.4)
                   : 0;
      /* §D42 · a inclinacao da postura e do estado, e olha para onde o atleta
         encara: recuar de frente para a bola tem que ler diferente de correr */
      /* §D46 · COM TETO. A rotacao gira o boneco INTEIRO em torno do ponto de
         chao, entao a cabeca — que fica a 0,82·r de altura — descreve um arco:
         a 0,60 rad ela desloca 0,46·r, mais que a meia-largura do tronco
         (0,56·r), e o atleta le como "caindo" em vez de "inclinado". Visto na
         folha de poses em `accelerate` e `press`, que juntos sao dois dos
         estados mais frequentes do jogo. */
      _rotTot = clamp(_cos * _vig * 0.20 + _extra + (P ? face * P.inc : 0), -0.34, 0.34);
      ctx.rotate(_rotTot);
      const _sq = 1 - Math.abs(_sin) * _vig * 0.22;
      ctx.scale(_sq < .5 ? .5 : _sq, 1);
    }
    if (caindo && _kQueda > 0.01) ctx.rotate(face * 1.12 * _kQueda);  /* §OS-241 */
    if (mergulho) ctx.rotate(Math.PI / 2);
    else if (spinning) {
      const _c = Math.cos(spinTh);
      ctx.scale(Math.abs(_c) < .16 ? (_c < 0 ? -.16 : .16) : _c, 1);
    }

    // ── PERNAS conforme a ação
    ctx.fillStyle = '#17202e';
    if (kicking) {
      /* §D48 · o VOLEIO e a bola no ar: a perna sobe muito mais que num chute
         de chao, e e so isso que o separa visualmente. `alto` tambem serve ao
         chute de forca, que projeta mais a perna que a cavadinha. */
      const alto = (st === 'volley') ? r * .46 : (st === 'power_shot') ? r * .16 : 0;
      const forca = (st === 'power_shot') ? 1.35 : (st === 'placed_shot') ? 0.78 : 1;
      if (_articulado()) {
        /* §OS-237 · O CHUTE VIRA PENDULO, e nao dois blocos que trocam de Y.
           A perna de chute vem de TRAS (angulo negativo, joelho dobrado) e
           varre para a FRENTE ate estender no contato -- que e onde `w` vale 1.
           A dobra do joelho e maxima na preparacao e ZERA no impacto: e assim
           que uma perna bate numa bola, e e o que separa o chute de forca
           (`forca` 1,35, varredura maior) da cavadinha (0,78).
           O voleio sobe o quadril de saida, entao o pe encontra a bola no ar. */
        const _C = _corpo();
        const varrer = 1.25 * forca;
        const angChute = (-0.55 + w * varrer) * face;
        const dobraChute = (1 - w) * 1.15;
        const subir = (w * alto) / Math.max(1e-3, r);
        const hy = r * (_C.quadrilY - subir * 0.5), hx = r * _C.quadrilX;
        _perna(ctx, -hx * face, r * _C.quadrilY, -0.16 * face, 0.30, r, '#17202e', '#0b0f16', face);
        _perna(ctx,  hx * face, hy, angChute, dobraChute, r, '#17202e', '#0b0f16', face);
      } else {
        const back = -face * r * .28, front = face * (r * .06 + w * r * .52 * forca);
        ctx.fillRect(back - r * .13, r * .40, r * .26, r * .46);                  // apoio
        ctx.fillRect(front - r * .13, r * .40 - w * r * .12 - w * alto, r * .26, r * .46);   // perna de chute
        ctx.fillStyle = '#0b0f16';
        ctx.fillRect(back - r * .15, r * .78, r * .30, r * .20);
        ctx.fillRect(front - r * .15, r * .78 - w * r * .12 - w * alto, r * .30, r * .20);
      }
    } else if (blocking) {
      /* OS-60 · MEDIDO: o estado de bloqueio desenhava exatamente igual ao de
         corrida — tinha 100% de cobertura de evento e nenhuma pose. Agora o
         atleta se joga na frente: base larga, corpo baixo, perna estendida na
         linha da bola. */
      const _bw = Math.sin(dphase * Math.PI);
      if (_articulado()) {
        /* §OS-237 · o bloqueio abre a base pelo ANGULO do quadril, com joelho
           dobrado nos dois lados -- corpo baixo e pernas em V, que e a postura
           de quem se poe na frente da bola. */
        const _C = _corpo();
        const abre = 0.42 + _bw * 0.34;
        const hy = r * (_C.quadrilY + _bw * 0.10);
        _perna(ctx, -r * _C.quadrilX, hy, -abre, 0.55, r, '#17202e', '#0b0f16', face);
        _perna(ctx,  r * _C.quadrilX, hy,  abre, 0.55, r, '#17202e', '#0b0f16', face);
      } else {
        ctx.fillRect(-r * .46 - _bw * r * .22, r * .46, r * .28, r * .44);
        ctx.fillRect(r * .18 + _bw * r * .22, r * .46, r * .28, r * .44);
        ctx.fillStyle = '#0b0f16';
        ctx.fillRect(-r * .50 - _bw * r * .22, r * .84, r * .32, r * .20);
        ctx.fillRect(r * .16 + _bw * r * .22, r * .84, r * .32, r * .20);
      }
    } else if (caindo && _kQueda > 0.05) {
      /* §OS-241 · no chao as pernas ficam dobradas e abertas, nao em passada */
      const _Cq = _corpo();
      const hyq = r * _Cq.quadrilY;
      _perna(ctx, -r * _Cq.quadrilX, hyq, (-0.55 - _kQueda * 0.35) * face, 0.85, r, '#17202e', '#0b0f16', face);
      _perna(ctx,  r * _Cq.quadrilX, hyq, ( 0.30 + _kQueda * 0.55) * face, 0.55, r, '#17202e', '#0b0f16', face);
    } else if (heading) {
      /* §OS-240 · no ar as pernas nao correm: recolhem. A da frente sobe mais,
         que e a leitura de quem se impulsiona para cabecear. */
      const _C = _corpo(), _s = Math.sin(dphase * Math.PI);
      const hy = r * (_C.quadrilY - _s * .06);
      _perna(ctx, -r * _C.quadrilX, hy, (-0.30 - _s * 0.35) * face, 0.70 + _s * 0.55, r, '#17202e', '#0b0f16', face);
      _perna(ctx,  r * _C.quadrilX, hy, ( 0.22 + _s * 0.30) * face, 0.45 + _s * 0.85, r, '#17202e', '#0b0f16', face);
    } else if (tackling) {
      if (_articulado()) {
        /* §OS-237 · O CARRINHO. A perna de ataque vai quase a HORIZONTAL --
           1,45 rad no pico -- e a de tras dobra sob o corpo, que e a leitura de
           quem se joga no chao. Antes eram dois retangulos deitados, sem
           angulo: o gesto lia como "agachou", nao como "se jogou".
           O quadril tambem desce com `w`, senao o atleta desliza de pe. */
        const _C = _corpo();
        const angAtaque = (0.55 + w * 0.90) * face;
        const angTras = (-0.30 - w * 0.25) * face;
        const hy = r * (_C.quadrilY + w * 0.22);
        _perna(ctx, -r * _C.quadrilX * face, hy, angTras, 1.05, r, '#17202e', '#0b0f16', face);
        _perna(ctx,  r * _C.quadrilX * face, hy, angAtaque, Math.max(0, .35 - w * .35), r, '#17202e', '#0b0f16', face);
      } else {
        const front = face * (r * .22 + w * r * .60);
        ctx.fillRect(-face * r * .06 - r * .13, r * .50, r * .26, r * .40);       // dobrada sob o corpo
        ctx.fillRect(Math.min(front, front) - r * .20, r * .62, r * .46, r * .22);// estendida no deslize
        ctx.fillStyle = '#0b0f16';
        ctx.fillRect(front + face * r * .20 - r * .14, r * .62, r * .28, r * .20);
      }
    } else {
      /* OS-58 · a passada movia a perna SO em Y, por r*.20 — com r ~ 30 px sao
         6 px de diferenca entre as duas pernas, quase nada. Agora ha TESOURA:
         uma perna vai a frente e a outra atras, e a amplitude vertical sobe. */
      const llY = r * .40 - Math.max(0, swL) * r * .30;
      const rlY = r * .40 - Math.max(0, -swL) * r * .30;
      const spr = (dribbling ? r * .06 : 0)
                + (cutting ? r * .22 * Math.sin(dphase * Math.PI) : 0)            // OS-60 · corte planta e abre
                + (P ? r * P.spr : 0);                                            // §D42 · base da postura
      /* §D42 · `estica` poe UMA perna a frente, na direcao que o atleta encara.
         E o que separa alcancar de correr: interceptar, dominar e tocar longo
         sao gestos de alcance, e sem isto os tres saiam com passada normal. */
      let ext = P ? face * r * P.estica * (P.estica > .3 ? (0.35 + 0.65 * Math.sin(Math.max(0, Math.min(1, dphase)) * Math.PI)) : 1) : 0;
      /* §OS-221 · O PE PASSA A ENCOSTAR NA BOLA.
         O gesto de chute e de passe ja existia e ja caia no quadro certo -- a
         Fase 3 alinha o contato com a saida da bola. O que faltava era o
         ALCANCE: a perna esticava por um valor FIXO da tabela POSE, na direcao
         em que o atleta encara, sem nenhuma relacao com onde a bola esta. Num
         jogo em que o corpo ja olha para ela (OS-220), o pe passar longe e o
         que ainda le como "a bola saiu sozinha".
         Agora, no instante do contato, a perna estende ATE a bola -- limitada
         ao alcance de uma perna, porque esticar mais seria borracha. Fora do
         contato nada muda. */
      if (kicking && o.ballX != null) {
        const _db = o.ballX - x;                        // px de tela ate a bola
        const _alc = r * 1.15;                          // alcance de uma perna
        const _mira = Math.max(-_alc, Math.min(_alc, _db));
        /* no pico do gesto o pe esta na bola; nas bordas ele volta ao normal */
        const _pico = Math.sin(Math.max(0, Math.min(1, dphase)) * Math.PI);
        ext = ext * (1 - _pico) + _mira * _pico;
      }
      if (_articulado()) {
        /* §OS-237 · A PASSADA VIRA ANGULO, que e como o olho le corrida.
           `swL` ja e a tesoura -1..1 vinda da fase e da amplitude; aqui ela
           deixa de empurrar retangulos em Y e passa a ABRIR a coxa. A dobra do
           joelho cresce na perna que vai para TRAS -- calcanhar subindo -- e
           some na que estende a frente, que e a assimetria que separa correr
           de marchar. `ext` (alcance) entra como angulo extra na perna da
           frente, com teto, em vez de translacao. */
        const ABRE = 0.62;
        const angF =  swL * ABRE * face;      // perna que vai a frente
        const angT = -swL * ABRE * face;      // ... e a que vai atras
        const dobraF = Math.max(0, -swL) * 0.90;
        const dobraT = Math.max(0,  swL) * 0.90;
        const extAng = Math.max(-0.75, Math.min(0.75, ext / Math.max(1e-3, r * 0.60)));
        const _C = _corpo();
        const hy = r * _C.quadrilY, hx = r * _C.quadrilX + spr * 0.6;
        _perna(ctx, -hx, hy, angT, dobraT * face * face, r, '#17202e', '#0b0f16', face);
        _perna(ctx,  hx, hy, angF + extAng, dobraF, r, '#17202e', '#0b0f16', face);
      } else {
        const lsx = swL * r * .20 * face, rsx = -swL * r * .20 * face;
        ctx.fillRect(-r * .34 - spr + lsx, llY, r * .26, r * .46);
        ctx.fillRect(r * .08 + spr + rsx + ext, rlY, r * .26, r * .46);
        ctx.fillStyle = '#0b0f16';
        ctx.fillRect(-r * .36 - spr + lsx, llY + r * .38, r * .30, r * .22);
        ctx.fillRect(r * .06 + spr + rsx + ext, rlY + r * .38, r * .30, r * .22);
      }
    }
    // shorts
    ctx.fillStyle = dark;
    const _Cs = _corpo();
    rr(ctx, -r * _Cs.shortsX, r * _Cs.shortsY, r * _Cs.shortsX * 2, r * _Cs.shortsAlt, r * .1); ctx.fill();
    // TORSO (camisa) — leve inclinação à frente no drible; recuo no chute
    /* OS-60 · na finta o TRONCO vai para um lado e volta — e o corpo enganando.
       Nos outros dribles fica o deslocamento leve de sempre. */
    const tl = (dribbling ? face * r * .06 : 0) + (kicking ? -face * r * .05 : 0)
             + (feint ? Math.sin(dphase * Math.PI * 2) * r * .34 * face : 0);
    ctx.save(); ctx.translate(tl, 0);
    const _Ct = _corpo();
    ctx.fillStyle = torsoGrad(ctx, jersey, lite, dark, r);
    rr(ctx, -r * _Ct.torsoX, r * _Ct.torsoTopo, r * _Ct.torsoX * 2, r * _Ct.torsoAlt, r * _Ct.torsoRaio); ctx.fill();
    ctx.lineWidth = o.hasBall ? 2 : 1;
    ctx.strokeStyle = o.hasBall ? '#ffffff' : 'rgba(255,255,255,.34)';
    rr(ctx, -r * _Ct.torsoX, r * _Ct.torsoTopo, r * _Ct.torsoX * 2, r * _Ct.torsoAlt, r * _Ct.torsoRaio); ctx.stroke();
    ctx.restore();
    // MANGAS/braços — GOLEIRO tem prontidão/encaixe + LUVAS (ATL-032); linha de campo
    // ergue no cabeceio e abre no chute (equilíbrio).
    const gk = o.isGK;
    /* §D45 · os bracos ao alto do goleiro so respondiam ao caminho legado
       (`o.pose`). Encaixe, soco e mergulho alto sao ESTADOS da R14 ha muito
       tempo e nenhum deles levantava o braco. */
    const gkClaim = gk && ((pose === 'claim' || pose === 'jump') && w > 0.02
                           || /^gk_(catch|punch|high_dive)$/.test(st));
    ctx.fillStyle = jersey;
    if (gkClaim) {                                       // goleiro no ENCAIXE: braços ao alto
      const up = r * (.72 + w * .36);
      rr(ctx, -r * .48, -up, r * .24, r * .58, r * .09); ctx.fill();
      rr(ctx, r * .24, -up, r * .24, r * .58, r * .09); ctx.fill();
    } else if (gk) {                                     // goleiro: braços pela POSTURA
      /* §D45 · era uma unica pose de "prontidao" para os 13 estados. */
      const _gl = r * ((P && P.gl) || 0), _gr = r * ((P && P.gr) || 0), _gx = r * ((P && P.gx) || 0);
      rr(ctx, -r * .94 - _gx, -r * .36 + _gl, r * .24, r * .52, r * .09); ctx.fill();
      rr(ctx, r * .70 + _gx, -r * .36 + _gr, r * .24, r * .52, r * .09); ctx.fill();
    } else if (heading) {
      if (_articulado()) {
        /* §OS-240 · os bracos do cabeceio eram duas barras SOLTAS ao lado do
           corpo: nasciam num x fixo, sem nenhuma ligacao com o ombro, entao
           flutuavam. Agora saem do ombro e abrem para cima, que e o que um
           corpo faz para se equilibrar no ar. */
        const _Ca = _corpo(), _s = Math.sin(dphase * Math.PI);
        const sy = r * _Ca.ombroY, sx = r * _Ca.ombroX;
        const sobe = Math.PI - 0.30 - _s * 0.32;
        _braco(ctx, -sx, sy, -sobe, -0.35, r, jersey, null);
        _braco(ctx,  sx, sy,  sobe,  0.35, r, jersey, null);
      } else {
        rr(ctx, -r * .88, -r * .74 - w * r * .32, r * .24, r * .52, r * .09); ctx.fill();
        rr(ctx, r * .64, -r * .74 - w * r * .32, r * .24, r * .52, r * .09); ctx.fill();
      }
    } else if (kicking) {
      if (_articulado()) {
        /* §OS-237 · no chute o braco contrario a perna vai a frente e o outro
           atras -- e o contrapeso que todo chute tem, e ele nasce do ombro. */
        const _Ck = _corpo();
        const sy = r * _Ck.ombroY, sx = r * _Ck.ombroX;
        const abre = 0.55 + w * 0.55;
        _braco(ctx, -sx, sy, -abre * face - 0.10, 0.30, r, jersey, null);
        _braco(ctx,  sx, sy,  abre * face - 0.10, 0.30, r, jersey, null);
      } else {
        rr(ctx, -r * .86 - face * w * r * .12, -r * .46, r * .24, r * .56, r * .09); ctx.fill();
        rr(ctx, r * .62 - face * w * r * .12, -r * .46, r * .24, r * .56, r * .09); ctx.fill();
      }
    } else {
      /* OS-58 · os bracos eram dois retangulos FIXOS, sem nenhuma dependencia
         da passada. Braco parado e o que mais denuncia "boneco deslizando".
         Agora balancam em contrafase com a perna, em Y e em X. */
      /* §D42 · `braco` acima de 1 abre os bracos para fora alem de balancar:
         proteger a bola, marcar de lado e perder o controle sao gestos de
         BRACO, e com o balanco puro os tres liam como corrida. */
      /* §D44 · O BALANCO GRANDE ESTAVA NO EIXO ERRADO.
         Era `abY = -sw*r*.26` (vertical) contra `abX = -sw*r*.10` (no eixo da
         corrida): o componente GRANDE subia e descia. Braco humano nao sobe e
         desce ao correr — ele vai e volta ao longo do corpo, e o pouco de
         vertical que aparece e consequencia. Com o peso invertido o boneco
         abanava, e abanava em contrafase com a perna, que e o que da a leitura
         de brinquedo.

         Agora o curso principal e no eixo do deslocamento (`face`), com um
         terco do vertical de antes, e a amplitude total cai — os bracos
         acompanham a passada em vez de disputar com ela. */
      const abY = -swB * r * .08, abX = swB * r * .17 * face;
      const abrir = P ? r * .12 * Math.max(0, P.braco - 1) : 0;
      if (_articulado()) {
        /* §OS-237 · o braco tambem passa a ter cotovelo, em contrafase com a
           perna. A dobra cresce quando ele vem para a FRENTE (o antebraco sobe),
           ao contrario do joelho -- e essa inversao e o que faz o par
           braco/perna ler como humano em vez de pendulo duplo.
           `P.braco > 1` continua ABRINDO o braco do corpo, que e o que
           distingue proteger a bola e marcar de lado da corrida. */
        const BAL = 0.44;
        const angE = -swB * BAL * face - (abrir / r) * 1.5;
        const angD =  swB * BAL * face + (abrir / r) * 1.5;
        const _Cb = _corpo();
        const sy = r * _Cb.ombroY, sx = r * _Cb.ombroX;
        _braco(ctx, -sx + tl, sy, angE, Math.max(0, -swB * face) * 0.48, r, jersey, null);
        _braco(ctx,  sx + tl, sy, angD, Math.max(0,  swB * face) * 0.48, r, jersey, null);
      } else {
        rr(ctx, -r * .8 + tl + abX - abrir, -r * .46 + abY, r * .26, r * .58, r * .09); ctx.fill();
        rr(ctx, r * .54 + tl - abX + abrir, -r * .46 - abY, r * .26, r * .58, r * .09); ctx.fill();
      }
    }
    if (gk) {                                            // LUVAS do goleiro nas pontas dos braços
      ctx.fillStyle = '#eef3ff';
      if (gkClaim) {
        const up = r * (.72 + w * .36);
        ctx.beginPath(); ctx.arc(-r * .36, -up - r * .02, r * .19, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * .36, -up - r * .02, r * .19, 0, TAU); ctx.fill();
      } else {
        /* §D45 · a luva ficava num ponto FIXO enquanto o braco se movia: com a
           postura ligada, a mao descolava do braco. */
        const _gl = r * ((P && P.gl) || 0), _gr = r * ((P && P.gr) || 0), _gx = r * ((P && P.gx) || 0);
        ctx.beginPath(); ctx.arc(-r * .82 - _gx, r * .16 + _gl, r * .18, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * .82 + _gx, r * .16 + _gr, r * .18, 0, TAU); ctx.fill();
      }
    }
    // CABEÇA + cabelo — inclina à frente no cabeceio/drible
    /* §D46 · a cabeca desfaz PARTE do arco da inclinacao. Compensar tudo
       deixaria o pescoco rigido e mataria a leitura do gesto; 62% mantem a
       cabeca sobre o quadril e ainda deixa o tronco projetado a frente. */
    const hx = lean * .4 + tl + (heading ? face * r * .26 : 0) + (dribbling ? face * r * .10 : 0)
             /* §OS-241 · a compensacao de pescoco existe para a INCLINACAO da
                corrida; com o corpo deitado ela arranca a cabeca do tronco.
                Some junto com a queda. */
             - _rotTot * r * .62 * (1 - _kQueda);
    const _Ch = _corpo();
    const hy = r * _Ch.cabecaY + (heading ? w * r * .10 : 0);
    ctx.beginPath(); ctx.arc(hx, hy, r * _Ch.cabecaR, 0, TAU);
    ctx.fillStyle = '#e9b98b'; ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy - r * _Ch.cabecaR * .18, r * _Ch.cabecaR * .91, Math.PI, TAU);
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
    /* §OS-220 · estado persistente da bola entre quadros: rotacao acumulada,
       ultima posicao e o quique. Declarado no TOPO porque tanto o giro quanto
       o achatamento o consultam, e o achatamento e desenhado ANTES. */
    if (!ball._est) ball._est = { rot: 0, x: null, y: null, zAnt: null, quique: 0, forca: 1, pxAnt: 0, pyAnt: 0,
                                 zDes: null, taxa: 0, tAlt: 0 };
    const _e = ball._est;

    /* §OS-239 · A BOLA NAO CAI: ELA SOME.
       ---------------------------------------------------------------------
       RELATO: "a animacao da bola ainda nao me agrada", "a pingada da bola nao
       me agrada".

       O quique esta CERTO -- o traco bruto mostra a bola caindo de 5,97 m,
       tocando a 0,09 e subindo a 1,755 m, que e exatamente restituicao 0,55
       sobre os -10,5 m/s de chegada. O defeito e outro, e a sonda
       `salto-da-bola.js` o isola:

           212 saltos de altura por partida alem do que a gravidade permite
           31 de 157 registrados passam de 0,5 m
           e o padrao e sempre o mesmo: 0,7 a 2,6 m  ->  ZERO, em um quadro

       As causas sao administrativas -- alguem domina a bola, a viagem termina,
       a posse muda -- e todas fazem sentido para o MOTOR: ele precisa por a
       bola no pe de quem a tem. O que nao pode e isso vazar para a TELA. Um
       metro e meio de bola desaparecendo num quadro le como falha de desenho,
       varias vezes por partida.

       E o mesmo raciocinio da OS-208 para o corpo do atleta: o motor recoloca
       a ficha, o desenho PERSEGUE. Aqui a perseguicao tem teto de velocidade
       de queda, entao a bola desce depressa e visivelmente em vez de sumir.

       O teto nao pode atrapalhar a fisica de verdade: um chute descendo a
       25 m/s tem de continuar descendo a 25. Por isso a taxa permitida sai de
       uma media movel da PROPRIA queda observada, que rejeita o quadro do
       salto como outlier -- e nunca fica abaixo de um piso generoso. */
    const _agoraB = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let _dtB = _e.tAlt ? (_agoraB - _e.tAlt) / 1000 : 1 / 60;
    if (!(_dtB > 0) || _dtB > 0.25) _dtB = 1 / 60;
    _e.tAlt = _agoraB;
    const _zFis = Math.max(0, o.z || 0);
    if (_e.zDes == null) _e.zDes = _zFis;
    const _caiu = Math.max(0, (_e.zAnt == null ? 0 : _e.zAnt) - _zFis);
    /* media movel que so aceita quedas plausiveis: o quadro do teleporte tem
       queda muito acima da media e nao entra na conta */
    if (_caiu <= _e.taxa * 1.6 + 0.05) _e.taxa = _e.taxa * 0.72 + _caiu * 0.28;
    const _tetoQueda = Math.max(_e.taxa * 1.7 + 0.03, 12 * _dtB);
    const _tetoSubida = Math.max(_e.taxa * 1.7 + 0.03, 14 * _dtB);
    if (_zFis >= _e.zDes) _e.zDes = Math.min(_zFis, _e.zDes + _tetoSubida);
    else _e.zDes = Math.max(_zFis, _e.zDes - _tetoQueda);
    if (Math.abs(_e.zDes - _zFis) < 0.02) _e.zDes = _zFis;
    /* `CDS_ZSUAVE = false` devolve o comportamento antigo, para a sonda medir
       antes e depois na MESMA partida */
    if (root.CDS_ZSUAVE === false) _e.zDes = _zFis;

    /* §OS-245 · A BOLA TAMBEM TELEPORTA NO PLANO, E NINGUEM TINHA MEDIDO.
       ---------------------------------------------------------------------
       RELATO: "sem teletransporte da bola, sem bug na hora do passe".

       O passe esta limpo -- medido, a bola sai a 0,54 m do pe de quem bateu,
       maximo 1,61 m, e salta 0,33 m no quadro em que parte. A fisica do passe
       nao tem defeito.

       O que tem e o DESENHO. A interpolacao da OS-227 tem um portao:
       `if (deslocamento < 12 m)`. Acima disso ela e PULADA -- e e exatamente o
       caso da bola recolocada para escanteio, lateral ou tiro de meta. O
       desenho recebe o salto inteiro num quadro:

           saltos desenhados > 18 px   179 por partida
           saltos desenhados > 60 px    60 por partida
           pico 501 px, num canvas de 1024

       A 9,75 px/m sao pulos de 7 a 48 metros, sessenta vezes por partida. E a
       2,00 de zoom cada um vale o dobro em tela.

       O corpo do atleta ganhou teto de passo na OS-208 e a ALTURA da bola na
       OS-239. Faltava o plano. Mesma forma: o desenho persegue a fisica com
       teto de velocidade, e o teto sai de uma media movel do proprio
       deslocamento observado -- que rejeita o quadro do salto como outlier --,
       nunca abaixo de um piso generoso.

       ACIMA DE `CORTE` NAO SE ANIMA. Uma bola que atravessa o campo inteiro
       nao pode "voar" ate la: isso inventaria um lance que nao houve. Ali o
       corte e honesto, exatamente como a R18.99 decidiu para o atleta. */
    if (_e.xDes == null) { _e.xDes = o.gx; _e.yDes = o.gy; _e.taxaXY = 0; }
    const _dxF = o.gx - _e.xDes, _dyF = o.gy - _e.yDes;
    const _dF = Math.hypot(_dxF, _dyF);
    const CORTE = 300;                       // px de canvas ~ 30 m: recolocacao
    const PISO  = 20 * (_dtB * 60);          // px por quadro ~ 2 m
    const _andou = Math.hypot(o.gx - (_e.gxAnt == null ? o.gx : _e.gxAnt),
                              o.gy - (_e.gyAnt == null ? o.gy : _e.gyAnt));
    if (_andou <= _e.taxaXY * 1.8 + 3) _e.taxaXY = _e.taxaXY * 0.75 + _andou * 0.25;
    _e.gxAnt = o.gx; _e.gyAnt = o.gy;
    if (root.CDS_XYSUAVE === false || _dF >= CORTE || _dF < 0.01) {
      _e.xDes = o.gx; _e.yDes = o.gy;
    } else {
      const _teto = Math.max(_e.taxaXY * 1.8 + 3, PISO);
      if (_dF <= _teto) { _e.xDes = o.gx; _e.yDes = o.gy; }
      else { _e.xDes += _dxF / _dF * _teto; _e.yDes += _dyF / _dF * _teto; }
    }
    o = Object.assign({}, o, { z: _e.zDes, gx: _e.xDes, gy: _e.yDes });

    const g0 = project(o.gx, o.gy);
    /* §OS-236 · `air` governa tamanho da bola e encolhimento da sombra, as
       duas pistas de altura que sobram quando o olho perde a referencia.
       Saturando em 3,2 m elas congelavam na metade de baixo do voo de um
       lancamento: a bola subia mais 4 m sem crescer nem clarear a sombra.
       O teto acompanha a faixa fiel. */
    const s = g0.s, z = o.z || 0, air = clamp(z / 8.0, 0, 1);
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
      /* §OS-220 · o anel de queda perde o segundo circulo e o amarelo forte:
         ele diz onde a bola vai cair, e para isso basta uma marca discreta no
         gramado. Dois aneis pulsando em amarelo saturado competiam com o
         lance. */
      ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.4 * t.s;
      ctx.beginPath(); ctx.ellipse(t.x, groundY(t.y, t.s), 8.5 * pulse * t.s, 3.9 * pulse * t.s, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // sombra ancorada no gramado
    ctx.save();
    ctx.globalAlpha = .32 - air * .14;
    ctx.beginPath(); ctx.ellipse(bx, gy + 2 * s, (5.6 - air * 1.8) * s, (2.6 - air * .9) * s, 0, 0, TAU);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    /* §OS-220 · O FIO BOLA-SOMBRA SAIU. Ele era uma muleta de leitura de
       altura, de quando a sombra mal reagia ao z. Hoje a sombra ja encolhe e
       clareia com a altura, e o arco de verdade (OS-219) faz o resto. Uma
       linha tracejada amarela ligando bola e sombra le como overlay de
       depuracao, nao como futebol. */

    // halo de leitura
    ctx.save();
    const halo = ctx.createRadialGradient(bx, by, 0, bx, by, 13 * s);
    /* §OS-220 · halo de leitura mais discreto: ele existe para o olho ACHAR a
       bola no meio de 22 corpos, nao para brilhar. */
    halo.addColorStop(0, 'rgba(255,244,200,.20)'); halo.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(bx, by, 13 * s, 0, TAU); ctx.fill();
    ctx.restore();

    /* §OS-220 · O QUIQUE NAO TINHA PESO.
       A bola bate no gramado ~100 vezes por partida (medido pelo smoke) e
       atravessava o contato como uma esfera rigida. Achatar no impacto e o
       jeito mais barato de vender massa: o olho le deformacao como peso, e
       sem ela a bola parece um adesivo deslizando.
       O gatilho e a propria fisica — z cruzando o chao vindo de cima — e nao
       um evento novo. Dura 90 ms de relogio de parede, que e o tempo em que
       um contato real se le. */
    if (_e.zAnt != null && _e.zAnt > 0.10 && z <= 0.10) {
      _e.quique = performance.now();
      _e.forca = Math.min(1, (_e.zAnt - z) / 0.55);
    }
    _e.zAnt = z;
    let _sq = 0;
    if (_e.quique) {
      const _f = (performance.now() - _e.quique) / 90;
      if (_f >= 1) _e.quique = 0; else _sq = Math.sin(Math.PI * _f) * 0.34 * (_e.forca || 1);
    }
    // corpo da bola
    const rb = (6.2 + air * 2.6) * s;
    const bg = ctx.createRadialGradient(bx - rb * .36, by - rb * .36, 0, bx, by, rb);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(.75, '#e9e9e9'); bg.addColorStop(1, '#b9bcc4');
    /* §OS-224 · BOLA RAPIDA SE ALONGA NA DIRECAO DO VOO.
       A esfera perfeita a 40 m/s le como adesivo deslizando; o olho espera
       borrao. O alongamento sai do deslocamento REAL entre quadros (o mesmo
       vetor que ja alimenta a rotacao), entao ele aponta para onde a bola vai
       sem precisar de nada novo do motor, e some sozinho quando ela desacelera.
       Volume constante: o que estica num eixo encolhe no outro. */
    let _stX = 1, _stY = 1, _stAng = 0;
    if (_e.x !== null && _sq < 0.01) {
      const _mdx = o.gx - _e.pxAnt, _mdy = o.gy - _e.pyAnt;
      const _md = Math.hypot(_mdx, _mdy);
      if (_md > 0.35 && _md < 24) {
        const _f = Math.min(0.42, (_md - 0.35) * 0.10);
        _stAng = Math.atan2(_mdy, _mdx);
        _stX = 1 + _f; _stY = 1 - _f * 0.62;
      }
    }
    _e.pxAnt = o.gx; _e.pyAnt = o.gy;
    /* tres formas possiveis, uma so por quadro: alongada no voo rapido,
       achatada no quique, redonda no resto. */
    const _alongada = _stX !== 1;
    if (_alongada) { ctx.save(); ctx.translate(bx, by); ctx.rotate(_stAng); ctx.scale(_stX, _stY); }
    ctx.beginPath();
    if (_alongada) ctx.arc(0, 0, rb, 0, TAU);
    else if (_sq > 0.01) {
      /* achata na vertical e alarga na horizontal: volume constante */
      ctx.ellipse(bx, by + rb * _sq * .5, rb * (1 + _sq * .55), rb * (1 - _sq), 0, 0, TAU);
    } else ctx.arc(bx, by, rb, 0, TAU);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = '#3d3f46'; ctx.lineWidth = .8; ctx.stroke();
    if (_alongada) ctx.restore();
    /* §OS-220 · A BOLA NAO GIRAVA: ELA SE ORIENTAVA PELO LUGAR ONDE ESTAVA.
       Era `rot = (gx + gy) * 0.045` — funcao da POSICAO, nao do caminho. As
       consequencias sao todas visiveis depois que o arco passou a existir:
       a bola gira ao CONTRARIO quando volta pelo mesmo caminho, e CONGELA
       quando anda na diagonal em que `gx + gy` e constante — um passe de
       canto a canto podia cruzar o campo inteiro com os gomos parados.
       Rolar e girar proporcionalmente a DISTANCIA percorrida, dividida pelo
       raio. E o mesmo motivo pelo qual uma roda maior gira menos: aqui o raio
       vem em metros de campo, entao o giro nao muda com o zoom. */
    if (_e.x !== null) {
      const _dx = o.gx - _e.x, _dy = o.gy - _e.y, _dd = Math.hypot(_dx, _dy);
      /* teleporte (troca de campo, reposicao) nao e rolagem */
      if (_dd < 24) _e.rot += _dd / 0.11;      // 0,11 m = raio da bola
    }
    _e.x = o.gx; _e.y = o.gy;
    const rot = _e.rot;
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
    /* §OS-207 · QUEM SOFRE A FALTA NAO TINHA GESTO NENHUM.
       Sao 62 estados declarados e nenhum deles e levar uma falta. O motor
       emite `foul` com `by` (quem cometeu) e `on` (quem sofreu) desde sempre,
       e a apresentacao so tinha `fxAt(e.on,'foul')` — uma particula e um som.
       O jogador derrubado seguia com a locomocao que tivesse, entao a falta
       lia como "apitou do nada" e ele saia trotando do proprio tombo.
       Tier de ACAO porque o tombo manda no corpo: a locomocao nao pode
       sobrescrever. `fouled` e o desequilibrio, `get_up` a recomposicao. */
    fouled:          { tier: T_ACTION, dur: 0.52 },
    get_up:          { tier: T_ACTION, dur: 0.46 },
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

  /* §D42 · O PISO SO SABIA ANDAR PARA A FRENTE.
     ------------------------------------------------------------------------
     MEDIDO com `tools/fisica/tela/gestos.js`: **32 dos 62 estados declarados
     nunca chegaram a ser desenhados** numa amostra de 60 s a 6X. A causa nao
     e o desenho, e o contexto: a ponte entregava aos controladores TRES
     campos — `speed`, `hasBall`, `isGK` — e `locoFor` so sabe devolver
     idle/walk/jog/run/sprint a partir do modulo da velocidade.

     Com isso, familias inteiras ficavam inalcancaveis por construcao: toda a
     locomocao de transicao (accelerate, decelerate, turn, strafe, backpedal),
     toda a postura defensiva sem bola (press, jockey, body_duel, recover) e
     toda a recepcao (receive_prepare/contact/control).

     Nenhuma delas precisa de informacao nova do MOTOR — todas saem da
     velocidade, da sua derivada e da relacao com a bola, que a ponte ja podia
     calcular e nao calculava. Segue sendo observacao pura. */
  function posturaFor(ctx) {
    const v = finite(ctx.speed);
    const dot = finite(ctx.dotBola, 1);          // +1 corre para a bola, -1 recua dela
    /* a bola esta a caminho DELE: o corpo se prepara antes de ela chegar */
    if (ctx.recebendo && !ctx.hasBall) return 'receive_prepare';
    /* parado marcando: agachado, de lado, base larga */
    if (ctx.marcando && v < 2.4) return 'jockey';
    if (v < 0.25) return 'idle';
    /* de frente para a bola e recuando: nao e correr, e recuar */
    if (ctx.temRefBola && dot < -0.55 && v > 1.2 && v < 5.2) return 'backpedal';
    /* atravessado em relacao a bola: deslocamento lateral */
    if (ctx.temRefBola && Math.abs(dot) < 0.40 && v > 1.8 && v < 5.6) return 'strafe';
    if (ctx.pressionando) return 'press';
    return locoFor(v);
  }

  /* §D43 · QUEM ESTA COM A BOLA SO SABIA DUAS COISAS.
     O piso do portador era `speed > 0.3 ? 'carry' : 'protect'` — duas posturas
     para tudo. `burst_touch` e `protect_turn` estao declarados, tem desenho, e
     so podiam vir de um evento de drible que **acontece 3 vezes em 38 minutos**
     (medido em `tools/fisica/tela/drible.js`) e ainda exige atributo de elite.

     Como gesto, os dois nao dependem do duelo: arrancar com a bola e girar
     protegendo-a sao coisas que o portador faz o tempo todo. Saem da propria
     cinematica dele, que a §D42 ja poe no contexto. */
  function comBolaFor(ctx) {
    const v = finite(ctx.speed);
    if (finite(ctx.dSpeed) > 4.5 && v > 2.6) return 'burst_touch';
    if (finite(ctx.oponenteProx, 99) < 3.0 && Math.abs(finite(ctx.giro)) > 2.6) return 'protect_turn';
    return v > 0.3 ? 'carry' : 'protect';
  }

  /* §D45 · O PISO DO GOLEIRO ERA UMA CONSTANTE.
     `ctx.isGK ? 'gk_ready'` — sempre, em qualquer velocidade, com ou sem bola.
     Ele esta em cena 100% do tempo e tinha um estado so fora dos instantes de
     defesa.

     MEDIDO em `tools/fisica/tela/goleiro.js`, 10.586 amostras:

       parado (v < 0,3 m/s)     18,2%     <- os outros 81,8% ele se desloca
       velocidade mediana       1,26 m/s   p90 3,01   p99 6,81
       bola a menos de 18 m     12,2%
       com a bola na mao         0,9%

     Ou seja: em **quatro de cada cinco quadros** o goleiro estava andando e
     sendo desenhado parado em prontidao. `gk_shift` e `gk_set` estavam
     declarados desde a R14 e nunca tinham sido pedidos por ninguem. */
  function goleiroFor(ctx) {
    const v = finite(ctx.speed);
    if (ctx.hasBall) return 'gk_ready';        // a distribuicao vem por evento
    /* A POSICAO DE ESPERA VEM ANTES DO DESLOCAMENTO. Na primeira versao eu
       exigi `v < 0,6` E bola perto, e `gk_set` nao disparou nenhuma vez: quando
       a bola se aproxima o goleiro esta justamente se MOVENDO, entao as duas
       condicoes sao quase disjuntas. "Set" nao quer dizer imovel, quer dizer
       plantado e esperando o chute — o que exclui o sprint, nao o passo. */
    if (finite(ctx.distBola, 99) < 20 && v < 2.2) return 'gk_set';
    if (v > 0.6) return 'gk_shift';            // desloca na linha
    return 'gk_ready';
  }

  /* transicoes curtas: disparam UMA vez por gesto, a partir de estado ciclico */
  function transicaoFor(ctx) {
    const dv = finite(ctx.dSpeed);               // m/s por segundo
    const gir = Math.abs(finite(ctx.giro));      // rad/s da direcao de corrida
    if (gir > 3.2 && finite(ctx.speed) > 2.2) return 'turn';
    if (dv > 4.5) return 'accelerate';
    if (dv < -5.0) return 'decelerate';
    return null;
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
    const ok = this._enter(state, opts && opts.dur, now);
    /* §D43 · encadeamento de UM passo: o gesto pedido e, quando ele acabar, o
       desfecho. Sem isto nao ha como dizer "driblou" e depois "passou", nem
       "errou o bote" e depois "se recompoe" — os estados de desfecho
       (`dribble_success`, `recover`) existem justamente para o depois. */
    if (ok) this._apos = (opts && opts.entao) || null;
    return ok;
  };

  /* Dirige a sequência de ação a partir do contrato da Fase 2. As durações vêm
     do motor: prepare = contact-start, e o resto do próprio contrato. */
  Controller.prototype.beginAction = function (contract, now) {
    const seq = SEQ[contract && contract.action];
    if (!seq) return false;
    /* §OS-210 · `beginAction` ENTRAVA SEM PERGUNTAR NADA.
       `request` tem uma regra de compromisso — tier menor nao interrompe gesto
       em curso — e `beginAction` chamava `_enter` direto, por baixo dela. O
       contrato de acao do motor e generico ("um passe esta saindo"); o gesto do
       goleiro e especifico (ele repoe com a mao, ou bate de pe). O generico
       apagava o especifico no quadro seguinte.
       Medido: `gk_throw` e `gk_kick` entram na maquina e nunca chegam a um
       quadro desenhado. Aqui so o goleiro e protegido, e so enquanto o gesto
       dele ainda corre: e a familia cujo estado carrega informacao que a
       sequencia de passe nao tem. */
    if (this.tier === T_GK && this.dur > 0 && this.t < this.dur) return false;
    /* §OS-210 · A SEQUENCIA ADOTA A VARIANTE EM VEZ DE APAGA-LA.
       `power_shot`, `placed_shot`, `volley`, `long_pass`, `first_touch_pass` e
       `cross` nao sao gestos CONCORRENTES do passe e do chute: sao o mesmo
       gesto, ditos com mais precisao. A camada OS-46 os pede em
       `_startTravel`, o motor emite o contrato logo depois, e `pass_prepare`
       generico entrava por cima — o preparo especifico morria antes de virar
       quadro.
       Medido: `first_touch_pass` entrava 47 vezes e era desenhado ZERO
       (tools/fisica/tela/gesto-perdido.js); `placed_shot`, 2 e zero.
       Nao da para simplesmente barrar o contrato: e dele que vem a duracao do
       preparo, e e por isso que o quadro do contato cai no tick em que a bola
       sai — a razao de existir da Fase 3. Entao a variante VIRA a primeira
       fase da sequencia: o motor continua mandando no tempo, e o desenho
       continua dizendo QUE passe ou QUE chute foi. */
    const _varPasse = { first_touch_pass: 1, long_pass: 1, cross: 1 };
    const _varChute = { power_shot: 1, placed_shot: 1, volley: 1 };
    const _acao = contract && contract.action;
    const _adota = (_acao === 'pass' && _varPasse[this.state]) ||
                   (_acao === 'cross' && _varPasse[this.state]) ||
                   (_acao === 'shot' && _varChute[this.state]);
    if (_adota) {
      const s2 = seq.slice(); s2[0] = this.state;
      this.seq = s2; this.seqIdx = 0; this.contract = contract; this.interrupted = false;
      /* a variante ja esta em curso: mantem a fase dela e so garante que a
         duracao seja a que o contrato declarou para o preparo */
      this.dur = Math.max(0.02, finite(contract.prepareDuration, this.dur || 0.15));
      this.tier = T_ACTION;
      return true;
    }
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
    /* §D42 · A BOLA CHEGAVA E O CORPO NAO REAGIA. O dominio e o gesto mais
       frequente de uma partida — umas 500 vezes — e os tres estados que o
       descrevem (`receive_prepare/contact/control`) nunca eram pedidos por
       ninguem. O preparo sai da postura; contato e dominio sao encadeados aqui,
       no quadro em que a posse muda, que e a unica hora em que se sabe que a
       bola chegou de fato. */
    if (ctx.hasBall && this.state === 'receive_prepare' && !this.seq) {
      this.seq = ['receive_contact', 'receive_control'];
      this.seqIdx = 0;
      this.contract = { recoveryDuration: 0.22 };
      this._enter('receive_contact', 0.10, now);
      this.tier = T_BALL;
      return this.snapshot();
    }
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
      /* §D43 · o desfecho encadeado entra antes do piso */
      if (this._apos) {
        const _nx = this._apos;
        this._apos = null;
        if (this._enter(_nx, null, now)) return this.snapshot();
      }
      // caiu para o piso: locomoção (ou prontidão do goleiro)
      const base = ctx.isGK ? goleiroFor(ctx) : posturaFor(ctx);
      this._enter(base, null, now);
      /* §D42 · `_enter` sobrescreve `this.tier` com o tier declarado do estado,
         entao a atribuicao que ficava ANTES dele era codigo morto. Agora vem
         depois — e precisa vir: `jockey`/`press` sao T_DEF, e um tier acima de
         T_BALL trava o ramo ciclico abaixo, deixando o atleta preso na postura
         para sempre. Como piso, eles valem como locomocao. */
      this.tier = ctx.isGK ? T_GK : T_LOCO;
    } else if (this.dur === 0) {
      /* §D42 · transicao curta antes do piso: so a partir de estado ciclico e
         so uma vez por gesto, senao ela reinicia a cada quadro e nada se le */
      const tr = ctx.isGK ? null : transicaoFor(ctx);
      if (tr && tr !== this._ultTr) {
        this._ultTr = tr;
        this._enter(tr, null, now);
        this.tier = T_LOCO;
        return this.snapshot();
      }
      if (!tr) this._ultTr = null;
      // estado cíclico acompanha a velocidade sem reiniciar a fase à toa
      const base = ctx.isGK ? goleiroFor(ctx)
                 : ctx.hasBall ? comBolaFor(ctx)
                 : posturaFor(ctx);
      if (base !== this.state && this.tier <= T_DEF) {
        this._enter(base, null, now);
        /* so estado CICLICO volta a valer como piso; rebaixar o tier de um
           gesto com duracao (burst_touch, protect_turn) deixaria ele ser
           interrompido no meio pela propria locomocao */
        if (!ctx.isGK && (STATES[base] || {}).loop) this.tier = T_LOCO;
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
       atleta para o desenhista consultar.

       §OS-207 · ESTA AMOSTRAGEM ACONTECE NO MEIO DA CADEIA, NAO NO FIM.
       Cada camada envolve `P.step` capturando a anterior, entao a ORDEM DO
       DOCUMENTO decide quem roda por fora de quem. Esta ponte e o bloco 21;
       depois dela ainda escrevem `p.x/p.y` — e algumas tambem `p.vx/p.vy` —
       a OS-77 (falta comum), a OS-83 (impedimento), a OS-100 (lateral), a
       OS-107 (bloco de bola parada), a OS-112 e a R18.99. Ou seja: tudo que
       move gente durante a CERIMONIA de bola parada escreve DEPOIS que a
       animacao ja escolheu a pose do quadro.
       O sintoma e exatamente o que a R18.99/T7 descreve e tentou corrigir
       ("o 'meio bugadinho' que se ve na hora da falta"): ela recalcula a
       velocidade a partir do deslocamento real, mas faz isso quatro niveis
       POR FORA daqui — a correcao existe e a animacao nunca a ve, porque o
       quadro dela ja passou. O desenhista pinta a posicao FINAL e a maquina
       de estados escolheu a pose pela velocidade do meio do caminho: o
       jogador desliza pelo gramado em `idle`, ou corre parado depois de
       chegar ao posto.
       A correcao nao e mexer aqui na conta, e mexer na HORA: quando a camada
       final (OS-207) esta instalada, ela chama `amostrar` depois de todo
       mundo ter escrito, e esta copia se cala para nao amostrar duas vezes
       nem avancar o relogio dos controladores em dobro. */
    const amostrar = function (dt) {
      try {
        if (this.__anim) {
          const ctx = Object.create(null);
          const _dt = Number(dt) || 0;
          const b = this.ball || {};
          if (!this.__animPrev) this.__animPrev = Object.create(null);
          const prev = this.__animPrev;
          for (const tm of this.teams) {
            for (const p of tm.players) {
              if (p.red) continue;
              // garante controlador para TODO atleta em campo: sem isto, só quem
              // recebe um evento de ação ganha estado, e os demais ficam sem
              // locomoção nenhuma para o desenhista consultar
              this.__anim.of(idOf(p));
              /* §D42 · o contexto tinha TRES campos e por isso 32 dos 62
                 estados eram inalcancaveis. Nada aqui pergunta nada de novo ao
                 motor: e a mesma velocidade, sua derivada, e a relacao
                 geometrica com a bola. Continua sendo observacao pura. */
              const _id = idOf(p);
              const vx = Number(p.vx) || 0, vy = Number(p.vy) || 0;
              const v = Math.hypot(vx, vy);
              const ant = prev[_id];
              const ang = v > 0.4 ? Math.atan2(vy, vx) : (ant ? ant.ang : 0);
              let giro = 0;
              if (ant && _dt > 0 && v > 0.4 && ant.v > 0.4) {
                let da = ang - ant.ang;
                while (da > Math.PI) da -= Math.PI * 2;
                while (da < -Math.PI) da += Math.PI * 2;
                giro = da / _dt;
              }
              const dSpeed = (ant && _dt > 0) ? (v - ant.v) / _dt : 0;
              prev[_id] = { v: v, ang: ang };

              const bx = Number(b.x) || 0, by = Number(b.y) || 0;
              const dbx = bx - (Number(p.x) || 0), dby = by - (Number(p.y) || 0);
              const db = Math.hypot(dbx, dby);
              /* projecao da corrida na direcao da bola: +1 vai para cima dela,
                 -1 recua de frente para ela, ~0 corre atravessado */
              const dot = (v > 0.5 && db > 0.4) ? (vx * dbx + vy * dby) / (v * db) : 1;
              /* §D43 · distancia ao adversario mais proximo: e o que distingue
                 girar com espaco de girar protegendo a bola */
              let opProx = 99;
              for (const otm of this.teams) {
                if (otm === tm) continue;
                for (const q of otm.players) {
                  if (!q || q.red) continue;
                  const dq = Math.hypot((Number(q.x) || 0) - (Number(p.x) || 0),
                                        (Number(q.y) || 0) - (Number(p.y) || 0));
                  if (dq < opProx) opProx = dq;
                }
              }
              const dono = b.owner;
              const advers = !!(dono && dono.team !== p.team && dono !== p);
              const dDono = advers ? Math.hypot((Number(dono.x) || 0) - (Number(p.x) || 0),
                                                (Number(dono.y) || 0) - (Number(p.y) || 0)) : 1e9;
              ctx[_id] = {
                speed: v,
                hasBall: b.owner === p,
                isGK: !!p.isGK,
                dSpeed: dSpeed,
                giro: giro,
                dotBola: dot,
                temRefBola: v > 0.5 && db > 0.4,
                marcando: advers && dDono < 4.5,
                pressionando: advers && dDono < 14 && v > 3.6 && dot > 0.5,
                recebendo: !!(b.traveling && b.receiver === p && db < 9),
                distBola: db,
                oponenteProx: opProx,
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
              /* §OS-209 · a MESMA chave que o desenhista monta (time + ref.id,
                 ou o nome quando nao ha id). Antes era so o nome, e dois
                 homonimos liam o estado um do outro. */
              if (s) byKey[(p.team != null ? p.team : '?') + ':' +
                           ((p.ref && (p.ref.id != null ? 'i' + p.ref.id : p.ref.n)) || p.n || ('#' + (p.num || 0)))] = s;
            }
          }
          root.__CDS_ANIM_BY_KEY = byKey;
        }
      } catch (_) { }
    };

    /* §OS-207 · a amostragem fica publicada para que a camada final possa
       chama-la depois de TODOS os escritores de posicao. Enquanto ninguem a
       reivindicar (`dono`), a ponte continua amostrando no lugar de sempre —
       builds sem a OS-207 seguem funcionando exatamente como antes. */
    root.CDS_ANIM_BRIDGE = { amostrar: amostrar, dono: null };

    const oldStep = M.prototype.step;
    M.prototype.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      if (!root.CDS_ANIM_BRIDGE.dono) amostrar.call(this, dt);
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

