#!/usr/bin/env node
/* D19 · a partida murcha — mas murcha POR QUE?
   -------------------------------------------------------------------------
   O que ja esta medido (OS-204, e reconfirmado na bateria de hoje):

       0-15   21,4%   ####################
      16-30   15,3%
      31-45   14,7%
      46-60   19,7%
      61-75   16,2%
        76+   12,7%   #############

   No futebol de elite a distribuicao e o INVERSO: cresce para o fim.

   O documento atribui isso a fadiga "uniforme demais", citando r = 0,814
   entre stamina e taxa de chutes. **Correlacao nao e mecanismo.** Stamina cai
   monotonicamente durante a partida; qualquer coisa que caia junto vai
   correlacionar alto com ela sem ser a causa. Aquele 0,814 e compativel com
   pelo menos quatro historias diferentes, e elas pedem consertos opostos:

     H1  menos chances    o time cria menos ataques no fim
     H2  pior pontaria    cria igual, finaliza pior
     H3  menos posse util a bola passa mais tempo parada (faltas, laterais)
     H4  relogio          o tempo simulado por faixa nao e uniforme

   H4 o proprio projeto ja mediu e descartou. As outras tres nunca foram
   separadas — e e a separacao que decide ONDE mexer.

   Esta sonda separa. Por faixa de 15 minutos de jogo, conta:
     - segundos de simulacao (a checagem do relogio, refeita aqui)
     - chutes, chutes no alvo, gols
     - passes tentados e completados
     - stamina media dos 22 em campo
     - segundos com a bola em jogo vs. parada
     - duelos e faltas

   E imprime as TAXAS POR MINUTO DE JOGO, nao os totais: e a unica forma de
   ver se o jogo esta criando menos ou so acertando menos.

   NAO EDITE NADA antes de ler a saida. Sete premissas deste catalogo cairam
   por pular esta etapa.

   Uso: node tools/fisica/ramo-d19.js <build.html> [partidas] */
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

const ROTULOS = ['0-15', '16-30', '31-45', '46-60', '61-75', '76+'];
/* O RELOGIO E `sim.minute`, NAO `sim.t * clockRate`.
   `minute` so avanca quando `this.dead <= 0` — bola parada nao conta como
   minuto de jogo. Convertendo `t` eu media 115 "minutos" por partida e a sonda
   acusou "relogio nao uniforme" que era erro meu, nao do jogo. A bateria usa
   `sim.minute`; usar outra coisa aqui produziria um numero incomparavel. */
const faixaDe = min => Math.max(0, Math.min(5, Math.floor((+min || 0) / 15)));

const zero = () => ROTULOS.map(() => 0);
const seg = zero(), emJogo = zero(), minutos = zero(),
      chutes = zero(), alvo = zero(), gols = zero(),
      passes = zero(), passesOk = zero(), faltas = zero(),
      staminaSoma = zero(), staminaN = zero();
const DT = 1 / 30;

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const A = mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true);
  const B = mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false);
  const sim = new MatchSim(A, B, { neutral: true, labMode: true });

  /* delta dos contadores do proprio motor — mesmo canal da bateria, entao os
     totais TEM de bater com ela */
  const soma = k2 => (+sim.stats[0][k2] || 0) + (+sim.stats[1][k2] || 0);
  let cS = 0, cA = 0, cG = 0, cP = 0, cPo = 0, cF = 0, amostra = 0, guarda = 0;

  while (!sim.isOver() && guarda++ < 500000) {
    const f = faixaDe(sim.minute);
    const emJogoAgora = !(Number(sim.dead) > 0);
    const minAntes = Number(sim.minute) || 0;
    sim.step(DT);
    seg[f] += DT;
    if (emJogoAgora) emJogo[f] += DT;
    /* minuto de JOGO consumido neste quadro — e o denominador honesto das
       taxas. Nao assumo 15 por faixa: a ultima e aberta e a partida pode
       acabar no meio de uma. */
    const dm = (Number(sim.minute) || 0) - minAntes;
    if (dm > 0 && dm < 0.5) minutos[f] += dm;

    const nS = soma('shots'), nA = soma('onTarget'), nG = soma('goals'),
          nP = soma('passes'), nPo = soma('passOk'), nF = soma('fouls');
    chutes[f] += nS - cS; cS = nS;
    alvo[f] += nA - cA; cA = nA;
    gols[f] += nG - cG; cG = nG;
    passes[f] += nP - cP; cP = nP;
    passesOk[f] += nPo - cPo; cPo = nPo;
    faltas[f] += nF - cF; cF = nF;

    if (++amostra % 120 === 0) {           /* stamina custa um laco de 22 */
      let s2 = 0, n2 = 0;
      for (const tm of sim.teams) for (const p of tm.players)
        if (p && !p.red) { s2 += (+p.stamina || 0); n2++; }
      if (n2) { staminaSoma[f] += s2 / n2; staminaN[f]++; }
    }
  }
}

/* ---------------------------------------------------------------- saida */
const totalMin = minutos.reduce((a, b) => a + b, 0);
const totalGols = gols.reduce((a, b) => a + b, 0);
const pct = v => (100 * v / (totalGols || 1)).toFixed(1).padStart(5) + '%';
const por = (v, f) => minutos[f] > 0 ? v / minutos[f] : 0;
const col = (x, n = 7, d = 2) => Number(x).toFixed(d).padStart(n);

console.log(`\nD19 · onde a partida murcha — ${N} partidas\n`);
console.log('faixa   min-jogo  %tempo | gols   %gols | chutes/min  alvo/min  gols/min'
  + ' | passes/min  %certo | stamina | %bola em jogo');
console.log('-'.repeat(132));
for (let f = 0; f < 6; f++) {
  const p = passes[f], pk = passesOk[f];
  console.log(
    `${ROTULOS[f].padEnd(7)} ${col(minutos[f], 8, 1)} ${col(100 * minutos[f] / (totalMin || 1), 6, 1)}% |`
    + `${col(gols[f], 5, 0)} ${pct(gols[f])} |`
    + `${col(por(chutes[f], f), 10)} ${col(por(alvo[f], f), 9)} ${col(por(gols[f], f), 9, 3)} |`
    + `${col(por(p, f), 10, 1)} ${col(100 * pk / (p || 1), 6, 1)}% |`
    + `${col(staminaN[f] ? staminaSoma[f] / staminaN[f] : 0, 7, 1)} |`
    + `${col(100 * emJogo[f] / (seg[f] || 1), 12, 1)}%`);
}

/* ------------------------------------------------- o veredito, explicito */
const q = (arr, f) => por(arr[f], f);
const dChutes = q(chutes, 5) / (q(chutes, 0) || 1);
const dAlvo = (alvo[5] / (chutes[5] || 1)) / ((alvo[0] / (chutes[0] || 1)) || 1);
const dJogo = (emJogo[5] / (seg[5] || 1)) / ((emJogo[0] / (seg[0] || 1)) || 1);
/* H4 nao e "a faixa tem menos minutos" — a ultima e aberta, teria mesmo.
   E "cada minuto de jogo do fim recebe menos SIMULACAO que o do comeco?" */
const dTempo = (seg[5] / (minutos[5] || 1)) / ((seg[0] / (minutos[0] || 1)) || 1);

console.log('\nrazao 76+ / 0-15   (1,00 = nao muda ao longo da partida)');
console.log(`  H1  chutes por minuto ........ ${dChutes.toFixed(3)}   ${dChutes < 0.9 ? '<== CRIA MENOS' : 'estavel'}`);
console.log(`  H2  acerto ao alvo por chute .. ${dAlvo.toFixed(3)}   ${dAlvo < 0.9 ? '<== FINALIZA PIOR' : 'estavel'}`);
console.log(`  H3  fracao de bola em jogo .... ${dJogo.toFixed(3)}   ${dJogo < 0.9 ? '<== BOLA PARA MAIS' : 'estavel'}`);
console.log(`  H4  segundos de simulacao/min . ${dTempo.toFixed(3)}   ${(dTempo < 0.9 || dTempo > 1.1) ? '<== O FIM RECEBE OUTRA DOSE DE SIMULACAO' : 'uniforme (como o projeto ja media)'}`);
console.log('\nA hipotese que ficar abaixo de 0,90 e onde o conserto tem de ser feito.');
console.log('Se mais de uma ficar, conserte UMA e meça de novo — elas se contaminam.\n');

console.log(JSON.stringify({
  partidas: N, rotulos: ROTULOS,
  minutosPorFaixa: minutos.map(x => +x.toFixed(2)),
  golsPorFaixa: gols, distribuicaoGols: gols.map(g => +(100 * g / (totalGols || 1)).toFixed(1)),
  chutesPorMinuto: ROTULOS.map((_, f) => +por(chutes[f], f).toFixed(3)),
  alvoPorChute: ROTULOS.map((_, f) => +(alvo[f] / (chutes[f] || 1)).toFixed(3)),
  passesPorMinuto: ROTULOS.map((_, f) => +por(passes[f], f).toFixed(2)),
  staminaMedia: ROTULOS.map((_, f) => +(staminaN[f] ? staminaSoma[f] / staminaN[f] : 0).toFixed(1)),
  fracaoBolaEmJogo: ROTULOS.map((_, f) => +(emJogo[f] / (seg[f] || 1)).toFixed(3)),
  razao76sobre015: { chutesPorMinuto: +dChutes.toFixed(3), alvoPorChute: +dAlvo.toFixed(3),
                     bolaEmJogo: +dJogo.toFixed(3), minutosDeJogo: +dTempo.toFixed(3) },
}, null, 1));
