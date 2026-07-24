#!/usr/bin/env node
'use strict';
/* Mede o COMPORTAMENTO de conducao: quantas conducoes acontecem, o quanto
   avancam, e quantas chegam perto da linha de fundo (a jogada de ponta que o
   usuario pediu). Compara duas builds na mesma seed. */
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
const acc={carries:0,carrySumAdv:0,bylineTouches:0,ballSamples:0,goals:0};
// conta conducoes via _act, e "toques na linha de fundo" = portador no terco
// final a <=6m da linha de fundo adversaria
const oldStep=P.step;
P.step=function(dt){
  const r=oldStep.apply(this,arguments);
  const b=this.ball;
  if(b&&b.owner&&!b.traveling){
    const o=b.owner,tm=this.teams[o.team],dir=tm.attackDir||1;
    acc.ballSamples++;
    const toBy=dir>0?(FL-o.x):o.x;               // distancia a linha de fundo adv
    const adv=dir>0?o.x:FL-o.x;
    if(adv>FL*0.66 && toBy<=6) acc.bylineTouches++;
    if(o._act==='carry'){acc.carries++;}
  }
  return r;
};
function labTeam(db,f,s,home){
  const sq=db.squads[0],pk=autoLineup(sq,f,0),keys=(global.CDSDataV3&&global.CDSDataV3.attributes)||[];
  pk.lineup=pk.lineup.map((slot,idx)=>{const pos=slot.pos||'CM';return Object.assign({},slot,{p:{
    id:'L_'+pos+idx,n:'A'+(idx+1),slot:pos,pos,r:82,starter:1,traits:[],behaviorTraits:[],naturalRoles:[],
    a8:[82,82,82,82,82,82,82,82],attributesV3:Object.fromEntries(keys.map(k=>[k,82])),
    profileV3:{dominantFoot:'R',weakFoot:4,heightCmSim:pos==='GK'?190:182,bodyType:'average',primaryPosition:pos},_a:{}}});});
  pk.bench=[];
  return{squad:sq,name:sq.c,flag:sq.f,color:home?'#2e9bff':'#ff3d7f',lineup:pk.lineup,bench:[],formKey:f,style:s};
}
const db=buildDB(DATA),seeds=Number(argv.seeds||12);
for(let s=0;s<seeds;s++){
  srand(5500000+s*677);
  const sim=new MatchSim(labTeam(db,'4-3-3','wings',true),labTeam(db,'4-3-3','balanced',false),{neutral:true,labMode:true});
  sim.teams[0].formKey='4-3-3';sim.teams[1].formKey='4-3-3';
  const DT=1/30;let n=0;while(!sim.isOver()&&n++<500000)sim.step(DT);
  acc.goals+=sim.score[0]+sim.score[1];
}
const out={build:argv.build,seeds,
  carrySampleShare:+(acc.carries/(acc.ballSamples||1)).toFixed(4),
  bylineTouchShare:+(acc.bylineTouches/(acc.ballSamples||1)).toFixed(5),
  bylineTouchesPerGame:+(acc.bylineTouches/seeds).toFixed(1),
  goalsPerGame:+(acc.goals/seeds).toFixed(2)};
rc.error(JSON.stringify(out,null,1));
fs.writeFileSync(argv.out||'reports/r15/carry.json',JSON.stringify(out,null,1));
