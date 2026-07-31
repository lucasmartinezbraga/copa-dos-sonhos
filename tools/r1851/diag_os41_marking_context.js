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
/* OS-40e · a cobertura e medida enquanto o time DEFENDE ou tambem enquanto ATACA? */
const MK=Number(argv.matches||8), DTK=1/30;
let tot=0,cov=0;
const ctx={defendendo:{t:0,c:0},atacando:{t:0,c:0},solta:{t:0,c:0}};
const dist={defendendo:{t:0,c:0},meio:{t:0,c:0},longe:{t:0,c:0}};
for(let i=0;i<MK;i++){
  const sim=novoSim(4200000+i*7919,FORMS[i%FORMS.length]);
  let st=0,am=0;
  while(!sim.isOver()&&st++<500000){
    sim.step(DTK);
    if((am+=DTK)<0.5)continue; am=0;
    for(const tm of sim.teams){
      const att=sim.teams[1-tm.side], owner=sim.ball.owner;
      const eleg=tm.players.filter(p=>!p.red&&!p.isGK&&!['ST','CF','LW','RW','SS'].includes(p.slotPos));
      const gx=tm.goal.x,gy=tm.goal.y;
      const situacao = !owner ? 'solta' : (owner.team===tm.side ? 'atacando' : 'defendendo');
      for(const a of att.players){
        if(a.red||a.isGK)continue;
        const gd=Math.hypot(a.x-gx,a.y-gy);
        const isFwd=['ST','CF','LW','RW','SS'].includes(a.slotPos);
        const isMid=['CAM','LM','RM','LWB','RWB'].includes(a.slotPos);
        const ameaca=isFwd?(gd<56||a._runDeep||a._breaking||a===owner)
                    :isMid?(gd<43||a._breaking||a._runDeep||(a===owner&&gd<64)):false;
        if(!ameaca)continue;
        let close=false,gs=false;
        for(const p of eleg){
          const dd=Math.hypot(p.x-a.x,p.y-a.y);
          if(dd<=9)close=true;
          if(dd<=8.5&&Math.hypot(p.x-gx,p.y-gy)+.5<gd&&Math.abs(p.y-a.y)<=7.5)gs=true;
        }
        const c=close&&gs;
        tot++;if(c)cov++;
        ctx[situacao].t++; if(c)ctx[situacao].c++;
        const faixa = gd<30?'defendendo':gd<45?'meio':'longe';
        dist[faixa].t++; if(c)dist[faixa].c++;
      }
    }
  }
}
realConsole.log('  build',argv.build.replace(/^.*\//,''),'| amostras',tot,'| cobertura global',(cov/tot*100).toFixed(1)+'%');
realConsole.log('  por SITUACAO do time observado:');
for(const k of Object.keys(ctx)) if(ctx[k].t) realConsole.log('    '+k.padEnd(12),(ctx[k].t/tot*100).toFixed(1)+'% das amostras | cobertura',(ctx[k].c/ctx[k].t*100).toFixed(1)+'%');
realConsole.log('  por DISTANCIA da ameaca ao gol observado:');
for(const k of Object.keys(dist)) if(dist[k].t) realConsole.log('    '+k.padEnd(12),(dist[k].t/tot*100).toFixed(1)+'% das amostras | cobertura',(dist[k].c/dist[k].t*100).toFixed(1)+'%');
