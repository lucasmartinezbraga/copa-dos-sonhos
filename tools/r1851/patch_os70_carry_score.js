#!/usr/bin/env node
'use strict';
/*
 * OS-70 · A CONDUCAO PASSA A COMPETIR COM O PASSE
 * ------------------------------------------------
 * Continuacao direta da OS-69, que falhou por ancorar em codigo morto.
 *
 * O portao VIVO da decisao e a camada P47 (:8206). Ela monta candidatos com
 *
 *     score = fit + ability + space - pressure - fatigue - risk
 *
 * e despacha o de maior nota. A tabela, como estava:
 *
 *     add('pass_short',   pass, buildup?.8:.45,  .2,           .18)
 *     add('pass_vertical',pass, verticality/100, .3,           .32)
 *     add('pass_through', pass, .65,             .42,          .54)
 *     add('carry',        drib, carryMore?.72:.4, nd>5?.4:.1,  .35)
 *     add('dribble',      drib, .45,             finalThird?.45:.2, .5)
 *
 * Somando o que nao depende do atleta:
 *
 *     pass_short   .45 + .20 - .18 = .47      (em construcao, .82)
 *     carry        .40 + .40 - .35 = .45      com espaco
 *                  .40 + .10 - .35 = .15      com alguem a menos de 5 m
 *
 * Duas coisas erradas ai.
 *
 * 1) Com espaco, conduzir empata com tocar — e como `pass` costuma ser um
 *    atributo mais alto que `drible` no elenco medio, o passe ganha quase
 *    sempre. Resultado medido: 46,3 conducoes para 462,7 passes, 10%.
 *
 * 2) O `space` da conducao e um DEGRAU em 5 m. Ou o jogador tem 5 m e ganha
 *    .4, ou tem 4,9 m e ganha .1. Nao existe meio termo, quando meio termo e
 *    exatamente o que decide se da para conduzir: com 4 m voce da um toque,
 *    com 12 m voce carrega.
 *
 * Consequencia (censo OS-66): a bola fica 57,1% do tempo NO AR e 28,0% no PE,
 * quando o futebol e o inverso. O dominio individual e 0,45 s. E a OS-68 ja
 * provou que isso NAO se conserta pelo tempo de decisao — `settle` + `prep`
 * dao 0,35 s e estao certos. O que falta e o jogador ficar com a bola em vez
 * de larga-la.
 *
 * EDIT · so a linha do `carry`:
 *
 *     fit    .4  -> ${'${FIT}'}
 *     space  degrau em 5 m -> contínuo, 0 em ${'${D0}'} m e ${'${SMAX}'} em ${'${D1}'} m
 *     risk   .35 -> ${'${RISK}'}
 *
 * Com ${'${D0}'} m de espaco a conducao vale menos que o passe curto; a partir
 * dai ela cresce com a sobra de campo. Sob pressao o passe continua ganhando, e
 * em construcao o `pass_short` mantem o .8 que o poe na frente perto da propria
 * area — o jogo nao passa a conduzir saindo de tras.
 *
 * Nao mexe em fisica, em posicao, em RNG nem em nenhum outro candidato.
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR (base R18.82: carry 46,3 · passes 462,7 ·
 * dominio 0,45 s / mediana 0,37 · voo 57,1% · pe 28,0% · gols 1,83):
 *   - conducoes por partida: SOBE.
 *   - dominio medio e mediana: SOBEM. **Se NAO subirem, `_carry` nao prende a
 *     bola no pe e esta hipotese cai como as tres anteriores.**
 *   - bola no pe: SOBE. bola em voo: DESCE.
 *   - passes por partida: DESCE. Isso e o esperado, nao e degradacao.
 *   - gols, chutes, escanteios: nao podem degradar. Escanteios 4 a 10,
 *     xG <= 2,7.
 *   - RECUSA se os gols dispararem (portador atravessando a defesa sozinho),
 *     se os dribles dispararem, ou se os escanteios sairem da faixa.
 *
 * ARMADILHA, e e a que pode derrubar tudo: se `_carry` for so um toque curto
 * que devolve a decisao no quadro seguinte, multiplicar conducoes NAO aumenta o
 * dominio — so troca um tipo de acao por outro. O teste que decide e a mediana
 * do dominio, nao a contagem de conducoes.
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
const FIT  = arg('fit',  '0.52');
const RISK = arg('risk', '0.22');
const D0   = arg('d0',   '3');
const D1   = arg('d1',   '12');
const SMAX = arg('smax', '0.75');

let src = fs.readFileSync(input, 'utf8');
const applied = [];
function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) { console.error('ABORTA [' + id + ']: ancora ' + count + 'x'); process.exit(1); }
  src = src.replace(from, to);
  applied.push(id);
}

edit('os70-carry-score',
`add('carry',drib,ins.inPossession.progression.carryMore?.72:.4,nd>5?.4:.1,.35)`,
`add('carry',drib,ins.inPossession.progression.carryMore?.72:${FIT},C((nd-${D0})/${Number(D1)-Number(D0)},0,1)*${SMAX},${RISK})`);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| fit=' + FIT, 'risk=' + RISK,
            'espaco 0 em ' + D0 + ' m -> ' + SMAX + ' em ' + D1 + ' m');
console.log(path.basename(output), '| sha256', sha);
