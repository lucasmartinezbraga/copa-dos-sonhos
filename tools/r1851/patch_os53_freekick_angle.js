#!/usr/bin/env node
'use strict';
/*
 * OS-53 · A FALTA CENTRAL VIRA CHUTE, A DE LADO VIRA CRUZAMENTO
 * --------------------------------------------------------------
 * Observacao de campo: "o jeito que bate a falta e mais cruzamento do que
 * batida direta".
 *
 * MEDIDO (40 partidas, R18.74): freeKickDirect 1,90 contra freeKickCrossed
 * 3,92. Cruza-se o dobro do que se chuta.
 *
 * MECANISMO (:6781). A rotina e escolhida SO PELA DISTANCIA:
 *
 *     if (manual || dtg <= 25 || (dtg <= 29 && setpiece >= 78 && chance(.62)))
 *          routine = 'direct';
 *     else if (dtg <= 40 && ...) routine = 'crossed';
 *
 * O ANGULO nao entra em lugar nenhum. Uma falta a 22 m na linha lateral, de
 * onde ninguem chuta, cai em 'direct'; uma falta a 28 m em frente ao gol, que
 * todo cobrador do mundo bate, cai em 'crossed'. E o criterio errado: quem
 * decide entre bater e cruzar e a POSICAO EM RELACAO A META, nao a distancia.
 *
 * EDIT · entra o afastamento lateral em relacao ao gol:
 *   - central (|y - gol.y| <= 13,5 m) e ate 33 m  -> direta
 *   - ate 24 m e razoavelmente central (<= 19 m)  -> direta
 *   - especialista a ate 29 m                      -> direta (como antes)
 *   - o resto ate 42 m                             -> cruzamento
 *   - alem disso                                   -> reinicio curto
 *
 * PREVISAO REGISTRADA ANTES DE MEDIR:
 *   - freeKickDirect 1,90: SOBE e passa freeKickCrossed.
 *   - total de cobrancas: praticamente igual (a rotina muda, o numero nao).
 *   - gols: podem subir um pouco (falta direta central produz chute).
 *   - RECUSA se as diretas passarem de ~5 por partida, o que seria bater de
 *     qualquer lugar.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.74 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.75 - JOGO DE FUTEBOL.html');
let src=fs.readFileSync(input,'utf8');
const from=`      if (manual || dtg <= 25 || (dtg <= 29 && facet(taker,'setpiece') >= 78 && chance(.62))) routine='direct';
      else if (dtg <= 40 && (aerialEdge > -5 || chance(.58))) routine='crossed';`;
const to=`      /* OS-53 · o angulo entra na decisao. Medido: diretas 1,90 contra
         cruzamentos 3,92, porque a rotina saia so da distancia — falta a 22 m
         na linha lateral virava chute e falta a 28 m em frente ao gol virava
         cruzamento. Quem decide e a posicao em relacao a meta. */
      const _o53lat = Math.abs(y - vg.y);
      if (manual || (_o53lat <= 13.5 && dtg <= 33) || (dtg <= 24 && _o53lat <= 19)
          || (dtg <= 29 && facet(taker,'setpiece') >= 78 && chance(.62))) routine='direct';
      else if (dtg <= 42 && (aerialEdge > -5 || chance(.58))) routine='crossed';`;
const c=src.split(from).length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace(from,to);
fs.writeFileSync(output,src,'utf8');
console.log('os53-freekick-angle |',path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
