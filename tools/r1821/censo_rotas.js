#!/usr/bin/env node
'use strict';
/* CENSO DAS ROTAS REAIS
   -------------------------------------------------------------------------
   Mede o FUNIL de cada evento que está abaixo do alvo, em partida real, em
   vez de supor onde está o gargalo.

   Bote: _pressAndTackle é chamado -> _selectPresser devolve alguém? -> ele
   está dentro do raio? -> cooldown liberado? -> o sorteio passa?
   Também conta de onde nascem escanteios e laterais, por método chamador. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-censo', language: 'pt-BR' });
define('location', { href: 'runner://censo', search: '', hash: '' });
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
const sha = crypto.createHash('sha256').update(html).digest('hex');
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
const mk = (f, st, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };
const N = Number(argv.matches || 12), DT = 1 / 30;
const D2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

const T = {
  pressAndTackleCalls: 0, semPortador: 0, presserNull: 0, presserOk: 0,
  dentroDoRaio: 0, foraDoRaio: 0, emCooldown: 0, elegivel: 0,
  distSoma: 0, distN: 0, raioSoma: 0, erroInstrumentacao: 0,
  ev: {}, cornerPorChamador: {}, outPorChamador: {},
};
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
const quemChamou = () => {
  const s = new Error().stack.split('\n').slice(2, 9);
  for (const l of s) {
    const m = l.match(/at [\w.]*?([_A-Za-z0-9]+)\s/);
    if (m && !/quemChamou|censo_rotas/.test(l)) return m[1];
  }
  return 'desconhecido';
};

for (let i = 0; i < N; i++) {
  srand(1710000 + i * 977);
  const sim = new MatchSim(mk('4-3-3', 'balanced', true), mk('4-3-3', 'balanced', false), { neutral: true, labMode: true });
  const proto = Object.getPrototypeOf(sim);

  const oEmit = sim._emit;
  sim._emit = function (t) { bump(T.ev, t); return oEmit.apply(this, arguments); };

  const oPress = proto._pressAndTackle;
  if (typeof oPress === 'function') {
    // ASSINATURA: _pressAndTackle(dt). O portador vem de this.ball.owner —
    // errar isso zera o funil silenciosamente (o try engole o TypeError).
    sim._pressAndTackle = function (dt) {
      T.pressAndTackleCalls++;
      // reproduz os mesmos funis, sem alterar nada
      try {
        const o = this.ball && this.ball.owner;
        if (!o) { T.semPortador++; return oPress.apply(this, arguments); }
        const defTm = this.teams[1 - o.team];
        const near = this._selectPresser(defTm, this.ball);
        if (!near) T.presserNull++;
        else {
          T.presserOk++;
          const nd = D2(o.x, o.y, near.x, near.y);
          const dOwn = D2(o.x, o.y, defTm.goal.x, defTm.goal.y);
          const C0 = global.C || {};
          const line = C0.LINE_OF ? C0.LINE_OF[near.slotPos] : 'MID';
          const pw = ({ FWD: 1.35, MID: 1, DEF: .45 })[line] || 1;
          const reach = (defTm.fx.pressReach || 0) * pw;
          const raio = (dOwn < 30 ? 3 : dOwn < 55 ? 2.6 : 2.25) + reach;
          T.distSoma += nd; T.distN++; T.raioSoma += raio;
          if (nd < raio) {
            T.dentroDoRaio++;
            if (near._tackleCd > 0) T.emCooldown++; else T.elegivel++;
          } else T.foraDoRaio++;
        }
      } catch (_) { T.erroInstrumentacao++; }
      return oPress.apply(this, arguments);
    };
  }

  const oCorner = proto._setCorner;
  if (typeof oCorner === 'function') sim._setCorner = function () { bump(T.cornerPorChamador, quemChamou()); return oCorner.apply(this, arguments); };
  const oOut = proto._ballOut;
  if (typeof oOut === 'function') sim._ballOut = function () { bump(T.outPorChamador, quemChamou()); return oOut.apply(this, arguments); };

  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
}

const per = v => +(v / N).toFixed(2);
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : 0;
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), sha256: sha.slice(0, 12), partidas: N,
  funilDoBote: {
    chamadas_pressAndTackle: per(T.pressAndTackleCalls),
    erroInstrumentacao: T.erroInstrumentacao,
    semPortador: per(T.semPortador),
    semPresser: per(T.presserNull) + ` (${pct(T.presserNull, T.pressAndTackleCalls)}%)`,
    comPresser: per(T.presserOk) + ` (${pct(T.presserOk, T.pressAndTackleCalls)}%)`,
    foraDoRaio: per(T.foraDoRaio) + ` (${pct(T.foraDoRaio, T.presserOk)}% dos com presser)`,
    dentroDoRaio: per(T.dentroDoRaio) + ` (${pct(T.dentroDoRaio, T.presserOk)}%)`,
    bloqueadoPorCooldown: per(T.emCooldown) + ` (${pct(T.emCooldown, T.dentroDoRaio)}% dos dentro do raio)`,
    chegaAoSorteio: per(T.elegivel),
    distanciaMediaDoPresser: +(T.distSoma / Math.max(1, T.distN)).toFixed(2),
    raioMedioDePressao: +(T.raioSoma / Math.max(1, T.distN)).toFixed(2),
  },
  eventosPorPartida: {
    tackle: per(T.ev.tackle || 0), tackle_attempt: per(T.ev.tackle_attempt || 0),
    tackle_missed: per(T.ev.tackle_missed || 0), foul: per(T.ev.foul || 0),
    corner: per(T.ev.corner || 0), throw_in: per(T.ev.throw_in || 0),
    pressure: per(T.ev.pressure || 0), containment: per(T.ev.containment || 0),
  },
  escanteioPorChamador: T.cornerPorChamador,
  bolaForaPorChamador: T.outPorChamador,
}, null, 2));
