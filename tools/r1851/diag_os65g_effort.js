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
/* OS-65g · Fatia real de esforco=1, contando o que as camadas de marcacao
   injetam em _breaking depois do meu gancho. */
const MM=Number(argv.matches||3), H=1/60;
const IP=MatchSim.prototype;
const oldInt=IP._integrate;
let n=0,base=0,longe=0,marc=0,qualquer=0,so_marc=0;
let dB={};
IP._integrate=function(p,tx,ty,dt,freeze){
  try{
    const d=Math.hypot(tx-p.x,ty-p.y);
    n++;
    const b=!!(p._breaking||p._burst||p===this.ball.owner||p.__chase||(this.ball.traveling&&this.ball.receiver===p));
    const m=!!(p._markRef&&!p._markRef.red&&Math.hypot(p.x-p._markRef.x,p.y-p._markRef.y)>2.55);
    const l=d>16;
    if(b)base++; if(l)longe++; if(m)marc++;
    if(b||l||m)qualquer++;
    if(m&&!b&&!l)so_marc++;
    const bb=this.ball, db=bb?Math.hypot(p.x-bb.x,p.y-bb.y):99;
    const k=db<10?'<10':db<20?'10-20':db<30?'20-30':db<45?'30-45':'>45';
    if(b||l||m)dB[k]=(dB[k]||0)+1;
  }catch(_){}
  return oldInt.apply(this,arguments);
};
for(let i=0;i<MM;i++){const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);let st=0;while(!sim.isOver()&&st++<500000)sim.step(H);}
realConsole.log('  chamadas',n);
realConsole.log('  ESFORCO 1 por causa de:');
realConsole.log('     dever de bola      ',(base/n*100).toFixed(1)+'%');
realConsole.log('     alvo a mais de 16 m',(longe/n*100).toFixed(1)+'%');
realConsole.log('     marcacao (>2,55 m) ',(marc/n*100).toFixed(1)+'%   (so por isto',(so_marc/n*100).toFixed(1)+'%)');
realConsole.log('     ---- TOTAL         ',(qualquer/n*100).toFixed(1)+'%  <- fracao do tempo em esforco maximo');
const t=Object.values(dB).reduce((a,b)=>a+b,0)||1;
realConsole.log('  desses, distancia ate a BOLA:');
for(const k of ['<10','10-20','20-30','30-45','>45']) realConsole.log('     '+k.padEnd(7),((dB[k]||0)/t*100).toFixed(1)+'%');
