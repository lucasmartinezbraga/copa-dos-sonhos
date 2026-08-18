#!/usr/bin/env node
'use strict';
/* INVARIANTES DE LANCE EM MUITAS PARTIDAS — a amostra que a sonda de tela nunca teve
   =========================================================================
   PERGUNTA DO DONO: "voce acha que a sua forma de medir tudo e a mais
   coerente?" Nao era, e esta ferramenta corrige a incoerencia mais grave.

   Ate aqui o projeto tinha DOIS PADROES DE PROVA:

     · do MOTOR eu exigia 288 a 576 partidas (`tools/fisica/bateria.js`);
     · de LANCE eu aceitava UMA partida no navegador
       (`tools/fisica/tela/validar-lances.js`, ~19 faltas, ~3 escanteios) e
       tirava conclusao.

   E `--segundos` maior nao resolve: mais tempo de tela nao vira mais amostra
   de evento raro, porque a partida acaba. A 19 amostras, F6 "84,2% contra
   90%" e ruido com cara de laudo -- foi exatamente assim que a OS-248 nasceu
   de uma diferenca (0,56 -> 0,34 m) que eram duas partidas diferentes.

   Pior: para mudanca que mexe no TEMPO (segurar `dead`, esticar janela) NAO DA
   PARA FIXAR A SEMENTE -- a partida diverge no primeiro quadro alterado. Entao
   janela pareada, que resolve o problema para metrica continua de tela, aqui
   nao serve. So resta amostra grande.

   Esta ferramenta mede os mesmos invariantes de bola parada DENTRO do laco da
   bateria: mesma semente base, mesmo incremento, mesmas formacoes e estilos,
   sem navegador. Cem partidas custam o que uma partida de tela custava, e
   entregam ~2000 faltas em vez de 19.

   O QUE MEDE, por ocorrencia (nao por media):
     F2  a bola termina no ponto da falta
     F3  o batedor esta NA bola quando a cobranca sai
     F6  o batedor nao SALTA no quadro da cobranca      <- o item aberto
     E1  o batedor do escanteio esta na bandeirinha
     E2  ele nao salta no quadro da cobranca
     L3  o cobrador do lateral esta na bola
     L5  ele nao salta

   Cada um sai com N, percentual, IC de 95% e o pior caso. O intervalo de
   confianca esta no relatorio porque a licao da OS-249 foi essa: numero sem
   erro padrao nao decide nada.

   Uso:
     node tools/fisica/lances.js --build=dist/index.html --matches=120
     node tools/fisica/lances.js --build=A.html --matches=120 --out=a.json
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
const PARTIDAS = Number(argv.matches || 120);
const BUILD = String(argv.build || 'dist/index.html');

function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-lances', language: 'pt-BR' });
  define('location', { href: 'runner://lances', search: '', hash: '' });
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
  const sha = crypto.createHash('sha256').update(html).digest('hex');
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
  return sha;
}

const D = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function medir(n) {
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

  const R = {};
  const inv = (k) => R[k] || (R[k] = { ok: 0, n: 0, pior: 0, valores: [] });
  const conta = (k, passou, valor) => {
    const I = inv(k); I.n++; if (passou) I.ok++;
    if (typeof valor === 'number' && isFinite(valor)) {
      if (valor > I.pior) I.pior = valor;
      if (I.valores.length < 20000) I.valores.push(+valor.toFixed(3));
    }
  };

  for (let i = 0; i < n; i++) {
    const seed = SEMENTE + i * INCREMENTO;
    const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
    const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
    srand(seed);
    const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
    sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

    /* a rota do lance vem de QUEM armou a espera, nao de proximidade no tempo:
       foi a armadilha 10 do briefing (o salto do escanteio era cobrado da
       falta aberta pouco antes) */
    let rota = null;
    for (const [nome, r] of [['_awardFoul', 'falta'], ['_freeKick', 'falta'],
                             ['_setCorner', 'escanteio'], ['_throwIn', 'lateral']]) {
      const old = sim[nome] || (MatchSim.prototype[nome]);
      if (typeof old !== 'function') continue;
      sim[nome] = function () { const out = old.apply(this, arguments); rota = r; return out; };
    }

    const passo = sim.step.bind(sim);
    let antes = null;    // { taker, x, y, rota, faltaX, faltaY }
    let faltaPt = null;
    const oEmit = sim._emit;
    sim._emit = function (t, d) {
      if (t === 'foul' && d && d.on) faltaPt = { x: Number(d.on.x) || 0, y: Number(d.on.y) || 0, half: this.half };
      return oEmit.apply(this, arguments);
    };

    sim.step = function (dt) {
      const mortaAntes = (Number(this.dead) || 0) > 0;
      const w = this.__cdsTakerWait;
      if (mortaAntes && w && w.taker) {
        antes = { p: w.taker, x: Number(w.taker.x) || 0, y: Number(w.taker.y) || 0,
                  alvo: { x: Number(w.x) || 0, y: Number(w.y) || 0 }, rota: rota,
                  half: this.half, maxSpd: Number(w.taker.maxSpd) || 7 };
      }
      const r = passo(dt);
      const mortaDepois = (Number(this.dead) || 0) > 0;
      if (mortaAntes && !mortaDepois && antes) {
        const p = antes.p, b = this.ball;
        const salto = D(Number(p.x) || 0, Number(p.y) || 0, antes.x, antes.y);
        const teto = antes.maxSpd * 1.18 * Math.max(1 / 240, Math.min(0.15, dt)) + 0.12;
        const naBola = D(Number(p.x) || 0, Number(p.y) || 0, Number(b.x) || 0, Number(b.y) || 0);
        if (antes.rota === 'falta' && antes.half === this.half) {
          if (faltaPt && faltaPt.half === this.half) {
            conta('F2 bola no ponto da falta (<=2,0 m)',
                  D(Number(b.x) || 0, Number(b.y) || 0, faltaPt.x, faltaPt.y) <= 2.0,
                  D(Number(b.x) || 0, Number(b.y) || 0, faltaPt.x, faltaPt.y));
          }
          conta('F3 batedor NA bola (<=1,5 m)', naBola <= 1.5, naBola);
          conta('F6 batedor nao salta na cobranca', salto <= teto, salto);
          conta('F7 nenhum salto VISIVEL (<=2,0 m)', salto <= 2.0, salto);
        } else if (antes.rota === 'escanteio' && antes.half === this.half) {
          conta('E1 batedor na bandeirinha (<=1,5 m)', naBola <= 1.5, naBola);
          conta('E2 batedor nao salta na cobranca', salto <= teto, salto);
          conta('E4 nenhum salto VISIVEL (<=2,0 m)', salto <= 2.0, salto);
        } else if (antes.rota === 'lateral' && antes.half === this.half) {
          conta('L3 cobrador na bola (<=1,5 m)', naBola <= 1.5, naBola);
          conta('L5 cobrador nao salta', salto <= teto, salto);
        }
        antes = null; faltaPt = null;
      }
      if (!mortaDepois) antes = null;
      return r;
    };

    let s = 0; while (!sim.isOver() && s++ < 500000) sim.step(DT);
  }
  return R;
}

instalarAmbiente();
const sha = carregar(BUILD);
const t0 = Date.now();
const R = medir(PARTIDAS);
const seg = (Date.now() - t0) / 1000;

console.log('\n=== INVARIANTES DE LANCE ===  ' + PARTIDAS + ' partidas | ' +
            seg.toFixed(0) + ' s | ' + BUILD);
console.log('build sha ' + sha.slice(0, 12) + '\n');
console.log('   ' + 'invariante'.padEnd(38) + 'passou'.padStart(12) + '        %' +
            '     IC 95%' + '        pior');

const saida = { build: BUILD, sha, partidas: PARTIDAS, invariantes: {} };
for (const k of Object.keys(R).sort()) {
  const I = R[k];
  const p = I.ok / Math.max(1, I.n);
  /* IC de Wilson: honesto perto de 0% e de 100%, ao contrario do normal */
  const z = 1.96, nn = Math.max(1, I.n);
  const den = 1 + z * z / nn;
  const centro = (p + z * z / (2 * nn)) / den;
  const meia = z * Math.sqrt(p * (1 - p) / nn + z * z / (4 * nn * nn)) / den;
  const lo = Math.max(0, centro - meia), hi = Math.min(1, centro + meia);
  console.log('   ' + k.padEnd(38) + (I.ok + '/' + I.n).padStart(12) +
              (100 * p).toFixed(1).padStart(9) + '%' +
              ('[' + (100 * lo).toFixed(1) + '–' + (100 * hi).toFixed(1) + ']').padStart(15) +
              (I.pior ? I.pior.toFixed(2) + ' m' : '').padStart(12));
  saida.invariantes[k] = { ok: I.ok, n: I.n, pct: +(100 * p).toFixed(2),
                           ic: [+(100 * lo).toFixed(2), +(100 * hi).toFixed(2)], pior: I.pior };
}
console.log('\nO IC de 95% esta aqui porque a licao da OS-249 foi essa: numero sem');
console.log('erro padrao nao decide nada. Dois builds so DIFEREM quando os');
console.log('intervalos nao se sobrepoem.');
if (argv.out) { fs.writeFileSync(String(argv.out), JSON.stringify(saida, null, 1)); console.log('\nescrito: ' + argv.out); }
