#!/usr/bin/env node
/* D08-b · O ARREMESSADOR ENVENENADO.
   -------------------------------------------------------------------------
   Achado da sonda ramo-d08: 34% das chamadas de `_attackTarget` para papeis de
   flanco voltam com `ty` NaN. A origem:

     camada 17, ao armar o lateral:
         taker._breaking = taker._breaking || { throwInDuty: true };

   O objeto NAO tem `dir`. E o decaimento do motor,

         if (p._breaking) { p._breaking.t -= dt; if (p._breaking.t <= 0) p._breaking = null; }

   faz `undefined - dt = NaN` e `NaN <= 0` e FALSO — entao a marca NUNCA e
   apagada. Quem cobrou um lateral carrega `_breaking` ate o fim da partida.

   Quatro consequencias, todas permanentes para aquele jogador:
     1. `ty = clamp(ty + p._breaking.dir * 9, ...)` vira NaN — o alvo LATERAL
        desaparece;
     2. `tProg = max(tProg, ballProg + 16)` — ele fica sempre 16 m a frente da
        bola, como se estivesse em arrancada;
     3. `ballDutyEarly` inclui `p._breaking`, entao ele pula a suavizacao de
        reacao para sempre;
     4. `if (!p._breaking) tProg = min(tProg, onsideCap)` — ele fica isento do
        teto de impedimento.

   Esta sonda mede o tamanho do estrago sem consertar nada.

   Uso: node tools/fisica/ramo-d08b.js [build.html] [partidas]
*/
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
const N = Number(process.argv[3] || 24);
const html = fs.readFileSync(BUILD, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);
{
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(html))) {
    const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('s' + i); i++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(m[2], { filename: id }); } catch (_) {}
  }
}
const FWv = Number(global.FW) || 68, FLv = Number(global.FL) || 105;
const DT = 1 / 30;
const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

const M = {
  quadros: 0, jogadorQuadros: 0,
  marcadosSemDir: 0, marcadosComDir: 0,
  alvoAtqNaN: 0, alvoAtqOk: 0,
  integrateNaN: 0, integrateOk: 0,
  /* quantos jogadores DISTINTOS terminam a partida envenenados */
  envenenadosNoFim: 0, primeiroMinuto: [],
};
const dl = y => Math.min(y, FWv - y);

for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  const P = Object.getPrototypeOf(sim);
  sim._attackTarget = function (tm, p, b) {
    const r = P._attackTarget.apply(this, arguments);
    try {
      const y = r && (Array.isArray(r) ? +r[1] : +r.y);
      if (r) { if (Number.isFinite(y)) M.alvoAtqOk++; else M.alvoAtqNaN++; }
    } catch (_) {}
    return r;
  };
  sim._integrate = function (p, tx, ty, dt, freeze) {
    if (Number.isFinite(+ty)) M.integrateOk++; else M.integrateNaN++;
    return P._integrate.apply(this, arguments);
  };
  const visto = new Set();
  let s = 0;
  while (!sim.isOver() && s++ < 500000) {
    sim.step(DT);
    if (s % 15) continue;
    M.quadros++;
    for (const tm of sim.teams) for (const p of tm.players) {
      if (!p || p.red || p.isGK) continue;
      M.jogadorQuadros++;
      const br = p._breaking;
      if (!br) continue;
      if (Number.isFinite(+br.dir)) M.marcadosComDir++;
      else {
        M.marcadosSemDir++;
        const k = p.team + ':' + p.idx;
        if (!visto.has(k)) { visto.add(k); M.primeiroMinuto.push(+(+sim.minute).toFixed(1)); }
      }
    }
  }
  for (const tm of sim.teams) for (const p of tm.players) {
    if (!p || p.isGK) continue;
    if (p._breaking && !Number.isFinite(+p._breaking.dir)) M.envenenadosNoFim++;
  }
}

const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
const med = a => a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1) : null;
console.log(JSON.stringify({
  build: sha, partidas: N,
  marcaDeArrancada: {
    quadrosDeJogadorAmostrados: M.jogadorQuadros,
    comDirValida: M.marcadosComDir,
    semDir_envenenados: M.marcadosSemDir,
    percentualDoTempoEnvenenado: pct(M.marcadosSemDir, M.jogadorQuadros),
    jogadoresEnvenenadosNoApitoFinal: +(M.envenenadosNoFim / N).toFixed(2),
    de20DeLinha: 20,
    minutoMedioDoContagio: med(M.primeiroMinuto),
  },
  alvoDeAtaque: {
    comY: M.alvoAtqOk, semY_NaN: M.alvoAtqNaN,
    percentualNaN: pct(M.alvoAtqNaN, M.alvoAtqOk + M.alvoAtqNaN),
  },
  integrate: {
    comY: M.integrateOk, comYNaN: M.integrateNaN,
    percentualNaN: pct(M.integrateNaN, M.integrateOk + M.integrateNaN),
  },
}, null, 2));
