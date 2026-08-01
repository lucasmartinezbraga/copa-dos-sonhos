#!/usr/bin/env node
'use strict';
/*
 * OS-56 · O NOME DO COBRADOR PARA DE CAIR NA ARQUIBANCADA
 * --------------------------------------------------------
 * Achado por CAPTURA DE TELA. Fotografando uma cobranca de falta junto a linha
 * lateral de cima, o chip com o nome do cobrador aparece FORA do campo, dentro
 * da faixa escura da arquibancada.
 *
 * HIPOTESE QUE EU LEVANTEI E QUE ESTA FALSIFICADA: achei que a camada da OS-21
 * estivesse projetando errado, porque ela RECONSTROI a transformacao do campo a
 * partir de constantes copiadas (CW=1024, CH=500) enquanto o canvas do jogo tem
 * backing store de 973x475 e desenha sob uma matriz de camera. Cheguei a
 * escrever o patch que substituia a reconstrucao por uma tabela publicada pelo
 * renderer. Ao medir o erro dessa reconstrucao contra a posicao real:
 *
 *     erro medio 1,2 px | erro maximo 2,4 px  (22 jogadores)
 *
 * A projecao estava CERTA — 973 = 1024 * 0,95 e a matriz e exatamente
 * scale(0,95), entao as duas escalas se cancelam. O refactor foi descartado:
 * consertava nada e adicionava risco.
 *
 * O QUE E DE VERDADE. O chip do nome e desenhado num deslocamento FIXO acima do
 * anel (`ay = pt.y - R0 - 6`, texto em `ay - 8`). Quando o cobrador esta perto
 * da linha lateral de cima, esse deslocamento leva o texto para fora do campo
 * desenhado. Nao ha nenhuma verificacao de borda.
 *
 * EDIT · o rotulo passa a virar para BAIXO do jogador quando nao cabe acima, e
 * fica preso dentro do canvas na horizontal. E a mesma regra que qualquer
 * tooltip usa.
 *
 * PREVISAO: numeros do motor identicos (desenho). O gate e a propria captura.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.75 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.76 - JOGO DE FUTEBOL.html');
let src=fs.readFileSync(input,'utf8');
const from=`      var ay=pt.y-R0-6;
      var nm=nome(taker);
      if(nm){
        c.font='bold 11px Arial,sans-serif';c.textAlign='center';
        var w=c.measureText(nm).width+12;
        c.fillStyle='rgba(8,16,12,.85)';
        c.fillRect(pt.x-w/2,ay-19,w,15);
        c.fillStyle='#ffcb45';c.fillText(nm,pt.x,ay-8);
      }`;
const to=`      var nm=nome(taker);
      if(nm){
        c.font='bold 11px Arial,sans-serif';c.textAlign='center';
        var w=c.measureText(nm).width+12;
        /* OS-56 · o rotulo virava para cima com deslocamento fixo e caia fora do
           campo quando a falta era junto a linha lateral de cima. Agora ele vira
           para baixo quando nao cabe, e fica preso dentro do canvas na
           horizontal. */
        var topo=pt.y-R0-25, ty;
        if(topo>4){ ty=topo; } else { ty=pt.y+R0+6; }
        var tx=Math.max(w/2+3,Math.min(CW-w/2-3,pt.x));
        c.fillStyle='rgba(8,16,12,.85)';
        c.fillRect(tx-w/2,ty,w,15);
        c.fillStyle='#ffcb45';c.fillText(nm,tx,ty+11);
      }`;
const c=src.split(from).length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace(from,to);
fs.writeFileSync(output,src,'utf8');
console.log('os56-label-inside |',path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
