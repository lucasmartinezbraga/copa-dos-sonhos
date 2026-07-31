#!/usr/bin/env node
'use strict';
/*
 * OS-28 · INTELIGENCIA INDIVIDUAL: CONSTANTE VIRA FUNCAO DE ATRIBUTO
 * O motor ja faz isso em quatro sitios (:8084 decisionIQ, :5160 iqReact,
 * :5199 cone de conducao, :6987 goleiro). O caminho para ampliar nao e uma
 * camada de IA nova — e converter constante fixa em funcao de atributo, um
 * sitio por vez, cada um virando candidata medivel.
 *
 * Dois sitios que eu mesmo deixei como constante e agora leem o jogador:
 *
 * 1) O `dtg > 23` da OS-27. Passa a `16 + finalizacao/100*14`: o finalizador
 *    de 95 corta pra dentro de ate 29 m; o de 50 so dentro de 23 m; o de 30
 *    so dentro de 20 m. Quem sabe chutar prefere chutar de mais longe.
 *
 * 2) `crossP` (:5154), que nao lia habilidade nenhuma de cruzamento. Ganha
 *    fator `.72 + low_cross/100*.56`: cruzador de 90 cruza ~22% mais que o
 *    de 50, e o de 30 cruza ~11% menos.
 *
 * Sem RNG novo — os dois entram em expressoes ja existentes.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.60 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.61 - JOGO DE FUTEBOL.html');
let src=fs.readFileSync(input,'utf8');const ap=[];
function edit(id,from,to){const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);ap.push(id);}

edit('os28-cut-inside-by-finishing',
  `dtg > 23 && chance(crossP)`,
  `dtg > (16 + facet(o,'shot')/100*14) && chance(crossP)`);

edit('os28-crossp-by-crossing-skill',
  `const crossP = clamp(0.69 * this.teams[o.team].fx.cross * crossMul`,
  `const crossP = clamp(0.69 * (.72 + facet(o,'low_cross')/100*.56) * this.teams[o.team].fx.cross * crossMul`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',ap.join(', '));
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
