#!/usr/bin/env node
'use strict';
/* OCUPAÇÃO DA ÁREA NO MOMENTO DO CRUZAMENTO
   -------------------------------------------------------------------------
   Funil medido: 19,12 cruzamentos por partida, mas só 1,20 cabeceios ao gol e
   0,88 cortes de cabeça. Uns cinco cruzamentos aéreos somem sem virar disputa.

   Hipótese: a área está VAZIA quando a bola chega. O motor exige alvo aéreo
   dentro de 24 m do gol (`inBox`, linha 5304); sem ninguém lá, o cruzamento
   cai no ramo de falha de entrega e vira bola perdida.

   Mede, no instante exato de cada `_cross`: quantos companheiros estão dentro
   dos 24 m, quantos dentro dos 16 m (área de verdade), e como isso se
   distribui. Só observação. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-area', language: 'pt-BR' });
define('location', { href: 'runner://area', search: '', hash: '' });
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


/* ============================================================================
 * ONDE ESTA O FINALIZADOR QUANDO A CHANCE E CONCEDIDA
 * ----------------------------------------------------------------------------
 * O ramo RASTEIRO de `_cross` escolhe `bestLow` num raio de 44 m do gol, manda a
 * bola para um ponto a 5,2 m da linha e concede `low_cross_shot` com pGoal ate
 * 0,40 — sem que o atacante precise estar la. O ramo AEREO exige alvo dentro de
 * 24 m; sem ninguem, ninguem toca a bola e o lance vira `chance(0.76)` entre
 * escanteio e tiro de meta.
 *
 * Mede, no instante em que cada chance e EMITIDA: distancia do finalizador ao
 * gol e distancia do finalizador a BOLA. Só observação.
 * ==========================================================================*/
const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const N = Number(argv.matches || 6), DT = 1 / 30;
const D2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const FORMS = String(argv.formacoes || '4-3-3,4-4-2,3-5-2').split(',');

const S = {};
const rec = (k, v) => { (S[k] = S[k] || []).push(v); };
const T = { ev: {}, crossLow: 0, crossAir: 0, vazia: 0, cheia: 0 };

for (const form of FORMS) {
  for (let i = 0; i < N; i++) {
    srand(1710000 + i * 977);
    const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
    const oEmit = Object.getPrototypeOf(sim)._emit;
    sim._emit = function (t, d) {
      T.ev[t] = (T.ev[t] || 0) + 1;
      try {
        const b = this.ball;
        if (t === 'cross' && d && d.by) {
          const tm = this.teams[d.by.team], g = tm.oppGoal;
          if (d.delivery === 'low') T.crossLow++; else T.crossAir++;
          rec('cross_distGol', D2(d.by.x, d.by.y, g.x, g.y));
          let n24 = 0;
          for (const p of tm.players) if (p !== d.by && !p.red && !p.isGK && D2(p.x, p.y, g.x, g.y) < 24) n24++;
          if (n24 === 0) T.vazia++; else T.cheia++;
          rec('cross_naArea', n24);
        }
        if ((t === 'low_cross_shot' || t === 'header_shot') && d && d.by) {
          const tm = this.teams[d.by.team], g = tm.oppGoal;
          rec(t + '_distGol', D2(d.by.x, d.by.y, g.x, g.y));
          rec(t + '_distBola', D2(d.by.x, d.by.y, b.x, b.y));
        }
      } catch (_) {}
      return oEmit.apply(this, arguments);
    };
    let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
  }
}

const nPart = N * FORMS.length;
const stat = a => {
  if (!a || !a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const q = p => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1);
  return { n: a.length, media: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1),
           p10: q(.10), mediana: q(.50), p90: q(.90), max: +s[s.length - 1].toFixed(1) };
};
const pctAcima = (k, lim) => { const a = S[k] || []; return a.length ? +(100 * a.filter(x => x > lim).length / a.length).toFixed(1) : null; };

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\/]/).pop(), partidas: nPart,
  cruzamentos: { total: T.crossLow + T.crossAir, rasteiros: T.crossLow, aereos: T.crossAir,
                 pctRasteiro: +(100 * T.crossLow / Math.max(1, T.crossLow + T.crossAir)).toFixed(1),
                 pctComAreaVazia: +(100 * T.vazia / Math.max(1, T.vazia + T.cheia)).toFixed(1),
                 distanciaDoCruzadorAoGol: stat(S.cross_distGol) },
  ondeEstaOFinalizadorQuandoAChanceEConcedida: {
    low_cross_shot: { distanciaAoGol: stat(S.low_cross_shot_distGol),
                      distanciaAteABola: stat(S.low_cross_shot_distBola),
                      pctAlemDe24mDoGol: pctAcima('low_cross_shot_distGol', 24),
                      pctAMaisDe10mDaBola: pctAcima('low_cross_shot_distBola', 10) },
    header_shot: { distanciaAoGol: stat(S.header_shot_distGol),
                   distanciaAteABola: stat(S.header_shot_distBola) },
  },
  eventosPorPartida: Object.fromEntries(['cross','low_cross_shot','header_shot','header_clear','corner','shot_taken','goal','save','blocked','diag_entrega_perdida','diag_perdida_escanteio','diag_perdida_tiroDeMeta']
    .map(k => [k, +((T.ev[k] || 0) / nPart).toFixed(2)])),
}, null, 2));
