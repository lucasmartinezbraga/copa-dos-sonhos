#!/usr/bin/env node
'use strict';
/* Assiste e fotografa o campo — so o canvas, no tamanho real, para eu OLHAR. */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const saida = process.argv[3] || '/tmp/olhar';
const n = Number(process.argv[4] || 8);
const intervalo = Number(process.argv[5] || 1400);
fs.mkdirSync(saida, { recursive: true });

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 1; });
  await pg.waitForTimeout(2500);

  /* o campo e o maior canvas visivel */
  const caixa = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')].map(c => {
      const r = c.getBoundingClientRect();
      return { id: c.id, w: c.width, h: c.height, x: r.x, y: r.y, cw: r.width, ch: r.height, area: r.width * r.height };
    }).filter(c => c.area > 0).sort((a, b) => b.area - a.area);
    return cs[0] || null;
  });
  console.log('canvas do campo:', JSON.stringify(caixa));

  for (let i = 0; i < n; i++) {
    await pg.screenshot({
      path: `${saida}/f${String(i).padStart(2, '0')}.png`,
      clip: { x: caixa.x, y: caixa.y, width: caixa.cw, height: caixa.ch },
    });
    await pg.waitForTimeout(intervalo);
  }
  await nav.close();
  console.log('fotos em ' + saida);
})().catch(e => { console.error(e); process.exit(1); });
