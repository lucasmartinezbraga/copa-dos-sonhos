
(function(root){
'use strict';
if(typeof document==='undefined')return;
var M=root&&root.MatchSim;if(!M||!M.prototype||M.prototype.__OS113__)return;
var P=M.prototype;try{Object.defineProperty(P,"__OS113__",{value:true});}catch(_){P.__OS113__=true;}

var FALTAS_LIGADAS=true;
var el=null,hideT=0,ultimaFalta=null;

function node(){
  if(el&&el.isConnected)return el;
  el=document.getElementById("cds-fc");
  if(!el){el=document.createElement("div");el.id="cds-fc";document.body.appendChild(el);}
  return el;
}
function nome(p){
  try{var n=(p&&p.ref&&p.ref.n)||"";if(!n)return "Jogador";
    return String(n).trim();}catch(_){return "Jogador";}
}
function timeDe(sim,p){
  try{var t=sim&&sim.teams&&sim.teams[p.team];
    return (t&&(t.name||(t.squad&&t.squad.c)))||"";}catch(_){return "";}
}
/* a que distancia do gol que a vitima ataca -- e o que decide se a falta
   interessa ou nao */
function distGol(sim,v){
  try{var g=sim.teams[v.team].oppGoal;
    return Math.hypot(Number(v.x)-Number(g.x),Number(v.y)-Number(g.y));}catch(_){return NaN;}
}
function mostrar(classe,icone,t1,t2,ms){
  try{
    var d=node();
    d.className="on "+(classe||"");
    d.innerHTML=(classe==="am"||classe==="vm"?'<div class="cart"></div>':'<div class="ic">'+icone+'</div>')+
      '<div class="tx"><div class="t1">'+t1+'</div><div class="t2">'+t2+'</div></div>';
    d.innerHTML='<div class="bx">'+d.innerHTML+'</div>';
    clearTimeout(hideT);hideT=setTimeout(function(){try{d.className="";}catch(_){}} ,ms||2600);
  }catch(_){}
}

/* ---- narracao do feed: dizer quem, em quem, e o que acontece agora ------ */
try{
  if(FALTAS_LIGADAS&&typeof NARR!=="undefined"&&NARR){
    NARR.foul=function(e){
      var sim=root.__CDS_ACTIVE_SIM;
      var quem=nome(e.by),vit=nome(e.on);
      var t=sim?timeDe(sim,e.on):"";
      var d=sim?distGol(sim,e.on):NaN;
      var onde=isFinite(d)?(d<=30?" a "+Math.round(d)+" m do gol":""):"";
      return "Falta de <b>"+quem+"</b> em <b>"+vit+"</b>"+onde+
             (t?" — bola com "+t:"")+".";
    };
    NARR.yellow=function(e){
      var n=nome(e.p),q=(e.p&&e.p.yellow)||1;
      var vit=(ultimaFalta&&ultimaFalta.on===e.p)?null:(ultimaFalta&&ultimaFalta.on);
      return "🟨 Amarelo para <b>"+n+"</b> — falta dura"+
             (vit?" em "+nome(vit):"")+(q>=2?" (2º cartão)":"")+".";
    };
    NARR.red=function(e){
      var n=nome(e.p);
      return e.second
        ? "🟥 <b>"+n+"</b> EXPULSO — segundo amarelo. O time fica com um a menos."
        : "🟥 VERMELHO DIRETO para <b>"+n+"</b> — falta violenta. O time fica com um a menos.";
    };
  }
}catch(_){}

/* ---- o aviso na tela ---------------------------------------------------- */
var oldEmit=P._emit;
P._emit=function(type,data){
  var r=oldEmit.apply(this,arguments);
  if(!FALTAS_LIGADAS)return r;
  try{
    if(type==="foul"&&data&&data.by&&data.on){
      ultimaFalta={by:data.by,on:data.on,at:Date.now()};
      var d=distGol(this,data.on);
      /* falta longe do gol acontece 14,7 vezes por partida: avisar todas
         viraria ruido. So aparece na tela a que muda alguma coisa. */
      if(isFinite(d)&&d<=32){
        mostrar("","🟡","Falta de "+nome(data.by),
          "em "+nome(data.on)+" · "+Math.round(d)+" m do gol · bola com "+timeDe(this,data.on),1900);
      }
    } else if(type==="yellow"&&data&&data.p){
      var vy=(ultimaFalta&&Date.now()-ultimaFalta.at<1500)?ultimaFalta.on:null;
      mostrar("am","","Amarelo — "+nome(data.p),
        timeDe(this,data.p)+" · falta dura"+(vy?" em "+nome(vy):"")+
        ((data.p.yellow||1)>=2?" · 2º cartão":""),2800);
    } else if(type==="red"&&data&&data.p){
      var vr=(ultimaFalta&&Date.now()-ultimaFalta.at<1500)?ultimaFalta.on:null;
      mostrar("vm","",(data.second?"Expulso — 2º amarelo":"Vermelho direto")+" — "+nome(data.p),
        timeDe(this,data.p)+(vr?" · falta em "+nome(vr):"")+" · time com um a menos",3400);
    } else if(type==="penalty"&&data){
      var pv=data.by||data.taker;
      mostrar("","🔴","PÊNALTI",
        (pv?nome(pv)+" · ":"")+"falta dentro da área",2600);
    }
  }catch(_){}
  return r;
};
root.CDS_OS113=Object.freeze({version:"OS-113",feature:"FOUL_CARD_LEGIBILITY_AND_HUD_PLACEMENT",
  presentationOnly:true,rngConsumption:false,engineMutation:false});
})(typeof window!=='undefined'?window:globalThis);
