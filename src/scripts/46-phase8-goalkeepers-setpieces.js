/* Copa dos Sonhos — Fase 8 — goleiros e bolas paradas — motor 5.1.0 */
(function(root){
'use strict';
const NODE=typeof module!=='undefined'&&module.exports;
const M=root.MatchSim;
const VERSION='5.1.0';
const CORNER_ROUTINES=Object.freeze(['near_post','far_post','penalty_spot','short']);
const CORNER_DEFENCES=Object.freeze(['zonal','man','mixed']);
const FREE_KICK_ROUTINES=Object.freeze(['direct','crossed','short']);
function snapshot(sim,team){
  const side=team===1?1:0,st=sim&&sim.stats&&sim.stats[side];
  if(!st)return null;
  return {
    version:VERSION,team:side,
    goalkeeping:{
      shotsFaced:st.gkShotsFaced||0,secureCatches:st.gkSecureCatches||0,parries:st.gkParries||0,
      reboundsConceded:st.reboundsConceded||0,sweeps:st.gkSweeps||0,sweepsFailed:st.gkSweepsFailed||0,
      claimsAttempted:st.gkClaimsAttempted||0,claimsWon:st.gkClaimsWon||0,claimsMissed:st.gkClaimsMissed||0,
      punches:st.gkPunches||0,doubleCatches:st.gkDoubleCatches||0,
      distribution:{short:st.gkDistributionShort||0,long:st.gkDistributionLong||0,
        completed:st.gkDistributionCompleted||0,failed:st.gkDistributionFailed||0,
        toFullback:st.gkDistToFullback||0,toCenterBack:st.gkDistToCenterBack||0,
        toMidfield:st.gkDistToMidfield||0,toForward:st.gkDistToForward||0}
    },
    setPieces:{
      shots:st.setPieceShots||0,goals:st.setPieceGoals||0,firstContactWon:st.setPieceFirstContactWon||0,
      firstContactLost:st.setPieceFirstContactLost||0,
      corners:{nearPost:st.cornersNearPost||0,farPost:st.cornersFarPost||0,penaltySpot:st.cornersPenaltySpot||0,short:st.cornersShort||0,inswinger:st.cornersInswinger||0,outswinger:st.cornersOutswinger||0},
      cornerDefence:{zonal:st.cornerDefZonal||0,man:st.cornerDefMan||0,mixed:st.cornerDefMixed||0},
      freeKicks:{direct:st.freeKickDirect||0,crossed:st.freeKickCrossed||0,short:st.freeKickShort||0},
      penalties:{taken:st.penaltiesTaken||0,scored:st.penaltiesScored||0,saved:st.penaltiesSaved||0,missed:st.penaltiesMissed||0}
    }
  };
}
if(M&&M.prototype&&!M.prototype.__P8__){
  const Q=M.prototype;Q.__P8__=true;
  const oldState=Q.getState;
  Q.getState=function(){const out=oldState.call(this);out.engineVersion=VERSION;out.phase8=this.stats.map((_,i)=>snapshot(this,i));return out;};
  const oldAdvanced=Q.getAdvancedData;
  Q.getAdvancedData=function(team){const out=oldAdvanced?oldAdvanced.call(this,team):{};out.engineVersion=VERSION;out.phase8=snapshot(this,team);return out;};
  Q.getPhase8Data=function(team){return snapshot(this,team);};
}
const API={VERSION,CORNER_ROUTINES,CORNER_DEFENCES,FREE_KICK_ROUTINES,getMatchData:snapshot,installed:!!(M&&M.prototype&&M.prototype.__P8__)};
root.CDS_PHASE8=API;
if(NODE)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
