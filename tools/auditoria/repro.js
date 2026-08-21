#!/usr/bin/env node
'use strict';
/* REPRO — repete UMA partida e mostra o quadro do defeito
   =========================================================================
   A auditoria devolve `partida`, `semente` e `quadro`. Este arquivo pega esses
   tres numeros e devolve o LANCE: a janela de quadros em volta da violacao,
   com bola, dono, atletas proximos e eventos.

   E o passo que transforma "existe um bug" em "esta aqui, olhe".

   Uso:
     node tools/auditoria/repro.js --build=dist/index.html --partida=3
     node tools/auditoria/repro.js --build=... --partida=3 --regra=E1
     node tools/auditoria/repro.js --build=... --partida=3 --quadro=41069 --janela=40
*/
const path = require('path');
const N = require('./nucleo.js');
const INV = require('./invariantes.js');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));

const build = String(argv.build || 'dist/index.html');
const idx = Number(argv.partida || 0);
const DT = 1 / 30;

N.instalarAmbiente();
const consoleReal = console;
global.console = { log: N.noop, warn: N.noop, error: consoleReal.error, info: N.noop, debug: N.noop };
const carga = N.carregar(build, {});
global.console = consoleReal;

if (carga.excecoes.length) {
  console.log('BLOCOS COM ERRO DE CARGA:');
  for (const e of carga.excecoes) console.log(`  ${e.ordem} ${e.id}: ${e.mensagem}`);
}

const pop = N.montarPopulacao(String(argv.elenco || 'variado'));

/* ---------------- passagem 1: achar o quadro do defeito ---------------- */
function passagem1() {
  const { sim, meta } = N.montarPartida(pop, idx, {});
  const obs = INV.criarObservador(sim, meta, { maxPorRegra: 50 });
  let passos = 0;
  while (!sim.isOver() && passos++ < INV.LIM.passosMax) sim.step(DT);
  return { r: obs.finalizar(passos, sim.isOver()), meta, placar: sim.score.slice() };
}

const p1 = passagem1();
console.log('');
console.log(`=== PARTIDA ${idx} ===`);
console.log(`semente ${p1.meta.semente}  ${p1.meta.elencos.join(' x ')}  ` +
  `${p1.meta.formacoes.join('/')}  ${p1.meta.estilos.join('/')}`);
console.log(`placar ${p1.placar.join('x')}`);
console.log('');
if (!p1.r.violacoes.length) console.log('nenhuma violacao nesta partida');
else {
  console.log(`violacoes (${p1.r.violacoes.length}):`);
  for (const v of p1.r.violacoes.slice(0, 20)) {
    console.log(`  ${v.gravidade} ${v.id}  ${v.tempo}T ${v.minuto}'  quadro ${v.quadro}  ${JSON.stringify(v.detalhe)}`);
  }
}

let alvo = argv.quadro ? Number(argv.quadro) : null;
if (!alvo && argv.regra) {
  const v = p1.r.violacoes.find(x => x.id === String(argv.regra));
  if (!v) { console.log(`\nregra ${argv.regra} nao ocorreu nesta partida`); process.exit(0); }
  alvo = v.quadro;
}
if (!alvo) process.exit(0);

/* ---------------- passagem 2: reproduzir e narrar a janela -------------- */
const JANELA = Number(argv.janela || 25);
const { sim, meta } = N.montarPartida(pop, idx, {});
const eventosNoQuadro = [];
const emitOriginal = sim._emit;
let quadro = 0;
sim._emit = function (t, d) {
  eventosNoQuadro.push({ quadro, t, quem: (d && d.by && d.by.ref && d.by.ref.n) || (d && d.p && d.p.ref && d.p.ref.n) || null });
  return emitOriginal.apply(this, arguments);
};

console.log('');
console.log(`=== JANELA EM VOLTA DO QUADRO ${alvo} (+-${JANELA}) ===`);
console.log('quadro   min   dead  pend wait  bola x     y     z    v(m/s) viaj dono                 evento');
let passos = 0;
while (!sim.isOver() && passos < INV.LIM.passosMax) {
  const bAnt = sim.ball ? { x: sim.ball.x, y: sim.ball.y } : null;
  sim.step(DT); quadro++; passos++;
  if (quadro < alvo - JANELA) { eventosNoQuadro.length = 0; continue; }
  if (quadro > alvo + JANELA) break;
  const b = sim.ball;
  const v = bAnt && b ? Math.hypot(b.x - bAnt.x, b.y - bAnt.y) / DT : 0;
  const evs = eventosNoQuadro.filter(e => e.quadro === quadro)
    .map(e => e.t + (e.quem ? `(${e.quem})` : '')).join(' ');
  const dono = b && b.owner ? ((b.owner.ref && b.owner.ref.n) || '?') + ' ' + b.owner.slotPos : '-';
  console.log(
    String(quadro).padStart(6) + ' ' +
    (Number(sim.minute) || 0).toFixed(1).padStart(6) + ' ' +
    (Number(sim.dead) || 0).toFixed(2).padStart(6) + '  ' +
    (sim.pendingRestart ? ' PR ' : '  . ') +
    (sim.waiting ? ' W  ' : ' .  ') +
    (b ? b.x.toFixed(1).padStart(6) : '     -') +
    (b ? b.y.toFixed(1).padStart(6) : '     -') +
    (b ? b.z.toFixed(2).padStart(6) : '     -') +
    v.toFixed(1).padStart(8) +
    (b && b.traveling ? '   S ' : '   . ') +
    dono.padEnd(21) + (quadro === alvo ? '<<< ' : '    ') + evs);
}
console.log('');
console.log('receita desta janela:');
console.log(`  node tools/auditoria/repro.js --build=${path.basename(build)} --partida=${idx} --quadro=${alvo}`);
