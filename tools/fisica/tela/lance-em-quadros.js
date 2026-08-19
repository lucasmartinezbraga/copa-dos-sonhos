#!/usr/bin/env node
'use strict';
/* O LANCE EM QUADROS — para OLHAR, não para medir
   =========================================================================
   COBRANÇA DO DONO, e ela é justa: "tudo que eu peço que você olhe é pra olhar
   o VISUAL... tem que ver o gif do lance... qual é a animação quando o jogador
   dá um chute? quando sai driblando? o pulo do goleiro? ... você vai ficar
   ajustando várias coisas, mas eu não sei se isso vai melhorar de fato o que
   precisa ser melhorado."

   Ele está certo. Uma sessão inteira de número não substitui olhar o lance.

   AS DUAS COISAS QUE AS FERRAMENTAS ANTERIORES ERRAVAM

   1. `gif-de-jogo.js` só sabia esperar falta, escanteio, gol e lateral. Chute,
      drible e defesa não estavam mapeados -- o gatilho nunca disparava e ela
      capturava um instante qualquer.

   2. Ela começava a capturar NO evento. Mas o chute começa antes de
      `shot_taken`: a perna arma, o corpo gira, o pé encosta. Capturar a partir
      do evento perde justamente a parte que se julga.

   Esta grava num BUFFER ROLANTE o tempo todo e, quando o lance acontece,
   guarda os quadros de ANTES junto com os de depois. E recorta perto da bola,
   ampliado, porque num campo inteiro o atleta tem 13 px e não há o que julgar.

   Sai uma folha de contato (para ler quadro a quadro) e um GIF (para ver em
   movimento).

   Uso:
     node tools/fisica/tela/lance-em-quadros.js --evento=shot_taken --nome=chute
     node tools/fisica/tela/lance-em-quadros.js --evento=dribble --nome=drible
     node tools/fisica/tela/lance-em-quadros.js --evento=save   --nome=defesa
     node tools/fisica/tela/lance-em-quadros.js --evento=tackle --nome=desarme
*/
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado; ferramenta pulada'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const EVENTO = String(argv.evento || 'shot_taken');
const NOME = String(argv.nome || EVENTO);
const ANTES = Number(argv.antes || 10);      // quadros guardados antes do evento
const DEPOIS = Number(argv.depois || 22);    // quadros gravados depois
const LARG = Number(argv.larg || 300);       // recorte, em px de canvas
const ALT = Number(argv.alt || 210);
const ZOOM = Number(argv.zoom || 2);         // ampliacao do recorte
const VEL = Number(argv.vel || 1);           // velocidade do jogo na captura
/* §PASSO ENTRE QUADROS. A primeira versao guardava TODO quadro: 24 quadros a
   60 fps sao 0,4 s de jogo -- um piscar, insuficiente para acompanhar a
   jogada. Guardando 1 em cada N, a mesma folha cobre N vezes mais tempo, e o
   movimento entre celulas fica visivel. */
const PASSO = Number(argv.passo || 4);
const SAIDA = path.resolve('reports/imagens');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }

  await pg.evaluate(cfg => {
    const S = window.__lq = { anel: [], pronto: false, restam: cfg.depois, fim: false,
                              quando: null, chave: null };
    try { if (window.G && cfg.vel) window.G.speed = cfg.vel; } catch (_) { }

    /* a MESMA chave de desenho que o resto do projeto usa */
    const chaveDe = p => (p.team != null ? p.team : '?') + ':' +
      ((p.ref && (p.ref.id != null ? 'i' + p.ref.id : p.ref.n)) || p.n || ('#' + (p.num || 0)));

    const P = window.MatchSim.prototype, old = P._emit;
    P._emit = function (t, d) {
      try {
        if (!S.pronto && t === cfg.evento) {
          const quem = d && (d.by || d.gk || d.p || d.on);
          S.pronto = true;
          S.chave = quem ? chaveDe(quem) : null;
          S.quando = { minuto: +(Number(this.minute) || 0).toFixed(1),
                       quem: (quem && quem.n) || '?' };
        }
      } catch (_) { }
      return old.apply(this, arguments);
    };

    /* §SEGUIR O ATLETA, NAO A BOLA. Centrar na bola parecia obvio e esta errado:
       depois do chute a bola SAI, o chutador fica, e o recorte perde exatamente
       quem executou o gesto. Mas so se sabe quem foi quando o evento chega --
       e ate la os quadros de ANTES ja passaram.
       Entao o anel guarda o QUADRO INTEIRO mais a posicao de cada atleta nele,
       e o recorte e feito no fim, quando o autor ja e conhecido. */
    const cv = document.getElementById('fieldcv');
    const F = Object.assign({}, window.CDS_F25D), origBody = F.body;
    let posQuadro = Object.create(null);
    F.body = function (ctx, o) {
      try {
        if (o && o.key) {
          const t = ctx.getTransform ? ctx.getTransform() : null;
          posQuadro[o.key] = t ? { x: t.a * o.x + t.e, y: t.d * o.y + t.f }
                               : { x: o.x, y: o.y };
        }
      } catch (_) { }
      return origBody.apply(this, arguments);
    };
    window.CDS_F25D = F;

    let conta = 0;
    const laco = () => {
      if (S.fim) return;
      try {
        if (cv && (conta++ % cfg.passo === 0)) {
          const copia = document.createElement('canvas');
          copia.width = cv.width; copia.height = cv.height;
          copia.getContext('2d').drawImage(cv, 0, 0);
          S.anel.push({ cv: copia, pos: posQuadro });
          posQuadro = Object.create(null);
          if (!S.pronto && S.anel.length > cfg.antes) S.anel.shift();
          if (S.pronto) { S.restam--; if (S.restam <= 0) { S.fim = true; return; } }
        }
      } catch (_) { }
      requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
  }, { evento: EVENTO, antes: ANTES, depois: DEPOIS, vel: VEL, passo: PASSO });

  try {
    await pg.waitForFunction(() => window.__lq.fim === true, null, { timeout: 240000 });
    console.log('lance capturado: ' + EVENTO);
  } catch (_) {
    console.log('o evento "' + EVENTO + '" nao aconteceu no tempo dado.');
    await nav.close(); process.exit(3);
  }

  const r = await pg.evaluate(async (cfg) => {
    const S = window.__lq, N = S.anel.length, COLS = 4;
    const W = cfg.larg, H = cfg.alt, Z = cfg.zoom;
    const linhas = Math.ceil(N / COLS);
    const folha = document.createElement('canvas');
    folha.width = COLS * W * Z; folha.height = linhas * (H * Z + 18) + 22;
    const fx = folha.getContext('2d');
    fx.imageSmoothingEnabled = false;
    fx.fillStyle = '#06110a'; fx.fillRect(0, 0, folha.width, folha.height);
    const tiras = [];
    for (let i = 0; i < N; i++) {
      const q = S.anel[i], p = S.chave && q.pos[S.chave];
      const cx = p ? p.x : q.cv.width / 2, cy = p ? p.y : q.cv.height / 2;
      const sx = Math.max(0, Math.min(q.cv.width - W, cx - W / 2));
      const sy = Math.max(0, Math.min(q.cv.height - H, cy - H * 0.62));
      const dx = (i % COLS) * W * Z, dy = Math.floor(i / COLS) * (H * Z + 18) + 20;
      fx.drawImage(q.cv, sx, sy, W, H, dx, dy, W * Z, H * Z);
      fx.strokeStyle = 'rgba(255,255,255,.12)'; fx.strokeRect(dx, dy, W * Z, H * Z);
      fx.fillStyle = i === cfg.antes ? '#ffd166' : 'rgba(255,255,255,.6)';
      fx.font = "600 13px system-ui, sans-serif";
      const ms = Math.round((i - cfg.antes) * cfg.passo * 16.7);
      fx.fillText((ms >= 0 ? '+' : '') + ms + ' ms' +
                  (i === cfg.antes ? '   <- o evento' : ''), dx + 6, dy + H * Z + 14);
      /* tira para o GIF: o mesmo recorte, sem rotulo */
      const t = document.createElement('canvas');
      t.width = W * Z; t.height = H * Z;
      const tc = t.getContext('2d'); tc.imageSmoothingEnabled = false;
      tc.drawImage(q.cv, sx, sy, W, H, 0, 0, W * Z, H * Z);
      tiras.push(t.toDataURL('image/png'));
    }
    fx.fillStyle = '#e8f2ec'; fx.font = "700 15px system-ui, sans-serif";
    fx.fillText(cfg.nome + ' — ' + N + ' quadros, 1 a cada ' + cfg.passo +
                ' (' + Math.round(cfg.passo * 16.7) + ' ms entre celulas) | minuto ' + (S.quando ? S.quando.minuto : '?') +
                ' | ' + (S.quando ? S.quando.quem : '?') + (S.chave ? '' : '  (autor desconhecido: segue a bola)'),
                8, 14);
    let gif = null;
    try { if (window.__cdsGif) gif = await window.__cdsGif(tiras, 70); } catch (_) { }
    return { folha: folha.toDataURL('image/png'), gif: gif, n: N, quando: S.quando };
  }, { antes: ANTES, nome: NOME, larg: LARG, alt: ALT, zoom: ZOOM, passo: PASSO });

  await nav.close();
  const arqF = path.join(SAIDA, 'lance-' + NOME + '.png');
  fs.writeFileSync(arqF, Buffer.from(r.folha.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('folha: ' + arqF + '  (' + r.n + ' quadros)');
  if (r.gif) {
    const arqG = path.join(SAIDA, 'lance-' + NOME + '.gif');
    fs.writeFileSync(arqG, Buffer.from(r.gif.replace(/^data:image\/gif;base64,/, ''), 'base64'));
    console.log('gif:   ' + arqG);
  }
  if (erros.length) { console.log('ERROS:'); [...new Set(erros)].slice(0, 3).forEach(e => console.log('  ', e.slice(0, 140))); }
  process.exit(0);
})();
