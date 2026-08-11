
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS39__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS39__',{value:true});}catch(_){P.__CDS_OS39__=true;}
var ALC=2.8, BASE=0.90, QUEDA=0.28;
/* D32 · `CAL` nao existe no escopo de uma camada — e do modulo do motor, que e
   uma IIFE. O acesso guardado que estava aqui (`root.CAL && ...`) NUNCA acertava:
   `window.CAL` e `undefined`, medido. Ele caia no 0.66 codificado, em silencio,
   e a calibracao ficava desconectada: mexer em restarts.shotBlockCorner no
   20-core.js nao teria efeito nenhum nesta camada.
   Hoje o padrao coincidia com o valor calibrado, entao o defeito era invisivel.
   A leitura correta e por ENGINE_CALIBRATION. O lint em tools/verify.py agora
   reprova o build se alguem reintroduzir a forma antiga. */
var _CALIB=root.ENGINE_CALIBRATION;
var CORNER_SHARE=(_CALIB&&_CALIB.restarts&&_CALIB.restarts.shotBlockCorner);
if(typeof CORNER_SHARE!=='number')CORNER_SHARE=0.66;
var oldST=P._startTravel;
if(typeof oldST!=='function')return;

function cl(v,a,b){return v<a?a:(v>b?b:v);}

P._startTravel=function(o,target,kind,cb,receiver,style,meta){
  try{
    if(kind==='shot'&&o&&target&&!this.__os39In){
      var out=meta&&meta.outcome;
      if(out!=='block'&&out!=='save'&&!(meta&&meta.actor)){
        var b=this.ball, sx=b?b.x:o.x, sy=b?b.y:o.y;
        var tx=target.x, ty=target.y;
        var dx=tx-sx, dy=ty-sy, L2=dx*dx+dy*dy;
        if(L2>4){
          var def=this.teams[1-o.team].players, best=null, bl=99, bp=null;
          for(var i=0;i<def.length;i++){
            var d=def[i]; if(!d||d.red||d.isGK)continue;
            var t=((d.x-sx)*dx+(d.y-sy)*dy)/L2;
            if(t<.12||t>.88)continue;
            var px=sx+dx*t, py=sy+dy*t, ld=Math.hypot(d.x-px,d.y-py);
            if(ld<bl){bl=ld;best=d;bp={x:px,y:py};}
          }
          if(best&&bl<=ALC&&root.chance(cl(BASE-bl*QUEDA,.08,BASE))){
            var sim=this, blocker=best;
            this.__os39In=true;
            try{
              return oldST.call(this,o,bp,'shot',function(){
                var cv=sim._physicalContactValid(blocker,2.05,sim.ball.z);
                if(!cv.ok){
                  if(sim.visualIntegrity)sim.visualIntegrity.failedContacts++;
                  sim._emit('visual_contact_failed',{kind:'block',by:blocker,distance:cv.horizontal});
                  sim._looseBall(sim.ball.x,sim.ball.y);
                  return;
                }
                sim._recordVisualContact('block',blocker,sim.ball.x,sim.ball.y,
                  {distance:cv.horizontal,z:sim.ball.z,maxZ:cv.maxZ,surface:cv.surface});
                sim._emit('blocked',{by:blocker,contact:{x:sim.ball.x,y:sim.ball.y,distance:cv.horizontal}});
                if(root.chance(CORNER_SHARE))sim._setCorner(o.team);
                else sim._looseBall(sim.ball.x,sim.ball.y);
              },null,'shot',{outcome:'block',actor:blocker,contactRadius:2.05});
            }finally{this.__os39In=false;}
          }
        }
      }
    }
  }catch(_){}
  return oldST.apply(this,arguments);
};
root.CDS_OS39=Object.freeze({version:'OS-39',feature:'BLOCK_ON_FLIGHT',alcance:ALC});
})(typeof window!=='undefined'?window:globalThis);
