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
 * QUEM AUTORIZA O CRUZAMENTO — atribuição por portão
 * ----------------------------------------------------------------------------
 * O relatório anterior atribuiu a área vazia a `_canCross`, "que libera o
 * cruzamento a partir de 27 m do gol" (regra base: adv>78 && (y<20||y>FW-20)).
 * Mas a camada R12.2 (linha ~16173) SOBRESCREVE `_canCross` e acrescenta um
 * segundo caminho, muito mais permissivo:
 *     return base(o) || (adv > 57 && (o.y < 27 || o.y > FW-27))
 * ou seja, cruzamento liberado a 48 m da linha de fundo, num corredor bem mais
 * largo. Este instrumento mede, para cada cruzamento REAL, se a regra base o
 * teria autorizado — separando o que é "cruzou de 30 m" do que é
 * "cruzou de 48 m porque uma camada posterior abriu a porta".
 * Só observação: não altera nada.
 * ==========================================================================*/
const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };
const N = Number(argv.matches || 12), DT = 1 / 30;
const D2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const FORMS = String(argv.formacoes || '4-3-3,4-4-2,3-5-2').split(',');
const FLc = global.FL || 105, FWc = global.FW || 68;

const T = {
  n: 0, baseOk: 0, soR122: 0, setPiece: 0,
  distGolBuckets: {}, advSoma: 0, distSoma: 0,
  vazia24_base: 0, n_base: 0, vazia24_r122: 0, n_r122: 0,
  soma24_base: 0, soma24_r122: 0,
  entregaAr: 0, entregaBaixa: 0,
  alvoR122Soma: 0, real24Soma: 0, fantasma: 0, hAlvo: {},
  ev: {}, porDist: {},
};

function bucket(d) { return d < 12 ? '00-12' : d < 18 ? '12-18' : d < 24 ? '18-24' : d < 30 ? '24-30' : d < 38 ? '30-38' : d < 46 ? '38-46' : '46+'; }

for (const form of FORMS) {
  for (let i = 0; i < N; i++) {
    srand(1710000 + i * 977);
    const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
    const proto = Object.getPrototypeOf(sim);
    const oCross = proto._cross;
    sim._cross = function (o) {
      try {
        const tm = this.teams[o.team], g = tm.oppGoal;
        const adv = tm.attackDir > 0 ? o.x : FLc - o.x;
        const distGol = D2(o.x, o.y, g.x, g.y);
        const distLinha = FLc - adv;                       // metros até a linha de fundo
        const baseWide = o.y < 20 || o.y > FWc - 20;
        const baseOk = adv > 78 && baseWide;               // regra ORIGINAL
        const setPiece = (o._setPieceDeliveryUntil || 0) > this.t;
        let n24 = 0, n16 = 0, alvoR122 = 0;
        for (const p of tm.players) {
          if (p === o || p.red || p.isGK) continue;
          const d = D2(p.x, p.y, g.x, g.y);
          if (d < 24) n24++; if (d < 16) n16++;
          // o teste que a R12.2 usa para DECIDIR cruzar: SÓ o eixo X
          if (Math.abs(p.x - g.x) < 24) alvoR122++;
        }
        T.alvoR122Soma += alvoR122; T.real24Soma += n24;
        T.hAlvo[Math.min(6,alvoR122)] = (T.hAlvo[Math.min(6,alvoR122)] || 0) + 1;
        if (alvoR122 > 0 && n24 === 0) T.fantasma++;
        T.n++; T.advSoma += adv; T.distSoma += distGol;
        const b = bucket(distGol);
        const pd = T.porDist[b] || (T.porDist[b] = { n: 0, vazia24: 0, soma24: 0, baseOk: 0 });
        pd.n++; pd.soma24 += n24; if (!n24) pd.vazia24++; if (baseOk) pd.baseOk++;
        T.distGolBuckets[b] = (T.distGolBuckets[b] || 0) + 1;
        if (setPiece) T.setPiece++;
        else if (baseOk) { T.baseOk++; T.n_base++; T.soma24_base += n24; if (!n24) T.vazia24_base++; }
        else { T.soR122++; T.n_r122++; T.soma24_r122 += n24; if (!n24) T.vazia24_r122++; }
      } catch (_) {}
      return oCross.apply(this, arguments);
    };
    const oEmit = sim._emit;
    sim._emit = function (t, d) {
      T.ev[t] = (T.ev[t] || 0) + 1;
      if (t === 'cross' && d) { if (d.delivery === 'air') T.entregaAr++; else T.entregaBaixa++; }
      return oEmit.apply(this, arguments);
    };
    let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
  }
}

const nPart = N * FORMS.length, c = Math.max(1, T.n);
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\/]/).pop(), partidas: nPart, formacoes: FORMS,
  cruzamentos: T.n, cruzamentosPorPartida: +(T.n / nPart).toFixed(2),
  distanciaMediaAoGol_m: +(T.distSoma / c).toFixed(1),
  avancoMedio_adv: +(T.advSoma / c).toFixed(1),
  atribuicaoDoPortao: {
    regraBase_adv78_faixa20: { n: T.baseOk, pct: pct(T.baseOk, c), areaVazia24m_pct: pct(T.vazia24_base, T.n_base), companheirosDentro24m: +(T.soma24_base / Math.max(1, T.n_base)).toFixed(2) },
    somenteR122_adv57_faixa27: { n: T.soR122, pct: pct(T.soR122, c), areaVazia24m_pct: pct(T.vazia24_r122, T.n_r122), companheirosDentro24m: +(T.soma24_r122 / Math.max(1, T.n_r122)).toFixed(2) },
    bolaParada: { n: T.setPiece, pct: pct(T.setPiece, c) },
  },
  porDistanciaAoGol: Object.fromEntries(Object.entries(T.porDist).sort().map(([k, v]) => [k, {
    pctDosCruzamentos: pct(v.n, c), areaVazia24m_pct: pct(v.vazia24, v.n),
    companheirosDentro24m: +(v.soma24 / Math.max(1, v.n)).toFixed(2),
    autorizadoPelaRegraBase_pct: pct(v.baseOk, v.n),
  }])),
  testeDeAlvoDaR122: {
    nota: 'a R12.2 decide cruzar com Math.abs(p.x - golX) < 24 — SÓ o eixo X, uma faixa de 24 m x 68 m atravessando o campo inteiro',
    alvosMedios_testeXsomente: +(T.alvoR122Soma / c).toFixed(2),
    companheirosReaisDentroDe24m: +(T.real24Soma / c).toFixed(2),
    pctCruzamentosComAlvoFantasma: pct(T.fantasma, c),
    histogramaAlvosXsomente: Object.fromEntries(Object.entries(T.hAlvo).sort().map(([k,v])=>[k+' alvo(s)', pct(v,c)+'%'])),
  },
  entrega: { ar: T.entregaAr, baixa: T.entregaBaixa },
  eventosPorPartida: {
    cross: +((T.ev.cross || 0) / nPart).toFixed(2),
    header_shot: +((T.ev.header_shot || 0) / nPart).toFixed(2),
    header_clear: +((T.ev.header_clear || 0) / nPart).toFixed(2),
    low_cross_shot: +((T.ev.low_cross_shot || 0) / nPart).toFixed(2),
    corner: +((T.ev.corner || 0) / nPart).toFixed(2),
    goal: +((T.ev.goal || 0) / nPart).toFixed(2),
  },
}, null, 2));
