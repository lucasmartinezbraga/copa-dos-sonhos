
(function(root){'use strict';
var M=root&&root.MatchSim;if(!M||!M.prototype)return;var P=M.prototype;
var finite=function(v,d){v=Number(v);return Number.isFinite(v)?v:(d||0);};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
/* Qualquer deflexao encerra causalmente a viagem anterior. Sem isto um
   cruzamento que bate antes da callback continua sendo cobrado oito segundos
   depois como se ainda fosse um passe ao receptor original. */
var oldDeflect=P._deflectTo;
if(typeof oldDeflect==='function')P._deflectTo=function(){
  var b=this.ball;if(b&&b.__r10Pass){b.__r10Pass=null;b.__p04PendingReceiver=null;}
  return oldDeflect.apply(this,arguments);
};
var oldStep=P.step;
P.step=function(dt){
  var q=this.__os83OffsideWait,h=clamp(finite(dt,1/30),1/240,.12),px=0,py=0,track=false;
  try{
    if(q&&this.pendingRestart&&!q.taker.red){
      var dx=finite(q.x)-finite(q.taker.x),dy=finite(q.y)-finite(q.taker.y),d=Math.hypot(dx,dy);
      px=finite(q.taker.x);py=finite(q.taker.y);track=true;
      if(d>q.radius&&finite(this.t)<finite(q.until)&&finite(this.dead)<=h+.07)
        this.dead=Math.max(finite(this.dead),h+.08);
    }else if(q)this.__os83OffsideWait=null;
  }catch(_){}
  var r=oldStep.apply(this,arguments);
  try{
    if(track&&this.pendingRestart&&this.__os83OffsideWait===q&&finite(this.dead)>0){
      var dx2=finite(q.x)-px,dy2=finite(q.y)-py,L=Math.hypot(dx2,dy2);
      var step=Math.max(.01,finite(q.taker.maxSpd,7)*.92*h),s=Math.min(step,L);
      if(L>.0001){q.taker.x=px+dx2/L*s;q.taker.y=py+dy2/L*s;q.taker.vx=dx2/L*step/h;q.taker.vy=dy2/L*step/h;}
      else{q.taker.x=q.x;q.taker.y=q.y;q.taker.vx=0;q.taker.vy=0;}
    }
  }catch(_){}
  return r;
};
root.CDS_OS83_RESTART_WATCHDOG=Object.freeze({version:'OS-83',offsideDeadBall:true,crossTravelClosesWatchdog:true,deflectionClosesWatchdog:true,arrivalRadius:0.75,rngAdded:false,teleport:false});
})(typeof window!=='undefined'?window:globalThis);
