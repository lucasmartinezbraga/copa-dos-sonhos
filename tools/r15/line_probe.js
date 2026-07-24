#!/usr/bin/env node
'use strict';
/**
 * DE ONDE VEM O ROMPIMENTO DA LINHA DEFENSIVA.
 *
 * Medido: com a amostragem alargada, o alcance médio da linha é 14,06 m
 * (limite 10) e ela aparece desconectada em 34% das amostras — contra 7,12 m e
 * 0% quando só a fase `defensive_block` era medida.
 *
 * Hipótese a testar: não existe uma linha. Existe um ESCALAR `_r13LineDepth` que
 * apenas uma minoria dos defensores segue. Pelo probe de ramos, o ramo `DEF` —
 * o único que posiciona por `line + stagger` — responde por 12,4% das chamadas;
 * os outros 87,6% são posicionados por regras que ignoram a linha:
 *
 *   presser  → vai na bola
 *   cover    → 7,2 m da bola, na direção do próprio gol
 *   shadow   → entre a bola e o atacante
 *   markRef  → segue o atacante, com folga de ±3,0 m (±3,9 em sobrecarga)
 *
 * Este probe mede, para cada jogador classificado como DEF, qual ramo o
 * posicionou e o quanto ele ficou longe do escalar da linha. Se o rompimento
 * vier dos ramos que ignoram a linha, o conserto não é ajustar o escalar.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));

function noop() {}
function def(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
def('window', global); def('self', global);
def('navigator', { userAgent: 'cds-line', language: 'pt-BR' });
def('location', { href: 'runner://line', search: '', hash: '' });
def('performance', { now: () => 0 }); def('crypto', crypto.webcrypto);
def('requestAnimationFrame', noop); def('cancelAnimationFrame', noop);
def('localStorage', { _d: {}, getItem(k){return this._d[k]==null?null:this._d[k];},
  setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];}, clear(){this._d={};} });
const rc = console;
def('console', Object.assign({}, console, { log: noop, info: noop, warn: noop, debug: noop }));

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

const DEF_SLOTS = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const BR = ['presser', 'markRef', 'dropper', 'cover', 'shadow', 'DEF', 'MID', 'base'];
const stat = {};
for (const b of BR) stat[b] = { n: 0, devSum: 0, devMax: 0, over3: 0, over6: 0 };

let sim = null;
const orig = P._defendTarget;
P._defendTarget = function (tm, p, b, presser) {
  const out = orig.apply(this, arguments);
  const pos = p.oopPos || p.slotPos;
  if (DEF_SLOTS.includes(pos) && out && tm._r13LineDepth != null) {
    let br;
    if (p === presser) br = 'presser';
    else if (p._markRef && !p._markRef.red) br = 'markRef';
    else if (p === tm._r13Dropper) br = 'dropper';
    else if (p === tm._cover) br = 'cover';
    else if (p === tm._shadow && tm._shadowTgt) br = 'shadow';
    else br = 'DEF';
    // Progresso do ALVO a partir do próprio gol, comparável ao escalar da linha.
    const prog = tm.goal.x < 52.5 ? out[0] : 105 - out[0];
    const dev = Math.abs(prog - tm._r13LineDepth);
    const s = stat[br];
    s.n++; s.devSum += dev;
    if (dev > s.devMax) s.devMax = dev;
    if (dev > 3) s.over3++;
    if (dev > 6) s.over6++;
  }
  return out;
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
      _a: {} }});
  });
  picked.bench = [];
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: picked.lineup, bench: [], formKey: formation, style };
}

const db = buildDB(DATA);
const seeds = Number(argv.seeds || 10);
for (let s = 0; s < seeds; s++) {
  srand(5200000 + s * 733);
  sim = new MatchSim(labTeam(db, '4-3-3', 'balanced', true),
                     labTeam(db, '4-3-3', 'balanced', false),
                     { neutral: true, labMode: true });
  sim.teams[0].formKey = '4-3-3'; sim.teams[1].formKey = '4-3-3';
  const DT = 1 / 30; let n = 0;
  while (!sim.isOver() && n++ < 500000) sim.step(DT);
}

const tot = BR.reduce((a, b) => a + stat[b].n, 0) || 1;
rc.error(`build sha=${sha.slice(0,12)} · ${seeds} partidas`);
rc.error(`amostras de jogadores da LINHA DEFENSIVA: ${tot}\n`);
rc.error(`${'ramo'.padEnd(10)}${'share'.padStart(8)}${'desvio med'.padStart(12)}${'max'.padStart(9)}${'>3m'.padStart(8)}${'>6m'.padStart(8)}`);
for (const b of BR) {
  const s = stat[b];
  if (!s.n) continue;
  rc.error(`${b.padEnd(10)}${(s.n/tot*100).toFixed(1).padStart(7)}%` +
    `${(s.devSum/s.n).toFixed(2).padStart(12)}${s.devMax.toFixed(1).padStart(9)}` +
    `${(s.over3/s.n*100).toFixed(1).padStart(7)}%${(s.over6/s.n*100).toFixed(1).padStart(7)}%`);
}
const linha = stat.DEF.n ? stat.DEF.devSum/stat.DEF.n : 0;
const fora = BR.filter(b=>b!=='DEF').reduce((a,b)=>a+stat[b].devSum,0);
const foraN = BR.filter(b=>b!=='DEF').reduce((a,b)=>a+stat[b].n,0);
rc.error(`\ndesvio médio de quem SEGUE a linha (ramo DEF): ${linha.toFixed(2)} m`);
rc.error(`desvio médio de quem NÃO segue (todos os outros): ${(fora/(foraN||1)).toFixed(2)} m`);

fs.writeFileSync(argv.out || 'reports/r15/linha-defensiva.json', JSON.stringify({
  build: argv.build, sha256: sha, seeds, samples: tot,
  byBranch: Object.fromEntries(BR.filter(b=>stat[b].n).map(b => [b, {
    n: stat[b].n, share: +(stat[b].n/tot).toFixed(4),
    devMean: +(stat[b].devSum/stat[b].n).toFixed(3),
    devMax: +stat[b].devMax.toFixed(2),
    over3Share: +(stat[b].over3/stat[b].n).toFixed(4),
    over6Share: +(stat[b].over6/stat[b].n).toFixed(4),
  }])),
  devMean_lineFollowers: +linha.toFixed(3),
  devMean_others: +(fora/(foraN||1)).toFixed(3),
}, null, 1));
rc.error(`\nartefato: ${argv.out || 'reports/r15/linha-defensiva.json'}`);
