#!/usr/bin/env node
'use strict';
/* CENSO DA LINHA DE FUNDO — de quem e o ultimo toque quando a bola sai?
   -------------------------------------------------------------------------
   A build R18.35 entrega 120 tiros de meta e 10 escanteios em 12 partidas.
   Doze para um. No futebol de verdade a razao fica perto de dois para um.

   A bola CRUZA a linha de fundo o tempo todo — o que nao existe e a bola
   cruzar a linha depois de um toque da DEFESA. _ballOut() ja deriva escanteio
   corretamente quando isso acontece (a R18.31 mediu 99,3% de acerto); o que
   falta e o toque defensivo chegar ate la.

   Mede, a cada cruzamento de linha: de que time foi o ultimo toque, se era o
   time que defende aquele gol, e o que o motor decidiu. Mede tambem, no
   PROTOTIPO (nao na instancia), quantas vezes _clearBall e de fato chamado —
   o corte afobado que a Ordem de Servico R18.25 mandou destravar.
   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-saida', language: 'pt-BR' });
define('location', { href: 'runner://saida', search: '', hash: '' });
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

const P = MatchSim.prototype;
const T = {
  clearBall: 0, clearBehind: 0,
  saidas: 0, toqueAtaque: 0, toqueDefesa: 0, semToque: 0,
  cantos: 0, tiroDeMeta: 0, lateral: 0,
  bloqueiosPertoDoGol: 0,
};

/* PROTOTIPO: pega a chamada venha de onde vier. */
const oClear = P._clearBall;
if (typeof oClear === 'function') P._clearBall = function () { T.clearBall++; return oClear.apply(this, arguments); };

const oOut = P._ballOut;
if (typeof oOut === 'function') P._ballOut = function () {
  const b = this.ball;
  const foraFundo = b && (b.x <= 0.05 || b.x >= FL - 0.05);
  if (foraFundo) {
    T.saidas++;
    const lt = b.lastTouch;
    if (!lt) T.semToque++;
    else {
      /* qual gol a bola cruzou, e quem defende esse gol */
      const ladoDoGol = b.x <= FL / 2 ? 0 : 1;
      const defende = this.teams.findIndex(tm => tm.goal && (tm.goal.x <= FL / 2 ? 0 : 1) === ladoDoGol);
      if (defende >= 0 && lt.team === defende) T.toqueDefesa++; else T.toqueAtaque++;
    }
  }
  return oOut.apply(this, arguments);
};

const oCorner = P._setCorner;
if (typeof oCorner === 'function') P._setCorner = function () { T.cantos++; return oCorner.apply(this, arguments); };

const N = Number(argv.matches || 4), DT = 1 / 30;
const SEED = Number(argv.seed || 1710000);
for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(SEED + i * 977);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  const oEmit = Object.getPrototypeOf(sim)._emit;
  sim._emit = function (t, d) {
    if (t === 'clear_behind') T.clearBehind++;
    if (t === 'goal_kick') T.tiroDeMeta++;
    if (t === 'throw_in') T.lateral++;
    return oEmit.apply(this, arguments);
  };
  let s = 0; while (!sim.isOver() && s++ < 400000) sim.step(DT);
}

const nPart = N * 3;
const per = v => +(v / nPart).toFixed(2);
realConsole.log(JSON.stringify({
  build: (global.CDS_BUILD_ID || '?'), partidas: nPart,
  CORTE_DEFENSIVO: {
    _clearBall_chamado: T.clearBall, porPartida: per(T.clearBall),
    clear_behind_emitido: T.clearBehind,
    nota: 'a Ordem de Servico mandou destravar o chance(.16) DENTRO de _clearBall; se a funcao nunca roda, destravar nao produz nada',
  },
  LINHA_DE_FUNDO: {
    cruzamentos: T.saidas, porPartida: per(T.saidas),
    ultimoToque_ATAQUE: T.toqueAtaque, ultimoToque_DEFESA: T.toqueDefesa, semToque: T.semToque,
    pct_toque_defensivo: +(100 * T.toqueDefesa / Math.max(1, T.saidas)).toFixed(1),
  },
  REINICIOS: {
    tiroDeMeta: T.tiroDeMeta, porPartida: per(T.tiroDeMeta),
    escanteios_setCorner: T.cantos, porPartida: per(T.cantos),
    razao_tiroDeMeta_por_escanteio: +(T.tiroDeMeta / Math.max(1, T.cantos)).toFixed(1),
    lateral: T.lateral,
  },
}, null, 2));
