#!/usr/bin/env node
'use strict';
/* OCUPAÇÃO DA ÁREA NO MOMENTO DO CRUZAMENTO
   -------------------------------------------------------------------------
   Funil medido: 19,12 cruzamentos por partida, mas só 1,20 cabeceios ao gol e
   0,88 cortes de cabeça. Uns cinco cruzamentos aéreos somem sem virar disputa.

   Hipótese: a área está VAZIA quando a bola chega. O motor exige alvo aéreo
   dentro de 24 m do gol (`inBox`, linha 5304); sem ninguém lá, o cruzamento
   cai no ramo de falha de entrega e vira bola perdida.

   Mede, no instante exato de cada `_cross`: quantos companheiros estão dentro
   dos 24 m, quantos dentro dos 16 m (área de verdade), e como isso se
   distribui. Só observação. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-area', language: 'pt-BR' });
define('location', { href: 'runner://area', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); }
  catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message || e))) continue; throw e; }
}

/* Confirma o suspeito: o zagueiro que recua para defender cruzamento TROTA?
   Reproduz a formula de esforco do _integrate (linha ~7567) na entrada real. */
const db=buildDB(DATA);
const squad=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(squad,f,0);return{squad,name:squad.c,flag:squad.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'};};
const DEFSLOT=new Set(['CB','LB','RB','LWB','RWB']);
const N=Number(argv.matches||2), DT=1/30;
const S={n:0, comDuty:0, dist:[], esforco:[], vmax:[], vreal:[], maxSpd:[], longe16:0};
for(const form of ['4-3-3','4-4-2']) for(let i=0;i<N;i++){
  srand(1710000+i*977);
  const sim=new MatchSim(mk(form,true),mk(form,false),{neutral:true,labMode:true});
  const proto=Object.getPrototypeOf(sim);
  const orig=proto._integrate;
  sim._integrate=function(p,tx,ty,dt,freeze){
    try{
      const tm=this.teams[p.team];
      if(tm&&tm._r13CrossDrop>0.15&&!p.isGK&&!p.red&&DEFSLOT.has(p.oopPos||p.slotPos)){
        const dist=Math.hypot(tx-p.x,ty-p.y)||1e-6;
        const b=this.ball;
        const duty=!!(p._breaking||p._burst||p===b.owner||(b.traveling&&b.receiver===p));
        const staminaF=0.7+p.stamina/100*0.3;
        let effort;
        if(duty||dist>16){effort=1; if(dist>16)S.longe16++;}
        else{
          const distF=Math.max(0,Math.min(1,(dist-3)/13));
          effort=Math.max(.5,Math.min(1,0.55+distF*0.35+0.5*0.14)); // media do 'breathe'
        }
        S.n++; if(duty)S.comDuty++;
        S.dist.push(dist); S.esforco.push(effort);
        S.vmax.push(p.maxSpd*staminaF*effort*(freeze?0.5:1));
        S.vreal.push(Math.hypot(p.vx||0,p.vy||0));
        S.maxSpd.push(p.maxSpd);
      }
    }catch(_){}
    return orig.apply(this,arguments);
  };
  let s=0; while(!sim.isOver()&&s++<300000) sim.step(DT);
}
const m=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):null;
const md=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);return +b[Math.floor(b.length/2)].toFixed(2);};
realConsole.log(JSON.stringify({
  amostras:S.n,
  comHasBallDuty:S.comDuty, pctComDuty:+(100*S.comDuty/Math.max(1,S.n)).toFixed(2),
  amostrasComDistanciaMaiorQue16m:S.longe16, pctSprintPorDistancia:+(100*S.longe16/Math.max(1,S.n)).toFixed(1),
  distanciaAoAlvo_m:{media:m(S.dist),mediana:md(S.dist)},
  ESFORCO:{media:m(S.esforco),mediana:md(S.esforco)},
  velocidadeMaximaPermitida_ms:{media:m(S.vmax),mediana:md(S.vmax)},
  velocidadeRealAtingida_ms:{media:m(S.vreal),mediana:md(S.vreal)},
  velocidadeDeSprintDoJogador_ms:{media:m(S.maxSpd)},
},null,2));
