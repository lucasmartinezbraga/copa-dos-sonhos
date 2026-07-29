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

/* A defasagem cresce com o aperto local? Se sim, quem segura o zagueiro fora da
   area e a forca de separacao — o mesmo vetor anti-aglomeracao que ja foi
   medido expulsando ATACANTES da area. */
const db=buildDB(DATA);
const squad=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(squad,f,0);return{squad,name:squad.c,flag:squad.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'};};
const DEFSLOT=new Set(['CB','LB','RB','LWB','RWB']);
const N=Number(argv.matches||2), DT=1/30, FLc=global.FL||105;
const B={};   // gap por numero de companheiros a <5.5 m
const Bo={};  // gap por numero de ADVERSARIOS a <3.2 m
const D2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
for(const form of ['4-3-3','4-4-2']) for(let i=0;i<N;i++){
  srand(1710000+i*977);
  const sim=new MatchSim(mk(form,true),mk(form,false),{neutral:true,labMode:true});
  const proto=Object.getPrototypeOf(sim);
  const orig=proto._defendTarget;
  sim._defendTarget=function(tm,p,b,presser){
    const out=orig.apply(this,arguments);
    try{
      if(tm._r13CrossDrop>0.15 && !p.isGK && !p.red && DEFSLOT.has(p.oopPos||p.slotPos)){
        const prog=v=>tm.attackDir>0?v:FLc-v;
        const gap=prog(p.x)-prog(out[0]);
        let mates=0; for(const q of tm.players){if(q===p||q.red)continue;if(D2(p,q)<5.5)mates++;}
        let opps=0; for(const q of this.teams[1-tm.side].players){if(q.red)continue;if(D2(p,q)<3.2)opps++;}
        const km=Math.min(4,mates), ko=Math.min(3,opps);
        (B[km]=B[km]||[]).push(gap);
        (Bo[ko]=Bo[ko]||[]).push(gap);
      }
    }catch(_){}
    return out;
  };
  let s=0; while(!sim.isOver()&&s++<300000) sim.step(DT);
}
const m=a=>a&&a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):null;
const linha=(o,rot)=>Object.keys(o).sort().map(k=>`${k} ${rot}: gap ${m(o[k])} m  (n=${o[k].length})`);
realConsole.log(JSON.stringify({
  defasagem_por_COMPANHEIROS_a_menos_de_5_5m: linha(B,'companheiro(s)'),
  defasagem_por_ADVERSARIOS_a_menos_de_3_2m: linha(Bo,'adversario(s)'),
},null,2));
