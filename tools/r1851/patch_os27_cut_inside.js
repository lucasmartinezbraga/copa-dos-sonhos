#!/usr/bin/env node
'use strict';
/*
 * OS-27 · O PONTA CORTA PRA DENTRO EM VEZ DE CRUZAR SEMPRE
 * O portao do cruzamento em :5155 dispara ANTES de qualquer avaliacao de
 * chute — `_canCross` (:5712) e so geometria (`adv>78 && wideY`) e o `return`
 * curto-circuita a arvore. O ponta em posicao de corte nunca chega ao ramo de
 * finalizacao: ele cruza primeiro.
 * O edit exige distancia: dentro de `dtgMin` do gol o cruzamento nao dispara
 * automaticamente, e a decisao segue para conducao/drible/chute — que e onde
 * o corte pra dentro mora. Sem RNG novo.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.59 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.60 - JOGO DE FUTEBOL.html');
const dmin=arg('dtgMin','23');
let src=fs.readFileSync(input,'utf8');
const A=`if (this._canCross(o) && _os12Alvo && chance(crossP)) { this._cross(o); return; }`;
const c=src.split(A).length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace(A,`/* OS-27 · perto do gol o ponta decide, nao cruza por reflexo. */
    if (this._canCross(o) && _os12Alvo && dtg > ${dmin} && chance(crossP)) { this._cross(o); return; }`);
fs.writeFileSync(output,src,'utf8');
console.log('dtgMin',dmin,'|',path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
