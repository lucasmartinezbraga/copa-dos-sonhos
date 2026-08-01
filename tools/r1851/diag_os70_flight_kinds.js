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
/* Composicao do "voo": por tipo, e se o receptor e o proprio passador. */
const MM=Number(argv.matches||3), H=1/60;
const P=MatchSim.prototype;
const kindQ={}, kindN={}, mesmo={}, dist={};
let q=0, voo=0;
for(let i=0;i<MM;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  let st=0, antTrav=false, antKind=null, antFrom=null;
  while(!sim.isOver()&&st++<500000){
    sim.step(H); const b=sim.ball; q++;
    if(b.traveling){
      voo++;
      const k=String(b.kind||'?');
      kindQ[k]=(kindQ[k]||0)+1;
      if(!antTrav){
        kindN[k]=(kindN[k]||0)+1;
        const r=b.receiver, o=antFrom;
        if(r&&o&&r===o) mesmo[k]=(mesmo[k]||0)+1;
        if(b.from&&b.target) {
          const d=Math.hypot(b.target.x-b.from.x,b.target.y-b.from.y);
          dist[k]=dist[k]||{s:0,n:0}; dist[k].s+=d; dist[k].n++;
        }
      }
      antTrav=true; antKind=k;
    } else { antTrav=false; antFrom=b.owner||antFrom; }
    if(b.owner)antFrom=b.owner;
  }
}
realConsole.log('  ',argv.build.replace(/^.*\//,''),'| quadros',q,'| voo',(voo/q*100).toFixed(1)+'%');
realConsole.log('   tipo            % do tempo   % do voo   por partida   dist media   receptor=passador');
const tot=Object.values(kindQ).reduce((a,b)=>a+b,0)||1;
Object.entries(kindQ).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
  const d=dist[k]?(dist[k].s/dist[k].n).toFixed(1):'-';
  realConsole.log('   ',k.padEnd(14),(v/q*100).toFixed(1).padStart(6)+'%',(v/tot*100).toFixed(1).padStart(9)+'%',
    String((kindN[k]/MM).toFixed(0)).padStart(11), String(d).padStart(11),'m',
    ((mesmo[k]||0)/(kindN[k]||1)*100).toFixed(0).padStart(12)+'%');
});
