#!/usr/bin/env node
'use strict';
/* O CRAQUE DE SLOT RARO FICA NO BANCO (OS-02)
   -------------------------------------------------------------------------
   strictAutoLineup ordena os candidatos a cada vaga assim:

     .sort((a,b)=>a.tier-b.tier || (b.p.starter-a.p.starter)*3
                                 + (b.fit-a.fit)*.18 + (b.p.r-a.p.r))

   `tier` e a PRIMEIRA chave e nao tem peso: e um portao absoluto. Quem tem o
   slot como primario (tier 0) sempre ganha de quem o tem como secundario
   (tier 1), qualquer que seja a diferenca de qualidade. De Bruyne (91, CAM
   primario, CM secundario) perde a vaga de CM para Fellaini (72, CM primario).

   Mede, sobre TODOS os elencos e TODAS as formacoes:
     - vagas em que um reserva ELEGIVEL (tier<=2) e N+ pontos melhor,
     - titulares escalados fora da propria elegibilidade (tier>2),
     - e o caso nominal da Belgica citado na Ordem de Servico.
   So observacao: nenhum comportamento e alterado. */

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-esc', language: 'pt-BR' });
define('location', { href: 'runner://esc', search: '', hash: '' });
define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
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
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };

/* bestFormationFor mora no bloco cds-r109-async-cup, que o harness do
   laboratorio normalmente pula. Para responder ao aviso da Ordem de Servico
   ("a correcao pode fazer a IA colapsar sempre na mesma formacao") esse bloco
   precisa ser carregado — e so ele. */
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-mobile-boot-bridge','cds-ux-boot']);
if (!argv.cup) SKIP.add('cds-r109-async-cup');
const html = fs.readFileSync(argv.build, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0;
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); }
  catch (e) { if (/^script-\d+$/.test(id) && /document is not defined/.test(String(e && e.message || e))) continue; throw e; }
}

const db = buildDB(DATA);
const CORE = (typeof __CORE !== 'undefined' && __CORE) ? __CORE : null;
const GAP = Number(argv.gap || 6);

/* Reimplementa positionTier a partir do dado persistente V3 — o do bundle esta
   dentro do IIFE. Mesma regra, para nao medir outra coisa. */
const LINHA = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF', CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID', LW: 'FWD', RW: 'FWD', CF: 'FWD', ST: 'FWD' };
const linha = s => LINHA[s] || 'MID';
function tier(p, slot) {
  const v3 = p && p.positionsV3;
  if (!v3) return p && p.slot === slot ? 0 : 5;
  if (v3.primary === slot) return 0;
  if ((v3.secondary || []).includes(slot)) return 1;
  if ((v3.emergency || []).includes(slot)) return 2;
  if (linha(v3.primary) === linha(slot)) return 3;
  return 5;
}

const T = { vagas: 0, elencos: 0, foraDeElegibilidade: 0, reservaMelhor: 0, somaGap: 0, exemplos: [], porTier: Object.create(null) };
const FKS = (typeof FORMATION_KEYS !== 'undefined' ? FORMATION_KEYS : ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1']);

for (const sq of db.squads) {
  T.elencos++;
  for (const fk of FKS) {
    const r = autoLineup(sq, fk, 0);
    if (!r || !r.lineup) continue;
    const titulares = new Set(r.lineup.map(x => x && x.p && x.p.id).filter(Boolean));
    const banco = (sq.pl || []).filter(p => !titulares.has(p.id));
    for (const x of r.lineup) {
      if (!x || !x.p) continue;
      T.vagas++;
      const t = tier(x.p, x.pos);
      T.porTier[t] = (T.porTier[t] || 0) + 1;
      if (t > 2) T.foraDeElegibilidade++;
      /* existe reserva ELEGIVEL para esta vaga e claramente melhor? */
      let melhor = null;
      for (const b of banco) {
        if (tier(b, x.pos) > 2) continue;
        if (b.r - x.p.r >= GAP && (!melhor || b.r > melhor.r)) melhor = b;
      }
      if (melhor) {
        T.reservaMelhor++; T.somaGap += (melhor.r - x.p.r);
        if (T.exemplos.length < 12) T.exemplos.push({
          time: sq.c, ano: sq.y, formacao: fk, vaga: x.pos,
          escalado: `${x.p.n} (${x.p.r}, ${x.p.slot})`,
          noBanco: `${melhor.n} (${melhor.r}, ${melhor.slot})`,
          diferenca: melhor.r - x.p.r,
        });
      }
    }
  }
}

/* O caso nominal da Ordem de Servico. */
const bel = db.squads.find(s => /B(e|é)lgica/i.test(String(s.c)));
const casoBelgica = [];
if (bel) for (const fk of ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1']) {
  const r = autoLineup(bel, fk, 0); if (!r) continue;
  const dbne = (bel.pl || []).find(p => /Bruyne/i.test(String(p.n)));
  if (!dbne) break;
  const titular = r.lineup.some(x => x && x.p && x.p.id === dbne.id);
  const vaga = (r.lineup.find(x => x && x.p && x.p.id === dbne.id) || {}).pos || null;
  casoBelgica.push({ formacao: fk, deBruyneTitular: titular, vaga });
}

/* A Ordem de Servico avisa: bestFormationFor penaliza improviso, entao a
   correcao pode fazer a IA colapsar sempre na mesma formacao. Mede a
   distribuicao real de escolhas para poder provar que isso nao aconteceu. */
const formacaoEscolhida = Object.create(null);
if (typeof bestFormationFor === 'function') {
  for (const sq of db.squads) {
    try { const r = bestFormationFor(sq); formacaoEscolhida[r.fk] = (formacaoEscolhida[r.fk] || 0) + 1; } catch (_) {}
  }
}
const totalForm = Object.values(formacaoEscolhida).reduce((a, b) => a + b, 0);
const maiorFatia = Math.max(0, ...Object.values(formacaoEscolhida));

const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(2);
realConsole.log(JSON.stringify({
  build: (global.CDS_BUILD_ID || '?'), elencos: T.elencos, formacoes: FKS.length, vagas: T.vagas, gapMinimo: GAP,
  RESERVA_ELEGIVEL_MELHOR: { vagas: T.reservaMelhor, pct: pct(T.reservaMelhor, T.vagas), diferencaMedia: +(T.somaGap / Math.max(1, T.reservaMelhor)).toFixed(1), alvo: '0 vagas' },
  TITULAR_FORA_DA_ELEGIBILIDADE: { vagas: T.foraDeElegibilidade, pct: pct(T.foraDeElegibilidade, T.vagas), alvo: 'abaixo de 10%' },
  porTier: T.porTier,
  DIVERSIDADE_DE_FORMACAO: { escolhas: formacaoEscolhida, formacoesUsadas: Object.keys(formacaoEscolhida).length, maiorFatiaPct: pct(maiorFatia, totalForm), alvo: 'nenhuma formacao dominando tudo' },
  casoBelgica,
  exemplos: T.exemplos,
}, null, 2));
