
(function(root){
'use strict';
if(typeof document==='undefined')return;
var M=root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_OS20__)return;
var P=M.prototype;try{Object.defineProperty(P,'__CDS_OS20__',{value:true});}catch(_){P.__CDS_OS20__=true;}

var el=null,hideT=0,liveKind=null,liveTeam=null,liveUntil=0;
function node(){
  if(el&&el.isConnected)return el;
  el=document.getElementById('cds-sp');
  if(!el){el=document.createElement('div');el.id='cds-sp';document.body.appendChild(el);}
  return el;
}
function nome(p){
  try{
    var n=(p&&p.ref&&p.ref.n)||'';
    if(!n)return 'Cobrador';
    if(typeof root.lastWord==='function')return root.lastWord(n,16);
    var q=String(n).trim().split(' ');return q[q.length-1].toUpperCase();
  }catch(_){return 'Cobrador';}
}
var ROT={direct:'Cobrança direta',crossed:'Na área',short:'Jogada ensaiada'};
function mostrar(kind,titulo,jogador,sub,dur){
  try{
    var d=node();
    d.className='on';
    d.innerHTML='<div class="cd"><div class="kd"><i></i>'+titulo+'</div>'+
      '<div class="nm">'+jogador+'</div>'+
      (sub?'<div class="sb">'+sub+'</div>':'')+
      '<div class="br"><i style="animation-duration:'+(dur/1000).toFixed(2)+'s"></i></div>'+
      '<div class="rs"></div></div>';
    liveKind=kind;liveUntil=Date.now()+dur+2600;
    clearTimeout(hideT);hideT=setTimeout(esconder,dur+2600);
  }catch(_){}
}
function desfecho(txt,bom){
  try{
    if(!liveKind||Date.now()>liveUntil)return;
    var d=node(),r=d.querySelector('.rs');if(!r)return;
    r.textContent=txt;d.className='on '+(bom?'ok':'no');
    liveKind=null;
    clearTimeout(hideT);hideT=setTimeout(esconder,1500);
  }catch(_){}
}
function esconder(){try{if(el)el.className='';liveKind=null;}catch(_){}}

var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  try{
    if(type==='freekick_routine'&&data){
      var dist=Number(data.dist);
      mostrar('fk','⚽ Falta — '+(ROT[data.routine]||'cobrança'),nome(data.by),
        (isFinite(dist)?Math.round(dist)+' m do gol':'')+
        (data.routine==='direct'?' · barreira armada':''),2100);
      liveTeam=data.team;
    } else if(type==='penalty'&&data){
      var t=(data.team!=null?data.team:(data.by&&data.by.team));
      mostrar('pk','🎯 Pênalti',nome(data.by||data.taker),'Marca da cal · 11 m',2600);
      liveTeam=t;
    } else if(type==='goal'){
      if(liveKind)desfecho(liveKind==='pk'?'GOL — PÊNALTI CONVERTIDO':'GOL — DE FALTA!',true);
    } else if(type==='save'){
      if(liveKind)desfecho('O GOLEIRO DEFENDEU',false);
    } else if(type==='post'){
      if(liveKind)desfecho('NA TRAVE',false);
    } else if(type==='blocked'){
      if(liveKind==='fk')desfecho('NA BARREIRA',false);
    } else if(type==='miss'){
      if(liveKind)desfecho('PRA FORA',false);
    } else if(type==='kickoff'||type==='half_time'){ esconder(); }
  }catch(_){}
  return r;
};
root.CDS_OS20=Object.freeze({version:'OS-20',feature:'SET_PIECE_HUD',presentationOnly:true,
  rngConsumption:false,engineMutation:false});
})(typeof window!=='undefined'?window:globalThis);
