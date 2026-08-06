
(function(root){
  'use strict';
  const M=root&&root.MatchSim;if(!M||!M.prototype||M.prototype.__CDS_R1817_META__)return;
  const P=M.prototype;Object.defineProperty(P,'__CDS_R1817_META__',{value:true});
  const oldReset=P.reset;P.reset=function(){const r=oldReset.apply(this,arguments);this.__r1817={version:'R18.17',choices:{placed:0,power:0,chip:0,first_time:0,balanced:0},fitSum:0,total:0};return r;};
  const oldEmit=P._emit;P._emit=function(kind,data){
    if(kind==='finish_choice'){const s=this.__r1817||(this.__r1817={version:'R18.17',choices:{placed:0,power:0,chip:0,first_time:0,balanced:0},fitSum:0,total:0});const k=data&&data.type||'balanced';s.choices[k]=(s.choices[k]||0)+1;s.fitSum+=Number(data&&data.fit)||0;s.total++;}
    return oldEmit.apply(this,arguments);
  };
  P.getR1817Audit=function(){const s=this.__r1817||{version:'R18.17',choices:{},fitSum:0,total:0};return {version:s.version,total:s.total,choices:Object.assign({},s.choices),meanFit:s.total?+(s.fitSum/s.total).toFixed(3):0,structural:this.getR12Audit?this.getR12Audit().status:null,observer:this.getR13Audit?this.getR13Audit().status:null};};
  root.CDS_R1817=Object.freeze({version:'R18.17',feature:'CONTEXTUAL_FINISH_SELECTION',profiles:Object.freeze(['placed','power','chip','first_time','balanced']),rng:'NO_EXTRA_RNG_FOR_SELECTION',resolution:'USES_EXISTING_PHYSICAL_SHOT_PIPELINE'});
  try{document.title='Copa dos Sonhos — R18.17';}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
