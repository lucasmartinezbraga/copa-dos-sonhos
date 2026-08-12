#!/usr/bin/env node
/* D20 · quem posiciona o ATACANTE quando o time nao tem a bola?
   -------------------------------------------------------------------------
   Medido: o bloco encurta 2,8 m ao perder a bola (real: 8 a 10). A camada 23
   prende a ultima linha e o meio a `_r13LineDepth` e deixava o atacante sem
   teto — o que parecia explicar tudo, ja que o comprimento do bloco E a
   distancia do ultimo defensor ao jogador mais adiantado.

   Pus o teto. Com 30 m o bloco foi de 38,2 para 37,0. Com 18 m foi para 38,9
   — SUBIU. Um teto que aperta 12 metros e nao move o numero nao esta prendendo
   nada: ou o atacante nao passa por `_defendTarget`, ou alguem escreve por
   cima depois.

   Esta sonda responde, no TOPO da pilha:
     - quantas vezes _defendTarget e chamado, por linha (DEF/MID/FWD)
     - quantas vezes o valor que a camada 23 devolve para o FWD e ALTERADO
       antes de virar posicao (alguem por cima)
     - a distancia real do FWD a linha, quando o time nao tem a bola
     - quem esta mais adiantado no bloco: um FWD, um MID ou um DEF

   Uso: node tools/fisica/ramo-d20.js <build.html> [partidas] */
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
const N = Number(process.argv[3] || 8);

const FLx = 105;
const linhaDe = p => {
  const pos = p && (p.oopPos || p.slotPos);
  if (!p || p.isGK || pos === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
  if (['CDM', 'DM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  return 'FWD';
};
const prog = (tm, x) => (tm && tm.goal && tm.goal.x < FLx / 2) ? x : FLx - x;

const chamadas = { DEF: 0, MID: 0, FWD: 0, GK: 0 };
let fwdAcima30 = 0, fwdTotal = 0, somaDist = 0;
const maisAdiantado = { DEF: 0, MID: 0, FWD: 0, GK: 0 };
let quadrosSemBola = 0;

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const sim = new MatchSim(mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true),
                           mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false),
                           { neutral: true, labMode: true });
  const P = Object.getPrototypeOf(sim), topo = P._defendTarget;

  sim._defendTarget = function (tm, p) {
    const L = linhaDe(p);
    chamadas[L]++;
    const out = topo.apply(this, arguments);
    if (L === 'FWD' && out && tm && Number.isFinite(tm._r13LineDepth)) {
      const d = prog(tm, out[0]) - tm._r13LineDepth;
      fwdTotal++; somaDist += d;
      if (d > 30) fwdAcima30++;
    }
    return out;
  };

  let guarda = 0;
  while (!sim.isOver() && guarda++ < 500000) {
    sim.step(1 / 30);
    /* quem esta mais adiantado no time SEM a bola — e ele que define o
       comprimento do bloco que a forma.js mede */
    const b = sim.ball, dono = b && b.owner;
    if (guarda % 30) continue;
    for (const tm of sim.teams) {
      if (dono && dono.team === tm.side) continue;   /* este time TEM a bola */
      quadrosSemBola++;
      let melhorL = null, melhor = -1e9;
      for (const p of tm.players) {
        if (!p || p.red || p.isGK) continue;
        const d = prog(tm, p.x);
        if (d > melhor) { melhor = d; melhorL = linhaDe(p); }
      }
      if (melhorL) maisAdiantado[melhorL]++;
    }
  }
}

const pct = (a, b) => (100 * a / (b || 1)).toFixed(1) + '%';
console.log(`\nD20 · quem posiciona o atacante sem a bola — ${N} partidas\n`);
console.log('  chamadas de _defendTarget por linha:');
for (const L of ['DEF', 'MID', 'FWD', 'GK'])
  console.log(`      ${L.padEnd(4)} ${String(chamadas[L]).padStart(9)}`);
console.log(`\n  FWD que passaram por _defendTarget ..... ${fwdTotal}`);
console.log(`  distancia media do FWD a linha ......... ${(somaDist / (fwdTotal || 1)).toFixed(2)} m`);
console.log(`  FWD DEVOLVIDOS acima de linha+30 m ..... ${fwdAcima30} (${pct(fwdAcima30, fwdTotal)})`);
console.log('      ^ se o teto da camada 23 estivesse valendo, isto seria ZERO');
console.log('\n  quem esta MAIS ADIANTADO no time sem a bola:');
for (const L of ['DEF', 'MID', 'FWD'])
  console.log(`      ${L.padEnd(4)} ${pct(maisAdiantado[L], quadrosSemBola)}`);
console.log('      ^ o comprimento do bloco que a forma.js mede e a distancia');
console.log('        do ultimo defensor ATE ESTE JOGADOR\n');

console.log(JSON.stringify({
  partidas: N, chamadasPorLinha: chamadas, fwdMedidos: fwdTotal,
  distanciaMediaFwdALinha: +(somaDist / (fwdTotal || 1)).toFixed(2),
  fwdAcimaDe30: fwdAcima30, fracaoFwdAcimaDe30: +(fwdAcima30 / (fwdTotal || 1)).toFixed(4),
  maisAdiantadoSemBola: maisAdiantado, amostrasSemBola: quadrosSemBola,
}, null, 1));
