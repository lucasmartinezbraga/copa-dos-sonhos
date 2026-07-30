#!/usr/bin/env node
'use strict';
/* O CARDAPIO DE FONTES DE ESCANTEIO — quem PODE mandar a bola pela propria linha
   =========================================================================
   Estado na R18.49: 2,22 escanteios por partida (setCorner) contra faixa 4-10 do
   gate ECO-05. O censo da linha de fundo mostra 5,44 cruzamentos por partida, dos
   quais so 24,5% tem ultimo toque da DEFESA — e sao esses que viram escanteio por
   geometria em _ballOut().

   A R18.31 provou o padrao certo nesta linhagem: nao subir sorteio, e sim deixar
   a bola VIAJAR e o reinicio nascer do ultimo toque real. Para aplicar isso ao
   escanteio e preciso saber QUAIS eventos defensivos existem perto da propria
   meta e como cada um e resolvido hoje — sorteio ou bola de verdade.

   Este instrumento mede o cardapio, com tamanho de cada fonte:
     bloqueio de chute, defesa/espalmada do goleiro, soco do goleiro, corte,
     desvio de cruzamento, cabeceio defensivo.
   Para cada um: quantas vezes por partida, a que distancia da propria meta, e se
   o desfecho passou por chance() (sorteio) ou por bola viajando.

   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-fonte', language: 'pt-BR' });
define('location', { href: 'runner://fonte', search: '', hash: '' });
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
global.console = { log: noop, warn: noop, error: noop };

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0, blocosComErro = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (e) { blocosComErro++; }
}
for (const n of ['MatchSim','autoLineup','buildDB','DATA','srand','FL','FW']) {
  if (typeof global[n] === 'undefined') { realConsole.error('ABORTA: falta ' + n); process.exit(2); }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };

const P = MatchSim.prototype;
const ev = Object.create(null);
const T = {
  setCorner: 0, cornerEvt: 0,
  saidasFundo: 0, toqueDefesa: 0, toqueAtaque: 0,
  clearBall: 0, distCorte: [],
  /* proveniencia de cada setCorner, por quadro da pilha */
  origem: Object.create(null),
  /* eventos defensivos perto da propria meta */
  defesaPertoDaMeta: 0, bloqueioPertoDaMeta: 0,
};

const oCorner = P._setCorner;
P._setCorner = function () {
  T.setCorner++;
  const st = String(new Error().stack || '').split('\n');
  let frame = '?';
  for (let k = 2; k < st.length; k++) { if (!/_setCorner/.test(st[k])) { frame = st[k].trim().replace(/^at\s+/, '').slice(0, 60); break; } }
  T.origem[frame] = (T.origem[frame] || 0) + 1;
  return oCorner.apply(this, arguments);
};

const oOut = P._ballOut;
if (typeof oOut === 'function') P._ballOut = function () {
  const b = this.ball;
  if (b && (b.x <= 0.05 || b.x >= FL - 0.05)) {
    T.saidasFundo++;
    const lt = b.lastTouch;
    if (lt) {
      const ladoDoGol = b.x <= FL / 2 ? 0 : 1;
      const defende = this.teams.findIndex(tm => tm.goal && (tm.goal.x <= FL / 2 ? 0 : 1) === ladoDoGol);
      if (defende >= 0 && lt.team === defende) T.toqueDefesa++; else T.toqueAtaque++;
    }
  }
  return oOut.apply(this, arguments);
};

const oClear = P._clearBall;
if (typeof oClear === 'function') P._clearBall = function (o) {
  T.clearBall++;
  try { const tm = this.teams[o.team]; T.distCorte.push(D(o.x, o.y, tm.goal.x, tm.goal.y)); } catch (_) {}
  return oClear.apply(this, arguments);
};

const N = Number(argv.matches || 6), DT = 1 / 30;
const SEED = Number(argv.seed || 4200000);
for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(SEED + i * 7919);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  const oEmit = Object.getPrototypeOf(sim)._emit;
  sim._emit = function (t, d) {
    ev[t] = (ev[t] || 0) + 1;
    if (t === 'corner') T.cornerEvt++;
    try {
      /* distancia do evento defensivo a propria meta, quando da para saber */
      if (t === 'save' || t === 'block' || t === 'header_clear') {
        const b = this.ball;
        if (b && Number.isFinite(b.x)) {
          const perto = Math.min(b.x, FL - b.x) < 20;
          if (perto && t === 'save') T.defesaPertoDaMeta++;
          if (perto && t !== 'save') T.bloqueioPertoDaMeta++;
        }
      }
    } catch (_) {}
    return oEmit.apply(this, arguments);
  };
  let s = 0; while (!sim.isOver() && s++ < 400000) sim.step(DT);
}

const nPart = N * 3;
const per = v => +(v / nPart).toFixed(2);
const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(b.length * p)].toFixed(1); };
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);

/* eventos que sao candidatos naturais a mandar a bola pela propria linha */
const CANDIDATOS = ['save','gk_punch','gk_claim','header_clear','block','shot_blocked','deflection','clear_behind','tackle','intercept','miscontrol_out'];
const cardapio = {};
for (const k of CANDIDATOS) if (ev[k]) cardapio[k] = { total: ev[k], porPartida: per(ev[k]) };

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), sha: sha.slice(0, 12), blocosComErro, partidas: nPart,
  ESCANTEIO_HOJE: {
    setCorner_chamado: T.setCorner, porPartida: per(T.setCorner),
    evento_corner: T.cornerEvt, evento_porPartida: per(T.cornerEvt),
    faixaECO05: '4 a 10',
    proveniencia: Object.fromEntries(Object.entries(T.origem).sort((a, b) => b[1] - a[1])),
  },
  LINHA_DE_FUNDO: {
    cruzamentos: T.saidasFundo, cruzamentos_porPartida: per(T.saidasFundo),
    ultimoToque_DEFESA: T.toqueDefesa, defesa_porPartida: per(T.toqueDefesa),
    ultimoToque_ATAQUE: T.toqueAtaque, ataque_porPartida: per(T.toqueAtaque),
    pct_defensivo: pct(T.toqueDefesa, T.saidasFundo),
    nota: 'toque defensivo que cruza a linha e a UNICA fonte de escanteio por geometria',
  },
  CORTE: {
    _clearBall_chamado: T.clearBall, porPartida: per(T.clearBall),
    distancia_a_propria_meta: { p10: q(T.distCorte, .1), mediana: q(T.distCorte, .5), p90: q(T.distCorte, .9) },
  },
  CARDAPIO_DE_FONTES: cardapio,
  PERTO_DA_PROPRIA_META: { defesas: T.defesaPertoDaMeta, bloqueios_e_cortes: T.bloqueioPertoDaMeta },
  eventos_todos: Object.fromEntries(Object.entries(ev).sort((a, b) => b[1] - a[1]).slice(0, 45)),
}, null, 2));
