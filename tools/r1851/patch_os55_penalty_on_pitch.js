#!/usr/bin/env node
'use strict';
/*
 * OS-55 · O PENALTI VOLTA PARA O GRAMADO
 * ---------------------------------------
 * Pedido: "recrie completamente a animacao do penalti".
 *
 * O que existe hoje: a cobranca de penalti do JOGO dispara `penScene` (:12438)
 * e o desenhista, em `:13588`, faz
 *
 *     if (penScene && performance.now() < penScene.until) { drawPenScene(ctx); return; }
 *
 * — ou seja, o campo INTEIRO some e entra uma cutscene de 3,9 s com fundo
 * proprio, gol em perspectiva, corrida, chute e mergulho. E, em `:12484`,
 * `penActive` PAUSA o simulador enquanto ela roda.
 *
 * E a mesma cutscene que ja foi removida da falta a pedido ("remova o mini game
 * de falta e o de penalti e crie outra forma de visualizar isso na partida, sem
 * ser mini game"). Na falta ela saiu; no penalti ela sobreviveu.
 *
 * EDIT · a cena de cutscene deixa de ser criada para o penalti DE JOGO. A
 * cobranca passa a acontecer no gramado, com a bola voando de verdade, o
 * goleiro na linha e o mesmo motor de sempre — e a apresentacao fica por conta
 * das camadas que ja existem e ja tratam `penalty`: a tarja da OS-20/OS-50 e o
 * anel do cobrador da OS-21/OS-50.
 *
 * A disputa de PENALTIS (shootout, :13249) NAO e tocada: ali a cutscene e o
 * enquadramento certo, porque nao ha partida acontecendo ao redor.
 *
 * Como `penScene` deixa de existir no jogo, some junto a PAUSA do simulador: o
 * lance corre em tempo real, como o escanteio e a falta.
 *
 * PREVISAO: numeros do motor IDENTICOS — isto e desenho e pausa de tela, nao
 * simulacao. Se mudarem, vazou.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.76 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.77 - JOGO DE FUTEBOL.html');
let src=fs.readFileSync(input,'utf8');
const from=`  // CENA DE PÊNALTI durante o jogo (falta na área): anima a cobrança
  if (e.type === 'penalty' && e.by) {`;
const to=`  /* OS-55 · a cutscene de penalti do JOGO foi removida: ela apagava o campo
     inteiro por 3,9 s e pausava o simulador, que e exatamente o mini game que
     ja tinha sido tirado da falta. A cobranca agora acontece no gramado, com a
     bola voando de verdade; a apresentacao fica com a tarja (OS-20/OS-50) e o
     anel do cobrador (OS-21/OS-50). A disputa de penaltis (shootout) segue com
     cena propria, porque la nao ha partida ao redor. */
  if (false && e.type === 'penalty' && e.by) {`;
const c=src.split(from).length-1;
if(c!==1){console.error('ABORTA: ancora '+c+'x');process.exit(1);}
src=src.replace(from,to);
fs.writeFileSync(output,src,'utf8');
console.log('os55-penalty-on-pitch |',path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
