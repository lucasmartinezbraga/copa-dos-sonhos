#!/usr/bin/env node
'use strict';
/*
 * OS-58 · CICLO DE CORRIDA DE VERDADE
 * ------------------------------------
 * Achado olhando o boneco ampliado (captura com zoom 3,2 e densidade 3).
 *
 * O corpo tem cabeca, tronco com numero, calcao, duas pernas e sombra — a
 * figura le bem parada. Correndo, nao le. Duas causas no desenho (`:19617`):
 *
 * 1) OS BRACOS SAO FIXOS. No caso comum eles sao dois retangulos arredondados
 *    em posicao constante:
 *        rr(ctx, -r*.8 + tl, -r*.46, r*.26, r*.58, r*.09);
 *        rr(ctx,  r*.54 + tl, -r*.46, r*.26, r*.58, r*.09);
 *    Nenhuma dependencia da passada. Braco parado e o que mais denuncia
 *    "boneco deslizando": no futebol o braco balanca em contrafase com a perna.
 *
 * 2) A PERNA SO SOBE E DESCE. A passada move a perna em Y por `r*.20` e nada em
 *    X — nao ha tesoura. Com r ~ 30 px isso da 6 px de diferenca entre as duas
 *    pernas, quase nada.
 *
 * EDIT · o mesmo `sw = sin(gait) * amp` que ja alterna as pernas passa a mover:
 *   - as PERNAS tambem em X (tesoura: uma a frente, outra atras), com a
 *     amplitude vertical subindo de r*.20 para r*.30;
 *   - os BRACOS em contrafase, em Y e X.
 * A amplitude segue proporcional a `amp`, que e a velocidade de tela: parado
 * continua parado, sem nenhum tremor.
 *
 * Nada de estado novo, nada de evento novo, nada de motor. E o mesmo relogio de
 * passada que ja existia, aplicado onde faltava.
 *
 * PREVISAO: numeros do motor IDENTICOS. O gate e a captura.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.77 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.78 - JOGO DE FUTEBOL.html');
const PERNA=arg('perna','.30'), TESOURA=arg('tesoura','.20'), BRACO=arg('braco','.26');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

/* 1 ── pernas com tesoura e amplitude maior ---------------------------------- */
edit('os58-legs',
`      const llY = r * .40 - Math.max(0, sw) * r * .20;
      const rlY = r * .40 - Math.max(0, -sw) * r * .20;
      const spr = dribbling ? r * .06 : 0;                                      // drible: base mais aberta
      ctx.fillRect(-r * .34 - spr, llY, r * .26, r * .46);
      ctx.fillRect(r * .08 + spr, rlY, r * .26, r * .46);
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(-r * .36 - spr, llY + r * .38, r * .30, r * .22);
      ctx.fillRect(r * .06 + spr, rlY + r * .38, r * .30, r * .22);`,
`      /* OS-58 · a passada movia a perna SO em Y, por r*.20 — com r ~ 30 px sao
         6 px de diferenca entre as duas pernas, quase nada. Agora ha TESOURA:
         uma perna vai a frente e a outra atras, e a amplitude vertical sobe. */
      const llY = r * .40 - Math.max(0, sw) * r * ${PERNA};
      const rlY = r * .40 - Math.max(0, -sw) * r * ${PERNA};
      const spr = dribbling ? r * .06 : 0;                                      // drible: base mais aberta
      const lsx = sw * r * ${TESOURA} * face, rsx = -sw * r * ${TESOURA} * face;
      ctx.fillRect(-r * .34 - spr + lsx, llY, r * .26, r * .46);
      ctx.fillRect(r * .08 + spr + rsx, rlY, r * .26, r * .46);
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(-r * .36 - spr + lsx, llY + r * .38, r * .30, r * .22);
      ctx.fillRect(r * .06 + spr + rsx, rlY + r * .38, r * .30, r * .22);`);

/* 2 ── bracos em contrafase ---------------------------------------------------- */
edit('os58-arms',
`      rr(ctx, -r * .8 + tl, -r * .46, r * .26, r * .58, r * .09); ctx.fill();
      rr(ctx, r * .54 + tl, -r * .46, r * .26, r * .58, r * .09); ctx.fill();`,
`      /* OS-58 · os bracos eram dois retangulos FIXOS, sem nenhuma dependencia
         da passada. Braco parado e o que mais denuncia "boneco deslizando".
         Agora balancam em contrafase com a perna, em Y e em X. */
      const abY = -sw * r * ${BRACO}, abX = -sw * r * .10 * face;
      rr(ctx, -r * .8 + tl + abX, -r * .46 + abY, r * .26, r * .58, r * .09); ctx.fill();
      rr(ctx, r * .54 + tl - abX, -r * .46 - abY, r * .26, r * .58, r * .09); ctx.fill();`);

/* 3 ── o corpo sobe um pouco mais a cada passada ------------------------------- */
edit('os58-bob',
`    const bob = Math.abs(sw) * r * .05 - (tackling ? r * .16 : 0) + (dribbling ? r * .10 : 0);`,
`    /* OS-58 · a subida do corpo a cada passada era quase imperceptivel. */
    const bob = Math.abs(sw) * r * .09 - (tackling ? r * .16 : 0) + (dribbling ? r * .10 : 0);`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| perna='+PERNA,'tesoura='+TESOURA,'braco='+BRACO);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
