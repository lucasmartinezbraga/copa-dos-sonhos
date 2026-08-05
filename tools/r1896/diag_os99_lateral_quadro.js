#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-99 · POR QUE O COBRADOR DO LATERAL NAO CHEGA
 * =====================================================
 * A OS-93 matou o teleporte (salto mediano 4,475 -> 0,021 m) mas a bola passou a
 * reaparecer a 4,603 m do ponto de saida, porque `_giveBall` cola a bola no
 * cobrador e ele nao estava la. Eu NAO descobri por que ele nao chega.
 *
 * `__spTarget` E consumido em :18252, com `dead` ativo, caminhando por passo e
 * fazendo snap na chegada. Entao a maquina existe. Tres hipoteses possiveis:
 *
 *   H1  ele nao anda      -> distancia ao ponto fica constante
 *   H2  anda devagar      -> distancia cai, mas nao chega a zero na janela
 *   H3  o alvo e limpo    -> `__spTarget` vira null antes da chegada
 *
 * Este instrumento acompanha, QUADRO A QUADRO durante a bola morta do lateral:
 *   - distancia do cobrador ao ponto
 *   - se `__spTarget` ainda esta setado
 *   - quanto ele andou no quadro
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
D('location', { href: 'runner://os99', search: '', hash: '' });
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
const FLv = 105;
const dd = (a, b, c, d) => Math.hypot(a - c, b - d);
const lances = [];
let atual = null;

const oOut = P._ballOut;
P._ballOut = function () {
  const b = this.ball;
  const lateral = !(b.x <= 0 || b.x >= FLv);
  const r = oOut.apply(this, arguments);
  if (lateral) {
    /* quem a camada elegeu: o que tiver __spTarget ou _setPieceRole='taker' */
    let cand = null;
    for (const tm of this.teams) for (const p of tm.players) {
      if (p && !p.red && (p.__spTarget || p._setPieceRole === 'taker')) cand = p;
    }
    const alvo = cand && cand.__spTarget ? { x: cand.__spTarget.x, y: cand.__spTarget.y }
                                         : { x: this.ball.x, y: this.ball.y };
    atual = { taker: cand, alvo, d0: cand ? dd(cand.x, cand.y, alvo.x, alvo.y) : null,
              quadros: [], dead0: this.dead, t0: this.t,
              temSpTarget: !!(cand && cand.__spTarget) };
  }
  return r;
};

const oStep = P.step;
P.step = function (dt) {
  let antes = null;
  if (atual && atual.taker) antes = { x: atual.taker.x, y: atual.taker.y };
  const r = oStep.apply(this, arguments);
  if (atual) {
    const t = atual.taker;
    if (t && antes) {
      atual.quadros.push({
        d: +dd(t.x, t.y, atual.alvo.x, atual.alvo.y).toFixed(3),
        andou: +dd(antes.x, antes.y, t.x, t.y).toFixed(4),
        sp: t.__spTarget ? 1 : 0,
        dead: +(this.dead || 0).toFixed(3)
      });
    }
    if (!(this.dead > 0) || atual.quadros.length > 400) {
      atual.dFinal = t ? +dd(t.x, t.y, atual.alvo.x, atual.alvo.y).toFixed(3) : null;
      lances.push(atual); atual = null;
    }
  }
  return r;
};

const db = buildDB(DATA);
const N = Number(argv.matches || 6);
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

const comTaker = lances.filter(l => l.taker);
const semTaker = lances.length - comTaker.length;
const num = a => a.slice().sort((x, y) => x - y);
const pc = (a, p) => a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(3) : null;
const res = arr => ({ min: pc(num(arr), 0), p10: pc(num(arr), .1), mediana: pc(num(arr), .5), p90: pc(num(arr), .9), max: pc(num(arr), .999) });

const d0 = comTaker.map(l => l.d0).filter(Number.isFinite);
const dF = comTaker.map(l => l.dFinal).filter(Number.isFinite);
const andouTotal = comTaker.map(l => l.quadros.reduce((s, q) => s + q.andou, 0));
const quadrosComSp = comTaker.map(l => l.quadros.filter(q => q.sp).length);
const quadrosTotal = comTaker.map(l => l.quadros.length);
const passoMedio = [];
for (const l of comTaker) for (const q of l.quadros) if (q.sp && q.andou > 0) passoMedio.push(q.andou);

const chegou = dF.filter(v => v <= 0.6).length;
real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  laterais: lances.length,
  sem_cobrador_identificado: semTaker,
  com_spTarget_no_inicio: comTaker.filter(l => l.temSpTarget).length,
  distancia_INICIAL_ao_ponto_m: res(d0),
  distancia_FINAL_ao_ponto_m: res(dF),
  chegou_a_menos_de_0_6m: chegou + ' de ' + dF.length,
  quanto_ele_ANDOU_no_total_m: res(andouTotal),
  quadros_de_bola_morta: res(quadrosTotal),
  quadros_com_spTarget_ativo: res(quadrosComSp),
  passo_por_quadro_quando_spTarget_ativo_m: passoMedio.length ? res(passoMedio) : 'nenhum'
}, null, 1));
