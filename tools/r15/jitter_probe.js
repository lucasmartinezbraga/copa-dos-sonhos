#!/usr/bin/env node
'use strict';
/**
 * FLUIDEZ DO MOVIMENTO (§32/§53).
 *
 * O usuário relatou movimento "não fluido nem com sentido". A medição de FPS
 * já descartou performance: 59,9 fps e frame mediano de 16,7 ms em R13.0,
 * R15.3 e R15.8 — inclusive no motor puro sem nenhuma alteração desta sessão.
 * Logo o problema é a QUALIDADE do deslocamento, não a taxa de quadros.
 *
 * Este probe mede nervosia: quanto o vetor de velocidade de cada jogador muda
 * de direção entre quadros consecutivos. Movimento com intenção descreve curvas
 * suaves; movimento sem intenção oscila.
 *
 * Serve para testar o suspeito `r14-pressing-approach`, que troca o freio de
 * aproximação de `d*3.2` para `d*9` em quem persegue a bola — a um metro do
 * alvo isso pede 9 m/s, então o defensor não desacelera ao chegar: mergulha,
 * passa do ponto e corrige. A hipótese é que isso produza o zigue-zague.
 *
 * O recorte "perto da bola" (0–6 m) isola justamente quem está perseguindo.
 */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function def(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
def('window', global); def('self', global);
def('navigator', { userAgent: 'cds-jitter', language: 'pt-BR' });
def('location', { href: 'runner://jitter', search: '', hash: '' });
def('performance', { now: () => 0 }); def('crypto', crypto.webcrypto);
def('requestAnimationFrame', noop); def('cancelAnimationFrame', noop);
def('localStorage', { _d: {}, getItem(k){return this._d[k]==null?null:this._d[k];},
  setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];}, clear(){this._d={};} });
const rc = console;
def('console', Object.assign({}, console, { log: noop, info: noop, warn: noop, debug: noop }));

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('script-' + i); i++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(m[2], { filename: id + '.js' }); }
  catch (e) {
    if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message))) continue;
    throw e;
  }
}
const sha = crypto.createHash('sha256').update(html).digest('hex');

function labTeam(db, f, s, home) {
  const sq = db.squads[0], pk = autoLineup(sq, f, 0);
  const keys = (global.CDSDataV3 && global.CDSDataV3.attributes) || [];
  pk.lineup = pk.lineup.map((slot, idx) => {
    const pos = slot.pos || 'CM';
    return Object.assign({}, slot, { p: {
      id: 'L_' + pos + idx, n: 'A' + (idx + 1), slot: pos, pos, r: 82, starter: 1,
      traits: [], behaviorTraits: [], naturalRoles: [],
      a8: [82,82,82,82,82,82,82,82],
      attributesV3: Object.fromEntries(keys.map(k => [k, 82])),
      profileV3: { dominantFoot:'R', weakFoot:4, heightCmSim: pos==='GK'?190:182,
                   bodyType:'average', primaryPosition: pos },
      _a: {} }});
  });
  pk.bench = [];
  return { squad: sq, name: sq.c, flag: sq.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: pk.lineup, bench: [], formKey: f, style: s };
}

const db = buildDB(DATA), seeds = Number(argv.seeds || 8);
let turnSum = 0, turnN = 0, hard = 0, accSum = 0, accN = 0;
let nearSum = 0, nearN = 0, nearHard = 0;
let ovSum = 0, ovN = 0, ovHard = 0, farSum = 0, farN = 0, farHard = 0;
let fastSum = 0, fastN = 0, fastHard = 0, slowSum = 0, slowN = 0, slowHard = 0;
let mkSum = 0, mkN = 0, mkHard = 0;

for (let s = 0; s < seeds; s++) {
  srand(5600000 + s * 823);
  const sim = new MatchSim(labTeam(db,'4-3-3','balanced',true),
                           labTeam(db,'4-3-3','balanced',false),
                           { neutral: true, labMode: true });
  sim.teams[0].formKey = '4-3-3'; sim.teams[1].formKey = '4-3-3';
  const DT = 1/30; let n = 0; const prev = new Map();
  while (!sim.isOver() && n++ < 500000) {
    sim.step(DT);
    const b = sim.ball;
    for (const tm of sim.teams) for (const p of tm.players) {
      if (p.red) continue;
      const vx = p.vx || 0, vy = p.vy || 0, v = Math.hypot(vx, vy);
      const o = prev.get(p);
      // só compara quando ambos os quadros têm movimento real: parado não tem rumo
      if (o && v > 0.6 && o.v > 0.6) {
        const dot = (vx * o.vx + vy * o.vy) / (v * o.v);
        const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        turnSum += ang; turnN++;
        if (ang > 25) hard++;
        accSum += Math.abs(v - o.v); accN++;
        if (b) {
          const dB = Math.hypot(p.x - b.x, p.y - b.y);
          if (dB < 6) { nearSum += ang; nearN++; if (ang > 25) nearHard++; }
        }
        // TESTE DE SOBREPOSICAO: `_resolveOverlaps` (29-r12:81) empurra quem
        // estiver a menos de 1,7 m de um companheiro, escrevendo ate 0,30 m por
        // quadro DIRETO na posicao, fora do modelo de steering. Se o giro brusco
        // se concentrar em quem esta dentro desse raio, a correcao e a causa.
        let closeMate = false;
        for (const q of tm.players) {
          if (q === p || q.red) continue;
          if (Math.hypot(p.x - q.x, p.y - q.y) < 1.7) { closeMate = true; break; }
        }
        if (closeMate) { ovSum += ang; ovN++; if (ang > 25) ovHard++; }
        else { farSum += ang; farN++; if (ang > 25) farHard++; }
        // ALTA vs BAIXA velocidade: um pivo de 25 graus a 1 m/s e trivial;
        // a mesma inversao a 7 m/s e impossivel. Medir junto esconde as duas.
        if (v >= 5.0) { fastSum += ang; fastN++; if (ang > 25) fastHard++; }
        else if (v <= 2.5) { slowSum += ang; slowN++; if (ang > 25) slowHard++; }
        // DURANTE MARCACAO: quem tem referencia atribuida (_markRef) — e o caso
        // em que travar o giro custaria capacidade defensiva de reagir.
        if (p._markRef && !p._markRef.red) { mkSum += ang; mkN++; if (ang > 25) mkHard++; }
      }
      prev.set(p, { vx, vy, v });
    }
  }
}

const out = {
  build: argv.build, sha256: sha, seeds,
  giroMedio_graus_por_quadro: +(turnSum / (turnN || 1)).toFixed(2),
  giroMedio_perto_da_bola: +(nearSum / (nearN || 1)).toFixed(2),
  fracao_giros_bruscos_25g: +(hard / (turnN || 1)).toFixed(4),
  fracao_giros_bruscos_perto_da_bola: +(nearHard / (nearN || 1)).toFixed(4),
  variacao_velocidade_media: +(accSum / (accN || 1)).toFixed(3),
  // com companheiro a <1,7 m (dentro do raio de correcao de sobreposicao)
  giro_com_companheiro_colado: +(ovSum / (ovN || 1)).toFixed(2),
  bruscos_com_companheiro_colado: +(ovHard / (ovN || 1)).toFixed(4),
  amostras_colado: ovN,
  // sem ninguem colado
  giro_sem_companheiro_colado: +(farSum / (farN || 1)).toFixed(2),
  bruscos_sem_companheiro_colado: +(farHard / (farN || 1)).toFixed(4),
  amostras_livre: farN,
  giro_alta_velocidade: +(fastSum / (fastN || 1)).toFixed(2),
  bruscos_alta_velocidade: +(fastHard / (fastN || 1)).toFixed(4),
  amostras_alta: fastN,
  giro_baixa_velocidade: +(slowSum / (slowN || 1)).toFixed(2),
  bruscos_baixa_velocidade: +(slowHard / (slowN || 1)).toFixed(4),
  amostras_baixa: slowN,
  giro_durante_marcacao: +(mkSum / (mkN || 1)).toFixed(2),
  bruscos_durante_marcacao: +(mkHard / (mkN || 1)).toFixed(4),
  amostras_marcacao: mkN,
  amostras: turnN,
};
rc.error(JSON.stringify(out, null, 1));
fs.writeFileSync(argv.out || 'reports/r15/jitter.json', JSON.stringify(out, null, 1));
