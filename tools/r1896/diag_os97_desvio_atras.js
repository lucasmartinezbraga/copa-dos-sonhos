#!/usr/bin/env node
'use strict';
/*
 * DIAG OS-97 · O DESVIO DEFENSIVO PODE IR PARA TRAS DA LINHA?
 * ===========================================================
 * CORRIGE UM ERRO MEU. Na OS-94 eu medi "0 desvios defensivos terminam fora
 * pela linha" envolvendo o `_deflectTo` EXTERNO. A camada R18.18.3 resolve por
 * `__r18183OldDeflect`, que passa por baixo desse gancho. Aquele zero era
 * artefato de onde eu enganchei, nao um fato do jogo.
 *
 * Aqui o gancho vai no `_deflectTo` do NUCLEO (o mais interno que existe), que
 * ve TODAS as deflexoes, venham de onde vierem.
 *
 * Responde:
 *   A) quantas deflexoes por partida, e quantas com o defensor perto da propria
 *      linha (<= 16 m)?
 *   B) dessas, quantas tem alvo ATRAS da linha de fundo (=> escanteio)?
 *   C) quantas sao CLAMPADAS para dentro do campo pelos sitios do motor-base?
 *
 * O (C) e a hipotese: `:5533`, `:6381` e afins fazem
 *     clamp(this.ball.x - dir*R(a,b), 2, FL-2)
 * ou seja, o alvo nunca passa de 2 m DENTRO da linha. Um zagueiro desviando em
 * cima da propria meta nao consegue mandar para escanteio.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(i => {
  const [k, v] = i.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const noop = () => {};
const D = (n, v) => { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } };
D('window', global); D('self', global);
D('navigator', { userAgent: 'cds', language: 'pt-BR' });
D('location', { href: 'runner://os97', search: '', hash: '' });
D('performance', { now: () => 0 }); D('crypto', crypto.webcrypto);
D('requestAnimationFrame', () => 0); D('cancelAnimationFrame', noop);
D('addEventListener', noop); D('removeEventListener', noop);
D('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
D('alert', noop); D('confirm', () => true); D('prompt', () => null);
D('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
D('sessionStorage', global.localStorage); D('CanvasRenderingContext2D', undefined);
D('HTMLElement', function () {}); D('HTMLCanvasElement', function () {});
D('Image', function () {}); D('Audio', function () { return { play: () => Promise.resolve(), pause: noop }; });
D('__showBootError', noop); D('__cdsDebugWarn', noop); D('CDS_DEBUG', false);
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

const P = MatchSim.prototype;
const FLv = 105;
const C = { total: 0, perto: 0, pertoAtras: 0, pertoDentro: 0, longe: 0, atrasTotal: 0 };
const distClamp = [];   // quao perto de 2 m da linha o alvo ficou, nas deflexoes perto

/* O NUCLEO: a camada R18.18.3 guardou a versao anterior em __r18183OldDeflect.
   Enganchar ali ve tudo -- inclusive o que a propria camada resolve. */
const alvo = Object.prototype.hasOwnProperty.call(P, '__r18183OldDeflect') && typeof P.__r18183OldDeflect === 'function'
  ? '__r18183OldDeflect' : '_deflectTo';
const old = P[alvo];
P[alvo] = function (x, y, spd) {
  try {
    const b = this.ball, t = b && b.lastTouch;
    if (t && this.teams && this.teams[t.team]) {
      const propria = this.teams[t.team].goal;
      const dLinha = Math.abs(Number(b.x) - Number(propria.x));
      const atras = (x <= 0.001 || x >= FLv - 0.001);
      C.total++;
      if (atras) C.atrasTotal++;
      if (dLinha <= 16) {
        C.perto++;
        if (atras) C.pertoAtras++;
        else {
          C.pertoDentro++;
          /* a que distancia da linha o alvo parou */
          distClamp.push(Math.min(Math.abs(x - 0), Math.abs(FLv - x)));
        }
      } else C.longe++;
    }
  } catch (_) {}
  return old.apply(this, arguments);
};

const db = buildDB(DATA);
const N = Number(argv.matches || 12);
const FORMS = Object.keys(FORMATIONS);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, h) => {
  const p = autoLineup(squad, f, 0);
  return { squad, name: squad.c, flag: squad.f, color: h ? '#2e9bff' : '#ff3d7f',
           lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
};
for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const sim = new MatchSim(mk(FORMS[i % FORMS.length], true), mk(FORMS[i % FORMS.length], false), { neutral: true, labMode: true });
  let g = 0;
  while (!sim.isOver() && g++ < 400000) sim.step(1 / 30);
}
const ord = distClamp.sort((a, b) => a - b);
const pc = p => ord.length ? +ord[Math.min(ord.length - 1, Math.floor(p * ord.length))].toFixed(2) : null;
const pp = v => +(v / N).toFixed(3);
real.log(JSON.stringify({
  build: String(argv.build).replace(/^.*[\\/]/, ''), partidas: N,
  ganchoUsado: alvo,
  deflexoes_por_partida: {
    total: pp(C.total),
    com_defensor_a_16m_ou_menos_da_propria_linha: pp(C.perto),
    dessas_com_alvo_ATRAS_da_linha: pp(C.pertoAtras),
    dessas_com_alvo_DENTRO_do_campo: pp(C.pertoDentro),
    com_defensor_longe: pp(C.longe),
    alvo_atras_da_linha_no_total: pp(C.atrasTotal)
  },
  quando_fica_dentro_a_que_distancia_da_linha_o_alvo_para_m: {
    min: pc(0), p10: pc(.1), mediana: pc(.5), p90: pc(.9), max: pc(.999)
  }
}, null, 1));
