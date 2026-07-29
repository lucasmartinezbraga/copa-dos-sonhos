#!/usr/bin/env node
'use strict';
/* DE ONDE VEM (E DE ONDE NAO VEM) O ESCANTEIO
   -------------------------------------------------------------------------
   A R18.31 matou o escanteio fabricado do ramo !atk de _cross. Acertou. Mas a
   fonte LEGITIMA continuou fechada, e o resultado e que a build R18.35 entrega
   0,83 escanteio por partida contra uma faixa de design de 4 a 10.

   A fonte legitima e o corte afobado em _clearBall:

     if (D(o,gol) < 20 && nearestOpponent < 3,2 && chance(.16)) -> escanteio

   Tres condicoes multiplicadas. Este instrumento mede o funil: quantos cortes
   acontecem, quantos passam por CADA condicao, e o produto final. Mede tambem
   a PROVENIENCIA de todo escanteio (por quadro da pilha), para saber quais
   fontes ainda existem de verdade.
   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-corte', language: 'pt-BR' });
define('location', { href: 'runner://corte', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); }
  catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message || e))) continue; throw e; }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };

const N = Number(argv.matches || 4), DT = 1 / 30;
const SEED = Number(argv.seed || 1710000);
const T = {
  cortes: 0, perto20: 0, pressionado: 0, ambos: 0, virouCanto: 0,
  distGol: [], distOpp: [],
  cantos: 0, origem: Object.create(null), cantoEvt: 0,
};

for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(SEED + i * 977);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  const proto = Object.getPrototypeOf(sim);

  const oEmit = proto._emit;
  sim._emit = function (t) { if (t === 'corner') T.cantoEvt++; return oEmit.apply(this, arguments); };

  /* O funil do corte afobado, medido ANTES do dado. */
  const oClear = proto._clearBall;
  sim._clearBall = function (o) {
    T.cortes++;
    const tm = this.teams[o.team];
    const dg = D(o.x, o.y, tm.goal.x, tm.goal.y);
    const dOpp = this._nearestOpponent(o).dist;
    T.distGol.push(dg); T.distOpp.push(dOpp);
    const a = dg < 20, b = dOpp < 3.2;
    if (a) T.perto20++;
    if (b) T.pressionado++;
    if (a && b) T.ambos++;
    return oClear.apply(this, arguments);
  };

  /* Proveniencia: qual linha do bundle pediu este escanteio. */
  const oCorner = proto._setCorner;
  sim._setCorner = function () {
    T.cantos++;
    const st = String(new Error().stack || '').split('\n');
    let frame = '?';
    for (let k = 2; k < st.length; k++) { if (!/_setCorner/.test(st[k])) { frame = st[k].trim().replace(/^at\s+/, ''); break; } }
    T.origem[frame] = (T.origem[frame] || 0) + 1;
    return oCorner.apply(this, arguments);
  };

  let s = 0; while (!sim.isOver() && s++ < 400000) sim.step(DT);
}

const nPart = N * 3;
const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(b.length * p)].toFixed(1); };
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);

realConsole.log(JSON.stringify({
  build: (global.CDS_BUILD_ID || '?'), partidas: nPart,
  FUNIL_DO_CORTE: {
    cortes: T.cortes, porPartida: +(T.cortes / nPart).toFixed(2),
    passam_dist_menor_20m: T.perto20, pct_dist: pct(T.perto20, T.cortes),
    passam_opp_menor_3_2m: T.pressionado, pct_opp: pct(T.pressionado, T.cortes),
    passam_AMBOS: T.ambos, pct_ambos: pct(T.ambos, T.cortes),
    apos_o_dado_16pct_esperado: +(T.ambos * 0.16).toFixed(1),
    distancia_ao_proprio_gol: { p10: q(T.distGol, .1), mediana: q(T.distGol, .5), p90: q(T.distGol, .9) },
    distancia_do_adversario: { p10: q(T.distOpp, .1), mediana: q(T.distOpp, .5), p90: q(T.distOpp, .9) },
  },
  ESCANTEIOS: {
    setCorner_chamado: T.cantos, evento_corner: T.cantoEvt,
    porPartida_evento: +(T.cantoEvt / nPart).toFixed(2), faixaDesign: '4 a 10',
    proveniencia: Object.fromEntries(Object.entries(T.origem).sort((a, b) => b[1] - a[1])),
  },
}, null, 2));
