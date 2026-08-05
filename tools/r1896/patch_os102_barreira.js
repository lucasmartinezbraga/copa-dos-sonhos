#!/usr/bin/env node
'use strict';
/*
 * OS-102 · A BARREIRA BLOQUEIA POUCO, E NAO SABE A DISTANCIA
 * ==========================================================
 *
 * MEDIDO (funcao pura, 50 000 amostras por cenario, R18.95):
 *
 *   batedor 90 x goleiro 75, 22 m ... barreira 16,86%
 *   batedor 90 x goleiro 75, 28 m ... barreira 18,04%
 *   batedor 75 x goleiro 75, 25 m ... barreira 17,63%
 *   batedor 60 x goleiro 80, 30 m ... barreira 18,25%
 *
 * REFERENCIA REAL: a barreira bloqueia ~20 a 25% das faltas diretas.
 *
 * E tem um defeito de forma, nao so de nivel:
 *
 *   :2882  const wallRisk = clamp(.46 - power*.34 - Math.abs(curve)*.16
 *                                 + Math.max(0,actualY-.55)*.55, .03, .48);
 *
 *   `wallRisk` NAO usa `dtg`. A distancia esta disponivel na assinatura da
 *   funcao e e usada para `idealPower` (:2873), mas o risco de barreira e o
 *   mesmo a 18 m e a 32 m. No futebol e o contrario de indiferente: de perto a
 *   barreira cobre muito mais angulo e bloqueia bem mais.
 *
 *   O numero medido confirma a inversao: 16,86% a 22 m contra 18,04% a 28 m --
 *   bloqueia MENOS de perto, que e o oposto do futebol. Isso vem do termo de
 *   `power` (chute mais forte de longe? nao: `idealPower` cresce com a
 *   distancia, entao de longe o chute e mais forte e o termo -power*.34 deveria
 *   baixar o risco). O que sobra e ruido de execucao, nao geometria.
 *
 * EDIT
 *   wallRisk = clamp(BASE + max(0, PIVO - dtg) * INCL
 *                    - power*.34 - |curve|*.16 + max(0, actualY-.55)*.55, .03, .52)
 *
 *   BASE e o patamar; PIVO e a distancia a partir da qual a proximidade deixa de
 *   ajudar a barreira; INCL e quanto cada metro a menos acrescenta.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. a taxa de barreira SOBE para a faixa 20-25%;
 *   2. a barreira passa a DEPENDER da distancia: bloqueia mais de perto que de
 *      longe -- hoje a relacao esta invertida (16,86% a 22 m, 18,04% a 28 m);
 *   3. o gol de falta DESCE de leve, porque menos cobrancas chegam ao sorteio;
 *   4. **xG NAO muda.** `stats.xg += pGoal` acontece em :7003 ANTES de ramificar
 *      o desfecho, entao barreira nao tira xG. Isto CORRIGE o que eu havia
 *      escrito na rodada anterior, quando afirmei que subir a barreira abriria
 *      folga no ECO-02. Nao abre.
 *   5. gols por partida descem muito de leve (~0,01), porque falta direta vale
 *      ~0,22 gol por partida no total.
 *
 * GATE QUE DECIDE
 *   Gate proprio: barreira em 20-25% E monotonica na distancia. Ecologia como
 *   rede em seis bases: xG <= 2,7, gols 1,8-3,0, escanteios 4-10.
 *
 * ARMADILHA REGISTRADA
 *   O teto do clamp era .48 e o piso .03. Subir a base sem subir o teto faz o
 *   clamp SATURAR -- foi exatamente o defeito que a OS-89 encontrou na moeda
 *   defesa/fora, onde `.58 + k/220` batia no teto .82 e o atributo do goleiro
 *   deixava de importar. Teto novo .52; confira que a fracao de amostras no teto
 *   continua baixa.
 */
const fs = require('fs');
const crypto = require('crypto');

const arg = (n, d) => {
  const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '='));
  return h ? h.slice(n.length + 3) : d;
};
const IN = process.argv[2], OUT = process.argv[3];
const BASE = Number(arg('base', '0.50'));
const PIVO = Number(arg('pivo', '27'));
const INCL = Number(arg('incl', '0.009'));
const TETO = Number(arg('teto', '0.52'));
if (!IN || !OUT) { console.error('uso: node patch_os102_barreira.js <entrada> <saida> [--base= --pivo= --incl= --teto=]'); process.exit(1); }
if (!(BASE > 0 && BASE < 1) || !(PIVO >= 15 && PIVO <= 40) || !(INCL >= 0 && INCL <= .05) || !(TETO > 0 && TETO <= .8)) {
  console.error('ABORTA: parametro fora de faixa'); process.exit(1);
}

let src = fs.readFileSync(IN, 'utf8');
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

edit('os102-wallrisk',
  "  const wallRisk = clamp(.46 - power*.34 - Math.abs(curve)*.16 + Math.max(0,actualY-.55)*.55, .03, .48);",

  "  /* §OS-102 · a barreira bloqueava pouco e nao sabia a distancia.\n" +
  "     Medido na funcao pura, 50 000 amostras por cenario: 16,86% a 22 m e\n" +
  "     18,04% a 28 m, contra ~20-25% reais. Pior que o nivel era a FORMA: `dtg`\n" +
  "     esta na assinatura e era usado so para `idealPower`, entao o risco de\n" +
  "     barreira era o mesmo a 18 m e a 32 m -- e o pouco que variava estava\n" +
  "     INVERTIDO, bloqueando menos de perto. No futebol, de perto a barreira\n" +
  "     cobre muito mais angulo.\n" +
  "     ATENCAO: isto NAO abre folga no ECO-02. `stats.xg += pGoal` acontece em\n" +
  "     :7003 ANTES de ramificar o desfecho, entao barreira tira gol e nao tira\n" +
  "     xG. O teto do clamp sobe junto com a base: sem isso ele satura e o resto\n" +
  "     da formula para de importar, que e o defeito que a OS-89 achou na moeda\n" +
  "     defesa/fora. */\n" +
  "  const wallRisk = clamp(" + BASE + " + Math.max(0, " + PIVO + " - dtg) * " + INCL +
  " - power*.34 - Math.abs(curve)*.16 + Math.max(0,actualY-.55)*.55, .03, " + TETO + ");");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nbase', BASE, '| pivo', PIVO, '| incl', INCL, '| teto', TETO);
console.log('escrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
