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
/* OS-51 · o drible passa pelo marcador? */
const MD=Number(argv.matches||6), DTD=1/60;
let n=0, somaAntes=0, somaDepois=0, passou=0, manteve=0;
const hist={};
for(let i=0;i<MD;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  const P=Object.getPrototypeOf(sim);
  let pend=[];
  sim._emit=function(t,d){
    const r=P._emit.apply(this,arguments);
    if(t==='dribble'&&d&&d.by&&d.on&&d.ok){
      pend.push({o:d.by,m:d.on,ate:this.t+1.0,
        antes:Math.hypot(d.by.x-d.on.x,d.by.y-d.on.y),
        g:this.teams[d.by.team].oppGoal});
    }
    return r;
  };
  let st=0;
  while(!sim.isOver()&&st++<500000){
    sim.step(DTD);
    if(pend.length){
      const vivos=[];
      for(const q of pend){
        if(sim.t<q.ate){vivos.push(q);continue;}
        const dep=Math.hypot(q.o.x-q.m.x,q.o.y-q.m.y);
        n++;somaAntes+=q.antes;somaDepois+=dep;
        /* passou = o marcador ficou ATRAS do dribllador em relacao ao gol */
        const dOg=Math.hypot(q.o.x-q.g.x,q.o.y-q.g.y), dMg=Math.hypot(q.m.x-q.g.x,q.m.y-q.g.y);
        if(dOg<dMg-0.5)passou++;
        if(dep<=q.antes+0.5)manteve++;
        const k=dep<2?'<2':dep<4?'2-4':dep<7?'4-7':dep<11?'7-11':'>11';
        hist[k]=(hist[k]||0)+1;
      }
      pend=vivos;
    }
  }
}
realConsole.log('  build',argv.build.replace(/^.*\//,''),'| dribles vencidos medidos',n);
realConsole.log('  distancia ao marcador  antes',(somaAntes/n).toFixed(2),'m -> 1 s depois',(somaDepois/n).toFixed(2),'m');
realConsole.log('  DEIXOU o marcador para tras (goal-side)',(passou/n*100).toFixed(1)+'%');
realConsole.log('  marcador continuou colado (nao ganhou 0,5 m)',(manteve/n*100).toFixed(1)+'%');
realConsole.log('  distancia 1 s depois:');
for(const k of ['<2','2-4','4-7','7-11','>11']) if(hist[k]) realConsole.log('     '+k.padEnd(6),(hist[k]/n*100).toFixed(1)+'%');
