#!/usr/bin/env node
'use strict';
/*
 * OS-50 · A COBRANCA DE FALTA PARA DE POLUIR A TELA
 * --------------------------------------------------
 * Observacao de campo: "os negocio que tem na hora da falta ainda ta muito
 * estranho".
 *
 * O que estava desenhado ao mesmo tempo, em cima do lance:
 *   1. um CARTAO grande fixo no topo da tela (OS-20) com tipo, nome, distancia,
 *      barra de tempo e desfecho;
 *   2. uma LINHA TRACEJADA da bola ate o gol (OS-21);
 *   3. o CIRCULO de 9,15 m (OS-21);
 *   4. uma POLILINHA AZUL ligando todo defensor a menos de 11 m da bola, com um
 *      anel em cada um (OS-21);
 *   5. um anel pulsante, uma seta e o nome sobre o cobrador (OS-21).
 *
 * O item 4 e o pior: ele nao desenha a BARREIRA, desenha qualquer defensor que
 * esteja por perto — inclusive quem esta atras da bola ou fora do lance — e liga
 * todos com um ziguezague que nao existe no futebol. Desde a OS-36 a barreira e
 * real e tem marca propria (`_os36Wall`), entao dava para desenhar a barreira de
 * verdade e nao um grafo de proximidade.
 *
 * EDITS (todos de APRESENTACAO, nenhum toca no motor)
 *
 * 1) A barreira desenhada e a BARREIRA. So os jogadores com `_os36Wall` entram,
 *    e o desenho vira uma faixa discreta atras deles em vez de polilinha.
 * 2) Sai a linha tracejada ate o gol.
 * 3) O circulo de 9,15 m fica mais fraco.
 * 4) O anel do cobrador encolhe e a seta sai; fica o anel e o nome.
 * 5) O cartao do topo vira uma tarja compacta de uma linha.
 *
 * PREVISAO: numeros do motor IDENTICOS. Nada aqui roda fora do navegador.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.74 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.75 - JOGO DE FUTEBOL.html');
let src = fs.readFileSync(input, 'utf8');
const applied = [];

function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    console.error('ABORTA [' + id + ']: ancora ' + count + 'x');
    process.exit(1);
  }
  src = src.replace(from, to);
  applied.push(id);
}

/* 1 ── sai a linha bola->gol ------------------------------------------------ */
edit(
  'os50-drop-goal-line',
  `  // linha bola -> gol, para ler o angulo
  try{
    var tm=sim.teams[live.team],g=tm&&tm.oppGoal;
    if(g){
      var pb=proj(b.x,b.y),pg=proj(g.x,g.y);
      c.save();c.setLineDash([7,7]);c.lineWidth=1.6;
      c.strokeStyle='rgba(255,203,69,.42)';
      c.beginPath();c.moveTo(pb.x,pb.y);c.lineTo(pg.x,pg.y);c.stroke();c.restore();
    }
  }catch(_){}`,
  `  /* OS-50 · a linha tracejada ate o gol saiu: ela cruzava a area inteira por
     cima dos jogadores e nao dizia nada que o lance ja nao mostrasse. */`
);

/* 2 ── o circulo fica discreto ---------------------------------------------- */
edit(
  'os50-soft-circle',
  `      c.save();c.setLineDash([4,6]);c.lineWidth=1.4;
      c.strokeStyle='rgba(255,255,255,.28)';`,
  `      c.save();c.setLineDash([3,9]);c.lineWidth=1.1;
      c.strokeStyle='rgba(255,255,255,.16)';   /* OS-50 · mais fraco */`
);

/* 3 ── a barreira desenhada e a BARREIRA ------------------------------------ */
edit(
  'os50-real-wall',
  `  // BARREIRA: defensores a ate 11 m da bola
  try{
    var def=sim.teams[1-live.team];
    if(def&&def.players){
      var na=[];
      for(var i=0;i<def.players.length;i++){
        var d=def.players[i];
        if(!d||d.red||d.isGK)continue;
        var dd=Math.hypot(d.x-b.x,d.y-b.y);
        if(dd<=11)na.push(d);
      }
      if(na.length){
        dbg.barreira++;
        na.sort(function(a,z){return a.y-z.y;});
        c.save();
        c.strokeStyle='rgba(120,190,255,.85)';c.lineWidth=2.2;
        c.beginPath();
        for(var k=0;k<na.length;k++){
          var pp=proj(na[k].x,na[k].y);
          if(k===0)c.moveTo(pp.x,pp.y);else c.lineTo(pp.x,pp.y);
        }
        c.stroke();
        for(var k2=0;k2<na.length;k2++){
          var q=proj(na[k2].x,na[k2].y);
          c.beginPath();c.arc(q.x,q.y,9*q.s,0,Math.PI*2);
          c.strokeStyle='rgba(120,190,255,.9)';c.lineWidth=2;c.stroke();
        }
        c.restore();
      }
    }
  }catch(_){}`,
  `  /* OS-50 · BARREIRA DE VERDADE. Antes isto ligava com uma polilinha em
     ziguezague QUALQUER defensor a menos de 11 m da bola — inclusive quem
     estava atras dela ou fora do lance. Desde a OS-36 a barreira existe no
     motor e tem marca propria (\`_os36Wall\`), entao o desenho passa a ser ela,
     como uma faixa discreta ao pe de cada um. */
  try{
    var def=sim.teams[1-live.team];
    if(def&&def.players){
      var na=[];
      for(var i=0;i<def.players.length;i++){
        var d=def.players[i];
        if(d&&!d.red&&!d.isGK&&d._os36Wall)na.push(d);
      }
      if(na.length){
        dbg.barreira++;
        c.save();
        for(var k2=0;k2<na.length;k2++){
          var q=proj(na[k2].x,na[k2].y);
          c.beginPath();
          c.ellipse(q.x,q.y+9*q.s,10*q.s,3.4*q.s,0,0,Math.PI*2);
          c.fillStyle='rgba(120,190,255,.22)';c.fill();
          c.strokeStyle='rgba(120,190,255,.45)';c.lineWidth=1.2;c.stroke();
        }
        c.restore();
      }
    }
  }catch(_){}`
);

/* 4 ── o cobrador: anel menor, sem seta ------------------------------------- */
edit(
  'os50-quiet-taker',
  `      var pt=proj(taker.x,taker.y),R0=15*pt.s;
      c.save();
      c.beginPath();c.arc(pt.x,pt.y,R0+5*pulso,0,Math.PI*2);
      c.strokeStyle='rgba(255,203,69,'+(.45+.5*pulso).toFixed(3)+')';c.lineWidth=3;c.stroke();
      c.beginPath();c.arc(pt.x,pt.y,R0,0,Math.PI*2);
      c.strokeStyle='#ffcb45';c.lineWidth=2;c.stroke();
      // seta acima
      var ay=pt.y-R0-9-3*pulso;
      c.beginPath();c.moveTo(pt.x,ay+8);c.lineTo(pt.x-6,ay);c.lineTo(pt.x+6,ay);c.closePath();
      c.fillStyle='#ffcb45';c.fill();
      var nm=nome(taker);`,
  `      /* OS-50 · anel unico e discreto, sem seta e sem pulso duplo. */
      var pt=proj(taker.x,taker.y),R0=11*pt.s;
      c.save();
      c.beginPath();c.arc(pt.x,pt.y,R0,0,Math.PI*2);
      c.strokeStyle='rgba(255,203,69,'+(.40+.30*pulso).toFixed(3)+')';c.lineWidth=1.8;c.stroke();
      var ay=pt.y-R0-6;
      var nm=nome(taker);`
);

/* 5 ── o cartao do topo vira tarja compacta --------------------------------- */
edit(
  'os50-compact-card',
  `#cds-sp .cd{background:linear-gradient(180deg,rgba(10,22,16,.96),rgba(6,14,10,.96));
 border:1px solid rgba(255,203,69,.55);border-radius:12px;padding:11px 15px 9px;
 box-shadow:0 10px 30px rgba(0,0,0,.5)}`,
  `/* OS-50 · tarja compacta: o cartao antigo ocupava o topo do campo inteiro. */
#cds-sp{min-width:0 !important}
#cds-sp .cd{background:rgba(8,18,13,.88);
 border:1px solid rgba(255,203,69,.34);border-radius:999px;padding:5px 13px;
 box-shadow:0 4px 14px rgba(0,0,0,.38);display:flex;align-items:center;gap:9px;
 white-space:nowrap}
#cds-sp .nm{font-size:13px !important;margin:0 !important}
#cds-sp .kd{font-size:9.5px !important}
#cds-sp .sb{font-size:10.5px !important;margin:0 !important}
#cds-sp .br{width:54px;margin:0 !important;flex:0 0 auto}
#cds-sp .rs{font-size:12px !important;margin:0 !important}`
);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
