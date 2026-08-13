#!/usr/bin/env node
/* REGRESSAO DO D35 · nenhum alvo NaN, nenhuma marca de arrancada eterna.
   -------------------------------------------------------------------------
   O defeito: a camada 17 armava o cobrador do lateral com
   `{throwInDuty:true}` — sem `t` e sem `dir`. O motor apaga a marca por
   `p._breaking.t -= dt; if (t <= 0) p._breaking = null;`, e `undefined - dt` e
   NaN: `NaN <= 0` e FALSO, entao a marca nunca saia. Consequencia mais visivel:
   `ty = clamp(ty + p._breaking.dir * 9, ...)` virava NaN e chegava assim ao
   `_integrate`.

   Este teste nao mede desempenho de jogo — ele afirma duas invariantes que
   nenhuma mudanca futura deve quebrar:

     1. `_integrate` NUNCA recebe tx/ty nao-finito;
     2. toda marca `p._breaking` viva carrega `t` e `dir` finitos.

   Roda 4 partidas completas (~20 s). Uso: node tests/arrancada_test.js */
'use strict';
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
function noop() {}
function def(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
def('window', global); def('self', global); def('navigator', { userAgent: 'x', language: 'pt-BR' });
def('location', { href: '', search: '', hash: '' }); def('performance', { now: () => 0 }); def('crypto', crypto.webcrypto);
def('requestAnimationFrame', () => 0); def('cancelAnimationFrame', noop); def('addEventListener', noop); def('removeEventListener', noop);
def('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop })); def('alert', noop);
def('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop }); def('sessionStorage', global.localStorage);
def('CanvasRenderingContext2D', undefined); def('HTMLElement', function () {}); def('HTMLCanvasElement', function () {});
def('Image', function () {}); def('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
def('__showBootError', noop); def('__cdsDebugWarn', noop); def('CDS_DEBUG', false);

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const BUILD = process.argv[2] || 'dist/index.html';
const html = fs.readFileSync(BUILD, 'utf8');
{
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(html))) {
    const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('s' + i); i++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(m[2], { filename: id }); } catch (_) {}
  }
}
if (typeof MatchSim === 'undefined') { console.error('MatchSim nao carregou'); process.exit(1); }

const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

let integrateNaN = 0, integrateOk = 0, marcaTorta = 0, marcaOk = 0;
let exemploNaN = null, exemploMarca = null;
const N = Number(process.argv[3] || 4);

for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  const P = Object.getPrototypeOf(sim);
  sim._integrate = function (p, tx, ty, dt, freeze) {
    if (Number.isFinite(+tx) && Number.isFinite(+ty)) integrateOk++;
    else {
      integrateNaN++;
      if (!exemploNaN) exemploNaN = { pos: p && p.slotPos, tx: String(tx), ty: String(ty),
        minuto: +(+this.minute).toFixed(1) };
    }
    return P._integrate.apply(this, arguments);
  };
  let s = 0;
  while (!sim.isOver() && s++ < 500000) {
    sim.step(1 / 30);
    if (s % 30) continue;
    for (const tm of sim.teams) for (const p of tm.players) {
      const br = p && p._breaking;
      if (!br) continue;
      if (Number.isFinite(+br.t) && Number.isFinite(+br.dir)) marcaOk++;
      else {
        marcaTorta++;
        if (!exemploMarca) exemploMarca = { pos: p.slotPos, marca: Object.keys(br).join(','),
          t: String(br.t), dir: String(br.dir), minuto: +(+sim.minute).toFixed(1) };
      }
    }
  }
}

let falhas = 0;
const ok = (cond, msg, detalhe) => {
  if (cond) { console.log('  ok    ' + msg); return; }
  console.log('  FALHA ' + msg);
  if (detalhe) console.log('        ' + JSON.stringify(detalhe));
  falhas++;
};

console.log(`\nD35 — arrancada e alvos finitos (${N} partidas, build ${BUILD})`);
ok(integrateNaN === 0,
   `_integrate sempre recebe alvo finito  ->  ${integrateOk} chamadas, ${integrateNaN} NaN`,
   exemploNaN);
ok(marcaTorta === 0,
   `toda marca _breaking tem t e dir finitos  ->  ${marcaOk} validas, ${marcaTorta} tortas`,
   exemploMarca);
ok(integrateOk > 1000, `o teste realmente exercitou o motor  ->  ${integrateOk} chamadas`);

if (falhas) { console.log(`\n${falhas} invariante(s) quebrada(s).`); process.exit(1); }
console.log('\ntodas as invariantes do D35 valem.');
