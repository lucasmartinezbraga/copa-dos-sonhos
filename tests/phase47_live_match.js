#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');global.window=global;global.performance=performance;global.CanvasRenderingContext2D=undefined;
window.__cdsDebugWarn=()=>{};window.__cdsDebugLog=()=>{};
for(const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js','src/scripts/30-tactics.js','src/scripts/40-match-engine-and-manager-ai.js','src/scripts/45-phases-4-to-7.js']){
 vm.runInThisContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),{filename:rel});
}
const db=buildDB(DATA);
const pick=(s,preset)=>{const r=autoLineup(s,'4-3-3',0);return {squad:s,name:s.c,flag:'',color:'#fff',lineup:r.lineup,bench:r.bench,style:'balanced',instructionPreset:preset,instructions:preset,axes:Object.assign({},STYLE_AXES.balanced)};};
const a=db.squads.find(s=>s.sid===19)||db.squads[0],b=db.squads.find(s=>s.sid===353)||db.squads[1];
const sim=new MatchSim(pick(a,'possession'),pick(b,'counter'),{});
sim.setTeamInstructions(0,'possession'); sim.setTeamInstructions(1,'counter');
const first=sim.teams[0].players.find(p=>!p.isGK);
sim.setPlayerPhaseRole(0,first.idx,{inPossession:{role:'inside_forward',duty:'attack'},outOfPossession:{role:'track_wide',duty:'defend'}});
let steps=0; while(!sim.isOver() && steps<40000){sim.step(1/60);steps++;}
const adv=sim.getAdvancedData(0).phase47;
const all=sim.teams.flatMap(t=>t.players);
if(!sim.isOver()) throw new Error('Partida não terminou');
if(all.some(p=>![p.x,p.y,p.stamina,p.rating].every(Number.isFinite))) throw new Error('Estado numérico inválido');
if(!adv || adv.engineVersion){}
if(adv.decisionQuality.count<1) throw new Error('Sem decisões registradas');
if(adv.spatial.samples<1) throw new Error('Sem amostras espaciais');
if(adv.spatial.corridorOccupancy.reduce((a,b)=>a+b,0)<1) throw new Error('Sem ocupação de corredores');
if(CDS_PHASES_4_7.VERSION!=='5.0.0') throw new Error('API incorreta');
console.log(JSON.stringify({ok:true,version:CDS_PHASES_4_7.VERSION,steps,score:sim.score,minute:sim.minute,coherence:sim.getTacticalCoherence(0),decisions:adv.decisionQuality,spatial:adv.spatial,role:first.phaseRole,stats:sim.stats.map(s=>({shots:s.shots,xg:+s.xg.toFixed(2),passes:s.passes,clumpCorrections:s.clumpCorrections}))},null,2));
