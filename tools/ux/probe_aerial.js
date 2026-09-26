#!/usr/bin/env node
'use strict';
/* PRO-021..030: amostra a bola AÉREA (z>0.5) e confere se o Y projetado fica
 * DENTRO da banda visível do estádio (nunca acima da arquibancada / nunca y<0).
 * Usa o hook window.__ballProbe(z, by, topY, s) do render real. */
const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const BUILD = argv.build || 'dist/COPA DOS SONHOS - RC-UX.html';
const SECS = Number(argv.secs || 60);
const SPEED = (argv.speed || '4X').toUpperCase();
const URL = 'file://' + path.join(ROOT, BUILD);
const VIEWPORTS = [[1440, 810, 'desktop'], [1024, 768, 'tablet'], [390, 844, 'retrato'], [844, 390, 'paisagem']];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  let grand = { aerial: 0, inStands: 0, minBy: 1e9, worst: null };
  for (const [W, H, label] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.addInitScript(() => {
      window.__samples = [];
      window.__ballProbe = (z, by, topY, s) => { if (z > 0.5) window.__samples.push({ z: +z.toFixed(2), by: +by.toFixed(2), topY: +topY.toFixed(1) }); };
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.G && window.G.db, { timeout: 12000 });
    await page.evaluate(() => window.__quickMatch(30, 110));
    await page.waitForTimeout(400);
    await page.evaluate((sp) => { const b = [...document.querySelectorAll('.spd')].find(x => x.textContent.trim().toUpperCase().startsWith(sp)); if (b) b.click(); }, SPEED);
    await page.waitForTimeout(SECS * 1000);
    const s = await page.evaluate(() => {
      const S = window.__samples || [];
      // "na arquibancada" = by acima da faixa do estádio (by < topY) OU y negativo.
      const inStands = S.filter(v => v.by < v.topY || v.by < 0);
      const minBy = S.reduce((m, v) => Math.min(m, v.by), 1e9);
      return { aerial: S.length, inStands: inStands.length, minBy: S.length ? +minBy.toFixed(2) : null, topY: S.length ? S[0].topY : null };
    });
    console.log(`  [${label} ${W}x${H}] aéreas=${s.aerial} naArquibancada=${s.inStands} minBy=${s.minBy} (topY=${s.topY})`);
    grand.aerial += s.aerial; grand.inStands += s.inStands;
    if (s.minBy != null && s.minBy < grand.minBy) { grand.minBy = s.minBy; grand.worst = label; }
    await page.close();
  }
  const pass = grand.inStands === 0 && grand.aerial > 0;
  console.log(`\nTOTAL aéreas=${grand.aerial} | naArquibancada=${grand.inStands} | minBy=${grand.minBy} (pior: ${grand.worst})`);
  console.log(pass ? 'PRO-021..030: PASS — nenhuma bola aérea invade o estádio.' : (grand.aerial === 0 ? 'INCONCLUSIVO — nenhuma amostra aérea capturada.' : 'PRO-021..030: FAIL — bola invade o estádio.'));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FALHOU', e.message); process.exit(2); });
