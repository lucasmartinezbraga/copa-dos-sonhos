#!/usr/bin/env node
'use strict';
/* DIAG DE FINALIZACAO — de onde vem o xG por chute
   =========================================================================
   POR QUE. A R18.43 entrega xG/chute de 0,166 contra ~0,11 do futebol real
   (1,54x). Antes de propor patch, preciso saber ONDE esta o excesso: na curva
   de distancia, na distribuicao de distancias dos chutes, ou na conversao. Sem
   isso e "numero sem mecanismo", que e o padrao dos quatro erros do handoff §6.

   O QUE A LEITURA DO CODIGO JA MOSTROU, e que este instrumento vai medir:

   1. A ESTATISTICA CHAMADA `xg` E O `pGoal`. Em `_shoot` (bloco base):
          let pGoal = base*conversionScale*angMul*(1+skill*skillInfluence)*execution;
          pGoal *= oneOnOne ? .70 : longshot ? .50 : 0.62;
          const xg = pGoal; this.stats[o.team].xg += xg;
      Ou seja `xg` NAO e xG posicional: e a probabilidade contra a qual o motor
      sorteia `chance(pGoal)`. O xG posicional existe e e emitido separado, como
      `baseXg = base*angMul`. Para chute comum a razao e
          pGoal/baseXg = 2,25 * 0,62 * (1+skill*1,05) * execution ~= 1,40
      isto e, o motor converte ~40% acima do proprio modelo posicional. Este
      instrumento mede a razao de verdade, por banda de distancia.

   2. CINCO CAMINHOS DE CHUTE, E DOIS IGNORAM A DISTANCIA.
          shot_taken      jogo aberto, usa distanceXg(dtg)          (base)
          low_cross_shot  cruzamento rasteiro, pGoal ACHATADO .06-.40
          header_shot     cabeceio de cruzamento, base achatada .105
          freekick        falta cobrada
          penalty         penalti, pGoal ~ .65+
      `low_cross_shot` e `header_shot` nao consultam `distanceXg` — sao valores
      de "chance clara" fixos. Se o volume deles for alto, inflam o xG/chute sem
      nenhuma dependencia de posicao, e nesse caso mexer em `conversionScale`
      (que foi o que a R18.40B tentou) nao podia funcionar: aquele lever nao
      toca estes dois caminhos.

   COMO. Engancho `_emit` (leitura pura, nao perturba o sim: a bateria promovida
   ja faz isso para contar eventos) e registro cada finalizacao com tipo, dtg,
   baseXg, pGoal e se virou gol. Agrego por banda da propria tabela CAL
   (6/11/16/22/30) para comparar a distribuicao com futebol real.

   Uso:
     node tools/r1843/diag_xg.js --build=ARQUIVO.html [--matches=48] \
          [--semente=4200000] [--out=arquivo.json]
*/
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-diag-xg', language: 'pt-BR' });
define('location', { href: 'runner://diag', search: '', hash: '' });
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
let mt, idx = 0, scriptsOk = 0, scriptsErro = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); scriptsOk++; } catch (_) { scriptsErro++; }
}
const EXIGIDOS = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','R','chance','facet','clamp','D','FL','FW'];
const faltando = EXIGIDOS.filter(n => typeof global[n] === 'undefined');
if (faltando.length) { realConsole.error('ABORTA: simbolos ausentes -> ' + faltando.join(', ')); process.exit(2); }

/* `CAL` e `const` dentro do closure do bundle (linha ~4367) e nao esta em
   window — a propria bateria promovida nao o exige. Leio a tabela do TEXTO da
   build, que e a fonte da verdade para o arquivo que estou medindo, em vez de
   hardcodar numeros que poderiam divergir da build. */
function leTabela(txt) {
  const m = txt.match(/distanceXg:\s*Object\.freeze\(\s*\[([\s\S]{0,400}?)\]\s*\)/);
  if (!m) return null;
  const pares = [...m[1].matchAll(/\[\s*(Infinity|[0-9.]+)\s*,\s*([0-9.]+)\s*\]/g)]
    .map(p => [p[1] === 'Infinity' ? Infinity : Number(p[1]), Number(p[2])]);
  return pares.length ? pares : null;
}
function leNum(txt, chave, padrao) {
  const m = txt.match(new RegExp(chave + ':\\s*([0-9.]+)'));
  return m ? Number(m[1]) : padrao;
}
const TABELA = leTabela(html);
if (!TABELA) { realConsole.error('ABORTA: nao consegui ler CAL.shooting.distanceXg do texto da build'); process.exit(2); }
const CONV_SCALE = leNum(html, 'conversionScale', null);
const SKILL_INFL = leNum(html, 'skillInfluence', null);
const LIMS = TABELA.map(t => t[0]);
const rot = i => i === 0 ? '<6' : LIMS[i] === Infinity ? '>=30' : LIMS[i-1] + '-' + LIMS[i];
const banda = d => { for (let i = 0; i < LIMS.length; i++) if (d < LIMS[i]) return i; return LIMS.length - 1; };

const TIPOS = ['shot_taken', 'low_cross_shot', 'header_shot', 'freekick', 'penalty'];

const db = buildDB(DATA);
const N = Number(argv.matches || 48);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

/* acumuladores */
const porTipo = {};
for (const t of TIPOS) porTipo[t] = { n: 0, xg: 0, baseXg: 0, baseN: 0, gols: 0 };
const porBanda = LIMS.map(() => ({ n: 0, xg: 0, baseXg: 0, baseN: 0, gols: 0 }));
const abertoPorBanda = LIMS.map(() => ({ n: 0, xg: 0, baseXg: 0, gols: 0, long: 0, um: 0 }));
let golsTotais = 0, xgTotal = 0, chutesTotal = 0;

for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * 7919;
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

  /* Leitura pura: registro o evento e devolvo o controle ao motor sem alterar
     argumento nenhum. Guardo o ultimo chute para casar com o 'goal' seguinte. */
  let ultimo = null;
  const oEmit = sim._emit;
  sim._emit = function (t, d) {
    try {
      if (t === 'shot_taken') {
        const dtg = +d.dtg, b = banda(dtg);
        ultimo = { tipo: t, b };
        porTipo[t].n++; porTipo[t].xg += +d.xg || 0;
        porTipo[t].baseXg += +d.baseXg || 0; porTipo[t].baseN++;
        porBanda[b].n++; porBanda[b].xg += +d.xg || 0;
        porBanda[b].baseXg += +d.baseXg || 0; porBanda[b].baseN++;
        const a = abertoPorBanda[b];
        a.n++; a.xg += +d.xg || 0; a.baseXg += +d.baseXg || 0;
        if (d.longshot) a.long++; if (d.oneOnOne) a.um++;
      } else if (t === 'low_cross_shot' || t === 'header_shot' || t === 'freekick' || t === 'penalty') {
        ultimo = { tipo: t, b: null };
        porTipo[t].n++;
        /* Estes caminhos publicam a probabilidade sob a chave `xg` (que e o
           proprio pGoal), nao sob `pGoal` — ver os _emit no bundle. `freekick`
           e `penalty` nao publicam nenhuma, entao para eles so a conversao real
           medida pelos gols e confiavel. */
        const pg = (d && isFinite(+d.xg)) ? +d.xg : (d && isFinite(+d.pGoal) ? +d.pGoal : NaN);
        if (isFinite(pg)) { porTipo[t].xg += pg; porTipo[t].pgN = (porTipo[t].pgN || 0) + 1; }
      } else if (t === 'goal') {
        golsTotais++;
        if (ultimo) {
          porTipo[ultimo.tipo].gols++;
          if (ultimo.b !== null) { porBanda[ultimo.b].gols++; abertoPorBanda[ultimo.b].gols++; }
          ultimo = null;
        }
      }
    } catch (_) {}
    return oEmit.apply(this, arguments);
  };

  let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
  xgTotal += (+sim.stats[0].xg || 0) + (+sim.stats[1].xg || 0);
  chutesTotal += (+sim.stats[0].shots || 0) + (+sim.stats[1].shots || 0);
}

const f3 = v => +(v).toFixed(4);
const div = (a, b) => b ? a / b : null;

const saida = {
  build: String(argv.build).split(/[\\/]/).pop(), sha256: sha,
  scripts: scriptsOk + ' ok / ' + scriptsErro + ' erro',
  partidas: N, sementeBase: SEMENTE,
  tabelaCAL: TABELA.map(([l, v]) => ({ ate: l === Infinity ? 'inf' : l, xg: v })),
  conversionScale: CONV_SCALE,
  skillInfluence: SKILL_INFL,
  totais: {
    chutes_por_partida: f3(chutesTotal / N),
    xg_por_partida: f3(xgTotal / N),
    gols_por_partida: f3(golsTotais / N),
    xg_por_chute: f3(div(xgTotal, chutesTotal)),
    gols_por_xg: f3(div(golsTotais, xgTotal)),
  },
  porTipo: Object.fromEntries(TIPOS.map(t => {
    const o = porTipo[t];
    return [t, {
      por_partida: f3(o.n / N),
      pct_das_finalizacoes: f3(o.n / Math.max(1, TIPOS.reduce((s, k) => s + porTipo[k].n, 0)) * 100),
      /* Divide pelo numero de eventos que REALMENTE publicaram probabilidade.
         Dividir por o.n daria zero para freekick/penalty e mentiria. */
      pGoal_medio: (o.baseN || o.pgN) ? f3(div(o.xg, o.baseN || o.pgN)) : null,
      pGoal_publicado_em: (o.baseN || o.pgN || 0) + '/' + o.n,
      baseXg_medio: o.baseN ? f3(div(o.baseXg, o.baseN)) : null,
      razao_pGoal_sobre_baseXg: o.baseN ? f3(div(div(o.xg, o.n), div(o.baseXg, o.baseN))) : null,
      gols_por_partida: f3(o.gols / N),
      conversao_real: f3(div(o.gols, o.n)),
    }];
  })),
  jogoAbertoPorBanda: LIMS.map((_, i) => {
    const a = abertoPorBanda[i];
    return {
      banda_m: rot(i),
      xg_da_tabela: TABELA[i] ? TABELA[i][1] : null,
      chutes_por_partida: f3(a.n / N),
      pct_dos_chutes_abertos: f3(a.n / Math.max(1, abertoPorBanda.reduce((s, x) => s + x.n, 0)) * 100),
      baseXg_medio: f3(div(a.baseXg, a.n)),
      pGoal_medio: f3(div(a.xg, a.n)),
      razao_pGoal_sobre_baseXg: f3(div(div(a.xg, a.n), div(a.baseXg, a.n))),
      conversao_real: f3(div(a.gols, a.n)),
      pct_longshot: f3(div(a.long, a.n) * 100),
      pct_umXum: f3(div(a.um, a.n) * 100),
    };
  }),
};

realConsole.log(JSON.stringify(saida, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(saida, null, 2));
