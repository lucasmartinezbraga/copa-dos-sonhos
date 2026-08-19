#!/usr/bin/env node
'use strict';
/* O CONTATO — desarme e falta acontecem ENCOSTADO, ou a três metros?
   =========================================================================
   QUEIXA DO DONO, textual: "qualidade do desarme da falta" e "quando rola uma
   falta a animação não me agrada nada".

   O que foi feito até aqui atacou o GESTO: a OS-241 fez quem sofre falta cair
   de verdade (antes era `agacha 0,30`, quatro pixels — um cambalear), a OS-237
   deu membros articulados ao carrinho, a OS-235 tirou o corte seco da troca de
   pose. E o Árbitro confirma que o evento do motor vira gesto no autor em 26 de
   26 desarmes.

   Só que nada disso responde à pergunta que decide se o lance parece futebol:
   **os dois corpos se encontram?**

   Um desarme com os corpos a três metros parece fantasma por melhor que seja a
   animação — o pé passa no vazio e a bola troca de dono. Nenhuma sonda deste
   projeto olhou isso: o Árbitro pergunta se o gesto existe, não se houve
   contato.

   O QUE MEDE, por ocorrência, em muitas partidas (semente da bateria):

     D1  desarme acontece a distância de contato        (<= 1,5 m)
     D2  falta acontece a distância de contato          (<= 1,5 m)
     D3  quem sofre a falta PERDE velocidade no contato (freia)
     D4  quem desarma fica com a bola perto do pé       (<= 2,5 m)
     D5  bote errado deixa os dois em pé e perto        (<= 2,5 m)

   D3 existe porque contato sem consequência cinemática é o mesmo que não haver
   contato: se a vítima atravessa a falta na mesma velocidade, o corpo dela não
   sofreu nada, e é isso que se vê.

   Uso: node tools/fisica/contato.js --build=dist/index.html --matches=60
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
const PARTIDAS = Number(argv.matches || 60);
const BUILD = String(argv.build || 'dist/index.html');

function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-contato', language: 'pt-BR' });
  define('location', { href: 'runner://contato', search: '', hash: '' });
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
const D = (a, b) => Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0),
                               (Number(a.y) || 0) - (Number(b.y) || 0));
const V = p => Math.hypot(Number(p.vx) || 0, Number(p.vy) || 0);

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
  const inv = k => R[k] || (R[k] = { ok: 0, n: 0, pior: 0, vals: [] });
  const conta = (k, passou, valor) => {
    const I = inv(k); I.n++; if (passou) I.ok++;
    if (Number.isFinite(valor)) { if (valor > I.pior) I.pior = valor; if (I.vals.length < 40000) I.vals.push(+valor.toFixed(2)); }
  };

  for (let i = 0; i < n; i++) {
    srand(SEMENTE + i * INCREMENTO);
    const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
    const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
    const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
    sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

    /* a velocidade da vitima ANTES do contato: o evento chega no meio do passo,
       entao o "antes" tem de ser o do quadro anterior */
    const vAnt = new Map();
    const pendentes = [];
    const oEmit = sim._emit;
    sim._emit = function (t, d) {
      try {
        const b = this.ball;
        if (t === 'tackle' && d && d.by && d.on) {
          conta('D1 desarme com contato (<=1,5 m)', D(d.by, d.on) <= 1.5, D(d.by, d.on));
          conta('D4 bola fica no pe de quem desarmou (<=2,5 m)',
                D(d.by, b) <= 2.5, D(d.by, b));
        }
        if (t === 'tackle_missed' && d && d.by && d.on) {
          conta('D5 bote errado: os dois perto (<=2,5 m)', D(d.by, d.on) <= 2.5, D(d.by, d.on));
        }
        if (t === 'foul' && d && d.by && d.on) {
          conta('D2 falta com contato (<=1,5 m)', D(d.by, d.on) <= 1.5, D(d.by, d.on));
          const v0 = vAnt.get(d.on);
          if (Number.isFinite(v0) && v0 > 2.0) pendentes.push({ p: d.on, v0: v0, ate: (Number(this.t) || 0) + 0.5 });
        }
      } catch (_) { }
      return oEmit.apply(this, arguments);
    };

    const passo = sim.step.bind(sim);
    sim.step = function (dt) {
      for (const tm of this.teams) for (const p of tm.players) if (p && !p.red) vAnt.set(p, V(p));
      const r = passo(dt);
      const t = Number(this.t) || 0;
      for (let k = pendentes.length - 1; k >= 0; k--) {
        const q = pendentes[k];
        if (t < q.ate) continue;
        /* D3: quem sofreu falta correndo tem de PERDER velocidade. Contato sem
           consequencia cinematica e o mesmo que nao haver contato. */
        const v1 = V(q.p), perda = (q.v0 - v1) / Math.max(0.001, q.v0);
        conta('D3 vitima freia apos a falta (perde >=25%)', perda >= 0.25, +(100 * perda).toFixed(0));
        pendentes.splice(k, 1);
      }
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
console.log('\n=== O CONTATO: DESARME E FALTA ===  ' + PARTIDAS + ' partidas | ' +
            ((Date.now() - t0) / 1000).toFixed(0) + ' s | sha ' + sha.slice(0, 12) + '\n');
console.log('   ' + 'invariante'.padEnd(42) + 'cumpriu'.padStart(12) + '        %' + '      IC 95%' + '     mediana' + '        pior');
for (const k of Object.keys(R).sort()) {
  const I = R[k], p = I.ok / Math.max(1, I.n), z = 1.96, nn = Math.max(1, I.n);
  const den = 1 + z * z / nn, c = (p + z * z / (2 * nn)) / den;
  const meia = z * Math.sqrt(p * (1 - p) / nn + z * z / (4 * nn * nn)) / den;
  const ord = I.vals.slice().sort((a, b) => a - b);
  const qq = f => ord.length ? ord[Math.min(ord.length - 1, Math.floor(f * ord.length))] : 0;
  const med = qq(.5);
  I._q = [qq(.10), qq(.25), qq(.50), qq(.75), qq(.90), qq(.99)];
  console.log('   ' + k.padEnd(42) + (I.ok + '/' + I.n).padStart(12) +
              (100 * p).toFixed(1).padStart(9) + '%' +
              ('[' + (100 * Math.max(0, c - meia)).toFixed(0) + '–' + (100 * Math.min(1, c + meia)).toFixed(0) + ']').padStart(12) +
              med.toFixed(2).padStart(12) + I.pior.toFixed(2).padStart(12));
}
console.log('\n   DISTRIBUICAO (p10 p25 p50 p75 p90 p99) — o limiar sai daqui, nao do chute:');
for (const k of Object.keys(R).sort()) {
  const I = R[k]; if (!I._q) continue;
  console.log('   ' + k.slice(0, 42).padEnd(44) + I._q.map(v => v.toFixed(2).padStart(7)).join(''));
}
console.log('\n   D1/D2 em metros · D3 em % de velocidade perdida · D4/D5 em metros');
console.log('   Contato e o que faz o lance parecer futebol: gesto perfeito com os');
console.log('   corpos a tres metros continua parecendo fantasma.');
