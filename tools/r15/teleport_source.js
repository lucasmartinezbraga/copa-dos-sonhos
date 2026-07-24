#!/usr/bin/env node
'use strict';
/**
 * DE ONDE VEM O TELEPORTE. Atribui cada salto ao escritor responsável.
 *
 * O detector externo acusa 59.124 saltos >1,5 m em 294 partidas, com máximo de
 * 97,3 m. A hipótese é `_resetPositions()`, que escreve p.x=p.hx nos 22
 * jogadores fora do frame de movimento vigiado. Este probe separa o que é dela
 * do que vem de outro lugar — instrumentando a função e comparando os saltos
 * ocorridos DENTRO da sua execução com o total do passo.
 */
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const argv=Object.fromEntries(process.argv.slice(2).map(a=>{const[k,v]=a.replace(/^--/,'').split('=');return[k,v==null?true:v];}));
function noop(){}
function def(n,v){try{Object.defineProperty(global,n,{value:v,writable:true,configurable:true});}catch(_){global[n]=v;}}
def('window',global);def('self',global);def('navigator',{userAgent:'x',language:'pt-BR'});
def('location',{href:'r://x',search:'',hash:''});def('performance',{now:()=>0});def('crypto',crypto.webcrypto);
def('requestAnimationFrame',noop);def('cancelAnimationFrame',noop);
def('localStorage',{_d:{},getItem(k){return this._d[k]==null?null:this._d[k];},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];},clear(){this._d={};}});
const rc=console;def('console',Object.assign({},console,{log:noop,info:noop,warn:noop,debug:noop}));
const SKIP=new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html=fs.readFileSync(argv.build,'utf8');
const re=/<script([^>]*)>([\s\S]*?)<\/script>/gi;let m,i=0;
while((m=re.exec(html))){const id=(m[1].match(/id="([^"]+)"/)||[])[1]||('script-'+i);i++;if(SKIP.has(id))continue;
try{vm.runInThisContext(m[2],{filename:id+'.js'});}catch(e){if(/^script-\d+$/.test(id)&&/document is not defined/.test(String(e&&e.message)))continue;throw e;}}
const P=MatchSim.prototype;
const LIM=1.5;
const acc={reset:{n:0,max:0,sum:0,calls:0},outro:{n:0,max:0},halfSwap:0,steps:0};
let inReset=false;
const oldReset=P._resetPositions;
P._resetPositions=function(){
  acc.reset.calls++;
  const before=new Map();
  for(const tm of this.teams||[])for(const p of tm.players||[])if(p&&!p.red)before.set(p,[+p.x||0,+p.y||0]);
  inReset=true;const r=oldReset.apply(this,arguments);inReset=false;
  for(const[p,xy]of before){
    const d=Math.hypot((+p.x||0)-xy[0],(+p.y||0)-xy[1]);
    if(d>LIM){acc.reset.n++;acc.reset.sum+=d;if(d>acc.reset.max)acc.reset.max=d;}
  }
  return r;
};
function labTeam(db,f,s,home){
  const sq=db.squads[0],pk=autoLineup(sq,f,0),keys=(global.CDSDataV3&&global.CDSDataV3.attributes)||[];
  pk.lineup=pk.lineup.map((slot,idx)=>{const pos=slot.pos||'CM';return Object.assign({},slot,{p:{
    id:'L_'+pos+idx,n:'Atleta '+(idx+1),slot:pos,pos,r:82,starter:1,traits:[],behaviorTraits:[],naturalRoles:[],
    a8:[82,82,82,82,82,82,82,82],attributesV3:Object.fromEntries(keys.map(k=>[k,82])),
    profileV3:{dominantFoot:'R',weakFoot:4,heightCmSim:pos==='GK'?190:182,bodyType:'average',primaryPosition:pos},_a:{}}});});
  pk.bench=[];
  return{squad:sq,name:sq.c,flag:sq.f,color:home?'#2e9bff':'#ff3d7f',lineup:pk.lineup,bench:[],formKey:f,style:s};
}
const db=buildDB(DATA),seeds=Number(argv.seeds||10);
for(let s=0;s<seeds;s++){
  srand(5300000+s*617);
  const sim=new MatchSim(labTeam(db,'4-3-3','balanced',true),labTeam(db,'4-3-3','balanced',false),{neutral:true,labMode:true});
  sim.teams[0].formKey='4-3-3';sim.teams[1].formKey='4-3-3';
  let prev=new Map(),half=sim.half;
  const snap=()=>{const t=new Map();for(const tm of sim.teams)for(const p of tm.players)if(!p.red)t.set(p,[+p.x||0,+p.y||0]);return t;};
  prev=snap();
  const DT=1/30;let n=0;
  while(!sim.isOver()&&n++<500000){
    const hb=sim.half;sim.step(DT);acc.steps++;
    const now=snap(),hc=sim.half!==hb;
    for(const[p,xy]of now){const o=prev.get(p);if(!o)continue;
      const d=Math.hypot(xy[0]-o[0],xy[1]-o[1]);
      if(d<=LIM)continue;
      if(hc){acc.halfSwap++;continue;}
      acc.outro.n++;if(d>acc.outro.max)acc.outro.max=d;}
    prev=now;
  }
}
const total=acc.outro.n;
rc.error(`${seeds} partidas · ${acc.steps} passos\n`);
rc.error(`saltos >${LIM} m fora da virada de tempo (detector externo) : ${total}`);
rc.error(`   maior                                                 : ${acc.outro.max.toFixed(1)} m`);
rc.error(`saltos de troca de lado no intervalo                      : ${acc.halfSwap}`);
rc.error(``);
rc.error(`_resetPositions: ${acc.reset.calls} chamadas`);
rc.error(`   saltos causados por ela                               : ${acc.reset.n}`);
rc.error(`   maior                                                 : ${acc.reset.max.toFixed(1)} m`);
rc.error(`   media                                                 : ${(acc.reset.sum/(acc.reset.n||1)).toFixed(1)} m`);
rc.error(``);
rc.error(`participacao de _resetPositions no total: ${(acc.reset.n/(total||1)*100).toFixed(1)}%`);
fs.writeFileSync(argv.out||'reports/r15/teleport-origem.json',JSON.stringify({
  build:argv.build,seeds,steps:acc.steps,limit:LIM,
  externalJumps:total,externalMax:+acc.outro.max.toFixed(2),halfSwapJumps:acc.halfSwap,
  resetCalls:acc.reset.calls,resetJumps:acc.reset.n,resetMax:+acc.reset.max.toFixed(2),
  resetMean:+(acc.reset.sum/(acc.reset.n||1)).toFixed(2),
  resetShare:+(acc.reset.n/(total||1)).toFixed(4)},null,1));
