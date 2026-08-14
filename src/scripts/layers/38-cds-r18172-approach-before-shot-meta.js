
(function(root){
'use strict';
const M=root&&root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_R18172__)return;
const P=M.prototype,V='5.12.3-R18.17.2-APROXIMACAO-ANTES-DO-CHUTE';
Object.defineProperty(P,'__CDS_R18172__',{value:true});
const fresh=()=>({version:'R18.17.2',deferred:0,shots:0,longShots:0,veryLongShots:0,shotDistanceSum:0,deferredDistanceSum:0,projectedGainSum:0,byReason:{improve_xg:0}});
const oldReset=P.reset;P.reset=function(){const r=oldReset.apply(this,arguments);this.__r18172=fresh();return r;};
const oldEmit=P._emit;P._emit=function(kind,data){
  const s=this.__r18172||(this.__r18172=fresh());
  if(kind==='shot_deferred'){
    s.deferred++;s.deferredDistanceSum+=Number(data&&data.dtg)||0;
    s.projectedGainSum+=Math.max(0,(Number(data&&data.dtg)||0)-(Number(data&&data.projectedDtg)||0));
    const k=data&&data.reason||'unknown';s.byReason[k]=(s.byReason[k]||0)+1;
  }else if(kind==='shot_taken'){
    const d=Number(data&&data.dtg)||0;s.shots++;s.shotDistanceSum+=d;
    if(data&&data.longshot)s.longShots++;if(d>=28)s.veryLongShots++;
  }
  return oldEmit.apply(this,arguments);
};
P.getR18172Audit=function(){const s=this.__r18172||fresh();return Object.assign({},s,{meanShotDistance:s.shots?+(s.shotDistanceSum/s.shots).toFixed(2):0,meanDeferredDistance:s.deferred?+(s.deferredDistanceSum/s.deferred).toFixed(2):0,meanProjectedAdvance:s.deferred?+(s.projectedGainSum/s.deferred).toFixed(2):0,structural:this.getR12Audit?this.getR12Audit().status:null,observer:this.getR13Audit?this.getR13Audit().status:null});};
const oldFull=P.getFullFootballAudit;P.getFullFootballAudit=function(){const r=oldFull?oldFull.apply(this,arguments):{};r.approachBeforeShot=this.getR18172Audit();return r;};
root.CDS_R18172=Object.freeze({version:V,baseline:'R18.17',feature:'APPROACH_BEFORE_LOW_VALUE_LONG_SHOT',selection:'DETERMINISTIC_NO_EXTRA_RNG',maxConsecutiveApproaches:2,preserves:['ONE_ON_ONE','FIRST_TIME','ELITE_LONG_SHOT','LATE_TRAILING_URGENCY']});
try{root.CDS_BUILD_ID='R18.17.2';root.CDS_VERSION=V;document.title='Copa dos Sonhos — R18.17.2';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
