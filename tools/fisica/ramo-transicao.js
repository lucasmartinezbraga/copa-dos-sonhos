#!/usr/bin/env node
/* TRANSICAO · o time recompoe depois de perder a bola, ou so troca de alvo?
   -------------------------------------------------------------------------
   O laudo reports/D19-D20-a-mesma-alavanca.md fechou tres tentativas
   reprovadas com uma hipotese, e esta sonda existe para testa-la ANTES de
   escrever qualquer conserto:

     "o motor nao tem fase de transicao — quando o time perde a bola, ele
      troca de alvo, nao recompoe"

   Se for verdade, o comprimento do bloco logo apos a perda tem de ser
   PARECIDO com o comprimento 5 segundos depois: nao ha recomposicao
   acontecendo, so um alvo novo sendo perseguido no ritmo de sempre.

   Se for falso — se o bloco encurta sozinho ao longo dos primeiros segundos —
   entao a fase existe e o defeito e outro: ela e curta ou fraca demais.

   Mede, para o time QUE ACABOU DE PERDER a bola, por segundo desde a perda:
     - comprimento do bloco (do ultimo defensor ao mais adiantado)
     - largura
     - distancia media do FWD a linha de zaga
     - quantos jogadores estao ATRAS da linha da bola

   E separa por metade da partida, porque a hipotese diz que a fadiga deveria
   alongar a recomposicao — se hoje nao ha diferenca entre o comeco e o fim,
   e mais uma prova de que a fase nao existe.

   Uso: node tools/fisica/ramo-transicao.js <build.html> [partidas] */
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
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04', 'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const html = fs.readFileSync(process.argv[2] || 'dist/index.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
while ((m = re.exec(html))) { const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('s' + i); i++; if (SKIP.has(id)) continue; try { vm.runInThisContext(m[2], { filename: id }); } catch (_) {} }

const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS)) ? STYLE_KEYS : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0); return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };
const N = Number(process.argv[3] || 12);

const FLx = 105;
const linhaDe = p => {
  const pos = p && (p.oopPos || p.slotPos);
  if (!p || p.isGK || pos === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
  if (['CDM', 'DM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  return 'FWD';
};
const prog = (tm, x) => (tm && tm.goal && tm.goal.x < FLx / 2) ? x : FLx - x;

/* 0,0-0,5 s | 0,5-1 | 1-2 | 2-3 | 3-4 | 4-6 | 6+ */
const BORDAS = [0.5, 1, 2, 3, 4, 6, Infinity];
const ROT = ['0-0,5s', '0,5-1s', '1-2s', '2-3s', '3-4s', '4-6s', '6s+'];
const balde = dt => { for (let i = 0; i < BORDAS.length; i++) if (dt < BORDAS[i]) return i; return BORDAS.length - 1; };

const METADES = ['1o tempo', '2o tempo'];
const novo = () => ROT.map(() => ({ n: 0, comp: 0, larg: 0, fwdLinha: 0, atras: 0 }));
const dados = [novo(), novo()];
let perdas = 0;

for (let k = 0; k < N; k++) {
  srand(4200000 + k * 7919);
  const sim = new MatchSim(mk(FORMS[k % FORMS.length], STYLES[k % STYLES.length], true),
                           mk(FORMS[(k * 3 + 1) % FORMS.length], STYLES[(k * 5 + 2) % STYLES.length], false),
                           { neutral: true, labMode: true });
  let donoAnterior = null;
  const perdeuEm = [-1e9, -1e9];          /* por time */

  let guarda = 0;
  while (!sim.isOver() && guarda++ < 500000) {
    sim.step(1 / 30);
    const b = sim.ball, dono = b && b.owner;
    const timeDono = dono && !dono.isGK ? dono.team : null;

    /* PERDA: mudou de time o dono da bola */
    if (timeDono != null && donoAnterior != null && timeDono !== donoAnterior) {
      perdeuEm[donoAnterior] = Number(sim.t) || 0;
      perdas++;
    }
    if (timeDono != null) donoAnterior = timeDono;

    if (guarda % 6) continue;             /* amostra a 5 Hz */

    for (const tm of sim.teams) {
      if (timeDono == null || tm.side === timeDono) continue;   /* so quem NAO tem a bola */
      const dt = (Number(sim.t) || 0) - perdeuEm[tm.side];
      if (!(dt >= 0 && dt < 1e6)) continue;
      const bal = balde(dt);

      let minP = Infinity, maxP = -Infinity, minY = Infinity, maxY = -Infinity;
      let somaFwd = 0, nFwd = 0, somaDef = 0, nDef = 0, atras = 0;
      const bolaP = b ? prog(tm, b.x) : null;
      for (const p of tm.players) {
        if (!p || p.red || p.isGK) continue;
        const pp = prog(tm, p.x);
        if (pp < minP) minP = pp;
        if (pp > maxP) maxP = pp;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (linhaDe(p) === 'FWD') { somaFwd += pp; nFwd++; }
        if (linhaDe(p) === 'DEF') { somaDef += pp; nDef++; }
        if (bolaP != null && pp < bolaP) atras++;
      }
      if (!(maxP > minP)) continue;
      const alvo = dados[(Number(sim.minute) || 0) < 45 ? 0 : 1][bal];
      alvo.n++;
      alvo.comp += maxP - minP;
      alvo.larg += maxY - minY;
      if (nFwd && nDef) alvo.fwdLinha += (somaFwd / nFwd) - (somaDef / nDef);
      alvo.atras += atras;
    }
  }
}

const col = (x, n = 8, d = 2) => Number(x).toFixed(d).padStart(n);
console.log(`\nTRANSICAO · o bloco do time que ACABOU de perder a bola — ${N} partidas`);
console.log(`${perdas} perdas de posse observadas\n`);

for (let h = 0; h < 2; h++) {
  console.log(`  ${METADES[h]}`);
  console.log('  desde a perda  amostras   comprimento   largura   FWD-zaga   atras da bola');
  console.log('  ' + '-'.repeat(78));
  for (let i = 0; i < ROT.length; i++) {
    const d = dados[h][i];
    if (!d.n) continue;
    console.log(`  ${ROT[i].padEnd(14)} ${String(d.n).padStart(8)}   ${col(d.comp / d.n, 11)}`
      + `${col(d.larg / d.n, 10)}${col(d.fwdLinha / d.n, 11)}${col(d.atras / d.n, 15, 2)}`);
  }
  console.log();
}

/* ------------------------------------------------------------- veredito */
function serie(h, campo) {
  return dados[h].map(d => d.n ? d[campo] / d.n : null).filter(v => v !== null);
}
const c1 = serie(0, 'comp'), c2 = serie(1, 'comp');
const queda = (s) => (s.length >= 2 ? s[0] - s[s.length - 1] : 0);

console.log('EXISTE FASE DE TRANSICAO?');
console.log(`  1o tempo: o bloco vai de ${c1[0].toFixed(1)} m (recem-perdida) a `
  + `${c1[c1.length - 1].toFixed(1)} m (6 s depois) — encurta ${queda(c1).toFixed(1)} m`);
console.log(`  2o tempo: ${c2[0].toFixed(1)} -> ${c2[c2.length - 1].toFixed(1)} m — `
  + `encurta ${queda(c2).toFixed(1)} m`);
console.log();
if (Math.abs(queda(c1)) < 2 && Math.abs(queda(c2)) < 2) {
  console.log('  >> NAO HA RECOMPOSICAO. O bloco tem o mesmo comprimento no instante da');
  console.log('     perda e 6 segundos depois. O time troca de alvo, nao recompoe.');
  console.log('     A hipotese do laudo se confirma.');
} else {
  console.log('  >> HA recomposicao. A fase existe; o defeito e a intensidade ou a duracao,');
  console.log('     nao a ausencia. NAO implemente uma fase nova — ajuste esta.');
}
console.log(`\n  fadiga alonga a recomposicao? 1o tempo ${queda(c1).toFixed(1)} m x `
  + `2o tempo ${queda(c2).toFixed(1)} m`);
console.log('  (se forem iguais, a fadiga nao toca a transicao — que e o que o laudo previu)\n');

console.log(JSON.stringify({
  partidas: N, perdasDePosse: perdas, rotulos: ROT,
  primeiroTempo: dados[0].map((d, i) => ({ faixa: ROT[i], n: d.n,
    comprimento: d.n ? +(d.comp / d.n).toFixed(2) : null,
    largura: d.n ? +(d.larg / d.n).toFixed(2) : null,
    fwdMenosZaga: d.n ? +(d.fwdLinha / d.n).toFixed(2) : null,
    atrasDaBola: d.n ? +(d.atras / d.n).toFixed(2) : null })),
  segundoTempo: dados[1].map((d, i) => ({ faixa: ROT[i], n: d.n,
    comprimento: d.n ? +(d.comp / d.n).toFixed(2) : null,
    largura: d.n ? +(d.larg / d.n).toFixed(2) : null,
    fwdMenosZaga: d.n ? +(d.fwdLinha / d.n).toFixed(2) : null,
    atrasDaBola: d.n ? +(d.atras / d.n).toFixed(2) : null })),
  encurtamentoEm6s: { primeiroTempo: +queda(c1).toFixed(2), segundoTempo: +queda(c2).toFixed(2) },
}, null, 1));
