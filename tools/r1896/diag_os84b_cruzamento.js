#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-84B · ONDE O CHUTE "PARA FORA" CRUZA A LINHA DE FUNDO
 * =============================================================
 * A pergunta e simples e nunca foi feita: quando o jogo narra "manda pra fora",
 * por onde a bola passou na linha de fundo?
 *
 * Metodo: gancho em _startTravel e _continueTravel. Para cada viagem do tipo
 * `shot` cujo alvo esteja ALEM da linha de fundo, calcula-se o ponto em que a
 * RETA pe->alvo cruza x = g.x (a linha), e a altura da parabola nesse ponto.
 * Depois confronta-se com o desfecho realmente emitido pelo motor.
 *
 * Nao interpreta nada: so mede.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(i => {
  const [k, v] = i.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const noop = () => {};
const define = (n, v) => { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } };
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds', language: 'pt-BR' });
define('location', { href: 'runner://os84b', search: '', hash: '' });
define('performance', { now: () => 0 });
define('crypto', crypto.webcrypto);
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

const real = console;
global.console = { log: noop, warn: noop, error: noop };
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
                      'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0;
while ((m = re.exec(html))) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('script-' + idx); idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(m[2], { filename: id + '.js' }); } catch (_) {}
}

const POSTE = 3.66, TRAVESSAO = 2.44;
const P = MatchSim.prototype;

/* MEDICAO NO INSTANTE DO DESFECHO, a partir da bola REAL.
 *
 * A primeira versao deste instrumento guardava a geometria do ALVO em
 * _startTravel e a emparelhava com o proximo `miss`. Estava contaminada: um
 * chute mirando o GOL (alvo em g.x + dir*0,9, |dy| <= 3,35) tambem passa da
 * linha, entao uma finalizacao defendida deixava geometria pendente que era
 * atribuida a um `miss` posterior, de outro lance. O sintoma foi uma penetracao
 * de -3,66 m, ou seja o centro exato da meta -- numero impossivel para um chute
 * para fora, e por isso o delator do proprio instrumento.
 *
 * Aqui a leitura e feita no quadro da emissao, da posicao e da velocidade que a
 * bola tem naquele instante, retro-projetadas ate x = g.x. E a mesma conta que a
 * camada de apresentacao faz, e mede a bola, nao a intencao. */
const censo = [];
const oEmit = P._emit;
P._emit = function (type, ev) {
  try {
    if (type === 'miss' || type === 'goal') {
      const by = ev && ev.by, tm = by && this.teams && this.teams[by.team];
      const g = tm && tm.oppGoal, b = this.ball;
      if (g && b && Number.isFinite(b.x) && Number.isFinite(b.vx)) {
        const vx = b.vx, vy = b.vy, vz = b.vz || 0;
        if (Math.hypot(vx, vy) > 1) {
          const bruto = (b.x - g.x) / vx;               // segundos desde o cruzamento
          const bk = (bruto > 0 && bruto < 0.6) ? bruto : 0;
          const cruzY = b.y - vy * bk;
          const cruzZ = Math.max(0, (b.z || 0) - vz * bk - 10 * bk * bk);
          censo.push({ tipo: type, cruzY: cruzY, cruzZ: cruzZ, gy: g.y,
                       folga: Math.abs(cruzY - g.y) - POSTE,
                       /* alem > 0 = a bola JA passou da linha quando o motor
                          fechou o lance; alem <= 0 = ela nem chegou la */
                       alem: (b.x - g.x) * (tm.attackDir || (g.x > 52.5 ? 1 : -1)),
                       bruto: bruto, usouRetro: bk !== 0,
                       motivo: (ev && ev.reason) || 'sem-motivo' });
        }
      }
    }
  } catch (_) {}
  return oEmit.apply(this, arguments);
};

const db = buildDB(DATA);
const N = Number(argv.matches || 8);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, home) => {
  const p = autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: form, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let guarda = 0;
  while (!sim.isOver() && guarda++ < 400000) sim.step(1 / 30);
}

const fora = censo.filter(c => c.tipo === 'miss');
/* SO conta como cruzamento quem realmente cruzou: se `alem <= 0` a bola nem
   chegou a linha de fundo quando o motor fechou o lance, e ai nao existe ponto
   de cruzamento nenhum para medir. Misturar os dois foi o erro da leitura
   anterior. */
const cruzaram = fora.filter(c => c.alem > 0 && c.usouRetro);
const naoCruzaram = fora.filter(c => !(c.alem > 0 && c.usouRetro));
const dentro = cruzaram.filter(c => c.folga < 0 && c.cruzZ <= TRAVESSAO);
const porCima = cruzaram.filter(c => c.cruzZ > TRAVESSAO);
const fs2 = cruzaram.map(c => c.folga).sort((a, b) => a - b);
const pct = p => fs2.length ? fs2[Math.min(fs2.length - 1, Math.floor(p * fs2.length))] : NaN;
const porMotivo = {};
for (const c of naoCruzaram) porMotivo[c.motivo] = (porMotivo[c.motivo] || 0) + 1;
/* Quem sao, por SITIO DE EMISSAO, os que ainda cruzam entre as traves. Sem
   isto eu estaria adivinhando qual ramo do motor produz o defeito restante. */
const dentroPorMotivo = {};
for (const c of dentro) {
  const k = c.motivo + '  (folga mediana ' + c.folga.toFixed(2) + ')';
  dentroPorMotivo[c.motivo] = (dentroPorMotivo[c.motivo] || 0) + 1;
}
const foraPorMotivo = {};
for (const c of cruzaram) foraPorMotivo[c.motivo] = (foraPorMotivo[c.motivo] || 0) + 1;

real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''),
  partidas: N,
  chutesParaFora: fora.length,
  dosQuais_cruzaram_a_linha: cruzaram.length,
  dosQuais_nem_chegaram_a_linha: naoCruzaram.length,
  motivosDosQueNaoChegaram: porMotivo,
  todosOsMotivos: foraPorMotivo,
  motivosDosQueCruzaramENTRE_OS_POSTES: dentroPorMotivo,
  cruzaramENTRE_OS_POSTES_e_sob_o_travessao: dentro.length,
  fracaoDosQueCruzaram: cruzaram.length ? +(dentro.length / cruzaram.length).toFixed(4) : null,
  passaramPorCimaDoTravessao: porCima.length,
  penetracaoMaximaDentroDoGol_m: dentro.length ? +Math.min.apply(null, dentro.map(c => c.folga)).toFixed(2) : 0,
  folgaAoPoste_m: { min: +pct(0).toFixed(2), p10: +pct(0.1).toFixed(2), mediana: +pct(0.5).toFixed(2), p90: +pct(0.9).toFixed(2), max: +pct(0.999).toFixed(2) }
}, null, 1));
