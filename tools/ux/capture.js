#!/usr/bin/env node
'use strict';
/*
 * Inventário/captura de telas — carrega um build no Chromium e tira screenshots
 * das telas nos viewports-alvo, além de dumpar o estado (G.screen) e a
 * estrutura do #app. Base do "antes/depois" do redesign UX.
 *
 * uso: node tools/ux/capture.js --build="dist/....html" --outdir=reports/ux/before [--tag=before]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const BUILD = argv.build || 'dist/COPA DOS SONHOS - V5.9.3-R13.0 - FUTEBOL OBSERVAVEL E CADENCIADO.html';
const OUTDIR = path.join(ROOT, argv.outdir || 'reports/ux/before');
const TAG = argv.tag || 'before';

const VIEWPORTS = [
  { name: 'desktop', w: 1366, h: 768 },
  { name: 'mvert', w: 390, h: 844 },
  { name: 'mland', w: 844, h: 390 },
];

const fileUrl = 'file://' + path.join(ROOT, BUILD);

async function snap(page, outdir, screen, vpName) {
  const file = `${screen}__${vpName}.png`;
  await page.screenshot({ path: path.join(outdir, file), fullPage: false });
  return file;
}

async function state(page) {
  return page.evaluate(() => {
    const G = window.G || {};
    const app = document.querySelector('#app');
    function tree(el, depth) {
      if (!el || depth > 2) return null;
      const kids = [...el.children].slice(0, 40).map(c => tree(c, depth + 1)).filter(Boolean);
      return { tag: el.tagName.toLowerCase(), id: el.id || undefined, cls: el.className && String(el.className).slice(0, 60) || undefined, kids: kids.length ? kids : undefined };
    }
    const buttons = [...document.querySelectorAll('button, .btn, [role=button]')].filter(b => b.offsetParent).map(b => ({ id: b.id || undefined, t: (b.textContent || '').trim().slice(0, 24) })).slice(0, 40);
    return { screen: G.screen, gKeys: Object.keys(G).slice(0, 40), tree: tree(app, 0), buttons };
  });
}

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const inventory = { build: BUILD, tag: TAG, screens: [] };

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const st = await state(page);
    const file = await snap(page, OUTDIR, st.screen || 'home', vp.name);
    if (vp.name === 'desktop') inventory.screens.push({ screen: st.screen || 'home', ...st, files: {} });
    const entry = inventory.screens.find(s => s.screen === (st.screen || 'home'));
    if (entry) entry.files[vp.name] = file;
    if (errors.length) (entry || {}).errors = errors.slice(0, 5);
    await page.close();
  }

  fs.writeFileSync(path.join(OUTDIR, `inventory-${TAG}.json`), JSON.stringify(inventory, null, 2));
  console.log(JSON.stringify({ outdir: OUTDIR, screensCaptured: inventory.screens.map(s => s.screen), sampleState: inventory.screens[0] }, null, 2));
  await browser.close();
})().catch(e => { console.error('FALHOU:', e.stack || e.message); process.exit(1); });
