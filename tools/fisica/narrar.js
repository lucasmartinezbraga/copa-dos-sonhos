#!/usr/bin/env node
'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   NARRAR UMA PARTIDA — o instrumento que faltava.

   As baterias contam. Ninguem lia. E a coisa que mais importou nesta fase do
   projeto (a bola quicando em todo passe rasteiro) nao moveu NENHUMA das 34
   metricas: quem viu foi uma pessoa abrindo o jogo.

   Aqui a partida vira texto em linguagem de futebol — quem, onde no campo, sob
   que pressao, em que minuto — para dar para LER e julgar plausibilidade. Nao
   ha alvo a bater: a saida e material bruto para alguem dizer "isso ai nao e
   futebol".

   Uso:
     node tools/fisica/narrar.js dist/index.html --semente=4200000
     node tools/fisica/narrar.js dist/index.html --partidas=5 --so=suspeitos
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const path = require('path');

const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const BUILD = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist/index.html');
const SEMENTE = Number(argv.semente || 4200000);
const N = Number(argv.partidas || 1);
const SO_SUSPEITOS = String(argv.so || '') === 'suspeitos';
const DT = 1 / 30;

/* ------------------------------------------------------------------ ambiente */
function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-narrador', language: 'pt-BR' });
  define('location', { href: 'runner://narrar', search: '', hash: '' });
  define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
  define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
  define('addEventListener', noop); define('removeEventListener', noop);
  define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
  define('alert', noop); define('confirm', () => true); define('prompt', () => null);
  define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
  define('sessionStorage', global.localStorage);
  define('CanvasRenderingContext2D', undefined);
  define('HTMLElement', function HTMLElement() {});
  define('HTMLCanvasElement', function HTMLCanvasElement() {});
  define('Image', function Image() {});
  define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
  define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
  define('document', {
    title: '', readyState: 'complete', documentElement: { style: {}, classList: { add: noop, remove: noop } },
    body: { style: {}, classList: { add: noop, remove: noop }, appendChild: noop },
    createElement: () => ({ style: {}, classList: { add: noop, remove: noop }, getContext: () => null,
      appendChild: noop, setAttribute: noop, addEventListener: noop }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop, head: { appendChild: noop },
  });
}

const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);

function carregar(buildPath) {
  const html = fs.readFileSync(buildPath, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let mt, idx = 0;
  while ((mt = re.exec(html))) {
    const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); } catch (_) { /* mesmo criterio da bateria */ }
  }
  if (typeof global.MatchSim === 'undefined') { console.error('motor nao carregou'); process.exit(2); }
}

/* ══════════════════════════════════════════════ linguagem de futebol ═══════ */
/* Traduz coordenada em lugar. `dir` e o sentido de ataque de quem tem a bola:
   +1 ataca x = FL, -1 ataca x = 0. Sem isso "na intermediaria ofensiva" fica
   invertido para um dos times e a narracao mente. */
function terco(x, dir) {
  const av = dir > 0 ? x : (105 - x);          // avanco no sentido do ataque
  if (av < 35) return 'defesa';
  if (av < 70) return 'meio';
  return 'ataque';
}
function faixaY(y) {
  if (y < 13.84) return 'ponta esquerda';
  if (y < 24.84) return 'meia-esquerda';
  if (y < 43.16) return 'centro';
  if (y < 54.16) return 'meia-direita';
  return 'ponta direita';
}
function naArea(x, y, dir) {
  const av = dir > 0 ? x : (105 - x);
  return av >= 88.5 && Math.abs(y - 34) <= 20.16;
}
function lugar(x, y, dir) {
  const t = terco(x, dir), f = faixaY(y);
  if (naArea(x, y, dir)) return `NA AREA (${f})`;
  return `${t}/${f}`;
}
function distGol(x, y, dir) {
  const gx = dir > 0 ? 105 : 0;
  return Math.hypot(gx - x, 34 - y);
}
/* angulo de finalizacao: quanto da boca do gol o chutador enxerga, em graus */
function anguloDeChute(x, y, dir) {
  const gx = dir > 0 ? 105 : 0;
  const a = Math.atan2(3.66 - (y - 34), Math.abs(gx - x));
  const b = Math.atan2(-3.66 - (y - 34), Math.abs(gx - x));
  return Math.abs(a - b) * 180 / Math.PI;
}

function papel(p) {
  const s = String((p && (p.pos || p.role || p.position)) || '').toUpperCase();
  if (!s) return p && p.isGK ? 'GOL' : '?';
  return s;
}
const ehGoleiro = p => !!(p && (p.isGK || papel(p) === 'GK' || papel(p) === 'GOL'));

/* ══════════════════════════════════════════════════ regras de suspeita ═════
   Cada uma responde "uma pessoa que entende de futebol levantaria a sobrancelha
   aqui?". Nenhuma tem alvo numerico: elas MARCAM para leitura humana. */
const SUSPEITAS = [
  { id: 'chute-de-muito-longe', teste: e =>
      e.tipo === 'chute' && e.distGol > 35,
    diz: e => `chute de ${e.distGol.toFixed(0)} m` },
  { id: 'chute-sem-angulo', teste: e =>
      e.tipo === 'chute' && e.anguloGol < 6 && e.distGol > 12,
    diz: e => `chute com ${e.anguloGol.toFixed(1)} graus de gol visivel` },
  { id: 'zagueiro-finalizando', teste: e =>
      e.tipo === 'chute' && /^(CB|ZAG|DC|LB|RB|LE|LD)/.test(e.papel) && e.terco === 'ataque' && !e.bolaParada,
    diz: e => `${e.papel} finalizando no ataque` },
  { id: 'goleiro-fora-de-casa', teste: e =>
      e.tipo === 'toque' && e.goleiro && e.distProprioGol > 40,
    diz: e => `goleiro com a bola a ${e.distProprioGol.toFixed(0)} m do proprio gol` },
  { id: 'posse-relampago', teste: e =>
      e.tipo === 'posse' && e.duracao < 0.8,
    diz: e => `posse de ${e.duracao.toFixed(2)} s` },
  { id: 'pinball', teste: e =>
      e.tipo === 'trocaSeq' && e.trocas >= 6,
    diz: e => `${e.trocas} trocas de posse em ${e.janela.toFixed(1)} s` },
  { id: 'impedimento-repetido', teste: e =>
      e.tipo === 'impedimento' && e.seguidos >= 2,
    diz: e => `${e.seguidos}o impedimento seguido do mesmo time` },
  { id: 'gol-instantaneo', teste: e =>
      e.tipo === 'gol' && e.desdeReinicio < 6,
    diz: e => `gol ${e.desdeReinicio.toFixed(1)} s depois do reinicio` },
  { id: 'expulso-em-campo', teste: e => e.jogouExpulso != null,
    diz: e => `age ${e.jogouExpulso} min DEPOIS de ser expulso` },
  { id: 'drible-parado', teste: e =>
      e.tipo === 'drible' && e.dribleSeguidos >= 3,
    diz: e => `${e.dribleSeguidos}o drible seguido no mesmo lugar` },
  { id: 'atacante-desarmando-atras', teste: e =>
      e.tipo === 'desarme' && /^(FC|ST|CF|ATA|WG|PL)/.test(e.papel) && e.terco === 'defesa',
    diz: e => `${e.papel} desarmando no proprio terco defensivo` },
];

/* ════════════════════════════════════════════════════════ narrar 1 partida ══ */
function narrarPartida(seed) {
  const db = buildDB(DATA);
  const FORMS = Object.keys(FORMATIONS);
  const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
  const mk = (f, home) => {
    const p = autoLineup(squad, f, 0);
    return { squad, name: home ? 'AZUL' : 'ROSA', flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
      lineup: p.lineup, bench: p.bench, formKey: f, style: 'balanced' };
  };
  srand(seed);
  const sim = new MatchSim(mk(FORMS[0], true), mk(FORMS[1], false), { neutral: true, labMode: true });

  const linhas = [], marcadas = [];
  const dirDe = (time) => {
    const tm = sim.teams[time];
    const d = Number(tm && tm.attackDir);
    if (d === 1 || d === -1) return d;
    return (tm && tm.goal && tm.goal.x > 52.5) ? -1 : 1;    // ataca o gol oposto ao seu
  };

  let ultDono = null, tPosse = 0, trocasJanela = [], impedSeguidos = 0, ultImpedTime = null;
  let tUltReinicio = 0, chuteAberto = null, semOrigem = 0;
  /* expulsos: quem levou vermelho nao pode mais aparecer em lance nenhum */
  const expulsos = new Map();
  /* drible parado: o mesmo jogador driblando no mesmo lugar de novo e de novo */
  let ultDrible = null, dribleSeguidos = 0;

  const oEmit = sim._emit;
  sim._emit = function (tipo, d) {
    const r = oEmit.apply(this, arguments);
    try { registrar(tipo, d); } catch (_) {}
    return r;
  };

  function registrar(tipo, d) {
    const b = sim.ball;
    const ator = (d && (d.by || d.actor || d.player)) || (b && b.owner) || null;
    const time = ator && (ator.team === 0 || ator.team === 1) ? ator.team : null;
    const dir = time == null ? 1 : dirDe(time);
    const x = b ? +b.x : 0, y = b ? +b.y : 0;
    const min = Math.floor(+sim.minute || 0);

    const ev = {
      tipo: null, min, x, y, dir,
      nome: ator ? (ator.name || ator.n || `#${ator.idx}`) : '—',
      papel: papel(ator), goleiro: ehGoleiro(ator),
      time: time == null ? '?' : (time === 0 ? 'AZUL' : 'ROSA'),
      lugar: lugar(x, y, dir),
      terco: terco(x, dir),
      distGol: distGol(x, y, dir),
      distProprioGol: distGol(x, y, -dir),
      anguloGol: anguloDeChute(x, y, dir),
      bolaParada: !!(sim.dead > 0),
    };

    let texto = null;
    if (tipo === 'shot_taken') {
      /* ABRE um chute. O desfecho chega em outro evento (miss/save/post/
         blocked/goal) DEPOIS da bola voar, quando ela ja esta em outro lugar —
         narrar os dois como lances separados inventava "dois chutes de posicoes
         diferentes no mesmo instante". A origem que vale e esta. */
      chuteAberto = { ev, min };
      return;
    }
    if (tipo === 'miss' || tipo === 'save' || tipo === 'post' || tipo === 'blocked') {
      const comoAcabou = tipo === 'miss' ? 'pra fora' : tipo === 'save' ? 'defendeu o goleiro'
        : tipo === 'post' ? 'NA TRAVE' : 'bloqueado';
      const o = chuteAberto && (min - chuteAberto.min) <= 1 ? chuteAberto.ev : null;
      chuteAberto = null;
      if (!o) {
        /* desfecho sem chute aberto: nao da para dizer de onde saiu, entao a
           unica coisa honesta e registrar que aconteceu */
        semOrigem++;
        return;
      }
      Object.assign(ev, o, { tipo: 'chute' });
      texto = `${ev.nome} (${ev.papel}) chuta de ${ev.distGol.toFixed(0)} m, ${ev.lugar} — ${comoAcabou}`;
    } else if (tipo === 'goal') {
      ev.tipo = 'gol';
      ev.desdeReinicio = (+sim.t || 0) - tUltReinicio;
      const o = chuteAberto && (min - chuteAberto.min) <= 1 ? chuteAberto.ev : null;
      chuteAberto = null;
      const de = o ? `de ${o.distGol.toFixed(0)} m, ${o.lugar}` : `${ev.lugar}`;
      texto = `*** GOL DO ${ev.time} *** ${ev.nome} (${ev.papel}) ${de}`;
    } else if (tipo === 'offside') {
      ev.tipo = 'impedimento';
      if (ultImpedTime === ev.time) impedSeguidos++; else { impedSeguidos = 1; ultImpedTime = ev.time; }
      ev.seguidos = impedSeguidos;
      texto = `impedimento do ${ev.time} — ${ev.nome}`;
    } else if (tipo === 'tackle' || tipo === 'intercept') {
      ev.tipo = 'desarme';
      texto = `${ev.nome} (${ev.papel}) ${tipo === 'tackle' ? 'desarma' : 'intercepta'} ${ev.lugar}`;
    } else if (tipo === 'foul' || tipo === 'yellow' || tipo === 'red') {
      ev.tipo = 'falta';
      texto = `${tipo === 'foul' ? 'falta' : tipo === 'yellow' ? 'AMARELO' : 'VERMELHO'} — ${ev.nome} (${ev.papel}) ${ev.lugar}`;
    } else if (tipo === 'throw_in' || tipo === 'corner' || tipo === 'goal_kick' || tipo === 'offside_restart') {
      ev.tipo = 'reinicio'; tUltReinicio = (+sim.t || 0);
      texto = `${tipo.replace('_', ' ')} ${ev.lugar}`;
    } else if (tipo === 'dribble') {
      ev.tipo = 'drible';
      const chave = `${ev.time}|${ev.nome}|${Math.round(x / 6)}|${Math.round(y / 6)}`;
      if (chave === ultDrible) dribleSeguidos++; else { ultDrible = chave; dribleSeguidos = 1; }
      ev.dribleSeguidos = dribleSeguidos;
      texto = `${ev.nome} (${ev.papel}) dribla ${ev.lugar}`;
    }

    if (!texto) return;
    /* EXPULSO EM CAMPO — cuidado que ja me fez acusar o jogo errado.
       Os eventos `red`/`yellow` nao carregam `by`, entao o ator caia no
       `ball.owner`, que e outro jogador. A sonda acusou 43 lances por partida
       de "expulso continua jogando" e a leitura do estado do motor (`p.red`)
       nao achou NENHUM. Quem manda e o motor: so marca se o proprio jogador
       estiver com `red`. */
    if (ator && ator.red && tipo !== 'red') {
      if (!expulsos.has(ator)) expulsos.set(ator, min);
      ev.jogouExpulso = min - expulsos.get(ator);
    }

    const marcas = SUSPEITAS.filter(s => { try { return s.teste(ev); } catch (_) { return false; } });
    const linha = { min, texto: `[${ev.time}] ${texto}`, marcas: marcas.map(s => `${s.id}: ${s.diz(ev)}`) };
    linhas.push(linha);
    if (marcas.length) marcadas.push(linha);
  }

  /* Posse e pinball nao vem de evento: saem do dono da bola quadro a quadro.

     CUIDADO que ja me custou uma leitura errada: durante o voo de um passe
     `ball.owner` fica NULL. Contar toda mudanca de `owner` transforma um passe
     normal em duas "trocas de posse" e inventa posses de 0,03 s — a primeira
     versao acusou 689 posses relampago e 212 pinballs por partida, que era o
     buraco do voo, nao o jogo. Aqui so conta quando a bola muda de PE, e o
     tempo de posse ignora o voo. */
  let s = 0, donoAtual = null, tGanhou = 0, tComPe = 0;
  const posses = [];
  while (!sim.isOver() && s++ < 500000) {
    sim.step(DT);
    const dono = sim.ball && sim.ball.owner;
    const agora = +sim.t || 0;
    if (dono) {
      /* expulso com a bola no pe: le do estado do motor, nao do evento */
      if (dono.red) dono.__agiuDepois = true;
      if (dono !== donoAtual) {
        if (donoAtual) {
          const ev = { tipo: 'posse', duracao: tComPe, decorrido: agora - tGanhou };
          posses.push(ev);
          const m = SUSPEITAS.filter(x => x.id === 'posse-relampago' && x.teste(ev));
          if (m.length) marcadas.push({ min: Math.floor(+sim.minute || 0),
            texto: `${donoAtual.name || donoAtual.n || '?'} teve a bola no pe por ${tComPe.toFixed(2)} s`,
            marcas: m.map(x => `${x.id}: ${x.diz(ev)}`) });
        }
        /* troca de posse de verdade: mudou o pe. Trocar entre companheiros e
           passe; entre adversarios e perda. As duas contam para o pinball, que
           mede a bola nao parar em ninguem. */
        trocasJanela.push(agora);
        donoAtual = dono; tGanhou = agora; tComPe = 0;
      } else tComPe += DT;
    }
    trocasJanela = trocasJanela.filter(t => agora - t <= 5);
    if (trocasJanela.length >= 6) {
      const ev = { tipo: 'trocaSeq', trocas: trocasJanela.length, janela: agora - trocasJanela[0] };
      marcadas.push({ min: Math.floor(+sim.minute || 0),
        texto: `a bola passou por ${ev.trocas} pes em ${ev.janela.toFixed(1)} s`,
        marcas: [`pinball: ${ev.trocas} trocas`] });
      trocasJanela = [];
    }
  }
  /* expulsos que continuaram jogando: le do proprio motor (`p.red`), nao do
     evento — a atribuicao por evento pode pegar o jogador errado */
  const expulsosEmCampo = [];
  for (const tm of sim.teams) for (const p of (tm.players || [])) {
    if (p && p.red && p.__agiuDepois) expulsosEmCampo.push(p.name || p.n || `#${p.idx}`);
  }
  return { seed, placar: sim.score.slice(), linhas, marcadas, semOrigem, posses, expulsosEmCampo };
}

/* ═════════════════════════════════════════════════════════════════ saida ══ */
instalarAmbiente();
const realConsole = console;
global.console = { log: noop, warn: noop, error: realConsole.error };
carregar(BUILD);
global.console = realConsole;

const resumo = {};
for (let i = 0; i < N; i++) {
  const r = narrarPartida(SEMENTE + i * 7919);
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`PARTIDA ${i + 1}   semente ${r.seed}   AZUL ${r.placar[0]} x ${r.placar[1]} ROSA`);
  console.log(`${r.linhas.length} lances narrados, ${r.marcadas.length} marcados, ${r.semOrigem} desfechos de chute sem origem`);
  console.log('═'.repeat(78));
  const mostrar = SO_SUSPEITOS ? r.marcadas : r.linhas;
  for (const l of mostrar) {
    const marca = l.marcas && l.marcas.length ? `   <<< ${l.marcas.join(' | ')}` : '';
    console.log(`  ${String(l.min).padStart(3)}'  ${l.texto}${marca}`);
  }
  for (const l of r.marcadas) for (const m of (l.marcas || [])) {
    const id = m.split(':')[0]; resumo[id] = (resumo[id] || 0) + 1;
  }
  if (r.expulsosEmCampo.length) {
    console.log(`\n  !! EXPULSOS QUE CONTINUARAM COM A BOLA (lido de p.red): ${r.expulsosEmCampo.join(', ')}`);
  }
  const d = r.posses.map(p => p.duracao).sort((a, b) => a - b);
  if (d.length) {
    const q = f => d[Math.min(d.length - 1, Math.floor(d.length * f))];
    console.log(`\n  POSSE INDIVIDUAL: ${d.length} posses na partida`
      + `  |  mediana ${q(.5).toFixed(2)} s  p90 ${q(.9).toFixed(2)} s  max ${q(1).toFixed(1)} s`
      + `  |  abaixo de 0,5 s: ${(d.filter(v => v < .5).length / d.length * 100).toFixed(0)}%`);
    console.log('  futebol real: ~1,1 s de media com a bola no pe, ~250-350 posses individuais por time');
    /* SOBREVIVENCIA: dado que o jogador ja esta com a bola ha t, qual a chance
       de ele ainda estar com ela 0,28 s depois (um intervalo de decisao)?
       Se essa chance for CONSTANTE, a posse nao tem memoria — e uma moeda
       jogada a cada decisao, e nao uma intencao que dura. Futebol real tem
       memoria: quem arrancou tende a seguir arrancando. */
    const passo = 0.28;
    console.log('\n  SOBREVIVENCIA DA POSSE (chance de continuar com a bola mais 0,28 s)');
    for (let k = 0; k < 7; k++) {
      const t = k * passo;
      const vivos = d.filter(v => v >= t).length;
      const seguem = d.filter(v => v >= t + passo).length;
      if (vivos < 12) break;
      const h = seguem / vivos;
      console.log(`    ja com a bola ha ${t.toFixed(2)}s  ->  segue em ${(h * 100).toFixed(0)}%`
        + `   (${vivos} casos)  ${'#'.repeat(Math.round(h * 40))}`);
    }
    console.log('    taxa constante = posse SEM MEMORIA (moeda a cada decisao)');
  }
}
console.log(`\n${'═'.repeat(78)}`);
console.log(`SUSPEITAS POR PARTIDA (${N} partida(s))`);
for (const [k, v] of Object.entries(resumo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(26)} ${(v / N).toFixed(1)}`);
}
