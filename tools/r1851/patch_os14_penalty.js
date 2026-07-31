#!/usr/bin/env node
'use strict';
/*
 * OS-14 · PENALTI
 * ---------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * A OS-13 concluiu que o gargalo do penalti era so a posse na area. Estava
 * incompleta: eu tinha achado UMA supressao (:16258) e perdido a maior.
 *
 * Sao DUAS supressoes empilhadas, e a dominante e a de cima:
 *
 *   `_foulProb` (:6678)   ownBox ? base * 0.16 : base
 *   `:16258`              (ownBox ? .55 : 1.30), teto ownBox ? .095 : .35
 *
 * Com foulBase 0.29 (:2737) e compostura media, a probabilidade de falta por
 * duelo fica em ~0,028 dentro da area contra ~0,35 fora — 12,5x. Sobre 0,50
 * duelo na area por partida isso da 1 penalti a cada ~71 partidas. Por isso a
 * medicao deu 0,00 em 8 e por isso mexer so em :16258 nao moveu nada.
 *
 * A terceira parte e uma fonte de falta que o motor simplesmente nao tem.
 * Quando o defensor esta na linha do chute (`bestLine <= 2.2`, :6172), o motor
 * so sabe produzir bloqueio ou erro. No futebol parte desse contato e falta no
 * finalizador — e, dentro da area, e exatamente o penalti mais comum. O edit
 * entra ANTES do `_startTravel`, portanto antes de qualquer contato visual:
 * nao converte bloqueio limpo em falta, divide a populacao "defensor em cima
 * do finalizador" entre bloqueio e falta.
 *
 * `_awardFoul` (:6706) ja roteia sozinho: vitima dentro da area -> `_penalty`;
 * fora -> cobranca. Nao ha caminho novo, so alimentacao do que existe.
 *
 * NAO ha bonus de xG, NAO ha bonus de velocidade, NAO ha teleporte. O edit 3
 * consome uma rolagem nova de RNG, entao a comparacao pareada com a baseline
 * diverge por caos — so direcao sobre muitas sementes vale.
 *
 * RESULTADO MEDIDO (24 partidas, base 4200000, contra a baseline pareada):
 *   falta na area/partida   0,000 -> 0,042
 *   PENALTIS/partida        0,000 -> 0,042   (0 em 24  ->  1 em 24)
 *   faltas/partida          7,29  -> 7,33    (inalterado, como previsto)
 *   cobrancas/partida       0,79  -> 0,79    (inalterado)
 *
 * O ENCANAMENTO FUNCIONA e esta demonstrado ponta a ponta: falta na area ->
 * _penalty -> penaltiesTaken. Mas 0,042 ainda e ~6x abaixo do futebol real
 * (~0,25/partida), e NAO da para fechar essa distancia daqui.
 *
 * O limitador que sobra e populacional, e a OS-13 ja tinha acertado nisso: sao
 * 0,50 duelo na area por partida. Para chegar a 0,25 penalti/partida sobre 0,50
 * duelo seria preciso 50% de falta por duelo, o que e absurdo. O edit 3 tambem
 * nao ajuda: o ramo de bloqueio de chute dispara 0,25 vez por partida (medido),
 * entao nao tem populacao.
 *
 * O que falta e o atacante CONDUZIR para dentro da area — hoje sao ~1,75 s de
 * posse na area por partida, somando os dois times. Isso e mudanca na camada de
 * decisao, candidata grande, e nao vou disparar as cegas.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.50 - OS14 PENALTI.html');
const fShot = Number(arg('shotFoul', '1.0'));
let src = fs.readFileSync(input, 'utf8');
const applied = [];

function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    console.error('ABORTA [' + id + ']: ancora ' + count + 'x');
    process.exit(1);
  }
  src = src.replace(from, to);
  applied.push(id);
}

edit(
  'os14-foulprob-box-suppression',
  `    return ownBox ? base * 0.16 : base;`,
  `    return ownBox ? base * 0.80 : base;`
);

edit(
  'os14-duel-box-suppression',
  `(ownBox?.55:1.30),.022,ownBox?.095:.35)`,
  `(ownBox?1.00:1.30),.022,ownBox?.30:.35)`
);

edit(
  'os14-foul-on-shooter',
  `        }else{
          this._startTravel(o,blockTarget,'shot',()=>{`,
  `        }else{
          /* OS-14 · defensor em cima do finalizador: parte desse contato e
             falta, nao bloqueio. Entra antes do _startTravel, entao nao
             converte bloqueio limpo — divide a populacao. Dentro da area,
             _awardFoul (:6706) roteia sozinho para _penalty. */
          if(chance(this._foulProb(blocker)*${fShot})){this._awardFoul(blocker,o);return;}
          this._startTravel(o,blockTarget,'shot',()=>{`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '), '| shotFoul=' + fShot);
console.log(path.basename(output), '| sha256', sha);
