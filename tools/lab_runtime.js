'use strict';
const fs=require('fs');
const path=require('path');
const {performance}=require('perf_hooks');

function createRuntime(root){
  const sandbox=globalThis;
  sandbox.window=sandbox;
  sandbox.performance=performance;
  sandbox.CanvasRenderingContext2D=undefined;
  sandbox.__cdsDebugWarn=()=>{};
  sandbox.__cdsDebugLog=()=>{};
  const mods=[
    'src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js',
    'src/scripts/25-data-integrity-v3.js','src/scripts/30-tactics.js','src/scripts/40-match-engine-and-manager-ai.js'
  ];
  // CDS_LAB_PHASE47=1 inclui a camada 5.0.0 (Fases 4-7) na simulação — permite
  // medir o motor 4.3.2 puro e o 5.0.0 na MESMA matriz de confrontos.
  if(process.env.CDS_LAB_PHASE47==='1')mods.push('src/scripts/45-phases-4-to-7.js');
  for(const rel of mods){
    const code=fs.readFileSync(path.join(root,rel),'utf8');
    new Function('window','globalThis','module','require','console','performance','CanvasRenderingContext2D',
      code+'\n//# sourceURL='+rel)(sandbox,sandbox,undefined,undefined,console,performance,undefined);
  }
  const db=sandbox.buildDB(sandbox.DATA);

  function teamFromSpec(spec){
    const source=db.squads[spec.squadIndex];
    if(!source)throw new Error('squadIndex inválido: '+spec.squadIndex);
    const squad=structuredClone(source);
    const form=spec.form||'4-3-3';
    const variation=Number.isInteger(spec.variation)?spec.variation:0;
    const line=sandbox.autoLineup(squad,form,variation);
    return {squad,name:squad.c,flag:squad.f||'',color:'#fff',lineup:line.lineup,bench:line.bench,
      style:spec.style||'balanced',axes:Object.assign({},sandbox.STYLE_AXES[spec.style||'balanced']),
      atkForm:spec.atkForm||form,defForm:spec.defForm||form,varIdx:variation};
  }
  function avgStamina(team){const active=team.players.filter(p=>!p.red);return active.length?active.reduce((s,p)=>s+p.stamina,0)/active.length:0;}
  function runJob(job){
    sandbox.srand(job.seed>>>0);
    const eventCounts=Object.create(null),goalMinutes=[];
    let sim;
    sim=new sandbox.MatchSim(teamFromSpec(job.a),teamFromSpec(job.b),{
      neutral:job.neutral!==false,knockout:!!job.knockout,labMode:true,
      onEvent:ev=>{eventCounts[ev.type]=(eventCounts[ev.type]||0)+1;if(ev.type==='goal')goalMinutes.push(ev.minute==null?Math.floor(sim.minute):ev.minute);}
    });
    sim.setInteractive(-1);
    let steps=0;const dt=job.dt||(1/30);
    const maxSteps=Math.ceil(125/(sandbox.ENGINE_CALIBRATION.timing.clockRate*dt))+15000;
    while(!sim.isOver()&&steps++<maxSteps)sim.step(dt);
    if(!sim.isOver())throw new Error(`Partida não terminou: ${job.id}, minuto=${sim.minute}, steps=${steps}`);
    const s0=sim.stats[0],s1=sim.stats[1],possTotal=(s0.possTime||0)+(s1.possTime||0)||1;
    const scoreA=sim.score[0],scoreB=sim.score[1],totalGoals=scoreA+scoreB,totalShots=s0.shots+s1.shots,totalPasses=s0.passes+s1.passes,totalPassOk=s0.passOk+s1.passOk;
    return {id:job.id,suite:job.suite,group:job.group||job.suite,seed:job.seed,meta:job.meta||{},
      teams:[{squadIndex:job.a.squadIndex,name:sim.teams[0].name,rating:sim.teams[0].squad.r,style:job.a.style,form:job.a.form,variation:job.a.variation||0},{squadIndex:job.b.squadIndex,name:sim.teams[1].name,rating:sim.teams[1].squad.r,style:job.b.style,form:job.b.form,variation:job.b.variation||0}],
      score:[scoreA,scoreB],goals:totalGoals,shots:totalShots,onTarget:s0.onTarget+s1.onTarget,xg:s0.xg+s1.xg,passes:totalPasses,passOk:totalPassOk,
      possession:[(s0.possTime||0)/possTotal,(s1.possTime||0)/possTotal],fouls:s0.fouls+s1.fouls,yellow:s0.yellow+s1.yellow,red:s0.red+s1.red,
      corners:s0.corners+s1.corners,tackles:s0.tackles+s1.tackles,interceptions:s0.interceptions+s1.interceptions,
      crosses:[s0.crosses,s1.crosses],lowCrosses:[s0.lowCrosses,s1.lowCrosses],throughBalls:[s0.throughBalls,s1.throughBalls],pressWins:[s0.pressWins,s1.pressWins],defErrors:[s0.defErrors,s1.defErrors],oneOnOnes:[s0.oneOnOnes,s1.oneOnOnes],
      setPieceShots:s0.setPieceShots+s1.setPieceShots,setPieceGoals:s0.setPieceGoals+s1.setPieceGoals,goalMinutes,
      stamina:[avgStamina(sim.teams[0]),avgStamina(sim.teams[1])],
      teamStats:[s0,s1].map((s,side)=>({goals:s.goals,shots:s.shots,onTarget:s.onTarget,xg:s.xg,passes:s.passes,passOk:s.passOk,fouls:s.fouls,yellow:s.yellow,red:s.red,corners:s.corners,tackles:s.tackles,interceptions:s.interceptions,crosses:s.crosses,lowCrosses:s.lowCrosses,lowCrossesOk:s.lowCrossesOk,throughBalls:s.throughBalls,throughOk:s.throughOk,pressWins:s.pressWins,defErrors:s.defErrors,oneOnOnes:s.oneOnOnes,setPieceShots:s.setPieceShots,setPieceGoals:s.setPieceGoals,poss:(s.possTime||0)/possTotal,stamina:side===0?avgStamina(sim.teams[0]):avgStamina(sim.teams[1])})),
      eventCounts,steps,dt};
  }
  return {sandbox,db,runJob};
}
module.exports={createRuntime};
