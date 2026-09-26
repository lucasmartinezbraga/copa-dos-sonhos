#!/usr/bin/env node
'use strict';
/* Captura VISUAL de um dwell ("bola presa entre dois atletas"): roda uma partida
 * ao vivo, detecta no navegador quando a bola fica num aperto com o mesmo dono por
 * >N s de parede, e dispara uma rajada de screenshots ~250ms para eu VER o que o
 * usuário vê. Loga bola/dono/2 jogadores mais próximos por frame.
 * uso: node tools/ux/capture_dwell.js [--secs=60] [--speed=1X]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const SECS = Number(argv.secs || 60);
const SPEED = (argv.speed || '1X').toUpperCase();
const BUILD = argv.build || 'dist/COPA DOS SONHOS - RC-UX.html';
const OUTDIR = path.join(ROOT, argv.out || 'reports/ux/dwell-capture');
const URL = 'file://' + path.join(ROOT, BUILD);

(async () => {
  fs.rmSync(OUTDIR, { recursive: true, force: true });
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.G && window.G.db, { timeout: 12000 });
  await page.evaluate(() => window.__quickMatch(30, 110));
  await page.waitForTimeout(500);
  await page.evaluate((sp) => { const b = [...document.querySelectorAll('.spd')].find(x => x.textContent.trim().toUpperCase().startsWith(sp)); if (b) b.click(); }, SPEED);

  const read = async () => page.evaluate(() => {
    const sim = window.GAME && window.GAME._sim && window.GAME._sim(); if (!sim) return null;
    const st = sim.getState(); const b = st.ball;
    const own = b.owner ? ((b.owner.ref && b.owner.ref.n) || b.owner.id || 'x') : null;
    // 2 jogadores mais próximos da bola
    const all = []; for (const tm of sim.teams) for (const p of tm.players) if (!p.red) all.push({ n: (p.ref && p.ref.n) || p.id, d: Math.hypot(p.x - b.x, p.y - b.y), vx: +(p.vx||0).toFixed(2), vy: +(p.vy||0).toFixed(2), act: p._act || '' });
    all.sort((a, c) => a.d - c.d);
    return { minute: +sim.minute.toFixed(2), bx: +b.x.toFixed(2), by: +b.y.toFixed(2), z: +(b.z || 0).toFixed(2), owner: own, traveling: !!b.traveling, near: all.slice(0, 2) };
  }).catch(() => null);

  const log = [];
  let shots = 0, capturing = 0, anchor = null, dwellStart = 0, captured = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000 && captured < 3) {
    const s = await read(); if (!s) break;
    const now = Date.now();
    // âncora na bola: mesmo aperto (<5m) mantém a janela
    if (!anchor || Math.hypot(s.bx - anchor.bx, s.by - anchor.by) > 5 || s.traveling) { anchor = s; dwellStart = now; }
    const held = (now - dwellStart) / 1000;
    // dwell perceptível: >1.6s de parede no mesmo aperto, com dono, não viajando
    if (held > 1.6 && s.owner && !s.traveling && capturing <= 0) { capturing = 8; captured++; }
    if (capturing > 0) {
      const fn = `dwell${captured}-f${8 - capturing}.png`;
      await page.screenshot({ path: path.join(OUTDIR, fn) });
      log.push({ t: +(held).toFixed(2), file: fn, ...s });
      capturing--;
      await page.waitForTimeout(250);
    } else {
      await page.waitForTimeout(100);
    }
  }
  fs.writeFileSync(path.join(OUTDIR, 'log.json'), JSON.stringify({ build: BUILD, speed: SPEED, pageErrors: errors, frames: log }, null, 1));
  console.log(`capturados ${captured} dwells, ${log.length} frames em ${OUTDIR}`);
  log.forEach(f => console.log(`  ${f.file} t=${f.t}s min=${f.minute} bola=(${f.bx},${f.by}) dono=${f.owner} perto=${f.near.map(n => n.n + '@' + n.d.toFixed(1) + 'm v=' + Math.hypot(n.vx, n.vy).toFixed(1) + ' act=' + n.act).join(' | ')}`));
  if (errors.length) console.log('ERROS DE PÁGINA:', errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
