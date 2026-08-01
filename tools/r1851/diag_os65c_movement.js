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
/* OS-65c · Separa LOCOMOCAO de RECOLOCACAO.
   `ext` = quanto a posicao andou entre o ponto onde o _integrate a deixou e o
   inicio do quadro seguinte. Isso e escrita de posicao fora da fisica. */
const MM=Number(argv.matches||4), H=1/60;
const IP=MatchSim.prototype;
const oldInt=IP._integrate;
IP._integrate=function(p,tx,ty,dt,freeze){
  const r=oldInt.apply(this,arguments);
  try{p.__mvX=p.x;p.__mvY=p.y;p.__mvT=this.t;}catch(_){}
  return r;
};
const extH={'0':0,'<0.01':0,'0.01-0.1':0,'0.1-0.5':0,'0.5-2':0,'2-10':0,'>10':0};
const vel={}, giro={'<15':0,'15-45':0,'45-90':0,'90-135':0,'>135':0};
let quadros=0, semInt=0, extTot=0, extMax=0;
let n=0, somaGiro=0, g90=0, g150=0;
let distTot=0, jogSeg=0;
let accAlto=0, accOK=0, maxAcc=0;
for(let i=0;i<MM;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  const ant=new Map();
  let st=0;
  while(!sim.isOver()&&st++<500000){
    const pre=new Map();
    for(const t of [0,1])for(const p of sim.teams[t].players){
      if(!p||p.red||p.isGK)continue;
      const tem=(p.__mvX!==undefined);
      pre.set(p,{x:p.x,y:p.y,ext:tem?Math.hypot(p.x-p.__mvX,p.y-p.__mvY):null,tInt:p.__mvT});
      p.__mvX=undefined;
    }
    sim.step(H);
    for(const t of [0,1])for(const p of sim.teams[t].players){
      if(!p||p.red||p.isGK)continue;
      const b=pre.get(p); if(!b)continue;
      quadros++;
      if(p.__mvX===undefined){semInt++;ant.delete(p);continue;} // nao passou pelo _integrate
      const e=b.ext;
      if(e!==null){
        extTot+=e; if(e>extMax)extMax=e;
        extH[e===0?'0':e<0.01?'<0.01':e<0.1?'0.01-0.1':e<0.5?'0.1-0.5':e<2?'0.5-2':e<10?'2-10':'>10']++;
      }
      if(e!==null&&e>0.02){ant.delete(p);continue;}          // quadro contaminado
      const dx=p.x-b.x, dy=p.y-b.y, d=Math.hypot(dx,dy), v=d/H;
      distTot+=d; jogSeg+=H;
      const kv=v<1?'<1':v<2?'1-2':v<3?'2-3':v<4?'3-4':v<5.5?'4-5.5':v<7?'5.5-7':'>7';
      vel[kv]=(vel[kv]||0)+1;
      const q=ant.get(p);
      if(q&&q.v>1.5&&v>1.5&&d>1e-3){
        const dot=(dx*q.dx+dy*q.dy)/(d*Math.hypot(q.dx,q.dy)||1);
        const ang=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
        n++;somaGiro+=ang;
        giro[ang<15?'<15':ang<45?'15-45':ang<90?'45-90':ang<135?'90-135':'>135']++;
        if(ang>90)g90++; if(ang>150)g150++;
        const a=Math.abs(v-q.v)/H;
        if(a>maxAcc)maxAcc=a;
        if(a>12)accAlto++;else accOK++;
      }
      ant.set(p,{dx,dy,v});
    }
  }
}
const tot=Object.values(vel).reduce((a,b)=>a+b,0)||1;
const te=Object.values(extH).reduce((a,b)=>a+b,0)||1;
const R2=x=>x.toFixed(2);
realConsole.log('  build',argv.build.replace(/^.*\//,''),'| partidas',MM,'| quadros-jogador',quadros);
realConsole.log('  fora do _integrate neste quadro:',(semInt/quadros*100).toFixed(2)+'%');
realConsole.log('  ESCRITA DE POSICAO FORA DA FISICA (m por quadro):');
for(const k of ['0','<0.01','0.01-0.1','0.1-0.5','0.5-2','2-10','>10']) realConsole.log('     '+k.padEnd(9),(extH[k]/te*100).toFixed(2)+'%');
realConsole.log('     media',R2(extTot/te),'m/quadro | pico',R2(extMax),'m');
realConsole.log('  --- so quadros de LOCOMOCAO pura ---');
realConsole.log('  DISTANCIA por jogador por partida:',R2(distTot/MM/20/1000),'km (real ~10,5) | amostrado',R2(jogSeg/MM/20/60),'min de',R2(90),'min');
realConsole.log('  VELOCIDADE (% do tempo):');
for(const k of ['<1','1-2','2-3','3-4','4-5.5','5.5-7','>7']) realConsole.log('     '+k.padEnd(7),((vel[k]||0)/tot*100).toFixed(1)+'%');
realConsole.log('     media',R2(distTot/(jogSeg||1)),'m/s');
realConsole.log('  GIRO por quadro (',n,'amostras ):');
for(const k of ['<15','15-45','45-90','90-135','>135']) realConsole.log('     '+k.padEnd(8),(giro[k]/n*100).toFixed(3)+'%');
realConsole.log('     media',(somaGiro/n).toFixed(2),'graus | >90',(g90/n*100).toFixed(3)+'% | >150',(g150/n*100).toFixed(3)+'%');
realConsole.log('  ACELERACAO: acima de 12 m/s2',(accAlto/(accOK+accAlto)*100).toFixed(2)+'% | pico',maxAcc.toFixed(1));
