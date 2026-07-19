#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');global.window=global;global.performance=performance;global.CanvasRenderingContext2D=undefined;window.__cdsDebugWarn=()=>{};window.__cdsDebugLog=()=>{};
for(const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js','src/scripts/30-tactics.js','src/scripts/40-match-engine-and-manager-ai.js','src/scripts/45-phases-4-to-7.js','src/scripts/46-phase8-goalkeepers-setpieces.js'])vm.runInThisContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),{filename:rel});
const db=buildDB(DATA),forms=Object.keys(FORMATIONS),styles=['balanced','tiki','counter','press','direct','wings','park'],presets=['balanced','possession','counter','highPress','lowBlock','wings'];
const deep=x=>JSON.parse(JSON.stringify(x));
function team(s,form,varIdx,style,preset){const r=autoLineup(s,form,varIdx);return{squad:s,name:s.c,flag:'',color:'#fff',lineup:r.lineup.map(x=>Object.assign({},x,{p:deep(x.p)})),bench:r.bench.map(deep),style,instructions:preset,instructionPreset:preset,axes:Object.assign({},STYLE_AXES[style]||STYLE_AXES.balanced)}}
const rows=[];let invalid=0;
for(let g=0;g<8;g++){
  srand(81000+g*7919);
  const ia=(g*17+19)%db.squads.length,ib=(g*31+53)%db.squads.length;
  const fa=forms[g%forms.length],fb=forms[(g*3+5)%forms.length];
  const va=g%FORMATIONS[fa].variations.length,vb=(g+1)%FORMATIONS[fb].variations.length;
  const sa=styles[g%styles.length],sb=styles[(g+3)%styles.length],pa=presets[g%presets.length],pb=presets[(g+2)%presets.length];
  const sim=new MatchSim(team(db.squads[ia],fa,va,sa,pa),team(db.squads[ib],fb,vb,sb,pb),{labMode:true});
  sim.setTeamInstructions(0,pa);sim.setTeamInstructions(1,pb);sim.setInteractive(-1);
  let steps=0;while(!sim.isOver()&&steps<45000){sim.step(1/60);steps++;}
  const finite=sim.teams.flatMap(t=>t.players).every(p=>[p.x,p.y,p.stamina,p.rating].every(Number.isFinite))&&Number.isFinite(sim.ball.x)&&Number.isFinite(sim.ball.y);
  if(!finite||!sim.isOver())invalid++;
  const p8=[sim.getPhase8Data(0),sim.getPhase8Data(1)];
  rows.push({game:g+1,seed:81000+g*7919,score:sim.score,steps,finite,stats:sim.stats.map(s=>({shots:s.shots,onTarget:s.onTarget,xg:s.xg,passes:s.passes,passOk:s.passOk,corners:s.corners,fouls:s.fouls,yellow:s.yellow,red:s.red,setPieceShots:s.setPieceShots,setPieceGoals:s.setPieceGoals,gkShotsFaced:s.gkShotsFaced,gkSecureCatches:s.gkSecureCatches,gkParries:s.gkParries,reboundsConceded:s.reboundsConceded,gkSweeps:s.gkSweeps,gkSweepsFailed:s.gkSweepsFailed,gkClaimsAttempted:s.gkClaimsAttempted,gkClaimsWon:s.gkClaimsWon,gkClaimsMissed:s.gkClaimsMissed,gkPunches:s.gkPunches,gkDistributionShort:s.gkDistributionShort,gkDistributionLong:s.gkDistributionLong,gkDistributionCompleted:s.gkDistributionCompleted,gkDistributionFailed:s.gkDistributionFailed,freeKickDirect:s.freeKickDirect,freeKickCrossed:s.freeKickCrossed,freeKickShort:s.freeKickShort,cornersNearPost:s.cornersNearPost,cornersFarPost:s.cornersFarPost,cornersPenaltySpot:s.cornersPenaltySpot,cornersShort:s.cornersShort,penaltiesTaken:s.penaltiesTaken,penaltiesScored:s.penaltiesScored,penaltiesSaved:s.penaltiesSaved,penaltiesMissed:s.penaltiesMissed})),phase8:p8});
}
const sum=fn=>rows.reduce((a,r)=>a+fn(r),0),games=rows.length;
const total=(k)=>sum(r=>(r.stats[0][k]||0)+(r.stats[1][k]||0));
const goals=sum(r=>r.score[0]+r.score[1]),shots=total('shots'),passes=total('passes');
const summary={games,engineVersion:CDS_PHASE8.VERSION,fixedStep:1/60,invalidStates:invalid,
 goalsPerMatch:goals/games,shotsPerMatch:shots/games,xgPerMatch:total('xg')/games,onTargetRate:total('onTarget')/Math.max(1,shots),passCompletion:total('passOk')/Math.max(1,passes),cornersPerMatch:total('corners')/games,foulsPerMatch:total('fouls')/games,yellowsPerMatch:total('yellow')/games,redsPerMatch:total('red')/games,
 setPieceShotsPerMatch:total('setPieceShots')/games,setPieceGoalShare:goals?total('setPieceGoals')/goals:0,
 goalkeeping:{shotsFaced:total('gkShotsFaced'),secureCatches:total('gkSecureCatches'),parries:total('gkParries'),rebounds:total('reboundsConceded'),sweeps:total('gkSweeps'),sweepsFailed:total('gkSweepsFailed'),claimsAttempted:total('gkClaimsAttempted'),claimsWon:total('gkClaimsWon'),claimsMissed:total('gkClaimsMissed'),punches:total('gkPunches'),distributionShort:total('gkDistributionShort'),distributionLong:total('gkDistributionLong'),distributionCompleted:total('gkDistributionCompleted'),distributionFailed:total('gkDistributionFailed')},
 setPieces:{freeKickDirect:total('freeKickDirect'),freeKickCrossed:total('freeKickCrossed'),freeKickShort:total('freeKickShort'),cornersNearPost:total('cornersNearPost'),cornersFarPost:total('cornersFarPost'),cornersPenaltySpot:total('cornersPenaltySpot'),cornersShort:total('cornersShort'),penaltiesTaken:total('penaltiesTaken'),penaltiesScored:total('penaltiesScored'),penaltiesSaved:total('penaltiesSaved'),penaltiesMissed:total('penaltiesMissed')}};
if(invalid)throw new Error('regressão com estados inválidos: '+invalid);
if(summary.goalkeeping.secureCatches+summary.goalkeeping.parries!==summary.goalkeeping.shotsFaced)throw new Error('decomposição de defesas inconsistente');
if(summary.goalkeeping.claimsWon+summary.goalkeeping.claimsMissed+summary.goalkeeping.punches!==summary.goalkeeping.claimsAttempted)throw new Error('decomposição de saídas inconsistente');
if(summary.setPieces.penaltiesScored+summary.setPieces.penaltiesSaved+summary.setPieces.penaltiesMissed!==summary.setPieces.penaltiesTaken)throw new Error('decomposição de pênaltis inconsistente');
const dir=path.join(ROOT,'reports/phase8');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'regression8-v510.json'),JSON.stringify({summary,matches:rows},null,2));
const md=`# Regressão funcional Fase 8 — v5.1.0 (8 partidas)\n\n- Estados inválidos: **${invalid}**\n- Gols/jogo: **${summary.goalsPerMatch.toFixed(3)}**\n- Chutes/jogo: **${summary.shotsPerMatch.toFixed(3)}**\n- xG/jogo: **${summary.xgPerMatch.toFixed(3)}**\n- No alvo: **${(summary.onTargetRate*100).toFixed(1)}%**\n- Passes certos: **${(summary.passCompletion*100).toFixed(1)}%**\n- Escanteios/jogo: **${summary.cornersPerMatch.toFixed(3)}**\n- Faltas/jogo: **${summary.foulsPerMatch.toFixed(3)}**\n- Finalizações de bola parada/jogo: **${summary.setPieceShotsPerMatch.toFixed(3)}**\n- Participação de gols de bola parada: **${(summary.setPieceGoalShare*100).toFixed(1)}%**\n- Defesas enfrentadas: **${summary.goalkeeping.shotsFaced}** (${summary.goalkeeping.secureCatches} seguras, ${summary.goalkeeping.parries} espalmadas, ${summary.goalkeeping.rebounds} rebotes)\n- Saídas em profundidade: **${summary.goalkeeping.sweeps} certas / ${summary.goalkeeping.sweepsFailed} falhas**\n- Cruzamentos disputados pelo GK: **${summary.goalkeeping.claimsAttempted}** (${summary.goalkeeping.claimsWon} dominados, ${summary.goalkeeping.punches} socos, ${summary.goalkeeping.claimsMissed} erros)\n- Reposições: **${summary.goalkeeping.distributionCompleted} certas / ${summary.goalkeeping.distributionFailed} falhas**\n`;
fs.writeFileSync(path.join(dir,'regression8-v510.md'),md);console.log(JSON.stringify(summary,null,2));
