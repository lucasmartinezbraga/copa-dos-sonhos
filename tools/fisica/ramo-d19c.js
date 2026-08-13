#!/usr/bin/env node
/* D19-c · O TIME PERDENDO AOS 85 JOGA IGUAL AO TIME EMPATANDO AOS 10?
   -------------------------------------------------------------------------
   O laudo reports/D19-D20-a-mesma-alavanca.md gastou 4 baterias e reprovou tres
   tentativas, todas mexendo em FORMA (velocidade da fadiga, piso do bloco). Ele
   fecha deixando DOIS candidatos, e um deles ja caiu depois
   (reports/PASSES-que-sobem.md refutou "o time cansado circula": o passe e
   igual em comprimento, direcao e origem).

   Sobra UM, nunca medido:

       "a decisao de arriscar o passe vertical nao muda com o placar nem com o
        relogio — o time perdendo aos 85 joga igual ao time empatando aos 10"

   O motor TEM maquina de urgencia, e por isso a afirmacao precisa ser medida em
   vez de aceita:

       :923   const urgency = this.minute > 76 && scoreDiff < 0 ? .044 : 0
              — mas so no CHUTE, e vale 4,4 pontos percentuais
       :3172  posturePush += (_losingLate ? 0.28 : 0)      — na POSICAO
       :3756  choose('chase', ...)                          — na IA do treinador

   Nenhum desses e a escolha do passe. Esta sonda mede a DECISAO, cruzando
   estado de placar x faixa de minuto:

       - o que ele escolheu: passe / conducao / chute
       - quao vertical foi o passe escolhido (progressM)
       - quanto risco ele aceitou (best.risk)
       - quantas opcoes existiam e qual o posto da escolhida

   Se as celulas "perdendo no fim" e "empatando no inicio" derem o mesmo numero,
   o candidato esta confirmado e o conserto e de DECISAO — que e onde este
   projeto tem historico de ganho real (o impedimento no _bestPass, a folga do
   goleiro).

   Uso: node tools/fisica/ramo-d19c.js [build.html] [partidas]
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
const N = Number(process.argv[3] || 48);
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
const FLv = Number(global.FL) || 105;
const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

/* celulas: estado de placar x faixa de minuto */
const ESTADOS = ['perdendo', 'empatando', 'ganhando'];
const FAIXAS = ['0-15', '16-30', '31-45', '46-60', '61-75', '76+'];
const cel = {};
for (const e of ESTADOS) for (const f of FAIXAS) {
  cel[e + '|' + f] = { decisoes: 0, passes: 0, conducoes: 0, chutes: 0,
    somaProg: 0, nProg: 0, somaRisco: 0, nRisco: 0, verticais: 0,
    minutos: 0, gols: 0 };
}
const chave = (e, min) => e + '|' + FAIXAS[Math.max(0, Math.min(5, Math.floor(min / 15)))];
const estadoDe = (sim, team) => {
  const d = sim.score[team] - sim.score[1 - team];
  return d < 0 ? 'perdendo' : d > 0 ? 'ganhando' : 'empatando';
};

for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  const P = Object.getPrototypeOf(sim);

  sim._pass = function (o, best) {
    try {
      const c = cel[chave(estadoDe(this, o.team), +this.minute)];
      if (c) {
        c.decisoes++; c.passes++;
        if (best) {
          if (Number.isFinite(+best.progressM)) { c.somaProg += +best.progressM; c.nProg++; }
          if (Number.isFinite(+best.risk)) { c.somaRisco += +best.risk; c.nRisco++; }
          if (+best.progressM > 12) c.verticais++;
        }
      }
    } catch (_) {}
    return P._pass.apply(this, arguments);
  };
  sim._carry = function (o, target) {
    try { const c = cel[chave(estadoDe(this, o.team), +this.minute)];
      if (c) { c.decisoes++; c.conducoes++; } } catch (_) {}
    return P._carry.apply(this, arguments);
  };
  sim._shoot = function (o) {
    try { const c = cel[chave(estadoDe(this, o.team), +this.minute)];
      if (c) { c.decisoes++; c.chutes++; } } catch (_) {}
    return P._shoot.apply(this, arguments);
  };
  sim._goal = function (o, golaco) {
    try { const c = cel[chave(estadoDe(this, o.team), +this.minute)]; if (c) c.gols++; } catch (_) {}
    return P._goal.apply(this, arguments);
  };

  /* minutos de jogo por celula — o denominador honesto (armadilha B3/B10) */
  let s = 0, antes = 0;
  while (!sim.isOver() && s++ < 500000) {
    antes = +sim.minute;
    sim.step(1 / 30);
    const dm = +sim.minute - antes;
    if (!(dm > 0 && dm < 0.5)) continue;
    for (const t of [0, 1]) {
      const c = cel[chave(estadoDe(sim, t), antes)];
      if (c) c.minutos += dm;
    }
  }
}

const r2 = v => Math.round(v * 1000) / 1000;
const linhas = [];
for (const e of ESTADOS) for (const f of FAIXAS) {
  const c = cel[e + '|' + f];
  if (c.minutos < 1) continue;
  linhas.push({
    estado: e, faixa: f,
    minutosDeJogo: r2(c.minutos),
    decisoesPorMin: r2(c.decisoes / c.minutos),
    chutesPorMin: r2(c.chutes / c.minutos),
    golsPorMin: r2(c.gols / c.minutos),
    fracaoChute: r2(c.chutes / Math.max(1, c.decisoes)),
    progressMedio: r2(c.somaProg / Math.max(1, c.nProg)),
    riscoMedio: r2(c.somaRisco / Math.max(1, c.nRisco)),
    fracaoVertical: r2(c.verticais / Math.max(1, c.passes)),
  });
}
console.log(JSON.stringify({ build: sha, partidas: N, celulas: linhas }, null, 2));

/* a pergunta do laudo, em duas linhas */
const g = (e, f) => linhas.find(l => l.estado === e && l.faixa === f);
const A = g('perdendo', '76+'), B = g('empatando', '0-15');
if (A && B) {
  const cmp = (k) => `${k}: perdendo/76+ ${A[k]}  vs  empatando/0-15 ${B[k]}  ->  razao ${r2(A[k] / (B[k] || 1e-9))}`;
  console.error('\n=== O TIME PERDENDO AOS 85 JOGA IGUAL AO EMPATANDO AOS 10? ===');
  for (const k of ['decisoesPorMin', 'chutesPorMin', 'fracaoChute', 'progressMedio', 'riscoMedio', 'fracaoVertical'])
    console.error('  ' + cmp(k));
}
