#!/usr/bin/env node
/* A POSSE INTEIRA · por que a bola chega menos a area, se tudo o mais e igual?
   -------------------------------------------------------------------------
   Estado da investigacao ANTES desta sonda (ramo-passes.js, 24 partidas,
   razao 76+/0-15, tudo por minuto de jogo):

       onde a posse comeca ....... 1,007  estavel
       passes por posse .......... 1,046  estavel
       distancia do passe ........ 1,006  estavel
       fracao para frente ........ 1,075  estavel
       progresso por passe ....... 1,183  SOBE
       passe termina em alcance .. 0,744  CAI
       chutes por minuto ......... 0,588  CAI

   Isto NAO fecha. Mesma origem, mesmo numero de passes, mesma distancia,
   mesma direcao e MAIS chao por passe deveriam levar a bola MAIS para frente,
   nao menos. Alguma das medias esta escondendo a distribuicao.

   Duas leituras possiveis, e sao diferentes:

     Q1  as posses sao IGUAIS e poucas chegam longe — a media de progresso sobe
         porque as posses curtas somem, nao porque as longas melhoram
     Q2  as posses MUDAM DE FIM — elas morrem antes, e o jeito como morrem e o
         mecanismo (desarme? passe errado? bola fora?)

   Esta sonda nao mede media de passe nenhum. Ela segue CADA POSSE do inicio
   ao fim e publica a DISTRIBUICAO:

     - progresso MAXIMO alcancado na posse
     - fracao de posses que chegam a menos de 27 m do gol (a faixa de chute)
     - fracao que chega a menos de 40 m (o ultimo terco)
     - numero de passes na posse, por faixa de tamanho
     - COMO a posse terminou

   Uso: node tools/fisica/ramo-posse.js <build.html> [partidas] */
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
const N = Number(process.argv[3] || 24);

const FLx = 105;
const ROT = ['0-15', '16-30', '31-45', '46-60', '61-75', '76+'];
const faixaDe = min => Math.max(0, Math.min(5, Math.floor((+min || 0) / 15)));
const prog = (tm, x) => (tm && tm.goal && tm.goal.x < FLx / 2) ? x : FLx - x;

/* por faixa: acumuladores da DISTRIBUICAO, nao da media */
const F = ROT.map(() => ({
  posses: 0, minutos: 0,
  maxProgSoma: 0,
  chegouArea: 0, chegouTerco: 0,       /* <=27 m e <=40 m do gol adversario */
  passes0: 0, passes1: 0, passes2a3: 0, passes4mais: 0,
  chutou: 0,
  durSoma: 0,
  /* SO para as posses que CHEGARAM a faixa de chute: quanto tempo ficaram la
     e como acabaram. O funil mediu que o TEMPO na faixa cai 39% enquanto a
     CHEGADA cai so 16% — a diferenca tem de estar aqui. */
  areaN: 0, areaDwell: 0, areaChutou: 0, areaSaiu: 0, areaPerdeu: 0,
}));

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const sim = new MatchSim(mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true),
                           mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false),
                           { neutral: true, labMode: true });
  const P = Object.getPrototypeOf(sim);

  let atual = null;                       /* a posse em curso */

  const fecha = () => {
    if (!atual || atual.time == null) { atual = null; return; }
    const a = F[atual.faixa];
    a.posses++;
    a.maxProgSoma += atual.maxProg;
    if (atual.maisPerto <= 27) a.chegouArea++;
    if (atual.maisPerto <= 40) a.chegouTerco++;
    if (atual.passes === 0) a.passes0++;
    else if (atual.passes === 1) a.passes1++;
    else if (atual.passes <= 3) a.passes2a3++;
    else a.passes4mais++;
    if (atual.chutou) a.chutou++;
    if (atual.maisPerto <= 27) {
      a.areaN++;
      a.areaDwell += atual.dwell;
      if (atual.chutou) a.areaChutou++;
      else if (atual.saiuDaArea) a.areaSaiu++;
      else a.areaPerdeu++;
    }
    a.durSoma += Math.max(0, (Number(sim.t) || 0) - atual.t0);
    atual = null;
  };

  const topoStart = P._startTravel;
  sim._startTravel = function (actor, t, kind) {
    if (atual && actor && actor.team === atual.time) {
      if (kind === 'shot') atual.chutou = true; else atual.passes++;
    }
    return topoStart.apply(this, arguments);
  };

  let guarda = 0;
  while (!sim.isOver() && guarda++ < 500000) {
    const mAntes = Number(sim.minute) || 0;
    sim.step(1 / 30);
    const dm = (Number(sim.minute) || 0) - mAntes;
    if (dm > 0 && dm < 0.5) F[faixaDe(mAntes)].minutos += dm;

    const b = sim.ball, dono = b && b.owner;
    const td = dono && !dono.isGK ? dono.team : null;

    /* SO fecha quando o OUTRO time toma a bola. Enquanto ela viaja o dono e
       null — a versao anterior fechava a posse a cada passe, e por isso 100%
       das posses tinham 0 ou 1 passe e duravam 1,2 s. O mesmo defeito estava
       em ramo-passes.js: `passes por posse` e `duracao da posse` de la mediam
       lance de bola, nao posse de equipe. */
    if (atual && td != null && td !== atual.time) fecha();
    if (td != null && !atual) {
      atual = { time: td, faixa: faixaDe(Number(sim.minute) || 0),
                t0: Number(sim.t) || 0, passes: 0, chutou: false,
                maxProg: -1e9, maisPerto: 1e9, dwell: 0, naArea: false,
                saiuDaArea: false };
    }
    if (atual && b) {
      const tm = sim.teams[atual.time], g = tm && tm.oppGoal;
      const p = prog(tm, +b.x || 0);
      if (p > atual.maxProg) atual.maxProg = p;
      if (g) {
        const d = Math.hypot((+b.x || 0) - g.x, (+b.y || 0) - g.y);
        if (d < atual.maisPerto) atual.maisPerto = d;
        const dentro = d <= 27;
        if (dentro) { atual.dwell += 1 / 30; atual.naArea = true; }
        else if (atual.naArea) atual.saiuDaArea = true;
      }
    }
  }
  fecha();
}

const pc = (a, b) => 100 * a / (b || 1);
const col = (x, n = 9, d = 2) => Number(x).toFixed(d).padStart(n);

console.log(`\nA POSSE INTEIRA · ${N} partidas — distribuicao, nao media\n`);
console.log('faixa   posses/min | progresso max | %chega a area  %chega ao terco | %0 passes %1 %2-3 %4+ | %chuta');
console.log('-'.repeat(132));
for (let f = 0; f < 6; f++) {
  const a = F[f], n = a.posses || 1;
  console.log(`${ROT[f].padEnd(7)} ${col(a.posses / (a.minutos || 1), 10, 2)} |`
    + `${col(a.maxProgSoma / n, 14)} |`
    + `${col(pc(a.chegouArea, n), 13)} ${col(pc(a.chegouTerco, n), 16)} |`
    + `${col(pc(a.passes0, n), 10, 1)}${col(pc(a.passes1, n), 6, 1)}`
    + `${col(pc(a.passes2a3, n), 7, 1)}${col(pc(a.passes4mais, n), 6, 1)} |`
    + `${col(pc(a.chutou, n), 7, 2)}`);
}

const r = (fn) => fn(F[5]) / (fn(F[0]) || 1);
const razoes = [
  ['posses por minuto ..........', r(a => a.posses / (a.minutos || 1))],
  ['progresso maximo da posse ..', r(a => a.maxProgSoma / (a.posses || 1))],
  ['% chega a area (<=27 m) ....', r(a => a.chegouArea / (a.posses || 1))],
  ['% chega ao terco (<=40 m) ..', r(a => a.chegouTerco / (a.posses || 1))],
  ['% posses com 0 passes ......', r(a => a.passes0 / (a.posses || 1))],
  ['% posses com 4+ passes .....', r(a => a.passes4mais / (a.posses || 1))],
  ['% posses que chutam ........', r(a => a.chutou / (a.posses || 1))],
  ['duracao media da posse .....', r(a => a.durSoma / (a.posses || 1))],
  ['-- so as que chegaram a area --', 1],
  ['tempo NA area por chegada ..', r(a => a.areaDwell / (a.areaN || 1))],
  ['% delas que chutam .........', r(a => a.areaChutou / (a.areaN || 1))],
  ['% que SAEM da area .........', r(a => a.areaSaiu / (a.areaN || 1))],
  ['% que perdem a bola la .....', r(a => a.areaPerdeu / (a.areaN || 1))],
];
console.log('\nrazao 76+ / 0-15   (1,00 = nao muda ao longo da partida)');
for (const [nome, v] of razoes) {
  if (nome.startsWith('--')) { console.log(`\n  ${nome}`); continue; }
  console.log(`  ${nome} ${v.toFixed(3)}   ${v < 0.9 ? '<== CAI' : v > 1.1 ? '<== SOBE' : 'estavel'}`);
}
console.log();

console.log(JSON.stringify({
  partidas: N, rotulos: ROT,
  porFaixa: F.map((a, i) => ({
    faixa: ROT[i], posses: a.posses, minutos: +a.minutos.toFixed(1),
    possesPorMinuto: +(a.posses / (a.minutos || 1)).toFixed(3),
    progressoMaximoMedio: +(a.maxProgSoma / (a.posses || 1)).toFixed(2),
    pctChegaArea: +pc(a.chegouArea, a.posses).toFixed(2),
    pctChegaTerco: +pc(a.chegouTerco, a.posses).toFixed(2),
    pct0passes: +pc(a.passes0, a.posses).toFixed(2),
    pct4maisPasses: +pc(a.passes4mais, a.posses).toFixed(2),
    pctChuta: +pc(a.chutou, a.posses).toFixed(2),
    duracaoMedia: +(a.durSoma / (a.posses || 1)).toFixed(2),
    chegadasNaArea: a.areaN,
    tempoNaAreaPorChegada: +(a.areaDwell / (a.areaN || 1)).toFixed(3),
    pctChutaDaArea: +pc(a.areaChutou, a.areaN).toFixed(2),
    pctSaiDaArea: +pc(a.areaSaiu, a.areaN).toFixed(2),
    pctPerdeNaArea: +pc(a.areaPerdeu, a.areaN).toFixed(2),
  })),
  razoes: Object.fromEntries(razoes.map(([n, v]) => [n.replace(/[ .]+$/, '').trim(), +v.toFixed(3)])),
}, null, 1));
