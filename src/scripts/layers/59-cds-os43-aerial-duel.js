
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS43__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS43__',{value:true});}catch(_){P.__CDS_OS43__=true;}
var RAIO=20, ALC=3.2;
var oldST=P._startTravel;
if(typeof oldST!=='function')return;

function fwd(p){var s=p&&(p.oopPos||p.slotPos);return s==='ST'||s==='CF'||s==='LW'||s==='RW'||s==='SS';}
function cl(v,a,b){return v<a?a:(v>b?b:v);}
function fac(p,k){try{return root.facet?root.facet(p,k):55;}catch(_){return 55;}}

P._startTravel=function(o,target,kind,cb,receiver,style,meta){
  try{
    if(kind!=='shot'&&o&&target&&typeof cb==='function'&&!this.__os43In&&!(this.dead>0)){
      var def=this.teams[1-o.team], g=def&&def.goal;
      var b=this.ball;
      if(g&&b){
        var tx=Number(target.x), ty=Number(target.y);
        var fx=Number(b.x), fy=Number(b.y);
        if(isFinite(tx)&&isFinite(ty)&&isFinite(fx)&&isFinite(fy)){
          var dq=Math.hypot(tx-g.x,ty-g.y), dOr=Math.hypot(fx-g.x,fy-g.y);
          if(dq<=RAIO&&dOr>dq+6&&Math.hypot(tx-fx,ty-fy)>=8){
            var sim=this;
            var envolto=function(){
              try{
                var bb=sim.ball, px=Number(bb.x), py=Number(bb.y);
                if(!isFinite(px))return cb.apply(this,arguments);
                var melhorD=null,dd=1e9,i,q;
                for(i=0;i<def.players.length;i++){
                  q=def.players[i];
                  if(!q||q.red||q.isGK||fwd(q))continue;
                  var e=Math.hypot(q.x-px,q.y-py); if(e<dd){dd=e;melhorD=q;}
                }
                var atkT=sim.teams[o.team], melhorA=null,da=1e9;
                for(i=0;i<atkT.players.length;i++){
                  q=atkT.players[i];
                  if(!q||q.red||q.isGK)continue;
                  var e2=Math.hypot(q.x-px,q.y-py); if(e2<da){da=e2;melhorA=q;}
                }
                if(melhorD&&dd<=ALC&&dd<=da+1.2){
                  var pd=cl(.50+(fac(melhorD,'head_def')-(melhorA?fac(melhorA,'head_atk'):55))/220
                            +cl((da-dd)*.06,-.12,.12), .20, .86);
                  if(root.chance(pd)){
                    sim._emit('header_clear',{by:melhorD,kind:'cross_duel'});
                    var vx=px-g.x, vy=py-g.y, L=Math.max(.6,Math.hypot(vx,vy));
                    var ax=px+vx/L*16+(root.R?root.R(-6,6):0), ay=py+vy/L*7+(root.R?root.R(-9,9):0);
                    sim.__os43In=true;
                    try{ sim._deflectTo(cl(ax,-3,(root.FL||105)+3), cl(ay,-3,(root.FW||68)+3), 15); }
                    finally{ sim.__os43In=false; }
                    return;
                  }
                }
              }catch(_){}
              return cb.apply(this,arguments);
            };
            return oldST.call(this,o,target,kind,envolto,receiver,style,meta);
          }
        }
      }
    }
  }catch(_){}
  return oldST.apply(this,arguments);
};
root.CDS_OS43=Object.freeze({version:'OS-43',feature:'AERIAL_DUEL_ON_CROSS',raio:RAIO,alcance:ALC});
})(typeof window!=='undefined'?window:globalThis);
