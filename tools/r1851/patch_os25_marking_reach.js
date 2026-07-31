#!/usr/bin/env node
'use strict';
/*
 * OS-25 · ALCANCE DE MARCACAO E TETO DE SCREEN
 * A bateria 3x48 da OS-06 decidiu a rota: entreLinhas_cobertura 0,72 contra
 * 0,97 da profunda, e o gate `marking` do motor reprovando em ~60% das
 * partidas por threatCoverage (0,633 contra 0,65 exigido).
 * Dois sitios: reach em :21192 e o teto de UM screen em :21206.
 * O DEF fica 48% do tempo em zona contra 36% do MID, entao o reach do DEF
 * pesa tanto quanto o do MID.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.57 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.58 - JOGO DE FUTEBOL.html');
const rd=arg('def','24'),rm=arg('mid','22'),rf=arg('fwd','16'),screens=arg('screens','3');
let src=fs.readFileSync(input,'utf8');const ap=[];
function edit(id,from,to){const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);ap.push(id);}
edit('os25-reach',`reach=L==='DEF'?18.5:L==='MID'?16.5:14.0`,
  `reach=L==='DEF'?${rd}:L==='MID'?${rm}:${rf}`);
edit('os25-screen-cap',`const chosen=screenPool[0];chosen.p._r18173ScreenTgt=chosen.target;s.screensAssigned++;`,
  `for(var _i=0;_i<Math.min(${screens},screenPool.length);_i++){var chosen=screenPool[_i];chosen.p._r18173ScreenTgt=chosen.target;s.screensAssigned++;}`);
fs.writeFileSync(output,src,'utf8');
console.log('patches:',ap.join(', '),'| reach',rd+'/'+rm+'/'+rf,'| screens',screens);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
