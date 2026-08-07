
/* R18.15 — proteção de bola, condução e qualidade da pressão.
   A camada atua apenas na QUALIDADE de duelos equilibrados. Não muda raio de
   pressão, frequência de bote, velocidade, formação ou probabilidades globais.
   O jogador médio permanece exatamente neutro; perfis extremos ganham ou
   perdem menos de um ponto de qualidade no confronto. */
(function(root){'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype,V='5.10.6-R18.15.1';
const finite=(v,d=0)=>Number.isFinite(v)?v:d,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const attr=(p,k,f=65)=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];const x=root.getAttr&&root.getAttr(q,k);if(Number.isFinite(x))return x;}catch(_){}return f;};
const protectionIQ=p=>attr(p,'conducao')*.26+attr(p,'equilibrio')*.22+attr(p,'forca')*.18+attr(p,'compostura')*.16+attr(p,'primeiro_toque')*.10+attr(p,'decisao')*.08;
const carryIQ=p=>attr(p,'conducao')*.32+attr(p,'agilidade')*.20+attr(p,'equilibrio')*.16+attr(p,'decisao')*.14+attr(p,'aceleracao')*.10+attr(p,'compostura')*.08;
const pressureIQ=p=>attr(p,'antecipacao')*.22+attr(p,'desarme')*.20+attr(p,'agressividade')*.16+attr(p,'aceleracao')*.12+attr(p,'resistencia')*.10+attr(p,'decisao')*.10+attr(p,'trabalho_equipe')*.10;
const stats=s=>s.__r1815Stats||(s.__r1815Stats={pressureEvaluations:0,pressureEligible:0,pressureActive:0,pressurePositive:0,pressureNegative:0,pressureDeltaTotal:0,protectionDeltaTotal:0,pressureDuelProbabilityTotal:0,carryEvaluations:0,carryEligible:0,carryActive:0,carryPositive:0,carryNegative:0,carryDeltaTotal:0,carryProbabilityTotal:0});
P._r1815PressureDuelProfile=function(defender,owner,baseDuelP,distance,inBox){
 const piq=pressureIQ(defender),biq=protectionIQ(owner),pd=piq-75,bd=biq-75,balanced=baseDuelP>=.465&&baseDuelP<=.535,close=distance>=1.65&&distance<=2.75,controlled=finite(owner&&owner.settle)<=.18,poorTouch=!!(owner&&finite(owner._poorTouchUntil)>finite(this.t)),extreme=Math.abs(pd)>=16||Math.abs(bd)>=16,eligible=!inBox&&balanced&&close&&controlled&&!poorTouch&&extreme;
 const pressureDelta=eligible&&Math.abs(pd)>=16?clamp(pd*.018,-.30,.30):0,protectionDelta=eligible&&Math.abs(bd)>=16?clamp(bd*.018,-.30,.30):0;
 return{version:V,pressureIQ:piq,protectionIQ:biq,pressureDifference:pd,protectionDifference:bd,baseDuelProbability:baseDuelP,distance,inBox:!!inBox,balanced,close,controlled,poorTouch,extreme,eligible,active:eligible&&(pressureDelta!==0||protectionDelta!==0),pressureDelta,protectionDelta};
};
P._r1815CarryDuelProfile=function(owner,defender,baseProbability,distance,finalThird){
 const iq=carryIQ(owner),diff=iq-75,balanced=baseProbability>=.455&&baseProbability<=.545,close=distance>=1.35&&distance<=3.25,controlled=finite(owner&&owner.settle)<=.20,extreme=Math.abs(diff)>=16,eligible=balanced&&close&&controlled&&extreme;
 const attackDelta=eligible?clamp(diff*.018,-.30,.30):0;
 return{version:V,carryIQ:iq,differenceFromBaseline:diff,baseProbability,distance,finalThird:!!finalThird,balanced,close,controlled,extreme,eligible,active:eligible&&attackDelta!==0,attackDelta};
};
P._r1815RecordPressure=function(profile,duelProbability){const s=stats(this);s.pressureEvaluations++;if(profile.eligible)s.pressureEligible++;if(profile.active){s.pressureActive++;if(profile.pressureDelta-profile.protectionDelta>0)s.pressurePositive++;else if(profile.pressureDelta-profile.protectionDelta<0)s.pressureNegative++;s.pressureDeltaTotal+=profile.pressureDelta;s.protectionDeltaTotal+=profile.protectionDelta;s.pressureDuelProbabilityTotal+=finite(duelProbability);}};
P._r1815RecordCarry=function(profile,probability){const s=stats(this);s.carryEvaluations++;if(profile.eligible)s.carryEligible++;if(profile.active){s.carryActive++;if(profile.attackDelta>0)s.carryPositive++;else s.carryNegative++;s.carryDeltaTotal+=profile.attackDelta;s.carryProbabilityTotal+=finite(probability);}};
P.getCarryProtectionPressureProfile=function(carrier,defender,ctx){const q=ctx||{},bp=finite(q.baseProbability,.5),d=finite(q.distance,2.2);return{protectionIQ:protectionIQ(carrier),carryIQ:carryIQ(carrier),pressureIQ:pressureIQ(defender),pressure:this._r1815PressureDuelProfile(defender,carrier,bp,d,!!q.inBox),carry:this._r1815CarryDuelProfile(carrier,defender,bp,d,!!q.finalThird)};};
P.getCarryProtectionPressureAudit=function(){const s=stats(this);return{version:V,connectedPaths:['R12_P._dribble','R12_P._pressAndTackle'],stats:Object.assign({},s),rates:{pressureEligible:s.pressureEvaluations?s.pressureEligible/s.pressureEvaluations:0,pressureActive:s.pressureEvaluations?s.pressureActive/s.pressureEvaluations:0,carryEligible:s.carryEvaluations?s.carryEligible/s.carryEvaluations:0,carryActive:s.carryEvaluations?s.carryActive/s.carryEvaluations:0},means:{pressureDelta:s.pressureActive?s.pressureDeltaTotal/s.pressureActive:0,protectionDelta:s.pressureActive?s.protectionDeltaTotal/s.pressureActive:0,pressureDuelProbability:s.pressureActive?s.pressureDuelProbabilityTotal/s.pressureActive:0,carryDelta:s.carryActive?s.carryDeltaTotal/s.carryActive:0,carryProbability:s.carryActive?s.carryProbabilityTotal/s.carryActive:0},activation:{pressure:{minAbsDifference:16,duelRange:[.465,.535],distance:[1.65,2.75],controlledSettleMax:.18,inBox:false,maxDelta:.30},carry:{minAbsDifference:16,duelRange:[.455,.545],distance:[1.35,3.25],controlledSettleMax:.20,maxDelta:.30}},formula:{protection:{conducao:.26,equilibrio:.22,forca:.18,compostura:.16,primeiro_toque:.10,decisao:.08},carry:{conducao:.32,agilidade:.20,equilibrio:.16,decisao:.14,aceleracao:.10,compostura:.08},pressure:{antecipacao:.22,desarme:.20,agressividade:.16,aceleracao:.12,resistencia:.10,decisao:.10,trabalho_equipe:.10}}};};
const oldAudit=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldAudit?oldAudit.apply(this,arguments):{};r.version=V;r.carryProtectionPressure=this.getCarryProtectionPressureAudit();return r;};
root.CDS_R1815=Object.freeze({version:V,protectionIQ,carryIQ,pressureIQ,maxPressureDelta:.30,maxProtectionDelta:.30,maxCarryDelta:.30});
try{root.CDS_BUILD_ID='R18.15.1';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.15.1';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
