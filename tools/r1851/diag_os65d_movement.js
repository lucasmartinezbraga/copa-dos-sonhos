#!/usr/bin/env node
'use strict';
/*
 * OS-07 · CENSO DE EFEITO TATICO
 * ------------------------------
 * Roda sobre a BUILD PROMOVIDA R18.50, sem nenhum patch.
 *
 * Responde duas perguntas separadas, que costumam ser confundidas:
 *
 *   A) ALCANCE — o campo de instrucao chega ao motor? Cada folha de
 *      DEFAULT_INSTRUCTIONS e perturbada e o `tm.fx` resultante e comparado.
 *      Um campo que nao muda `fx` e nao e lido no escore de decisao e
 *      DECORATIVO: existe na interface e nao existe no jogo.
 *
 *   B) EFEITO — o campo que chega ao motor muda o futebol apresentado?
 *      Mesma semente, extremo baixo contra extremo alto, observaveis pareados.
 *
 *   C) FUNCAO — trocar a funcao de um jogador muda algo? Mesmo par de
 *      sementes, um unico jogador trocado de papel.
 *
 * A parte A e instantanea e exaustiva; nao simula partida nenhuma.
 *
 * ATENCAO ao ler B e C: mudar instrucao muda `fx`, que muda o caminho de
 * consumo de RNG. Duas configuracoes diferentes na MESMA semente divergem por
 * caos, nao por efeito. Por isso "fingerprint diferente" NAO e evidencia de
 * efeito — so o contrario vale: fingerprint IDENTICO prova inercia. O efeito
 * precisa aparecer como direcao consistente sobre muitas sementes.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(item => {
  const [key, value] = item.replace(/^--/, '').split('=');
  return [key, value == null ? true : value];
}));
function noop() {}
function define(name, value) {
  try {
    Object.defineProperty(global, name, { value, writable: true, configurable: true });
  } catch (_) {
    global[name] = value;
  }
}

define('window', global);
define('self', global);
define('navigator', { userAgent: 'cds-os07', language: 'pt-BR' });
define('location', { href: 'runner://os07', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0);
define('cancelAnimationFrame', noop);
define('addEventListener', noop);
define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop);
define('confirm', () => true);
define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {});
define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {});
define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop);
define('__cdsDebugWarn', noop);
define('CDS_DEBUG', false);

const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };
const SKIP = new Set([
  'cds-2_5d-gate-a-contracts-v02',
  'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup',
  'cds-mobile-boot-bridge',
  'cds-ux-boot'
]);
if (!argv.build) {
  realConsole.error('ABORTA: informe --build=<html>');
  process.exit(1);
}

const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match, index = 0, scriptsOk = 0, scriptsErro = 0;
const excecoes = [];
while ((match = scriptRe.exec(html))) {
  const id = (match[1].match(/id="([^"]+)"/) || [])[1] || `script-${index}`;
  index++;
  if (SKIP.has(id)) continue;
  try {
    vm.runInThisContext(match[2], { filename: id + '.js' });
    scriptsOk++;
  } catch (error) {
    scriptsErro++;
    excecoes.push({ bloco: id, mensagem: String(error && error.message || error) });
  }
}

const REQUIRED = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','FL','FW','CDS_PHASES_4_7'];
const missing = REQUIRED.filter(name => typeof global[name] === 'undefined');
if (missing.length) {
  realConsole.error('ABORTA: simbolos do motor ausentes -> ' + missing.join(', '));
  process.exit(2);
}
for (const fn of ['setTeamInstructions','setPlayerPhaseRole','getTacticalCoherence']) {
  if (typeof MatchSim.prototype[fn] !== 'function') {
    realConsole.error('ABORTA: build sem ' + fn + '()');
    process.exit(3);
  }
}

const P47 = CDS_PHASES_4_7;
const db = buildDB(DATA);
const N = Number(argv.matches || 24);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, style, home) => {
  const picked = autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: picked.lineup, bench: picked.bench, formKey: form, style };
};
const novoSim = (seed, form) => {
  srand(seed);
  const s = new MatchSim(mk(form, 'balanced', true), mk(form, 'balanced', false), { neutral: true, labMode: true });
  s.teams[0].formKey = form; s.teams[1].formKey = form;
  return s;
};
/* OS-65d · Quanto do deslocamento e FISICA e quanto e CORRECAO, em TODOS os
   quadros. loc = do inicio do quadro ate onde o _integrate deixou.
              ext = de onde o _integrate deixou ate o inicio do quadro seguinte. */
const MM=Number(argv.matches||4), H=1/60;
const IP=MatchSim.prototype;
const oldInt=IP._integrate;
IP._integrate=function(p,tx,ty,dt,freeze){
  try{p.__preX=p.x;p.__preY=p.y;}catch(_){}
  const r=oldInt.apply(this,arguments);
  try{p.__mvX=p.x;p.__mvY=p.y;p.__loc=Math.hypot(p.x-p.__preX,p.y-p.__preY);}catch(_){}
  return r;
};
let q=0, locT=0, extT=0, totT=0, extMax=0, nExt=0;
const razao={'0':0,'<10%':0,'10-25%':0,'25-50%':0,'50-75%':0,'>75%':0};
const velT={}, velL={};
let telep=0;
for(let i=0;i<MM;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  let st=0;
  const pre=new Map();
  while(!sim.isOver()&&st++<500000){
    pre.clear();
    for(const t of [0,1])for(const p of sim.teams[t].players){
      if(!p||p.red||p.isGK)continue;
      pre.set(p,{x:p.x,y:p.y});
      p.__mvX=undefined;p.__loc=0;
    }
    sim.step(H);
    for(const t of [0,1])for(const p of sim.teams[t].players){
      if(!p||p.red||p.isGK)continue;
      const b=pre.get(p); if(!b||p.__mvX===undefined)continue;
      const tot=Math.hypot(p.x-b.x,p.y-b.y);
      if(tot>2){telep++;continue;}                       // recolocacao de lance
      const loc=p.__loc||0;
      const ext=Math.hypot(p.x-p.__mvX,p.y-p.__mvY);
      q++; locT+=loc; extT+=ext; totT+=tot;
      if(ext>extMax)extMax=ext;
      if(ext>1e-6)nExt++;
      const r=tot>1e-6?ext/(loc+ext):0;
      razao[r<1e-6?'0':r<.10?'<10%':r<.25?'10-25%':r<.50?'25-50%':r<.75?'50-75%':'>75%']++;
      const vt=tot/H, vl=loc/H;
      const K=v=>v<1?'<1':v<2?'1-2':v<3?'2-3':v<4?'3-4':v<5.5?'4-5.5':v<7?'5.5-7':'>7';
      velT[K(vt)]=(velT[K(vt)]||0)+1; velL[K(vl)]=(velL[K(vl)]||0)+1;
    }
  }
}
const R2=x=>x.toFixed(2), R3=x=>x.toFixed(3);
realConsole.log('  build',argv.build.replace(/^.*\//,''),'| partidas',MM,'| quadros-jogador',q,'| recolocacoes >2m',telep);
realConsole.log('  POR QUADRO:  fisica',R3(locT/q),'m   correcao',R3(extT/q),'m   total',R3(totT/q),'m');
realConsole.log('  CORRECAO e',(extT/(locT+extT)*100).toFixed(1)+'% de todo o deslocamento | presente em',(nExt/q*100).toFixed(1)+'% dos quadros | pico',R2(extMax),'m');
realConsole.log('  fracao do passo que e correcao:');
for(const k of ['0','<10%','10-25%','25-50%','50-75%','>75%']) realConsole.log('     '+k.padEnd(8),(razao[k]/q*100).toFixed(2)+'%');
realConsole.log('  VELOCIDADE (% do tempo)      total     so fisica');
for(const k of ['<1','1-2','2-3','3-4','4-5.5','5.5-7','>7'])
  realConsole.log('     '+k.padEnd(7),((velT[k]||0)/q*100).toFixed(1).padStart(6)+'%',((velL[k]||0)/q*100).toFixed(1).padStart(10)+'%');
realConsole.log('  media total',R2(totT/q/H),'m/s ->',R2(totT/q/H*5400/1000),'km/90min  (real ~10,5)');
realConsole.log('  media fisica',R2(locT/q/H),'m/s ->',R2(locT/q/H*5400/1000),'km/90min');
