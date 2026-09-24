#!/usr/bin/env node
'use strict';
/**
 * SONDA DE MOVIMENTAÇÃO — mede o que o olho humano viu em 10 segundos.
 *
 * A auditoria inteira mediu travas, cobertura e contato, e nunca mediu se os
 * atletas se movem como jogadores. Esta sonda mede as quatro coisas relatadas:
 *
 *   1. BOTE       o defensor mais próximo acelera ou freia ao chegar na bola?
 *   2. CORRIDAS   quantos atacantes entram na área por ataque?
 *   3. DRIBLE     com que frequência o portador tenta passar pelo marcador?
 *   4. ESPALHAR   qual a largura e o comprimento reais ocupados pelo time?
 *
 * Reaproveita o ambiente da sonda oficial (mesmos shims, mesma carga de build).
 *
 *   node tools/r14/probe_movement.js --build=<html> --csv=<csv> --end=40 --out=<json>
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));

const BUILD = argv.build;
const CSV = argv.csv || 'tools/r13/COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv';
const END = Number(argv.end || 40);
const OUT = argv.out || 'reports/r14/movement/result.json';

// ── ambiente mínimo (espelha probe_balllock.js) ────────────────────────────
function noop() {}
function def(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
def('window', global); def('self', global);
def('navigator', { userAgent: 'cds-movement', language: 'pt-BR' });
def('location', { href: 'runner://mov', search: '', hash: '' });
def('performance', { now: () => 0 });
def('crypto', crypto.webcrypto);
def('requestAnimationFrame', () => 0); def('cancelAnimationFrame', noop);
def('addEventListener', noop); def('removeEventListener', noop);
def('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
def('alert', noop); def('confirm', () => true); def('prompt', () => null);
def('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
def('sessionStorage', global.localStorage);
def('CanvasRenderingContext2D', undefined);
def('HTMLElement', function () {}); def('HTMLCanvasElement', function () {});
def('Image', function () {}); def('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
def('__showBootError', noop); def('__cdsDebugWarn', noop); def('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);

function loadBuild(p) {
  const html = fs.readFileSync(p, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let m;
  while ((m = re.exec(html))) {
    const id = (m[1].match(/id="([^"]+)"/) || [])[1] || `script-${scripts.length}`;
    scripts.push({ id, code: m[2] });
  }
  scripts.forEach((s, i) => {
    if (SKIP.has(s.id)) return;
    try { vm.runInThisContext(s.code, { filename: `${i}-${s.id}.js` }); }
    catch (e) {
      if (/^script-\d+$/.test(s.id) && /document is not defined/.test(String(e && e.message || e))) return;
      throw e;
    }
  });
  return crypto.createHash('sha256').update(html).digest('hex');
}

function parseCSV(t) {
  const l = t.replace(/^﻿/, '').trim().split(/\r?\n/);
  const h = l.shift().split(',');
  return l.map(line => { const v = line.split(','); const r = {}; h.forEach((k, i) => r[k] = v[i]); return r; });
}

const sha = loadBuild(BUILD);
const rows = parseCSV(fs.readFileSync(CSV, 'utf8'));
const DT = 1 / 30;
const FL = 105, FW = 68;

function teamFor(db, row, home, idx) {
  const pre = home ? 'home' : 'away';
  const sq = db.squads.find(s => s.c === row[`${pre}Team`] && Number(s.y) === Number(row[`${pre}Year`]));
  const form = row[`${pre}Formation`];
  const fd = FORMATIONS[form];
  if (!sq || !fd) throw new Error('time ausente');
  const picked = autoLineup(sq, form, idx % fd.variations.length);
  return { squad: sq, name: sq.c, flag: sq.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: picked.lineup, bench: picked.bench, formKey: form, style: row[`${pre}Style`] };
}

const A = {
  // 1. BOTE: velocidade do defensor mais próximo em função da distância à bola
  closeBins: {},        // faixa de distância -> {soma de velocidade, n}
  // 2. CORRIDAS
  ataques: 0, atacantesNaArea: 0, maxNaArea: 0,
  // 3. DRIBLE / ações
  eventos: {},
  // 4. ESPALHAR
  larguraSoma: 0, comprimentoSoma: 0, amostrasForma: 0,
  // distribuição de esforço
  velBins: [0, 0, 0, 0, 0], amostrasVel: 0
};

const bin = d => d < 2 ? '0-2m' : d < 4 ? '2-4m' : d < 7 ? '4-7m' : d < 12 ? '7-12m' : '12m+';

function observar(sim) {
  const b = sim.ball;
  if (!b) return;
  const dono = b.owner;

  // ── 1. BOTE: quem é o adversário mais próximo da bola e a que velocidade vai
  if (dono) {
    const adv = sim.teams[1 - dono.team].players.filter(p => !p.red && !p.isGK);
    let near = null, nd = 1e9;
    for (const p of adv) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < nd) { nd = d; near = p; } }
    if (near && nd < 20) {
      const v = Math.hypot(near.vx || 0, near.vy || 0);
      const k = bin(nd);
      (A.closeBins[k] || (A.closeBins[k] = { v: 0, n: 0 })).v += v;
      A.closeBins[k].n++;
    }
  }

  // ── 2. CORRIDAS: atacantes dentro da área adversária durante posse estabelecida
  if (dono) {
    const tm = sim.teams[dono.team];
    const g = tm.oppGoal;
    const naArea = tm.players.filter(p => !p.red && !p.isGK &&
      Math.abs(p.x - g.x) < 16.5 && Math.abs(p.y - g.y) < 20).length;
    if (Math.abs(b.x - g.x) < 35) {   // só conta quando o ataque chegou perto
      A.ataques++;
      A.atacantesNaArea += naArea;
      if (naArea > A.maxNaArea) A.maxNaArea = naArea;
    }
  }

  // ── 4. ESPALHAR: caixa ocupada pelos 10 de linha do time com a bola
  if (dono) {
    const pl = sim.teams[dono.team].players.filter(p => !p.red && !p.isGK);
    if (pl.length > 4) {
      const xs = pl.map(p => p.x), ys = pl.map(p => p.y);
      A.comprimentoSoma += Math.max(...xs) - Math.min(...xs);
      A.larguraSoma += Math.max(...ys) - Math.min(...ys);
      A.amostrasForma++;
    }
  }

  // ── distribuição de velocidade de TODOS os atletas de linha
  for (const tm of sim.teams) for (const p of tm.players) {
    if (p.red || p.isGK) continue;
    const v = Math.hypot(p.vx || 0, p.vy || 0);
    A.amostrasVel++;
    if (v < 1) A.velBins[0]++; else if (v < 3) A.velBins[1]++;
    else if (v < 5) A.velBins[2]++; else if (v < 7) A.velBins[3]++; else A.velBins[4]++;
  }
}

const db = buildDB(DATA);   // mesmo global que a sonda oficial usa
let partidas = 0;
for (let i = 0; i < Math.min(END, rows.length); i++) {
  const row = rows[i];
  srand(Number(row.seed));
  const sim = new MatchSim(teamFor(db, row, true, i), teamFor(db, row, false, i), { neutral: true, labMode: true });
  const oldEmit = sim._emit;
  sim._emit = function (t) { A.eventos[t] = (A.eventos[t] || 0) + 1; return oldEmit.apply(this, arguments); };
  let n = 0;
  while (!sim.isOver() && n++ < 40000) { sim.step(DT); if (n % 6 === 0) observar(sim); }
  partidas++;
  realConsole.error(`[mov] partida ${i} seed=${row.seed} ok`);
}

const vt = A.amostrasVel || 1;
const out = {
  build: sha, partidas,
  bote: Object.fromEntries(Object.entries(A.closeBins).map(([k, v]) =>
    [k, +(v.v / v.n).toFixed(2)])),
  corridas: {
    atacantesNaAreaMedia: +(A.atacantesNaArea / Math.max(A.ataques, 1)).toFixed(2),
    maximoObservado: A.maxNaArea
  },
  forma: {
    larguraMedia: +(A.larguraSoma / Math.max(A.amostrasForma, 1)).toFixed(1),
    comprimentoMedio: +(A.comprimentoSoma / Math.max(A.amostrasForma, 1)).toFixed(1),
    larguraDoCampo: FW, comprimentoDoCampo: FL
  },
  velocidade: {
    'parado (<1)': +(A.velBins[0] / vt * 100).toFixed(1),
    'caminhando (1-3)': +(A.velBins[1] / vt * 100).toFixed(1),
    'trotando (3-5)': +(A.velBins[2] / vt * 100).toFixed(1),
    'correndo (5-7)': +(A.velBins[3] / vt * 100).toFixed(1),
    'sprint (>7)': +(A.velBins[4] / vt * 100).toFixed(1)
  },
  acoesPorPartida: Object.fromEntries(['pass', 'dribble', 'tackle', 'tackle_attempt', 'shot_taken',
    'cross', 'pressure', 'containment'].map(k => [k, +((A.eventos[k] || 0) / partidas).toFixed(2)]))
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');

realConsole.error('\n=== BOTE: velocidade do adversário mais próximo (m/s) ===');
for (const k of ['0-2m', '2-4m', '4-7m', '7-12m', '12m+']) if (out.bote[k] != null) realConsole.error(`  ${k.padEnd(7)} ${out.bote[k]}`);
realConsole.error('\n=== CORRIDAS ===');
realConsole.error(`  atacantes na área (média)  ${out.corridas.atacantesNaAreaMedia}   máximo ${out.corridas.maximoObservado}`);
realConsole.error('\n=== FORMA DO TIME COM A BOLA ===');
realConsole.error(`  largura ocupada    ${out.forma.larguraMedia} m  de ${FW} m`);
realConsole.error(`  comprimento        ${out.forma.comprimentoMedio} m  de ${FL} m`);
realConsole.error('\n=== TEMPO EM CADA VELOCIDADE (%) ===');
for (const [k, v] of Object.entries(out.velocidade)) realConsole.error(`  ${k.padEnd(20)} ${v}%`);
realConsole.error('\n=== AÇÕES POR PARTIDA ===');
for (const [k, v] of Object.entries(out.acoesPorPartida)) realConsole.error(`  ${k.padEnd(18)} ${v}`);
realConsole.error(`\n[gravado] ${OUT}`);
