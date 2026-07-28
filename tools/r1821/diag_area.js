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

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const N = Number(argv.matches || 12), DT = 1 / 30;
const D2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

const T = { cruzamentos: 0, soma24: 0, soma16: 0, hist: {}, semNinguem24: 0, semNinguem16: 0,
            ev: {}, porFormacao: {}, posicao: {}, progDaBola: 0, progN: 0 };

const FORMS = String(argv.formacoes || '4-3-3,4-4-2,3-5-2').split(',');

for (const form of FORMS) {
  const acc = { cruz: 0, soma24: 0, soma16: 0, vazia: 0 };
  for (let i = 0; i < N; i++) {
    srand(1710000 + i * 977);
    const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
    const proto = Object.getPrototypeOf(sim);
    const oCross = proto._cross;
    sim._cross = function (o) {
      try {
        const tm = this.teams[o.team], g = tm.oppGoal;
        const FLc = global.FL || 105, FWc = global.FW || 68;
        const progOf = x => tm.attackDir > 0 ? x : FLc - x;
        let n24 = 0, n16 = 0;
        for (const p of tm.players) {
          if (p === o || p.red || p.isGK) continue;
          const d = D2(p.x, p.y, g.x, g.y);
          if (d < 24) n24++;
          if (d < 16) n16++;
          /* ONDE ELES ESTAO, por linha: progresso (0 gol proprio .. 105 gol
             adversario) e afastamento lateral do centro. Separa "recuado" de
             "adiantado mas colado na linha de fundo lateral". */
          const cls = (['LW','RW','ST','CF'].includes(p.slotPos)) ? 'FWD'
                    : (['CAM','CM','LM','RM','CDM'].includes(p.slotPos)) ? 'MID' : 'DEF';
          const bal = T.posicao[cls] || (T.posicao[cls] = { n: 0, prog: 0, lat: 0, dist: 0, dentro24: 0 });
          bal.n++; bal.prog += progOf(p.x); bal.lat += Math.abs(p.y - FWc / 2); bal.dist += d;
          if (d < 24) bal.dentro24++;
        }
        T.progDaBola += progOf(o.x); T.progN++;
        T.cruzamentos++; T.soma24 += n24; T.soma16 += n16;
        T.hist[n24] = (T.hist[n24] || 0) + 1;
        if (!n24) T.semNinguem24++;
        if (!n16) T.semNinguem16++;
        acc.cruz++; acc.soma24 += n24; acc.soma16 += n16; if (!n24) acc.vazia++;
      } catch (_) {}
      return oCross.apply(this, arguments);
    };
    const oEmit = sim._emit;
    sim._emit = function (t) { T.ev[t] = (T.ev[t] || 0) + 1; return oEmit.apply(this, arguments); };
    let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
  }
  T.porFormacao[form] = {
    cruzamentosPorPartida: +(acc.cruz / N).toFixed(2),
    mediaDentroDe24m: +(acc.soma24 / Math.max(1, acc.cruz)).toFixed(2),
    mediaDentroDe16m: +(acc.soma16 / Math.max(1, acc.cruz)).toFixed(2),
    pctComAreaVazia: +(100 * acc.vazia / Math.max(1, acc.cruz)).toFixed(1),
  };
}

const c = Math.max(1, T.cruzamentos);
const nPart = N * FORMS.length;
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), partidasPorFormacao: N, formacoes: FORMS,
  geral: {
    cruzamentos: T.cruzamentos,
    mediaCompanheirosDentroDe24m: +(T.soma24 / c).toFixed(2),
    mediaCompanheirosDentroDe16m: +(T.soma16 / c).toFixed(2),
    pctCruzamentosComAreaVazia24m: +(100 * T.semNinguem24 / c).toFixed(1),
    pctCruzamentosComAreaVazia16m: +(100 * T.semNinguem16 / c).toFixed(1),
  },
  histogramaDentroDe24m: Object.keys(T.hist).sort((a, b) => a - b)
    .map(k => `${k} jogador(es): ${(100 * T.hist[k] / c).toFixed(1)}%`),
  progressoDaBolaNoCruzamento: +(T.progDaBola / Math.max(1, T.progN)).toFixed(1),
  ondeEstaoOsJogadores: Object.fromEntries(Object.entries(T.posicao).map(([k, v]) => [k, {
    progressoMedio: +(v.prog / Math.max(1, v.n)).toFixed(1),
    afastamentoLateralDoCentro_m: +(v.lat / Math.max(1, v.n)).toFixed(1),
    distanciaAoGol_m: +(v.dist / Math.max(1, v.n)).toFixed(1),
    pctDentroDe24m: +(100 * v.dentro24 / Math.max(1, v.n)).toFixed(1),
  }])),
  porFormacao: T.porFormacao,
  eventosPorPartida: {
    cross: +((T.ev.cross || 0) / nPart).toFixed(2),
    header_shot: +((T.ev.header_shot || 0) / nPart).toFixed(2),
    header_clear: +((T.ev.header_clear || 0) / nPart).toFixed(2),
    low_cross_shot: +((T.ev.low_cross_shot || 0) / nPart).toFixed(2),
    corner: +((T.ev.corner || 0) / nPart).toFixed(2),
  },
  nota: 'o motor exige alvo aereo dentro de 24 m do gol (inBox); sem ninguem la o cruzamento vira bola perdida',
}, null, 2));
