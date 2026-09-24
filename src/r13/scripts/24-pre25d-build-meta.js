
(function(root){
'use strict';
root.CDS_PRE25D_BUILD=Object.freeze({
  version:'5.8.7-R9',
  baseExpected:'5.8.2',
  p04:'5.8.7-R9',
  contracts:'0.2.0',
  auditor:'0.4.0',
  status:'CANDIDATE_FOR_EXTENDED_REGRESSION',
  p06Executed:false,
  createdAt:'2026-07-20'
});
function check(){
  const rows={
    matchSim:!!root.MatchSim,
    p04:!!(root.CDS_P04&&root.CDS_P04.version==='5.8.7-R9'),
    contracts:!!(root.CDS_25D_CONTRACTS&&root.CDS_25D_CONTRACTS.version==='0.2.0'),
    auditor:!!(root.CDS_PRE25D_AUDITOR&&root.CDS_PRE25D_AUDITOR.version==='0.4.0'),
    timelineBridge:!!root.__CDS_TIMELINE_BRIDGE_582__
  };
  rows.ok=rows.matchSim&&rows.p04&&rows.contracts&&rows.auditor;
  root.__CDS_PRE25D_SELF_CHECK=Object.freeze(rows);
  if(!rows.ok&&root.console)console.error('[CDS PRE-2.5D] self-check failed',rows);
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check);
  else setTimeout(check,0);
}
})(typeof window!=='undefined'?window:globalThis);
