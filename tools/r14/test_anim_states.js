#!/usr/bin/env node
'use strict';
/*
 * Cenários dirigidos da máquina de estados de animação (Fase 3).
 *
 * A auditoria exige comportamento observável e reproduzível, não a existência
 * de uma variável com o nome certo. Cada cenário aqui dirige o controlador por
 * uma situação concreta e afirma a sequência de estados que DEVE sair dela —
 * incluindo as três regras que o sistema antigo não tinha: fases ancoradas no
 * contrato, prioridade por tier e interrupção.
 *
 *   node tools/r14/test_anim_states.js [--out reports/r14/anim/states.json]
 */
const path = require('path');
const fs = require('fs');
const A = require(path.join(__dirname, '../../src/ux/60-anim-state-machine.js'));

let pass = 0, fail = 0;
const results = [];

function check(scenario, desc, ok, detail) {
  (ok ? pass++ : fail++);
  results.push({ scenario, check: desc, pass: !!ok, detail: detail || '' });
  if (!ok) console.error(`  FALHOU [${scenario}] ${desc} :: ${detail || ''}`);
}

/* avança o controlador em passos de dt e coleta os estados visitados */
function drive(c, seconds, dt, ctx, now0) {
  const seen = [];
  let now = now0 || 0;
  for (let t = 0; t < seconds; t += dt) {
    now += dt;
    const s = c.update(dt, now, ctx);
    if (!seen.length || seen[seen.length - 1] !== s.state) seen.push(s.state);
  }
  return seen;
}

const DT = 1 / 30;

/* ── 1. LOCOMOÇÃO: a velocidade escolhe o estado ─────────────────────────── */
{
  const m = A.create();
  const c = m.of('p1');
  for (const [spd, want] of [[0, 'idle'], [1.0, 'walk'], [2.5, 'jog'], [4.5, 'run'], [8.0, 'sprint']]) {
    drive(c, 0.3, DT, { speed: spd });
    check('locomocao', `${spd} m/s -> ${want}`, c.state === want, `obtido ${c.state}`);
  }
}

/* ── 2. CONTRATO: as fases da ação vêm do motor, e o CONTATO cai no ponto
      exato em que a bola sai. É o vínculo que a Fase 2 tornou possível. ──── */
{
  const c = new A.Controller('p2');
  const contract = {
    actionId: 'a1', action: 'pass', prepareDuration: 0.20,
    followThroughDuration: 0.10, recoveryDuration: 0.12
  };
  c.beginAction(contract, 0);
  check('contrato', 'entra em pass_prepare', c.state === 'pass_prepare', c.state);
  check('contrato', 'duração do preparo = contrato', Math.abs(c.dur - 0.20) < 1e-9, String(c.dur));

  drive(c, 0.19, DT, { speed: 0 });
  check('contrato', 'não contata antes da hora', c.state === 'pass_prepare', c.state);
  drive(c, 0.05, DT, { speed: 0 });
  check('contrato', 'contato após o preparo', c.state === 'pass_contact', c.state);

  const all = drive(c, 1.2, DT, { speed: 0 });
  check('contrato', 'sequência completa até recuperar',
    all.includes('pass_followthrough') && all.includes('pass_recover'), all.join(' -> '));
  check('contrato', 'volta para locomoção no fim', c.state === 'idle', c.state);
}

/* ── 3. PRIORIDADE: locomoção não interrompe ação comprometida ───────────── */
{
  const c = new A.Controller('p3');
  c.beginAction({ actionId: 'a2', action: 'shot', prepareDuration: 0.22,
                  followThroughDuration: 0.20, recoveryDuration: 0.22 }, 0);
  const okDenied = c.request('run', 0.05) === false;
  check('prioridade', 'run NÃO interrompe shot_prepare', okDenied, `estado ${c.state}`);
  check('prioridade', 'segue em shot_prepare', c.state === 'shot_prepare', c.state);

  const okGK = c.request('gk_low_dive', 0.06) === true;
  check('prioridade', 'tier maior (gk_low_dive) interrompe', okGK, c.state);
}

/* ── 4. INTERRUPÇÃO: desarme durante o preparo mata a ação ───────────────── */
{
  const c = new A.Controller('p4');
  c.beginAction({ actionId: 'a3', action: 'pass', prepareDuration: 0.20,
                  followThroughDuration: 0.10, recoveryDuration: 0.12 }, 0);
  drive(c, 0.10, DT, { speed: 0 });
  const did = c.interrupt(0.10, 'tackled');
  check('interrupcao', 'interrupção aceita durante o preparo', did === true, String(did));
  check('interrupcao', 'vai para lose_control', c.state === 'lose_control', c.state);
  check('interrupcao', 'marca interrupted', c.interrupted === true, String(c.interrupted));
  check('interrupcao', 'não emite contato depois de interrompida',
    !drive(c, 1.0, DT, { speed: 0 }).includes('pass_contact'), 'contato indevido');
}

/* ── 5. GOLEIRO: o piso do goleiro é prontidão, não idle ─────────────────── */
{
  const c = new A.Controller('gk');
  drive(c, 0.5, DT, { speed: 0, isGK: true });
  check('goleiro', 'piso do goleiro = gk_ready', c.state === 'gk_ready', c.state);
  c.request('gk_high_dive', 1.0, { force: true });
  check('goleiro', 'entra em gk_high_dive', c.state === 'gk_high_dive', c.state);
  drive(c, 1.2, DT, { speed: 0, isGK: true });
  check('goleiro', 'volta para prontidão após o voo', c.state === 'gk_ready', c.state);
}

/* ── 6. COM BOLA: conduzir x proteger conforme o deslocamento ────────────── */
{
  const c = new A.Controller('p6');
  drive(c, 0.4, DT, { speed: 3.0, hasBall: true });
  check('com_bola', 'em movimento com bola -> carry', c.state === 'carry', c.state);
  drive(c, 0.4, DT, { speed: 0.05, hasBall: true });
  check('com_bola', 'parado com bola -> protect', c.state === 'protect', c.state);
}

/* ── 7. COBERTURA: todos os estados exigidos pela auditoria existem ──────── */
{
  const exigidos = [
    'idle','walk','jog','run','sprint','accelerate','decelerate','turn','strafe','backpedal',
    'receive_prepare','receive_contact','receive_control','carry','protect','heavy_touch','lose_control',
    'pass_prepare','pass_contact','pass_followthrough','pass_recover','first_touch_pass','long_pass','cross',
    'shot_prepare','shot_contact','shot_followthrough','shot_recover','placed_shot','power_shot','volley','header',
    'dribble_prepare','body_feint','inside_cut','outside_cut','turn_dribble','burst_touch','protect_turn',
    'dribble_success','dribble_failure',
    'press','jockey','intercept','standing_tackle','slide_tackle','block','body_duel','recover',
    'gk_ready','gk_shift','gk_set','gk_low_dive','gk_high_dive','gk_catch','gk_parry','gk_punch',
    'gk_foot_save','gk_smother','gk_ground_recover','gk_throw','gk_kick'
  ];
  const faltando = exigidos.filter(s => !A.STATES[s]);
  check('cobertura', `${exigidos.length} estados exigidos presentes`, faltando.length === 0,
    faltando.join(', '));

  for (const k of Object.keys(A.SEQ)) {
    check('cobertura', `sequência de ${k} tem 4 fases`, A.SEQ[k].length === 4, A.SEQ[k].join(','));
  }
}

/* ── 8. INDEPENDÊNCIA: um atleta não trunca a pose de outro ──────────────── */
{
  const m = A.create();
  for (let i = 0; i < 22; i++) m.of('p' + i);
  m.of('p0').beginAction({ actionId: 'x', action: 'shot', prepareDuration: 0.22,
                           followThroughDuration: 0.20, recoveryDuration: 0.22 }, 0);
  const ctx = {}; for (let i = 0; i < 22; i++) ctx['p' + i] = { speed: 5 };
  let now = 0;
  for (let t = 0; t < 0.15; t += DT) { now += DT; m.update(DT, now, ctx); }
  check('independencia', '22 atletas simultâneos: p0 mantém shot_prepare',
    m.of('p0').state === 'shot_prepare', m.of('p0').state);
  check('independencia', 'os outros 21 correm normalmente',
    m.of('p11').state === 'run', m.of('p11').state);
}

const total = pass + fail;
console.log(`\ncenários de animação: ${pass}/${total}`);
const out = { version: A.version, stateCount: A.stateCount, passed: pass, total, results };
const idx = process.argv.indexOf('--out');
if (idx > 0 && process.argv[idx + 1]) {
  const p = process.argv[idx + 1];
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(out, null, 1), 'utf8');
  console.log(`[gravado] ${p}`);
}
process.exit(fail ? 1 : 0);
