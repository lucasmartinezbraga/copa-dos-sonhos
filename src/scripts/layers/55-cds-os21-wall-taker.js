
(function(root){
'use strict';
if(typeof document==='undefined')return;
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS21__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS21__',{value:true});}catch(_){P.__CDS_OS21__=true;}

var CW=1024,CH=500,MG=14;
var dbg={frames:0,desenhos:0,cobrador:0,barreira:0};
var live=null;   // {kind, taker, team, until}
var ov=null,octx=null,raf=0;

function campo(){return document.getElementById('fieldcv');}
function overlay(){
  var cv=campo();if(!cv)return null;
  if(!ov||!ov.isConnected){
    ov=document.getElementById('cds-os21-cv');
    if(!ov){
      ov=document.createElement('canvas');ov.id='cds-os21-cv';
      /* OS-64 · mesmo tamanho interno do canvas do jogo */
      ov.width=cv.width||CW;ov.height=cv.height||CH;
      ov.style.position='absolute';ov.style.pointerEvents='none';ov.style.zIndex='40';
      (cv.parentNode||document.body).appendChild(ov);
    }
    octx=ov.getContext('2d');
  }
  try{
    if(cv.width&&ov.width!==cv.width)ov.width=cv.width;
    if(cv.height&&ov.height!==cv.height)ov.height=cv.height;
  }catch(_){}
  // acompanha o retangulo do canvas do jogo
  try{
    var host=ov.offsetParent||cv.parentNode;
    var r=cv.getBoundingClientRect(),h=host.getBoundingClientRect();
    ov.style.left=(r.left-h.left)+'px';ov.style.top=(r.top-h.top)+'px';
    ov.style.width=r.width+'px';ov.style.height=r.height+'px';
  }catch(_){}
  return octx;
}
/* OS-64 · posicao de tela vinda da tabela publicada pelo renderer */
function tela(){return root.__CDS_SCREEN||null;}
function projJog(p){
  try{
    var t=tela(); if(!t||!p)return null;
    /* §OS-209 · a chave de tela passou a ser qualificada por time */
    var k=(p.team!=null?p.team:'?')+':'+((p.ref&&(p.ref.id!=null?'i'+p.ref.id:p.ref.n))||p.n||('#'+(p.num||0)));
    var q=t.p&&t.p[k];
    if(q&&isFinite(q.x)&&isFinite(q.y))return {x:q.x,y:q.y,s:q.s||1};
  }catch(_){}
  return null;
}
function proj(sx,sy){
  var FLv=root.FL||105,FWv=root.FW||68;
  var rx=MG+(sx/FLv)*(CW-MG*2), ry=MG+(sy/FWv)*(CH-MG*2);
  if(root.CDS_F25D&&root.CDS_F25D.project){
    try{var p=root.CDS_F25D.project(rx,ry);return{x:p.x,y:p.y,s:p.s||1};}catch(_){}
  }
  return{x:rx,y:ry,s:1};
}
function nome(p){
  try{var n=(p&&p.ref&&p.ref.n)||'';if(!n)return '';
    if(typeof root.lastWord==='function')return root.lastWord(n,14);
    var q=String(n).trim().split(' ');return q[q.length-1].toUpperCase();}catch(_){return '';}
}

function frame(){
  raf=requestAnimationFrame(frame);
  dbg.frames++;
  var c=overlay();if(!c)return;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,ov.width,ov.height);
  try{var _t=tela();if(_t&&_t.m)c.setTransform(_t.m[0],_t.m[1],_t.m[2],_t.m[3],_t.m[4],_t.m[5]);}catch(_){}
  if(!live||Date.now()>live.until){live=null;return;}
  var sim=root.__CDS_ACTIVE_SIM;if(!sim||!sim.ball)return;
  var b=sim.ball,taker=live.taker;
  var t=(Date.now()%1100)/1100, pulso=.55+.45*Math.sin(t*Math.PI*2);
  dbg.desenhos++;

  /* OS-50 · a linha tracejada ate o gol saiu: ela cruzava a area inteira por
     cima dos jogadores e nao dizia nada que o lance ja nao mostrasse. */

  // distancia regulamentar de 9,15 m ao redor da bola
  try{
    var p0=proj(b.x,b.y),p1=proj(b.x+9.15,b.y);
    var rr=Math.abs(p1.x-p0.x);
    if(rr>2){
      c.save();c.setLineDash([3,9]);c.lineWidth=1.1;
      c.strokeStyle='rgba(255,255,255,.16)';   /* OS-50 · mais fraco */
      c.beginPath();c.arc(p0.x,p0.y,rr,0,Math.PI*2);c.stroke();c.restore();
    }
  }catch(_){}

  /* OS-50 · BARREIRA DE VERDADE. Antes isto ligava com uma polilinha em
     ziguezague QUALQUER defensor a menos de 11 m da bola — inclusive quem
     estava atras dela ou fora do lance. Desde a OS-36 a barreira existe no
     motor e tem marca propria (`_os36Wall`), entao o desenho passa a ser ela,
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
          var q=projJog(na[k2])||proj(na[k2].x,na[k2].y);
          c.beginPath();
          c.ellipse(q.x,q.y+9*q.s,10*q.s,3.4*q.s,0,0,Math.PI*2);
          c.fillStyle='rgba(120,190,255,.22)';c.fill();
          c.strokeStyle='rgba(120,190,255,.45)';c.lineWidth=1.2;c.stroke();
        }
        c.restore();
      }
    }
  }catch(_){}

  // COBRADOR: anel pulsante, seta e nome
  try{
    if(taker&&!taker.red){
      dbg.cobrador++;
      /* OS-50 · anel unico e discreto, sem seta e sem pulso duplo. */
      var pt=projJog(taker)||proj(taker.x,taker.y),R0=11*(pt.s||1);
      c.save();
      c.beginPath();c.arc(pt.x,pt.y,R0,0,Math.PI*2);
      c.strokeStyle='rgba(255,203,69,'+(.40+.30*pulso).toFixed(3)+')';c.lineWidth=1.8;c.stroke();
      var nm=nome(taker);
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
      }
      c.restore();
    }
  }catch(_){}
}

function ligar(kind,taker,team,dur){
  live={kind:kind,taker:taker,team:team,until:Date.now()+dur};
  if(!raf)raf=requestAnimationFrame(frame);
}
function desligar(){live=null;}

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(type==='freekick_routine'&&data){ ligar('fk',data.by,data.team,4200); }
    else if(type==='penalty'&&data){
      var tt=(data.team!=null?data.team:(data.by&&data.by.team));
      ligar('pk',data.by||data.taker,tt,4600);
    }
    else if(type==='goal'||type==='save'||type==='post'||type==='miss'||type==='blocked'||type==='kickoff'){
      if(live)live.until=Math.min(live.until,Date.now()+900);
    }
  }catch(_){}
  return r;
};

root.CDS_OS21=Object.freeze({version:'OS-21',feature:'SET_PIECE_WALL_AND_TAKER',
  presentationOnly:true,rngConsumption:false,engineMutation:false,
  debug:function(){return JSON.parse(JSON.stringify(dbg));},
  ativo:function(){return !!live;}});
})(typeof window!=='undefined'?window:globalThis);
