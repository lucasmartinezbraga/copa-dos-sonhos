
/* Copa dos Sonhos · R18.3 · Inteligência de decisão + bola natural
   Correção cirúrgica sobre a R18.0 estável:
   1) impede que erro comum de passe vire lateral absurda;
   2) antecipa somente decisões claramente dominantes;
   3) substitui arcos genéricos por perfis de voo específicos de passe/chute.
   Não consome RNG adicional: todas as variações visuais são determinísticas. */
(function installR183NaturalFootball(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype;
if(P.__CDS_R183_NATURAL_FOOTBALL__)return;
Object.defineProperty(P,'__CDS_R183_NATURAL_FOOTBALL__',{value:true});
const VERSION='5.9.7-R18.3';
const FL=Number(root.FL)||105,FW=Number(root.FW)||68,EPS=1e-7;
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b,c,d)=>Math.hypot(finite(a)-finite(c),finite(b)-finite(d));
const lerp=(a,b,t)=>a+(b-a)*t;
function hash01(){let x=0;for(let i=0;i<arguments.length;i++)x+=finite(arguments[i])*(12.9898+i*31.731);const s=Math.sin(x)*43758.5453123;return s-Math.floor(s);}
function refOf(p){return p&&p.ref?p.ref:(p||{});}
function attr(p,k,f=65){try{if(typeof root.getAttr==='function'){const v=root.getAttr(p,k);if(Number.isFinite(v))return v;}}catch(_){}const r=refOf(p),a=r.attributesV3||r.attributes||{};if(Number.isFinite(a[k]))return a[k];if(Number.isFinite(r.r))return r.r;return f;}
function diag(sim){return sim.__r181||(sim.__r181={version:VERSION,touchlineErrorsPrevented:0,touchlineErrorsAllowed:0,invalidTargetsRecovered:0,smartShotVetoes:0,decisionChecks:0,trajectoryPlans:0,shotPlans:0,passPlans:0,maxShotApex:0,maxPassApex:0});}
function activePlayer(p){return !!p&&!p.red;}
function nearestOpponent(sim,p){let best=99;const tm=sim.teams&&sim.teams[1-p.team];for(const d of tm&&tm.players||[])if(activePlayer(d))best=Math.min(best,dist(p.x,p.y,d.x,d.y));return best;}
function receiverSpace(sim,m){let best=30;const tm=sim.teams&&sim.teams[1-m.team];for(const d of tm&&tm.players||[])if(activePlayer(d))best=Math.min(best,dist(m.x,m.y,d.x,d.y));return best;}
function edgeY(y){return Math.min(finite(y,FW/2),FW-finite(y,FW/2));}
function passValue(sim,o,c){if(!c||!activePlayer(c.m))return-Infinity;const sp=receiverSpace(sim,c.m),risk=finite(c.risk,2.6),progress=finite(c.progressM,0),d=finite(c.dist,dist(o.x,o.y,c.m.x,c.m.y));let v=Number.isFinite(c.score)?c.score:(sp*.19+progress*.022-d*.018-risk*.42-.35);v+=(c.intoBox?1.05:0)+clamp(sp-3,0,8)*.055+clamp(progress,0,24)*.012-risk*.16;if(progress<-10)v-=.18;return v;}
function shotValue(sim,o,dtg,pressure){const tm=sim.teams[o.team],g=tm.oppGoal,angle=clamp(1-Math.abs(finite(o.y)-finite(g.y))/(FW*.43),.18,1),fin=attr(o,'finalizacao',70)/100,comp=attr(o,'compostura',70)/100,long=attr(o,'chute_longe',65)/100;let xg=1/(1+Math.exp((dtg-13.8)/3.8));if(dtg>20)xg*=clamp(.42+long*.52,.45,.94);xg*=angle*(.60+fin*.30+comp*.18)*(1-clamp((3.5-pressure)/3.5,0,1)*.48);return xg*3.45+(dtg<10?.16:0);}
function normalizeCandidate(c,o){if(!c||!c.m)return null;if(!Number.isFinite(c.dist))c.dist=dist(o.x,o.y,c.m.x,c.m.y);if(!Number.isFinite(c.progressM))c.progressM=0;if(!Number.isFinite(c.risk))c.risk=2.4;return c;}

/* R18.3-A · lateral só quando a geometria realmente explica a saída. */
const oldStart=P._startTravel;
P._startTravel=function(actor,target,kind,onArrive,receiver,travelKind,meta){
  let t={x:finite(target&&target.x,actor&&actor.x),y:finite(target&&target.y,actor&&actor.y)};
  if(target&&Number.isFinite(target.z))t.z=target.z;
  const m=Object.assign({},meta||{}),pk=travelKind||kind,dg=diag(this);
  if(actor&&kind==='pass'&&pk!=='throw'){
    const intended=receiver&&activePlayer(receiver)?receiver:null;
    const passD=dist(actor.x,actor.y,t.x,t.y),side=finite(actor.y,FW/2)<FW/2?-1:1;
    const outward=side<0?t.y<finite(actor.y):t.y>finite(actor.y);
    const trueEdge=Math.min(edgeY(actor.y),edgeY(t.y),intended?edgeY(intended.y):99);
    const pressure=nearestOpponent(this,actor);
    const sample=hash01(finite(this.t),actor.idx,receiver&&receiver.idx,t.x,t.y,passD);
    const naturalOutP=clamp(.035+Math.max(0,5.2-trueEdge)*.025+Math.max(0,3.2-pressure)*.018+(passD>28?.035:0),.035,.19);
    const allowExecutionOut=!!m.executionError&&trueEdge<5.2&&outward&&passD>6.5&&sample<naturalOutP;
    const allowGkOut=!!m.gkBadDistribution&&trueEdge<6.5&&outward&&sample<naturalOutP*.78;
    if(m.executionError&&!allowExecutionOut){m.executionError=false;m.naturalExecutionError=true;dg.touchlineErrorsPrevented++;}
    else if(allowExecutionOut)dg.touchlineErrorsAllowed++;
    if(m.gkBadDistribution&&!allowGkOut){m.gkBadDistribution=false;m.naturalGkDistributionError=true;dg.touchlineErrorsPrevented++;}
    else if(allowGkOut)dg.touchlineErrorsAllowed++;
    const explicitlyOut=t.x<0||t.x>FL||t.y<0||t.y>FW;
    if(explicitlyOut&&!m.clearance&&!m.r18182NaturalOut&&!allowExecutionOut&&!allowGkOut&&intended){
      t.x=clamp(t.x,.65,FL-.65);t.y=clamp(t.y,.65,FW-.65);dg.invalidTargetsRecovered++;
    }
  }
  return oldStart.call(this,actor,t,kind,onArrive,receiver,travelKind,m);
};

/* R18.3-B · inteligência sem alterar a identidade estatística.
   Não força passe nem chute. Apenas bloqueia por uma janela curta a roleta
   contextual da R12 quando existe um passe objetivamente superior, deixando
   R13 + motor-base escolherem a ação final pelo fluxo normal. */
const oldDecide=P._decide;
P._decide=function(o){
  if(!o||o.isGK||!this.ball||this.ball.owner!==o||this.__r14Pending||finite(this.dead)>0||this.pendingRestart||this.waiting)return oldDecide.apply(this,arguments);
  const tm=this.teams&&this.teams[o.team];if(!tm)return oldDecide.apply(this,arguments);
  const dg=diag(this);dg.decisionChecks++;
  let best=null,safe=null;
  try{best=normalizeCandidate(this._bestPass&&this._bestPass(o),o);}catch(_){}
  try{const opps=(this.teams[1-o.team]&&this.teams[1-o.team].players||[]).filter(activePlayer);safe=normalizeCandidate(this._safePass&&this._safePass(o,opps),o);}catch(_){}
  const candidates=[];if(best)candidates.push(best);if(safe&&(!best||safe.m!==best.m))candidates.push(safe);
  if(candidates.length){
    candidates.sort((a,b)=>passValue(this,o,b)-passValue(this,o,a));
    const pick=candidates[0],pv=passValue(this,o,pick),risk=finite(pick.risk,9),progress=finite(pick.progressM,0);
    const g=tm.oppGoal,dtg=dist(o.x,o.y,g.x,g.y),pressure=nearestOpponent(this,o),sv=shotValue(this,o,dtg,pressure);
    const iq=attr(o,'decisao',68),space=receiverSpace(this,pick.m);
    const clearChance=!!pick.intoBox&&risk<(iq>=82?2.35:2.05)&&pv>.58;
    const cleanProgress=progress>8&&risk<(iq>=82?1.75:1.48)&&space>3.4&&pv>sv+(iq>=82?.12:.22);
    const pressureOutlet=pressure<2.35&&risk<1.12&&space>2.8&&pv>sv-.02;
    const inward=edgeY(o.y)<4.9&&edgeY(pick.m.y)>edgeY(o.y)+2.4&&risk<1.8;
    if(clearChance||cleanProgress||pressureOutlet||inward){
      /* R12 só pode tentar chute contextual se t-last > 1.15. Marcar o
         instante atual veta unicamente essa roleta; o restante da cadeia
         de decisão continua intacto e ainda pode chutar pelo motor-base. */
      tm.__r122LastContextShot=Math.max(finite(tm.__r122LastContextShot,-99),finite(this.t));
      dg.smartShotVetoes=(dg.smartShotVetoes||0)+1;
    }
  }
  return oldDecide.apply(this,arguments);
};

/* R18.3-C · perfis naturais de voo. O destino e a duração permanecem os
   mesmos; muda apenas como a bola percorre o caminho, mantendo contatos e
   resultados ancorados na mesma geometria final. */
const oldPhysicalTargetZ=P._physicalTargetZ,oldPhysicalArc=P._physicalArc;
P._physicalTargetZ=function(actor,target,kind,passKind,meta){
  if(target&&Number.isFinite(target.z))return clamp(target.z,0,2.35);
  if(meta&&Number.isFinite(meta.targetZ))return clamp(meta.targetZ,0,2.35);
  const pk=passKind||kind,d=target&&actor?dist(actor.x,actor.y,target.x,target.y):18;
  if(pk==='throw')return clamp(.82+d*.018,.92,1.28);
  if(kind==='shot'){
    const base=oldPhysicalTargetZ.call(this,actor,target,kind,passKind,meta);
    return clamp(finite(base,.72),.14,1.74);
  }
  if(pk==='launch')return clamp(.34+d*.006,.38,.66);
  if(pk==='through')return .055;
  return .035;
};
P._physicalArc=function(kind,passKind,origin,target,targetZ,meta){
  if(meta&&Number.isFinite(meta.arc))return clamp(meta.arc,0,2.7);
  const pk=passKind||kind,d=dist(origin&&origin.x,origin&&origin.y,target&&target.x,target&&target.y);
  if(pk==='throw')return clamp(.72+d*.025,.82,1.24);
  if(kind==='shot'){const base=oldPhysicalArc.call(this,kind,passKind,origin,target,targetZ,meta);return clamp(finite(base,.62)*.91,.38,1.12);}
  if(pk==='launch')return clamp(.92+d*.027,1.18,2.15);
  if(pk==='through')return clamp(.045+d*.0035,.07,.15);
  return clamp(.018+d*.0012,.025,.055);
};
function flightProfile(origin,target,kind,pk){
  const d=Math.max(.01,dist(origin.x,origin.y,target.x,target.y));
  const drag=kind==='shot'?.055:pk==='launch'?.105:pk==='through'?.17:pk==='throw'?.12:.27;
  let amp=kind==='shot'?clamp((d-8)*.008,.025,.22):pk==='launch'?clamp(d*.006,.07,.30):pk==='through'?clamp(d*.0038,.045,.16):pk==='throw'?clamp(d*.004,.04,.12):clamp(d*.0017,.012,.055);
  const dx=target.x-origin.x,dy=target.y-origin.y,L=Math.max(EPS,Math.hypot(dx,dy)),nx=-dy/L,ny=dx/L;
  const sign=hash01(origin.x,origin.y,target.x,target.y,kind==='shot'?71:pk==='launch'?43:19)<.5?-1:1;
  if(kind!=='shot'&&target.y>=0&&target.y<=FW){const margin=Math.min(edgeY(origin.y),edgeY(target.y));amp*=clamp((margin-.55)/4.2,0,1);}
  return{d,drag,amp,sign,nx,ny};
}
function eased(p,k){if(k<=EPS)return p;const den=1-Math.exp(-k);return den<EPS?p:(1-Math.exp(-k*p))/den;}
function pointFor(origin,target,duration,p,kind,pk,targetZ,arc){
  const q=clamp(p,0,1),fp=flightProfile(origin,target,kind,pk),s=eased(q,fp.drag),bend=4*q*(1-q)*fp.amp*fp.sign;
  return{x:lerp(origin.x,target.x,s)+fp.nx*bend,y:lerp(origin.y,target.y,s)+fp.ny*bend,z:Math.max(0,lerp(finite(origin.z),finite(targetZ),q)+4*finite(arc)*q*(1-q)),t:duration*q};
}
const oldPlan=P._planPhysicalSegment;
P._planPhysicalSegment=function(origin,target,kind,passKind,speed,meta){
  const seg=oldPlan.apply(this,arguments),pk=passKind||kind,n=Math.max(8,Math.min(420,(seg.samples&&seg.samples.length?seg.samples.length-1:Math.ceil(seg.duration*120))));
  const raw=[];for(let i=0;i<=n;i++)raw.push(pointFor(seg.origin,seg.target,seg.duration,i/n,kind,pk,seg.target.z,seg.arc));
  const samples=raw.map((q,i)=>{const a=raw[Math.max(0,i-1)],b=raw[Math.min(raw.length-1,i+1)],dt=Math.max(.001,b.t-a.t);return{x:q.x,y:q.y,z:q.z,t:q.t,vx:(b.x-a.x)/dt,vy:(b.y-a.y)/dt,vz:(b.z-a.z)/dt};});
  const fp=flightProfile(seg.origin,seg.target,kind,pk),out={id:seg.id,kind:seg.kind,passKind:seg.passKind,duration:seg.duration,origin:seg.origin,target:seg.target,arc:seg.arc,speed:seg.speed,curve:fp.amp*fp.sign,drag:fp.drag,samples};
  const dg=diag(this);dg.trajectoryPlans++;if(kind==='shot'){dg.shotPlans++;dg.maxShotApex=Math.max(dg.maxShotApex,...samples.map(s=>s.z));}else{dg.passPlans++;dg.maxPassApex=Math.max(dg.maxPassApex,...samples.map(s=>s.z));}
  return out;
};
P._trajectoryPoint=function(origin,target,speed,p,kind,passKind,targetZ,arc){const d=Math.max(.01,dist(origin.x,origin.y,target.x,target.y)),duration=d/Math.max(8,finite(speed,28));return Object.assign(pointFor(origin,target,duration,p,kind,passKind||kind,targetZ,arc),{duration});};

P.getR183Report=function(){return Object.assign({},diag(this));};
root.CDS_R183_NATURAL_FOOTBALL=Object.freeze({version:VERSION,installed:true,principles:['touchline_geometry','dominant_action_veto','typed_ball_flight']});
try{root.CDS_BUILD_VERSION=VERSION;if(typeof document!=='undefined')document.title='Copa dos Sonhos — R18.3';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);

