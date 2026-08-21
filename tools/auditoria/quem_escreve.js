#!/usr/bin/env node
'use strict';
/* QUEM ESCREVE — de qual camada veio esta escrita?
   =========================================================================
   Num jogo de 80 camadas, saber que um campo tem o valor errado nao adianta:
   e preciso saber QUEM o escreveu. Esta ferramenta troca um campo da partida
   por um par get/set instrumentado e conta as escritas por origem (a pilha de
   chamada, resumida no nome do bloco e da funcao).

   Foi escrita para responder "quem re-arma `dead` com a bola rolando?" e serve
   para qualquer campo: `dead`, `minute`, `poss`, `stoppage`, `pendingRestart`.

   Uso:
     node tools/auditoria/quem_escreve.js --build=dist/index.html --campo=dead
     node tools/auditoria/quem_escreve.js --build=... --campo=dead --partida=0 \
       --de=2900 --ate=3000
*/
const N = require('./nucleo.js');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const build = String(argv.build || 'dist/index.html');
const campo = String(argv.campo || 'dead');
const idx = Number(argv.partida || 0);
const DE = argv.de != null ? Number(argv.de) : 0;
const ATE = argv.ate != null ? Number(argv.ate) : Infinity;
const DT = 1 / 30;

N.instalarAmbiente();
const consoleReal = console;
global.console = { log: N.noop, warn: N.noop, error: consoleReal.error, info: N.noop, debug: N.noop };
N.carregar(build, {});
global.console = consoleReal;

const pop = N.montarPopulacao(String(argv.elenco || 'variado'));
const { sim } = N.montarPartida(pop, idx, {});

/* `--campo` aceita caminho: `dead`, `ball.x`, `teams.0.fx.line`. O dono e o
   objeto que de fato guarda a propriedade — e nele que o acessor entra. */
function resolverAlvo(raiz, caminho) {
  const partes = String(caminho).split('.');
  let obj = raiz;
  for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
  return { obj, prop: partes[partes.length - 1] };
}

/* O truque: o campo vira acessor na INSTANCIA. Ninguem no jogo sabe a
   diferenca — leitura e escrita continuam funcionando — mas cada escrita passa
   por aqui e deixa a sua origem registrada. */
const ALVO = resolverAlvo(sim, campo);
let valor = ALVO.obj[ALVO.prop];
let quadro = 0;
const porOrigem = new Map();
const amostras = [];

function origem() {
  const linhas = String(new Error().stack || '').split('\n').slice(3, 9);
  for (const l of linhas) {
    const m = l.match(/at\s+([^\s(]+)\s*\(?([^)\s]*)/);
    if (!m) continue;
    const fn = m[1], arq = (m[2] || '').split('/').pop();
    if (/quem_escreve/.test(arq)) continue;
    return `${arq || '?'} · ${fn}`;
  }
  return '?';
}

Object.defineProperty(ALVO.obj, ALVO.prop, {
  configurable: true,
  get() { return valor; },
  set(v) {
    if (quadro >= DE && quadro <= ATE && (!argv.so_dead || (Number(sim.dead) || 0) > 0)) {
      const o = origem();
      const r = porOrigem.get(o) || { n: 0, deZero: 0, valores: [] };
      r.n++;
      if ((valor || 0) <= 0 && v > 0) r.deZero++;
      if (r.valores.length < 5) r.valores.push(+Number(v).toFixed(3));
      porOrigem.set(o, r);
      if (amostras.length < 30 && argv.subindo !== undefined &&
          (valor || 0) <= Number(argv.subindo) && v > (valor || 0)) {
        amostras.push({ quadro, de: +Number(valor || 0).toFixed(3), para: +Number(v).toFixed(3), origem: o });
      }
    }
    valor = v;
  },
});

let passos = 0;
while (!sim.isOver() && passos++ < 500000) { sim.step(DT); quadro++; if (quadro > ATE) break; }

console.log('');
console.log(`=== QUEM ESCREVE EM sim.${campo} ===`);
console.log(`partida ${idx}  quadros ${DE}..${Number.isFinite(ATE) ? ATE : quadro}`);
if (argv.so_dead) console.log('(so escritas com sim.dead > 0)');
console.log('');
const linhas = Array.from(porOrigem.entries()).sort((a, b) => b[1].n - a[1].n);
console.log('  escritas   subiu-do-zero   origem');
for (const [o, r] of linhas.slice(0, 14)) {
  console.log(`  ${String(r.n).padStart(8)}   ${String(r.deZero).padStart(13)}   ${o}   ex: ${r.valores.join(', ')}`);
}
if (amostras.length) {
  console.log('');
  console.log('re-armes com a bola quase viva (dead <= 0,11 subindo):');
  for (const a of amostras.slice(0, 12)) {
    console.log(`  quadro ${String(a.quadro).padStart(6)}  ${a.de} -> ${a.para}   ${a.origem}`);
  }
}
