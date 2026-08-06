
/* R18.13.2 — tempo de bote conectado ao caminho autoritativo R12.
   Modula somente a FREQUÊNCIA da tentativa em duelos equilibrados. Não muda
   a chance técnica de sucesso, o raio de pressão, a velocidade ou a formação. */
(function(root){'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype)return;const P=M.prototype,V='5.10.2-R18.13.2';
const finite=(v,d=0)=>Number.isFinite(v)?v:d,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const attr=(p,k,f=65)=>{try{const q=p&&p.ref?p.ref:p;if(q&&q.attributesV3&&Number.isFinite(q.attributesV3[k]))return q.attributesV3[k];const x=root.getAttr&&root.getAttr(q,k);if(Number.isFinite(x))return x;}catch(_){}return f;};
const timingIQ=p=>attr(p,'antecipacao')*.30+attr(p,'decisao')*.22+attr(p,'desarme')*.20+attr(p,'agressividade')*.10+attr(p,'agilidade')*.08+attr(p,'compostura')*.06+attr(p,'posicionamento')*.04;
const stats=s=>s.__r1813Stats||(s.__r1813Stats={evaluations:0,eligible:0,active:0,positive:0,negative:0,multiplierTotal:0,attemptProbabilityTotal:0});
P._r1813TackleTimingProfile=function(defender,owner,duelP,trigger,distance,inBox){
 const iq=timingIQ(defender),diff=iq-75,balanced=duelP>=.44&&duelP<=.56,strongTrigger=trigger>=.34,close=distance<=2.90,extreme=Math.abs(diff)>=10.0;
 const eligible=!inBox&&balanced&&strongTrigger&&close&&extreme;
 const multiplier=eligible?clamp(1+diff*.00055,.992,1.008):1;
 return{version:V,timingIQ:iq,differenceFromBaseline:diff,duelProbability:duelP,trigger,distance,inBox:!!inBox,balanced,strongTrigger,close,extreme,eligible,active:eligible,multiplier};
};
P._r1813RecordEvaluation=function(profile,attemptP){const st=stats(this);st.evaluations++;if(profile.eligible){st.eligible++;st.active++;if(profile.multiplier>1)st.positive++;else if(profile.multiplier<1)st.negative++;st.multiplierTotal+=profile.multiplier;st.attemptProbabilityTotal+=finite(attemptP);}};
P.getTackleTimingProfile=function(p,duelProbability=.5,trigger=.45,distance=2.2,inBox=false){return this._r1813TackleTimingProfile(p,null,duelProbability,trigger,distance,inBox);};
P.getTackleTimingAudit=function(){const s=stats(this);return{version:V,connectedPath:'R12_P._pressAndTackle',stats:Object.assign({},s),rates:{eligible:s.evaluations?s.eligible/s.evaluations:0,positive:s.active?s.positive/s.active:0,negative:s.active?s.negative/s.active:0},means:{activeMultiplier:s.active?s.multiplierTotal/s.active:1,attemptProbability:s.active?s.attemptProbabilityTotal/s.active:0},activation:{minAbsDifference:10.0,duelRange:[.44,.56],minTrigger:.34,maxDistance:2.90,inBox:false},formula:{antecipacao:.30,decisao:.22,desarme:.20,agressividade:.10,agilidade:.08,compostura:.06,posicionamento:.04}};};
const oldAudit=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldAudit?oldAudit.apply(this,arguments):{};r.version=V;r.tackleTiming=this.getTackleTimingAudit();return r;};
root.CDS_R1813=Object.freeze({version:V,connectedPath:'R12_P._pressAndTackle',timingIQ,minAbsDifference:10.0,duelRange:[.44,.56],minTrigger:.34,maxDistance:2.90,maxEffect:.008});
try{root.CDS_BUILD_ID='R18.13.2';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.13.2';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
