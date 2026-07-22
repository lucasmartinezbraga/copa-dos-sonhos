#!/usr/bin/env node
'use strict';
/* Filmstrip: N frames a intervalo fixo durante jogo ao vivo, p/ VER o visual real.
 * uso: node tools/ux/filmstrip.js --speed=1X --n=12 --iv=600 */
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const SPEED = (argv.speed || '1X').toUpperCase();
const N = Number(argv.n || 12), IV = Number(argv.iv || 600);
const BUILD = argv.build || 'dist/COPA DOS SONHOS - RC-UX.html';
const OUTDIR = path.join(ROOT, argv.out || `reports/ux/filmstrip-${SPEED}`);
const URL = 'file://' + path.join(ROOT, BUILD);
(async () => {
  fs.rmSync(OUTDIR, { recursive: true, force: true }); fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.G && window.G.db, { timeout: 12000 });
  await page.evaluate(() => window.__quickMatch(30, 110));
  await page.waitForTimeout(500);
  await page.evaluate((sp) => { const b = [...document.querySelectorAll('.spd')].find(x => x.textContent.trim().toUpperCase().startsWith(sp)); if (b) b.click(); }, SPEED);
  await page.waitForTimeout(1500);
  const log = [];
  for (let i = 0; i < N; i++) {
    const s = await page.evaluate(() => {
      const sim = window.GAME && window.GAME._sim && window.GAME._sim(); if (!sim) return null;
      const b = sim.getState().ball;
      const own = b.owner ? ((b.owner.ref && b.owner.ref.n) || 'x') : null;
      return { minute: +sim.minute.toFixed(2), bx: +b.x.toFixed(1), by: +b.y.toFixed(1), owner: own, traveling: !!b.traveling };
    }).catch(() => null);
    const fn = `f${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(OUTDIR, fn) });
    if (s) log.push({ file: fn, ...s });
    await page.waitForTimeout(IV);
  }
  fs.writeFileSync(path.join(OUTDIR, 'log.json'), JSON.stringify({ build: BUILD, speed: SPEED, pageErrors: errors, frames: log }, null, 1));
  console.log(`${log.length} frames @${SPEED} em ${OUTDIR}`);
  log.forEach(f => console.log(`  ${f.file} min=${f.minute} bola=(${f.bx},${f.by}) dono=${f.owner} viajando=${f.traveling}`));
  if (errors.length) console.log('ERROS:', [...new Set(errors)].slice(0, 6));
  await browser.close();
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
