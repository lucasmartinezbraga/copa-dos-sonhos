#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-92 · QUEM ESCREVE ball.x / ball.y DURANTE O VOO DE UM CHUTE
 * ===================================================================
 *
 * POR QUE ESTE INSTRUMENTO EXISTE
 *   Medido: 27 de 63 chutes "para fora" (42,9%) cruzam a linha de fundo ENTRE
 *   as traves e por baixo do travessao. Tentei corrigir TRES vezes e as tres
 *   foram falsificadas pela medicao:
 *     v1  camada externa antes da original ... alterou alvos que ja estavam bons
 *     v2  dentro do nucleo de _startTravel .. calculou 30 correcoes, bateria
 *                                             byte a byte igual a base
 *     v3  camada externa depois da original . corrigiu ball.target 30 vezes e a
 *                                             bola foi ao alvo ANTIGO
 *   Prova da v3: alvo corrigido de 38,045 para 39,569 e a bola terminou em 38,05.
 *
 *   Conclusao: nem a camada mais externa nem o nucleo mandam na trajetoria.
 *   Alguem FOTOGRAFA o voo e o executa a partir da fotografia. Deduzir qual das
 *   quatorze camadas ja custou tres rodadas.
 *
 * METODO — HANDOFF §2A, e nao adivinhacao
 *   Setter em `ball.x` e `ball.y`. Cada escrita durante um voo de chute registra
 *   a pilha de quem escreveu. No fim, a distribuicao diz quem executa o voo.
 *
 * Nao patcha nada.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(i => {
  const [k, v] = i.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const noop = () => {};
const D = (n, v) => { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } };
D('window', global); D('self', global);
D('navigator', { userAgent: 'cds', language: 'pt-BR' });
D('location', { href: 'runner://os92', search: '', hash: '' });
D('performance', { now: () => 0 }); D('crypto', crypto.webcrypto);
D('requestAnimationFrame', () => 0); D('cancelAnimationFrame', noop);
D('addEventListener', noop); D('removeEventListener', noop);
D('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
D('alert', noop); D('confirm', () => true); D('prompt', () => null);
D('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
D('sessionStorage', global.localStorage); D('CanvasRenderingContext2D', undefined);
D('HTMLElement', function () {}); D('HTMLCanvasElement', function () {});
D('Image', function () {}); D('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
D('__showBootError', noop); D('__cdsDebugWarn', noop); D('CDS_DEBUG', false);
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
const escritores = {};       // pilha -> { n, somaDelta }
const alvoEscritores = {};   // quem escreve ball.target durante um voo
let emVoo = false, amostras = 0;

/* ARMADILHA MEDIDA: `this.ball` e SUBSTITUIDO por um objeto novo em :4768
   (_kickoff). Instrumentar o objeto que existe na construcao captura ZERO
   escritas — foi o que aconteceu na primeira versao deste instrumento. Por isso
   a sonda vive na PROPRIEDADE `ball` do simulador e se reinstala a cada troca. */
function instrumentaSim(sim) {
  let objBola = sim.ball;
  instrumentaBola(objBola);
  Object.defineProperty(sim, 'ball', {
    configurable: true,
    get() { return objBola; },
    set(v) { objBola = v; if (v) instrumentaBola(v); }
  });
}

/* Instala o setter no objeto bola. */
function instrumentaBola(b) {
  if (!b || b.__os92) return;
  try { Object.defineProperty(b, '__os92', { value: true, enumerable: false }); } catch (_) { return; }
  for (const eixo of ['x', 'y']) {
    let valor = b[eixo];
    Object.defineProperty(b, eixo, {
      configurable: true,
      get() { return valor; },
      set(v) {
        if (emVoo && v !== valor) {
          amostras++;
          let quem = '?';
          try {
            const linhas = new Error().stack.split('\n').slice(2, 6)
              .map(s => s.trim().replace(/^at\s+/, '').replace(/\s*\(.*?([^\\/]+:\d+):\d+\)$/, ' @$1'));
            quem = linhas.join(' | ').slice(0, 190);
          } catch (_) {}
          const e = escritores[quem] || (escritores[quem] = { n: 0, soma: 0 });
          e.n++; e.soma += Math.abs(v - valor);
        }
        valor = v;
      }
    });
  }
  /* e um segundo setter em ball.target, para saber quem o reescreve em voo */
  let alvo = b.target;
  Object.defineProperty(b, 'target', {
    configurable: true,
    get() { return alvo; },
    set(v) {
      if (emVoo) {
        let quem = '?';
        try {
          quem = new Error().stack.split('\n').slice(2, 5)
            .map(s => s.trim().replace(/^at\s+/, '').replace(/\s*\(.*?([^\\/]+:\d+):\d+\)$/, ' @$1'))
            .join(' | ').slice(0, 170);
        } catch (_) {}
        alvoEscritores[quem] = (alvoEscritores[quem] || 0) + 1;
      }
      alvo = v;
    }
  });
}

/* marca a janela de voo de CHUTE */
const oST = P._startTravel;
P._startTravel = function (o, target, kind) {
  const r = oST.apply(this, arguments);
  if (kind === 'shot') emVoo = true;
  return r;
};
const oBT = P._ballTravel;
P._ballTravel = function () {
  const r = oBT.apply(this, arguments);
  if (!this.ball.traveling) emVoo = false;
  return r;
};

const db = buildDB(DATA);
const N = Number(argv.matches || 4);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  instrumentaSim(sim);
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}

const ord = Object.entries(escritores).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
const ordT = Object.entries(alvoEscritores).sort((a, b) => b[1] - a[1]).slice(0, 8);
real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  escritasDuranteVooDeChute: amostras,
  QUEM_ESCREVE_ball_xy: Object.fromEntries(ord.map(([k, v]) => [k, {
    escritas: v.n, pct: +(v.n / Math.max(1, amostras) * 100).toFixed(1),
    deslocamentoMedio_m: +(v.soma / v.n).toFixed(4)
  }])),
  QUEM_REESCREVE_ball_target_em_voo: Object.fromEntries(ordT)
}, null, 1));
