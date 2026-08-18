#!/usr/bin/env node
'use strict';
/* CARTOES — quem leva o segundo amarelo, e por que o vermelho nao para quieto
   =========================================================================
   `redsPerMatch` e a metrica que mais flutua nesta base: reprovou a OS-211,
   quase reprovou a OS-232, apareceu como "0,318 contra teto 0,30" na OS-234 e
   "0,368" hoje. Toda vez a discussao foi a mesma — e ruido ou e causa? — e toda
   vez a resposta veio de mais amostra, nunca de mecanismo.

   O QUE OS AGREGADOS JA REVELAM, e que ninguem tinha olhado:

     · 94 a 96% dos vermelhos sao SEGUNDO AMARELO. Vermelho direto e
       0,014/jogo e nao se move nunca (e `chance(CAL.defending.straightRed)`
       por falta, entao acompanha a falta, que esta parada).

     · Logo, `redsPerMatch` NAO e uma taxa: e uma estatistica de CONCENTRACAO.
       Ela pergunta "o mesmo jogador foi advertido duas vezes?", que e de
       segunda ordem na taxa de cartao. Por isso ela tem desvio de Poisson
       (dp ~= sqrt(media)) e por isso 288 partidas dao erro padrao de 0,034 —
       resolvem so diferencas acima de ~0,10.

   Esta sonda mede a CONCENTRACAO direto, em vez de inferir: para cada partida
   conta os cartoes por jogador, por posicao e por terco do campo, e compara com
   o que sairia se o cartao caisse em jogador aleatorio.

   Semente, incremento, dt e construcao de time sao os MESMOS da bateria, entao
   os numeros sao comparaveis com as medicoes historicas.

   Uso:
     node tools/fisica/cartoes.js --build=dist/index.html --matches=200
     node tools/fisica/cartoes.js --build=A.html --contra=B.html --matches=200
*/

const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));

const SEMENTE = Number(argv.semente || 4200000);
const INCREMENTO = 7919;
const DT = 1 / 30;
const PARTIDAS = Number(argv.matches || 200);

function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-cartoes', language: 'pt-BR' });
  define('location', { href: 'runner://cartoes', search: '', hash: '' });
  define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
  define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
  define('addEventListener', noop); define('removeEventListener', noop);
  define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
  define('alert', noop); define('confirm', () => true); define('prompt', () => null);
  define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
  define('sessionStorage', global.localStorage);
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, removeChild: noop, setAttribute: noop, getAttribute: () => null,
    addEventListener: noop, removeEventListener: noop, querySelector: () => null,
    querySelectorAll: () => [], getContext: () => null, insertAdjacentHTML: noop,
    remove: noop, focus: noop, blur: noop, click: noop, children: [], dataset: {} });
  define('document', { readyState: 'complete', body: el(), documentElement: el(),
    createElement: el, createElementNS: el, getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener: noop,
    removeEventListener: noop, head: el(), title: '' });
  define('CanvasRenderingContext2D', undefined);
  define('HTMLElement', function HTMLElement() {});
  define('HTMLCanvasElement', function HTMLCanvasElement() {});
  define('Image', function Image() {});
  define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
  define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
}

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);

function carregar(buildPath) {
  const html = fs.readFileSync(buildPath, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let mt, idx = 0;
  while ((mt = re.exec(html))) {
    const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (_) { }
  }
  if (typeof global.MatchSim === 'undefined') {
    console.error('ABORTA: MatchSim ausente em ' + buildPath); process.exit(2);
  }
}

/* terco do campo em que a falta aconteceu, do ponto de vista de quem faltou:
   defensivo = perto do proprio gol. E o que separa "falta tatica no meio" de
   "defesa em desespero na propria area". */
function tercoDe(sim, p, x) {
  const dir = sim.teams[p.team] && sim.teams[p.team].attackDir;
  const rel = dir > 0 ? x : (105 - x);      // 0 = proprio gol, 105 = gol adversario
  return rel < 35 ? 'defensivo' : (rel < 70 ? 'meio' : 'ofensivo');
}

function medir(buildPath, n) {
  instalarAmbiente();
  carregar(buildPath);
  const db = buildDB(DATA);
  const FORMS = Object.keys(FORMATIONS);
  const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
    ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
  const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
  const mk = (f, st, home) => {
    const p = autoLineup(squad, f, 0);
    return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
      lineup: p.lineup, bench: p.bench, formKey: f, style: st };
  };

  const R = {
    partidas: 0, faltas: 0, cartoes: 0, segundos: 0, diretos: 0,
    porPosicao: Object.create(null),        // classe -> {cartoes, segundos}
    porTerco: Object.create(null),          // terco -> {cartoes, segundos}
    cartoesPorJogo: [], segPorJogo: [],
    minutoDoVermelho: [],
    /* reincidencia: intervalo em minutos entre o 1o e o 2o amarelo do mesmo
       jogador. Curto = sequencia de lances; longo = azar espalhado. */
    intervalo: [],
  };

  for (let i = 0; i < n; i++) {
    const seed = SEMENTE + i * INCREMENTO;
    const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
    const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
    srand(seed);
    const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
    sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

    let cartoes = 0, segundos = 0;
    const primeiro = new Map();          // jogador -> minuto do 1o amarelo
    const oEmit = sim._emit;
    sim._emit = function (t, d) {
      try {
        if (t === 'foul' && d && d.by) R.faltas++;
        if (t === 'yellow' && d && d.p) {
          cartoes++;
          const p = d.p, cls = (p.pos || p.role || '?');
          const T = tercoDe(sim, p, Number(p.x) || 0);
          (R.porPosicao[cls] || (R.porPosicao[cls] = { cartoes: 0, segundos: 0 })).cartoes++;
          (R.porTerco[T] || (R.porTerco[T] = { cartoes: 0, segundos: 0 })).cartoes++;
          primeiro.set(p, sim.minute);
        }
        if (t === 'red' && d && d.p) {
          const p = d.p, cls = (p.pos || p.role || '?');
          const T = tercoDe(sim, p, Number(p.x) || 0);
          if (d.second) {
            cartoes++; segundos++; R.segundos++;
            (R.porPosicao[cls] || (R.porPosicao[cls] = { cartoes: 0, segundos: 0 })).cartoes++;
            (R.porPosicao[cls]).segundos++;
            (R.porTerco[T] || (R.porTerco[T] = { cartoes: 0, segundos: 0 })).cartoes++;
            (R.porTerco[T]).segundos++;
            const t0 = primeiro.get(p);
            if (typeof t0 === 'number') R.intervalo.push(+(sim.minute - t0).toFixed(1));
          } else R.diretos++;
          R.minutoDoVermelho.push(Math.floor(sim.minute));
        }
      } catch (_) { }
      return oEmit.apply(this, arguments);
    };

    let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
    R.partidas++; R.cartoes += cartoes;
    R.cartoesPorJogo.push(cartoes); R.segPorJogo.push(segundos);
  }
  return R;
}

function resumo(rot, R) {
  const n = R.partidas;
  const media = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const B = media(R.cartoesPorJogo);
  const varB = media(R.cartoesPorJogo.map(v => (v - B) * (v - B)));
  const seg = media(R.segPorJogo);
  /* esperado se o cartao caisse em jogador aleatorio entre os 22 */
  const EB2 = varB + B * B;
  const esperado = (EB2 - B) / 2 / 22;
  const dpSeg = Math.sqrt(media(R.segPorJogo.map(v => (v - seg) * (v - seg))));
  const erro = dpSeg / Math.sqrt(n);

  console.log('\n=== ' + rot + ' ===   ' + n + ' partidas');
  console.log('  faltas/jogo            ' + (R.faltas / n).toFixed(2));
  console.log('  cartoes/jogo           ' + B.toFixed(3) + '  (dp ' + Math.sqrt(varB).toFixed(3) + ')');
  console.log('  2o amarelo/jogo        ' + seg.toFixed(3) + '  +/- ' + erro.toFixed(3) + ' (erro padrao)');
  console.log('  vermelho direto/jogo   ' + (R.diretos / n).toFixed(3));
  console.log('  INDICE DE CONCENTRACAO ' + (seg / esperado).toFixed(3) +
              '   (esperado-se-aleatorio ' + esperado.toFixed(3) + ')');
  const ord = R.intervalo.slice().sort((a, b) => a - b);
  if (ord.length) {
    console.log('  intervalo 1o->2o amarelo: mediana ' + ord[Math.floor(ord.length / 2)] + ' min' +
                ' | p10 ' + ord[Math.floor(ord.length * .1)] +
                ' | menor ' + ord[0] + ' | amostras ' + ord.length);
  }
  const pos = Object.entries(R.porPosicao).sort((a, b) => b[1].cartoes - a[1].cartoes);
  console.log('  por posicao (cartoes | 2os amarelos | taxa de reincidencia):');
  for (const [k, v] of pos) {
    console.log('     ' + String(k).padEnd(6) + String(v.cartoes).padStart(6) +
                String(v.segundos).padStart(7) + '     ' +
                (100 * v.segundos / Math.max(1, v.cartoes)).toFixed(1) + '%');
  }
  const ter = Object.entries(R.porTerco).sort((a, b) => b[1].cartoes - a[1].cartoes);
  console.log('  por terco do campo:');
  for (const [k, v] of ter) {
    console.log('     ' + k.padEnd(12) + String(v.cartoes).padStart(6) +
                String(v.segundos).padStart(7) + '     ' +
                (100 * v.segundos / Math.max(1, v.cartoes)).toFixed(1) + '%');
  }
  return { B, seg, erro, indice: seg / esperado };
}

const build = String(argv.build || 'dist/index.html');
const a = resumo(build, medir(build, PARTIDAS));

if (argv.contra) {
  console.log('\n' + '-'.repeat(72));
  console.log('AVISO: o segundo build roda no MESMO processo, sobre o motor ja');
  console.log('carregado. Rode-o em execucao separada para comparacao limpa.');
  console.log('-'.repeat(72));
}

console.log('\nLEITURA: se o INDICE nao muda entre dois builds, a alta do vermelho');
console.log('veio de MAIS cartao. Se o indice muda, veio de cartao no MESMO');
console.log('jogador — e ai e mecanismo, nao ruido de amostra.');
