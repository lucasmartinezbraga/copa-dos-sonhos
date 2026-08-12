#!/usr/bin/env node
/* D19-b · o funil: ONDE, na cadeia, os chutes desaparecem?
   -------------------------------------------------------------------------
   A sonda ramo-d19.js ja isolou a causa em H1 — "cria menos chutes" (razao
   76+/0-15 = 0,685 por minuto de jogo, com o acerto ao alvo estavel em 0,996).

   Mas "cria menos chutes" ainda tem dois donos possiveis, e eles pedem
   consertos em lugares diferentes:

     F1  chegam MENOS jogadas a distancia de chute
         -> o conserto e na movimentacao / na construcao

     F2  chegam as MESMAS jogadas e o portador decide chutar menos
         -> o conserto e na decisao

   Esta sonda conta o funil inteiro por faixa de 15 min:

       posses            quadros com a bola dominada por alguem
       em alcance        ... e o portador a 10-27 m do gol (a janela do
                         sorteio contextual da camada 16)
       decisoes          chamadas de _decide com bola dominada
       chutes            _shoot

   E imprime a razao 76+/0-15 de cada degrau. O degrau cuja razao cair e o
   dono; os degraus acima dele estao inocentes.

   Uso: node tools/fisica/ramo-d19b.js <build.html> [partidas] */
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
const N = Number(process.argv[3] || 48);

const ROTULOS = ['0-15', '16-30', '31-45', '46-60', '61-75', '76+'];
const faixaDe = min => Math.max(0, Math.min(5, Math.floor((+min || 0) / 15)));
const zero = () => ROTULOS.map(() => 0);
const DT = 1 / 30;

const minutos = zero(), posses = zero(), alcance = zero(), decisoes = zero(),
      chutes = zero(), avancoSoma = zero(), avancoN = zero(),
      velSoma = zero(), velN = zero();

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const A = mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true);
  const B = mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false);
  const sim = new MatchSim(A, B, { neutral: true, labMode: true });
  const P = Object.getPrototypeOf(sim);

  const fx = () => faixaDe(sim.minute);

  /* topo da pilha: e o que executa */
  const topoDecide = P._decide;
  sim._decide = function (o) {
    if (o && this.ball && this.ball.owner === o) decisoes[fx()]++;
    return topoDecide.apply(this, arguments);
  };
  const topoShoot = P._shoot;
  sim._shoot = function () { chutes[fx()]++; return topoShoot.apply(this, arguments); };

  let guarda = 0;
  while (!sim.isOver() && guarda++ < 500000) {
    const f = fx();
    const mAntes = Number(sim.minute) || 0;
    sim.step(DT);
    const dm = (Number(sim.minute) || 0) - mAntes;
    if (dm > 0 && dm < 0.5) minutos[f] += dm;

    const b = sim.ball, o = b && b.owner;
    if (o && !o.isGK) {
      posses[f]++;
      const tm = sim.teams[o.team], g = tm && tm.oppGoal;
      if (g) {
        const dtg = Math.hypot(o.x - g.x, o.y - g.y);
        if (dtg >= 10 && dtg <= 27) alcance[f]++;
        /* avanco do portador: quanto ele progrediu em direcao ao gol */
        avancoSoma[f] += Math.max(0, 105 - dtg); avancoN[f]++;
      }
    }
    /* velocidade media dos 22 — a fadiga entra por p.maxSpd * staminaF */
    if (guarda % 120 === 0) {
      let s = 0, n = 0;
      for (const tm of sim.teams) for (const p of tm.players)
        if (p && !p.red) { s += Math.hypot(+p.vx || 0, +p.vy || 0); n++; }
      if (n) { velSoma[f] += s / n; velN[f]++; }
    }
  }
}

const por = (v, f) => minutos[f] > 0 ? v / minutos[f] : 0;
const col = (x, n = 9, d = 3) => Number(x).toFixed(d).padStart(n);

console.log(`\nD19-b · o funil, ${N} partidas — tudo por minuto de jogo\n`);
console.log('faixa   min-jogo | posses/min  emAlcance/min  decisoes/min  chutes/min'
  + ' | chute por decisao | avanco medio | vel media');
console.log('-'.repeat(140));
for (let f = 0; f < 6; f++) {
  console.log(`${ROTULOS[f].padEnd(7)} ${col(minutos[f], 8, 1)} |`
    + `${col(por(posses[f], f), 11, 1)} ${col(por(alcance[f], f), 14, 1)}`
    + `${col(por(decisoes[f], f), 14, 2)} ${col(por(chutes[f], f), 12)} |`
    + `${col(chutes[f] / (decisoes[f] || 1), 18, 5)} |`
    + `${col(avancoSoma[f] / (avancoN[f] || 1), 13, 2)} |`
    + `${col(velSoma[f] / (velN[f] || 1), 10)}`);
}

const r = (arr) => por(arr[5], 5) / (por(arr[0], 0) || 1);
const razoes = [
  ['posses por minuto ........', r(posses)],
  ['em alcance por minuto ....', r(alcance)],
  ['decisoes por minuto ......', r(decisoes)],
  ['chutes por minuto ........', r(chutes)],
  ['chute por decisao ........', (chutes[5] / (decisoes[5] || 1)) / ((chutes[0] / (decisoes[0] || 1)) || 1)],
  ['avanco medio do portador .', (avancoSoma[5] / (avancoN[5] || 1)) / ((avancoSoma[0] / (avancoN[0] || 1)) || 1)],
  ['velocidade media dos 22 ..', (velSoma[5] / (velN[5] || 1)) / ((velSoma[0] / (velN[0] || 1)) || 1)],
];
console.log('\nrazao 76+ / 0-15   (1,00 = nao muda ao longo da partida)');
for (const [nome, v] of razoes)
  console.log(`  ${nome} ${v.toFixed(3)}   ${v < 0.9 ? '<== CAI AQUI' : v > 1.1 ? '<== SOBE' : 'estavel'}`);
console.log('\nO PRIMEIRO degrau que cai e o dono. Os de cima estao inocentes.\n');

console.log(JSON.stringify({
  partidas: N, rotulos: ROTULOS,
  minutos: minutos.map(x => +x.toFixed(1)),
  porMinuto: {
    posses: ROTULOS.map((_, f) => +por(posses[f], f).toFixed(2)),
    emAlcance: ROTULOS.map((_, f) => +por(alcance[f], f).toFixed(2)),
    decisoes: ROTULOS.map((_, f) => +por(decisoes[f], f).toFixed(2)),
    chutes: ROTULOS.map((_, f) => +por(chutes[f], f).toFixed(3)),
  },
  chutePorDecisao: ROTULOS.map((_, f) => +(chutes[f] / (decisoes[f] || 1)).toFixed(5)),
  avancoMedio: ROTULOS.map((_, f) => +(avancoSoma[f] / (avancoN[f] || 1)).toFixed(2)),
  velMedia: ROTULOS.map((_, f) => +(velSoma[f] / (velN[f] || 1)).toFixed(3)),
  razoes: Object.fromEntries(razoes.map(([n, v]) => [n.replace(/[ .]+$/, ''), +v.toFixed(3)])),
}, null, 1));
