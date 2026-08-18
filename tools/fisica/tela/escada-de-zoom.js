#!/usr/bin/env node
'use strict';
/* ESCADA DE ZOOM — o mesmo lance em varios enquadramentos
   -------------------------------------------------------------------------
   Pedido do dono: "fecha a camera e me mostra".

   Escolher um zoom no escuro e chute. Esta ferramenta fotografa o MESMO
   instante de partida com varios valores de `CDS_ZOOM` e empilha as imagens,
   com o tamanho do atleta anotado em cada uma -- que e a grandeza que motivou
   o pedido.

   Uso: node tools/fisica/tela/escada-de-zoom.js [bundle.html] [--espera=N]
*/
const path = require('path'); const fs = require('fs');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const ESPERA = Number(argv.espera || 26);
const ZOOMS = String(argv.zooms || '1.30,1.70,2.10,2.60').split(',').map(Number);
const SAIDA = path.resolve('reports/imagens');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'],
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}) });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu'); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(ESPERA * 1000);

  const r = await pg.evaluate(async (zs) => {
    const cv = document.getElementById('fieldcv');
    const espera = () => new Promise(res => requestAnimationFrame(res));
    const tiros = [];
    for (const z of zs) {
      window.CDS_ZOOM = z;
      /* dois quadros: a camera interpola, entao o primeiro ainda carrega o
         enquadramento anterior */
      await espera(); await espera(); await espera(); await espera();
      const c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height;
      c.getContext('2d').drawImage(cv, 0, 0);
      /* altura do atleta em pixel: r = 13*s, e a figura tem ~2,1 r */
      let s = 1;
      try { s = window.CDS_F25D.project(cv.width / 2, cv.height * 0.6).s; } catch (_) { }
      tiros.push({ z: z, cv: c, px: (13 * s * 2.1 * z).toFixed(0) });
    }
    window.CDS_ZOOM = undefined;
    const W = cv.width, H = cv.height;
    const out = document.createElement('canvas');
    out.width = W; out.height = (H + 6) * tiros.length + 24;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#07130b'; ctx.fillRect(0, 0, out.width, out.height);
    for (let i = 0; i < tiros.length; i++) {
      ctx.drawImage(tiros[i].cv, 0, i * (H + 6));
      ctx.fillStyle = '#ffe9a8'; ctx.font = "700 17px system-ui, sans-serif";
      ctx.fillText('zoom ' + tiros[i].z.toFixed(2) + '   ·   atleta com ~' + tiros[i].px + ' px de altura',
                   14, i * (H + 6) + 26);
    }
    ctx.fillStyle = '#dfe9e2'; ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText('mesmo instante de partida, so o enquadramento muda · 1,30 e o valor atual do desktop',
                 14, out.height - 8);
    return { url: out.toDataURL('image/png'), px: tiros.map(t => t.z + ':' + t.px) };
  }, ZOOMS);

  await nav.close();
  const arq = path.join(SAIDA, 'escada-de-zoom.png');
  fs.writeFileSync(arq, Buffer.from(r.url.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('imagem escrita:', arq);
  console.log('altura do atleta em px por zoom:', r.px.join('  |  '));
  if (erros.length) { console.log('ERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 140))); }
  process.exit(0);
})();
