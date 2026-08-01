#!/usr/bin/env node
'use strict';
/*
 * OS-64 · O OVERLAY DE BOLA PARADA PASSA A USAR A MATRIZ DO JOGO
 * ---------------------------------------------------------------
 * CORRECAO DE UMA DECISAO MINHA, E O MOTIVO E UMA MUDANCA MINHA.
 *
 * Na revisao da animacao eu suspeitei que a camada OS-21 estivesse projetando
 * errado, porque ela desenha num canvas PROPRIO e RECONSTROI a transformacao do
 * campo a partir de constantes copiadas (CW=1024, CH=500). Escrevi o patch que
 * trocava a reconstrucao por uma tabela publicada pelo renderer, medi o erro e
 * encontrei 1,2 px em media, 2,4 px no maximo. Conclui que a projecao estava
 * certa e DESCARTEI o refactor por "consertar nada e adicionar risco".
 *
 * Aquela medicao foi feita na R18.75 — ANTES da OS-57. Naquele momento o
 * desktop desenhava o campo inteiro, sem camera, e as duas transformacoes de
 * fato coincidiam.
 *
 * Ao ligar a camera de TV no desktop (OS-57), o `paintField` passou a aplicar
 * `translate/scale` de camera ao contexto ANTES de desenhar o campo. O canvas
 * sobreposto nao aplica nada disso. A partir dali o anel do cobrador, a
 * barreira e o circulo de 9,15 m saem do lugar — visivel na captura, com o chip
 * do cobrador a dezenas de pixels do jogador.
 *
 * Ou seja: o refactor que descartei virou necessario, e foi a minha propria
 * mudanca que o tornou necessario.
 *
 * EDITS
 *  1) O renderer PUBLICA, por quadro, a matriz corrente do contexto e a posicao
 *     de tela de cada atleta com o raio. Sao os mesmos valores que a linha
 *     seguinte ja usa para desenhar o corpo — nenhuma conta nova.
 *  2) A OS-21 CONSOME: o canvas sobreposto nasce com o mesmo tamanho interno do
 *     canvas do jogo, aplica a mesma matriz e le a posicao dos jogadores da
 *     tabela. Sem tabela, cai no caminho antigo e nada quebra.
 *
 * PREVISAO: numeros do motor IDENTICOS. O gate e a captura: o anel tem de ficar
 * em cima do cobrador com a camera ligada.
 */
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const arg=(n,d)=>{const h=process.argv.slice(2).find(x=>x.startsWith('--'+n+'='));return h?h.slice(n.length+3):d;};
const input=arg('in','dist/COPA DOS SONHOS - R18.81 - JOGO DE FUTEBOL.html');
const output=arg('out','dist/COPA DOS SONHOS - R18.82 - JOGO DE FUTEBOL.html');
let src=fs.readFileSync(input,'utf8');
const applied=[];
function edit(id,from,to){
  const c=src.split(from).length-1;
  if(c!==1){console.error('ABORTA ['+id+']: ancora '+c+'x');process.exit(1);}
  src=src.replace(from,to);applied.push(id);
}

edit('os64-publish',
`      if (window.CDS_F25D) { window.CDS_F25D.body(ctx, { x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0)), act: p._act||'', pose: (motion&&motion.type)||'', wave: actionWave }); } else {`,
`      /* OS-64 · publica posicao de tela e matriz para as camadas sobrepostas
         nao precisarem reconstruir a projecao (a reconstrucao deixou de bater
         quando a OS-57 ligou a camera de TV). */
      try{
        let _sc = window.__CDS_SCREEN;
        if(!_sc){ _sc = window.__CDS_SCREEN = { p:Object.create(null), m:[1,0,0,1,0,0] }; }
        const _mm = ctx.getTransform ? ctx.getTransform() : null;
        if(_mm){ _sc.m[0]=_mm.a;_sc.m[1]=_mm.b;_sc.m[2]=_mm.c;_sc.m[3]=_mm.d;_sc.m[4]=_mm.e;_sc.m[5]=_mm.f; }
        _sc.p[(p.ref&&p.ref.n)||p.n||('#'+(p.num||0))] = { x:groundX, y:groundY, r:r, s:_ps };
      }catch(_){}
      if (window.CDS_F25D) { window.CDS_F25D.body(ctx, { x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0)), act: p._act||'', pose: (motion&&motion.type)||'', wave: actionWave }); } else {`);

edit('os64-overlay-size',
`      ov=document.createElement('canvas');ov.id='cds-os21-cv';
      ov.width=CW;ov.height=CH;`,
`      ov=document.createElement('canvas');ov.id='cds-os21-cv';
      /* OS-64 · mesmo tamanho interno do canvas do jogo */
      ov.width=cv.width||CW;ov.height=cv.height||CH;`);

edit('os64-overlay-sync',
`  // acompanha o retangulo do canvas do jogo
  try{`,
`  try{
    if(cv.width&&ov.width!==cv.width)ov.width=cv.width;
    if(cv.height&&ov.height!==cv.height)ov.height=cv.height;
  }catch(_){}
  // acompanha o retangulo do canvas do jogo
  try{`);

edit('os64-proj-table',
`function proj(sx,sy){`,
`/* OS-64 · posicao de tela vinda da tabela publicada pelo renderer */
function tela(){return root.__CDS_SCREEN||null;}
function projJog(p){
  try{
    var t=tela(); if(!t||!p)return null;
    var k=(p.ref&&p.ref.n)||p.n||('#'+(p.num||0));
    var q=t.p&&t.p[k];
    if(q&&isFinite(q.x)&&isFinite(q.y))return {x:q.x,y:q.y,s:q.s||1};
  }catch(_){}
  return null;
}
function proj(sx,sy){`);

edit('os64-apply-matrix',
`  var c=overlay();if(!c)return;
  c.clearRect(0,0,CW,CH);`,
`  var c=overlay();if(!c)return;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,ov.width,ov.height);
  try{var _t=tela();if(_t&&_t.m)c.setTransform(_t.m[0],_t.m[1],_t.m[2],_t.m[3],_t.m[4],_t.m[5]);}catch(_){}`);

edit('os64-taker',
`      var pt=proj(taker.x,taker.y),R0=11*pt.s;`,
`      var pt=projJog(taker)||proj(taker.x,taker.y),R0=11*(pt.s||1);`);

edit('os64-wall',
`          var q=proj(na[k2].x,na[k2].y);`,
`          var q=projJog(na[k2])||proj(na[k2].x,na[k2].y);`);

fs.writeFileSync(output,src,'utf8');
console.log('patches:',applied.join(', '));
console.log(path.basename(output),'| sha256',crypto.createHash('sha256').update(src).digest('hex'));
