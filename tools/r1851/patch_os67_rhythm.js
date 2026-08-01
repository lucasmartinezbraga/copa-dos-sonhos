#!/usr/bin/env node
'use strict';
/*
 * OS-67 · O RITMO DA BOLA
 * ------------------------
 * Observacao de campo: "a bola tambem tinha ficado esquisita... a cadencia".
 *
 * CENSO OS-66 (4 partidas, 201.132 quadros):
 *
 *     bola em VOO       57,5%   (523 voos/partida, 0,92 s cada)   real ~28%
 *     bola NO PE        28,5%                                     real ~60%
 *     solta em jogo      4,2%
 *     bola morta        11,1%
 *
 * A proporcao esta INVERTIDA. E o dominio medio e 0,46 s contra 1,1 a 1,4 s do
 * futebol — a OS-48 ja tinha medido isso e consertado so o subconjunto que
 * CONGELAVA; a media continuou onde estava.
 *
 * ONDE (:2723 e :2725, no mesmo objeto congelado):
 *
 *     clockRate:        0.13     <- minutos de jogo por segundo simulado
 *     decisionInterval: 0.28     <- de quanto em quanto o portador decide
 *
 * Sao os dois lados do MESMO problema:
 *
 *   - `clockRate` 0,13 poe 90 minutos em ~692 s de acao. Como todo evento e uma
 *     taxa por segundo vezes esse tempo, ele e o botao de VOLUME: os totais por
 *     partida sao proporcionais a 1/clockRate. Foi assim que a OS-52 levou os
 *     gols de 1,85 para 2,71.
 *   - `decisionInterval` 0,28 e o botao de CADENCIA: com o `settle` do primeiro
 *     toque, ele produz os 0,46 s de dominio.
 *
 * Hoje o jogo compensa um com o outro: para caber 451 passes em 838 s de bola
 * rolando ele precisa disparar ~0,6 passes por segundo de acao, contra ~0,28 do
 * futebol de verdade. Dai a bola no ar mais da metade do tempo.
 *
 * EDIT · um fator unico de ritmo, `k = ${'${K}'}`:
 *
 *     decisionInterval *= k        a cadencia desacelera
 *     tackleCooldown   *= k        o duelo acompanha
 *     clockRate        /= k        o tempo de acao estica na mesma proporcao
 *
 * O produto fica constante, entao o VOLUME por partida nao deveria mudar — o
 * que muda e a densidade por segundo, que e justamente o defeito. O jogo passa
 * a levar mais tempo real no 1x; o controle de velocidade (1x/2x/4x/TURBO) ja
 * existe e e do jogador.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.82):
 *   - dominio medio 0,46 s: SOBE.
 *   - bola em voo 57,5%: DESCE.  bola no pe 28,5%: SOBE.
 *   - passes, chutes, gols, escanteios: aproximadamente CONSTANTES. Se
 *     andarem muito, a compensacao nao vale para tudo.
 *   - tempo real de partida: SOBE na proporcao de k.
 *   - RECUSA se os totais sairem da faixa (escanteios 4 a 10, xG <= 2,7) ou se
 *     a marcacao degradar.
 *
 * ARMADILHA, e e a serio: nem tudo no motor depende da cadencia de decisao.
 * Falta, lateral, tiro de meta, desgaste e temporizador de bola parada sao
 * taxas por SEGUNDO. Esses vao escalar com o tempo total e NAO sao compensados
 * pelo `decisionInterval`. Se faltas, laterais e tiros de meta subirem perto de
 * k vezes, a compensacao so valeu para os eventos de posse e o patch nao pode
 * ser promovido como esta.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input  = arg('in',  'dist/COPA DOS SONHOS - R18.82 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.83 - JOGO DE FUTEBOL.html');
const K = Number(arg('k', '2'));
if (!(K > 0.2 && K < 8)) { console.error('ABORTA: k fora de faixa'); process.exit(1); }
/* OS-67b · a hipotese de acoplamento linear (decisionInterval *= k, clockRate /= k)
   foi MEDIDA E FALSIFICADA: com k=1,6 os passes foram de 451 para 758 e os gols de
   1,81 para 4,38. O `decisionInterval` so acrescenta ~0,2 s a um ciclo de posse de
   ~1,4 s (dominio 0,46 + voo 0,92), entao esticar o relogio multiplica tudo. Os dois
   botoes passam a ser calibrados separadamente: `decisionInterval` para acertar o
   DOMINIO, `clockRate` para acertar o VOLUME. */

let src = fs.readFileSync(input, 'utf8');
const applied = [];
function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) { console.error('ABORTA [' + id + ']: ancora ' + count + 'x'); process.exit(1); }
  src = src.replace(from, to);
  applied.push(id);
}

const r4 = x => Number(x.toFixed(5));
const CLOCK = r4(Number(arg('clockRate', String(0.13 / K))));
const DEC   = r4(Number(arg('decisionInterval', String(0.28 * K))));
const TACK  = r4(Number(arg('tackleCooldown', String(0.55 * K))));

edit('os67-rhythm',
`    clockRate: 0.13,
    fixedStep: 1 / 60,
    decisionInterval: 0.28,
    tackleCooldown: 0.55,`,
`    /* OS-67 · fator de ritmo k=${K}. \`clockRate\` e o botao de VOLUME (todo
       total por partida e proporcional a 1/clockRate) e \`decisionInterval\` e o
       botao de CADENCIA. Estavam desencontrados: para caber 451 passes em 838 s
       de bola rolando o jogo disparava ~0,6 passes por segundo de acao contra
       ~0,28 do futebol, e a bola ficava 57,5% do tempo no ar contra ~28% reais.
       Os dois escalam juntos, produto constante: o volume por partida fica, a
       densidade por segundo cai. */
    clockRate: ${CLOCK},
    fixedStep: 1 / 60,
    decisionInterval: ${DEC},
    tackleCooldown: ${TACK},`);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '),
            '| k=' + K, 'clockRate=' + CLOCK, 'decisionInterval=' + DEC, 'tackleCooldown=' + TACK);
console.log(path.basename(output), '| sha256', sha);
