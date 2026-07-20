#!/usr/bin/env node
'use strict';
process.env.CDS_LAB_PHASE10='1';
const assert=require('assert');
const path=require('path');
const {createRuntime}=require('../tools/lab_runtime.js');

function run(baseSeed){
  const rt=createRuntime(path.resolve(__dirname,'..'));
  const sb=rt.sandbox,db=rt.db,P=sb.CDS_PHASE10;
  const sa=structuredClone(db.squads[312]), sbq=structuredClone(db.squads[288]);
  const la=sb.autoLineup(sa,'4-3-3',0), lb=sb.autoLineup(sbq,'4-3-3',0);
  const raw=(sq,l)=>({squad:sq,name:sq.c,flag:sq.f||'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:Object.assign({},sb.STYLE_AXES.balanced)});
  const rawA=raw(sa,la),rawB=raw(sbq,lb);
  const cup={playerSid:sa.sid,phase:'groups',round:0,groups:[{name:'A',teams:[sa.sid,sbq.sid]}],results:{A:[]}};
  P.ensureCup(cup,{byId:{[sa.sid]:sa,[sbq.sid]:sbq}});
  const choices=['recovery','tactical','defensive'];
  const scores=[];
  for(let i=0;i<3;i++){
    cup.phase=i<2?'groups':'r16';
    P.choosePreparation(cup,sa.sid,choices[i],rawA.lineup,rawA);
    const A=P.prepareTeam(cup,rawA,sa.sid,{user:true,stage:cup.phase});
    const B=P.prepareTeam(cup,rawB,sbq.sid,{user:false,stage:cup.phase});
    sb.srand((baseSeed+i)>>>0);
    const sim=new sb.MatchSim(A,B,{neutral:true,knockout:cup.phase!=='groups'});sim.setInteractive(-1);
    let steps=0;while(!sim.isOver()&&steps++<500000)sim.step(1/60);
    assert(sim.isOver(),'partida da cadeia não terminou');
    P.recordSimulation(cup,sim,[A,B],{stage:cup.phase});
    scores.push(sim.score.slice());
  }
  const ta=P.ensureTeam(cup,sa.sid),tb=P.ensureTeam(cup,sbq.sid);
  const ov=P.teamOverview(cup,sa.sid,sa);
  return {scores,persistence:cup.persistence,userMatches:ta.matches,aiMatches:tb.matches,userPrep:ta.preparationHistory.map(x=>x.choice),aiPrep:tb.preparationHistory.map(x=>x.choice),avg:ov.averageCondition,appearances:ov.players.reduce((s,x)=>s+x.state.appearances,0),pressure:ta.knockoutPressure};
}
const a=run(533000),b=run(533000);
assert.deepEqual(a,b,'cadeia de Copa não é determinística');
assert.equal(a.userMatches,3);assert.equal(a.aiMatches,3);
assert.deepEqual(a.userPrep,['recovery','tactical','defensive']);
assert.equal(a.aiPrep.length,3);assert(a.avg>=35&&a.avg<100);
assert(a.appearances>=33,'participações não persistiram');
assert(a.pressure>0,'pressão do mata-mata não persistiu');
console.log(JSON.stringify({ok:true,scores:a.scores,userMatches:a.userMatches,aiMatches:a.aiMatches,userPrep:a.userPrep,aiPrep:a.aiPrep,averageCondition:a.avg,appearances:a.appearances,knockoutPressure:a.pressure},null,2));
