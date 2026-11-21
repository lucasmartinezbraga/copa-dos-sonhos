#!/usr/bin/env node
'use strict';
/*
 * AUDITORIA DE TEMPO REAL — mede o jogo COMO ELE RODA na tela (o que a
 * auditoria headless não vê): avanço do relógio por segundo de parede,
 * travamentos de frame (jank do render) e "bola presa" (imóvel e/ou posse
 * pingue-pongue entre dois atletas). Compara qualquer build no mesmo protocolo.
 *
 * uso: node tools/ux/audit_realtime.js --build="dist/....html" --label=rcux --speed=1X --secs=45
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const BUILD = argv.build || 'dist/COPA DOS SONHOS - RC-UX.html';
const LABEL = argv.label || 'build';
const SPEED = argv.speed || '1X';
const SECS = Number(argv.secs || 45);
const OUTDIR = path.join(ROOT, argv.out || `reports/ux/audit-rt-${LABEL}`);
const URL = 'file://' + path.join(ROOT, BUILD);

const FRAME_SAMPLER = `
window.__fr = { last: performance.now(), deltas: [] };
(function loop(){ const n = performance.now(); const d = n - window.__fr.last; window.__fr.last = n;
  window.__fr.deltas.push(d); if (window.__fr.deltas.length > 4000) window.__fr.deltas.shift();
  requestAnimationFrame(loop); })();`;

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript(FRAME_SAMPLER);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.G && window.G.db, { timeout: 12000 });
  await page.evaluate(() => window.__quickMatch(30, 110));
  await page.waitForTimeout(400);
  await page.evaluate((sp) => { const b = [...document.querySelectorAll('.spd')].find(x => x.textContent.trim().toUpperCase().startsWith(sp)); if (b) b.click(); }, SPEED.toUpperCase());

  const samples = [];
  const wall0 = Date.now();
  let minute0 = null;
  // amostra a ~12 Hz
  while (Date.now() - wall0 < SECS * 1000) {
    const s = await page.evaluate(() => {
      const sim = window.GAME && window.GAME._sim && window.GAME._sim(); if (!sim) return null;
      const st = sim.getState(); const b = st.ball;
      const ownerId = b.owner ? (b.owner.ref && b.owner.ref.n) || b.owner.id || null : null;
      return { t: performance.now(), minute: sim.minute, over: sim.isOver(),
               bx: +b.x.toFixed(2), by: +b.y.toFixed(2), z: +(b.z || 0).toFixed(2),
               owner: ownerId, traveling: !!b.traveling, paused: !!window.paused };
    }).catch(() => null);
    if (!s) break;
    if (minute0 == null) minute0 = s.minute;
    samples.push(s);
    if (s.over) break;
    await page.waitForTimeout(80);
  }
  const wallSecs = (Date.now() - wall0) / 1000;

  // ── jank de frames
  const fr = await page.evaluate(() => window.__fr.deltas.slice());
  const sorted = fr.slice().sort((a, b) => a - b);
  const pct = q => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(1) : 0;
  const jank = {
    frames: fr.length, fps: +(fr.length / wallSecs).toFixed(1),
    p50: pct(.5), p95: pct(.95), p99: pct(.99), max: +Math.max(...fr, 0).toFixed(1),
    over50ms: fr.filter(d => d > 50).length, over120ms: fr.filter(d => d > 120).length, over500ms: fr.filter(d => d > 500).length,
  };

  // ── avanço do relógio por segundo de parede
  const minuteAdvanced = samples.length ? samples[samples.length - 1].minute - minute0 : 0;
  const clockRate = +(minuteAdvanced / wallSecs).toFixed(3); // minutos de jogo por segundo de parede

  // ── janelas paradas: relógio quase sem andar por ≥2s de parede
  const stalls = [];
  for (let i = 0; i < samples.length; i++) {
    let j = i;
    while (j + 1 < samples.length && (samples[j + 1].minute - samples[i].minute) < 0.02) j++;
    const dtWall = (samples[j].t - samples[i].t);
    if (j > i && dtWall > 1500) { stalls.push({ from: i, to: j, wallMs: +dtWall.toFixed(0), dMinute: +(samples[j].minute - samples[i].minute).toFixed(3) }); i = j; }
  }

  // ── bola presa: imóvel (≤1.5m) por ≥2s OU posse pingue-pongue entre 2 ids
  const stuck = [];
  for (let i = 0; i < samples.length; i++) {
    let j = i; const owners = new Set([samples[i].owner]);
    while (j + 1 < samples.length) {
      const dx = samples[j + 1].bx - samples[i].bx, dy = samples[j + 1].by - samples[i].by;
      if (Math.hypot(dx, dy) > 2.5) break;
      owners.add(samples[j + 1].owner); j++;
    }
    const dtWall = samples[j].t - samples[i].t;
    if (j - i >= 12 && dtWall > 2000) {
      const distinct = [...owners].filter(Boolean);
      stuck.push({ from: i, to: j, wallMs: +dtWall.toFixed(0), samples: j - i + 1,
                   area: 'imóvel≤2.5m', owners: distinct.slice(0, 4), pingpong: distinct.length === 2 });
      i = j;
    }
  }

  await page.screenshot({ path: path.join(OUTDIR, `${LABEL}-${SPEED}.png`) });
  const report = {
    build: BUILD, label: LABEL, speed: SPEED, wallSecs: +wallSecs.toFixed(1),
    clockRate_minPerSec: clockRate, minuteStart: +(+minute0).toFixed(2), minuteEnd: samples.length ? +samples[samples.length - 1].minute.toFixed(2) : null,
    jank, stalls, stuck, samples: samples.length, pageErrors: errors.length,
  };
  fs.writeFileSync(path.join(OUTDIR, `rt-${LABEL}-${SPEED}.json`), JSON.stringify(report, null, 1));
  console.log(`[${LABEL} @${SPEED}] relógio=${clockRate} min/s (andou ${minuteAdvanced.toFixed(2)}' em ${wallSecs.toFixed(0)}s) | fps=${jank.fps} p95=${jank.p95}ms max=${jank.max}ms jank>120ms=${jank.over120ms} >500ms=${jank.over500ms} | stalls=${stalls.length} stuck=${stuck.length}`);
  if (stuck.length) stuck.slice(0, 3).forEach(s => console.log(`   BOLA PRESA: ${s.wallMs}ms, ${s.samples} amostras, donos=${JSON.stringify(s.owners)} pingpong=${s.pingpong}`));
  if (stalls.length) stalls.slice(0, 3).forEach(s => console.log(`   RELÓGIO PARADO: ${s.wallMs}ms andou só ${s.dMinute}'`));
  await browser.close();
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
