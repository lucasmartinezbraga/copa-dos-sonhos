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

const db=buildDB(DATA);
const squad=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(squad,f,0);return{squad,name:squad.c,flag:squad.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'};};
const S={amostras:0,comDrop:0,dropMax:0,linha:[],linhaComDrop:[],zagProg:[]};
for(let i=0;i<2;i++){
  srand(1710000+i*977);
  const sim=new MatchSim(mk('4-3-3',true),mk('4-3-3',false),{neutral:true,labMode:true});
  let s=0, t=0;
  while(!sim.isOver()&&s++<300000){
    sim.step(1/30);
    if(s%15===0){
      for(const tm of sim.teams){
        const ld=tm._r13LineDepth, cd=tm._r13CrossDrop;
        if(!Number.isFinite(ld))continue;
        S.amostras++;
        S.linha.push(ld);
        if(Number.isFinite(cd)&&cd>0.05){S.comDrop++;S.linhaComDrop.push(ld);S.dropMax=Math.max(S.dropMax,cd);
          for(const p of tm.players){if(p.red||p.isGK)continue;
            const prog=tm.attackDir>0?p.x:(global.FL||105)-p.x;
            if(prog<40)S.zagProg.push(prog);}
        }
      }
    }
  }
}
const st=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);
  return{n:a.length,media:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1),p10:+b[Math.floor(b.length*.1)].toFixed(1),mediana:+b[Math.floor(b.length/2)].toFixed(1)};};
realConsole.log(JSON.stringify({
  amostras:S.amostras, amostrasComAmeacaDeCruzamento:S.comDrop,
  pctDoTempo:+(100*S.comDrop/Math.max(1,S.amostras)).toFixed(1),
  ameacaMaxima:+S.dropMax.toFixed(2),
  profundidadeDaLinha_geral: st(S.linha),
  profundidadeDaLinha_naAmeaca: st(S.linhaComDrop),
  progressoDosJogadores_naAmeaca: st(S.zagProg),
},null,2));
