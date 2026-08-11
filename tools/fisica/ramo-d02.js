#!/usr/bin/env node
/* D02 · o `_contestLoose` entrega a bola sem teto de distancia?
   -------------------------------------------------------------------------
   O documento afirma 21,3 entregas por partida com o mais proximo a mais de
   3 m. Aquele numero veio de uma sonda da tentativa A4, e A4 se provou errada
   em premissa — entao ele merece ser refeito antes de virar conserto.

   Esta sonda mede, no TOPO da pilha (que e o que realmente executa):
     - quantas vezes _contestLoose e chamado
     - a distancia do jogador que EFETIVAMENTE recebeu a bola
     - o histograma dessa distancia
     - quantas dessas entregas acontecem com a bola FORA do campo

   Uso: node tools/fisica/ramo-d02.js <build.html> [partidas] */
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
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04', 'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const html = fs.readFileSync(process.argv[2] || 'dist/index.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
while ((m = re.exec(html))) { const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('s' + i); i++; if (SKIP.has(id)) continue; try { vm.runInThisContext(m[2], { filename: id }); } catch (_) {} }

const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS)) ? STYLE_KEYS : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0); return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };
const N = Number(process.argv[3] || 12);

let chamadas = 0, entregas = 0, somaD = 0, maxD = 0, fora = 0, foraEntregue = 0;
const faixas = [0, 0, 0, 0, 0, 0]; // <=1,7 | <=2,6 | <=3 | <=5 | <=8 | >8
const faixa = d => d <= 1.7 ? 0 : d <= 2.6 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : d <= 8 ? 4 : 5;

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const sim = new MatchSim(mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true),
                           mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false),
                           { neutral: true, labMode: true });
  const P = Object.getPrototypeOf(sim), topo = P._contestLoose;
  sim._contestLoose = function () {
    const b = this.ball;
    const bx = b.x, by = b.y;
    const estavaFora = bx < 0 || bx > FL || by < 0 || by > FW;
    if (estavaFora) fora++;
    chamadas++;
    const r = topo.call(this);
    const dono = this.ball && this.ball.owner;
    if (dono) {
      const d = D(dono.x, dono.y, bx, by);
      entregas++; somaD += d; if (d > maxD) maxD = d;
      faixas[faixa(d)]++;
      if (estavaFora) foraEntregue++;
    }
    return r;
  };
  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(1 / 30);
}

const pp = v => +(v / N).toFixed(2);
const rot = ['<=1,7 m (raio do _looseRoll)', '<=2,6 m', '<=3 m', '<=5 m', '<=8 m', '>8 m'];
console.log(JSON.stringify({
  partidas: N,
  chamadasDeContestLoose: pp(chamadas),
  entregasEfetivas: pp(entregas),
  distanciaMediaDeQuemRECEBEU: entregas ? +(somaD / entregas).toFixed(2) : 0,
  distanciaMaxima: +maxD.toFixed(2),
  histograma: Object.fromEntries(rot.map((r, i) =>
    [r, `${pp(faixas[i])}/partida (${(100 * faixas[i] / Math.max(1, entregas)).toFixed(1)}%)`])),
  comABolaJAFORAdoCampo: { chamadas: pp(fora), entregues: pp(foraEntregue) },
}, null, 1));
