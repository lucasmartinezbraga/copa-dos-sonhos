#!/usr/bin/env node
'use strict';
const fs=require('fs');
const vm=require('vm');
const crypto=require('crypto');
const BUILD=process.argv[2]||'COPA_DOS_SONHOS_R13.0_FINAL.html';
const OUT=process.argv[3]||'R13.0_CENARIOS_DIRIGIDOS.json';
function noop(){}
function def(name,value){try{Object.defineProperty(global,name,{value,writable:true,configurable:true});}catch(_){global[name]=value;}}
def('window',global);def('self',global);def('navigator',{userAgent:'r13-directed-tests',language:'pt-BR'});
def('location',{href:'runner://r13-tests',search:'',hash:''});def('performance',{now:()=>0});
def('crypto',crypto.webcrypto);def('requestAnimationFrame',()=>0);def('cancelAnimationFrame',noop);
def('addEventListener',noop);def('removeEventListener',noop);def('matchMedia',()=>({matches:false,addEventListener:noop,removeEventListener:noop}));
def('alert',noop);def('confirm',()=>true);def('prompt',()=>null);
def('localStorage',{getItem:()=>null,setItem:noop,removeItem:noop,clear:noop});def('sessionStorage',global.localStorage);
def('CanvasRenderingContext2D',undefined);def('HTMLElement',function(){});def('HTMLCanvasElement',function(){});
def('Image',function(){});def('Audio',function(){return{play:()=>Promise.resolve(),pause:noop};});
def('__showBootError',noop);def('__cdsDebugWarn',noop);def('CDS_DEBUG',false);
const realConsole=console;global.console={log:noop,warn:noop,error:realConsole.error};

function load(path){
  const html=fs.readFileSync(path,'utf8'),scripts=[],re=/<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;while((m=re.exec(html)))scripts.push({id:(m[1].match(/id="([^"]+)"/)||[])[1]||'script-'+scripts.length,code:m[2]});
  // Seleção por ID, nunca por posição: a camada de apresentação (RC-UX, ponte
  // de boot mobile) insere scripts e deslocaria todos os índices — o harness
  // quebrava ao rodar contra a candidata em vez da R13 pura.
  const SKIP_IDS=new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04',
    'cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
  scripts.forEach((s,i)=>{
    if(SKIP_IDS.has(s.id))return;
    try{vm.runInThisContext(s.code,{filename:String(i).padStart(2,'0')+'-'+s.id+'.js'});}
    catch(e){if(/^script-\d+$/.test(s.id)&&/document is not defined/.test(String(e&&e.message||e)))return;throw e;}
  });
  return{html,sha256:crypto.createHash('sha256').update(html).digest('hex')};
}
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/),head=lines.shift().split(',');
  return lines.map(line=>{const values=line.split(','),row={};head.forEach((k,i)=>row[k]=values[i]);return row;});
}
function makeTeam(db,squad,formation,style,index,color){
  const picked=autoLineup(squad,formation,index%FORMATIONS[formation].variations.length);
  return{squad,name:squad.c,flag:squad.f,color,lineup:picked.lineup,bench:picked.bench,formKey:formation,style};
}
function fromRow(db,row,index){
  const hs=db.squads.find(s=>s.c===row.homeTeam&&Number(s.y)===Number(row.homeYear));
  const as=db.squads.find(s=>s.c===row.awayTeam&&Number(s.y)===Number(row.awayYear));
  return[
    makeTeam(db,hs,row.homeFormation,row.homeStyle,index,'#2e9bff'),
    makeTeam(db,as,row.awayFormation,row.awayStyle,index,'#ff3d7f')
  ];
}
function lineOf(p){
  const pos=p.oopPos||p.slotPos;
  if(['CB','LB','RB','LWB','RWB'].includes(pos))return'DEF';
  if(['CDM','CM','CAM','LM','RM'].includes(pos))return'MID';
  if(p.isGK||pos==='GK')return'GK';return'FWD';
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function assert(ok,name,detail){
  results.push({name,pass:!!ok,detail:detail==null?null:detail});
  if(!ok)failures.push(name+(detail==null?'':' — '+JSON.stringify(detail)));
}
function finish(sim){
  let steps=0;while(!sim.isOver()&&steps++<500000)sim.step(1/30);
  return steps;
}
function digest(sim){
  const r13=sim.getR13Audit();
  return{
    score:sim.score.slice(),
    stats:sim.stats.map(s=>({
      goals:s.goals,shots:s.shots,passes:s.passes,passOk:s.passOk,corners:s.corners,
      offsides:s.offsides,throwIns:s.throwIns,fouls:s.fouls,tackles:s.tackles
    })),
    events:r13.events,
    phaseTime:r13.phaseTime,
    canonical:sim.getR12Audit().status
  };
}

const results=[],failures=[];
const loaded=load(BUILD),db=buildDB(DATA);
const csvPath='COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv';
const rows=parseCSV(fs.readFileSync(csvPath,'utf8'));
assert(global.CDS_R13&&global.CDS_R13.version==='5.9.3-R13.0','carrega a camada R13',global.CDS_R13&&global.CDS_R13.version);
assert(/\{ k: '1X',\s+v: 1\.0 \}/.test(loaded.html)&&/speed: 1\.0,\s+screen: 'home'/.test(loaded.html),'velocidade normal é 1.0');
assert(FORMATION_KEYS.length===17,'catálogo contém as 17 formações',FORMATION_KEYS.slice());

{
  const squad=db.squads[0],lineups=FORMATION_KEYS.map((formation,index)=>{
    const picked=autoLineup(squad,formation,index%FORMATIONS[formation].variations.length);
    return{formation,players:picked.lineup.length,goalkeepers:picked.lineup.filter(slot=>(slot.pos||(slot.p&&slot.p.slot))==='GK').length};
  });
  assert(lineups.every(item=>item.players===11&&item.goalkeepers===1),'todas as formações montam onze válido',lineups);
}

{
  const teams=fromRow(db,rows[0],0);srand(700001);
  const events=[],sim=new MatchSim(teams[0],teams[1],{neutral:true,labMode:false,onEvent:e=>events.push(e)});
  sim.waiting=false;sim.dead=0;sim.pendingRestart=null;
  const last=sim.teams[0].players.find(p=>!p.red&&!p.isGK);
  sim.ball={x:52,y:-.8,z:0,vx:0,vy:-5,vz:0,owner:null,traveling:false,travelT:0,target:null,kind:'deflect',lastTouch:last};
  sim.poss=0;sim._ballOut();
  let airborne=false,throwTravel=false;
  for(let i=0;i<180;i++){sim.step(1/30);if(sim.ball.kind==='throw'&&sim.ball.traveling)throwTravel=true;if(sim.ball.z>1)airborne=true;}
  assert(sim.stats[1].throwIns===1,'lateral é contabilizado uma vez',sim.stats.map(s=>s.throwIns));
  assert(events.some(e=>e.type==='throw_in'),'lateral emite evento visível');
  assert(throwTravel&&airborne,'lateral percorre trajetória aérea física',{throwTravel,airborne});
}

{
  /* A defesa deve responder à ocupação, e não ao rótulo do esquema. Cada uma
     das 17 formações ataca a mesma estrutura; medimos cobertura real depois
     da convergência dos jogadores. */
  const attackingSquad=db.squads[0],defendingSquad=db.squads[1];
  const formationCoverage=[];
  for(let fi=0;fi<FORMATION_KEYS.length;fi++){
    const formation=FORMATION_KEYS[fi];srand(710000+fi);
    const sim=new MatchSim(
      makeTeam(db,attackingSquad,formation,'balanced',0,'#29f'),
      makeTeam(db,defendingSquad,'4-3-3','balanced',0,'#f25'),
      {neutral:true,labMode:true}
    );
    sim.waiting=false;sim.dead=0;sim.pendingRestart=null;
    const candidates=sim.teams[0].players.filter(p=>!p.red&&!p.isGK&&
      (lineOf(p)==='FWD'||['CAM','LM','RM','LWB','RWB'].includes(p.slotPos)));
    const threats=candidates.slice(0,Math.min(4,candidates.length));
    threats.forEach((p,i)=>{p.x=76+(i%2)*1.4;p.y=8+(52*i/Math.max(1,threats.length-1));p._runDeep=true;});
    const owner=threats[0];owner.settle=99;owner._tx=owner.x;owner._ty=owner.y;
    sim.ball.owner=owner;sim.ball.x=owner.x;sim.ball.y=owner.y;sim.ball.traveling=false;sim.poss=0;
    const defending=sim.teams[1];
    for(let frame=0;frame<210;frame++){
      if(frame%10===0)sim._assignDefRoles(defending,sim.ball,sim._selectPresser(defending,sim.ball));
      sim._movePlayers(1/30,false);
    }
    const covered=threats.filter(attacker=>defending.players.some(p=>
      !p.red&&!p.isGK&&lineOf(p)!=='FWD'&&dist(p,attacker)<=9&&dist(p,defending.goal)<dist(attacker,defending.goal)
    )).length;
    formationCoverage.push({formation,threats:threats.length,covered,shape:defending._r13ShapePressure});
  }
  const totalThreats=formationCoverage.reduce((sum,item)=>sum+item.threats,0);
  const totalCovered=formationCoverage.reduce((sum,item)=>sum+item.covered,0);
  assert(formationCoverage.every(item=>item.shape&&item.shape.threats>=Math.min(3,item.threats)),
    'as 17 formações são lidas pela ocupação espacial',formationCoverage);
  assert(formationCoverage.every(item=>item.covered/Math.max(1,item.threats)>=.50),
    'nenhuma formação deixa a resposta defensiva inerte',formationCoverage);
  assert(totalCovered/Math.max(1,totalThreats)>=.70,
    'cobertura coletiva converge contra todas as formações',{rate:totalCovered/Math.max(1,totalThreats),formationCoverage});
}

{
  const a=db.squads[0],b=db.squads[1];srand(720001);
  const sim=new MatchSim(makeTeam(db,a,'4-2-3-1','balanced',0,'#29f'),makeTeam(db,b,'3-5-2','balanced',0,'#f25'),{neutral:true,labMode:true});
  sim.waiting=false;sim.dead=0;sim.pendingRestart=null;
  const attackers=sim.teams[0].players.filter(p=>lineOf(p)==='FWD'||p.slotPos==='CAM').slice(0,4);
  attackers.forEach((p,i)=>{p.x=78;p.y=i<2?11+i*5:34+i*4;p._runDeep=true;});
  const owner=attackers[0];sim.ball.owner=owner;sim.ball.x=owner.x;sim.ball.y=owner.y;sim.ball.traveling=false;sim.poss=0;
  const defending=sim.teams[1],presser=sim._selectPresser(defending,sim.ball);
  sim._assignDefRoles(defending,sim.ball,presser);
  assert(defending._r13Overload&&defending._r13ShapePressure&&defending._r13ShapePressure.localOverload,
    'superioridade por corredor é detectada sem depender do 4-2-4',defending._r13ShapePressure);
  assert(!!defending._r13Dropper,'superioridade espacial aciona o jogador de sobra');
}

{
  const teams=fromRow(db,rows[0],0);srand(700002);
  const sim=new MatchSim(teams[0],teams[1],{neutral:true,labMode:true});
  const p=sim.teams[0].players.find(x=>!x.isGK);
  p.x=50;p.y=30;p.vx=0;p.vy=5;p._tx=50;p._ty=42;
  sim.ball.owner=p;sim.ball.traveling=false;sim._ballGlue();
  const ox=sim.ball.x-p.x,oy=sim.ball.y-p.y,L=Math.hypot(ox,oy),V=Math.hypot(p.vx,p.vy);
  const alignment=(ox*p.vx+oy*p.vy)/(L*V);
  assert(alignment>.90,'bola dominada acompanha o corpo',alignment);
}

{
  const a=db.squads[0],b=db.squads.find(s=>s!==a);
  srand(700003);
  const sim=new MatchSim(makeTeam(db,a,'4-2-4','direct',0,'#29f'),makeTeam(db,b,'4-2-3-1','balanced',1,'#f25'),{neutral:true,labMode:true});
  sim.teams[0].formKey='4-2-4';sim.teams[1].formKey='4-2-3-1';
  sim.waiting=false;sim.dead=0;sim.pendingRestart=null;
  const forwards=sim.teams[0].players.filter(p=>lineOf(p)==='FWD');
  const ys=[9,25,43,59];forwards.slice(0,4).forEach((p,i)=>{p.x=75+(i%2)*2;p.y=ys[i];p._runDeep=true;});
  const owner=forwards[1];owner._tx=owner.x;owner._ty=owner.y;owner.settle=99;
  sim.ball.owner=owner;sim.ball.x=owner.x;sim.ball.y=owner.y;sim.ball.traveling=false;sim.poss=0;
  const def=sim.teams[1],presser=sim._selectPresser(def,sim.ball);
  sim._assignDefRoles(def,sim.ball,presser);
  const markers=def.players.filter(p=>p._markRef&&forwards.includes(p._markRef));
  assert(def._r13Overload&&markers.length>=4,'4-2-4 recebe quatro referências físicas',{overload:def._r13Overload,markers:markers.length});
  assert(!!def._r13Dropper,'4-2-4 aciona cobertura extra');
  assert(markers.every(p=>dist(p._r13MarkTarget,def.goal)<dist(p._markRef,def.goal)),'marcadores recebem alvo do lado do gol');
  for(let i=0;i<210;i++){if(i%13===0)sim._assignDefRoles(def,sim.ball,sim._selectPresser(def,sim.ball));sim._movePlayers(1/30,false);}
  let covered=0;
  for(const f of forwards.slice(0,4)){
    const ok=def.players.some(p=>!p.red&&!p.isGK&&lineOf(p)!=='FWD'&&dist(p,f)<=9&&dist(p,def.goal)<dist(f,def.goal));
    if(ok)covered++;
  }
  assert(covered>=3,'cobertura 4-2-4 converge no campo',{covered});
}

{
  const teams=fromRow(db,rows[0],0);srand(700004);
  const sim=new MatchSim(teams[0],teams[1],{neutral:true,labMode:true});
  sim.waiting=false;sim.dead=0;sim.pendingRestart=null;sim._setCorner(0,'penalty_spot','mixed');
  const defs=sim.teams[0].players.filter(p=>lineOf(p)==='DEF');
  const advanced=defs.filter(p=>p._setPieceRole!=='rest_defence');
  const rest=defs.filter(p=>p._setPieceRole==='rest_defence');
  assert(advanced.length<=2&&rest.length>=2,'escanteio preserva defesa de descanso',{advanced:advanced.length,rest:rest.length});
  const clearer=sim.teams[1].players.find(p=>!p.red&&!p.isGK);
  sim._emit('header_clear',{by:clearer});
  assert(sim.teams.every(t=>t.players.every(p=>!p._setPieceRole)),'papéis de escanteio são limpos após o corte');
}

{
  const row=rows[0],teams=fromRow(db,row,0);
  srand(Number(row.seed));const simA=new MatchSim(teams[0],teams[1],{neutral:true,labMode:true});
  simA.teams[0].formKey=row.homeFormation;simA.teams[1].formKey=row.awayFormation;
  const stepsA=finish(simA),a=digest(simA),audit=simA.getR13Audit();
  const teams2=fromRow(db,row,0);srand(Number(row.seed));const simB=new MatchSim(teams2[0],teams2[1],{neutral:true,labMode:true});
  simB.teams[0].formKey=row.homeFormation;simB.teams[1].formKey=row.awayFormation;
  const stepsB=finish(simB),b=digest(simB);
  assert(a.canonical==='CONSISTENT'&&b.canonical==='CONSISTENT','núcleo transacional permanece consistente');
  assert(JSON.stringify(a)===JSON.stringify(b)&&stepsA===stepsB,'partida R13 permanece determinística',{stepsA,stepsB});
  assert(Math.min(...audit.phaseVariety)>=5&&audit.phaseChanges>=8,'partida percorre fases de cadência',{variety:audit.phaseVariety,changes:audit.phaseChanges});
  assert(audit.rates.bodyOrientationMismatch<=.08,'auditoria interna aprova orientação da bola',audit.rates.bodyOrientationMismatch);
  assert(audit.rates.defensiveLineMeanRange<=9,'auditoria interna aprova linha organizada',audit.rates.defensiveLineMeanRange);
  assert((a.events.throw_in||0)>=1,'partida completa produz lateral',a.events.throw_in||0);
}

const output={
  version:global.CDS_R13&&global.CDS_R13.version,
  build:BUILD,sha256:loaded.sha256,
  passed:results.filter(r=>r.pass).length,total:results.length,failures,results
};
fs.writeFileSync(OUT,JSON.stringify(output,null,2));
realConsole.log(JSON.stringify(output,null,2));
if(failures.length)process.exitCode=1;
