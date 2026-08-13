#!/usr/bin/env node
/* D35-b · A ARRANCADA LEGITIMA — por que ela nao substitui o defeito.
   -------------------------------------------------------------------------
   Consertar o D35 sozinho REPROVOU: `offsides` 5,167 -> 1,043 e o volume
   ofensivo inteiro caiu junto. A causa e conhecida — os ~6 envenenados por
   partida ficavam ISENTOS do teto de impedimento em `_attackTarget:3347`:

       if (!p._breaking && !(p._burst && p._burst.kind === 'tabela') &&
           (line === 'FWD' || p === tm._thirdMan)) {
         const onsideCap = Math.max(ballProg - 0.25, this._offsideLine(tm.side) - 0.25);
         tProg = Math.min(tProg, onsideCap);
       }

   A UNICA porta legitima para atravessar esse teto e `p._breaking` — a corrida
   de ruptura de `:3191`, que ja existe. O par do D35 depende de saber por que
   ela nao basta. Esta sonda conta, por quadro e por atacante elegivel, em qual
   condicao a arrancada morre:

       ja em arrancada · esperando o cooldown · fora da janela de progresso
       · sem espaco a frente · recusada no sorteio

   E mede o que interessa para o aceite: quanto tempo um atacante passa ALEM da
   linha de impedimento, e quantos impedimentos saem disso.

   Uso: node tools/fisica/ramo-d35b.js [build.html] [partidas]
*/
'use strict';
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
function noop() {}
function def(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
def('window', global); def('self', global); def('navigator', { userAgent: 'x', language: 'pt-BR' });
def('location', { href: '', search: '', hash: '' }); def('performance', { now: () => 0 }); def('crypto', crypto.webcrypto);
def('requestAnimationFrame', () => 0); def('cancelAnimationFrame', noop); def('addEventListener', noop); def('removeEventListener', noop);
def('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop })); def('alert', noop);
def('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop }); def('sessionStorage', global.localStorage);
def('CanvasRenderingContext2D', undefined); def('HTMLElement', function () {}); def('HTMLCanvasElement', function () {});
def('Image', function () {}); def('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
def('__showBootError', noop); def('__cdsDebugWarn', noop); def('CDS_DEBUG', false);
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const BUILD = process.argv[2] || 'dist/index.html';
const N = Number(process.argv[3] || 16);
const html = fs.readFileSync(BUILD, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);
{
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(html))) {
    const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('s' + i); i++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(m[2], { filename: id }); } catch (_) {}
  }
}
const FLv = Number(global.FL) || 105, FWv = Number(global.FW) || 68;
const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

const PODE = new Set((process.env.CDS_PAPEIS||'ST,CF,CAM,LW,RW').split(','));
const M = {
  runBreaks: 0, offsides: 0, shots: 0, goals: 0,
  elegivelQuadros: 0,
  emArrancada: 0, esperandoCooldown: 0, foraDaJanela: 0, prontoEnaoDisparou: 0,
  alemDaLinha: 0, naLinha: 0, atrasDaLinha: 0,
  somaFolgaAteALinha: 0,
};
const linhaDe = (sim, side) => {
  try { return +sim._offsideLine(side); } catch (_) { return NaN; }
};

for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  const P = Object.getPrototypeOf(sim);
  sim._emit = function (type, data) {
    if (type === 'run_break') M.runBreaks++;
    return P._emit.apply(this, arguments);
  };
  let s = 0;
  while (!sim.isOver() && s++ < 500000) {
    sim.step(1 / 30);
    if (s % 15) continue;
    const b = sim.ball;
    for (const tm of sim.teams) {
      const dir = tm.attackDir, atacando = sim.poss === tm.side;
      const ballProg = dir > 0 ? +b.x : FLv - (+b.x);
      const linha = linhaDe(sim, tm.side);
      for (const p of tm.players) {
        if (!p || p.red || p.isGK || !PODE.has(p.slotPos)) continue;
        M.elegivelQuadros++;
        /* por que a arrancada nao esta acontecendo agora */
        if (p._breaking) M.emArrancada++;
        else if (!(ballProg > FLv * 0.50 && ballProg < FLv * 0.85)) M.foraDaJanela++;
        else if (+p._breakCd > 0) M.esperandoCooldown++;
        else M.prontoEnaoDisparou++;
        /* onde ele esta em relacao a linha de impedimento (so atacando) */
        if (!atacando || !Number.isFinite(linha)) continue;
        /* `_offsideLine` JA devolve PROGRESSO (ele mesmo aplica attackDir).
           Converter de novo inverte a linha do time que ataca para a esquerda —
           foi o meu erro na primeira passada desta sonda. */
        const meu = dir > 0 ? +p.x : FLv - (+p.x);
        /* impedimento real: alem do penultimo defensor E alem da bola */
        const lp = Math.max(linha, ballProg);
        const folga = meu - lp;
        M.somaFolgaAteALinha += folga;
        if (folga > 0.45) M.alemDaLinha++;
        else if (folga > -2) M.naLinha++;
        else M.atrasDaLinha++;
      }
    }
  }
  M.offsides += (+sim.stats[0].offsides || 0) + (+sim.stats[1].offsides || 0);
  M.shots += (+sim.stats[0].shots || 0) + (+sim.stats[1].shots || 0);
  M.goals += (+sim.stats[0].goals || 0) + (+sim.stats[1].goals || 0);
}

const pp = v => +(v / N).toFixed(2);
const pc = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
const posic = M.alemDaLinha + M.naLinha + M.atrasDaLinha;
console.log(JSON.stringify({
  build: sha, partidas: N,
  porPartida: { runBreaks: pp(M.runBreaks), offsides: pp(M.offsides),
    shots: pp(M.shots), goals: pp(M.goals) },
  porQueAArrancadaNaoDispara: {
    quadrosDeAtacanteElegivel: M.elegivelQuadros,
    jaEmArrancada: pc(M.emArrancada, M.elegivelQuadros) + '%',
    foraDaJanelaDeProgresso_50a85: pc(M.foraDaJanela, M.elegivelQuadros) + '%',
    esperandoCooldown_7a12s: pc(M.esperandoCooldown, M.elegivelQuadros) + '%',
    prontoMasNaoDisparou_semEspacoOuSorteio: pc(M.prontoEnaoDisparou, M.elegivelQuadros) + '%',
  },
  posicaoRelativaALinha_atacando: {
    amostras: posic,
    alemDaLinha: pc(M.alemDaLinha, posic) + '%',
    naLinha_ate2m: pc(M.naLinha, posic) + '%',
    atrasDaLinha: pc(M.atrasDaLinha, posic) + '%',
    folgaMedia_m: +(M.somaFolgaAteALinha / Math.max(1, posic)).toFixed(2),
  },
}, null, 2));
