#!/usr/bin/env node
'use strict';
/* SONDA DE DIRECAO — para onde a bola e mandada quando ninguem a controla.
   -------------------------------------------------------------------------
   A3 e A4 fecharam por eliminacao o diagnostico de `laterais` (15,9 medidos
   contra 33-48 do futebol real): nao e o arremesso e nao e resgate de bola
   fora. O que sobra e a DIRECAO. Esta sonda mede isso diretamente.

   Instrumenta os dois pontos por onde passa toda bola sem dono:
     _deflectTo(x,y,spd)  — corte, rebote, bloqueio, alivio
     _looseBall(x,y)      — sobra

   E registra, para cada chamada, a distancia do ALVO ate a linha mais
   proxima. A camada 45 (r18181 `naturalTarget`) so deixa a bola atravessar a
   linha quando o alvo ja esta a menos de 1,15 m dela; se os alvos nunca
   chegam la, aquele portao e decorativo.

   Uso:
     node tools/fisica/direcao.js --build=dist/index.html --matches=40
*/

const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const SEMENTE = Number(argv.semente || 4200000);
const INCREMENTO = 7919;
const DT = 1 / 30;
const N = Number(argv.matches || 40);
const BUILD = String(argv.build || 'dist/index.html');

function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-direcao', language: 'pt-BR' });
define('location', { href: 'runner://direcao', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {});
define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {});
define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);

const html = fs.readFileSync(BUILD, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
{
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let mt, idx = 0;
  while ((mt = re.exec(html))) {
    const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (_) {}
  }
}
if (typeof MatchSim === 'undefined') { console.error('MatchSim nao carregou'); process.exit(1); }

/* --------------------------------------------------------------- medidor */
const M = {
  deflect: 0, loose: 0,
  /* histograma da distancia do ALVO ate a linha lateral mais proxima */
  histLateral: [0, 0, 0, 0, 0, 0], /* <=0 | <=1.15 | <=2.05 | <=4 | <=8 | resto */
  histFundo: [0, 0, 0, 0, 0, 0],
  alvoForaLateral: 0, alvoForaFundo: 0,
  /* quantos alvos caem exatamente na borda do clamp de 2 m */
  noClamp2: 0,
  /* quanto o portao da camada 45 realmente reescreveu */
  reescritos: 0,
  somaDistLateral: 0, somaDistFundo: 0,
};
const FAIXAS = ['<=0 (fora)', '<=1,15 (portao r18181)', '<=2,05', '<=4', '<=8', '>8'];
function faixa(d) { return d <= 0 ? 0 : d <= 1.15 ? 1 : d <= 2.05 ? 2 : d <= 4 ? 3 : d <= 8 ? 4 : 5; }

function instrumentar(sim) {
  const P = Object.getPrototypeOf(sim);
  const registrar = (x, y, tag) => {
    const dLat = Math.min(y, FW - y);
    const dFun = Math.min(x, FL - x);
    M[tag]++;
    M.histLateral[faixa(dLat)]++;
    M.histFundo[faixa(dFun)]++;
    M.somaDistLateral += dLat; M.somaDistFundo += dFun;
    if (dLat <= 0) M.alvoForaLateral++;
    if (dFun <= 0) M.alvoForaFundo++;
    if (Math.abs(dLat - 2) < 0.02 || Math.abs(dFun - 2) < 0.02) M.noClamp2++;
  };
  /* instrumenta o TOPO da pilha: e o alvo pedido pelo chamador que interessa */
  const oDef = sim._deflectTo ? P._deflectTo : null;
  sim._deflectTo = function (x, y, spd) {
    registrar(+x, +y, 'deflect');
    const r = P._deflectTo.call(this, x, y, spd);
    const b = this.ball;
    if (b && (Math.abs(b.target.x - x) > 0.05 || Math.abs(b.target.y - y) > 0.05)) M.reescritos++;
    return r;
  };
  sim._looseBall = function (x, y) {
    registrar(+x, +y, 'loose');
    return P._looseBall.call(this, x, y);
  };
  void oDef;
}

const db = buildDB(DATA);
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st };
};

let throwIns = 0, corners = 0, goalKicks = 0, naturalOut = null;
for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * INCREMENTO;
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  instrumentar(sim);
  let s = 0;
  while (!sim.isOver() && s++ < 500000) sim.step(DT);
  throwIns += (+sim.stats[0].throwIns || 0) + (+sim.stats[1].throwIns || 0);
  corners += (+sim.stats[0].corners || 0) + (+sim.stats[1].corners || 0);
  goalKicks += (+sim.stats[0].goalKicks || 0) + (+sim.stats[1].goalKicks || 0);
  if (typeof sim.getR18181Audit === 'function') {
    const a = sim.getR18181Audit();
    naturalOut = naturalOut || { naturalOutDeflections: 0, naturalOutLooseBalls: 0,
      naturalThrowIns: 0, naturalCorners: 0, naturalGoalKicks: 0 };
    for (const k of Object.keys(naturalOut)) naturalOut[k] += (+a[k] || 0);
  }
}

const pp = (v) => +(v / N).toFixed(2);
const tot = M.deflect + M.loose;
const rel = {
  build: sha.slice(0, 16), partidas: N,
  porPartida: {
    deflectTo: pp(M.deflect), looseBall: pp(M.loose),
    throwIns: pp(throwIns), corners: pp(corners), goalKicks: pp(goalKicks),
    reinicios: pp(throwIns + corners + goalKicks),
  },
  alvo: {
    distMediaAteALateral: +(M.somaDistLateral / tot).toFixed(2),
    distMediaAteOFundo: +(M.somaDistFundo / tot).toFixed(2),
    alvosJaForaPelaLateral: M.alvoForaLateral,
    alvosJaForaPeloFundo: M.alvoForaFundo,
    naBordaDoClampDe2m: M.noClamp2,
    percentualNaBordaDoClamp: +(100 * M.noClamp2 / tot).toFixed(1),
  },
  histogramaLateral: Object.fromEntries(FAIXAS.map((f, k) =>
    [f, `${M.histLateral[k]} (${(100 * M.histLateral[k] / tot).toFixed(1)}%)`])),
  histogramaFundo: Object.fromEntries(FAIXAS.map((f, k) =>
    [f, `${M.histFundo[k]} (${(100 * M.histFundo[k] / tot).toFixed(1)}%)`])),
  portaoDaCamada45: {
    alvosReescritosParaForaDoCampo: M.reescritos,
    porPartida: pp(M.reescritos),
    auditoriaR18181: naturalOut ? Object.fromEntries(
      Object.entries(naturalOut).map(([k, v]) => [k, pp(v)])) : null,
  },
};
console.log(JSON.stringify(rel, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(rel, null, 2));
