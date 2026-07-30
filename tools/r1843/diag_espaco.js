#!/usr/bin/env node
'use strict';
/* DIAG DE ESPACO R18.43 — instrumento de ESP-01..04 (OS-07, cardume)
   -------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE. A matriz de gates registra ESP-01..04 com
   baseline 67,5% / 31,3 m / 24,0 m / 40,2% e cita "auditoria_blob" como
   evidencia. Esse instrumento NAO esta no repositorio: nem em tools/, nem em
   reports/. Procurei por auditoria_blob, campoVazio, emptyField, blockLength e
   grid em todas as rodadas (r13, r14, r15, r1821..r1840) e nao existe. Logo os
   quatro numeros da matriz nao sao reproduziveis a partir do fonte, e a
   definicao exata de "campo vazio" esta perdida.

   CONSEQUENCIA METODOLOGICA, declarada em vez de escondida. Nao tento adivinhar
   a definicao original e depois anunciar que "reproduzi o baseline" — isso seria
   exatamente o erro que o handoff §6 descreve (instrumento medindo a coisa
   errada, numero sem mecanismo). Em vez disso:

     1. defino as metricas explicitamente, aqui, por escrito;
     2. mido "campo vazio" em TRES definicoes independentes ao mesmo tempo,
        para a conclusao nao ser artefato de uma escolha de grade;
     3. a decisao de promocao usa o Δ PAREADO entre baseline e candidata com o
        MESMO instrumento — que e valido mesmo se o absoluto nao coincidir com
        67,5%.

   Se o absoluto de alguma definicao cair perto de 67,5% / 31,3 / 24,0 / 40,2,
   isso e evidencia de que reconstrui a definicao original, e fica registrado.
   Nao e premissa.

   DEFINICOES
   ----------
   Amostragem: a cada AMOSTRA_CADA quadros, somente em quadros NAO congelados
   (`!waiting && !(dead > 0.4)`) — que sao os quadros em que a logica de
   movimentacao de fato roda. Leitura pura: o instrumento nunca chama R(),
   chance() nem escreve no sim, para nao mexer no determinismo.

   ESP-01 campo vazio, em tres definicoes:
     vazio_g10x6   grade 10x6 (celula 10,5 x 11,33 m); celula vazia = zero
                   jogadores de linha (sem GK) dentro dela.
     vazio_g21x14  grade 21x14 (celula 5,0 x 4,86 m); celula vazia = nenhum
                   jogador de linha a <= 6,0 m do centro da celula.
     vazio_g10x6gk igual a g10x6 mas contando goleiros.
   ESP-02 comprimento do bloco: por time, (max x - min x) dos jogadores de
                   linha (sem GK). Media dos dois times.
   ESP-03 zaga->ataque: por time, distancia em x do centroide da linha DEF ao
                   centroide da linha FWD, com sinal de attackDir (positivo =
                   atacantes adiante da zaga). Media dos dois times.
   ESP-04 jogadores a <20 m da bola: % dos 20 jogadores de linha dos dois times
                   a menos de 20,0 m da bola.

   USO
     node tools/r1843/diag_espaco.js --build="dist/....html" \
          [--matches=12] [--semente=4200000] [--out=arquivo.json]
*/

const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
function noop() {}
function define(n, v) { try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); } catch (_) { global[n] = v; } }
define('window', global); define('self', global);
define('navigator', { userAgent: 'cds-diag-espaco', language: 'pt-BR' });
define('location', { href: 'runner://diag', search: '', hash: '' });
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

/* Mesma lista de blocos ignorados da bateria promovida, para carregar
   exatamente o mesmo motor que produz os numeros de ECO-01..04. */
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02','cds-pre25d-runtime-auditor-v04','cds-r109-async-cup','cds-mobile-boot-bridge','cds-ux-boot']);
const html = fs.readFileSync(argv.build, 'utf8');
const sha = crypto.createHash('sha256').update(html).digest('hex');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let mt, idx = 0, scriptsOk = 0, scriptsErro = 0;
const excecoes = [];
while ((mt = re.exec(html))) {
  const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
  if (SKIP.has(id)) continue;
  try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); scriptsOk++; }
  catch (e) {
    scriptsErro++;
    const pilha = String(e && e.stack || e), marca = id + '.js:';
    const pos = pilha.indexOf(marca);
    const linha = pos >= 0 ? parseInt(pilha.slice(pos + marca.length), 10) : NaN;
    excecoes.push({ bloco: id, linha: Number.isFinite(linha) ? linha : null,
      mensagem: String(e && e.message || e) });
  }
}
const EXIGIDOS = ['MatchSim','autoLineup','buildDB','DATA','FORMATIONS','srand','R','chance','facet','clamp','D','FL','FW'];
const faltando = EXIGIDOS.filter(n => typeof global[n] === 'undefined');
if (faltando.length) {
  realConsole.error('ABORTA: simbolos do motor ausentes -> ' + faltando.join(', '));
  process.exit(2);
}

/* Mapa de linhas proprio: nao dependo de C.LINE_OF nem de LINE, que vivem em
   escopos de blocos diferentes e poderiam nao estar visiveis aqui. */
const LINHA = { GK:'GK', CB:'DEF', LB:'DEF', RB:'DEF', LWB:'DEF', RWB:'DEF',
  CDM:'MID', DM:'MID', CM:'MID', CAM:'MID', LM:'MID', RM:'MID',
  LW:'FWD', RW:'FWD', CF:'FWD', ST:'FWD' };

const db = buildDB(DATA);
const N = Number(argv.matches || 12);
const SEMENTE = Number(argv.semente || 4200000);
const DT = 1 / 30;
const AMOSTRA_CADA = 10;            // ~3 amostras por segundo de jogo

/* Populacao identica a da bateria: mesma varredura de formacoes e estilos,
   mesmo incremento de semente. Assim ESP e ECO falam da mesma amostra. */
const FORMS = Object.keys(FORMATIONS);
const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
  ? STYLE_KEYS.slice() : ['balanced','tiki','direct','press','counter','wings','park'];
const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
const mk = (f, st, home) => { const p = autoLineup(squad, f, 0); return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f', lineup: p.lineup, bench: p.bench, formKey: f, style: st }; };

// Grade A: 10 x 6 celulas
const GA_CX = 10, GA_CY = 6;
/* Grade B: 21 x 14 celulas com raio de influencia. Em vez de fixar um raio,
   calculo a distancia ao jogador de linha MAIS PROXIMO de cada celula e depois
   corto em varios raios de uma vez. Assim recupero a curva inteira num unico
   passe de simulacao, o que e o que permite descobrir qual raio reproduz o
   67,5% da matriz sem rodar o motor sete vezes. */
const GB_CX = 21, GB_CY = 14;
const GB_RAIOS = [5, 6, 7, 7.5, 8, 9, 10];
const gbCentros = [];
for (let i = 0; i < GB_CX; i++) for (let j = 0; j < GB_CY; j++)
  gbCentros.push([(i + 0.5) * FL / GB_CX, (j + 0.5) * FW / GB_CY]);
/* Grades alternativas sem raio, para o caso de a definicao original ser apenas
   uma grade mais grossa em vez de um raio de influencia. */
const GRADES = [[7,4],[8,5],[10,6],[12,8],[15,10]];

const porPartida = [];

for (let i = 0; i < N; i++) {
  const seed = SEMENTE + i * 7919;
  const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
  const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
  srand(seed);
  const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
  sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;

  let amostras = 0, sVazioA = 0, sVazioAgk = 0;
  const sVazioR = GB_RAIOS.map(() => 0);
  const sVazioG = GRADES.map(() => 0);
  let sBloco = 0, sZagaAtq = 0, sPerto = 0, sLarg = 0, sDefMid = 0;
  const fase = { atk: { n:0, bloco:0, za:0, zaN:0, dm:0, dmN:0 },
                 def: { n:0, bloco:0, za:0, zaN:0, dm:0, dmN:0 } };
  let s = 0, q = 0;
  while (!sim.isOver() && s++ < 500000) {
    sim.step(DT);
    if ((q++ % AMOSTRA_CADA) !== 0) continue;
    if (sim.waiting || (sim.dead > 0.4)) continue;   // quadro congelado: movimento nao roda

    const b0 = sim.ball;
    const linha = [], todos = [];
    for (const tm of sim.teams) for (const p of tm.players) {
      if (!p || p.red) continue;
      todos.push(p);
      if (!p.isGK) linha.push(p);
    }
    if (linha.length < 12) continue;                  // amostra degenerada

    // ESP-01 A: grade 10x6, celulas com zero jogadores de linha
    const ocupA = new Set(), ocupAgk = new Set();
    for (const p of linha) ocupA.add(Math.min(GA_CX-1, Math.floor(p.x / FL * GA_CX)) * GA_CY + Math.min(GA_CY-1, Math.floor(p.y / FW * GA_CY)));
    for (const p of todos) ocupAgk.add(Math.min(GA_CX-1, Math.floor(p.x / FL * GA_CX)) * GA_CY + Math.min(GA_CY-1, Math.floor(p.y / FW * GA_CY)));
    sVazioA += (GA_CX * GA_CY - ocupA.size) / (GA_CX * GA_CY);
    sVazioAgk += (GA_CX * GA_CY - ocupAgk.size) / (GA_CX * GA_CY);

    /* ESP-01 B: distancia ao jogador de linha mais proximo por celula, cortada
       em varios raios no mesmo passe. */
    const vaziasR = GB_RAIOS.map(() => 0);
    for (const c of gbCentros) {
      let melhor = Infinity;
      for (const p of linha) {
        const dx = p.x - c[0], dy = p.y - c[1];
        const d2 = dx*dx + dy*dy;
        if (d2 < melhor) melhor = d2;
      }
      const d = Math.sqrt(melhor);
      for (let r = 0; r < GB_RAIOS.length; r++) if (d > GB_RAIOS[r]) vaziasR[r]++;
    }
    for (let r = 0; r < GB_RAIOS.length; r++) sVazioR[r] += vaziasR[r] / gbCentros.length;

    // ESP-01 C: grades alternativas sem raio de influencia
    for (let g = 0; g < GRADES.length; g++) {
      const [cx, cy] = GRADES[g], oc = new Set();
      for (const p of linha) oc.add(Math.min(cx-1, Math.floor(p.x / FL * cx)) * cy + Math.min(cy-1, Math.floor(p.y / FW * cy)));
      sVazioG[g] += (cx * cy - oc.size) / (cx * cy);
    }

    /* ESP-02 / ESP-03 por time, e separado por FASE. A separacao existe porque
       DEF/MID sao ancorados em _r13LineDepth e FWD nao: se o deficit de bloco
       estiver concentrado na fase defensiva, o mecanismo e o do clamp ausente
       de FWD; se estiver nas duas, e outra coisa. Sem esta quebra eu estaria
       escolhendo lever por palpite. */
    let bloco = 0, zagaAtq = 0, larg = 0, defMid = 0, nTimes = 0;
    for (const tm of sim.teams) {
      const ps = tm.players.filter(p => p && !p.red && !p.isGK);
      if (ps.length < 6) continue;
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      let defS = 0, defN = 0, midS = 0, midN = 0, fwdS = 0, fwdN = 0;
      for (const p of ps) {
        if (p.x < mnx) mnx = p.x; if (p.x > mxx) mxx = p.x;
        if (p.y < mny) mny = p.y; if (p.y > mxy) mxy = p.y;
        const L = LINHA[p.oopPos || p.slotPos] || LINHA[p.slotPos];
        if (L === 'DEF') { defS += p.x; defN++; }
        else if (L === 'MID') { midS += p.x; midN++; }
        else if (L === 'FWD') { fwdS += p.x; fwdN++; }
      }
      const sgn = tm.attackDir > 0 ? 1 : -1;
      const bl = (mxx - mnx);
      const za = (defN && fwdN) ? sgn * ((fwdS / fwdN) - (defS / defN)) : null;
      const dm = (defN && midN) ? sgn * ((midS / midN) - (defS / defN)) : null;
      bloco += bl; larg += (mxy - mny);
      if (za !== null) zagaAtq += za;
      if (dm !== null) defMid += dm;
      nTimes++;

      // fase do time neste quadro
      const atacando = (b0.owner && b0.owner.team === tm.side) || (b0.traveling && sim.poss === tm.side);
      const acc = atacando ? fase.atk : fase.def;
      acc.n++; acc.bloco += bl;
      if (za !== null) { acc.za += za; acc.zaN++; }
      if (dm !== null) { acc.dm += dm; acc.dmN++; }
    }
    if (nTimes) { sBloco += bloco / nTimes; sZagaAtq += zagaAtq / nTimes; sLarg += larg / nTimes; sDefMid += defMid / nTimes; }

    // ESP-04: % dos jogadores de linha a <20 m da bola
    const b = sim.ball;
    let perto = 0;
    for (const p of linha) { const dx = p.x - b.x, dy = p.y - b.y; if (dx*dx + dy*dy < 400) perto++; }
    sPerto += perto / linha.length;

    amostras++;
  }

  const reg = { seed, formacoes: [fh, fa], estilos: [sh, sa], amostras,
    vazio_g10x6:    +(sVazioA   / amostras * 100).toFixed(3),
    vazio_g10x6gk:  +(sVazioAgk / amostras * 100).toFixed(3),
    bloco_m:        +(sBloco    / amostras).toFixed(3),
    zaga_ataque_m:  +(sZagaAtq  / amostras).toFixed(3),
    largura_m:      +(sLarg     / amostras).toFixed(3),
    def_mid_m:      +(sDefMid   / amostras).toFixed(3),
    perto20_pct:    +(sPerto    / amostras * 100).toFixed(3),
    bloco_atk_m:    fase.atk.n   ? +(fase.atk.bloco / fase.atk.n).toFixed(3)  : null,
    bloco_def_m:    fase.def.n   ? +(fase.def.bloco / fase.def.n).toFixed(3)  : null,
    zaga_atq_atk_m: fase.atk.zaN ? +(fase.atk.za    / fase.atk.zaN).toFixed(3): null,
    zaga_atq_def_m: fase.def.zaN ? +(fase.def.za    / fase.def.zaN).toFixed(3): null,
    def_mid_atk_m:  fase.atk.dmN ? +(fase.atk.dm    / fase.atk.dmN).toFixed(3): null,
    def_mid_def_m:  fase.def.dmN ? +(fase.def.dm    / fase.def.dmN).toFixed(3): null };
  for (let r = 0; r < GB_RAIOS.length; r++)
    reg['vazio_r' + String(GB_RAIOS[r]).replace('.', '_')] = +(sVazioR[r] / amostras * 100).toFixed(3);
  for (let g = 0; g < GRADES.length; g++)
    reg['vazio_g' + GRADES[g][0] + 'x' + GRADES[g][1]] = +(sVazioG[g] / amostras * 100).toFixed(3);
  porPartida.push(reg);
}

function resumo(vals) {
  const v = vals.slice().sort((a, b) => a - b);
  const n = v.length, media = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / n);
  const q = p => v[Math.min(n - 1, Math.floor(n * p))];
  return { media: +media.toFixed(3), mediana: +q(.5).toFixed(3), desvio: +sd.toFixed(3),
           p10: +q(.10).toFixed(3), p90: +q(.90).toFixed(3), min: v[0], max: v[n - 1] };
}
const METRICAS = ['bloco_m','zaga_ataque_m','largura_m','def_mid_m','perto20_pct',
    'bloco_atk_m','bloco_def_m','zaga_atq_atk_m','zaga_atq_def_m','def_mid_atk_m','def_mid_def_m',
    'vazio_g10x6','vazio_g10x6gk']
  .concat(GB_RAIOS.map(r => 'vazio_r' + String(r).replace('.', '_')))
  .concat(GRADES.map(g => 'vazio_g' + g[0] + 'x' + g[1]).filter(k => k !== 'vazio_g10x6'));
const agregado = {};
for (const k of METRICAS) agregado[k] = resumo(porPartida.map(p => p[k]));

const out = {
  build: String(argv.build).split(/[\\/]/).pop(), sha256: sha,
  scriptsCarregados: scriptsOk, scriptsComErro: scriptsErro, excecoes,
  partidas: N, sementeBase: SEMENTE, incremento: 7919, amostraCada: AMOSTRA_CADA,
  amostrasTotais: porPartida.reduce((a, p) => a + p.amostras, 0),
  definicoes: {
    'ESP-01 vazio_g10x6': `grade ${GA_CX}x${GA_CY} (celula ${(FL/GA_CX).toFixed(2)}x${(FW/GA_CY).toFixed(2)} m), celula vazia = 0 jogadores de linha`,
    'ESP-01 vazio_rN': `grade ${GB_CX}x${GB_CY}, celula vazia = nenhum jogador de linha a <=N m do centro; N em ${GB_RAIOS.join(', ')}`,
    'ESP-01 vazio_gAxB': `grades alternativas sem raio: ${GRADES.map(g => g[0] + 'x' + g[1]).join(', ')}`,
    'ESP-02 bloco_m': 'max x - min x dos jogadores de linha, media dos dois times',
    'ESP-03 zaga_ataque_m': 'centroide x FWD - centroide x DEF, com sinal de attackDir',
    'ESP-04 perto20_pct': '% dos jogadores de linha dos dois times a <20 m da bola',
  },
  agregado, porPartida,
};
realConsole.log(JSON.stringify({ build: out.build, sha: sha.slice(0, 12), partidas: N,
  semente: SEMENTE, scripts: `${scriptsOk} ok / ${scriptsErro} erro`,
  amostras: out.amostrasTotais,
  medias: Object.fromEntries(METRICAS.map(k => [k, agregado[k].media])) }, null, 2));
if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
