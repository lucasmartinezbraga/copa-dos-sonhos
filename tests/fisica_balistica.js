#!/usr/bin/env node
'use strict';
/* Teste de unidade da balistica OS-200.
   Carrega o bundle, planeja segmentos isolados e confere as propriedades que a
   camada 581 nao conseguia ter. Cada verificacao imprime o numero medido, para
   a saida servir de laudo e nao so de "passou". */

const fs = require('fs'), vm = require('vm'), path = require('path');
const build = process.argv[2] || 'dist/index.html';

function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-teste', language: 'pt-BR' });
define('location', { href: 'runner://teste', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', require('crypto').webcrypto);
define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
define('addEventListener', noop); define('removeEventListener', noop);
define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
define('sessionStorage', global.localStorage);
define('CanvasRenderingContext2D', undefined);
define('HTMLElement', function HTMLElement() {}); define('HTMLCanvasElement', function HTMLCanvasElement() {});
define('Image', function Image() {}); define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const html = fs.readFileSync(path.resolve(build), 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const real = console;
global.console = { log: noop, warn: noop, error: real.error };
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (_) {}
}
global.console = real;

if (!global.CDS_OS200) { console.error('FALHA: camada OS-200 nao instalada'); process.exit(1); }

const P = global.MatchSim.prototype;
const sim = Object.create(P);
sim.ball = { x: 0, y: 0, z: 0, lastTouch: null };
sim._physicsSegmentSeq = 0;

let falhas = 0;
function checar(nome, ok, detalhe) {
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  ->  ' + detalhe : ''}`);
  if (!ok) falhas++;
}
const apice = seg => seg.samples.reduce((m, s) => Math.max(m, s.z), 0);

console.log('\n=== BALISTICA OS-200 ===\n');

/* 1. tempo de voo depende da altura ------------------------------------- */
const O = { x: 30, y: 34, z: 0.1 };
const rasteiro = P._planPhysicalSegment.call(sim, O, { x: 70, y: 34 }, 'pass', 'short', 22);
const lancado = P._planPhysicalSegment.call(sim, O, { x: 70, y: 34 }, 'pass', 'launch', 22);
console.log(`rasteiro 40 m: apice ${apice(rasteiro).toFixed(2)} m, voo ${rasteiro.duration.toFixed(3)} s`);
console.log(`lancado  40 m: apice ${apice(lancado).toFixed(2)} m, voo ${lancado.duration.toFixed(3)} s`);
checar('bola alta demora mais que bola rasteira na mesma distancia',
  lancado.duration > rasteiro.duration + 0.25,
  `diferenca ${(lancado.duration - rasteiro.duration).toFixed(3)} s`);
checar('lancamento sobe de verdade', apice(lancado) > 2.5, `apice ${apice(lancado).toFixed(2)} m`);
checar('passe rasteiro nao vira bola aerea', apice(rasteiro) < 1.2, `apice ${apice(rasteiro).toFixed(2)} m`);

/* 2. gravidade real ------------------------------------------------------ */
const ss = lancado.samples;
const iTopo = ss.reduce((b, s, i) => s.z > ss[b].z ? i : b, 0);
const a1 = ss[Math.max(1, Math.floor(iTopo * 0.4))], a2 = ss[Math.min(ss.length - 2, iTopo + Math.floor(iTopo * 0.6))];
const g = (a2.vz - a1.vz) / (a2.t - a1.t);
console.log(`aceleracao vertical medida: ${g.toFixed(2)} m/s^2`);
checar('gravidade proxima de -9,81 (arrasto deixa levemente mais negativa)',
  g < -8.8 && g > -13.5, `${g.toFixed(2)} m/s^2`);

/* 3. apice depois do meio por causa do arrasto --------------------------- */
const fracApice = ss[iTopo].t / lancado.duration;
console.log(`apice em ${(fracApice * 100).toFixed(1)}% do voo`);
checar('apice nao esta cravado no meio do trajeto', Math.abs(fracApice - 0.5) > 0.02,
  `${(fracApice * 100).toFixed(1)}%`);

/* 4. altura do chute agora passa do travessao ---------------------------- */
const alvoAlto = P._planPhysicalSegment.call(sim, { x: 88, y: 34, z: 0.1 },
  { x: 105, y: 34, z: 3.2 }, 'shot', 'shot', 30);
const zLinha = (() => {
  const s = alvoAlto.samples;
  for (let i = 1; i < s.length; i++) if (s[i - 1].x < 105 && s[i].x >= 105) {
    const f = (105 - s[i - 1].x) / (s[i].x - s[i - 1].x);
    return s[i - 1].z + (s[i].z - s[i - 1].z) * f;
  }
  return NaN;
})();
console.log(`chute mirando 3,20 m cruza a linha a ${zLinha.toFixed(2)} m`);
checar('chute consegue passar por cima do travessao (2,44 m)', zLinha > 2.44,
  `z = ${zLinha.toFixed(2)} m`);

/* 5. mira baixa continua entrando --------------------------------------- */
const alvoBaixo = P._planPhysicalSegment.call(sim, { x: 88, y: 34, z: 0.1 },
  { x: 105, y: 36, z: 0.6 }, 'shot', 'shot', 30);
const d5 = P._os200Desfecho.call(sim, alvoBaixo, { x: 105, y: 34 }, 1);
checar('chute mirado dentro da meta e classificado como dentro', d5.tipo === 'dentro',
  `tipo=${d5.tipo} z=${d5.cruzamento ? d5.cruzamento.z.toFixed(2) : '-'}`);

/* 6. bola larga e classificada como fora -------------------------------- */
const largo = P._planPhysicalSegment.call(sim, { x: 88, y: 34, z: 0.1 },
  { x: 105, y: 42, z: 0.8 }, 'shot', 'shot', 30);
const d6 = P._os200Desfecho.call(sim, largo, { x: 105, y: 34 }, 1);
checar('chute larga e classificado como fora', d6.tipo === 'fora' && d6.larga === true, `tipo=${d6.tipo}`);

/* 7. quique existe ------------------------------------------------------- */
const longo = P._planPhysicalSegment.call(sim, { x: 10, y: 34, z: 0.1 },
  { x: 95, y: 34 }, 'pass', 'launch', 26);
console.log(`lancamento de 85 m: ${longo.quiques} quique(s), voo ${longo.duration.toFixed(2)} s`);
checar('bola longa quica antes de morrer', longo.quiques >= 1, `${longo.quiques} quique(s)`);

/* 8. amostras uniformes no tempo (contrato do segmentPoint) -------------- */
const dts = [];
for (let i = 1; i < rasteiro.samples.length; i++) dts.push(rasteiro.samples[i].t - rasteiro.samples[i - 1].t);
const dtMin = Math.min(...dts), dtMax = Math.max(...dts);
checar('amostras uniformes no tempo', (dtMax - dtMin) < 1e-9,
  `dt entre ${dtMin.toFixed(6)} e ${dtMax.toFixed(6)}`);

/* 9. a trajetoria realmente passa pelo alvo ----------------------------- */
function erroNoAlvo(seg) {
  let melhor = Infinity;
  for (const s of seg.samples) melhor = Math.min(melhor, Math.hypot(s.x - seg.target.x, s.y - seg.target.y));
  return melhor;
}
const e1 = erroNoAlvo(rasteiro), e2 = erroNoAlvo(lancado), e3 = erroNoAlvo(alvoBaixo);
console.log(`erro ate o alvo: rasteiro ${e1.toFixed(3)} m, lancado ${e2.toFixed(3)} m, chute ${e3.toFixed(3)} m`);
checar('solucionador acerta o alvo pedido', e1 < 0.6 && e2 < 0.6 && e3 < 0.6,
  `max ${Math.max(e1, e2, e3).toFixed(3)} m`);

console.log(`\n${falhas ? falhas + ' verificacao(oes) falharam' : 'todas as verificacoes passaram'}\n`);
process.exit(falhas ? 1 : 0);
