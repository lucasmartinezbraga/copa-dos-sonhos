
(function(root){
'use strict';
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS51__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS51__',{value:true});}catch(_){P.__CDS_OS51__=true;}
var JANELA=0.62, FATOR=0.46;
var dbg={driblados:0,quadros:0};

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(type==='dribble'&&data&&data.ok&&data.on&&!data.on.isGK&&!data.on.red){
      data.on.__os51Ate=(Number(this.t)||0)+JANELA;
      dbg.driblados++;
    }
  }catch(_){}
  return r;
};

var oldInt=P._integrate;
if(typeof oldInt==='function'){
  P._integrate=function(p,tx,ty,dt,freeze){
    try{
      if(p&&!p.isGK&&p.__os51Ate&&(Number(this.t)||0)<p.__os51Ate){
        /* recuperacao: o alvo e puxado para perto do corpo, entao ele anda
           menos neste quadro. Velocidade maxima e aceleracao continuam dele. */
        var _x=Number(tx),_y=Number(ty);
        if(isFinite(_x)&&isFinite(_y)){
          dbg.quadros++;
          tx=p.x+(_x-p.x)*FATOR;
          ty=p.y+(_y-p.y)*FATOR;
          return oldInt.call(this,p,tx,ty,dt,freeze);
        }
      }
    }catch(_){}
    return oldInt.apply(this,arguments);
  };
}

P.getOS51Audit=function(){return {driblados:dbg.driblados,quadrosEmRecuperacao:dbg.quadros};};
root.CDS_OS51=Object.freeze({version:'OS-51',feature:'BEATEN_DEFENDER',janela:JANELA,fator:FATOR});
})(typeof window!=='undefined'?window:globalThis);
