#!/usr/bin/env node
'use strict';
/*
 * OS-79 · CENSO DE INTERCEPTACAO
 * ------------------------------
 * PROXIMA_RODADA.md item 5, observacao de campo:
 *   "Tem algumas interceptacoes que a forma que acontece nao e parecido com um
 *    jogo da vida real."
 *
 * O documento marca o item como NAO DIAGNOSTICADO e manda: "Primeiro descreva o
 * defeito em numeros, nao em impressao." Este instrumento faz isso e NADA MAIS.
 * Nao patcha, nao propoe conserto.
 *
 * As cinco perguntas sao as do proprio documento:
 *
 *   1. distancia do interceptador a LINHA DO PASSE no instante da interceptacao
 *      — se for grande, ele esta puxando a bola de longe (teleporte de posse);
 *   2. angulo entre o corpo dele e a bola — interceptar de costas denuncia;
 *   3. velocidade dele no instante — interceptar parado, sem passo, e irreal;
 *   4. quanto tempo a bola ja estava no ar — interceptacao instantanea na saida
 *      do passe nao existe no futebol;
 *   5. o que acontece com a bola depois — ela para no pe dele? No futebol a
 *      maior parte das interceptacoes DESVIA a bola, nao a captura.
 *
 * A quinta e a mais importante, porque e a assinatura do padrao que o HANDOFF
 * §4 descreve: "o desfecho existe na estatistica e nao tem consequencia
 * fisica". Se toda interceptacao virar posse limpa, o defeito e desse tipo.
 *
 * NOTA DE METODO. O gancho e no evento e no metodo, e le o estado ANTES de
 * delegar. Nao seleciono quadros por condicao correlacionada com o que quero
 * medir — o HANDOFF §6 registra que isso ja produziu "media de velocidade
 * 0,86 m/s num jogo cuja media real e 3,92".
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
  try { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  catch (_) { global[name] = value; }
}
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-os79', language: 'pt-BR' });
define('location', { href: 'runner://os79', search: '', hash: '' });
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
if (!argv.build) { realConsole.error('ABORTA: informe --build=<html>'); process.exit(1); }
const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match, index = 0;
while ((match = scriptRe.exec(html))) {
  const id = (match[1].match(/id="([^"]+)"/) || [])[1] || `script-${index}`;
  index++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(match[2], { filename: id + '.js' }); } catch (_) {}
}
for (const n of ['MatchSim','autoLineup','buildDB','DATA','srand','FL','FW']) {
  if (typeof global[n] === 'undefined') { realConsole.error('ABORTA: falta ' + n); process.exit(2); }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, home) => {
  const p = autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: form, style: 'balanced' };
};

const P = MatchSim.prototype;
const R = { distLinha: [], angulo: [], veloc: [], tempoNoAr: [], virouPosse: 0, virouDesvio: 0, total: 0, semDono: 0 };

/* distancia de um ponto ao segmento origem->alvo da bola */
function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  if (L2 < 1e-9) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const proto = P;
const oldEmit = proto._emit;
let simAtual = null;
proto._emit = function (t, d) {
  if (t === 'intercept') {
    try {
      const b = this.ball, quem = d && (d.by || d.player || d.d);
      if (b && quem && Number.isFinite(quem.x)) {
        R.total++;
        /* 1. distancia a linha do passe */
        const from = b.from || { x: b.x, y: b.y };
        const alvo = b.target || { x: b.x, y: b.y };
        R.distLinha.push(distSegmento(quem.x, quem.y, from.x, from.y, alvo.x, alvo.y));
        /* 2. angulo entre a direcao do corpo e a bola */
        const vx = quem.vx || 0, vy = quem.vy || 0, vL = Math.hypot(vx, vy);
        const bx = b.x - quem.x, by = b.y - quem.y, bL = Math.hypot(bx, by);
        if (vL > 0.2 && bL > 0.05) {
          const cos = (vx * bx + vy * by) / (vL * bL);
          R.angulo.push(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
        }
        /* 3. velocidade no instante */
        R.veloc.push(vL);
        /* 4. tempo que a bola ja estava no ar */
        R.tempoNoAr.push(Number.isFinite(b.travelT) ? b.travelT : 0);
      }
    } catch (_) {}
  }
  return oldEmit.apply(this, arguments);
};

const N = Number(argv.matches || 8), DT = 1 / 30;
const FORMS = ['4-3-3', '4-4-2', '3-5-2'];
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  simAtual = sim;
  /* 5. o que acontece com a bola DEPOIS: amostra o quadro seguinte */
  const oStep = sim.step.bind(sim);
  let pend = 0;
  const oEmit2 = sim._emit;
  sim._emit = function (t) { if (t === 'intercept') pend = 2; return oEmit2.apply(this, arguments); };
  let st = 0;
  while (!sim.isOver() && st++ < 400000) {
    oStep(DT);
    if (pend > 0) {
      pend--;
      if (pend === 0) {
        const b = sim.ball;
        if (b && b.owner) R.virouPosse++;
        else if (b && (b.traveling || Math.hypot(b.vx || 0, b.vy || 0) > 1)) R.virouDesvio++;
        else R.semDono++;
      }
    }
  }
}

const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const i = Math.min(s.length - 1, Math.floor(s.length * p)); return +s[i].toFixed(2); };
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), sha: sha.slice(0, 12), partidas: N,
  interceptacoes: R.total, porPartida: +(R.total / N).toFixed(2),
  '1_distancia_a_linha_do_passe_m': { p10: q(R.distLinha, .1), mediana: q(R.distLinha, .5), p90: q(R.distLinha, .9), max: q(R.distLinha, 1) },
  '2_angulo_corpo_x_bola_graus': { mediana: q(R.angulo, .5), p90: q(R.angulo, .9), nota: '0 = indo na direcao da bola; 180 = de costas' },
  '3_velocidade_no_instante_ms': { p10: q(R.veloc, .1), mediana: q(R.veloc, .5), p90: q(R.veloc, .9), parados_abaixo_0_5: pct(R.veloc.filter(v => v < 0.5).length, R.veloc.length) },
  '4_tempo_da_bola_no_ar_s': { p10: q(R.tempoNoAr, .1), mediana: q(R.tempoNoAr, .5), p90: q(R.tempoNoAr, .9), instantaneas_abaixo_0_1s: pct(R.tempoNoAr.filter(v => v < 0.1).length, R.tempoNoAr.length) },
  '5_desfecho_da_bola': { virou_posse: R.virouPosse, virou_desvio: R.virouDesvio, parada_sem_dono: R.semDono, pct_posse: pct(R.virouPosse, R.virouPosse + R.virouDesvio + R.semDono), nota: 'no futebol a maior parte DESVIA, nao captura' },
}, null, 2));
