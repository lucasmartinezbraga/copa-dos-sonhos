#!/usr/bin/env node
'use strict';
/* O IMPEDIMENTO AINDA ESTA CERTO DEPOIS DO CLAMP DE VELOCIDADE?
   -------------------------------------------------------------------------
   O patch de velocidade (OS-10) satura a velocidade DERIVADA no teto do
   jogador. A posicao nao e tocada, mas `p.vx` realimenta a integracao no
   quadro seguinte, entao o movimento muda — e a bateria mediu impedimentos
   subindo 49% a 58%, acima da banda de 17%. A matriz de gates ja avisava:
   dependencia "Movimento realimentado", protecao "linhas/impedimentos".

   Subir impedimento nao e automaticamente regressao: a baseline marca 1,146 por
   partida e o futebol real fica perto de 2 a 3. O que NAO pode acontecer e a
   marcacao ficar ERRADA. Este instrumento verifica a regra, nao a contagem:

     - recalcula a linha do segundo-ultimo defensor no instante de cada passe
       julgado e confere o veredito do motor contra a propria geometria;
     - mede a margem (quanto o atacante estava a frente ou atras da linha);
     - separa julgamentos com margem menor que 0,5 m, onde erro numerico
       explicaria divergencia, dos casos claros.

   Se a concordancia com a geometria continuar alta e a margem nao encolher, o
   impedimento esta preservado e a subida e comportamento, nao defeito.
   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-imp', language: 'pt-BR' });
define('location', { href: 'runner://imp', search: '', hash: '' });
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
const sha = crypto.createHash('sha256').update(html).digest('hex');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0, erros = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (e) { erros++; }
}
for (const n of ['MatchSim','autoLineup','buildDB','DATA','srand','FL']) {
  if (typeof global[n] === 'undefined') { realConsole.error('ABORTA: falta ' + n); process.exit(2); }
}

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' }; };

const P = MatchSim.prototype;
const T = { julgados: 0, concorda: 0, discorda: 0, margens: [], marcados: 0, claros: 0, clarosConcorda: 0, discordanciasClaras: [] };

/* A linha do impedimento e o x do SEGUNDO-ULTIMO defensor (goleiro conta). */
function linhaDoImpedimento(sim, timeDefensor) {
  const tm = sim.teams[timeDefensor];
  const dir = tm.attackDir;                     // para onde ESTE time ataca
  const xs = [];
  for (const p of tm.players) { if (!p || p.red) continue; xs.push(p.x); }
  if (xs.length < 2) return null;
  /* o proprio gol fica no lado oposto ao ataque: ordena de tras para frente */
  xs.sort((a, b) => dir > 0 ? a - b : b - a);
  return xs[1];                                  // segundo mais atras = 2o ultimo
}

const oOff = P._offsideCheck || P._isOffside || P._checkOffside;
const nomeOff = P._offsideCheck ? '_offsideCheck' : (P._isOffside ? '_isOffside' : (P._checkOffside ? '_checkOffside' : null));

/* Sem funcao nomeada conhecida, medimos pelo evento e recalculamos no instante. */
const N = Number(argv.matches || 6), DT = 1 / 30;
const SEED = Number(argv.seed || 1710000);
for (const form of ['4-3-3', '4-4-2', '3-5-2']) for (let i = 0; i < N; i++) {
  srand(SEED + i * 977);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  const oEmit = Object.getPrototypeOf(sim)._emit;
  sim._emit = function (t, d) {
    if (t === 'offside' || t === 'offside_trap') {
      T.marcados++;
      /* quem foi pego, e de que time */
      const alvo = d && (d.by || d.player || d.victim || d.receiver);
      if (alvo && Number.isFinite(alvo.x)) {
        const atacante = alvo.team;
        const linha = linhaDoImpedimento(this, 1 - atacante);
        if (linha != null) {
          const dirAtk = this.teams[atacante].attackDir;
          const margem = dirAtk > 0 ? (alvo.x - linha) : (linha - alvo.x);
          T.julgados++;
          T.margens.push(+margem.toFixed(2));
          const geometriaConcorda = margem > 0;     // a frente da linha = impedido
          if (geometriaConcorda) T.concorda++; else T.discorda++;
          if (Math.abs(margem) >= 0.5) {
            T.claros++;
            if (geometriaConcorda) T.clarosConcorda++;
            else if (T.discordanciasClaras.length < 8) T.discordanciasClaras.push({ margem: +margem.toFixed(2), x: +alvo.x.toFixed(1), linha: +linha.toFixed(1) });
          }
        }
      }
    }
    return oEmit.apply(this, arguments);
  };
  let s = 0; while (!sim.isOver() && s++ < 400000) sim.step(DT);
}

const nPart = N * 3;
const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.floor(b.length * p)].toFixed(2); };
const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(), sha: sha.slice(0, 12), blocosComErro: erros,
  partidas: nPart, funcaoDeImpedimento: nomeOff || '(nao nomeada — medido por evento)',
  MARCACOES: { total: T.marcados, porPartida: +(T.marcados / nPart).toFixed(2), julgadosComGeometria: T.julgados },
  CONCORDANCIA_COM_A_GEOMETRIA: {
    concorda: T.concorda, discorda: T.discorda, pct: pct(T.concorda, T.julgados),
    apenas_casos_claros_margem_maior_0_5m: { n: T.claros, concorda: T.clarosConcorda, pct: pct(T.clarosConcorda, T.claros) },
    alvo: 'alto; a R18.31 mediu 99,3% para _ballOut e e o padrao desta linhagem',
  },
  MARGEM_m: { p10: q(T.margens, .1), mediana: q(T.margens, .5), p90: q(T.margens, .9),
    nota: 'positiva = atacante a frente da linha do segundo-ultimo defensor' },
  discordanciasClaras: T.discordanciasClaras,
}, null, 2));
