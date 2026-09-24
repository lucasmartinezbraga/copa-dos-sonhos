#!/usr/bin/env node
'use strict';
/*
 * AUDITORIA COMPLETA DE FLUXO EM NAVEGADOR REAL
 * Joga o jogo como um humano: home → setup → draft (picks reais) → Copa →
 * pré-jogo → partida completa (TURBO) → resultado → continuar → save/load.
 * Em cada estágio captura pageerrors, console.error, tela atual e screenshots.
 * Durante a partida monitora: avanço do relógio (stall), placar DOM × motor,
 * e ao final o status canônico R12 + o auditor de runtime pré-2.5D embutido
 * (teleportes de bola/jogador, não-finitos, posse sem contato, timelines).
 *
 * uso: node tools/ux/audit_flow.js --build="dist/....html" --out=reports/... [--label=rcux]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const BUILD = argv.build || 'dist/COPA DOS SONHOS - RC-UX.html';
const LABEL = argv.label || 'build';
const OUTDIR = path.join(ROOT, argv.out || `reports/ux/audit-${LABEL}`);
const URL = 'file://' + path.join(ROOT, BUILD);

const report = { build: BUILD, label: LABEL, startedAt: new Date().toISOString(), stages: [], errors: [], verdict: null };
let page;

function stage(name, data) {
  const s = Object.assign({ name, t: Date.now() }, data || {});
  report.stages.push(s);
  console.log(`[${LABEL}] ${name}${data ? ' ' + JSON.stringify(data).slice(0, 140) : ''}`);
  return s;
}
async function shot(tag) {
  try { await page.screenshot({ path: path.join(OUTDIR, `${tag}.png`) }); } catch (e) {}
}
async function gscreen() { return page.evaluate(() => window.G && window.G.screen).catch(() => null); }
async function clickIf(sel) {
  return page.evaluate(s => { const el = document.querySelector(s); if (el && el.offsetParent && !el.disabled) { el.click(); return true; } return false; }, sel);
}

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', e => { report.errors.push({ where: current(), type: 'pageerror', msg: String(e.message).slice(0, 300) }); console.log(`  !! pageerror @${current()}: ${String(e.message).slice(0, 140)}`); });
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (/net::|favicon/.test(t)) return; report.errors.push({ where: current(), type: 'console', msg: t.slice(0, 300) }); } });
  function current() { return report.stages.length ? report.stages[report.stages.length - 1].name : 'boot'; }

  // 1. BOOT
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const booted = await page.waitForFunction(() => window.G && window.G.db, { timeout: 12000 }).then(() => true).catch(() => false);
  stage('boot', { ok: booted, screen: await gscreen() });
  await shot('01-home');
  if (!booted) throw new Error('boot falhou');

  // limpar save p/ fluxo limpo
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  // 2. HOME → SETUP
  await clickIf('#bt-start'); await page.waitForTimeout(400);
  stage('setup', { screen: await gscreen() });
  await shot('02-setup');

  // 3. SETUP: escolhe modo + estilo (obrigatório) como um humano, depois draft
  await page.evaluate(() => {
    const mode = document.querySelector('[data-modo="classico"]'); if (mode) mode.click();
    const style = document.querySelector('[data-style="balanced"]') || document.querySelector('[data-style]');
    if (style) style.click();
  });
  await page.waitForTimeout(350);
  await clickIf('#bt-draft'); await page.waitForTimeout(600);
  stage('draft-start', { screen: await gscreen(), style: await page.evaluate(() => window.G.style), modo: await page.evaluate(() => window.G.modo) });
  await shot('03-draft');

  // 4. DRAFT: loop real de picks — jogador ([data-pid]) e depois posição (.chip.can)
  let picks = 0, safety = 0, rowIdx = 0;
  while (safety++ < 160) {
    const scr = await gscreen();
    if (scr !== 'draft') break;
    const fill = await page.evaluate(() => window.G.draft ? window.G.draft.slots.filter(s => s.p).length : -1);
    if (fill >= 11) { if (await clickIf('#bt-tocup')) { await page.waitForTimeout(800); break; } }
    if (await clickIf('#bt-roll')) {
      await page.waitForFunction(() => { const d = window.G.draft; return d && !d.revealing && !d.busy && d.cur; }, { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(200); continue;
    }
    // nunca interage durante a revelação/anim (cliques são ignorados pelo jogo)
    const ready = await page.evaluate(() => { const d = window.G.draft; return !!(d && !d.revealing && !d.busy && d.cur); });
    if (!ready) { await page.waitForTimeout(300); continue; }
    // seleciona um jogador que caiba em algum slot vazio (rotaciona se não couber)
    const step = await page.evaluate((idx) => {
      const rows = [...document.querySelectorAll('#d-plist [data-pid]')].filter(r => r.offsetParent && !/JÁ NO SEU TIME/.test(r.textContent || ''));
      if (!rows.length) return { st: 'no-rows' };
      const row = rows[idx % rows.length];
      row.click();
      return { st: 'picked', name: (row.textContent || '').trim().slice(0, 24) };
    }, rowIdx);
    if (step.st === 'picked') {
      await page.waitForTimeout(260);
      const placed = await page.evaluate(() => {
        const slot = document.querySelector('#dpitch .chip.can');
        if (slot) { slot.click(); return true; } return false;
      });
      if (placed) { picks++; rowIdx = 0; await page.waitForTimeout(420); continue; }
      rowIdx++;
      // esgotou os jogadores desta seleção sem encaixe: usa reroll como um humano
      const rows = await page.evaluate(() => document.querySelectorAll('#d-plist [data-pid]').length);
      if (rowIdx >= rows + 2) {
        rowIdx = 0;
        const rerolled = (await clickIf('#bt-rteam')) || (await clickIf('#bt-rcup'));
        stage('draft-reroll', { rerolled, starters: fill });
        await page.waitForTimeout(900);
        if (!rerolled) break;                                   // sem rerolls: reporta e segue
      }
      await page.waitForTimeout(140);
      continue;
    }
    await page.waitForTimeout(450);
  }
  const draftState = await page.evaluate(() => ({
    screen: window.G.screen,
    starters: window.G.draft ? window.G.draft.slots.filter(s => s.p).length : ((window.G.lineup || []).filter(Boolean).length),
    bench: window.G.draft ? (window.G.draft.benchPicks || []).length : 0
  }));
  stage('draft-done', Object.assign({ picks, iter: safety }, draftState));
  await shot('04-pos-draft');

  // 5. HUB DA COPA → PRÉ-JOGO → PARTIDA
  for (let i = 0; i < 12 && (await gscreen()) !== 'match'; i++) {
    if (await clickIf('#bt-play')) { await page.waitForTimeout(700); continue; }
    if (await clickIf('.pm26-start')) { await page.waitForTimeout(900); continue; }
    if (await clickIf('#po-confirm')) { await page.waitForTimeout(700); continue; }
    const b = await page.evaluate(() => {
      const c = [...document.querySelectorAll('button')].find(x => x.offsetParent && !x.disabled && /iniciar partida|jogar partida|come.ar/i.test(x.textContent || ''));
      if (c) { c.click(); return (c.textContent || '').trim().slice(0, 30); } return null;
    });
    await page.waitForTimeout(700);
    if (!b) await page.waitForTimeout(400);
  }
  stage('match-start', { screen: await gscreen() });
  await shot('05-partida-inicio');
  if ((await gscreen()) !== 'match') throw new Error('não chegou à partida pelo fluxo real');

  // 6. PARTIDA COMPLETA em TURBO com monitor de stall + placar
  await page.evaluate(() => { const bt = [...document.querySelectorAll('.spd')].find(x => /TURBO/i.test(x.textContent)); if (bt) bt.click(); });
  const monitor = [];
  let lastMin = -1, stallTicks = 0, maxStall = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 6 * 60 * 1000) {
    const m = await page.evaluate(() => {
      const s = window.GAME && window.GAME._sim && window.GAME._sim();
      if (!s) return null;
      return {
        minute: +s.minute.toFixed(2), half: s.half, over: s.isOver(),
        score: s.score.slice(),
        dom: ((document.querySelector('#score') || {}).textContent || '').trim(),
        clock: ((document.querySelector('#clock') || {}).textContent || '').trim(),
        paused: !!window.paused
      };
    }).catch(() => null);
    if (!m) break;
    monitor.push(m);
    if (m.over) break;
    if (m.minute === lastMin) { stallTicks++; maxStall = Math.max(maxStall, stallTicks); }
    else { stallTicks = 0; lastMin = m.minute; }
    if (stallTicks >= 10) { stage('match-STALL', m); await shot('05b-stall'); break; }
    await page.waitForTimeout(2000);
  }
  const endState = await page.evaluate(() => {
    const s = window.GAME._sim(); if (!s) return null;
    const r12 = typeof s.getR12Audit === 'function' ? s.getR12Audit() : null;
    const pre = typeof s.getPre25DAuditReport === 'function' ? s.getPre25DAuditReport() : null;
    const a = pre && pre.audit || {};
    return {
      over: s.isOver(), score: s.score.slice(), minute: +s.minute.toFixed(1),
      dom: ((document.querySelector('#score') || {}).textContent || '').trim(),
      canonical: r12 && r12.status,
      preStatus: pre && pre.status,
      hard: {
        ballTeleports: a.ballTeleports, playerTeleports: a.playerTeleports,
        nonFinite: a.nonFinite, ownerNoContact: a.ownerChangesWithoutContact,
        invalidTimelines: a.invalidTimelines, outOfBounds: a.outOfBounds,
        frames: a.frames
      }
    };
  }).catch(e => ({ err: String(e).slice(0, 200) }));
  stage('match-end', endState || { err: 'sem sim' });
  await shot('06-fim-de-jogo');

  // 7. RESULTADO → CONTINUAR → COPA
  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) { if (await clickIf('#bt-continue')) break; await page.waitForTimeout(900); }
  await page.waitForTimeout(900);
  stage('pos-resultado', { screen: await gscreen() });
  await shot('07-copa');

  // 8. SAVE/LOAD: recarrega e continua
  const hadSave = await page.evaluate(() => { try { return Object.keys(localStorage).length > 0; } catch (e) { return false; } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.G && window.G.db, { timeout: 12000 }).catch(() => {});
  const cont = await clickIf('#bt-continue');
  await page.waitForTimeout(1000);
  stage('save-load', { hadSave, continueBtn: cont, screen: await gscreen() });
  await shot('08-continuar');

  // veredito
  const hardSum = endState && endState.hard ? Object.entries(endState.hard).filter(([k]) => k !== 'frames' && k !== 'outOfBounds').reduce((n, [, v]) => n + (v || 0), 0) : -1;
  report.verdict = {
    completedMatch: !!(endState && endState.over),
    canonical: endState && endState.canonical,
    scoreSync: endState ? endState.dom === `${endState.score[0]}–${endState.score[1]}` : false,
    engineHardViolations: hardSum,
    maxStallTicks: maxStall,
    totalErrors: report.errors.length
  };
  report.monitorTail = monitor.slice(-6);
  fs.writeFileSync(path.join(OUTDIR, 'audit.json'), JSON.stringify(report, null, 1));
  console.log(`\n[${LABEL}] VEREDITO:`, JSON.stringify(report.verdict));
  console.log(`[${LABEL}] erros (${report.errors.length}):`);
  const seen = new Set();
  for (const e of report.errors) { const k = e.msg.slice(0, 80); if (seen.has(k)) continue; seen.add(k); console.log(`   @${e.where} [${e.type}] ${k}`); }
  await browser.close();
})().catch(async e => {
  console.error(`[${LABEL}] ABORTOU: ${e.message}`);
  report.aborted = e.message;
  try { await shot('99-abort'); } catch (_) {}
  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'audit.json'), JSON.stringify(report, null, 1));
  process.exit(1);
});
