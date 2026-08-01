#!/usr/bin/env node
'use strict';
/*
 * OS-69 · CONDUZIR ENTRE UM PASSE E OUTRO
 * ----------------------------------------
 * Fecha a caca do dominio da bola, depois de TRES hipoteses falsificadas.
 *
 * O problema (OS-66): a bola fica 57,1% do tempo no AR e 28,0% no PE — o
 * futebol e o inverso. O dominio individual e 0,45 s (mediana 0,37) contra
 * 1,1 a 1,4 s reais.
 *
 * O QUE NAO ERA — tres camadas de valor morto, medidas uma a uma:
 *
 *   1. `decisionInterval` (0,28). Levado a 0,90 e 1,60 — 5,7 vezes: dominio
 *      0,45 / 0,45 / 0,45, mediana 0,37 nos tres. ZERO efeito.
 *   2. Os cinco tetos de `decideT` (:6726 .10, :5076 0.20, :17289-91
 *      0.20/0.31/0.44). Multiplicados por 1,8 e 2,6: dominio 0,45 e 0,45.
 *      ZERO efeito.
 *   3. Acoplar `clockRate` a qualquer um dos dois. Com k=1,6 os passes foram
 *      de 451 a 758 e os gols de 1,81 a 4,38 — o produto nao e constante.
 *
 * POR QUE (1) e (2) nao valem nada: `decideT` corre livre (`this.decideT -= dt`
 * todo quadro) mas so e CONSUMIDO quando ha dono, a bola nao esta viajando e o
 * `settle` acabou. Durante os 0,92 s de voo o contador continua descendo e
 * chega fundo no negativo — quando a bola pousa, ele ja esta vencido e o
 * receptor decide no mesmo quadro. **O intervalo nunca vincula.**
 *
 * O QUE E. O dominio e `settle` + `prep`, e so:
 *
 *     settle  0,10 a 0,34   (primeiro toque, :2729)
 *     prep    pass [0.10, 0.19] · cross [0.15, 0.26] · shot [0.17, 0.30]  (:17477)
 *     ---------------------------------------------------------------
 *     ~0,20 + ~0,15 = 0,35        <- mediana medida: 0,37
 *
 * E esses numeros estao CERTOS: um passe de primeira leva mesmo 0,3 a 0,5 s.
 * Esticar o `prep` viraria um windup que nao existe no futebol.
 *
 * O que falta nao e lentidao, e CONDUCAO. O 1,1 s real e a MEDIA — inclui os
 * lances em que o jogador recebe, da dois toques e so entao passa. No jogo isso
 * quase nao acontece: 48,6 conducoes para 451 passes, 11%.
 *
 * MECANISMO (:5209):
 *
 *     const _cnTeto = ((drible + aceleracao)/2 >= 55) ? 2 : 0;
 *     if (cone <= _cnTeto && dtg > 6) { this._carry(o, g); return; }
 *
 * `cone` e quanta gente esta na frente. O portador so conduz com no maximo DOIS
 * adversarios no cone — fora disso, larga a bola na hora.
 *
 * EDIT · o teto de oponentes no cone sobe de 2 para ${'${TETO}'} para quem tem
 * conducao, e o limiar de habilidade cai de 55 para ${'${LIMIAR}'}. Nao inventa
 * conducao nova nem mexe em fisica: alarga a janela de uma decisao que ja
 * existe e ja e ponderada por atributo.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.82):
 *   - conducoes por partida (48,6): SOBE.
 *   - dominio medio (0,45 s) e mediana (0,37): SOBEM. Se NAO subirem, a
 *     conducao nao esta prendendo a bola no pe e a hipotese cai como as outras
 *     tres.
 *   - bola no pe (28,0%): SOBE.  bola em voo (57,1%): DESCE.
 *   - passes por partida (451): DESCE um pouco — conduzir ocupa o lugar de um
 *     passe. Isso e esperado e nao e degradacao.
 *   - gols (1,81), chutes (21,8), escanteios (5,88): NAO podem degradar;
 *     escanteios entre 4 e 10, xG <= 2,7.
 *   - RECUSA se o portador passar a atravessar a defesa sozinho: se os dribles
 *     ou os gols dispararem, o teto esta alto demais.
 *
 * ARMADILHA: `cone` conta adversarios A FRENTE. Subir o teto autoriza conduzir
 * para dentro de gente, que e como se perde a bola em posicao ruim. Se as
 * perdas em campo proprio subirem, o custo aparece nos gols sofridos — e por
 * isso os gols sao gate aqui, e nao so informacao.
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
const TETO   = arg('teto', '3');
const LIMIAR = arg('limiar', '48');
const DTG    = arg('dtg', '6');

let src = fs.readFileSync(input, 'utf8');
const applied = [];
function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) { console.error('ABORTA [' + id + ']: ancora ' + count + 'x'); process.exit(1); }
  src = src.replace(from, to);
  applied.push(id);
}

edit('os69-carry-window',
`    { const _cnDri = getAttr(o, 'drible'), _cnAcc = getAttr(o, 'aceleracao'); const _cnTeto = ((_cnDri + _cnAcc) / 2 >= 55) ? 2 : 0; if (cone <= _cnTeto && dtg > 6) { this._carry(o, g); return; } }`,
`    /* OS-69 · o portador so conduzia com no maximo DOIS adversarios no cone;
       fora disso largava a bola no mesmo instante. Dai 48,6 conducoes para 451
       passes (11%) e a bola 57,1% do tempo no ar contra ~28% do futebol. A
       janela abre para ${TETO} no cone e limiar de habilidade ${LIMIAR}. */
    { const _cnDri = getAttr(o, 'drible'), _cnAcc = getAttr(o, 'aceleracao'); const _cnTeto = ((_cnDri + _cnAcc) / 2 >= ${LIMIAR}) ? ${TETO} : 0; if (cone <= _cnTeto && dtg > ${DTG}) { this._carry(o, g); return; } }`);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| teto=' + TETO, 'limiar=' + LIMIAR, 'dtg=' + DTG);
console.log(path.basename(output), '| sha256', sha);
