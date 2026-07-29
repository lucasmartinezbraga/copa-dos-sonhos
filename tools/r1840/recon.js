#!/usr/bin/env node
'use strict';
/* RECON R18.40 — quais fichas da Ordem de Servico R18.25 ainda sao reais?
   -------------------------------------------------------------------------
   A OS foi escrita contra a R18.25. Depois dela entraram R18.31 (bola livre na
   area) e R18.35 (falta comum cobrada). Antes de mexer em qualquer coisa, este
   instrumento re-mede as fichas abertas contra a build ATUAL, para nao gastar
   esforco num defeito que ja morreu — e para nao assumir que morreu sem medir.

   Mede de uma vez:
     OS-01  gols por contato falho do goleiro   (alvo da OS: < 8%)
     OS-03  falta direta cobrada no mesmo quadro (alvo: espera > 1,5 s)
     OS-05  escanteio cunhado sem a bola sair    (alvo: < 15%)
     OS-08  conducao como fracao das acoes       (evidencia OS: 1,18%)
     OS-10  velocidade maxima de jogador         (teto do motor ~8 m/s)
     + censo completo de eventos, para ver o que existe de verdade.
   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-recon', language: 'pt-BR' });
define('location', { href: 'runner://recon', search: '', hash: '' });
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
const ev = Object.create(null);                 // censo de eventos
const T = {
  gols: 0, golsContatoFalho: 0, golsViaEvento: 0, contatoFalho: 0,
  cantos: 0, cantosBolaDentro: 0, cantoPos: [],
  faltaDireta: 0, deadDireta: [],
  acoesPortador: 0, conducoes: 0,
  vmax: 0, vAcima8: 0, amostrasVel: 0,
};

for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(SEED + i * 977);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  const proto = Object.getPrototypeOf(sim);

  const oEmit = proto._emit;
  sim._emit = function (t, d) {
    ev[t] = (ev[t] || 0) + 1;
    if (t === 'visual_contact_failed') T.contatoFalho++;
    if (t === 'goal') {
      T.gols++;
      if (d && d.outcome === 'goal_after_failed_reach') T.golsViaEvento++;
    }
    return oEmit.apply(this, arguments);
  };

  /* OS-01: o outcome viaja por _continueTravel, nao necessariamente pelo evento
     'goal'. Marcamos a rota e conferimos no gol seguinte. */
  const oCont = proto._continueTravel;
  if (typeof oCont === 'function') {
    sim._continueTravel = function (a, kind, cb, meta) {
      if (meta && meta.outcome === 'goal_after_failed_reach') T.golsContatoFalho++;
      return oCont.apply(this, arguments);
    };
  }

  /* OS-05: a bola estava DENTRO do campo quando o escanteio foi cunhado? */
  const oCorner = proto._setCorner;
  if (typeof oCorner === 'function') {
    sim._setCorner = function () {
      T.cantos++;
      const b = this.ball;
      const dentro = b && b.x > 0.5 && b.x < FL - 0.5 && b.y > 0.5 && b.y < FW - 0.5;
      if (dentro) T.cantosBolaDentro++;
      T.cantoPos.push([+(b ? b.x : -1).toFixed(1), +(b ? b.y : -1).toFixed(1)]);
      return oCorner.apply(this, arguments);
    };
  }

  /* OS-03: quanto tempo de bola morta a falta direta reserva? */
  const oFK = proto._freeKick;
  if (typeof oFK === 'function') {
    sim._freeKick = function () {
      T.faltaDireta++;
      const r = oFK.apply(this, arguments);
      T.deadDireta.push(+(this.dead || 0).toFixed(2));
      return r;
    };
  }

  /* OS-08: conducao como fracao das acoes do portador. */
  const oCarry = proto._carry;
  if (typeof oCarry === 'function') sim._carry = function () { T.conducoes++; T.acoesPortador++; return oCarry.apply(this, arguments); };
  for (const nm of ['_pass', '_shoot', '_cross', '_dribble', '_clearBall']) {
    const o = proto[nm];
    if (typeof o === 'function') sim[nm] = function () { T.acoesPortador++; return o.apply(this, arguments); };
  }

  let s = 0;
  while (!sim.isOver() && s++ < 400000) {
    sim.step(DT);
    if ((s & 15) === 0) {                       // OS-10: amostra de velocidade
      for (const tm of sim.teams) for (const p of tm.players) {
        if (!p || p.red) continue;
        const v = Math.hypot(p.vx || 0, p.vy || 0);
        T.amostrasVel++; if (v > T.vmax) T.vmax = v; if (v > 8) T.vAcima8++;
      }
    }
  }
}

const nPart = N * 3;
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
const st = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return { mediana: b[Math.floor(b.length / 2)], p90: b[Math.floor(b.length * .9)], max: b[b.length - 1] }; };

realConsole.log(JSON.stringify({
  build: (global.CDS_BUILD_ID || '?'), partidas: nPart, campo: { FL: typeof FL !== 'undefined' ? FL : null, FW: typeof FW !== 'undefined' ? FW : null },
  'OS-01_goleiro': { gols: T.gols, viaContinueTravel: T.golsContatoFalho, viaEventoGoal: T.golsViaEvento, pct: pct(T.golsContatoFalho, T.gols), contatoFalhoTotal: T.contatoFalho, alvo: '< 8%' },
  'OS-03_falta_direta': { cobrancas: T.faltaDireta, dead_s: st(T.deadDireta), alvo: 'mediana > 1,5 s' },
  'OS-05_escanteio': { cantos: T.cantos, porPartida: +(T.cantos / nPart).toFixed(2), comBolaDentroDoCampo: T.cantosBolaDentro, pct: pct(T.cantosBolaDentro, T.cantos), alvo: '< 15%' },
  'OS-08_conducao': { conducoes: T.conducoes, acoesPortador: T.acoesPortador, pct: pct(T.conducoes, T.acoesPortador), evidenciaOS: '1,18%' },
  'OS-10_velocidade': { vmax: +T.vmax.toFixed(2), amostrasAcima8ms: T.vAcima8, amostras: T.amostrasVel, tetoMotor: '~8 m/s' },
  eventos: Object.fromEntries(Object.entries(ev).sort((a, b) => b[1] - a[1])),
}, null, 2));
