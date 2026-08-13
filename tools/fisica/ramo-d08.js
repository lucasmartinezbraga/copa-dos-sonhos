#!/usr/bin/env node
/* D08 · RECONTAGEM ANTES DE ATACAR — quem manda a bola, e para onde.
   -------------------------------------------------------------------------
   A ficha do D08 manda recontar: "dos 5 pontos de chamada que este defeito
   listava, UM estava dentro do ramo morto de _cross e sumiu com a limpeza da
   D03. O clamp sobrevivente no motor e o do alivio na barreira; os demais
   estao nas camadas."

   `direcao.js` ja mediu o AGREGADO (85,8% dos alvos a mais de 8 m da lateral).
   O agregado nao diz em que porta bater. Esta sonda atribui CADA chamada de
   `_deflectTo` e `_looseBall` ao seu ponto de chamada real, lendo a pilha de
   execucao no topo — antes de qualquer camada reescrever o alvo.

   Publica, por ponto de chamada:
     - chamadas por partida
     - distancia media do alvo ate a lateral
     - quantas ja miram para fora (<= 0)
     - quantas caem na janela de 8,2 m em que a camada 45 poderia deixar sair
     - quantas a camada 45 DE FATO reescreveu para fora

   E mede o unico mecanismo que hoje manda a bola para fora de proposito,
   `_r19ClearOut` (camada 86): tentativas, recusas e por que.

   Uso: node tools/fisica/ramo-d08.js [build.html] [partidas]
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
const N = Number(process.argv[3] || 40);
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
if (typeof MatchSim === 'undefined') { console.error('MatchSim nao carregou'); process.exit(1); }

const FLv = Number(global.FL) || 105, FWv = Number(global.FW) || 68;
const DT = 1 / 30, SEMENTE = 4200000, INC = 7919;
Error.stackTraceLimit = 40;

/* ------------------------------------------------------------- medidores */
const porChamador = new Map();     /* id -> {n, somaLat, fora, janela, reescritos} */
const clearOut = { header: { tent: 0, ok: 0 }, poke: { tent: 0, ok: 0 }, clear: { tent: 0, ok: 0 } };
const recusa = { longeDaPropriaLinha: 0, sorteio: 0, outro: 0 };
let clearBall = 0, deflect = 0, loose = 0;
let somaLat = 0, foraLat = 0, janela82 = 0, reescritos = 0;

/* ONDE A BOLA VIVE — a pergunta que o histograma de ALVOS nao responde.
   Se a bola nunca chega perto da linha lateral, nenhuma mudanca de direcao
   de desvio produz lateral: o desvio so pode mandar para fora o que ja esta
   perto. Faixas = distancia da bola ate a lateral mais proxima. */
const BANDAS = [1, 3, 6, 10, 17, 34];
const tempoBanda = new Array(BANDAS.length).fill(0);
let tempoTotal = 0, somaBolaLat = 0, amostras = 0;
/* quase-saidas: a bola encostou a <=1,5 m da lateral e voltou */
let encostou = 0, encostouEsteLance = false;
const saidaPorBorda = { touchline: 0, endline: 0 };
/* a bola e central porque os JOGADORES sao centrais, ou apesar deles? */
let somaJog = 0, nJog = 0, somaMaisAberto = 0, nQuadros = 0;
const tempoJog = new Array(BANDAS.length).fill(0);
/* e o alvo do PASSE — onde o portador escolhe por a bola */
let nPasse = 0, somaPasseLat = 0;
const passeBanda = new Array(BANDAS.length).fill(0);

function slot(id) {
  let s = porChamador.get(id);
  if (!s) { s = { n: 0, somaLat: 0, fora: 0, janela: 0, reescritos: 0 }; porChamador.set(id, s); }
  return s;
}
/* o primeiro quadro da pilha que NAO e esta sonda e o ponto de chamada real */
function chamador() {
  const st = new Error().stack || '';
  const linhas = st.split('\n').slice(1);
  for (const l of linhas) {
    if (l.indexOf('ramo-d08') >= 0) continue;
    const m = l.match(/\(?([^()\s]+):(\d+):(\d+)\)?\s*$/);
    if (!m) continue;
    const arq = m[1];
    if (/node:|ramo-d08/.test(arq)) continue;
    return arq.replace(/^cds-/, '') + ':' + m[2];
  }
  return '???';
}

function instrumentar(sim) {
  const P = Object.getPrototypeOf(sim);
  const registra = (x, y, id) => {
    const dLat = Math.min(+y, FWv - (+y));
    const s = slot(id);
    s.n++; s.somaLat += dLat;
    somaLat += dLat;
    if (dLat <= 0) { s.fora++; foraLat++; }
    else if (dLat <= 8.2) { s.janela++; janela82++; }
    return s;
  };
  sim._deflectTo = function (x, y, spd) {
    deflect++;
    const id = chamador();
    const s = registra(x, y, id);
    const r = P._deflectTo.call(this, x, y, spd);
    const b = this.ball;
    if (b && b.target && (Math.abs(b.target.y - y) > 0.05 || Math.abs(b.target.x - x) > 0.05)) {
      s.reescritos++; reescritos++;
    }
    return r;
  };
  sim._looseBall = function (x, y) {
    loose++;
    const id = chamador();
    const s = registra(x, y, id);
    const r = P._looseBall.call(this, x, y);
    const b = this.ball;
    if (b && b.target && (Math.abs(b.target.y - y) > 0.05 || Math.abs(b.target.x - x) > 0.05)) {
      s.reescritos++; reescritos++;
    }
    return r;
  };
  /* amostragem por quadro: so com a bola VIVA (dead<=0), senao o tempo parado
     domina o histograma e responde outra pergunta */
  sim.step = function (dt) {
    const r = P.step.call(this, dt);
    try {
      const b = this.ball;
      if (b && !(Number(this.dead) > 0) && !this.pendingRestart && !this.waiting) {
        const y = +b.y, d = Math.min(y, FWv - y);
        tempoTotal += dt; amostras++; somaBolaLat += d;
        for (let k = 0; k < BANDAS.length; k++) if (d <= BANDAS[k]) { tempoBanda[k] += dt; break; }
        if (d <= 1.5 && !encostouEsteLance) { encostou++; encostouEsteLance = true; }
        else if (d > 4) encostouEsteLance = false;
        /* jogadores de linha, uma vez a cada 15 quadros (0,5 s) */
        if (amostras % 15 === 0) {
          let maisAberto = 99; nQuadros++;
          for (const tm of this.teams) for (const p of tm.players) {
            if (!p || p.red || p.isGK) continue;
            const dp = Math.min(+p.y, FWv - (+p.y));
            somaJog += dp; nJog++;
            for (let k = 0; k < BANDAS.length; k++) if (dp <= BANDAS[k]) { tempoJog[k]++; break; }
            if (dp < maisAberto) maisAberto = dp;
          }
          if (maisAberto < 99) somaMaisAberto += maisAberto;
        }
      }
    } catch (_) {}
    return r;
  };
  if (typeof sim._ballOut === 'function') {
    sim._ballOut = function () {
      try {
        const b = this.ball, x = +b.x;
        if (x <= 0 || x >= FLv) saidaPorBorda.endline++; else saidaPorBorda.touchline++;
      } catch (_) {}
      return P._ballOut.apply(this, arguments);
    };
  }
  if (typeof sim._pass === 'function') {
    sim._pass = function (o, best) {
      try {
        const y = best && (best.tx != null ? +best.tx : (best.m ? +best.m.y : NaN));
        if (Number.isFinite(y)) {
          const d = Math.min(y, FWv - y);
          nPasse++; somaPasseLat += d;
          for (let k = 0; k < BANDAS.length; k++) if (d <= BANDAS[k]) { passeBanda[k]++; break; }
        }
      } catch (_) {}
      return P._pass.apply(this, arguments);
    };
  }
  if (typeof sim._clearBall === 'function') {
    sim._clearBall = function (o) { clearBall++; return P._clearBall.call(this, o); };
  }
  if (typeof sim._r19ClearOut === 'function') {
    sim._r19ClearOut = function (d, tipo) {
      const bucket = clearOut[tipo] || (clearOut[tipo] = { tent: 0, ok: 0 });
      bucket.tent++;
      /* o portao geometrico da camada 86: 26 m da PROPRIA linha de fundo */
      let perto = -1;
      try {
        const tm = this.teams[d.team], g = tm && tm.goal;
        if (g) perto = 26 - Math.abs((+d.x) - (+g.x));
      } catch (_) {}
      const r = P._r19ClearOut.call(this, d, tipo);
      if (r) bucket.ok++;
      else if (perto <= 0) recusa.longeDaPropriaLinha++;
      else if (perto > 0) recusa.sorteio++;
      else recusa.outro++;
      return r;
    };
  }
}

/* --------------------------------------------------------------- partidas */
const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

let throwIns = 0, corners = 0, goalKicks = 0;
const natural = { naturalOutDeflections: 0, naturalOutLooseBalls: 0,
  naturalThrowIns: 0, naturalCorners: 0, naturalGoalKicks: 0 };
let temAudit = false;

for (let i = 0; i < N; i++) {
  srand(SEMENTE + i * INC);
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  instrumentar(sim);
  let s = 0;
  while (!sim.isOver() && s++ < 500000) sim.step(DT);
  throwIns += (+sim.stats[0].throwIns || 0) + (+sim.stats[1].throwIns || 0);
  corners += (+sim.stats[0].corners || 0) + (+sim.stats[1].corners || 0);
  goalKicks += (+sim.stats[0].goalKicks || 0) + (+sim.stats[1].goalKicks || 0);
  if (typeof sim.getR18181Audit === 'function') {
    temAudit = true; const a = sim.getR18181Audit();
    for (const k of Object.keys(natural)) natural[k] += (+a[k] || 0);
  }
}

/* ------------------------------------------------------------------ laudo */
const pp = v => +(v / N).toFixed(2);
const tot = deflect + loose;
const linhas = [...porChamador.entries()]
  .map(([id, s]) => ({
    ponto: id,
    porPartida: +(s.n / N).toFixed(2),
    quota: +(100 * s.n / tot).toFixed(1),
    distMediaLateral: +(s.somaLat / s.n).toFixed(2),
    jaMiraFora: s.fora,
    dentroDaJanela82: s.janela,
    reescritosPelaCamada45: s.reescritos,
  }))
  .sort((a, b) => b.porPartida - a.porPartida);

const rel = {
  build: sha, partidas: N,
  volume: { deflectTo: pp(deflect), looseBall: pp(loose), clearBall: pp(clearBall),
    throwIns: pp(throwIns), corners: pp(corners), goalKicks: pp(goalKicks) },
  agregado: {
    distMediaAteALateral: +(somaLat / tot).toFixed(2),
    meiaLargura: FWv / 2,
    fracaoDaMeiaLargura: +(somaLat / tot / (FWv / 2)).toFixed(3),
    alvosJaForaPelaLateral: foraLat,
    alvosNaJanelaDe82m: janela82,
    alvosReescritosParaFora: reescritos,
  },
  ondeABolaVive: {
    distMediaDaBolaAteALateral: +(somaBolaLat / Math.max(1, amostras)).toFixed(2),
    seUniforme: +(FWv / 4).toFixed(2),
    tempoVivoPorPartida: +(tempoTotal / N).toFixed(1),
    faixas: Object.fromEntries(BANDAS.map((b, k) => {
      const de = k ? BANDAS[k - 1] : 0;
      return [`${de}-${b} m da lateral`,
        `${(100 * tempoBanda[k] / Math.max(1e-9, tempoTotal)).toFixed(1)}%`];
    })),
    jogadoresDeLinha: {
      distMediaAteALateral: +(somaJog / Math.max(1, nJog)).toFixed(2),
      oMaisAbertoDoQuadro: +(somaMaisAberto / Math.max(1, nQuadros)).toFixed(2),
      faixas: Object.fromEntries(BANDAS.map((b, k) => {
        const de = k ? BANDAS[k - 1] : 0;
        return [`${de}-${b} m`, `${(100 * tempoJog[k] / Math.max(1, nJog)).toFixed(1)}%`];
      })),
    },
    alvoDoPasse: {
      n: nPasse, porPartida: pp(nPasse),
      distMediaAteALateral: +(somaPasseLat / Math.max(1, nPasse)).toFixed(2),
      faixas: Object.fromEntries(BANDAS.map((b, k) => {
        const de = k ? BANDAS[k - 1] : 0;
        return [`${de}-${b} m`, `${(100 * passeBanda[k] / Math.max(1, nPasse)).toFixed(1)}%`];
      })),
    },
    encostouAte1_5mSemSair: pp(encostou),
    saidasPorBorda: { touchline: pp(saidaPorBorda.touchline), endline: pp(saidaPorBorda.endline) },
  },
  pontosDeChamada: linhas,
  clearOutCamada86: { porTipo: clearOut, recusas: recusa,
    sucessosPorPartida: pp(Object.values(clearOut).reduce((n, b) => n + b.ok, 0)) },
  auditoriaR18181: temAudit ? Object.fromEntries(Object.entries(natural).map(([k, v]) => [k, pp(v)])) : null,
};
console.log(JSON.stringify(rel, null, 2));
const out = process.argv[4];
if (out) fs.writeFileSync(out, JSON.stringify(rel, null, 2));
