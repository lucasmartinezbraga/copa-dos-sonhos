
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS42__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS42__',{value:true});}catch(_){P.__CDS_OS42__=true;}
var N=2, RAIO=20;
var oldDT=P._defendTarget;
if(typeof oldDT!=='function')return;

function fwd(p){var s=p&&(p.oopPos||p.slotPos);return s==='ST'||s==='CF'||s==='LW'||s==='RW'||s==='SS';}

P._defendTarget=function(tm,p,b,presser){
  var out=oldDT.apply(this,arguments);
  try{
    if(!out||!p||p.red||p.isGK||!tm||!tm.goal)return out;
    if(!b||!b.traveling||!b.target)return out;
    if(b.kind==='shot')return out;
    /* MEDIDO: o cruzamento "aereo" nao sobe. Ele sai por
       _startTravel(o,alvo,'pass') sem estilo, entao vz=0.4 e z=0.12 — e uma
       bola rasteira para um ponto da area. Nao da para exigir altura; o que
       define a disputa e a bola estar viajando de fora para dentro da area. */
    var g=tm.goal, tx=Number(b.target.x), ty=Number(b.target.y);
    if(!isFinite(tx)||!isFinite(ty))return out;
    var dq=Math.hypot(tx-g.x,ty-g.y);
    if(dq>RAIO)return out;
    /* so quando a bola veio de fora e nao e nossa */
    var lt=b.lastTouch;
    if(lt&&lt.team===tm.side)return out;
    var fx=b.from?Number(b.from.x):NaN, fy=b.from?Number(b.from.y):NaN;
    if(!isFinite(fx)||!isFinite(fy))return out;
    var dOrigem=Math.hypot(fx-g.x,fy-g.y);
    if(dOrigem<=dq+6)return out;              // veio de fora, nao de dentro
    if(Math.hypot(tx-fx,ty-fy)<8)return out;  // voo curto nao e entrega na area
    var eleg=[],i,q;
    for(i=0;i<tm.players.length;i++){
      q=tm.players[i];
      if(!q||q.red||q.isGK||fwd(q))continue;
      eleg.push(q);
    }
    if(eleg.length<3)return out;
    eleg.sort(function(a,c){
      return Math.hypot(a.x-tx,a.y-ty)-Math.hypot(c.x-tx,c.y-ty);});
    var pos=eleg.indexOf(p);
    if(pos<0||pos>=N)return out;
    /* posto de disputa: do lado do gol do ponto de queda, escalonado para os
       dois nao ocuparem o mesmo ponto (o segundo cobre atras). */
    var vx=g.x-tx, vy=g.y-ty, L=Math.max(.6,Math.hypot(vx,vy));
    var rec=1.1+pos*1.6;
    return [tx+vx/L*rec, ty+vy/L*rec];
  }catch(_){}
  return out;
};
root.CDS_OS42=Object.freeze({version:'OS-42',feature:'CONTEST_THE_CROSS',defensores:N,raio:RAIO});
})(typeof window!=='undefined'?window:globalThis);
