#!/usr/bin/env node
'use strict';
/*
 * SONDA OS-98 · E SE O INTERVALO DE DECISAO REALMENTE VINCULASSE?
 * ===============================================================
 * ISTO E UMA SONDA, NAO UMA CANDIDATA. Serve para descobrir se existe alavanca,
 * nao para promover.
 *
 * O QUE FOI MEDIDO (diag_os85_decidet.js, R18.92, 8 partidas, 4162 recepcoes)
 *
 *   decideT no instante da recepcao ... mediana -0,802 s | p10 -1,533 | min -12,8
 *   ja NEGATIVO ao receber ........... 96,92%
 *   o Math.min mudou algo ............  1,87%
 *   tempo entre receber e soltar ..... mediana 0,200 s
 *
 * :6798   this.decideT = Math.min(this.decideT, .10);   // dentro de _giveBall
 *
 * O contador corre livre durante o voo e chega vencido. `Math.min(-0,80 , 0,10)`
 * e -0,80: o teto NUNCA e aplicado, em 98,13% das recepcoes.
 *
 * POR QUE ISTO IMPORTA
 *   A OS-68 foi registrada como falsificada por multiplicar esse teto por 1,8 e
 *   2,6 e medir dominio identico (0,45 / 0,45 / 0,45). E claro que foi identico:
 *   `Math.min(-0,80 , 0,26)` continua -0,80. Ela mexeu no VALOR de uma expressao
 *   cujo OPERADOR ja a tornava inerte. **A hipotese que ela queria testar nunca
 *   foi testada.**
 *
 * O QUE ESTA SONDA FAZ
 *   Troca o operador: em vez de TETO, a recepcao ATRIBUI o intervalo. Assim o
 *   receptor espera de verdade antes de decidir.
 *     de:  this.decideT = Math.min(this.decideT, .10)
 *    para: this.decideT = <valor>
 *   O valor entra por --espera=<s> para varrer a faixa.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (direcao, nunca porcentagem)
 *   1. o tempo entre receber e soltar SOBE, e pela primeira vez responde ao
 *      parametro -- e o teste de que a alavanca existe;
 *   2. passes por partida DESCEM (menos decisoes por segundo);
 *   3. com eles, chutes / escanteios / faltas DESCEM -- o jogo ja roda a ~55%
 *      do volume do futebol, entao isto anda para o lado errado do volume;
 *   4. xG DESCE.
 *
 *   Se (1) nao acontecer, a alavanca continua nao existindo e a sonda morre
 *   aqui -- e ai o dominio nao e governado por decideT de jeito nenhum.
 *
 * NAO PROMOVER SEM: bateria de seis bases e uma decisao explicita sobre o
 * conflito volume x realismo, que e o que a OS-67 ja derrubou uma vez.
 */
const fs = require('fs');
const crypto = require('crypto');

const arg = (n, d) => {
  const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '='));
  return h ? h.slice(n.length + 3) : d;
};
const IN = process.argv[2], OUT = process.argv[3];
const ESPERA = Number(arg('espera', '0.28'));
if (!IN || !OUT) { console.error('uso: node probe_os98_decidet_vincula.js <entrada> <saida> [--espera=0.28]'); process.exit(1); }
if (!(ESPERA >= 0 && ESPERA <= 2.5)) { console.error('ABORTA: espera fora de faixa'); process.exit(1); }

let src = fs.readFileSync(IN, 'utf8');
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.split(from).join(to);
  console.log('  ok', id);
}

edit('os98-operador',
  "    this.decideT=Math.min(this.decideT,.10);",
  "    /* §SONDA OS-98 · o OPERADOR, nao o valor.\n" +
  "       Medido: `decideT` ja esta NEGATIVO em 96,92% das recepcoes (mediana\n" +
  "       -0,802 s), entao `Math.min(-0,80 , 0,10)` = -0,80 e este teto nunca e\n" +
  "       aplicado — ele mudou algo em apenas 1,87% das 4162 recepcoes medidas.\n" +
  "       A OS-68 multiplicou o VALOR e mediu dominio identico; era inevitavel.\n" +
  "       Aqui a recepcao ATRIBUI o intervalo, e o receptor espera de verdade. */\n" +
  "    this.decideT=" + ESPERA + ";");

fs.writeFileSync(OUT, src, 'utf8');
console.log('\nespera =', ESPERA, 's');
console.log('escrito ->', OUT);
console.log('sha256  ->', crypto.createHash('sha256').update(src).digest('hex'));
