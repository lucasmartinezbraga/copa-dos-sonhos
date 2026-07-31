#!/usr/bin/env node
'use strict';
/*
 * OS-23 · CONVERSAO ALINHADA AO xG + ESCANTEIO DESSUPRIMIDO
 * ---------------------------------------------------------
 * CANDIDATA COMPORTAMENTAL. NAO PROMOVIDA.
 *
 * (1) CONVERSAO. Em :6114 o motor calcula `pGoal` e em :6122 grava
 *     `xg = pGoal` — xG e a propria probabilidade de gol, o que esta certo.
 *     Mas o ramo em que o goleiro nao alcanca (:6140) descarta `pGoal` e
 *     recalcula do zero: `_pg = clamp((0.17+_edge*.20)*goalMul,.08,.46)`.
 *     Como esse ramo pega ~37% dos chutes, o gol sai por uma probabilidade que
 *     NAO e a contabilizada — dai gols 3,00 contra xG 2,38. O edit faz o ramo
 *     usar o mesmo `pGoal` que foi gravado. Alinhar e por construcao, nao por
 *     ajuste de constante.
 *
 * (2) ESCANTEIO. A OS-05B mediu 1,06 escanteio/partida recusado pelas duas
 *     camadas de supressao: `randomCornerPathsSuppressed` 0,625 (R18.18.2,
 *     :21764, orcamento de raio 18,5 m) e `unprovenSuppressed` 0,438
 *     (R18.18.3, :22062, orcamento 13,5 m). Um bloqueio na entrada da area
 *     acontece a 16-18 m da linha — dentro do que o futebol produz e fora do
 *     que esses orcamentos aceitam. Os edits ampliam os dois raios.
 *
 * NAO ha RNG novo em nenhum dos tres edits.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.56 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.57 - JOGO DE FUTEBOL.html');
const raioBloq=arg('raioBloqueio','30'), raioProva=arg('raioProva','26');
let src=fs.readFileSync(input,'utf8');const applied=[];
function edit(id,from,to){const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);}

edit('os23-goal-uses-recorded-xg',
  `        const _pg=clamp((0.17+_edge*.20)*finishPlan.goalMul,.08,.46);`,
  `        /* OS-23 · usa o MESMO pGoal contabilizado como xG em :6122. Antes
           este ramo sorteava o gol por uma probabilidade propria, e por isso
           os gols saiam acima do xG registrado. */
        const _pg=clamp(pGoal,.08,.46);`);

edit('os23-block-ray-budget',
  `blockRay(this,q,18.5,8.8)`,
  `blockRay(this,q,${raioBloq},8.8)`);

edit('os23-unproven-ray-budget',
  `hit.d<=13.5`,
  `hit.d<=${raioProva}`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| raios',raioBloq+'/'+raioProva);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
