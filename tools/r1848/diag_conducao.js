#!/usr/bin/env node
'use strict';
/* DIAG DE CONDUCAO — OS-08 / INT-01 / INT-02
   =========================================================================
   POR QUE. A matriz registra OS-08 como "conducao quase inexistente" com
   INT-01 = 1,18% das acoes do portador e INT-02 = 0,66 m por posse, e os alvos
   como "faixa a calibrar". As bandas de ruido declaradas sao ENORMES (24% e
   54%), o que por si ja diz que a medicao original era instavel. Nao existe
   instrumento no repositorio para nenhuma das duas.

   Alem disso a R18.47 deixou a conducao como candidata a proxima etapa: as
   oportunidades de chute saturam em ~12,0 por partida porque a posse no terco
   final satura em ~12,6%, e conduzir e um dos caminhos para chegar mais.
   Entao este instrumento mede as duas coisas ao mesmo tempo:
     - o mix de acoes do portador (INT-01) e os metros conduzidos (INT-02);
     - o efeito no terco final, para nao promover conducao que nao progride.

   COMO. Sombreia os metodos de acao na INSTANCIA do sim (a instancia vence a
   prototype, e a delegacao e imediata, entao nada de comportamento muda) e
   conta. Para metros, acumula o deslocamento real do portador nos quadros em
   que `_act === 'carry'` — deslocamento medido, nao a intencao `_tx/_ty`, que
   e o erro classico de medir a promessa em vez do corpo.

   DEFINICOES
     INT-01 acoes de conducao = chamadas de _carry / total de acoes do portador
             (acoes = _carry + _pass + _shoot + _cross + _dribble + _clearBall)
     INT-02 metros por posse  = soma do deslocamento do portador com _act='carry'
             dividida pelo numero de POSSES. Posse = periodo contiguo em que o
             mesmo TIME tem portador; troca de time encerra a posse.
     Extra: metros por CONDUCAO (por chamada de _carry), que e o numero que diz
             se cada conducao anda pouco ou se ela e rara — INT-02 sozinho
             confunde as duas causas.

   Uso: node tools/r1848/diag_conducao.js --build=X.html [--matches=48]
        [--semente=4200000] [--out=arquivo.json]
*/
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-diag-carry', language: 'pt-BR' });
define('location', { href: 'runner://diag', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('alert', noop); define('confirm', () => true); define('prompt', () => null);
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0, sOk = 0, sErr = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); sOk++; } catch (_) { sErr++; }
}
const EXIGIDOS = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','R','chance','facet','clamp','D','FL','FW'];
const falta = EXIGIDOS.filter(n => typeof global[n] === 'undefined');
if (falta.length) { realConsole.error('ABORTA: simbolos ausentes -> ' + falta.join(', ')); process.exit(2); }

const db = buildDB(DATA);
const N = Number(argv.matches || 48);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

const ACOES = ['_carry', '_pass', '_shoot', '_cross', '_dribble', '_clearBall'];
const T = { acoes: Object.create(null), posses: 0, metrosCarry: 0, quadrosCarry: 0,
            carryTF: 0, carryMeio: 0, tfPosse: 0, quadrosPosse: 0,
            metrosCarryTF: 0 };
for (const a of ACOES) T.acoes[a] = 0;

for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * 7919;
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

  /* Sombra na instancia: conta e delega no mesmo tick. Nao muda argumento,
     nao consome RNG, nao altera retorno. */
  for (const a of ACOES) {
    const orig = sim[a] || (Object.getPrototypeOf(sim) && Object.getPrototypeOf(sim)[a]);
    if (typeof orig !== 'function') continue;
    sim[a] = function () {
      T.acoes[a]++;
      /* De onde a conducao e chamada importa: no terco final ela cria chance,
         no meio ela so progride. Separar evita creditar uma pela outra. */
      if (a === '_carry') {
        const o = arguments[0];
        if (o && this.teams && this.teams[o.team]) {
          const tm = this.teams[o.team];
          const adv = tm.attackDir > 0 ? o.x : FL - o.x;
          adv > 78 ? T.carryTF++ : T.carryMeio++;
        }
      }
      return orig.apply(this, arguments);
    };
  }

  let s = 0, timeAnterior = null, px = null, py = null;
  while (!sim.isOver() && s++ < 500000) {
    sim.step(DT);
    const b = sim.ball, o = b && b.owner;
    if (!o || o.red) { timeAnterior = null; px = py = null; continue; }
    // posse: troca de time encerra a anterior
    if (timeAnterior !== o.team) { T.posses++; timeAnterior = o.team; px = py = null; }
    T.quadrosPosse++;
    const tm = sim.teams[o.team];
    const adv = tm.attackDir > 0 ? o.x : FL - o.x;
    if (adv > 78) T.tfPosse++;
    /* Metros CONDUZIDOS: deslocamento real do corpo nos quadros em que a acao
       corrente e conducao. Medir _tx/_ty seria medir a promessa. */
    if (px !== null && o._act === 'carry') {
      const d = Math.hypot(o.x - px, o.y - py);
      if (d < 3) { T.metrosCarry += d; T.quadrosCarry++; if (adv > 78) T.metrosCarryTF += d; }
    }
    px = o.x; py = o.y;
  }
}

const total = ACOES.reduce((s, a) => s + T.acoes[a], 0);
const f = (v, c = 3) => +(v).toFixed(c);
const out = {
  build: String(argv.build).split(/[\\/]/).pop(), sha256: sha,
  scripts: sOk + ' ok / ' + sErr + ' erro', partidas: N, sementeBase: SEMENTE,
  definicoes: {
    'INT-01': 'chamadas de _carry / total de acoes do portador (_carry+_pass+_shoot+_cross+_dribble+_clearBall)',
    'INT-02': 'metros de deslocamento real do portador com _act=carry, por POSSE (posse = periodo contiguo do mesmo time com portador)',
    'metros por conducao': 'os mesmos metros, por chamada de _carry — separa "conduz pouco" de "conduz raro"',
  },
  acoes_por_partida: Object.fromEntries(ACOES.map(a => [a.slice(1), f(T.acoes[a] / N)])),
  mix_pct: Object.fromEntries(ACOES.map(a => [a.slice(1), f(T.acoes[a] / Math.max(1, total) * 100)])),
  'INT-01_conducao_pct': f(T.acoes['_carry'] / Math.max(1, total) * 100),
  'INT-02_metros_por_posse': f(T.metrosCarry / Math.max(1, T.posses)),
  metros_por_conducao: f(T.metrosCarry / Math.max(1, T.acoes['_carry'])),
  metros_conduzidos_por_partida: f(T.metrosCarry / N),
  posses_por_partida: f(T.posses / N),
  conducao_terco_final_por_partida: f(T.carryTF / N),
  conducao_fora_do_terco_final_por_partida: f(T.carryMeio / N),
  metros_conduzidos_no_terco_final_por_partida: f(T.metrosCarryTF / N),
  posse_no_terco_final_pct: f(T.tfPosse / Math.max(1, T.quadrosPosse) * 100),
};
realConsole.log(JSON.stringify(out, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
