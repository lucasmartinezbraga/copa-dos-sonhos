
(function(root){'use strict';
var M=root&&root.MatchSim;if(!M||!M.prototype)return;var P=M.prototype;
var finite=function(v,d){v=Number(v);return Number.isFinite(v)?v:(d||0);};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
var dist=function(a,b){return Math.hypot(finite(a&&a.x)-finite(b&&b.x),finite(a&&a.y)-finite(b&&b.y));};
var oldAward=P._awardFoul;
P._awardFoul=function(fouler,victim){
  var before=this.__cdsTakerWait,r=oldAward.apply(this,arguments);
  try{
    var w=this.__cdsTakerWait,tm=victim&&this.teams&&this.teams[victim.team];
    var dtg=tm&&tm.oppGoal?dist(victim,tm.oppGoal):-1;
    /* dtg >= 42 e exatamente o ramo de reinicio rapido observado. */
    if(victim&&w&&w!==before&&this.pendingRestart&&dtg>=42){
      var actual=dist(w.taker,{x:w.x,y:w.y});
      var wait=clamp(.82+actual/6.5,.82,4.2);
      w.until=finite(this.t)+wait;w.radius=0.75;w.kind='common_foul';
      this.__os77FoulWait=w;
      var until=Math.max(w.until,finite(this.t)+1.6);
      this.__os36Guard={x:w.x,y:w.y,team:victim.team,until:until,wall:[]};
      this._emit('falta_atras_cobrada',{by:w.taker,x:w.x,y:w.y,initialDistance:actual,wait:wait});
    }
  }catch(_){}
  return r;
};
var oldStep=P.step;
P.step=function(dt){
  var w=this.__os77FoulWait,h=clamp(finite(dt,1/30),1/240,.12),px=0,py=0,track=false;
  try{
    if(w&&this.__cdsTakerWait===w&&this.pendingRestart&&!w.taker.red){
      var d=dist(w.taker,{x:w.x,y:w.y});
      px=finite(w.taker.x);py=finite(w.taker.y);track=true;
      if(d>w.radius&&finite(this.t)<finite(w.until)&&finite(this.dead)<=h+.07)
        this.dead=Math.max(finite(this.dead),h+.08);
    }else if(w)this.__os77FoulWait=null;
  }catch(_){}
  var r=oldStep.apply(this,arguments);
  /* Escritor final durante a cerimonia: caminha uma unica passada desde a
     posicao do quadro anterior. Assim alvos taticos tardios nao puxam o
     cobrador para longe da bola e nao ha movimento duplicado nem snap. */
  try{
    if(track&&this.pendingRestart&&this.__cdsTakerWait===w&&finite(this.dead)>0){
      var dx=finite(w.x)-px,dy=finite(w.y)-py,L=Math.hypot(dx,dy);
      var step=Math.max(.01,finite(w.taker.maxSpd,7)*.92*h),s=Math.min(step,L);
      if(L>.0001){w.taker.x=px+dx/L*s;w.taker.y=py+dy/L*s;w.taker.vx=dx/L*step/h;w.taker.vy=dy/L*step/h;}
      else{w.taker.x=w.x;w.taker.y=w.y;w.taker.vx=0;w.taker.vy=0;}
    }
  }catch(_){}
  return r;
};
root.CDS_OS77_COMMON_FOUL=Object.freeze({version:'OS-77',arrivalRadius:0.75,opponentGuard:true,teleport:false,pendingRestartReplaced:false});
})(typeof window!=='undefined'?window:globalThis);
