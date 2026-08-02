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
/* Faltas: quais viram cobranca, quais viram "reinicio com posse", e onde a bola
   aparece em relacao ao lugar da falta. */
const MM=Number(argv.matches||4), H=1/60;
const P=MatchSim.prototype;
let cobranca=0, reinicio=0, pen=0;
const desl=[], oppD=[];
const dtgH={};
const oldEmit=P._emit;
let pend=null;
P._emit=function(t,d){
  if(t==='foul'&&d&&d.on){
    const v=d.on, tm=this.teams[v.team], g=tm.oppGoal;
    const dtg=Math.hypot(v.x-g.x,v.y-g.y);
    dtgH[dtg<20?'<20':dtg<42?'20-42':dtg<60?'42-60':dtg<80?'60-80':'>80']=(dtgH[dtg<20?'<20':dtg<42?'20-42':dtg<60?'42-60':dtg<80?'60-80':'>80']||0)+1;
    pend={x:v.x,y:v.y,team:v.team,dtg,t:this.t};
  }
  if(t==='freekick'||t==='freekick_routine'||t==='falta_cobrada')cobranca++;
  if(t==='penalty')pen++;
  return oldEmit.apply(this,arguments);
};
for(let i=0;i<MM;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  let st=0, espera=null;
  while(!sim.isOver()&&st++<500000){
    sim.step(H);
    if(pend&&!espera){espera={...pend, ate:sim.t+2.0}; pend=null;}
    if(espera&&sim.ball.owner&&sim.t>espera.t+0.05){
      const b=sim.ball, o=b.owner;
      if(espera.dtg>=42){
        reinicio++;
        desl.push(Math.hypot(o.x-espera.x,o.y-espera.y));
        let nd=1e9;
        for(const q of sim.teams[1-o.team].players){ if(q.red)continue;
          const dd=Math.hypot(q.x-o.x,q.y-o.y); if(dd<nd)nd=dd; }
        oppD.push(nd);
      }
      espera=null;
    }
    if(espera&&sim.t>espera.ate)espera=null;
  }
}
const ord=a=>[...a].sort((x,y)=>x-y);
const q=(a,f)=>a.length?ord(a)[Math.floor(a.length*f)]:0;
realConsole.log('  ',argv.build.replace(/^.*\//,''),'| partidas',MM);
realConsole.log('   faltas por distancia ate o gol ADVERSARIO:');
for(const k of ['<20','20-42','42-60','60-80','>80']) if(dtgH[k]) realConsole.log('     ',k.padEnd(7),(dtgH[k]/MM).toFixed(1),'por partida');
realConsole.log('   cobrancas',(cobranca/MM).toFixed(1),'| penaltis',(pen/MM).toFixed(2),'| "reinicio com posse"',(reinicio/MM).toFixed(1),'por partida');
realConsole.log('   DESLOCAMENTO entre o local da falta e onde a bola reaparece:');
realConsole.log('     mediana',q(desl,.5).toFixed(2),'m | p90',q(desl,.9).toFixed(2),'m | max',(desl.length?Math.max(...desl):0).toFixed(1),'m');
realConsole.log('   ADVERSARIO MAIS PROXIMO no reinicio:');
realConsole.log('     mediana',q(oppD,.5).toFixed(2),'m | p10',q(oppD,.1).toFixed(2),'m  (regra real: 9,15 m)');
