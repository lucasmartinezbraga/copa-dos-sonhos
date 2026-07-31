#!/usr/bin/env node
'use strict';
/*
 * OS-31 · A COBRANCA DE FALTA VOLTA A FAZER SENTIDO
 * A OS-10 trocou `dtg < 28 && chance(0.42)` por `chance(0.92)` sem limite de
 * distancia. Consequencia que o usuario viu em tela: falta no meio-campo ou no
 * proprio campo de defesa virando cobranca cerimoniosa. No futebol real toda
 * falta e bola parada, mas longe do gol ela e reiniciada RAPIDO — nao vira
 * lance de cobranca.
 * Passa a distinguir: dentro de `dtgMax` do gol adversario, rotina de cobranca;
 * fora, reinicio rapido com posse (o ramo que ja existia).
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.62 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.63 - JOGO DE FUTEBOL.html');
const dmax=arg('dtgMax','42');
let src=fs.readFileSync(input,'utf8');
const A=`    if (chance(0.92)) { this._freeKick(victim.team, victim.x, victim.y); return; }`;
const c=src.split(A).length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace(A,`    /* OS-31 · perto do gol vira lance de cobranca; longe, reinicio rapido.
       Toda falta continua sendo bola parada — o que muda e a cerimonia. */
    if (dtg < ${dmax} && chance(0.92)) { this._freeKick(victim.team, victim.x, victim.y); return; }`);
fs.writeFileSync(output,src,'utf8');
console.log('dtgMax',dmax,'|',path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
