#!/usr/bin/env node
'use strict';
/* QUANTO MATERIAL EXISTE PARA UM CORTE DEFENSIVO?
   -------------------------------------------------------------------------
   _clearBall e codigo morto (0 chamadas em 12 partidas). O unico caminho ate
   ele exige, tudo junto: portador com slotPos 'CB', em construcao, sem passe
   seguro, e adversario a menos de 2,2 m.

   Antes de mexer em qualquer condicao, e preciso saber QUAL delas fecha a
   porta. Mede, para todo portador no proprio terco defensivo:
     - a distancia do adversario mais proximo,
     - o slotPos,
     - se _safePass encontrou alguem,
   e o quanto cada condicao sozinha eliminaria.

   Se o gargalo for _safePass sempre achar opcao, destravar o chance(.16) nao
   muda nada — e a Ordem de Servico R18.25 estaria apontando para o lugar
   errado. So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-pressao', language: 'pt-BR' });
define('location', { href: 'runner://pressao', search: '', hash: '' });
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
  decisoes: 0, noTercoDefensivo: 0,
  ehCB: 0, cbEmConstrucao: 0, cbConstrPressionado: 0, cbConstrPressSemPasse: 0,
  ndDefensivo: [], ndCB: [],
  safePassChamado: 0, safePassAchou: 0,
  porSlot: Object.create(null),
  pressionadoQualquerSlot: 0, pressSemPasseQualquerSlot: 0,
};

/* _safePass: com que frequencia encontra alguem? */
const oSafe = P._safePass;
let ultimoSafe = null;
if (typeof oSafe === 'function') P._safePass = function () {
  T.safePassChamado++;
  const r = oSafe.apply(this, arguments);
  ultimoSafe = r; if (r) T.safePassAchou++;
  return r;
};

/* O ponto de decisao do portador. */
const oAct = P._carrierAction || P._decide || P._onBall;
const nomeAct = P._carrierAction ? '_carrierAction' : (P._decide ? '_decide' : '_onBall');

const N = Number(argv.matches || 4), DT = 1 / 30;
const SEED = Number(argv.seed || 1710000);

for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(SEED + i * 977);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });

  /* Amostra o portador a cada quadro em que ele existe e esta no proprio terco. */
  let s = 0;
  while (!sim.isOver() && s++ < 400000) {
    sim.step(DT);
    const b = sim.ball, o = b && b.owner;
    if (!o || o.isGK) continue;
    if ((s & 7) !== 0) continue;                 // amostragem: 1 em 8 quadros
    const tm = sim.teams[o.team];
    const dir = tm.attackDir;
    const progresso = dir > 0 ? o.x : FL - o.x;  // 0 = proprio gol
    T.decisoes++;
    if (progresso > 35) continue;                 // so o terco defensivo
    T.noTercoDefensivo++;
    let nd = 1e9;
    for (const d of sim.teams[1 - o.team].players) { if (d.red) continue; const dd = D(o.x, o.y, d.x, d.y); if (dd < nd) nd = dd; }
    T.ndDefensivo.push(nd);
    const slot = o.slotPos || '?';
    T.porSlot[slot] = (T.porSlot[slot] || 0) + 1;
    if (nd < 2.2) T.pressionadoQualquerSlot++;
    if (slot === 'CB') {
      T.ehCB++; T.ndCB.push(nd);
      if (nd < 2.2) T.cbConstrPressionado++;
    }
  }
}

const nPart = N * 3;
const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(b.length * p)].toFixed(2); };
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);

realConsole.log(JSON.stringify({
  build: (global.CDS_BUILD_ID || '?'), partidas: nPart, pontoDeDecisao: nomeAct,
  AMOSTRAS: { portadorAmostrado: T.decisoes, noTercoDefensivo: T.noTercoDefensivo, pct: pct(T.noTercoDefensivo, T.decisoes) },
  PRESSAO_NO_TERCO_DEFENSIVO: {
    distanciaDoAdversario: { p10: q(T.ndDefensivo, .1), p25: q(T.ndDefensivo, .25), mediana: q(T.ndDefensivo, .5), p90: q(T.ndDefensivo, .9) },
    abaixo_de_2_2m: T.pressionadoQualquerSlot, pct: pct(T.pressionadoQualquerSlot, T.noTercoDefensivo),
    nota: 'este e o teto do corte defensivo se a condicao de 2,2 m for mantida',
  },
  CB: {
    amostras: T.ehCB, pct_do_terco: pct(T.ehCB, T.noTercoDefensivo),
    distanciaDoAdversario: { p10: q(T.ndCB, .1), mediana: q(T.ndCB, .5) },
    pressionado_abaixo_2_2m: T.cbConstrPressionado,
  },
  SAFE_PASS: {
    chamado: T.safePassChamado, achou: T.safePassAchou, pct_achou: pct(T.safePassAchou, T.safePassChamado),
    nota: 'se acha quase sempre, o ramo do corte nunca e alcancado — o gargalo e este, nao o chance(.16)',
  },
  porSlot: T.porSlot,
}, null, 2));
