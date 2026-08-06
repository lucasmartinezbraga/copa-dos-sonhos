
/* R18.11 — segundas bolas com atributos vivos.
   A chegada continua 100% física. Antecipação, posicionamento e decisão só
   influenciam o controle e a primeira ação depois de um contato real, sob
   pressão e com bola suficientemente rápida. */
(function(root){'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype,V='5.9.8-R18.11';
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const attr=(p,k,f=65)=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];const x=root.getAttr&&root.getAttr(q,k);if(Number.isFinite(x))return x;}catch(_){}return f;};
const secondBallIQ=p=>attr(p,'antecipacao')*.34+attr(p,'posicionamento')*.25+attr(p,'decisao')*.16+attr(p,'agilidade')*.11+attr(p,'aceleracao')*.08+attr(p,'determinacao')*.06;
const stats=s=>s.__r1811Stats||(s.__r1811Stats={contacts:0,pressured:0,extremeProfiles:0,active:0,firstActionsArmed:0,settleDelta:0,pressureTotal:0,incomingSpeedTotal:0});
function pressureAt(sim,p){
  let nd=99;try{const foes=sim.teams&&sim.teams[1-p.team]&&sim.teams[1-p.team].players||[];for(const q of foes){if(!q||q.red)continue;const d=Math.hypot(finite(q.x)-finite(p.x),finite(q.y)-finite(p.y));if(d<nd)nd=d;}if(sim._actionContext)return finite(sim._actionContext(p,nd,'control').pressure);}catch(_){}
  return clamp((6-nd)/5,0,1);
}
P._r1811AfterSecondBallControl=function(p,contact){
  const st=stats(this);st.contacts++;
  if(!p||p.red||!this.ball||this.ball.owner!==p)return null;
  const iq=secondBallIQ(p),diff=iq-75,pressure=pressureAt(this,p),incoming=finite(contact&&contact.incomingSpeed);
  st.pressureTotal+=pressure;st.incomingSpeedTotal+=incoming;if(pressure>.52)st.pressured++;if(Math.abs(diff)>=10.0)st.extremeProfiles++;
  const active=Math.abs(diff)>=10.0&&pressure>.52&&incoming>=3.5;
  const profile={version:V,secondBallIQ:iq,differenceFromBaseline:diff,pressure,incomingSpeed:incoming,active,settleMultiplier:1,firstActionTemperatureMultiplier:1};
  if(!active){p._r1811SecondBallMeta=profile;return profile;}
  const settleMultiplier=clamp(1-diff*.0012,.976,1.024);
  const firstActionTemperatureMultiplier=clamp(1-diff*.0014,.975,1.025);
  const before=finite(p.settle);
  p.settle=Math.max(.04,before*settleMultiplier);
  profile.settleMultiplier=settleMultiplier;profile.firstActionTemperatureMultiplier=firstActionTemperatureMultiplier;profile.settleBefore=before;profile.settleAfter=p.settle;
  // Reutiliza a camada autoritativa R18.10 de primeira ação; só quase-empates
  // decisórios recebem a temperatura individual.
  p._r1810Reception=Object.assign({},p._r1810Reception||{},{activeFirstAction:true,pressure,firstActionTemperatureMultiplier,incomingDifficulty:clamp(incoming/24,0,1),secondBall:true,receptionIQ:iq});
  p._r1810FirstActionUntil=finite(this.t)+.80;
  p._r1811SecondBallMeta=profile;
  st.active++;st.firstActionsArmed++;st.settleDelta+=p.settle-before;
  return profile;
};
P.getSecondBallIntelligenceProfile=function(p){const iq=secondBallIQ(p),d=iq-75;return{version:V,secondBallIQ:iq,differenceFromBaseline:d,formula:{antecipacao:.34,posicionamento:.25,decisao:.16,agilidade:.11,aceleracao:.08,determinacao:.06},activation:{minAbsoluteDifference:9.5,minPressure:.52,minIncomingSpeed:3.5},effects:{settleMultiplier:clamp(1-d*.0012,.976,1.024),firstActionTemperatureMultiplier:clamp(1-d*.0014,.975,1.025)}};};
P.getSecondBallIntelligenceAudit=function(){const s=stats(this);return{version:V,stats:Object.assign({},s),rates:{pressured:s.contacts?s.pressured/s.contacts:0,extreme:s.contacts?s.extremeProfiles/s.contacts:0,active:s.contacts?s.active/s.contacts:0},means:{pressure:s.contacts?s.pressureTotal/s.contacts:0,incomingSpeed:s.contacts?s.incomingSpeedTotal/s.contacts:0,settleDelta:s.active?s.settleDelta/s.active:0},activation:{minAbsoluteDifference:9.5,minPressure:.52,minIncomingSpeed:3.5}};};
const oldAudit=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldAudit?oldAudit.apply(this,arguments):{};r.version=V;r.secondBallIntelligence=this.getSecondBallIntelligenceAudit();return r;};
root.CDS_R1811=Object.freeze({version:V,secondBallIQ,minAbsoluteDifference:9.5,minPressure:.52,minIncomingSpeed:3.5});
try{root.CDS_BUILD_ID='R18.11';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.11';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
