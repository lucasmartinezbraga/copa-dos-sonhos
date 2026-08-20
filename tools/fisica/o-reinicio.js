#!/usr/bin/env node
'use strict';
/* O REINÍCIO — os jogadores CHEGAM ao posto quando a bola volta a rolar?
   =========================================================================
   RELATO do dono: "quando rola um gol o jogo comeca do nada sem os jogadores
   se organizarem".

   POR QUE ESTA SONDA EXISTE. A versao de tela (`a-partida-inteira.js`) mede
   isso, mas so pega 2 a 5 pontapes por partida -- e cada partida leva oito
   minutos de parede. Com essa amostra, 15,8 m e 12,3 m sao o mesmo numero, e
   eu ja tinha proposto (e quase embarcado) DUAS correcoes apoiadas nessa
   diferenca. Sem navegador da para rodar cem partidas em minutos e juntar
   trezentos pontapes, que e o que decide.

   O QUE MEDE, em cada pontape inicial que nao seja o de comeco de tempo:

     R1  distancia MEDIA de cada atleta ao proprio posto quando a bola rola
     R2  distancia do atleta MAIS LONGE
     R3  fracao dos atletas ja posicionados (<= 3 m do posto)
     R4  quanto o POSTO andou durante a parada  (o alvo fugiu?)
     R5  quanto o CORPO andou durante a parada  (ele tentou?)
     R6  fracao dos atletas na PROPRIA METADE quando a bola rola
     R7  a maior invasao da metade adversaria, em metros

   §R6 e R7 existem porque R1 MENTE quando a janela muda de tamanho. R1 mede a
   distancia ao posto `hx/hy`, e a camada tatica recalcula esse posto durante a
   parada inteira -- R4 mostra que ele anda 32 m. Esticar a janela deixa o
   atleta chegar no alvo que ele perseguia E da mais tempo para o posto fugir,
   entao R1 pode piorar enquanto o campo FICA mais arrumado.

   Estar na propria metade no pontape nao e preferencia tatica: e regra do
   jogo, nao se move, e e o que o olho le como "time bem posto". Os dois
   batedores do circulo central sao excluidos -- o lugar deles e o meio.

   R4 e R5 juntos sao o que separa "o atleta nao anda" de "o atleta persegue um
   alvo que foge" -- distincao que custou tres hipoteses erradas para aparecer,
   porque a sonda antiga media so a distancia final e os dois casos dao o mesmo
   numero.

   Uso: node tools/fisica/o-reinicio.js --build=dist/index.html --matches=100
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
const PARTIDAS = Number(argv.matches || 100);
const BUILD = String(argv.build || 'dist/index.html');
const PERTO = Number(argv.perto || 3);

function noop() { }
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-reinicio', language: 'pt-BR' });
  define('location', { href: 'runner://reinicio', search: '', hash: '' });
  define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
  define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
  define('addEventListener', noop); define('removeEventListener', noop);
  define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
  define('alert', noop); define('confirm', () => true); define('prompt', () => null);
  define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
  define('sessionStorage', global.localStorage);
  const el = () => ({
    style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, removeChild: noop, setAttribute: noop, getAttribute: () => null,
    addEventListener: noop, removeEventListener: noop, querySelector: () => null,
    querySelectorAll: () => [], getContext: () => null, insertAdjacentHTML: noop,
    remove: noop, focus: noop, blur: noop, click: noop, children: [], dataset: {}
  });
  define('document', {
    readyState: 'complete', body: el(), documentElement: el(),
    createElement: el, createElementNS: el, getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener: noop,
    removeEventListener: noop, head: el(), title: ''
  });
  define('CanvasRenderingContext2D', undefined);
  define('HTMLElement', function HTMLElement() { });
  define('HTMLCanvasElement', function HTMLCanvasElement() { });
  define('Image', function Image() { });
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

function medir(n) {
  const db = buildDB(DATA);
  const FORMS = Object.keys(FORMATIONS);
  const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
    ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
  const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
  const mk = (f, st, home) => {
    const p = autoLineup(squad, f, 0);
    return {
      squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
      lineup: p.lineup, bench: p.bench, formKey: f, style: st
    };
  };

  const R = [];
  for (let i = 0; i < n; i++) {
    srand(SEMENTE + i * INCREMENTO);
    const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
    const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
    const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
    sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

    let pend = null;
    const oldK = sim._kickoff.bind(sim);
    sim._kickoff = function () {
      const r = oldK.apply(this, arguments);
      try {
        if ((Number(sim.t) || 0) > 5) {
          const base = [];
          for (const tm of sim.teams) for (const p of tm.players) {
            if (!p || p.red) continue;
            base.push({ p, px: p.x, py: p.y, hx: p.hx, hy: p.hy });
          }
          pend = base;
        }
      } catch (_) { }
      return r;
    };

    const passo = sim.step.bind(sim);
    let morta = false;
    sim.step = function (dt) {
      const r = passo(dt);
      const agoraMorta = (Number(this.dead) || 0) > 0;
      /* a medicao acontece no quadro em que a bola VOLTA A ROLAR */
      if (pend && morta && !agoraMorta) {
        let soma = 0, pior = 0, perto = 0, poste = 0, corpo = 0, k = 0;
        let naMetade = 0, invasao = 0, m = 0;
        const dono = this.ball && this.ball.owner;
        for (const b of pend) {
          const p = b.p; if (!p || p.red) continue;
          const d = Math.hypot(p.x - p.hx, p.y - p.hy);
          soma += d; if (d > pior) pior = d; if (d <= PERTO) perto++;
          poste += Math.hypot(p.hx - b.hx, p.hy - b.hy);
          corpo += Math.hypot(p.x - b.px, p.y - b.py);
          k++;
          /* R6/R7 · a REGRA. `attackDir > 0` ataca para +x, entao a propria
             metade e x <= FL/2. O batedor do circulo fica de fora. */
          if (p === dono) continue;
          const tm = this.teams[p.team];
          const dir = (tm && tm.attackDir > 0) ? 1 : -1;
          const dentro = dir > 0 ? (p.x <= FL / 2) : (p.x >= FL / 2);
          const fora = dir > 0 ? (p.x - FL / 2) : (FL / 2 - p.x);
          if (dentro) naMetade++; else if (fora > invasao) invasao = fora;
          m++;
        }
        if (k) R.push({
          media: soma / k, pior, perto: perto / k, poste: poste / k, corpo: corpo / k,
          metade: m ? naMetade / m : 1, invasao
        });
        pend = null;
      }
      morta = agoraMorta;
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
const q = (arr, f) => {
  const o = arr.map(f).sort((a, b) => a - b);
  return p => o.length ? o[Math.min(o.length - 1, Math.floor(p * o.length))] : 0;
};
console.log('\n=== O REINICIO ===  ' + PARTIDAS + ' partidas | ' + R.length + ' pontapes | ' +
  ((Date.now() - t0) / 1000).toFixed(0) + ' s | sha ' + sha.slice(0, 12) + '\n');
if (R.length < 30) {
  console.log('  SEM AMOSTRA: ' + R.length + ' pontapes. REPROVA (OS-247).');
  process.exit(1);
}
const linha = (rot, f, un) => {
  const g = q(R, f);
  console.log('   ' + rot.padEnd(44) +
    g(.50).toFixed(1).padStart(8) + un +
    '   p90 ' + g(.90).toFixed(1).padStart(6) +
    '   pior ' + g(.999).toFixed(1).padStart(6));
};
console.log('   ' + 'grandeza'.padEnd(44) + ' mediana' + '        p90' + '        pior');
linha('R1 distancia MEDIA ao posto no reinicio', x => x.media, ' m');
linha('R2 distancia do atleta MAIS LONGE', x => x.pior, ' m');
linha('R4 quanto o POSTO andou na parada', x => x.poste, ' m');
linha('R5 quanto o CORPO andou na parada', x => x.corpo, ' m');
const g3 = q(R, x => x.perto);
console.log('   ' + 'R3 fracao ja posicionada (<= ' + PERTO + ' m)'.padEnd(44) +
  (100 * g3(.50)).toFixed(0).padStart(7) + '%   p10 ' + (100 * g3(.10)).toFixed(0) + '%');
const g6 = q(R, x => x.metade);
console.log('   ' + 'R6 fracao na PROPRIA METADE (regra)'.padEnd(44) +
  (100 * g6(.50)).toFixed(0).padStart(7) + '%   p10 ' + (100 * g6(.10)).toFixed(0) + '%');
linha('R7 maior invasao da metade adversaria', x => x.invasao, ' m');
console.log('\n   R4 e R5 juntos separam "o atleta nao anda" de "o atleta persegue um alvo');
console.log('   que foge". A distancia final sozinha nao distingue os dois casos.');
process.exit(0);
