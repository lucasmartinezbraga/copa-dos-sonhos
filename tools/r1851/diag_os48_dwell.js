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
/* OS-48 · CENSO DE DOMINIO: quanto tempo a bola fica no pe, e parado */
const MD=Number(argv.matches||8), DTD=1/60;
let posses=0, somaT=0, somaParado=0, somaDist=0;
const hist={}, histParado={};
let saiuAndando=0;
for(let i=0;i<MD;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  let dono=null, t0=0, parado=0, x0=0, y0=0, px=0, py=0, andou=0;
  let st=0;
  while(!sim.isOver()&&st++<500000){
    const antes=sim.ball.owner;
    sim.step(DTD);
    const agora=sim.ball.owner;
    if(agora&&agora===dono){
      const d=Math.hypot(agora.x-px,agora.y-py);
      if(d/DTD<0.9)parado+=DTD;
      andou+=d; px=agora.x; py=agora.y;
    }
    if(agora!==dono){
      if(dono){
        const dur=sim.t-t0;
        if(dur>0.02&&dur<25){
          posses++;somaT+=dur;somaParado+=parado;somaDist+=andou;
          const k=dur<0.3?'<0.3':dur<0.6?'0.3-0.6':dur<1.0?'0.6-1.0':dur<1.6?'1.0-1.6':dur<2.5?'1.6-2.5':'>2.5';
          hist[k]=(hist[k]||0)+1;
          const f=parado/Math.max(.001,dur);
          const kf=f<0.15?'<15%':f<0.35?'15-35%':f<0.6?'35-60%':f<0.85?'60-85%':'>85%';
          histParado[kf]=(histParado[kf]||0)+1;
          if(f<0.35)saiuAndando++;
        }
      }
      dono=agora; t0=sim.t; parado=0; andou=0;
      if(agora){px=agora.x;py=agora.y;}
    }
  }
}
realConsole.log('  build',argv.build.replace(/^.*\//,''),'| partidas',MD);
realConsole.log('  posses individuais    ',posses,'=',(posses/MD).toFixed(1),'/partida');
realConsole.log('  tempo medio com a bola',(somaT/posses).toFixed(2),'s   (real ~1,1 a 1,4 s)');
realConsole.log('  distancia media com a bola',(somaDist/posses).toFixed(2),'m');
realConsole.log('  fracao PARADO (< 0,9 m/s)  ',(somaParado/somaT*100).toFixed(1)+'%');
realConsole.log('  duracao do dominio:');
for(const k of ['<0.3','0.3-0.6','0.6-1.0','1.0-1.6','1.6-2.5','>2.5']) if(hist[k]) realConsole.log('     '+k.padEnd(9),(hist[k]/posses*100).toFixed(1)+'%');
realConsole.log('  quanto do dominio e parado:');
for(const k of ['<15%','15-35%','35-60%','60-85%','>85%']) if(histParado[k]) realConsole.log('     '+k.padEnd(9),(histParado[k]/posses*100).toFixed(1)+'%');
realConsole.log('  posses resolvidas EM MOVIMENTO (parado <35%)',(saiuAndando/posses*100).toFixed(1)+'%');
