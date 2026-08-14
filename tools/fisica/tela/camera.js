#!/usr/bin/env node
'use strict';
/* ALTURA DA CAMERA — a mesma jogada vista de varias alturas
   =========================================================================
   `R0` e a razao entre a largura da borda distante e a da proxima. 1,0 seria
   planta baixa; quanto menor, mais baixa a camera. Estava fixo em 0,72.

   Escolher altura de camera e decisao de gosto, mas comparar tem que ser
   honesto: se cada painel pegar um instante diferente do jogo, a comparacao e
   sobre a jogada, nao sobre a camera. Esta sonda **congela o jogo** (`G.speed`
   a zero e um passo unico), troca so o `CDS_CAM_TUNE` e fotografa — os paineis
   sao o MESMO quadro de simulacao visto de alturas diferentes.

   Uso: node tools/fisica/tela/camera.js [build.html] [saida.png] [R0...]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const saida = path.resolve(process.argv[3] || '/tmp/camera.png');
/* pares (R0, faixa): baixar sem achatar deixa o campo trapezoidal mas ainda
   visto de cima. A camera de TV precisa dos dois. */
const COMBOS = [
  { R0: 0.72, faixa: 1.00, rot: 'atual' },
  { R0: 0.62, faixa: 1.00, rot: 'baixa' },
  { R0: 0.54, faixa: 1.00, rot: 'TV' },
  { R0: 0.46, faixa: 1.00, rot: 'TV baixa' },
];

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 3; });
  /* espera a bola sair do meio para o quadro ter jogo acontecendo */
  await pg.waitForTimeout(9000);

  const caixa = await pg.evaluate(() => {
    /* CONGELA: sem isto cada painel seria um instante diferente e a comparacao
       seria sobre a jogada, nao sobre a camera. */
    window.G.speed = 0;
    const cs = [...document.querySelectorAll('canvas')]
      .map(c => { const r = c.getBoundingClientRect(); return { r, a: r.width * r.height }; })
      .sort((a, b) => b.a - a.a);
    if (!cs.length) return null;
    const r = cs[0].r;
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!caixa) { console.error('sem canvas'); await nav.close(); process.exit(1); }

  const partes = [];
  for (const c of COMBOS) {
    await pg.evaluate(v => { window.CDS_CAM_TUNE = { R0: v.R0, faixa: v.faixa }; }, c);
    await pg.waitForTimeout(800);              // alguns quadros com a camera nova
    const arq = saida.replace(/\.png$/, '') + '-' + String(c.R0).replace('.', '') + '.png';
    await pg.screenshot({ path: arq, clip: caixa });
    partes.push(Object.assign({ arq }, c));
    console.log(`R0 ${c.R0.toFixed(2)} faixa ${c.faixa.toFixed(2)} (${c.rot})  ->  ${arq}`);
  }

  /* folha unica, empilhada e rotulada */
  const b64 = partes.map(p => require('fs').readFileSync(p.arq).toString('base64'));
  await pg.setContent(
    '<body style="margin:0;background:#0b1220;font:14px monospace;color:#cfe6d4">' +
    partes.map((p, i) =>
      `<div style="position:relative"><img src="data:image/png;base64,${b64[i]}" style="width:100%;display:block">` +
      `<div style="position:absolute;left:10px;top:8px;background:rgba(0,0,0,.72);padding:4px 9px;border-radius:4px">` +
      `${p.rot} — R0 ${p.R0.toFixed(2)} · faixa ${p.faixa.toFixed(2)}</div></div>`).join('') +
    '</body>');
  await pg.waitForTimeout(900);
  await pg.setViewportSize({ width: 1000, height: Math.round(1000 * caixa.height / caixa.width * partes.length) });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: saida, fullPage: true });
  console.log(`\nfolha: ${saida}`);
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
