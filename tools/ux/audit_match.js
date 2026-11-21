#!/usr/bin/env node
'use strict';
/*
 * AUDITORIA DE PARTIDA EM NAVEGADOR REAL (gate 6 da R13: "auditoria visual em
 * navegador real"). Roda partidas completas no Chromium e verifica, durante o
 * jogo, invariantes de motor E de apresentação:
 *   - relógio avança (sem stall); zero pageerrors; FPS em 1X
 *   - placar DOM ≡ motor após cada gol (pós-comemoração)
 *   - bola/jogadores finitos e dentro dos limites; projeção finita
 *   - auditor embutido pré-2.5D (teleportes, não-finitos, posse sem contato,
 *     timelines inválidas) — contadores duros ao final
 *   - status canônico R12 CONSISTENT no fim
 *   - cobertura de eventos da partida (laterais, escanteios, impedimentos,
 *     faltas, defesas) via stats do motor
 *   - cruzamentos: frames aéreos observados + screenshot de evidência
 *
 * uso: node tools/ux/audit_match.js --build="dist/....html" --matches=2 --label=rcux
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const BUILD = argv.build || 'dist/COPA DOS SONHOS - RC-UX.html';
const N = Number(argv.matches || 2);
const LABEL = argv.label || 'rcux';
const OUTDIR = path.join(ROOT, argv.out || `reports/ux/audit-match-${LABEL}`);
const URL = 'file://' + path.join(ROOT, BUILD);

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => errors.push({ type: 'pageerror', msg: String(e.message).slice(0, 200) }));
  page.on('console', m => { if (m.type() === 'error' && !/net::|favicon/.test(m.text())) errors.push({ type: 'console', msg: m.text().slice(0, 200) }); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.G && window.G.db, { timeout: 12000 });

  const matches = [];
  for (let mi = 0; mi < N; mi++) {
    await page.evaluate(i => window.__quickMatch(30 + i * 17, 110 + i * 13), mi);
    await page.waitForTimeout(600);

    const fps = await page.evaluate(() => new Promise(res => {
      let n = 0; const t0 = performance.now();
      const tick = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(tick); else res(+(n / 5).toFixed(1)); };
      requestAnimationFrame(tick);
    }));

    await page.evaluate(() => { const bt = [...document.querySelectorAll('.spd')].find(x => /TURBO/i.test(x.textContent)); if (bt) bt.click(); });
    const inv = { samples: 0, ballOffPitch: 0, ballAboveStands: 0, nonFiniteVisual: 0, aerialFrames: 0, crossKinds: {}, stallMax: 0, goalChecks: [] };
    let lastMin = -1, stall = 0, lastScore = '0,0', crossShotTaken = fs.existsSync(path.join(OUTDIR, 'evid-aerial.png'));
    const t0 = Date.now();
    while (Date.now() - t0 < 6 * 60 * 1000) {
      const s = await page.evaluate(() => {
        const sim = window.GAME && window.GAME._sim && window.GAME._sim(); if (!sim) return null;
        const st = sim.getState(); const bl = st.ball;
        const F = window.CDS_F25D;
        let projOk = true, projY = null;
        if (F) {
          const pj = F.project(bl.x * (1024 - 24) / 105 + 12, bl.y * (500 - 24) / 68 + 12);
          projOk = Number.isFinite(pj.x) && Number.isFinite(pj.y);
          projY = typeof F.elevatedY === 'function' ? F.elevatedY(pj, bl.z || 0) : pj.y - (bl.z || 0) * 22 * pj.s;
        }
        return {
          over: sim.isOver(), minute: +sim.minute.toFixed(2), score: sim.score.slice(),
          dom: ((document.querySelector('#score') || {}).textContent || '').trim(),
          ball: { x: +bl.x.toFixed(2), y: +bl.y.toFixed(2), z: +(bl.z || 0).toFixed(2), traveling: !!bl.traveling, kind: bl.kind || null },
          finite: [bl.x, bl.y, bl.z || 0].every(Number.isFinite) && st.teams.every(t => t.players.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))),
          projOk, projY
        };
      }).catch(() => null);
      if (!s) break;
      inv.samples++;
      if (!s.finite || !s.projOk) inv.nonFiniteVisual++;
      if (s.ball.x < -2 || s.ball.x > 107 || s.ball.y < -2 || s.ball.y > 70) inv.ballOffPitch++;
      if (s.projY != null && s.projY < 36 && s.ball.z > 0.5) inv.ballAboveStands++;
      if (s.ball.traveling && s.ball.z > 0.8) {
        inv.aerialFrames++;
        if (s.ball.kind) inv.crossKinds[s.ball.kind] = (inv.crossKinds[s.ball.kind] || 0) + 1;
        if (!crossShotTaken && s.ball.z > 1.2 && s.ball.kind !== 'shot') {
          await page.screenshot({ path: path.join(OUTDIR, 'evid-aerial.png') });
          crossShotTaken = true;
        }
      }
      const sc = s.score.join(',');
      if (sc !== lastScore) {
        lastScore = sc;
        setTimeout(() => {}, 0);
        const later = Date.now() + 7500;
        while (Date.now() < later) { await page.waitForTimeout(500); }
        const chk = await page.evaluate(() => {
          const sim = window.GAME._sim();
          return { sim: sim.score.slice(), dom: ((document.querySelector('#score') || {}).textContent || '').trim() };
        });
        inv.goalChecks.push({ ...chk, sync: chk.dom === `${chk.sim[0]}–${chk.sim[1]}` });
      }
      if (s.over) break;
      if (s.minute === lastMin) { stall++; inv.stallMax = Math.max(inv.stallMax, stall); } else { stall = 0; lastMin = s.minute; }
      if (stall >= 12) break;
      await page.waitForTimeout(1500);
    }

    const end = await page.evaluate(() => {
      const sim = window.GAME._sim(); if (!sim) return null;
      const r12 = typeof sim.getR12Audit === 'function' ? sim.getR12Audit() : null;
      const pre = typeof sim.getPre25DAuditReport === 'function' ? sim.getPre25DAuditReport() : null;
      const a = (pre && pre.audit) || {};
      const stx = sim.stats.map(t => ({ shots: t.shots || 0, corners: t.corners || 0, throwIns: t.throwIns || 0, goalKicks: t.goalKicks || 0, offsides: t.offsides || 0, fouls: t.fouls || 0 }));
      return {
        over: sim.isOver(), minute: +sim.minute.toFixed(1), score: sim.score.slice(),
        dom: ((document.querySelector('#score') || {}).textContent || '').trim(),
        canonical: r12 && r12.status, preStatus: pre && pre.status,
        hard: { ballTeleports: a.ballTeleports || 0, playerTeleports: a.playerTeleports || 0, nonFinite: a.nonFinite || 0, ownerNoContact: a.ownerChangesWithoutContact || 0, invalidTimelines: a.invalidTimelines || 0, frames: a.frames || 0 },
        stats: stx
      };
    }).catch(() => null);
    await page.screenshot({ path: path.join(OUTDIR, `match${mi}-end.png`) });
    matches.push({ index: mi, fps1x: fps, invariants: inv, end });
    console.log(`[${LABEL}] partida ${mi}: fps1x=${fps} over=${end && end.over} score=${end && end.score} canonical=${end && end.canonical} hard=${end && JSON.stringify(end.hard)}`);
  }

  const report = { build: BUILD, label: LABEL, at: new Date().toISOString(), matches, errors };
  fs.writeFileSync(path.join(OUTDIR, 'match-audit.json'), JSON.stringify(report, null, 1));
  console.log(`[${LABEL}] erros de página: ${errors.length}`);
  await browser.close();
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
