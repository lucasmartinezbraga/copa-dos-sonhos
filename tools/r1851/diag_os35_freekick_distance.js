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
 * OS-35 · CENSO DE DISTANCIA NA COBRANCA DE FALTA
 * Para cada falta: do apito ate a bola sair, amostra a MENOR distancia de um
 * adversario ate a bola, quantos adversarios estao dentro de 9,15 m, e se
 * algum ADIANTOU (chegou mais perto durante a espera).
 * ------------------------------------------------------------------------- */
const M = Number(argv.matches || 8);
const DTF = 1/60;
let faltas = 0, comInvasor = 0;
let somaMin = 0, somaDentroInicio = 0, somaDentroFim = 0, somaAvanco = 0;
let piorMin = 99, listaMin = [];

for (let i = 0; i < M; i++) {
  const sim = novoSim(4200000 + i*7919, FORMS[i % FORMS.length]);
  let watch = null;
  const oldEmit = sim._emit ? null : null;
  const P = Object.getPrototypeOf(sim);
  // observa via envelope de instancia
  sim._emit = function(type, data){
    const r = P._emit.apply(this, arguments);
    if (type === 'freekick_routine' && data) {
      watch = { team: data.team, x: this.ball.x, y: this.ball.y,
                min: 99, dentroIni: null, dentroFim: 0, t0: this.t };
    }
    return r;
  };
  let st = 0;
  while (!sim.isOver() && st++ < 500000) {
    sim.step(DTF);
    if (watch) {
      const b = sim.ball;
      // a janela FECHA antes de amostrar: com a bola em voo a distancia ate ela
      // nao mede mais aproximacao na cobranca, mede a trajetoria do chute.
      const saiuAgora = b.traveling || (b.owner && b.owner.team !== watch.team) || (sim.t - watch.t0) > 6;
      if (saiuAgora && watch.dentroIni != null) {
        faltas++;
        somaMin += watch.min;
        somaDentroInicio += watch.dentroIni;
        somaDentroFim += watch.dentroFim;
        if (watch.min < 9.15) comInvasor++;
        if (watch.min < piorMin) piorMin = watch.min;
        listaMin.push(watch.min);
        watch = null;
        continue;
      }
      const opp = sim.teams[1-watch.team].players.filter(p=>!p.red&&!p.isGK);
      let mn = 99, dentro = 0;
      for (const p of opp) {
        const d = Math.hypot(p.x-b.x, p.y-b.y);
        if (d < mn) mn = d;
        if (d < 9.15) dentro++;
      }
      if (watch.dentroIni == null) watch.dentroIni = dentro;
      if (mn < watch.min) watch.min = mn;
      watch.dentroFim = dentro;
    }
  }
}
listaMin.sort((a,b)=>a-b);
realConsole.log('  build            ', argv.build.replace(/^.*\//,''));
realConsole.log('  partidas         ', M);
realConsole.log('  faltas cobradas  ', faltas, '(', (faltas/M).toFixed(2), '/partida )');
realConsole.log('  menor dist adv media   ', (somaMin/Math.max(1,faltas)).toFixed(2), 'm');
realConsole.log('  pior caso              ', piorMin.toFixed(2), 'm');
realConsole.log('  mediana                ', (listaMin[Math.floor(listaMin.length/2)]||0).toFixed(2), 'm');
realConsole.log('  cobrancas com adversario dentro de 9,15 m ', comInvasor, '=', (comInvasor/Math.max(1,faltas)*100).toFixed(1)+'%');
realConsole.log('  adversarios dentro de 9,15 m (inicio)  ', (somaDentroInicio/Math.max(1,faltas)).toFixed(2));
realConsole.log('  adversarios dentro de 9,15 m (na saida)', (somaDentroFim/Math.max(1,faltas)).toFixed(2));
