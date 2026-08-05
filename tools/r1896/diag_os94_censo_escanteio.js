#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-94 · POR QUE O JOGO TEM METADE DOS ESCANTEIOS DO FUTEBOL
 * ================================================================
 * Medido: 4,6 a 5,3 escanteios por partida em todas as builds. Futebol real:
 * ~10 a 11. O gate ECO-05 (4 a 10) fica logo acima do piso e estoura com
 * qualquer perturbacao.
 *
 * Antes de mexer em qualquer coisa, responder:
 *   A) quantas vezes a bola cruza a linha de fundo, por QUAL rota?
 *   B) dessas, quantas viram escanteio e quantas viram tiro de meta?
 *   C) quantos escanteios sao "administrativos" (chance() de alguma camada) e
 *      quantos nascem de bola fisicamente fora?
 *   D) quantos DESVIOS de defensor acontecem perto da propria linha -- que no
 *      futebol e a fonte principal de escanteio -- e quantos deles saem?
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
D('location', { href: 'runner://os94', search: '', hash: '' });
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
const FLv = 105, FWv = 68;
const C = {
  cornersContados: 0,          // incrementos reais de stats.corners
  setCornerChamado: 0,
  ballOut_total: 0, ballOut_fundo: 0, ballOut_lateral: 0,
  fundo_virouEscanteio: 0, fundo_virouTiroDeMeta: 0,
  goalKickOrRestart: 0,
  desvioDefensivo: 0,          // _deflectTo por defensor
  desvioPertoDaLinha: 0,       // ... com a bola a menos de 16 m da propria linha
  desvioQueSaiu: 0,            // ... e que terminou fora pela linha de fundo
  clearance: 0,                // _clearBall
  clearancePertoDaLinha: 0
};
const origemCorner = {};

/* incrementos reais de stats.corners */
const oSet = P._setCorner;
P._setCorner = function (team) {
  C.setCornerChamado++;
  const antes = this.stats && this.stats[team] ? (this.stats[team].corners || 0) : null;
  let quem = '?';
  try {
    quem = new Error().stack.split('\n').slice(2, 6)
      .map(s => s.trim().replace(/^at\s+/, '').replace(/\s*\(.*?([^\\/]+:\d+):\d+\)$/, ' @$1'))
      .join(' | ');
    const alvos = ['_ballOut', '_gkResolveSave', '_shoot', '_cross', '_header', '_deflect', '_looseBall', 'pendingRestart'];
    const a = alvos.filter(x => quem.indexOf(x) >= 0);
    quem = a.length ? a.join('+') : quem.slice(0, 80);
  } catch (_) {}
  const r = oSet.apply(this, arguments);
  const dep = this.stats && this.stats[team] ? (this.stats[team].corners || 0) : null;
  if (antes != null && dep != null && dep > antes) {
    C.cornersContados += (dep - antes);
    origemCorner[quem] = (origemCorner[quem] || 0) + (dep - antes);
  }
  return r;
};

const oOut = P._ballOut;
P._ballOut = function () {
  const b = this.ball;
  C.ballOut_total++;
  const fundo = (b.x <= 0 || b.x >= FLv);
  if (fundo) {
    C.ballOut_fundo++;
    const lineX = b.x >= FLv ? FLv : 0;
    const att = this.teams[0].oppGoal.x === lineX ? 0 : 1;
    const ultimo = b.lastTouch ? b.lastTouch.team : this.poss;
    if (ultimo !== att) C.fundo_virouEscanteio++; else C.fundo_virouTiroDeMeta++;
  } else C.ballOut_lateral++;
  return oOut.apply(this, arguments);
};

const oGK = P._goalKickOrRestart;
P._goalKickOrRestart = function () { C.goalKickOrRestart++; return oGK.apply(this, arguments); };

/* desvios defensivos: quem defletiu, e a que distancia da propria linha */
const oDefl = P._deflectTo;
if (typeof oDefl === 'function') {
  P._deflectTo = function (x, y, spd) {
    try {
      const b = this.ball, t = b.lastTouch;
      if (t) {
        const propria = this.teams[t.team].goal;
        const d = Math.abs(b.x - propria.x);
        C.desvioDefensivo++;
        if (d <= 16) {
          C.desvioPertoDaLinha++;
          const foraX = (x <= 0 || x >= FLv);
          if (foraX) C.desvioQueSaiu++;
        }
      }
    } catch (_) {}
    return oDefl.apply(this, arguments);
  };
}
const oClear = P._clearBall;
if (typeof oClear === 'function') {
  P._clearBall = function (p) {
    try {
      C.clearance++;
      if (p && this.teams[p.team]) {
        const g = this.teams[p.team].goal;
        if (Math.abs(p.x - g.x) <= 16) C.clearancePertoDaLinha++;
      }
    } catch (_) {}
    return oClear.apply(this, arguments);
  };
}

const db = buildDB(DATA);
const N = Number(argv.matches || 12);
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
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const pp = v => +(v / N).toFixed(3);
real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  ESCANTEIOS_por_partida: pp(C.cornersContados),
  referencia_real: '~10 a 11 por partida (soma dos dois times)',
  origem_dos_escanteios: Object.fromEntries(Object.entries(origemCorner).map(([k, v]) => [k, pp(v)])),
  BOLA_FORA_por_partida: {
    total: pp(C.ballOut_total),
    pela_linha_de_fundo: pp(C.ballOut_fundo),
    pela_lateral: pp(C.ballOut_lateral),
    fundo_virou_escanteio: pp(C.fundo_virouEscanteio),
    fundo_virou_tiro_de_meta: pp(C.fundo_virouTiroDeMeta)
  },
  tiroDeMeta_ou_reinicio_por_partida: pp(C.goalKickOrRestart),
  DESVIOS_defensivos_por_partida: {
    total: pp(C.desvioDefensivo),
    a_menos_de_16m_da_propria_linha: pp(C.desvioPertoDaLinha),
    que_terminaram_fora_pela_linha: pp(C.desvioQueSaiu)
  },
  cortes_por_partida: { total: pp(C.clearance), perto_da_propria_linha: pp(C.clearancePertoDaLinha) }
}, null, 1));
