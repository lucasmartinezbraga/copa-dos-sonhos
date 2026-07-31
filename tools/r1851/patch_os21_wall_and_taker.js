#!/usr/bin/env node
'use strict';
/*
 * OS-21 · BARREIRA E REALCE DO COBRADOR NO CAMPO
 * ----------------------------------------------
 * Complementa a OS-20 (cartao de bola parada) com desenho SOBRE o campo.
 *
 * Camada SO DE APRESENTACAO, em canvas PROPRIO sobreposto ao `#fieldcv`. Nao
 * envolve nem substitui o laco de render do jogo: se este canvas falhar, o
 * campo continua desenhando igual.
 *
 * A transformacao e a mesma do renderer, reconstruida a partir das constantes
 * dele (build :13390 e :13659):
 *   CW=1024, CH=500, M=14
 *   cx(nx) = M + nx*(CW-2M)      cy(ny) = M + ny*(CH-2M)
 *   projecao 2.5D por window.CDS_F25D.project(rx,ry) -> {x,y,s}
 * Coordenada de simulacao vira normalizada por FL/FW antes de entrar em cx/cy.
 * O canvas sobreposto usa o MESMO tamanho interno 1024x500 e e esticado pelo
 * mesmo retangulo do canvas do jogo, entao os dois espacos coincidem.
 *
 * O que desenha, enquanto a cobranca esta viva:
 *   - anel pulsante e seta sobre o COBRADOR, com o nome;
 *   - a BARREIRA: defensores dentro de 11 m da bola ganham marca propria e
 *     sao ligados por uma faixa, com a distancia regulamentar (9,15 m) em
 *     circulo tracejado ao redor da bola;
 *   - linha tracejada da bola ate o gol, para ler o angulo.
 *
 * NAO consome RNG, NAO muda posse, trajetoria, estatistica ou decisao. Le
 * `window.__CDS_ACTIVE_SIM` somente para posicoes. Sem `document` nao instala,
 * entao as baterias em Node seguem identicas.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(x => x.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const input = arg('in', 'dist/COPA DOS SONHOS - R18.54 - JOGO DE FUTEBOL.html');
const output = arg('out', 'dist/COPA DOS SONHOS - R18.55 - JOGO DE FUTEBOL.html');
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

const LAYER = `<script id="cds-os21-wall-taker">
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
      ov.width=CW;ov.height=CH;
      ov.style.position='absolute';ov.style.pointerEvents='none';ov.style.zIndex='40';
      (cv.parentNode||document.body).appendChild(ov);
    }
    octx=ov.getContext('2d');
  }
  // acompanha o retangulo do canvas do jogo
  try{
    var host=ov.offsetParent||cv.parentNode;
    var r=cv.getBoundingClientRect(),h=host.getBoundingClientRect();
    ov.style.left=(r.left-h.left)+'px';ov.style.top=(r.top-h.top)+'px';
    ov.style.width=r.width+'px';ov.style.height=r.height+'px';
  }catch(_){}
  return octx;
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
  c.clearRect(0,0,CW,CH);
  if(!live||Date.now()>live.until){live=null;return;}
  var sim=root.__CDS_ACTIVE_SIM;if(!sim||!sim.ball)return;
  var b=sim.ball,taker=live.taker;
  var t=(Date.now()%1100)/1100, pulso=.55+.45*Math.sin(t*Math.PI*2);
  dbg.desenhos++;

  // linha bola -> gol, para ler o angulo
  try{
    var tm=sim.teams[live.team],g=tm&&tm.oppGoal;
    if(g){
      var pb=proj(b.x,b.y),pg=proj(g.x,g.y);
      c.save();c.setLineDash([7,7]);c.lineWidth=1.6;
      c.strokeStyle='rgba(255,203,69,.42)';
      c.beginPath();c.moveTo(pb.x,pb.y);c.lineTo(pg.x,pg.y);c.stroke();c.restore();
    }
  }catch(_){}

  // distancia regulamentar de 9,15 m ao redor da bola
  try{
    var p0=proj(b.x,b.y),p1=proj(b.x+9.15,b.y);
    var rr=Math.abs(p1.x-p0.x);
    if(rr>2){
      c.save();c.setLineDash([4,6]);c.lineWidth=1.4;
      c.strokeStyle='rgba(255,255,255,.28)';
      c.beginPath();c.arc(p0.x,p0.y,rr,0,Math.PI*2);c.stroke();c.restore();
    }
  }catch(_){}

  // BARREIRA: defensores a ate 11 m da bola
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
  }catch(_){}

  // COBRADOR: anel pulsante, seta e nome
  try{
    if(taker&&!taker.red){
      dbg.cobrador++;
      var pt=proj(taker.x,taker.y),R0=15*pt.s;
      c.save();
      c.beginPath();c.arc(pt.x,pt.y,R0+5*pulso,0,Math.PI*2);
      c.strokeStyle='rgba(255,203,69,'+(.45+.5*pulso).toFixed(3)+')';c.lineWidth=3;c.stroke();
      c.beginPath();c.arc(pt.x,pt.y,R0,0,Math.PI*2);
      c.strokeStyle='#ffcb45';c.lineWidth=2;c.stroke();
      // seta acima
      var ay=pt.y-R0-9-3*pulso;
      c.beginPath();c.moveTo(pt.x,ay+8);c.lineTo(pt.x-6,ay);c.lineTo(pt.x+6,ay);c.closePath();
      c.fillStyle='#ffcb45';c.fill();
      var nm=nome(taker);
      if(nm){
        c.font='bold 11px Arial,sans-serif';c.textAlign='center';
        var w=c.measureText(nm).width+12;
        c.fillStyle='rgba(8,16,12,.85)';
        c.fillRect(pt.x-w/2,ay-19,w,15);
        c.fillStyle='#ffcb45';c.fillText(nm,pt.x,ay-8);
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
</script>
</body></html>`;

edit('os21-wall-and-taker', `</body></html>`, LAYER);

fs.writeFileSync(output, src, 'utf8');
const sha = crypto.createHash('sha256').update(src).digest('hex');
console.log('patches:', applied.join(', '));
console.log(path.basename(output), '| sha256', sha);
