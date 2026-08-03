#!/usr/bin/env node
'use strict';
/*
 * OS-74 · DE QUE LADO SAI O ESCANTEIO
 * -----------------------------------
 * PROXIMA_RODADA.md item 2 diz, com todas as letras: "Nao medi. A taxa de
 * concordancia atual. Eu inferi do sorteio, nao medi. Meca antes de patchar —
 * pode existir uma camada posterior que ja corrija o lado, e ai o defeito e
 * outro."
 *
 * Este instrumento mede exatamente isso, e nada mais. Nao patcha.
 *
 * POR QUE NAO BASTA LER O CODIGO. A linha do sorteio existe:
 *     const cy = chance(.5) ? 1.5 : FW-1.5, sign=cy<FW/2?-1:1;
 * mas `_setCorner` tem SEIS camadas empilhadas por cima, todas encadeando, e
 * uma delas fala em "cobra de la". Qualquer uma pode reposicionar o batedor
 * depois. A verdade e o resultado observavel, nao a linha.
 *
 * O QUE E MEDIDO. Gancho no `_setCorner` MAIS EXTERNO (o ultimo a ser
 * instalado, que e o que o jogo chama). Antes de delegar, guarda de que lado a
 * bola estava; depois que a cadeia inteira retorna, le onde o batedor
 * REALMENTE ficou. A concordancia e entre esses dois.
 *
 * Cada escanteio produz uma linha com:
 *   ladoDaBola   -1 = metade de y baixo (y < FW/2), +1 = metade de y alto
 *   ladoDoCanto  idem, lido da posicao final do batedor
 *   concorda     ladoDaBola === ladoDoCanto
 *   yBola        y da bola no instante em que o escanteio foi cunhado
 *   yBatedor     y final do batedor
 *
 * LEITURA. Se a concordancia ficar perto de 50%, o lado e sorteio e o defeito
 * do item 2 esta confirmado. Se ficar perto de 100%, alguma camada ja corrige
 * e o defeito e outro — e nesse caso NAO se deve patchar a linha do sorteio.
 * Qualquer valor intermediario quer dizer que so parte dos sitios preserva o
 * lado, e ai o patch tem de ser por sitio.
 *
 * RESSALVA HONESTA. Quando a bola ja foi recolocada antes de `_setCorner`
 * rodar, `ball.y` pode ser o centro do campo e nao o ponto de saida. Por isso
 * o relatorio separa os casos em que a bola estava perto da linha de fundo
 * (|x| < 6 m da linha) dos demais: so o primeiro grupo tem `ball.y` confiavel
 * como origem. A taxa principal e reportada sobre esse grupo.
 */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const argv = Object.fromEntries(process.argv.slice(2).map(item => {
  const [key, value] = item.replace(/^--/, '').split('=');
  return [key, value == null ? true : value];
}));
function noop() {}
function define(name, value) {
  try { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  catch (_) { global[name] = value; }
}
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-os74', language: 'pt-BR' });
define('location', { href: 'runner://os74', search: '', hash: '' });
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

const SKIP = new Set([
  'cds-2_5d-gate-a-contracts-v02',
  'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup',
  'cds-mobile-boot-bridge',
  'cds-ux-boot'
]);
if (!argv.build) { realConsole.error('ABORTA: informe --build=<html>'); process.exit(1); }

const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match, index = 0, scriptsOk = 0, scriptsErro = 0;
while ((match = scriptRe.exec(html))) {
  const id = (match[1].match(/id="([^"]+)"/) || [])[1] || `script-${index}`;
  index++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(match[2], { filename: id + '.js' }); scriptsOk++; }
  catch (error) { scriptsErro++; }
}
const REQUIRED = ['MatchSim', 'autoLineup', 'buildDB', 'DATA', 'FORMATIONS', 'srand', 'FL', 'FW'];
const faltando = REQUIRED.filter(n => typeof global[n] === 'undefined');
if (faltando.length) { realConsole.error('ABORTA: faltam simbolos -> ' + faltando.join(', ')); process.exit(2); }

const db = buildDB(DATA);
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (form, home) => {
  const p = autoLineup(squad, form, 0);
  return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: form, style: 'balanced' };
};

const P = MatchSim.prototype;
const registros = [];

/* Gancho no MAIS EXTERNO: e o que o jogo chama. Depois que a cadeia inteira
   retorna, o batedor ja esta posicionado. */
const cornerExterno = P._setCorner;
P._setCorner = function (team) {
  const b = this.ball || {};
  const yAntes = Number.isFinite(b.y) ? b.y : null;
  const xAntes = Number.isFinite(b.x) ? b.x : null;
  const r = cornerExterno.apply(this, arguments);
  try {
    /* CORRECAO DE INSTRUMENTO. A primeira versao localizava o batedor por
       `_setPieceRole === 'taker'` e lia y entre 15 e 47 — impossivel para um
       escanteio, que poe o batedor em y ~1,5 ou ~66,5 com FW=68. O marcador
       sobra de bolas paradas anteriores e nao e limpo, entao eu estava lendo
       um jogador qualquer. Os 55,6% da primeira medicao NAO valem.
       A leitura confiavel e a BOLA: `_setCorner` a coloca no canto, entao o y
       dela E o lado. O batedor fica registrado so como conferencia. */
    const bDepois = this.ball || {};
    const yDepois = Number.isFinite(bDepois.y) ? bDepois.y : null;
    let taker = null;
    for (const tm of this.teams) for (const p of tm.players) {
      if (p && p._setPieceRole === 'taker') taker = p;
    }
    const yTaker = taker && Number.isFinite(taker.y) ? +taker.y.toFixed(1) : null;
    /* a bola foi mesmo parar num canto? se nao, este escanteio nao e legivel */
    const noCanto = yDepois != null && (yDepois < 6 || yDepois > FW - 6);
    if (yAntes != null && yDepois != null) {
      const ladoBola = yAntes < FW / 2 ? -1 : 1;
      const ladoCanto = yDepois < FW / 2 ? -1 : 1;
      /* a bola estava perto de uma linha de fundo? so ai o y dela e origem */
      const distLinhaFundo = xAntes == null ? 999 : Math.min(xAntes, FL - xAntes);
      registros.push({
        yBolaSaida: +yAntes.toFixed(1), yBolaNoCanto: +yDepois.toFixed(1), yTaker,
        ladoBola, ladoCanto, concorda: ladoBola === ladoCanto,
        distLinhaFundo: +distLinhaFundo.toFixed(1),
        noCanto,
        confiavel: distLinhaFundo < 6 && noCanto,
      });
    }
  } catch (_) {}
  return r;
};

const N = Number(argv.matches || 8);
const DT = 1 / 30;
const FORMS = ['4-3-3', '4-4-2', '3-5-2'];
for (let i = 0; i < N; i++) {
  const semente = 4200000 + i * 7919;
  const form = FORMS[i % FORMS.length];
  srand(semente);
  const sim = new MatchSim(mk(form, true), mk(form, false), { neutral: true, labMode: true });
  let passos = 0;
  while (!sim.isOver() && passos++ < 400000) sim.step(DT);
}

const pct = (a, b) => +(100 * a / Math.max(1, b)).toFixed(1);
const conf = registros.filter(r => r.confiavel);
const foraDoCanto = registros.filter(r => !r.noCanto);
const naoConf = registros.filter(r => !r.confiavel);
const resumo = grupo => ({
  n: grupo.length,
  concordam: grupo.filter(r => r.concorda).length,
  taxa_pct: pct(grupo.filter(r => r.concorda).length, grupo.length),
});

realConsole.log(JSON.stringify({
  build: String(argv.build).split(/[\\/]/).pop(),
  sha: sha.slice(0, 12),
  scripts: scriptsOk + ' ok / ' + scriptsErro + ' erro',
  partidas: N,
  escanteios_observados: registros.length,
  PRINCIPAL_bola_perto_da_linha_de_fundo: resumo(conf),
  secundario_bola_longe_da_linha: resumo(naoConf),
  descartados_bola_nao_foi_ao_canto: foraDoCanto.length,
  TODOS: resumo(registros),
  leitura: {
    perto_de_50: 'lado e sorteio — defeito do item 2 confirmado',
    perto_de_100: 'alguma camada ja corrige o lado — NAO patchar a linha do sorteio',
    intermediario: 'so parte dos sitios preserva o lado — patch por sitio',
  },
  amostra: registros.slice(0, 12),
}, null, 2));
