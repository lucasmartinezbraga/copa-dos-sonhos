#!/usr/bin/env node
'use strict';
/**
 * Cobertura de ramos de `_defendTarget` — quem REALMENTE decide onde o
 * defensor fica.
 *
 * Motivo: a mutação `mut-line-scatter` espalhou o stagger da linha de 0,42 m
 * para 14 m e o gate `defensive_line_range` continuou em 7,52 (PASS). Duas
 * hipóteses, e este probe separa as duas:
 *
 *   H1 — o ramo DEF quase nunca executa (quem tem `_markRef` retorna antes),
 *        então a mutação caiu em código raro;
 *   H2 — o ramo executa e o gate é que não mede.
 *
 * Também mede quantas amostras a fase `defensive_block` realmente produz, já
 * que o gate só conta a linha nessa fase (30-r13-football-observer.js:802).
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));

function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-branch', language: 'pt-BR' });
define('location', { href: 'runner://branch', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', noop); define('cancelAnimationFrame', noop);
define('localStorage', { _d: {}, getItem(k){return this._d[k]==null?null:this._d[k];},
  setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];}, clear(){this._d={};} });
const rc = console;
define('console', Object.assign({}, console, { log: noop, info: noop, warn: noop, debug: noop }));

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);

const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || `script-${i}`; i++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(m[2], { filename: id + '.js' }); }
  catch (e) {
    if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message))) continue;
    throw e;
  }
}
const sha = crypto.createHash('sha256').update(html).digest('hex');

const P = MatchSim.prototype;
const counts = {
  total: 0, presser: 0, interceptLane: 0, markRef: 0, dropper: 0,
  cover: 0, shadow: 0, DEF: 0, MID: 0, fallbackBase: 0,
};
const phaseCount = {};

// Reimplementa a MESMA cadeia de condições do dono vivo (30-…:540) só para
// classificar o ramo. Não altera nada: chama o original e devolve o resultado.
const orig = P._defendTarget;
P._defendTarget = function (tm, p, b, presser) {
  counts.total++;
  const S = this.__r13State || null;
  if (p === presser) counts.presser++;
  else if (p._markRef && !p._markRef.red) counts.markRef++;
  else if (p === tm._r13Dropper) counts.dropper++;
  else if (p === tm._cover) counts.cover++;
  else if (p === tm._shadow && tm._shadowTgt) counts.shadow++;
  else {
    const pos = p.oopPos || p.slotPos;
    if (['CB','LB','RB','LWB','RWB'].includes(pos)) counts.DEF++;
    else if (['CDM','CM','CAM','LM','RM'].includes(pos)) counts.MID++;
    else counts.fallbackBase++;
  }
  return orig.apply(this, arguments);
};

// Amostra a fase coletiva na mesma cadência do observador (0,5 s).
const oldStep = P.step;
let acc = 0;
P.step = function (dt) {
  const r = oldStep.apply(this, arguments);
  acc += dt;
  if (acc >= 0.5) {
    acc = 0;
    const st = this.__r13State;
    if (st && st.phaseByTeam) {
      for (const side of [0, 1]) {
        const ph = st.phaseByTeam[side];
        if (ph) phaseCount[ph] = (phaseCount[ph] || 0) + 1;
      }
    }
  }
  return r;
};

function labTeam(db, formation, style, home) {
  const squad = db.squads[0];
  const picked = autoLineup(squad, formation, 0);
  const keys = (global.CDSDataV3 && global.CDSDataV3.attributes) || [];
  picked.lineup = picked.lineup.map((slot, idx) => {
    const position = slot.pos || 'CM';
    return Object.assign({}, slot, { p: {
      id: `LAB_${position}_${idx}`, n: `Atleta ${idx + 1}`, slot: position, pos: position,
      r: 82, starter: 1, traits: [], behaviorTraits: [], naturalRoles: [],
      a8: [82,82,82,82,82,82,82,82],
      attributesV3: Object.fromEntries(keys.map(k => [k, 82])),
      profileV3: { dominantFoot:'R', weakFoot:4, heightCmSim: position==='GK'?190:182,
                   bodyType:'average', primaryPosition: position },
      _a: {}
    }});
  });
  picked.bench = [];
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: picked.lineup, bench: [], formKey: formation, style };
}

const db = buildDB(DATA);
const seeds = Number(argv.seeds || 8);
let lineSamplesTotal = 0;
for (let s = 0; s < seeds; s++) {
  srand(5100000 + s * 811);
  const sim = new MatchSim(labTeam(db, '4-3-3', 'balanced', true),
                           labTeam(db, '4-3-3', 'balanced', false),
                           { neutral: true, labMode: true });
  sim.teams[0].formKey = '4-3-3'; sim.teams[1].formKey = '4-3-3';
  const DT = 1 / 30; let n = 0;
  while (!sim.isOver() && n++ < 500000) sim.step(DT);
  const a = sim.getR13Audit();
  lineSamplesTotal += (a.metrics && a.metrics.lineSamples) || 0;
}

const tot = counts.total || 1;
rc.error(`build sha=${sha.slice(0, 12)} · ${seeds} partidas · ${counts.total} chamadas a _defendTarget\n`);
rc.error('ramo que decidiu a posição defensiva:');
for (const k of ['presser','markRef','dropper','cover','shadow','DEF','MID','fallbackBase']) {
  const pct = (counts[k] / tot * 100);
  rc.error(`  ${k.padEnd(14)} ${String(counts[k]).padStart(9)}  ${pct.toFixed(2).padStart(6)}%`);
}
rc.error('\nfase coletiva amostrada (0,5 s):');
const ptot = Object.values(phaseCount).reduce((a, b) => a + b, 0) || 1;
for (const [k, v] of Object.entries(phaseCount).sort((a, b) => b[1] - a[1]))
  rc.error(`  ${k.padEnd(22)} ${String(v).padStart(8)}  ${(v / ptot * 100).toFixed(2).padStart(6)}%`);
rc.error(`\nlineSamples somados (só fase defensive_block): ${lineSamplesTotal}`);

fs.writeFileSync(argv.out || 'reports/r15/defend-branches.json', JSON.stringify({
  build: argv.build, sha256: sha, seeds, counts, phaseCount,
  lineSamplesTotal,
  share: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / tot).toFixed(5)])),
}, null, 1));
rc.error(`\nartefato: ${argv.out || 'reports/r15/defend-branches.json'}`);
