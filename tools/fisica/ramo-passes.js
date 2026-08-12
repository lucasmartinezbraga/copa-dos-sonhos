#!/usr/bin/env node
/* PASSES QUE SOBEM · o time cansado circula em vez de arriscar — mas COMO?
   -------------------------------------------------------------------------
   O auditor achou sozinho (tools/auditor.py --forma 3): os passes por minuto
   SOBEM monotonicamente ao longo da partida, 15,5 -> 18,2, nas cinco
   transicoes de faixa. Ao mesmo tempo os chutes CAEM (razao 76+/0-15 = 0,611)
   e a entrada na faixa de chute desaba 39%.

   "Circula mais e arrisca menos" e uma frase, nao um mecanismo. Ela tem pelo
   menos quatro donos, e eles pedem consertos em lugares diferentes:

     P1  passe mais CURTO      mesma jogada, mais toques para cobrir o campo
                               -> o alvo do passe encolhe (distancia)
     P2  passe mais PARA TRAS  o time recua a bola em vez de progredir
                               -> a direcao escolhida muda
     P3  posse mais LONGA      a jogada dura mais antes de acabar
                               -> o time nao perde a bola, so nao conclui
     P4  MAIS posses           mais jogadas por minuto, cada uma igual
                               -> ja MEDIDO e descartado: posses/min = 0,940

   P4 esta descartado pelo funil (ramo-d19b.js). Esta sonda separa P1, P2 e P3.

   Mede por faixa de 15 min de jogo, tudo por MINUTO DE JOGO (`sim.minute`):
     - passes por posse e duracao media da posse
     - distancia media do passe
     - progresso medio por passe (metros ganhos em direcao ao gol)
     - fracao de passes para tras / lateral / para frente
     - fracao de passes que TERMINAM dentro da faixa de chute (10-27 m)

   NAO EDITE NADA antes de ler a saida.

   Uso: node tools/fisica/ramo-passes.js <build.html> [partidas] */
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
const N = Number(process.argv[3] || 32);

const FLx = 105;
const ROT = ['0-15', '16-30', '31-45', '46-60', '61-75', '76+'];
const faixaDe = min => Math.max(0, Math.min(5, Math.floor((+min || 0) / 15)));
const zero = () => ROT.map(() => 0);
const prog = (tm, x) => (tm && tm.goal && tm.goal.x < FLx / 2) ? x : FLx - x;

const minutos = zero(), passes = zero(), distSoma = zero(), progSoma = zero(),
      paraTras = zero(), lateral = zero(), paraFrente = zero(),
      terminaEmAlcance = zero(), posses = zero(), posseDur = zero(),
      passesNaPosse = zero(), chutes = zero(),
      /* ONDE a posse COMECA. Se o progresso por passe SOBE e a chegada a faixa
         de chute CAI, so sobra uma explicacao: a bola e recuperada mais longe
         do gol adversario. Isso e o press, nao o passe. */
      recupSoma = zero(), recupN = zero();

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const sim = new MatchSim(mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true),
                           mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false),
                           { neutral: true, labMode: true });
  const P = Object.getPrototypeOf(sim);

  const fx = () => faixaDe(sim.minute);

  /* _startTravel e por onde TODO passe sai — inclusive os das camadas, porque
     instrumento no topo da pilha. O alvo vem no argumento, entao a distancia e
     o progresso sao os PRETENDIDOS, nao os realizados: e o que a decisao
     escolheu, que e exatamente o que quero medir. */
  const topoStart = P._startTravel;
  sim._startTravel = function (actor, t, kind) {
    if (actor && t && kind !== 'shot' && this.teams) {
      const tm = this.teams[actor.team];
      if (tm) {
        const f = fx();
        const dx = (+t.x || 0) - (+actor.x || 0), dy = (+t.y || 0) - (+actor.y || 0);
        const d = Math.hypot(dx, dy);
        const ganho = prog(tm, +t.x || 0) - prog(tm, +actor.x || 0);
        passes[f]++; distSoma[f] += d; progSoma[f] += ganho;
        if (ganho < -2) paraTras[f]++; else if (ganho > 2) paraFrente[f]++; else lateral[f]++;
        const g = tm.oppGoal;
        if (g) {
          const dtg = Math.hypot((+t.x || 0) - g.x, (+t.y || 0) - g.y);
          if (dtg >= 10 && dtg <= 27) terminaEmAlcance[f]++;
        }
        passesNaPosse[f]++;
      }
    }
    if (kind === 'shot') chutes[fx()]++;
    return topoStart.apply(this, arguments);
  };

  let guarda = 0, donoAnterior = null, posseInicio = 0, posseFaixa = 0;
  while (!sim.isOver() && guarda++ < 500000) {
    const mAntes = Number(sim.minute) || 0;
    const f = faixaDe(mAntes);
    sim.step(1 / 30);
    const dm = (Number(sim.minute) || 0) - mAntes;
    if (dm > 0 && dm < 0.5) minutos[f] += dm;

    const b = sim.ball, dono = b && b.owner;
    const td = dono && !dono.isGK ? dono.team : null;
    if (td !== donoAnterior) {
      if (donoAnterior != null) {
        const dur = (Number(sim.t) || 0) - posseInicio;
        if (dur > 0 && dur < 120) { posses[posseFaixa]++; posseDur[posseFaixa] += dur; }
      }
      donoAnterior = td;
      posseInicio = Number(sim.t) || 0;
      posseFaixa = f;
      if (td != null && sim.teams[td]) {
        const tmN = sim.teams[td];
        recupSoma[f] += prog(tmN, (b && +b.x) || 0); recupN[f]++;
      }
    }
  }
}

const por = (v, f) => minutos[f] > 0 ? v / minutos[f] : 0;
const col = (x, n = 9, d = 2) => Number(x).toFixed(d).padStart(n);
const pc = (a, b) => (100 * a / (b || 1));

console.log(`\nPASSES QUE SOBEM · ${N} partidas — tudo por minuto de jogo\n`);
console.log('faixa   min-jogo | passes/min chutes/min | dist media  progresso/passe'
  + ' | %tras %lat %frente | %termina em alcance | passes/posse  posse(s)  recupera em');
console.log('-'.repeat(146));
for (let f = 0; f < 6; f++) {
  console.log(`${ROT[f].padEnd(7)} ${col(minutos[f], 8, 1)} |`
    + `${col(por(passes[f], f), 10, 2)} ${col(por(chutes[f], f), 10, 3)} |`
    + `${col(distSoma[f] / (passes[f] || 1), 11)} ${col(progSoma[f] / (passes[f] || 1), 16)} |`
    + `${col(pc(paraTras[f], passes[f]), 6, 1)}${col(pc(lateral[f], passes[f]), 6, 1)}`
    + `${col(pc(paraFrente[f], passes[f]), 8, 1)} |`
    + `${col(pc(terminaEmAlcance[f], passes[f]), 20, 2)} |`
    + `${col(passesNaPosse[f] / (posses[f] || 1), 13, 2)} ${col(posseDur[f] / (posses[f] || 1), 9)}`
    + `${col(recupSoma[f] / (recupN[f] || 1), 12)}`);
}

const r = (arr, den) => {
  const a0 = den ? arr[0] / (den[0] || 1) : por(arr[0], 0);
  const a5 = den ? arr[5] / (den[5] || 1) : por(arr[5], 5);
  return a5 / (a0 || 1);
};
const razoes = [
  ['passes por minuto .........', r(passes)],
  ['chutes por minuto .........', r(chutes)],
  ['P1 distancia do passe .....', r(distSoma, passes)],
  ['P1 progresso por passe ....', r(progSoma, passes)],
  ['P2 fracao para tras .......', r(paraTras, passes)],
  ['P2 fracao para frente .....', r(paraFrente, passes)],
  ['   termina em alcance .....', r(terminaEmAlcance, passes)],
  ['P3 passes por posse .......', r(passesNaPosse, posses)],
  ['P3 duracao da posse .......', r(posseDur, posses)],
  ['ONDE a posse comeca .......', r(recupSoma, recupN)],
];
console.log('\nrazao 76+ / 0-15   (1,00 = nao muda ao longo da partida)');
for (const [nome, v] of razoes)
  console.log(`  ${nome} ${v.toFixed(3)}   ${v < 0.9 ? '<== CAI' : v > 1.1 ? '<== SOBE' : 'estavel'}`);
console.log('\nO que se move e o mecanismo. O que fica em 1,00 esta inocente.\n');

console.log(JSON.stringify({
  partidas: N, rotulos: ROT,
  minutos: minutos.map(x => +x.toFixed(1)),
  passesPorMinuto: ROT.map((_, f) => +por(passes[f], f).toFixed(2)),
  chutesPorMinuto: ROT.map((_, f) => +por(chutes[f], f).toFixed(3)),
  distanciaMedia: ROT.map((_, f) => +(distSoma[f] / (passes[f] || 1)).toFixed(2)),
  progressoPorPasse: ROT.map((_, f) => +(progSoma[f] / (passes[f] || 1)).toFixed(2)),
  fracaoParaTras: ROT.map((_, f) => +(paraTras[f] / (passes[f] || 1)).toFixed(4)),
  fracaoParaFrente: ROT.map((_, f) => +(paraFrente[f] / (passes[f] || 1)).toFixed(4)),
  fracaoTerminaEmAlcance: ROT.map((_, f) => +(terminaEmAlcance[f] / (passes[f] || 1)).toFixed(4)),
  passesPorPosse: ROT.map((_, f) => +(passesNaPosse[f] / (posses[f] || 1)).toFixed(2)),
  duracaoDaPosse: ROT.map((_, f) => +(posseDur[f] / (posses[f] || 1)).toFixed(2)),
  ondeAPosseComeca: ROT.map((_, f) => +(recupSoma[f] / (recupN[f] || 1)).toFixed(2)),
  razoes: Object.fromEntries(razoes.map(([n, v]) => [n.replace(/[ .]+$/, '').trim(), +v.toFixed(3)])),
}, null, 1));
