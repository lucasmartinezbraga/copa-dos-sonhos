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
/* OS-65 · CENSO DE MOVIMENTO: giro, aceleracao e frenagem */
const MM=Number(argv.matches||4), DTM=1/60;
let n=0;
const giro={'<15':0,'15-45':0,'45-90':0,'90-135':0,'>135':0};
const acel={}, vel={};
let somaGiro=0, giroRapido=0, reversao=0;
let somaAcel=0, maxAcel=0, somaFrena=0, maxFrena=0;
for(let i=0;i<MM;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  const ant=new Map();
  let st=0;
  while(!sim.isOver()&&st++<500000){
    sim.step(DTM);
    for(const t of [0,1])for(const p of sim.teams[t].players){
      if(!p||p.red||p.isGK)continue;
      const q=ant.get(p);
      if(q){
        const dx=p.x-q.x, dy=p.y-q.y, d=Math.hypot(dx,dy);
        const v=d/DTM;
        if(d>3){ant.set(p,{x:p.x,y:p.y,vx:dx,vy:dy,v:v});continue;} // corte de cena
        const kv=v<1?'<1':v<3?'1-3':v<5?'3-5':v<7?'5-7':v<9?'7-9':'>9';
        vel[kv]=(vel[kv]||0)+1;
        if(q.v>1.5&&v>1.5&&d>0.01){
          const dot=(dx*q.vx+dy*q.vy)/(d*Math.hypot(q.vx,q.vy)||1);
          const ang=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
          n++;somaGiro+=ang;
          const kg=ang<15?'<15':ang<45?'15-45':ang<90?'45-90':ang<135?'90-135':'>135';
          giro[kg]++;
          if(ang>90)giroRapido++;
          if(ang>150)reversao++;
        }
        const dv=(v-q.v)/DTM;
        if(dv>0){somaAcel+=dv;if(dv>maxAcel)maxAcel=dv;}
        else {somaFrena+=-dv;if(-dv>maxFrena)maxFrena=-dv;}
        const ka=dv<-20?'<-20':dv<-8?'-20..-8':dv<8?'-8..8':dv<20?'8..20':'>20';
        acel[ka]=(acel[ka]||0)+1;
      }
      ant.set(p,{x:p.x,y:p.y,vx:p.x-(q?q.x:p.x),vy:p.y-(q?q.y:p.y),v:q?Math.hypot(p.x-q.x,p.y-q.y)/DTM:0});
    }
  }
}
const tot=Object.values(vel).reduce((a,b)=>a+b,0)||1;
realConsole.log('  build',argv.build.replace(/^.*\//,''),'| partidas',MM);
realConsole.log('  VELOCIDADE (m/s):');
for(const k of ['<1','1-3','3-5','5-7','7-9','>9']) if(vel[k]) realConsole.log('     '+k.padEnd(6),(vel[k]/tot*100).toFixed(1)+'%');
realConsole.log('  GIRO por quadro (graus, so em movimento):', n,'amostras');
for(const k of ['<15','15-45','45-90','90-135','>135']) realConsole.log('     '+k.padEnd(8),(giro[k]/n*100).toFixed(2)+'%');
realConsole.log('     media',(somaGiro/n).toFixed(1),'graus/quadro |  acima de 90 graus',(giroRapido/n*100).toFixed(2)+'%  |  reversao (>150)',(reversao/n*100).toFixed(2)+'%');
realConsole.log('  ACELERACAO (m/s2, humano ~ +8 / -10):');
const ta=Object.values(acel).reduce((a,b)=>a+b,0)||1;
for(const k of ['<-20','-20..-8','-8..8','8..20','>20']) if(acel[k]) realConsole.log('     '+k.padEnd(9),(acel[k]/ta*100).toFixed(2)+'%');
realConsole.log('     pico de aceleracao',maxAcel.toFixed(0),'m/s2 | pico de frenagem',maxFrena.toFixed(0),'m/s2');
