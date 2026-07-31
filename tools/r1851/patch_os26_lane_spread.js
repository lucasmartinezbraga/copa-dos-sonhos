#!/usr/bin/env node
'use strict';
/*
 * OS-26 · SEPARACAO POR FAIXA (a coluna)
 * A OS-11 falhou porque empurrava por PROXIMIDADE: uma coluna com |dx| ate
 * 12 m tem vizinhos a mais de 3,4 m, entao a forca nunca engatava. A bateria
 * 3x48 confirmou: corredorMax = 10 nas tres bases, dez jogadores de um time
 * num corredor de 13,6 m.
 * O empurrao agora e por FAIXA: dois companheiros no mesmo corredor de y,
 * mesmo distantes em x, se afastam em y. Mesmo bloco de :8087, mesma cadencia,
 * mesma imunidade do portador. Sem RNG.
 * Quem tem `_markRef` ou `_r18173ScreenTgt` fica ISENTO: o marcador PRECISA
 * estar na faixa do alvo, e empurra-lo derrubava o threatCoverage abaixo do
 * gate. So jogador em zona pura se espalha.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.58 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.59 - JOGO DE FUTEBOL.html');
const faixa=arg('faixa','5.5'),alcX=arg('alcanceX','22'),forca=arg('forca','.10'),teto=arg('teto','.30');
let src=fs.readFileSync(input,'utf8');
const ANC=`s.clumpCorrections++;}}`;
const c=src.split(ANC).length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace(ANC,`s.clumpCorrections++;}
else if(!a._markRef&&!b._markRef&&!a._r18173ScreenTgt&&!b._r18173ScreenTgt&&Math.abs(a.y-b.y)<${faixa}&&Math.abs(a.x-b.x)<${alcX}){const _sy=(a.y-b.y)>=0?1:-1,_kk=Math.min((${faixa}-Math.abs(a.y-b.y))*${forca},${teto});if(this.ball.owner!==a)a.y=C(a.y+_sy*_kk,1,FW-1);if(this.ball.owner!==b)b.y=C(b.y-_sy*_kk,1,FW-1);s.clumpCorrections++;}}`);
fs.writeFileSync(output,src,'utf8');
console.log('faixa',faixa,'alcanceX',alcX,'forca',forca,'teto',teto);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
