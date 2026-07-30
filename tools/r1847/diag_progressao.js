#!/usr/bin/env node
'use strict';
/* DIAG DE PROGRESSAO — o ataque chega lateral, ou so o lateral tem saida?
   =========================================================================
   POR QUE. O censo de eventos da R18.46 mostrou 14,75 cruzamentos por partida
   contra 8,42 avaliacoes de chute: o volume de finalizacao e limitado por
   OPORTUNIDADE, nao por limiar de decisao. Antes de mexer em qualquer lever,
   preciso saber qual das duas coisas produz isso:

     (a) o ataque e ROTEADO para o lado — o portador raramente chega ao terco
         final pelo centro, e ai nao existe chute a ser decidido; ou
     (b) o ataque chega nos dois corredores, mas o lado tem saida barata
         (`crossP` base 0,69, teto 0,92, sempre que `_canCross` e verdadeiro)
         enquanto o centro precisa vencer um limiar de chute.

   A diferenca importa muito. Se (a), o lever e progressao/ocupacao central. Se
   (b), o lever e o preco do cruzamento contra a alternativa central. Escolher
   errado foi exatamente o erro da R18.46, e essa rodada existe para nao repetir.

   O QUE MEDE. Amostra por quadro (leitura pura, nao chama R() nem escreve no
   sim) e classifica o portador da bola:
     - `adv`   = progresso na direcao do gol atacado, 0..105
     - lateral = y < 20 ou y > FW-20  (a MESMA condicao de `_canCross`)
     - terco final = adv > 78         (o MESMO corte de `_canCross`)
   Conta tempo de posse do portador em cada celula (terco final x lateral/centro)
   e, em paralelo, o censo de acoes por _emit. Assim da para dizer se o centro do
   terco final e visitado e nao rende chute, ou se simplesmente nao e visitado.

   Uso:
     node tools/r1847/diag_progressao.js --build=ARQUIVO.html [--matches=48]
          [--semente=4200000] [--out=arquivo.json]
*/
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-diag-prog', language: 'pt-BR' });
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
let mt, idx = 0, sOk = 0, sErr = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); sOk++; } catch (_) { sErr++; }
}
const EXIGIDOS = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','R','chance','facet','clamp','D','FL','FW'];
const falta = EXIGIDOS.filter(n => typeof global[n] === 'undefined');
if (falta.length) { realConsole.error('ABORTA: simbolos ausentes -> ' + falta.join(', ')); process.exit(2); }

const db = buildDB(DATA);
const N = Number(argv.matches || 48);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

/* Mesmos cortes de _canCross, para a medicao falar a lingua da decisao. */
const CORTE_ADV = 78;
const FAIXA_LAT = 20;

const acc = {
  quadrosComPortador: 0,
  // terco final (adv>78)
  tf_lateral: 0, tf_centro: 0,
  // resto do campo
  meio_lateral: 0, meio_centro: 0,
  // adv 60..78, a antessala do terco final
  ante_lateral: 0, ante_centro: 0,
  ev: Object.create(null),
  // quando cruzou, de onde
  crossAdv: 0, crossN: 0,
  // quando chutou, de onde
  shotAdv: 0, shotN: 0, shotLateral: 0,
};

for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * 7919;
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

  const oEmit = sim._emit;
  sim._emit = function (t, d) {
    try {
      acc.ev[t] = (acc.ev[t] || 0) + 1;
      const by = d && (d.by || d.p);
      if (by && (by.team === 0 || by.team === 1)) {
        const tm = this.teams[by.team];
        const adv = tm.attackDir > 0 ? by.x : FL - by.x;
        const lat = (by.y < FAIXA_LAT || by.y > FW - FAIXA_LAT) ? 1 : 0;
        if (t === 'cross' || t === 'low_cross_shot') { acc.crossAdv += adv; acc.crossN++; }
        if (t === 'shot_taken') { acc.shotAdv += adv; acc.shotN++; acc.shotLateral += lat; }
      }
    } catch (_) {}
    return oEmit.apply(this, arguments);
  };

  let s = 0;
  while (!sim.isOver() && s++ < 500000) {
    sim.step(DT);
    const b = sim.ball, o = b && b.owner;
    if (!o || o.red) continue;
    const tm = sim.teams[o.team];
    if (!tm) continue;
    const adv = tm.attackDir > 0 ? o.x : FL - o.x;
    const lat = (o.y < FAIXA_LAT || o.y > FW - FAIXA_LAT);
    acc.quadrosComPortador++;
    if (adv > CORTE_ADV) { lat ? acc.tf_lateral++ : acc.tf_centro++; }
    else if (adv > 60) { lat ? acc.ante_lateral++ : acc.ante_centro++; }
    else { lat ? acc.meio_lateral++ : acc.meio_centro++; }
  }
}

const p = v => +(v / Math.max(1, acc.quadrosComPortador) * 100).toFixed(3);
const pp = v => +(v / N).toFixed(3);
const tf = acc.tf_lateral + acc.tf_centro;

const out = {
  build: String(argv.build).split(/[\\/]/).pop(), sha256: sha,
  scripts: sOk + ' ok / ' + sErr + ' erro', partidas: N, sementeBase: SEMENTE,
  cortes: { terco_final_adv: CORTE_ADV, faixa_lateral_m: FAIXA_LAT,
            nota: 'mesmos cortes de _canCross: adv>78 e y<20 ou y>FW-20' },
  posse_do_portador_pct: {
    terco_final_lateral: p(acc.tf_lateral),
    terco_final_centro: p(acc.tf_centro),
    antessala_60a78_lateral: p(acc.ante_lateral),
    antessala_60a78_centro: p(acc.ante_centro),
    resto_lateral: p(acc.meio_lateral),
    resto_centro: p(acc.meio_centro),
  },
  terco_final: {
    pct_do_tempo_de_posse: p(tf),
    fatia_lateral_pct: tf ? +(acc.tf_lateral / tf * 100).toFixed(3) : null,
    fatia_centro_pct: tf ? +(acc.tf_centro / tf * 100).toFixed(3) : null,
    razao_lateral_sobre_centro: acc.tf_centro ? +(acc.tf_lateral / acc.tf_centro).toFixed(3) : null,
  },
  acoes_por_partida: {
    cross: pp(acc.ev['cross'] || 0),
    low_cross_shot: pp(acc.ev['low_cross_shot'] || 0),
    header_shot: pp(acc.ev['header_shot'] || 0),
    shot_taken: pp(acc.ev['shot_taken'] || 0),
    shot_deferred: pp(acc.ev['shot_deferred'] || 0),
    situacoes_de_chute: pp((acc.ev['shot_taken'] || 0) + (acc.ev['shot_deferred'] || 0)),
    dribble: pp(acc.ev['dribble'] || 0),
    pass: pp(acc.ev['pass'] || 0),
  },
  origem: {
    adv_medio_do_cruzamento: acc.crossN ? +(acc.crossAdv / acc.crossN).toFixed(2) : null,
    adv_medio_do_chute: acc.shotN ? +(acc.shotAdv / acc.shotN).toFixed(2) : null,
    pct_dos_chutes_vindos_do_corredor_lateral: acc.shotN ? +(acc.shotLateral / acc.shotN * 100).toFixed(2) : null,
  },
};

realConsole.log(JSON.stringify(out, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
