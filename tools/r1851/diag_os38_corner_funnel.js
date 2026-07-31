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

/* ---------------------------------------------------------------------------
 * OS-38 · FUNIL DO ESCANTEIO
 * Conta os eventos que PODEM virar escanteio e quantos de fato viram, com o
 * ponto de chamada de `_setCorner` identificado por pilha. Sem patch nenhum:
 * so descreve onde o funil esta vazio.
 * ------------------------------------------------------------------------- */
const MC = Number(argv.matches || 12), DTC = 1/30;
const P = MatchSim.prototype;
const oldSC = P._setCorner;
const origem = {};
let cantos = 0;
P._setCorner = function(){
  cantos++;
  const st=(new Error().stack||'').split('\n').slice(1,6)
    .map(l=>{const m=l.match(/at\s+([\w.$]+)/);const f=l.match(/\(([^)]*\.js):(\d+)/);
      return (m?m[1]:'?')+(f?'@'+f[1]+':'+f[2]:'');})
    .filter(x=>!/_setCorner/.test(x)).slice(0,2).join(' <- ');
  origem[st]=(origem[st]||0)+1;
  return oldSC.apply(this, arguments);
};
const ev = {};
for (let i = 0; i < MC; i++) {
  const sim = novoSim(4200000 + i*7919, FORMS[i % FORMS.length]);
  const Pp = Object.getPrototypeOf(sim);
  sim._emit = function(type,data){
    ev[type]=(ev[type]||0)+1;
    return Pp._emit.apply(this,arguments);
  };
  let st=0; while(!sim.isOver()&&st++<500000) sim.step(DTC);
}
P._setCorner = oldSC;
realConsole.log('  build  ', argv.build.replace(/^.*\//,''), '| partidas', MC);
realConsole.log('  escanteios/partida', (cantos/MC).toFixed(2));
realConsole.log('  --- origem do escanteio ---');
for (const [k,v] of Object.entries(origem).sort((a,b)=>b[1]-a[1]))
  realConsole.log('   ', (v/MC).toFixed(2).padStart(6), k);
realConsole.log('  --- eventos por partida (candidatos ao funil) ---');
const foco=['shot','goal','save','blocked','miss','post','cross','cross_failed','clear','clearance','header','aerial_duel','corner','throw_in','goal_kick','tackle','interception','freekick'];
for (const k of foco) if (ev[k]) realConsole.log('   ', (ev[k]/MC).toFixed(2).padStart(7), k);
realConsole.log('  --- todos os eventos (>0,5/partida) ---');
realConsole.log('   ', Object.entries(ev).filter(([k,v])=>v/MC>0.5).sort((a,b)=>b[1]-a[1])
  .map(([k,v])=>k+'='+(v/MC).toFixed(1)).join(' '));
