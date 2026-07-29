#!/usr/bin/env node
'use strict';
/* A PROMESSA DE VELOCIDADE DO PLANEJADOR CHEGA A MORDER?
   -------------------------------------------------------------------------
   `patch_gkparidade.js` troca moveSpeed de 6,2+q*2,8 (= 8,53 m/s nos goleiros
   de Brasil 1970) por min(isso, p.maxSpd) (= 6,05 m/s). Deveria mudar o jogo.
   NAO MUDOU NADA: bateria n=48 do sub_e e byte-identica a do sub_c em todas as
   14 metricas e em todos os eventos.

   Antes de declarar o gate CAU-04 fechado — ou de culpar a promessa pelo
   residuo de 17,75% de CAU-03 — e preciso saber se a promessa MORDE. Duas
   explicacoes possiveis:

     (a) `_gkInterceptTarget` quase nunca e chamado;
     (b) e chamado, mas o ponto escolhido tem margem tao folgada que continua
         valido mesmo a 6,05 m/s — e o `score` quase nao depende da margem
         (o termo de margem e limitado a 0,12 e o peso e 0,018).

   Este instrumento reimplementa a varredura dos 73 pontos com os DOIS modelos
   de velocidade, no instante de cada chamada real, e compara:
     - quantas chamadas devolvem ponto em cada modelo;
     - quantas vezes o ponto ESCOLHIDO muda;
     - a margem do ponto escolhido no modelo antigo (se e folgada, (b) explica).
   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-gkp', language: 'pt-BR' });
define('location', { href: 'runner://gkp', search: '', hash: '' });
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
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (e) {}
}
for (const n of ['MatchSim','autoLineup','buildDB','DATA','srand']) {
  if (typeof global[n] === 'undefined') { realConsole.error('ABORTA: falta ' + n); process.exit(2); }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };

const P = MatchSim.prototype;
/* Reimplementa a varredura do motor, parametrizada pela velocidade. */
function varre(sim, gk, sx, sy, goalTarget, shotSpeed, contactRadius, velocidade) {
  const ox = (sim.ball && Number.isFinite(sim.ball.x)) ? sim.ball.x : sx;
  const oy = (sim.ball && Number.isFinite(sim.ball.y)) ? sim.ball.y : sy;
  const total = D(ox, oy, goalTarget.x, goalTarget.y);
  if (total < .25) return null;
  const speed = Math.max(16, shotSpeed || 40);
  const quality = clamp(facet(gk, 'gk') / 100, .30, 1);
  const reaction = .11 + (1 - quality) * .19;
  const moveSpeed = velocidade;
  const radius = contactRadius == null ? 1.90 : contactRadius;
  const projection = clamp(sim._projT(ox, oy, goalTarget.x, goalTarget.y, gk.x, gk.y), .08, .985);
  const minT = clamp(Math.max(.08, 2.25 / total), .08, .72);
  let best = null;
  for (let i = 0; i <= 72; i++) {
    const t = minT + (0.985 - minT) * (i / 72);
    const x = lerp(ox, goalTarget.x, t), y = lerp(oy, goalTarget.y, t);
    const ballTime = (total * t) / speed;
    const moveTime = Math.max(0, ballTime - reaction);
    const centerTravel = moveSpeed * moveTime;
    const required = Math.max(0, D(gk.x, gk.y, x, y) - radius);
    const margin = centerTravel - required;
    if (margin < -.035) continue;
    const score = Math.abs(t - projection) - Math.min(.12, Math.max(0, margin) * .018);
    if (!best || score < best.score) best = { x, y, t, margin, score };
  }
  return best;
}

const T = { chamadas: 0, antigoAchou: 0, novoAchou: 0, novoNulo: 0, pontoMudou: 0, margens: [], desloc: [], velocidades: [] };
const oPlan = P._gkInterceptTarget;
P._gkInterceptTarget = function (gk, sx, sy, goalTarget, shotSpeed, contactRadius) {
  const r = oPlan.apply(this, arguments);
  try {
    if (gk && goalTarget) {
      T.chamadas++;
      const q = clamp(facet(gk, 'gk') / 100, .30, 1);
      const vAntigo = 6.2 + q * 2.8;
      const vNovo = Number.isFinite(gk.maxSpd) ? gk.maxSpd : 7;
      if (T.velocidades.length < 3) T.velocidades.push({ antigo: +vAntigo.toFixed(2), novo: +vNovo.toFixed(2) });
      const a = varre(this, gk, sx, sy, goalTarget, shotSpeed, contactRadius, vAntigo);
      const b = varre(this, gk, sx, sy, goalTarget, shotSpeed, contactRadius, vNovo);
      if (a) { T.antigoAchou++; T.margens.push(+a.margin.toFixed(2)); }
      if (b) T.novoAchou++; else if (a) T.novoNulo++;
      if (a && b) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0.05) { T.pontoMudou++; T.desloc.push(+d.toFixed(2)); }
      }
    }
  } catch (_) {}
  return r;
};

const N = Number(argv.matches || 6), DT = 1 / 30;
for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(1710000 + i * 977);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  let s = 0; while (!sim.isOver() && s++ < 400000) sim.step(DT);
}

const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(b.length * p)].toFixed(2); };
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), partidas: N * 3,
  velocidadesModeladas: T.velocidades,
  CHAMADAS: { total: T.chamadas, porPartida: +(T.chamadas / (N * 3)).toFixed(2) },
  ACHOU_PONTO: { modeloAntigo: T.antigoAchou, modeloMaxSpd: T.novoAchou, virouNulo: T.novoNulo, pctVirouNulo: pct(T.novoNulo, T.antigoAchou) },
  PONTO_ESCOLHIDO: { mudou: T.pontoMudou, pct: pct(T.pontoMudou, T.antigoAchou), deslocamento_m: { mediana: q(T.desloc, .5), p90: q(T.desloc, .9) } },
  MARGEM_DO_PONTO_ESCOLHIDO_modeloAntigo_m: { p10: q(T.margens, .1), mediana: q(T.margens, .5), p90: q(T.margens, .9),
    nota: 'se a margem for folgada, baixar a promessa nao invalida o ponto e o plano nao muda — o que explica a bateria identica' },
}, null, 2));
