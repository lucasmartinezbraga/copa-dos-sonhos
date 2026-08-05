#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-89 · DUAS AFIRMACOES MINHAS QUE PRECISO CHECAR
 * ======================================================
 * No relatorio da rodada anterior eu escrevi duas coisas que podem estar
 * erradas por artefato de instrumento. Checar antes de virarem verdade.
 *
 * (1) "a rotina CURTA nunca acontece: 0 de 60"
 *     A decisao esta em :6905-6916 e depende de `aerialEdge`, que e a diferenca
 *     entre o melhor cabeceador do ataque e o melhor da defesa. O protocolo
 *     espelho_30 usa Brasil 1970 dos DOIS lados -> aerialEdge = 0 SEMPRE ->
 *     `aerialEdge > -5` sempre verdadeiro -> nunca cai em `short`.
 *     Se for isso, o "0 de 60" e artefato do meu protocolo, nao defeito do jogo.
 *     Aqui a divisao de rotina e medida com elencos DIFERENTES.
 *
 * (2) "0 gol em 35 diretas, 54% de defesa"
 *     `resolveFreeKickPhysics` e funcao PURA: da para amostra-la milhares de
 *     vezes sem simular partida. Assim se separa "o modelo converte pouco" de
 *     "a amostra era pequena".
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
D('location', { href: 'runner://os89', search: '', hash: '' });
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

/* ── (2) o modelo puro, 200 mil amostras ────────────────────────────────── */
srand(20260803);
const cenarios = [
  { n: 'batedor 90 x goleiro 75, 22 m', t: 90, k: 75, d: 22 },
  { n: 'batedor 90 x goleiro 75, 28 m', t: 90, k: 75, d: 28 },
  { n: 'batedor 75 x goleiro 75, 25 m', t: 75, k: 75, d: 25 },
  { n: 'batedor 60 x goleiro 80, 30 m', t: 60, k: 80, d: 30 },
];
const modelo = {};
const N2 = Number(argv.amostras || 50000);
for (const c of cenarios) {
  const cnt = { goal: 0, save: 0, wall: 0, miss: 0 };
  let somaPGoal = 0;
  for (let i = 0; i < N2; i++) {
    const r = resolveFreeKickPhysics(c.t, c.k, c.d, null);
    cnt[r.result]++; somaPGoal += r.pGoal;
  }
  modelo[c.n] = {
    gol: +(cnt.goal / N2 * 100).toFixed(2) + '%',
    defesa: +(cnt.save / N2 * 100).toFixed(2) + '%',
    barreira: +(cnt.wall / N2 * 100).toFixed(2) + '%',
    fora: +(cnt.miss / N2 * 100).toFixed(2) + '%',
    pGoal_medio: +(somaPGoal / N2 * 100).toFixed(2) + '%',
  };
}
/* probabilidade de ver ZERO gol em 35 cobrancas, dado o modelo */
const pGolTipico = 1 - Math.pow(1 - 0.05, 35);

/* ── (1) divisao de rotina com elencos DIFERENTES ───────────────────────── */
const db = buildDB(DATA);
const FORMS = Object.keys(FORMATIONS);
const rotinas = {};
const aerialEdges = [];
const P = MatchSim.prototype;
const oEmit = P._emit;
P._emit = function (type, e) {
  if (type === 'freekick_routine' && e) rotinas[e.routine] = (rotinas[e.routine] || 0) + 1;
  return oEmit.apply(this, arguments);
};
const oFK = P._freeKick;
P._freeKick = function (team) {
  try {
    const tm = this.teams[team], opp = this.teams[1 - team];
    const a = tm.players.filter(p => !p.red && !p.isGK).sort((x, y) => facet(y, 'head_atk') - facet(x, 'head_atk'))[0];
    const d = opp.players.filter(p => !p.red && !p.isGK).sort((x, y) => facet(y, 'head_def') - facet(x, 'head_def'))[0];
    aerialEdges.push((a ? facet(a, 'head_atk') : 50) - (d ? facet(d, 'head_def') : 50));
  } catch (_) {}
  return oFK.apply(this, arguments);
};
const mk = (sq, f, h) => {
  const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
const N = Number(argv.matches || 12);
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  /* elencos DIFERENTES e variados, que e o que a partida real usa */
  const A = db.squads[(i * 17 + 3) % db.squads.length];
  const B = db.squads[(i * 29 + 41) % db.squads.length];
  const sim = new MatchSim(mk(A, FORMS[i % FORMS.length], true), mk(B, FORMS[(i + 1) % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const ae = aerialEdges.slice().sort((a, b) => a - b);
const pc = p => ae.length ? +ae[Math.min(ae.length - 1, Math.floor(p * ae.length))].toFixed(1) : null;

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  MODELO_PURO_resolveFreeKickPhysics: modelo,
  amostrasPorCenario: N2,
  probabilidade_de_ver_pelo_menos_1_gol_em_35_cobrancas_a_5pct: +(pGolTipico * 100).toFixed(1) + '%',
  ROTINAS_com_elencos_DIFERENTES: rotinas,
  partidas: N,
  aerialEdge: { n: ae.length, min: pc(0), p10: pc(.1), mediana: pc(.5), p90: pc(.9), max: pc(.999),
                fracao_abaixo_de_menos5: ae.length ? +(ae.filter(v => v <= -5).length / ae.length).toFixed(4) : null }
}, null, 1));
