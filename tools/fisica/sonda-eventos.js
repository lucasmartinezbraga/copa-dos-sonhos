#!/usr/bin/env node
'use strict';
/* SONDA DE EVENTOS RAROS — centenas de partidas em segundos
   =========================================================================
   As sondas de tela (Chromium) sao a unica forma de ver ANIMACAO, mas elas
   rodam em tempo de jogo: 180 s a 6X sao ~108 min de futebol, e a defesa
   acontece ~2x por partida. Medir a geometria da defesa ali da n=3, que nao
   sustenta nem um limiar nem uma conclusao.

   Esta sonda roda o motor pelo mesmo caminho da bateria — mesma semente, mesma
   populacao — e so instrumenta `_emit` e `_startTravel`. Nao desenha nada e nao
   mede animacao: mede a FREQUENCIA e a GEOMETRIA dos eventos que as poses
   dependem. As duas se completam.

   Uso:
     node tools/fisica/sonda-eventos.js --build=dist/index.html --matches=120
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const BUILD = String(argv.build || 'dist/index.html');
const N = Number(argv.matches || 120);
const SEMENTE = Number(argv.semente || 4200000);
const INCREMENTO = 7919;
const DT = 1 / 30;

/* ---------------------------------------------------------------- ambiente */
function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function elemento() {
  return { style: {}, dataset: {}, getContext: () => null, appendChild: noop,
           removeChild: noop, setAttribute: noop, removeAttribute: noop,
           addEventListener: noop, removeEventListener: noop, focus: noop, blur: noop,
           insertAdjacentHTML: noop, getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
           classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
           querySelector: () => null, querySelectorAll: () => [], children: [] };
}
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-sonda', language: 'pt-BR' });
  define('location', { href: 'runner://sonda', search: '', hash: '' });
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
  define('document', {
    createElement: elemento, createTextNode: () => ({}),
    body: elemento(), head: elemento(), documentElement: elemento(),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop,
  });
}

function carregar(p) {
  const html = fs.readFileSync(p, 'utf8');
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, ok = 0, erro = 0;
  const antes = console.log;
  console.log = noop; console.warn = noop; console.info = noop; console.debug = noop;
  while ((m = re.exec(html))) {
    if (/\bsrc=/i.test(m[1])) continue;
    try { vm.runInThisContext(m[2], { filename: `b${ok + erro}.js` }); ok++; } catch (_) { erro++; }
  }
  console.log = antes;
  return { ok, erro };
}

instalarAmbiente();
const carga = carregar(path.resolve(BUILD));

/* populacao: EXATAMENTE a mesma construcao da bateria (bateria.js:211), para
   as frequencias serem comparaveis com os laudos historicos */
const db = global.buildDB(global.DATA);
const FORMS = Object.keys(global.FORMATIONS);
const STYLES = (typeof global.STYLE_KEYS !== 'undefined' && Array.isArray(global.STYLE_KEYS))
  ? global.STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => {
  const p = global.autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st };
};

/* ------------------------------------------------------------------ coleta */
const R = {
  partidas: 0, minutos: 0,
  ev: Object.create(null),
  defesas: [], dribles: Object.create(null), driblesN: 0,
  a8: { dri88tec84: 0, vel88: 0, tec88: 0, dri86: 0, total: 0 },
  poses: Object.create(null),
};

function rodar() {
  for (let i = 0; i < N; i++) {
    const seed = SEMENTE + i * INCREMENTO;
    if (global.srand) global.srand(seed);
    const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
    const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
    let sim;
    try {
      sim = new global.MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
      sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
    } catch (e) { console.error('nao consegui montar a partida:', e.message); return false; }

    const oEmit = sim._emit;
    sim._emit = function (t, d) {
      R.ev[t] = (R.ev[t] || 0) + 1;
      try {
        if (t === 'dribble' && d && d.move) { R.dribles[d.move] = (R.dribles[d.move] || 0) + 1; R.driblesN++; }
      } catch (_) {}
      return oEmit.apply(this, arguments);
    };
    const oST = sim._startTravel;
    sim._startTravel = function (o, target, kind, cb, receiver, style, meta) {
      try {
        if (meta && target && meta.outcome === 'save' && meta.actor && meta.actor.isGK) {
          R.defesas.push({ z: Number(target.z),
                           dy: Math.abs((Number(meta.actor.y) || 0) - (Number(target.y) || 0)) });
        }
      } catch (_) {}
      return oST.apply(this, arguments);
    };

    /* censo de atributos: `body_feint` exige dri>=88 e tec>=84 */
    try {
      for (const tm of sim.teams) for (const p of tm.players) {
        const a = (p.ref && p.ref.a8) || null; if (!a) continue;
        R.a8.total++;
        if (a[3] >= 88) R.a8.vel88++;
        if (a[7] >= 88) R.a8.tec88++;
        if (a[2] >= 88 && a[7] >= 84) R.a8.dri88tec84++;
        if (a[2] >= 86) R.a8.dri86++;
      }
    } catch (_) {}

    let s = 0;
    while (!sim.isOver() && s++ < 500000) sim.step(DT);
    R.partidas++; R.minutos += Number(sim.minute) || 0;
    /* §D48 · o auditor da OS-46 conta os PEDIDOS de pose. Lido aqui, sobre
       partidas INTEIRAS, ele separa "nunca pedido" (defeito de estrutura) de
       "raro" — que numa amostra de meia partida no navegador sao
       indistinguiveis. Foi assim que `body_feint` e `outside_cut` quase
       viraram defeito duas vezes. */
    try {
      const a = sim.getOS46Audit ? sim.getOS46Audit() : null;
      if (a && a.porEstado) for (const k in a.porEstado) {
        R.poses[k] = a.porEstado[k];    // o auditor e cumulativo no prototipo
      }
    } catch (_) {}
  }
  return true;
}

if (!rodar()) process.exit(1);

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
const porPartida = n => (n / (R.partidas || 1)).toFixed(2);

console.log(`build ${path.basename(BUILD)} · ${carga.ok} blocos (${carga.erro} com erro)`);
console.log(`${R.partidas} partidas, ${(R.minutos / (R.partidas || 1)).toFixed(0)} min cada\n`);

console.log('evento                        total   por partida');
console.log('---------------------------  ------  ------------');
const chaves = Object.keys(R.ev).sort((a, b) => R.ev[b] - R.ev[a]);
for (const k of chaves.slice(0, 26)) {
  console.log(`${k.padEnd(27)}  ${String(R.ev[k]).padStart(6)}  ${porPartida(R.ev[k]).padStart(12)}`);
}

console.log(`\ndefesas com alvo conhecido: ${R.defesas.length} (${porPartida(R.defesas.length)}/partida)`);
const zs = R.defesas.map(d => d.z).filter(Number.isFinite);
if (zs.length) {
  console.log(`  z do alvo: min ${q(zs,0).toFixed(2)}  p10 ${q(zs,.1).toFixed(2)}  mediana ${q(zs,.5).toFixed(2)}  p90 ${q(zs,.9).toFixed(2)}  max ${q(zs,1).toFixed(2)}`);
  for (const c of [0.30, 0.45, 0.50, 0.70, 0.90, 1.15]) {
    const n = zs.filter(v => v < c).length;
    console.log(`    abaixo de ${c.toFixed(2)} m: ${String(n).padStart(4)}  (${(100*n/zs.length).toFixed(1)}%)`);
  }
}
const dys = R.defesas.map(d => d.dy).filter(Number.isFinite);
if (dys.length) {
  console.log(`  dy lateral: mediana ${q(dys,.5).toFixed(2)}  p90 ${q(dys,.9).toFixed(2)}`);
  console.log(`    acima de 0,55 m (vira voo): ${dys.filter(v=>v>0.55).length} (${(100*dys.filter(v=>v>0.55).length/dys.length).toFixed(1)}%)`);
}

console.log(`\ndribles com move: ${R.driblesN} (${porPartida(R.driblesN)}/partida)`);
for (const k of Object.keys(R.dribles).sort((a, b) => R.dribles[b] - R.dribles[a])) {
  console.log(`  ${k.padEnd(20)} ${String(R.dribles[k]).padStart(5)}  ${(100*R.dribles[k]/(R.driblesN||1)).toFixed(1)}%`);
}
const TODOS = (global.CDS_ANIM && global.CDS_ANIM.STATES) ? Object.keys(global.CDS_ANIM.STATES) : [];
if (TODOS.length) {
  const nunca = TODOS.filter(k => !R.poses[k]);
  console.log(`\nposes PEDIDAS pela fiacao, em ${R.partidas} partidas inteiras:`);
  const ord = Object.keys(R.poses).sort((a, b) => R.poses[b] - R.poses[a]);
  for (const k of ord) console.log(`  ${k.padEnd(20)} ${String(R.poses[k]).padStart(6)}  ${(R.poses[k]/(R.partidas||1)).toFixed(2)}/partida`);
  console.log(`\nNUNCA PEDIDAS (${nunca.length} de ${TODOS.length}):`);
  console.log('  ' + (nunca.join(', ') || '(nenhuma)'));
  console.log('  (as de LOCOMOCAO e POSTURA nao passam pela fiacao: vem do piso');
  console.log('   do controlador, entao aparecer aqui nao e defeito para elas)');
}
if (R.a8.total) {
  const p = n => `${(100 * n / R.a8.total).toFixed(1)}%`;
  console.log(`\natletas em campo: ${R.a8.total}`);
  console.log(`  vel >= 88 (arrancada)           ${p(R.a8.vel88)}`);
  console.log(`  tec >= 88 (drible da vaca)      ${p(R.a8.tec88)}`);
  console.log(`  dri >= 86 (meia-lua)            ${p(R.a8.dri86)}`);
  console.log(`  dri >= 88 e tec >= 84 (elastico) ${p(R.a8.dri88tec84)}`);
}
