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

/* Onde os 12 m de linha viram 3 m de jogador?
   Compara, por tick e por jogador da linha DEF durante a ameaça de cruzamento:
   ALVO devolvido pela cadeia completa de _defendTarget  x  POSIÇÃO REAL. */
const db=buildDB(DATA);
const squad=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
const mk=(f,h)=>{const p=autoLineup(squad,f,0);return{squad,name:squad.c,flag:squad.f,color:h?'#2e9bff':'#ff3d7f',lineup:p.lineup,bench:p.bench,formKey:f,style:'balanced'};};
const DEFSLOT=new Set(['CB','LB','RB','LWB','RWB']);
const N=Number(argv.matches||2), DT=1/30, FLc=global.FL||105;
const S={n:0, alvo:[], real:[], gap:[], linha:[], duracao:[], velReal:[]};
for(const form of ['4-3-3','4-4-2']) for(let i=0;i<N;i++){
  srand(1710000+i*977);
  const sim=new MatchSim(mk(form,true),mk(form,false),{neutral:true,labMode:true});
  const proto=Object.getPrototypeOf(sim);
  const orig=proto._defendTarget;
  sim._defendTarget=function(tm,p,b,presser){
    const out=orig.apply(this,arguments);
    try{
      const cd=tm._r13CrossDrop;
      if(cd>0.15 && !p.isGK && !p.red && DEFSLOT.has(p.oopPos||p.slotPos)){
        const prog=v=>tm.attackDir>0?v:FLc-v;
        S.n++;
        S.alvo.push(prog(out[0]));
        S.real.push(prog(p.x));
        S.gap.push(prog(p.x)-prog(out[0]));
        S.linha.push(Number.isFinite(tm._r13LineDepth)?tm._r13LineDepth:-1);
        S.velReal.push(Math.hypot(p.vx||0,p.vy||0));
        tm.__cruzT=(tm.__cruzT||0)+0; // marcador
      }
    }catch(_){}
    return out;
  };
  /* duração contínua da fase de ameaça */
  const oStep=proto.step;
  sim.step=function(dt){
    const r=oStep.apply(this,arguments);
    for(const tm of this.teams){
      const cd=tm._r13CrossDrop;
      if(cd>0.15){tm.__dur=(tm.__dur||0)+dt;}
      else{ if(tm.__dur>0)S.duracao.push(tm.__dur); tm.__dur=0; }
    }
    return r;
  };
  let s=0; while(!sim.isOver()&&s++<300000) sim.step(DT);
}
const st=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);
  return{media:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2),p10:+b[Math.floor(b.length*.1)].toFixed(2),mediana:+b[Math.floor(b.length/2)].toFixed(2),p90:+b[Math.floor(b.length*.9)].toFixed(2)};};
realConsole.log(JSON.stringify({amostras:S.n,
  linhaR13: st(S.linha),
  ALVO_devolvido_progresso_m: st(S.alvo),
  POSICAO_real_progresso_m: st(S.real),
  GAP_real_menos_alvo_m: st(S.gap),
  velocidadeDoZagueiro_ms: st(S.velReal),
  duracaoContinuaDaFase_s: st(S.duracao),
},null,2));
