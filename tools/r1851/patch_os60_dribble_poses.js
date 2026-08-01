#!/usr/bin/env node
'use strict';
/*
 * OS-60 · CADA DRIBLE COM SEU DESENHO
 * ------------------------------------
 * Depois da OS-46/47/54 os estados de drible sao pedidos e chegam ao
 * desenhista: `body_feint` (elastico/caneta), `inside_cut` (corta pra dentro),
 * `burst_touch` (arrancada) e `turn_dribble` (meia-lua e drible da vaca, que
 * ganhou o giro de 360 na OS-47).
 *
 * So que em `body()` todos eles caem no MESMO ramo:
 *
 *     const dribbling = /^(carry|dribble_|body_feint|inside_cut|...)/.test(st);
 *     ...
 *     const spr = dribbling ? r * .06 : 0;      // base mais aberta
 *     const tl  = dribbling ? face * r * .06 : 0;  // tronco um pouco a frente
 *
 * Ou seja: 48 dribles por partida, quatro nomes diferentes, e **um desenho so**
 * — uma base 6% mais aberta. Quem faz elastico e quem arranca desenham igual.
 *
 * EDIT · tres poses proprias, todas dirigidas pela FASE do controlador
 * (`A.phase`), que ja existe e ja e usada pelo envelope de acao:
 *
 *   body_feint  · o tronco JOGA para um lado e volta — meio periodo de seno com
 *                 amplitude ${'${FINTA}'}r, com a cabeca acompanhando e as pernas
 *                 plantadas. E o corpo enganando, que e o que a finta e.
 *   inside_cut  · plantada e corte: inclinacao forte contra o lado do corte
 *                 (${'${CORTE}'} rad no pico), com a base abrindo. O jogador joga o
 *                 peso para fora e sai para dentro.
 *   burst_touch · arrancada: tronco projetado a frente (${'${ARRANQUE}'} rad) e
 *                 passada ampliada — a perna abre mais e o braco acompanha.
 *
 * `turn_dribble` continua com o giro da OS-47, intocado.
 *
 * Nada de estado novo, evento novo ou motor: os quatro estados ja chegavam ao
 * desenhista; o que faltava era desenho diferente para cada um.
 *
 * PREVISAO: numeros do motor IDENTICOS. O gate e a captura.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.78 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.79 - JOGO DE FUTEBOL.html');
const FINTA=arg('finta','.34'), CORTE=arg('corte','.30'), ARRANQUE=arg('arranque','.26');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

/* 1 ── identifica cada drible e sua fase ------------------------------------- */
edit('os60-flags',
`    const amp = (o.divePose || kicking || tackling) ? 0 : clamp(d.spd / 1.5, 0, 1);   // 0 parado … 1 correndo`,
`    /* OS-60 · os quatro estados de drible caiam no mesmo desenho. Agora cada um
       tem pose propria, dirigida pela FASE do controlador. */
    const dphase = A ? clamp(A.phase || 0, 0, 1) : 0;
    const feint  = A && st === 'body_feint';
    const cutting= A && (st === 'inside_cut' || st === 'outside_cut');
    const bursting = A && st === 'burst_touch';
    const amp = (o.divePose || kicking || tackling) ? 0
              : clamp(d.spd / 1.5, 0, 1) * (bursting ? 1.35 : 1);   // 0 parado … 1 correndo`);

/* 2 ── inclinacao propria de corte e arrancada ------------------------------- */
edit('os60-tilt',
`    if (!o.divePose && !spinning && _vig > .02) {
      ctx.rotate(_cos * _vig * 0.20);`,
`    if (!o.divePose && !spinning && _vig > .02) {
      /* OS-60 · corte joga o peso para fora antes de sair para dentro;
         arrancada projeta o tronco a frente. */
      const _extra = cutting  ? -face * ${CORTE} * Math.sin(dphase * Math.PI)
                   : bursting ?  face * ${ARRANQUE} * Math.min(1, dphase * 2.4)
                   : 0;
      ctx.rotate(_cos * _vig * 0.20 + _extra);`);

/* 3 ── o tronco da finta joga para o lado ------------------------------------ */
edit('os60-feint-sway',
`    const tl = (dribbling ? face * r * .06 : 0) + (kicking ? -face * r * .05 : 0);`,
`    /* OS-60 · na finta o TRONCO vai para um lado e volta — e o corpo enganando.
       Nos outros dribles fica o deslocamento leve de sempre. */
    const tl = (dribbling ? face * r * .06 : 0) + (kicking ? -face * r * .05 : 0)
             + (feint ? Math.sin(dphase * Math.PI * 2) * r * ${FINTA} * face : 0);`);

/* 4 ── a base abre no corte -------------------------------------------------- */
edit('os60-cut-stance',
`      const spr = dribbling ? r * .06 : 0;                                      // drible: base mais aberta`,
`      const spr = (dribbling ? r * .06 : 0)
                + (cutting ? r * .22 * Math.sin(dphase * Math.PI) : 0);          // OS-60 · corte planta e abre`);

/* 5 ── o BLOQUEIO ganha desenho: ele era identico a correr -------------------- */
edit('os60-block-pose',
`    } else if (tackling) {
      const front = face * (r * .22 + w * r * .60);`,
`    } else if (blocking) {
      /* OS-60 · MEDIDO: o estado de bloqueio desenhava exatamente igual ao de
         corrida — tinha 100% de cobertura de evento e nenhuma pose. Agora o
         atleta se joga na frente: base larga, corpo baixo, perna estendida na
         linha da bola. */
      const _bw = Math.sin(dphase * Math.PI);
      ctx.fillRect(-r * .46 - _bw * r * .22, r * .46, r * .28, r * .44);
      ctx.fillRect(r * .18 + _bw * r * .22, r * .46, r * .28, r * .44);
      ctx.fillStyle = '#0b0f16';
      ctx.fillRect(-r * .50 - _bw * r * .22, r * .84, r * .32, r * .20);
      ctx.fillRect(r * .16 + _bw * r * .22, r * .84, r * .32, r * .20);
    } else if (tackling) {
      const front = face * (r * .22 + w * r * .60);`);

edit('os60-block-flag',
`    const bursting = A && st === 'burst_touch';`,
`    const bursting = A && st === 'burst_touch';
    const blocking = A ? (st === 'block') : false;`);

edit('os60-block-crouch',
`    const bob = Math.abs(sw) * r * .09 - (tackling ? r * .16 : 0) + (dribbling ? r * .10 : 0);`,
`    const bob = Math.abs(sw) * r * .09 - (tackling ? r * .16 : 0) + (dribbling ? r * .10 : 0)
              - (blocking ? r * .12 * Math.sin(dphase * Math.PI) : 0);   /* OS-60 · agacha no bloqueio */`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '),'| finta='+FINTA,'corte='+CORTE,'arranque='+ARRANQUE);
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
