#!/usr/bin/env node
/* D08-c · ONDE SE PERDEM OS 4,11 m DE LARGURA
   =========================================================================
   O D08 foi reenunciado assim (reports/D08-a-bola-nao-vai-na-linha.md):

       o ponta joga a 18,5 m da lateral com a bola no pe do time, quando a
       propria casa ofensiva dele diz 6,9 m e o `_attackTarget` PEDE 10,13 m

   E a tentativa do ombro (camada 91, revertida) mostrou o problema de frente:
   ela moveu o ALVO em 1,57 m por chamada e o CORPO em ~0,7 m. O erro medio
   entre alvo e posicao, em y, e de 4,11 m.

   Enquanto esses 4 metros nao tiverem dono, qualquer modelo de largura vai
   morrer do mesmo jeito: o alvo muda e o jogador nao vai.

   A cadeia do y tem tres trechos, e esta sonda mede os tres separadamente:

       [1] _attackTarget devolve ty            <- a intencao tatica
       [2] _movePlayers mexe: suavizacao de reacao (p._smy) e separacao
       [3] _integrate recebe ty e move o corpo <- velocidade, giro, colisao

   Mede-se ty em [1] e em [3] no MESMO quadro e para o MESMO jogador, mais a
   posicao antes e depois. Assim:

       |ty1 - ty3|          o quanto a suavizacao + separacao comem
       |ty3 - y_depois|     o quanto o corpo fica devendo ao alvo que recebeu
       |y_depois - y_antes| o quanto ele efetivamente andou no quadro

   Uso: node tools/fisica/ramo-d08c.js [build.html] [partidas]
*/
'use strict';
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
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const BUILD = process.argv[2] || 'dist/index.html';
const N = Number(process.argv[3] || 12);
const html = fs.readFileSync(BUILD, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);
{
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
  while ((m = re.exec(html))) {
    const id = (m[1].match(/id="([^"]+)"/) || [])[1] || ('s' + i); i++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(m[2], { filename: id }); } catch (_) {}
  }
}
const FWv = Number(global.FW) || 68;
const db = buildDB(DATA), FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
const sq = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, h) => { const p = autoLineup(sq, f, 0);
  return { squad: sq, name: sq.c, flag: sq.f, color: h ? '#1' : '#2',
    lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

const FLANCO = new Set(['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB', 'LB', 'RB']);
const dl = y => Math.min(y, FWv - y);          /* distancia ate a lateral mais proxima */
const A = {
  n: 0,
  somaTy1: 0, somaTy3: 0, somaYdep: 0,
  somaTaticaVsRecebido: 0,   /* |ty1 - ty3| — suavizacao + separacao */
  somaRecebidoVsCorpo: 0,    /* |ty3 - y_depois| — o que o corpo ficou devendo */
  somaAndou: 0,              /* |y_depois - y_antes| */
  puxouParaODentro: 0,       /* [2] moveu o alvo em direcao ao miolo */
  puxouParaFora: 0,
  somaPuxaoDentro: 0, somaPuxaoFora: 0,
};

for (let i = 0; i < N; i++) {
  srand(4200000 + i * 7919);
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
  const P = Object.getPrototypeOf(sim);

  /* [1] a intencao tatica, no TOPO da pilha */
  sim._attackTarget = function (tm, p, b) {
    const r = P._attackTarget.apply(this, arguments);
    try {
      if (r && p && FLANCO.has(p.slotPos)) {
        const ty = Array.isArray(r) ? +r[1] : +r.y;
        p.__d08ty1 = Number.isFinite(ty) ? ty : null;
        p.__d08yAntes = +p.y;
      }
    } catch (_) {}
    return r;
  };
  /* [3] o que o corpo realmente recebeu.
     ATENCAO: a camada 16 NAO escreve p.y aqui — ela planeja em `ctx.planned` e
     o `commitMovement` aplica depois. Ler p.y logo apos o _integrate devolve a
     posicao ANTES do movimento (a primeira versao desta sonda publicou
     "andou 0,00 m por quadro" por causa disso). Por isso o alvo recebido fica
     pendurado no jogador e a conta so fecha DEPOIS do _movePlayers. */
  sim._integrate = function (p, tx, ty, dt, freeze) {
    const r = P._integrate.apply(this, arguments);
    try {
      if (p && FLANCO.has(p.slotPos) && p.__d08ty1 != null && Number.isFinite(+ty)) {
        p.__d08ty3 = +ty;
      }
    } catch (_) {}
    return r;
  };
  sim._movePlayers = function (dt, freeze) {
    const r = P._movePlayers.apply(this, arguments);
    try {
      for (const tm of this.teams || []) for (const p of tm.players || []) {
        if (!p || p.__d08ty1 == null || p.__d08ty3 == null) continue;
        const ty1 = p.__d08ty1, ty3 = p.__d08ty3, yAntes = p.__d08yAntes, yDep = +p.y;
        A.n++;
        A.somaTy1 += dl(ty1); A.somaTy3 += dl(ty3); A.somaYdep += dl(yDep);
        A.somaTaticaVsRecebido += Math.abs(ty1 - ty3);
        A.somaRecebidoVsCorpo += Math.abs(ty3 - yDep);
        A.somaAndou += Math.abs(yDep - yAntes);
        /* o alvo recebido esta mais PERTO ou mais LONGE da lateral que o pedido? */
        const d = dl(ty3) - dl(ty1);
        if (d > 0) { A.puxouParaODentro++; A.somaPuxaoDentro += d; }
        else if (d < 0) { A.puxouParaFora++; A.somaPuxaoFora += -d; }
        p.__d08ty1 = null; p.__d08ty3 = null;
      }
    } catch (_) {}
    return r;
  };
  let s = 0;
  while (!sim.isOver() && s++ < 500000) sim.step(1 / 30);
}

const m = (v) => +(v / Math.max(1, A.n)).toFixed(2);
console.log(JSON.stringify({
  build: sha, partidas: N, amostras: A.n,
  distanciaMediaAteALateral: {
    '1_alvo_do_attackTarget': m(A.somaTy1),
    '2_alvo_que_chegou_ao_integrate': m(A.somaTy3),
    '3_posicao_depois_do_quadro': m(A.somaYdep),
  },
  ondeSePerde: {
    entre1e2_suavizacaoESeparacao_m: m(A.somaTaticaVsRecebido),
    entre2e3_corpoDevendoAoAlvo_m: m(A.somaRecebidoVsCorpo),
    andouNoQuadro_m: m(A.somaAndou),
  },
  direcaoDoDesvioEm1para2: {
    puxouParaODentro: A.puxouParaODentro,
    puxouParaFora: A.puxouParaFora,
    puxaoMedioParaODentro_m: +(A.somaPuxaoDentro / Math.max(1, A.puxouParaODentro)).toFixed(2),
    puxaoMedioParaFora_m: +(A.somaPuxaoFora / Math.max(1, A.puxouParaFora)).toFixed(2),
  },
}, null, 2));
