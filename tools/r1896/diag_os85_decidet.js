#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-85 · POR QUE O DOMINIO DA BOLA E INVARIANTE
 * ===================================================
 *
 * O relatorio RODADA_OS65_OS66 registra a OS-68 como FALSIFICADA: os cinco
 * tetos de `decideT` foram multiplicados por 1,8 e por 2,6 e o dominio ficou em
 * 0,45 / 0,45 / 0,45 s, mediana 0,37 nos tres pontos. A explicacao publicada
 * foi: "decideT corre livre durante o voo e chega vencido; o intervalo nunca
 * vincula".
 *
 * Esta medicao testa a explicacao, em vez de aceita-la. A hipotese e mais
 * especifica e tem consequencia pratica oposta:
 *
 *   `:6798`  this.decideT = Math.min(this.decideT, .10);
 *
 * Isto e um TETO, aplicado sobre um contador que ja esta NEGATIVO quando a bola
 * chega. `Math.min(-0.8, 0.10)` = -0.8. O teto nunca e aplicado. Multiplica-lo
 * por 2,6 da `Math.min(-0.8, 0.26)` = -0.8 -- IDENTICO. A OS-68 mexeu no VALOR
 * de uma expressao cujo OPERADOR ja a tornava inerte. Ela nao testou a
 * hipotese que queria testar.
 *
 * O que esta medicao responde, com numero:
 *   1. qual e o valor de `decideT` no instante em que um jogador recebe a bola?
 *   2. em que fracao das recepcoes o `Math.min` chega a mudar alguma coisa?
 *   3. quanto tempo de fato se passa entre receber e decidir?
 *
 * Nada e patchado aqui. So medicao.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(i => {
  const [k, v] = i.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const noop = () => {};
const define = (n, v) => { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } };
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds', language: 'pt-BR' });
define('location', { href: 'runner://os85', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
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
const real = console;
global.console = { log: noop, warn: noop, error: noop };
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
                      'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('script-' + idx); idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(m[2], { filename: id + '.js' }); } catch (_) {}
}

const P = MatchSim.prototype;

/* 1 ── quanto vale decideT quando a bola chega ao pe -------------------- */
const naRecepcao = [];      // valor de decideT ANTES do Math.min
const tetoMudou = [];       // o Math.min chegou a alterar alguma coisa?
/* O teto vive em _giveBall (:6798), nao em _receive. _giveBall e o ponto unico
   por onde TODA posse individual comeca. */
const oGive = P._giveBall;
P._giveBall = function (p) {
  const antes = this.decideT;
  const r = oGive.apply(this, arguments);
  if (p) {
    naRecepcao.push(antes);
    tetoMudou.push(this.decideT !== antes ? 1 : 0);
    this.__ultimaRecepcao = this.t;
  }
  return r;
};

/* 2 ── quanto tempo passa entre receber e a bola sair do pe -------------- */
const dwell = [];
for (const fn of ['_pass', '_shoot', '_cross', '_dribble', '_carry']) {
  const f = P[fn];
  if (typeof f !== 'function') continue;
  P[fn] = function () {
    try {
      if (this.__ultimaRecepcao != null && fn !== '_carry' && fn !== '_dribble') {
        const d = this.t - this.__ultimaRecepcao;
        if (d >= 0 && d < 25) dwell.push(d);
        this.__ultimaRecepcao = null;
      }
    } catch (_) {}
    return f.apply(this, arguments);
  };
}

const db = buildDB(DATA);
const N = Number(argv.matches || 8);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, home) => {
  const p = autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: form, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}

const ord = a => a.slice().sort((x, y) => x - y);
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN;
const R = ord(naRecepcao), Dw = ord(dwell);
const negativos = naRecepcao.filter(v => v < 0).length;

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  partidas: N,
  recepcoes: naRecepcao.length,
  decideT_no_instante_da_recepcao: {
    min: +pct(R, 0).toFixed(3), p10: +pct(R, 0.1).toFixed(3),
    mediana: +pct(R, 0.5).toFixed(3), p90: +pct(R, 0.9).toFixed(3), max: +pct(R, 0.999).toFixed(3)
  },
  fracao_ja_NEGATIVO_ao_receber: +(negativos / Math.max(1, naRecepcao.length)).toFixed(4),
  fracao_em_que_o_teto_Math_min_MUDOU_algo: +(tetoMudou.reduce((a, b) => a + b, 0) / Math.max(1, tetoMudou.length)).toFixed(4),
  tempo_entre_receber_e_soltar_s: {
    n: Dw.length, min: +pct(Dw, 0).toFixed(3), mediana: +pct(Dw, 0.5).toFixed(3),
    media: +(Dw.reduce((a, b) => a + b, 0) / Math.max(1, Dw.length)).toFixed(3),
    p90: +pct(Dw, 0.9).toFixed(3)
  }
}, null, 1));
