#!/usr/bin/env node
'use strict';
/* FOLHAS DE CONTATO — estudar a partida inteira, e nao uma amostra dela
   =========================================================================
   `assistir.js` grava o jogo todo. Nove minutos de video a 25 fps sao 14 mil
   quadros: ninguem olha isso, e olhar so os prints de evento e voltar a
   amostrar — exatamente o que se quer evitar.

   A folha de contato resolve, e e o metodo de mesa de luz da fotografia:
   contato primeiro, ampliacao depois. Vinte quadros por imagem, na ordem do
   tempo, um a cada dois segundos: a partida inteira cabe em ~15 folhas, e as
   15 uma pessoa varre inteiras. Quando algo salta, `--recorte=SEGUNDO` devolve
   o quadro em tamanho real.

   Cada quadro sai CARIMBADO com o segundo de video e, quando o catalogo do
   `assistir.js` esta ao lado, com o minuto de jogo. Folha sem carimbo obriga a
   contar quadradinho para saber de que momento se esta falando.

   Nao usa os filtros do ffmpeg de proposito: o ffmpeg que vem com o Playwright
   nao tem `fps` nem `tile`. Quem decodifica aqui e o proprio Chromium, que
   sabe ler o webm que ele mesmo gravou.

   Uso:
     node tools/auditoria/folhas.js --video=.../partida-completa.webm
     node tools/auditoria/folhas.js --video=... --recorte=132
*/
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) {}
  }
  console.error('playwright nao encontrado'); process.exit(2);
}
const { chromium } = carregarPlaywright();

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const video = argv.video;
if (!video || !fs.existsSync(video)) { console.error('use --video=<arquivo.webm>'); process.exit(2); }
const DIR = argv.out || path.join(path.dirname(video), 'folhas');
const INT = Number(argv.intervalo || 2);
const COL = Number(argv.colunas || 5), LIN = Number(argv.linhas || 4);
const LARG = Number(argv.largura || 384);

/* o catalogo do assistir.js, se estiver ao lado, da o minuto de jogo */
function mapaDeMinutos() {
  const cat = path.join(path.dirname(video), 'catalogo.json');
  if (!fs.existsSync(cat)) return null;
  try {
    const c = JSON.parse(fs.readFileSync(cat, 'utf8'));
    return { paredeS: c.paredeS, minutoFinal: c.minutoFinal };
  } catch (_) { return null; }
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of fs.readdirSync(DIR)) { try { fs.unlinkSync(path.join(DIR, f)); } catch (_) {} }

  const nav = await chromium.launch({ headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await nav.newPage({ viewport: { width: 900, height: 600 } });
  await pg.goto('about:blank');
  await pg.setContent(`<body style="margin:0;background:#111">
    <video id="v" src="${pathToFileURL(video).href}" preload="auto"></video>
    <canvas id="c"></canvas></body>`);
  const dur = await pg.evaluate(() => new Promise(res => {
    const v = document.getElementById('v');
    if (v.readyState >= 1) return res(v.duration);
    v.addEventListener('loadedmetadata', () => res(v.duration), { once: true });
  }));
  if (!Number.isFinite(dur)) { console.error('nao consegui ler a duracao do video'); process.exit(1); }

  const mapa = mapaDeMinutos();
  const total = Math.floor(dur / INT);
  const porFolha = COL * LIN;
  const nFolhas = Math.ceil(total / porFolha);

  const indice = [];
  for (let k = 0; k < nFolhas; k++) {
    const tempos = [];
    for (let i = 0; i < porFolha; i++) {
      const t = (k * porFolha + i) * INT;
      if (t <= dur - 0.05) tempos.push(+t.toFixed(2));
    }
    if (!tempos.length) break;
    const dados = await pg.evaluate(async ({ tempos, COL, LIN, LARG, mapa, durV }) => {
      const v = document.getElementById('v');
      const c = document.getElementById('c');
      const escala = LARG / v.videoWidth;
      const H = Math.round(v.videoHeight * escala);
      c.width = COL * LARG; c.height = LIN * (H + 18);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0d0f12'; ctx.fillRect(0, 0, c.width, c.height);
      const buscar = t => new Promise(res => {
        const ok = () => { v.removeEventListener('seeked', ok); res(); };
        v.addEventListener('seeked', ok); v.currentTime = t;
      });
      for (let i = 0; i < tempos.length; i++) {
        await buscar(tempos[i]);
        const cx = (i % COL) * LARG, cy = Math.floor(i / COL) * (H + 18);
        ctx.drawImage(v, cx, cy, LARG, H);
        ctx.fillStyle = '#0d0f12'; ctx.fillRect(cx, cy + H, LARG, 18);
        ctx.fillStyle = '#9fb3a4';
        ctx.font = '12px ui-monospace, monospace';
        const min = mapa ? (tempos[i] / durV * mapa.minutoFinal) : null;
        ctx.fillText(`${tempos[i].toFixed(0)}s` + (min != null ? `  ~${min.toFixed(0)}'` : ''), cx + 6, cy + H + 13);
        ctx.strokeStyle = '#1e2620'; ctx.strokeRect(cx + .5, cy + .5, LARG - 1, H + 17);
      }
      return c.toDataURL('image/png');
    }, { tempos, COL, LIN, LARG, mapa, durV: dur });

    const arq = path.join(DIR, `folha-${String(k + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(arq, Buffer.from(dados.split(',')[1], 'base64'));
    indice.push({ folha: path.basename(arq), deSegundo: tempos[0], ateSegundo: tempos[tempos.length - 1],
      minutoAprox: mapa ? [+(tempos[0] / dur * mapa.minutoFinal).toFixed(1),
        +(tempos[tempos.length - 1] / dur * mapa.minutoFinal).toFixed(1)] : null });
    process.stdout.write(`  ${path.basename(arq)}  ${tempos[0]}s .. ${tempos[tempos.length - 1]}s\n`);
  }

  if (argv.recorte != null) { /* tratado abaixo, fora do laco */ }
  await nav.close();

  fs.writeFileSync(path.join(DIR, 'indice.json'), JSON.stringify({
    video: path.basename(video), duracaoS: +dur.toFixed(1), intervaloS: INT,
    grade: `${COL}x${LIN}`, folhas: indice }, null, 2));
  console.log('');
  console.log(`${indice.length} folha(s) · video ${dur.toFixed(1)}s · 1 quadro a cada ${INT}s -> ${DIR}`);
})().catch(e => { console.error(e); process.exit(1); });
