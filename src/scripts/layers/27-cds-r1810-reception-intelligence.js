
/* R18.10 — domínio, recepção e primeira ação sob pressão.
   A qualidade individual atua antes da ação seguinte: interpreta velocidade de
   chegada, resiste à pressão e estabiliza o primeiro toque sem alterar a física
   do passe nem dar posse sem contato. O jogador médio permanece perto da R18.9. */
(function(root){'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype,V='5.9.7-R18.10';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const attr=(p,k,f=65)=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];const x=root.getAttr&&root.getAttr(q,k);if(Number.isFinite(x))return x;}catch(_){}return f;};
const technicalBase=p=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3.tecnica))return q.attributesV3.tecnica;if(q&&q.a8&&Number.isFinite(Number(q.a8[7])))return Number(q.a8[7]);}catch(_){}return attr(p,'conducao')*.55+attr(p,'passe')*.25+attr(p,'drible')*.20;};
const receptionIQ=p=>attr(p,'conducao')*.30+technicalBase(p)*.24+attr(p,'compostura')*.18+attr(p,'agilidade')*.10+attr(p,'antecipacao')*.10+attr(p,'decisao')*.08;
const pressureIQ=p=>attr(p,'compostura')*.34+technicalBase(p)*.22+attr(p,'conducao')*.19+attr(p,'antecipacao')*.10+attr(p,'agilidade')*.08+attr(p,'decisao')*.07;
function incoming(sim){
  const permit=sim&&sim.__p04ContactPermit,iv=permit&&permit.contact&&permit.contact.incomingVelocity;
  if(iv)return Math.hypot(finite(iv.x),finite(iv.y),finite(iv.z));
  const b=sim&&sim.ball;return b?Math.hypot(finite(b.vx),finite(b.vy),finite(b.vz)):0;
}
P.getReceptionIntelligenceProfile=function(p,ctx){
  const iq=receptionIQ(p),piq=pressureIQ(p),q=clamp((iq-50)/45,0,1),pq=clamp((piq-50)/45,0,1),speed=incoming(this),difficulty=clamp((speed-10)/20,0,.70);
  const pressure=ctx?finite(ctx.pressure):0,composite=iq*.58+piq*.42;
  const activeReception=Math.abs(iq-75)>=15&&pressure>.55&&difficulty>.35;
  const activeFirstAction=Math.abs(composite-75)>=12&&pressure>.50;
  return{version:V,receptionIQ:iq,pressureIQ:piq,quality:q,pressureQuality:pq,incomingSpeed:speed,incomingDifficulty:difficulty,activeReception,activeFirstAction,
    controlDelta:0,pressureMultiplier:1,
    settleMultiplier:activeReception?clamp(1+(75-iq)*.0015,.975,1.025):1,firstActionTemperatureMultiplier:activeFirstAction?clamp(1+(75-composite)*.0023,.965,1.035):1,
    pressure,
    formula:{reception:{conducao:.30,tecnica:.24,compostura:.18,agilidade:.10,antecipacao:.10,decisao:.08},pressure:{compostura:.34,tecnica:.22,conducao:.19,antecipacao:.10,agilidade:.08,decisao:.07}}};
};
P.getFirstActionDecisionTemperature=function(p,gap,base){
  const r=p&&p._r1810Reception,active=!!(p&&p._r1810FirstActionUntil>finite(this.t)&&r&&r.activeFirstAction&&finite(gap,99)<.018);
  if(!active)return base;
  const st=this.__r1810ReceptionStats||(this.__r1810ReceptionStats={receptions:0,pressured:0,attributeReceptions:0,poorTouches:0,looseTouches:0,settleTotal:0,firstActions:0,firstActionTemperatureAdjustments:0,firstActionPressureTotal:0});
  st.firstActionTemperatureAdjustments++;st.firstActionPressureTotal+=finite(r.pressure);
  return clamp(base*finite(r.firstActionTemperatureMultiplier,1),.040,.082);
};
const oldDecide=P._decide;
P._decide=function(p){
  const first=!!(p&&p._r1810FirstActionUntil>finite(this.t)&&p._r1810Reception);
  const result=oldDecide.apply(this,arguments);
  if(first){const st=this.__r1810ReceptionStats||(this.__r1810ReceptionStats={receptions:0,pressured:0,attributeReceptions:0,poorTouches:0,looseTouches:0,settleTotal:0,firstActions:0,firstActionTemperatureAdjustments:0,firstActionPressureTotal:0});st.firstActions++;p._r1810FirstActionUntil=0;}
  return result;
};
P.getReceptionIntelligenceAudit=function(){const s=this.__r1810ReceptionStats||{};return{version:V,receptions:finite(s.receptions),pressured:finite(s.pressured),pressureRate:s.receptions?s.pressured/s.receptions:0,attributeReceptions:finite(s.attributeReceptions),attributeReceptionRate:s.receptions?s.attributeReceptions/s.receptions:0,poorTouches:finite(s.poorTouches),poorTouchRate:s.receptions?s.poorTouches/s.receptions:0,looseTouches:finite(s.looseTouches),looseTouchRate:s.receptions?s.looseTouches/s.receptions:0,meanSettle:s.receptions?s.settleTotal/s.receptions:0,firstActions:finite(s.firstActions),firstActionTemperatureAdjustments:finite(s.firstActionTemperatureAdjustments),meanAdjustedPressure:s.firstActionTemperatureAdjustments?s.firstActionPressureTotal/s.firstActionTemperatureAdjustments:0};};
const oldAudit=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldAudit?oldAudit.apply(this,arguments):{};r.version=V;r.receptionIntelligence=this.getReceptionIntelligenceAudit();return r;};
root.CDS_R1810=Object.freeze({version:V,receptionIQ,pressureIQ,technicalBase,physicalIncomingDifficulty:true,firstActionUnderPressure:true});
try{root.CDS_BUILD_ID='R18.10';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.10';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
