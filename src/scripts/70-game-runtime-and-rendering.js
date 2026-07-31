/* ═══════════ game.js ═══════════ */
/* =========================================================================
   COPA DOS SONHOS — game.js  v2 (visual redesign)
   Campo horizontal com marcações reais, badges numerados, narração
   sobrepostas, barra de posse ao vivo e flash de gol dramático.
   ========================================================================= */
(function () {
'use strict';
const $ = s => document.querySelector(s);

/* ─── VELOCIDADES ────────────────────────────────────────────────────── */
const SPEEDS = [
  { k: '1X',    v: 0.6 },
  { k: '2X',    v: 1.4 },
  { k: '4X',    v: 3.2 },
  { k: 'TURBO', v: 6.0 },
];

/* ─── NARRAÇÃO pt-BR ──────────────────────────────────────────────────── */
const NARR = {
  kickoff:     () => pick(['Bola rolando!', 'Começa o jogo!', 'Apita o árbitro!']),
  goal:        e  => `⚽ ${e.golaco?'GOLAÇO':'GOL'}! <b>${esc(e.by.ref.n)}</b> manda pra rede!`,
  save:        e  => e.big
    ? `🧤 <b>${esc((e.gk||{ref:{n:'Goleiro'}}).ref.n)}</b> faz a defesaça!`
    : `Defesa do goleiro.`,
  gk_claim:    e  => `🧤 <b>${esc((e.gk||{ref:{n:'Goleiro'}}).ref.n)}</b> sai do gol e domina pelo alto!`,
  gk_claim_miss:e => `A bola passa pela saída de <b>${esc((e.gk||{ref:{n:'Goleiro'}}).ref.n)}</b>!`,
  post:        () => '🔴 NA TRAVE! Incrível!',
  miss:        e  => `<b>${esc(e.by.ref.n)}</b> manda pra fora.`,
  blocked:     () => 'Bloqueado pela defesa!',
  corner:      () => '🚩 Escanteio.',
  cross:       e  => `<b>${esc(e.by.ref.n)}</b> levanta na área…`,
  foul:        e  => `Falta em <b>${esc(e.on.ref.n)}</b>.`,
  yellow:      e  => `🟨 Amarelo para <b>${esc(e.p.ref.n)}</b>.`,
  red:         e  => e.second
    ? `🟥 <b>${esc(e.p.ref.n)}</b> EXPULSO — segundo amarelo!`
    : `🟥 VERMELHO DIRETO! <b>${esc(e.p.ref.n)}</b> está fora!`,
  penalty:     e  => `🔴 PÊNALTI!${e.by?' <b>'+esc(e.by.ref.n)+'</b> vai cobrar…':''}`,
  legend:      e  => `⭐ <b>${esc(e.by.ref.n)}</b> chama a responsabilidade! A lenda assume o jogo!`,
  through:     e  => `🎯 Enfiada de bola! <b>${esc(e.by.ref.n)}</b> lança <b>${esc(e.to.ref.n)}</b> nas costas da zaga!`,
  pen_miss:    e  => e.gk
    ? `❌ Pênalti defendido por <b>${esc(e.gk.ref.n)}</b>!`
    : '❌ Pênalti desperdiçado!',
  freekick:    e  => `🎯 <b>${esc(e.by.ref.n)}</b> vai cobrar a falta…`,
  halftime:    () => '⏸ FIM DO 1º TEMPO.',
  extratime:   () => '⚡ PRORROGAÇÃO!',
  et_halftime: () => 'Vira o campo.',
  sub:         e  => `↕ Entra <b>${esc(e.inP.ref.n)}</b>, sai ${esc(e.out.ref.n)}.`,
  intercept:   e  => `<b>${esc(e.by.ref.n)}</b> intercepta!`,
  tackle:      e  => `<b>${esc(e.by.ref.n)}</b> rouba a bola!`,
  dribble:     () => 'Dribla o marcador!',
};
const MINOR = new Set(['tackle','dribble','intercept','corner','cross','blocked','header_clear','gk_claim_miss']);

/* ─── ESTADO ──────────────────────────────────────────────────────────── */
let sim = null, raf = 0, acc = 0, lastT = 0;
let tab = 'campo', paused = false;
let training = null, trainingRAF = 0, trainingLastT = 0;

/* ─────────────────────────────────────────────────────────────────────────
   #6/#17 — ÁUDIO CONTEXTUAL (Web Audio API, sem arquivos externos)
   Sons sintetizados na hora por osciladores: apito, chute e gol. O jogo era
   100% mudo. Tudo é LAZY (só cria o AudioContext no 1º som, depois do 1º toque
   do usuário) e blindado por try/catch — se o navegador bloquear áudio, o jogo
   segue normal, sem erro. Invocado nos pontos-chave do onEvent.
   ───────────────────────────────────────────────────────────────────────── */
let _audioCtx = null;
function playUXSound(type) {
  try {
    const activeGesture = !navigator.userActivation || navigator.userActivation.isActive;
    if (!_audioUnlocked && !activeGesture) return;
    if (!_audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _audioCtx = new AC();
    }
    if (_audioCtx.state === 'suspended') {
      const resumed = _audioCtx.resume();
      if (resumed && resumed.catch) resumed.catch(function(){});
      if (_audioCtx.state === 'suspended' && !activeGesture) return;
    }
    const t = _audioCtx.currentTime;
    const mk = () => { const osc = _audioCtx.createOscillator(); const gain = _audioCtx.createGain(); osc.connect(gain); gain.connect(_audioCtx.destination); return { osc, gain }; };
    const burstNoise = (dur, vol) => {
      const len = Math.max(1, Math.floor(_audioCtx.sampleRate * dur));
      const buf = _audioCtx.createBuffer(1, len, _audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i=0;i<len;i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = _audioCtx.createBufferSource();
      const hp = _audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420;
      const gain = _audioCtx.createGain();
      src.buffer = buf; src.connect(hp); hp.connect(gain); gain.connect(_audioCtx.destination);
      gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.start(t); src.stop(t + dur + 0.02);
    };
    if (type === 'whistle' || type === 'start' || type === 'penalty') {
      const a = mk(), b = mk();
      a.osc.type = 'sine'; b.osc.type = 'sine';
      const f1 = type === 'penalty' ? 1020 : 1180;
      const f2 = type === 'penalty' ? 1320 : 1520;
      const dur = type === 'start' ? 0.58 : type === 'penalty' ? 0.32 : 0.44;
      a.osc.frequency.setValueAtTime(f1, t); b.osc.frequency.setValueAtTime(f1 * 1.18, t);
      a.osc.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.35);
      b.osc.frequency.exponentialRampToValueAtTime(f2 * 1.12, t + dur * 0.35);
      a.gain.gain.setValueAtTime(0.15, t); b.gain.gain.setValueAtTime(0.10, t + 0.01);
      a.gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      b.gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      a.osc.start(t); b.osc.start(t + 0.005); a.osc.stop(t + dur); b.osc.stop(t + dur);
      if (type === 'start') setTimeout(() => playUXSound('crowd'), 120);
    } else if (type === 'kick') {
      const a = mk(); a.osc.type = 'triangle'; a.osc.frequency.setValueAtTime(160, t); a.osc.frequency.exponentialRampToValueAtTime(42, t + 0.12); a.gain.gain.setValueAtTime(0.40, t); a.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15); a.osc.start(t); a.osc.stop(t + 0.16);
    } else if (type === 'goal') {
      const a = mk(), b = mk();
      a.osc.type = 'square'; b.osc.type = 'triangle';
      a.osc.frequency.setValueAtTime(440, t); b.osc.frequency.setValueAtTime(660, t + 0.05);
      a.osc.frequency.linearRampToValueAtTime(660, t + 0.28); b.osc.frequency.linearRampToValueAtTime(880, t + 0.32);
      a.gain.gain.setValueAtTime(0.20, t); b.gain.gain.setValueAtTime(0.10, t + 0.05);
      a.gain.gain.linearRampToValueAtTime(0.001, t + 0.9); b.gain.gain.linearRampToValueAtTime(0.001, t + 0.65);
      a.osc.start(t); b.osc.start(t + 0.05); a.osc.stop(t + 0.92); b.osc.stop(t + 0.7); setTimeout(() => playUXSound('crowd'), 30);
    } else if (type === 'foul') {
      burstNoise(0.16, 0.18);
      const a = mk(); a.osc.type = 'square'; a.osc.frequency.setValueAtTime(760, t); a.osc.frequency.exponentialRampToValueAtTime(520, t + 0.14); a.gain.gain.setValueAtTime(0.12, t); a.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15); a.osc.start(t); a.osc.stop(t + 0.16);
    } else if (type === 'crowd') {
      burstNoise(0.85, 0.05);
      const a = mk(); a.osc.type = 'sawtooth'; a.osc.frequency.setValueAtTime(110, t); a.osc.frequency.linearRampToValueAtTime(150, t + 0.32); a.gain.gain.setValueAtTime(0.018, t); a.gain.gain.linearRampToValueAtTime(0.001, t + 0.82); a.osc.start(t); a.osc.stop(t + 0.84);
    } else if (type === 'end') {
      playUXSound('whistle');
    }
  } catch (_) { }
}

/* Desbloqueio de áudio (iOS/mobile): o navegador só toca som se o AudioContext
   for criado/retomado DENTRO de um gesto do usuário. No 1º toque/clique a gente
   cria e "acorda" o contexto com um buffer mudo; depois os sons da partida tocam. */
let _audioUnlocked = false;
function _unlockAudio(ev) {
  try {
    if (ev && ev.isTrusted === false) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    if (!_audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; _audioCtx = new AC(); }
    if (_audioCtx.state === 'suspended') { const resumed = _audioCtx.resume(); if (resumed && resumed.catch) resumed.catch(function(){}); }
    if (!_audioUnlocked) {
      const buf = _audioCtx.createBuffer(1, 1, 22050);
      const src = _audioCtx.createBufferSource();
      src.buffer = buf; src.connect(_audioCtx.destination); src.start(0);
      _audioUnlocked = true;
    }
  } catch (_) {}
}
['touchend', 'pointerdown', 'mousedown', 'click'].forEach(function (ev) {
  try { document.addEventListener(ev, _unlockAudio, { capture: true, passive: true }); } catch (_) {}
});
let feed = [], minorCd = 0, finished = false;
let isKO = false, myMatch = null, mySide = 0;
let trailPts = [], goalFlash = null, latestEvent = null;
let _prevScreen = {};   // #anti-cardume (visual): posição de tela do frame anterior, por jogador
let celebration = null;   // overlay dramático de gol (nome + placar + confete)
let replayBuf = [];       // buffer circular de snapshots (posições) p/ replay de gol
let replay = null;        // { frames, idx, until } durante a reprodução
let penScene = null;      // cena visual de cobrança de pênalti (jogo + shootout)
let fkScene = null;       // cena visual de falta (barreira + cobrador + curva)
let setPieceRequest = null; // cobrança aguardando gesto do usuário
let shootoutState = null;   // disputa interativa e ordem escolhida
let spChargeRAF = 0;
let breakOv = null;       // overlay de intervalo/prorrogação (pausa dramática)
let slowmo = null;        // câmera lenta no chute perigoso { until, f }
let statsT = 0, stTick = 0, teamColors = ['#ffcb45','#2e9bff'];
let momHist = [], momT = 0, keyEvents = [];
let vfx = [], passNarrCd = 0;
let playerMotions = [];  // saltos, cabeceios e mergulhos puramente visuais
let camX = 320, camY = 207;                       // câmera suave (§17)
/* ============================================================================
   PONTO 2 · CÂMERA DINÂMICA POR GESTO — estado global
   ============================================================================
   O antigo `const ZOOM = 1.30` fixo foi substituído por um sistema de dois
   estados com transição contínua:
     · ESTADO PADRÃO ("fechada"): a câmera acompanha a bola com zoom alto —
       1.55 no retrato, 1.35 no paisagem (camBaseZoom). O jogador NÃO vê o
       campo inteiro; vê a AÇÃO, como uma transmissão de TV.
     · ESTADO PANORÂMICO: enquanto o usuário mantém o gesto de ARRASTAR PARA
       BAIXO sobre o gramado (camHold=true, ligado em bindControls), o zoom
       interpola até 1.0 — o campo inteiro cabe na viewport. Ao soltar o dedo,
       a câmera volta sozinha para a visão aproximada.
   camOverviewT é o interpolador 0→1 entre os dois estados; ele é avançado a
   cada frame dentro de paintField com easing exponencial + smoothstep, o que
   dá àquela "respirada" de zoom a suavidade de uma grua de estádio em vez de
   um corte seco. Desktop (>=900px) ignora tudo isto e segue com campo fixo.
   ============================================================================ */
let camOverviewT = 0;    // 0 = visão fechada na ação · 1 = panorâmica total
let camHold = false;     // true enquanto o gesto "arrastar para baixo" durar
/* ═══════════════════════════════════════════════════════════════════════
   TÓPICO 2 · CÂMERA DE PARTIDA NO RETRATO
   ═══════════════════════════════════════════════════════════════════════
   ESCOPO CIRÚRGICO: só o CELULAR EM PÉ muda. Paisagem segue com a câmera
   de TV (1.35 + gesto de panorâmica) e o desktop segue com campo fixo —
   nenhum dos dois é tocado por este bloco.
   A MATEMÁTICA: o pipeline de câmera do paintField interpola o zoom entre
   camBaseZoom() e 1.0; em z=1 a viewport vira exatamente CW×CH e o clamp
   de cpx/cpy colapsa a câmera no CENTRO do campo — ou seja, z=1 É o
   enquadramento "linha de fundo a linha de fundo" já existente no motor.
   Então a mesa tática não precisa de um caminho novo de renderização:
   basta o retrato-celular declarar zoom-base 1.0. O campo inteiro (as
   duas áreas, as duas laterais) encaixa milimetricamente e a câmera
   jamais se move, porque follow e panorâmica convergem para o mesmo
   ponto fixo quando z=1.
   O gesto de arrastar (que existia justamente para compensar o zoom
   errado) é desligado no retrato no bindControls, logo abaixo — toque no
   gramado nunca mais rouba o gesto de quem quer usar a UI inferior. */
function isPortraitPhone(){
  return window.matchMedia
    && window.matchMedia('(orientation: portrait)').matches
    && !window.matchMedia('(min-width: 900px)').matches;
}
function camBaseZoom(){
  if (isPortraitPhone()) return 1.22;    // retrato: ação maior; a interface fica abaixo por rolagem
  return 1.35;                           // paisagem: câmera de TV
}
/* PONTO 3 · flag de ressincronização do canvas em telas de alta densidade —
   marcada em resize/rotação e consumida por paintField (ver syncCanvasResolution). */
let _dprDirty = true;
window.addEventListener('resize', function(){ _dprDirty = true; });
window.addEventListener('orientationchange', function(){ _dprDirty = true; });
const PASS_NARR = [
  (a,b,z) => `<b>${a}</b> toca para <b>${b}</b>${z}…`,
  (a,b,z) => `<b>${b}</b> recebe de ${a}${z}…`,
  (a,b,z) => `<b>${a}</b> encontra <b>${b}</b>${z}…`,
  (a,b,z) => `${a} avança e aciona <b>${b}</b>${z}…`,
];

/* ─── HELPERS ─────────────────────────────────────────────────────────── */
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function makeConfetti(leftSide) {
  const cols = ['#ffcb45','#2e9bff','#2bbf63','#ff4d6d','#ffffff'];
  return Array.from({length: 34}, () => ({
    x: (leftSide ? 0.15 : 0.85) + (Math.random()-0.5)*0.5,
    y: 0.1 + Math.random()*0.2, vx: (Math.random()-0.5)*0.006,
    vy: 0.004 + Math.random()*0.006, c: pick(cols),
    r: 2 + Math.random()*3, spin: Math.random()*6,
  }));
}
function a8Html(p, isLegend) {
  const items = attr8(p);
  return `<div class="a8">${items.map(a => {
    const col = a.v >= 88 ? 'var(--ouro)' : a.v >= 78 ? 'var(--verde)' : a.v >= 68 ? 'var(--azul)' : '#5a6c8f';
    const barCol = isLegend ? 'var(--ouro)' : col;
    return `<div class="a8i"><div class="v" style="color:${col}">${a.v}</div><div class="l">${a.k}</div><div class="bar"><i style="width:${a.v}%;background:${barCol}"></i></div></div>`;
  }).join('')}</div>`;
}
function esc(s) { return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
// Nome de campo: o rótulo sai da ÚLTIMA palavra do registro completo, e para
// nome terminado em sufixo geracional isso produz um rótulo que não é nome de
// ninguém — "Neymar Santos Júnior" virava "JÚNIOR". Na seleção de 2018 quatro
// jogadores dividiam esse mesmo rótulo.
// A troca é só de exibição: o nome de dados fica intacto porque alimenta
// hash32(p.n) na geração de atributos, e alterá-lo mudaria o jogador dentro do
// motor. Nomes de uma palavra só ("Junior", "Filho", "Sobrinho") são o nome de
// registro do jogador e ficam como estão.
const FIELD_NAME = {
  'Neymar Santos Júnior': 'Neymar',
  'Marcelo da Silva Júnior': 'Marcelo',
  'Oscar Emboaba Júnior': 'Oscar',
  'João Miranda de Souza Filho': 'Miranda',
  'Roque Júnior': 'Roque',
  'José Paulo Maciel Júnior': 'Maciel',
  // "da Silva" nunca é o nome de uso: num mesmo elenco quatro jogadores
  // dividiam o rótulo SILVA. O nome de uso é o primeiro, salvo Daniel Alves,
  // conhecido pelo do meio.
  'Daniel Alves da Silva': 'Alves',
  'Thiago da Silva': 'Thiago',
  'Willian da Silva': 'Willian',
  'Danilo da Silva': 'Danilo',
  'Gilberto da Silva': 'Gilberto',
  'Nilmar da Silva': 'Nilmar'
};
function lastWord(name, max) {
  if (!name) return '';
  const p = (FIELD_NAME[name.trim()] || name).trim().split(' ');
  const last = p[p.length-1];
  return (last.length<=max ? last : last.slice(0,max-1)+'.' ).toUpperCase();
}

const { toast, ovrClass } = window.UI;

/* ─── EXPOSIÇÃO ───────────────────────────────────────────────────────── */
const GAME = window.GAME = { open, openFreeKickTraining, advanceAfterPlayerDone, _sim: () => sim, openPreMatch, suggestRole };

/* ─── DEV: partida instantânea p/ observação (pula draft/copa) ─────────── */
window.__quickMatch = function (iA, iB) {
  const db = G.db; if (!db) return 'db não pronto';
  const mkT = (s, color, flag) => { const { lineup, bench } = autoLineup(s, '4-3-3', 0); return { squad: s, name: s.c, flag, color, lineup, bench }; };
  const A = mkT(db.squads[iA == null ? 40 : iA], '#ffcb45', '⭐');
  const B = mkT(db.squads[iB == null ? 120 : iB], '#e84040', '🔥');
  myMatch = { h: 'QA', a: 'QB' }; isKO = false; mySide = 0; teamColors = [A.color, B.color];
  feed=[]; finished=false; tab='campo'; acc=0; lastT=0; paused=false;
  trailPts=[]; goalFlash=null; celebration=null; replay=null; replayBuf=[]; penScene=null; fkScene=null; setPieceRequest=null; shootoutState=null; breakOv=null; slowmo=null; latestEvent=null; minorCd=0; statsT=0; momHist=[]; momT=0; keyEvents=[]; playerMotions=[];
  endOfPlay._done = false; fastForwardFullTime._done = false; /* PONTO 4: novo jogo, nova janela de compressão */ camX = 320; camY = 207;
  sim = new MatchSim(A, B, { onEvent, onSetPiece: openSetPieceMinigame }); sim.setInteractive(0);
  G.screen = 'match'; render(A, B); startLoop();
  return A.name + ' x ' + B.name;
};

/* ========================= DESAFIO DE FALTAS =============================
   Modo independente de cinco cobranças. Usa resolveFreeKickPhysics(), a mesma
   função do MatchSim, para que treinar aqui ensine exatamente a partida. */
const FK_LEVELS = {
  warmup: { name:'Aquecimento', desc:'18–22 m · goleiro acessível', min:18, max:22, keeper:.48, pressure:0 },
  cup:    { name:'Nível Copa', desc:'21–27 m · pressão competitiva', min:21, max:27, keeper:.74, pressure:.08 },
  legend: { name:'Lendário', desc:'24–31 m · elite no gol', min:24, max:31, keeper:.96, pressure:.16 },
};

function freeKickCandidates(){
  const db=G.db, all=[];
  for(const sq of db.squads) for(const p of sq.pl) if(p.slot!=='GK') all.push({p,sq,skill:Math.round(facet(p,'setpiece'))});
  const wanted=[
    ['Messi'],['Maradona'],['Zico'],['Beckham'],['Ronaldinho'],['Cristiano Ronaldo'],
    ['Platini'],['Zidane'],['Roberto Carlos'],['Rivelino'],['Pirlo'],['Neymar']
  ];
  const out=[], used=new Set();
  for(const keys of wanted){
    const found=all.filter(x=>keys.every(k=>x.p.n.toLowerCase().includes(k.toLowerCase()))).sort((a,b)=>b.skill-a.skill||b.p.r-a.p.r)[0];
    const foundKey=found&&found.p.n.toLowerCase();
    if(found&&!used.has(foundKey)){out.push(found);used.add(foundKey);}
  }
  for(const x of all.sort((a,b)=>b.skill-a.skill||b.p.r-a.p.r)){
    const key=x.p.n.toLowerCase(); if(used.has(key))continue;
    out.push(x);used.add(key);if(out.length>=8)break;
  }
  return out.slice(0,8);
}

function freeKickKeepers(){
  const out=[];
  for(const sq of G.db.squads) for(const p of sq.pl) if(p.slot==='GK') out.push({p,sq,skill:facet(p,'gk')});
  return out.sort((a,b)=>a.skill-b.skill);
}

function stopFreeKickTraining(){
  cancelAnimationFrame(trainingRAF); trainingRAF=0; trainingLastT=0;
  clearTimeout(training&&training.resultTimer);
  clearSetPieceControls(); fkScene=null; setPieceRequest=null; training=null;
}

function freeKickBest(readValue){
  try {
    if(readValue==null)return +(localStorage.getItem('cds_fk_best')||0);
    localStorage.setItem('cds_fk_best',String(readValue));return readValue;
  } catch(_){ return readValue==null?0:readValue; }
}

function openFreeKickTraining(){
  cancelAnimationFrame(raf); raf=0; sim=null; paused=true; isKO=false;
  clearSetPieceControls(); fkScene=null; penScene=null; setPieceRequest=null;
  training={ candidates:freeKickCandidates(), keepers:freeKickKeepers(), playerIdx:0, level:'cup', round:0, score:0, goals:0, results:[], playing:false, token:0 };
  renderFreeKickLobby();
}

function renderFreeKickLobby(){
  if(!training)return;
  const best=freeKickBest();
  document.querySelector('#app').innerHTML=`
    ${window.UI.header('Desafio de Faltas','home')}
    <div class="screen"><div class="fk-lobby">
      <section class="fk-lobby-hero">
        <div class="eyebrow">Modo de habilidade</div>
        <h1 class="display">Domine a<br><span class="gold">bola parada</span></h1>
        <p>Mire no gol, puxe a bola para definir força e use o movimento lateral para aplicar curva. São cinco cobranças com distância e ângulo variáveis.</p>
        <div class="fk-rules">
          <div class="fk-rule"><strong>5</strong><span>cobranças</span></div>
          <div class="fk-rule"><strong>${best}</strong><span>recorde</span></div>
          <div class="fk-rule"><strong>1:1</strong><span>física da Copa</span></div>
        </div>
      </section>
      <div class="fk-config-grid">
        <section class="card">
          <div class="eyebrow">Escolha o cobrador</div>
          <div class="fk-choice-list">
            ${training.candidates.map((x,i)=>`<button class="fk-choice ${i===training.playerIdx?'on':''}" data-fkp="${i}">
              <span><b>${esc(x.p.n)}</b><small>${window.flagSvg(x.sq.f,11)} ${esc(x.sq.c)} ${x.sq.y} · OVR ${x.p.r}</small></span><span class="fk-rating">${x.skill}</span>
            </button>`).join('')}
          </div>
        </section>
        <section class="card">
          <div class="eyebrow">Dificuldade</div>
          <div class="fk-difficulties">
            ${Object.entries(FK_LEVELS).map(([k,v])=>`<button class="fk-diff ${k===training.level?'on':''}" data-fkl="${k}"><b>${v.name}</b><span>${v.desc}</span></button>`).join('')}
          </div>
          <div class="hr"></div>
          <div style="color:#96a5bb;font-size:11px;line-height:1.5">A nota de <b style="color:#e8eef8">bola parada</b> do cobrador controla a margem de erro. Sua mira, força e curva decidem a execução.</div>
          <button class="btn btn-gold" id="fk-start" style="margin-top:14px">Começar desafio</button>
        </section>
      </div>
    </div></div>`;
  document.querySelectorAll('[data-fkp]').forEach(b=>b.onclick=()=>{training.playerIdx=+b.dataset.fkp;renderFreeKickLobby();});
  document.querySelectorAll('[data-fkl]').forEach(b=>b.onclick=()=>{training.level=b.dataset.fkl;renderFreeKickLobby();});
  $('#fk-start').onclick=startFreeKickChallenge;
}

function startFreeKickChallenge(){
  if(!training)return;
  training.round=0;training.score=0;training.goals=0;training.results=[];training.playing=true;training.token++;
  const chosen=training.candidates[training.playerIdx];
  document.querySelector('#app').innerHTML=`<div class="fk-training">
    <header class="fk-train-head">
      <button class="fk-exit" id="fk-exit" aria-label="Sair do desafio">‹</button>
      <div class="fk-train-title"><b>Desafio de Faltas</b><span id="fk-stage-meta">${esc(chosen.p.n)} · ${FK_LEVELS[training.level].name}</span></div>
      <div class="fk-score"><b id="fk-score">0</b><span>pontos</span></div>
      <div class="fk-rounds" id="fk-rounds"></div>
    </header>
    <div class="field-wrap">
      <canvas id="fieldcv" width="1024" height="500" aria-label="Cobrança de falta"></canvas>
      <div id="setpiece-ui"></div><div id="fk-result"></div>
    </div>
  </div>`;
  $('#fk-exit').onclick=()=>{stopFreeKickTraining();window.UI.go('home');};
  paintFreeKickRounds();beginFreeKickRound();
  trainingLastT=performance.now();cancelAnimationFrame(trainingRAF);trainingRAF=requestAnimationFrame(freeKickTrainingFrame);
}

function paintFreeKickRounds(){
  const host=$('#fk-rounds');if(!host||!training)return;
  host.innerHTML=Array.from({length:5},(_,i)=>{
    const done=training.results[i];return `<span class="fk-round-dot ${done?done.result:(i===training.round?'now':'')}"></span>`;
  }).join('');
  const score=$('#fk-score');if(score)score.textContent=training.score;
}

function chooseTrainingKeeper(level){
  const arr=training.keepers;if(!arr.length)return null;
  const ix=Math.min(arr.length-1,Math.max(0,Math.round((arr.length-1)*level.keeper)));
  return arr[ix];
}

function beginFreeKickRound(){
  if(!training||training.round>=5)return finishFreeKickChallenge();
  const level=FK_LEVELS[training.level], chosen=training.candidates[training.playerIdx], keeper=chooseTrainingKeeper(level);
  const dist=Ri(level.min,level.max), side=pick([-1,0,1]);
  const sideLabel=side<0?'pela esquerda':side>0?'pela direita':'frontal';
  const stageMeta=$('#fk-stage-meta');
  if(stageMeta)stageMeta.textContent=`${chosen.p.n} · ${dist} m · ${sideLabel}`;
  const token=training.token;
  const req={kind:'freekick',training:true,round:training.round+1,total:5,team:0,taker:{ref:chosen.p},gk:keeper?{ref:keeper.p}:null,dist,
    sideLabel,ballX:CW*.5/* centralização: o lado vira rótulo, não deslocamento */,pressure:level.pressure+training.round*.012,
    resolve:input=>{
      if(!training||training.token!==token)return;
      const out=resolveFreeKickPhysics(facet(chosen.p,'setpiece'),keeper?facet(keeper.p,'gk'):40,dist,input);
      const vis=out.visual,shotDir=vis.actualX<.5?-1:1,scene=fkScene;
      Object.assign(scene,{result:out.result,phase:'set',t:0,actualX:vis.actualX,actualY:vis.actualY,aimX:vis.aimX,aimY:vis.aimY,
        power:vis.power,curve:vis.curve,execution:vis.execution,gkDir:out.result==='save'?shotDir:-shotDir,until:Infinity});
      const precision=clamp(1-Math.hypot((vis.actualX-vis.aimX)*1.5,(vis.actualY-vis.aimY)*1.2)*3,0,1);
      let pts=out.result==='goal'?900+Math.round(precision*220+out.corner*260):out.result==='save'?140+Math.round(precision*120+out.corner*90):out.result==='wall'?60:Math.round(precision*45);
      training.score+=pts;if(out.result==='goal')training.goals++;
      training.results.push({result:out.result,points:pts,dist,side:sideLabel});paintFreeKickRounds();
      training.resultTimer=setTimeout(()=>showFreeKickRoundResult(out.result,pts),2600);
    }};
  const resultHost=$('#fk-result');if(resultHost)resultHost.innerHTML='';
  openSetPieceMinigame(req); /* centralização: sem sobrescrever ballX da cena */
}

function showFreeKickRoundResult(result,pts){
  if(!training||!training.playing)return;
  const labels={goal:'Gol!',save:'Boa cobrança',wall:'Na barreira',miss:'Para fora'};
  const host=$('#fk-result');if(!host)return;
  const last=training.results[training.results.length-1];
  host.innerHTML=`<div class="fk-result-panel"><div class="fk-result-card">
    <div class="fr-out">${labels[result]||'Cobrança'}</div>
    <div class="fr-pts">+${pts} pontos · ${last.dist} m · ${last.side}</div>
    <button class="btn btn-gold" id="fk-next">${training.round===4?'Ver resultado':'Próxima cobrança'} ›</button>
  </div></div>`;
  $('#fk-next').onclick=()=>{host.innerHTML='';fkScene=null;training.round++;paintFreeKickRounds();beginFreeKickRound();};
}

function freeKickTrainingFrame(now){
  if(!training||!training.playing)return;
  const dt=Math.min(.05,(now-trainingLastT)/1000);trainingLastT=now;
  const cv=$('#fieldcv'),ctx=cv&&cv.getContext('2d');
  if(ctx){
    if(fkScene){if(fkScene.phase!=='aim')advanceFkScene(dt);drawFkScene(ctx);}
    else{drawSpBackdrop(ctx);drawSpGoal(ctx,spGoalRect(),0);}
  }
  trainingRAF=requestAnimationFrame(freeKickTrainingFrame);
}

function finishFreeKickChallenge(){
  if(!training)return;training.playing=false;cancelAnimationFrame(trainingRAF);clearSetPieceControls();fkScene=null;
  const best=Math.max(training.score,freeKickBest());freeKickBest(best);
  const grade=training.goals>=5?'S':training.goals>=4?'A':training.goals>=3?'B':training.goals>=2?'C':'D';
  const chosen=training.candidates[training.playerIdx];
  document.querySelector('#app').innerHTML=`${window.UI.header('Resultado','home')}<div class="screen"><div class="fk-lobby fk-final">
    <div class="eyebrow">Desafio concluído</div><div class="fk-final-grade">${grade}</div>
    <h1 class="display" style="font-size:38px">${training.score} pontos</h1>
    <p class="mut" style="margin:7px 0 14px">${training.goals} gols em 5 cobranças com ${esc(chosen.p.n)}.</p>
    <div class="card" style="text-align:left">${training.results.map((r,i)=>`<div class="row" style="cursor:default"><span class="badge">${i+1}</span><div class="grow"><div class="nm">${{goal:'Gol',save:'Defendida',wall:'Barreira',miss:'Fora'}[r.result]}</div><div class="sb">${r.dist} m · ${r.side}</div></div><div class="ovr ${r.result==='goal'?'g90':'g70'}">+${r.points}</div></div>`).join('')}</div>
    <div style="margin-top:14px"><button class="btn btn-gold" id="fk-again">Tentar novamente</button><button class="btn btn-ghost" id="fk-change">Trocar cobrador</button><button class="btn btn-ghost" id="fk-home">Tela inicial</button></div>
  </div></div>`;
  $('#fk-again').onclick=startFreeKickChallenge;
  $('#fk-change').onclick=renderFreeKickLobby;
  $('#fk-home').onclick=()=>{stopFreeKickTraining();window.UI.go('home');};
}

/* ─── OPEN ────────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════
   TELA PRÉ-PARTIDA · lógica (Fase 2)
   ═══════════════════════════════════════════════════════════════════════ */
// SUGESTÃO AUTOMÁTICA: escolhe a função que melhor casa com o perfil (a8).
function suggestRole(p, pos) {
  const cls = (window.SLOT_CLASS && window.SLOT_CLASS[pos]) || 'CM';
  const a = p.a8 || [];
  const FIN=a[0]||60, PAS=a[1]||60, DRI=a[2]||60, VEL=a[3]||60, DEF=a[4]||60, INT=a[5]||60, FIS=a[6]||60, TEC=a[7]||60;
  switch (cls) {
    case 'GK': return 'gk_seguro';
    case 'CB': return (PAS>=80 && INT>=80) ? 'cb_saida' : (VEL>=82 ? 'cb_libero' : 'cb_defensor');
    case 'FB': return (VEL>=80 && DRI>=74) ? 'fb_ofensivo' : (DEF>=79 && VEL<74 ? 'fb_defensivo' : (PAS>=80 && TEC>=79 ? 'fb_invertido' : 'fb_equilibrado'));
    case 'DM': return (DEF>=80 && FIS>=79) ? 'dm_contencao' : (PAS>=82 && INT>=81 ? 'dm_construtor' : (FIS>=79 && VEL>=77 ? 'dm_b2b' : 'dm_construtor'));
    case 'CM': return (PAS>=83 && INT>=81) ? 'cm_armador' : (FIS>=79 && VEL>=77 ? 'cm_b2b' : (DEF>=80 ? 'cm_contencao' : 'cm_b2b'));
    case 'AM': return (FIN>=81 && DRI>=81) ? 'am_sombra' : (PAS>=85 ? 'am_armador' : 'am_espaco');
    case 'WM': return (VEL>=83) ? 'wm_ofensivo' : (TEC>=83 ? 'wm_invertido' : 'wm_equilibrado');
    case 'WG': return (FIN>=83) ? 'wg_atacante' : (TEC>=82 && DRI>=83 ? 'wg_invertida' : 'wg_aberta');
    case 'FC': return (VEL>=85 && FIN>=83) ? 'fc_artilheiro' : (FIS>=84 ? 'fc_alvo' : (PAS>=81 && DRI>=82 ? 'fc_falso' : 'fc_completo'));
    default: return (window.defaultRoleFor ? window.defaultRoleFor(pos) : 'cm_b2b');
  }
}
// PERSISTÊNCIA das táticas favoritas (mesmo esquema do save do jogo).
const TAC_KEY = 'copa_tactics';
function loadTactics(){ try { return JSON.parse(localStorage.getItem(TAC_KEY)) || {}; } catch(_) { return {}; } }
function persistTactics(t){ try { localStorage.setItem(TAC_KEY, JSON.stringify(t)); } catch(_){} }

function openPreMatch(oppName, onStart) {
  const L = (window.G && G.lineup) || [];
  if (!L.length) { onStart(); return; }
  L.forEach(sl => {
    const pos = sl.pos || (sl.p && sl.p.slot);
    if (!sl.role) sl.role = (window.defaultRoleFor ? defaultRoleFor(pos) : 'cm_b2b');
    if (!sl.focus) sl.focus = 'bal';
  });

  const root = document.createElement('div');
  root.className = 'pm pm26';
  root.innerHTML = `
    <div class="pm26-shell">
      <div class="pm26-head">
        <div class="pm26-titlewrap">
          <button class="pm26-close" data-act="cancel">✕</button>
          <div>
            <div class="pm26-title">Escalação e funções · vs <b>${esc(oppName)}</b></div>
            <div class="pm26-sub">Monte seu time, visualize a ocupação do campo em uma grade 5×5 e ajuste o papel de cada jogador antes da partida.</div>
          </div>
        </div>
        <button class="pm26-start" data-act="start">Iniciar partida ▶</button>
      </div>
      <div class="pm26-toolbar">
        <label class="pm26-select"><span>Formação</span><select id="pmForm">${FORMATION_KEYS.map(k => `<option value="${k}" ${k===G.formKey?'selected':''}>${k}</option>`).join('')}</select></label>
        <label class="pm26-select variation"><span>Variação</span><select id="pmVariation"></select></label>
        <button class="pm26-action" data-act="suggest">✨ Sugerir funções</button>
        <button class="pm26-action" data-act="save">💾 Salvar tática</button>
        <button class="pm26-action" data-act="load">📂 Minhas táticas</button>
        <div class="pm26-catalog" id="pmCatalogCount"></div>
      </div>
      <div class="pm26-body">
        <section class="pm26-stage">
          <div class="pm26-stagehead">
            <div class="pm26-stagecopy">
              <div class="eyeb">Com bola</div>
              <div class="ttl">Mapa de ocupação da função</div>
              <div class="sub">A grade de 25 setores mostra exatamente quais regiões este jogador tende a preencher.</div>
            </div>
            <div class="pm26-readout">
              <div class="lab">Leitura atual</div>
              <div class="val" id="pm26Readout">—</div>
              <div class="small" id="pm26ReadoutSub">Selecione um jogador para ver a zona.</div>
            </div>
          </div>
          <div class="pm26-field" id="pmField">
            <div class="pm26-pitchshade"></div>
            <div class="pm-goal top"></div><div class="pm-goal bot"></div>
            <div class="pm-mid"></div><div class="pm-circle"></div>
            <div class="pm26-grid" id="pmRoleGrid"></div>
            <div class="pm26-badge" id="pm26Badge">Função e ocupação</div>
            <div class="pm26-toast" id="pmToast"></div>
          </div>
          <div class="pm26-legend">
            <span class="soft"><i></i> ocupação provável</span>
            <span class="core"><i></i> zona principal</span>
            <span class="base"><i></i> posição-base</span>
          </div>
          <div class="pm26-scroll-hint">Arraste a tela para cima ou use a roda do mouse para ver todo o painel.</div>
        </section>
        <aside class="pm26-panel" id="pm26Panel"></aside>
      </div>
    </div>`;
  document.body.appendChild(root);

  const field = root.querySelector('#pmField');
  const panel = root.querySelector('#pm26Panel');
  const roleGrid = root.querySelector('#pmRoleGrid');
  const badge = root.querySelector('#pm26Badge');
  const toastEl = root.querySelector('#pmToast');
  const formSelect = root.querySelector('#pmForm');
  const variationSelect = root.querySelector('#pmVariation');
  const catalogCount = root.querySelector('#pmCatalogCount');
  const readout = root.querySelector('#pm26Readout');
  const readoutSub = root.querySelector('#pm26ReadoutSub');
  let selIdx = 0;

  function fillVariationOptions(formKey, selectedIndex){
    const fm = FORMATIONS[formKey];
    if (!variationSelect || !fm) return;
    const vi = clamp(Number.isFinite(+selectedIndex) ? +selectedIndex : 0, 0, fm.variations.length - 1);
    variationSelect.innerHTML = fm.variations.map((v, i) => `<option value="${i}" ${i===vi?'selected':''}>${i+1}. ${esc(v.name)}</option>`).join('');
    variationSelect.value = String(vi);
    if (catalogCount) {
      const totalVars = FORMATION_KEYS.reduce((n, k) => n + FORMATIONS[k].variations.length, 0);
      catalogCount.textContent = `${FORMATION_KEYS.length} formações · ${totalVars} variações`;
    }
  }

  function siglaRole(id){
    const r = window.findRole && findRole(id);
    if (!r) return '';
    return r.n.replace(/[^A-Za-zÀ-ÿ ]/g,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || r.n.slice(0,3).toUpperCase();
  }
  function pmToast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(pmToast._t); pmToast._t = setTimeout(()=>toastEl.classList.remove('show'), 1600); }
  function roleFitsPos(roleId, pos){ return (window.rolesForSlot ? rolesForSlot(pos) : []).some(r => r.id === roleId); }
  function lineCompat(p, pos){ const pp = (p && (p.slot || p.pos)) || 'CM'; return (window.LINE_OF && LINE_OF[pp]) === (window.LINE_OF && LINE_OF[pos]); }
  function posPt(pos){ return (window.SLOT_PT && SLOT_PT[pos]) || pos; }
  function corridorLabel(col){ return ['corredor esquerdo','meio-esquerda','faixa central','meio-direita','corredor direito'][col] || 'faixa central'; }
  function depthLabel(row){ return ['último terço','entrelinhas','meio-campo ofensivo','meio-campo defensivo','saída de bola'][row] || 'setor central'; }

  function applyFormation(formKey, variationIndex){
    const fm = window.FORMATIONS && FORMATIONS[formKey];
    if (!fm || !fm.variations || !fm.variations.length) return;
    const rawVi = Number.isFinite(+variationIndex) ? +variationIndex : (G.varIdx || 0);
    const vi = ((rawVi % fm.variations.length) + fm.variations.length) % fm.variations.length;
    const slots = fm.variations[vi].slots.map(s => ({ x:s.x, y:s.y, pos:s.pos, from:s.from }));
    const pool = L.map((sl, idx) => ({ p:sl.p, from:sl.from, role:sl.role, focus:sl.focus, oldPos:sl.pos, idx }));
    const remaining = pool.slice();
    const order = slots.map((sl, idx) => ({ sl, idx, eligible:remaining.filter(it => canPlay(it.p, sl.pos)).length }))
      .sort((a,b) => {
        if (a.sl.pos === 'GK' && b.sl.pos !== 'GK') return -1;
        if (b.sl.pos === 'GK' && a.sl.pos !== 'GK') return 1;
        return a.eligible - b.eligible;
      });
    const out = new Array(slots.length);
    order.forEach(item => {
      let bestI = 0, best = -1e9;
      remaining.forEach((it, ri) => {
        const exact = it.oldPos === item.sl.pos ? 34 : 0;
        const legal = canPlay(it.p, item.sl.pos) ? 110 : 0;
        const sameLine = lineCompat(it.p, item.sl.pos) ? 18 : 0;
        const natural = ((it.p && it.p.slot) === item.sl.pos) ? 22 : 0;
        const score = legal + exact + sameLine + natural + ((it.p && it.p.r) || 0) * .08;
        if (score > best) { best = score; bestI = ri; }
      });
      const chosen = remaining.splice(bestI,1)[0];
      const role = roleFitsPos(chosen.role, item.sl.pos) ? chosen.role : defaultRoleFor(item.sl.pos);
      const roleDef = findRole(role);
      const focus = roleDef && roleDef.foci.indexOf(chosen.focus) !== -1 ? chosen.focus : (roleDef && roleDef.foci.indexOf('bal') !== -1 ? 'bal' : (roleDef ? roleDef.foci[0] : 'bal'));
      out[item.idx] = { p:chosen.p, from:chosen.from, x:item.sl.x, y:item.sl.y, pos:item.sl.pos, role, focus };
    });
    L.splice.apply(L, [0, L.length].concat(out));
    G.formKey = formKey; G.atkForm = formKey; G.defForm = formKey; G.varIdx = vi;
    fillVariationOptions(formKey, vi);
    selIdx = 0;
    renderAll();
    pmToast(formKey + ' · ' + fm.variations[vi].name);
  }

  function zoneStateFor(sl){
    const pos = sl.pos || (sl.p && sl.p.slot) || 'CM';
    const cls = SLOT_CLASS[pos] || 'CM';
    const fx = roleFx(sl.role || defaultRoleFor(pos), sl.focus || 'bal');
    const sideSign = (sl.y || .5) < .5 ? -1 : 1;
    const targetDepth = clamp((sl.x || .5) + fx.push / 92, .04, .96);
    const targetWidth = clamp((sl.y || .5) + sideSign * fx.wide, .04, .96);
    const baseRow = clamp(Math.floor((1 - (sl.x || .5)) * 5), 0, 4);
    const baseCol = clamp(Math.floor((sl.y || .5) * 5), 0, 4);
    const coreRow = clamp(Math.floor((1 - targetDepth) * 5), 0, 4);
    const coreCol = clamp(Math.floor(targetWidth * 5), 0, 4);

    const depthRadius = {
      GK:.13, CB:.18, FB:.25, DM:.22, CM:.27, AM:.25, WM:.29, WG:.27, FC:.22
    }[cls] || .25;
    const widthRadius = {
      GK:.12, CB:.20, FB:.18, DM:.22, CM:.25, AM:.24, WM:.20, WG:.18, FC:.20
    }[cls] || .22;
    const rx = clamp(depthRadius + fx.deep * .10 + Math.abs(fx.push) / 240, .12, .38);
    const ry = clamp(widthRadius + Math.abs(fx.wide) * .44, .12, .38);
    const active = new Set(), core = new Set();

    for (let row=0; row<5; row++) {
      for (let col=0; col<5; col++) {
        const cellDepth = 1 - (row + .5) / 5;
        const cellWidth = (col + .5) / 5;
        const dx = (cellDepth - targetDepth) / rx;
        const dy = (cellWidth - targetWidth) / ry;
        const d = dx*dx + dy*dy;
        const key = row + '-' + col;
        if (d <= 1.55) active.add(key);
        if (d <= .68) core.add(key);
      }
    }
    const coreKey = coreRow + '-' + coreCol;
    active.add(coreKey); core.add(coreKey);
    const baseKey = baseRow + '-' + baseCol;
    active.add(baseKey);

    // Conecta a base à zona principal sem criar retângulos artificiais.
    const steps = Math.max(Math.abs(coreRow-baseRow), Math.abs(coreCol-baseCol));
    for (let i=0; i<=steps; i++) {
      const r = Math.round(baseRow + (coreRow-baseRow) * (steps ? i/steps : 0));
      const c = Math.round(baseCol + (coreCol-baseCol) * (steps ? i/steps : 0));
      active.add(r + '-' + c);
    }

    const rd = findRole(sl.role || defaultRoleFor(pos));
    return { active, core, baseKey, rd, focus:sl.focus || 'bal', pos, coreRow, coreCol, baseRow, baseCol, targetDepth, targetWidth };
  }

  function renderGrid(sl){
    const z = zoneStateFor(sl);
    roleGrid.innerHTML = Array.from({length:25}, (_, idx) => {
      const r = Math.floor(idx / 5), c = idx % 5;
      const key = r + '-' + c;
      const cls = ['pm26-cell'];
      if (z.active.has(key)) cls.push('soft');
      if (z.core.has(key)) cls.push('core');
      if (z.baseKey === key) cls.push('base');
      return `<div class="${cls.join(' ')}"></div>`;
    }).join('');
    const focusPt = FOCUS_PT[z.focus] || 'Equilibrado';
    badge.textContent = `${z.rd ? z.rd.n : posPt(z.pos)} · ${focusPt}`;
    readout.textContent = `${z.rd ? z.rd.n : posPt(z.pos)}`;
    readoutSub.textContent = `${depthLabel(z.coreRow)} · ${corridorLabel(z.coreCol)} · base em ${depthLabel(z.baseRow)}`;
  }

  function renderChips(){
    field.querySelectorAll('.pm26-chip').forEach(n => n.remove());
    L.forEach((sl, i) => {
      const chip = document.createElement('div');
      chip.className = 'pm26-chip' + (i === selIdx ? ' sel' : '');
      const topPct = 100 - (sl.x || .5) * 100;
      const leftPct = (sl.y || .5) * 100;
      chip.style.top = `clamp(43px, ${topPct}%, calc(100% - 43px))`;
      chip.style.left = `clamp(43px, ${leftPct}%, calc(100% - 43px))`;
      chip.dataset.idx = i;
      chip.innerHTML = `<div class="pm26-chipdot">${esc(lastWord(sl.p ? sl.p.n : '', 3))}</div><div class="pm26-chipname">${esc(lastWord(sl.p ? sl.p.n : '', 10))}</div><div class="pm26-chiprole">${siglaRole(sl.role)}</div>`;
      chip.addEventListener('click', () => selectPlayer(i));
      field.appendChild(chip);
    });
  }

  function impactRows(sl){
    const pos = sl.pos || (sl.p && sl.p.slot) || 'CM';
    const fx = roleFx(sl.role || defaultRoleFor(pos), sl.focus || 'bal');
    const z = zoneStateFor(sl);
    const push = Math.round(fx.push);
    const width = Math.abs(fx.wide) > .08 ? (fx.wide < 0 ? 'fecha para dentro' : 'abre por fora') : 'equilíbrio lateral';
    const depth = fx.deep >= .72 ? 'ataca profundidade' : fx.deep >= .46 ? 'sobe para apoiar' : 'apoio mais curto';
    return [
      ['Posição-base', posPt(pos)],
      ['Função atual', (z.rd && z.rd.n) || posPt(pos)],
      ['Corredor ocupado', corridorLabel(z.coreCol)],
      ['Setor principal', depthLabel(z.coreRow)],
      ['Ajuste vertical', push > 0 ? `avança ${push}m` : push < 0 ? `recua ${Math.abs(push)}m` : 'altura neutra'],
      ['Comportamento', `${width} · ${depth}`],
    ];
  }

  function renderPanel(){
    const sl = L[selIdx]; if (!sl) return;
    const p = sl.p || {};
    const pos = sl.pos || p.slot || 'CM';
    const roles = (window.rolesForSlot ? rolesForSlot(pos) : []);
    const a8 = (window.attr8 ? attr8(p) : []);
    const rdNow = (window.findRole && findRole(sl.role)) || { n: pos, foci:['bal'] };
    const barCol = v => v>=88?'var(--ouro)':v>=78?'var(--verde)':v>=68?'var(--azul)':'#5a6c8f';
    panel.innerHTML = `
      <div class="pm26-playercard">
        <div class="pm26-face">${esc(lastWord(p.n || '', 3))}</div>
        <div style="min-width:0;flex:1">
          <div class="nm">${esc(p.n || '')}</div>
          <div class="sb">${posPt(pos)} · ${esc(rdNow.n || pos)} · ${FOCUS_PT[sl.focus] || 'Equilibrado'}</div>
        </div>
        <div class="pm26-ovr">${p.r || '--'}</div>
      </div>
      <div class="pm26-a8">${a8.map(a => `<div class="pm26-attr"><div class="v" style="color:${barCol(a.v)}">${a.v}</div><div class="k">${a.k}</div><div class="b"><i style="width:${a.v}%;background:${barCol(a.v)}"></i></div></div>`).join('')}</div>
      <div class="pm26-card">
        <div class="pm26-cardhead"><div class="pm26-cardtitle">Leitura tática</div></div>
        <div class="pm26-cardcopy">A visualização do campo foi refeita em uma grade de 25 zonas. A área destacada mostra a ocupação principal deste jogador com a função atual.</div>
        <div class="pm26-impactlist">${impactRows(sl).map(row => `<div class="pm26-impactitem"><strong>${row[0]}</strong><span>${row[1]}</span></div>`).join('')}</div>
      </div>
      <div class="pm26-card">
        <div class="pm26-cardhead"><div class="pm26-cardtitle">Função</div><div class="pm26-cardcopy">Escolha o papel que este jogador vai cumprir.</div></div>
        <div class="pm26-rolelist">${roles.map(r => `<button class="pm26-rolebtn ${r.id===sl.role?'on':''}" data-role="${r.id}"><div class="t">${esc(r.n)}</div><div class="d">aplica outra leitura de zona e comportamento</div></button>`).join('')}</div>
      </div>
      <div class="pm26-card">
        <div class="pm26-cardhead"><div class="pm26-cardtitle">Foco</div><div class="pm26-cardcopy">Define se ele interpreta a função de forma mais defensiva, equilibrada ou ofensiva.</div></div>
        <div class="pm26-focusgrid">${[['def','Defesa'],['bal','Equilibrado'],['atk','Ataque']].map(([f,l]) => `<button class="pm26-focusbtn ${f===sl.focus?'on':''}" data-focus="${f}" ${(rdNow.foci.indexOf(f)===-1?'disabled':'')}>${l}</button>`).join('')}</div>
      </div>`;
  }

  function selectPlayer(i){
    if (i == null || i < 0 || !L[i]) return;
    selIdx = i;
    renderChips();
    renderGrid(L[i]);
    renderPanel();
  }

  function renderAll(){
    renderChips();
    if (selIdx < 0 || !L[selIdx]) selIdx = 0;
    renderGrid(L[selIdx]);
    renderPanel();
  }

  panel.addEventListener('click', e => {
    const rb = e.target.closest('[data-role]');
    const fb = e.target.closest('[data-focus]');
    if (selIdx < 0) return;
    const sl = L[selIdx];
    if (rb) {
      sl.role = rb.dataset.role;
      const r = window.findRole && findRole(sl.role);
      if (r && r.foci.indexOf(sl.focus) === -1) sl.focus = r.foci.indexOf('bal') !== -1 ? 'bal' : r.foci[0];
      renderAll();
    } else if (fb && !fb.hasAttribute('disabled')) {
      sl.focus = fb.dataset.focus;
      renderAll();
    }
  });

  if (formSelect) formSelect.addEventListener('change', function(){
    G.varIdx = 0;
    fillVariationOptions(formSelect.value, 0);
    applyFormation(formSelect.value, 0);
  });
  if (variationSelect) variationSelect.addEventListener('change', function(){
    applyFormation(formSelect.value, +variationSelect.value || 0);
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'cancel') { root.remove(); window.UI.go('cup'); }
    else if (act === 'start') { if (window._saveCopa) window._saveCopa(); root.remove(); onStart(); }
    else if (act === 'suggest') {
      L.forEach(sl => {
        const pos = sl.pos || (sl.p && sl.p.slot);
        if (sl.p) {
          sl.role = suggestRole(sl.p, pos);
          const r = window.findRole && findRole(sl.role);
          sl.focus = (r && r.foci.indexOf('bal') !== -1) ? 'bal' : (r ? r.foci[0] : 'bal');
        }
      });
      renderAll();
      pmToast('Funções sugeridas pelo perfil dos jogadores');
    }
    else if (act === 'save') {
      const nome = prompt('Nome da tática:'); if (!nome) return;
      const t = loadTactics();
      t[nome] = { form: (window.G && G.formKey) || null, varIdx: G.varIdx || 0, slots: L.map(sl => ({ role: sl.role, focus: sl.focus })) };
      persistTactics(t); pmToast('Tática "' + nome + '" salva');
    }
    else if (act === 'load') {
      const t = loadTactics(); const names = Object.keys(t);
      if (!names.length) { pmToast('Nenhuma tática salva ainda'); return; }
      const nome = prompt('Carregar qual tática?\n\n• ' + names.join('\n• '), names[names.length-1]);
      if (!nome || !t[nome]) return;
      if (t[nome].form && FORMATIONS[t[nome].form]) {
        formSelect.value = t[nome].form;
        const savedVi = clamp(t[nome].varIdx || 0, 0, FORMATIONS[t[nome].form].variations.length - 1);
        fillVariationOptions(t[nome].form, savedVi);
        applyFormation(t[nome].form, savedVi);
      }
      t[nome].slots.forEach((sv, i) => {
        if (L[i]) {
          L[i].role = roleFitsPos(sv.role, L[i].pos) ? sv.role : defaultRoleFor(L[i].pos);
          const rr = findRole(L[i].role);
          L[i].focus = rr && rr.foci.indexOf(sv.focus) !== -1 ? sv.focus : (rr && rr.foci.indexOf('bal') !== -1 ? 'bal' : (rr ? rr.foci[0] : 'bal'));
        }
      });
      selIdx = 0;
      renderAll();
      pmToast('Tática "' + nome + '" aplicada');
    }
  });

  fillVariationOptions(G.formKey, G.varIdx || 0);
  renderAll();
}
function open() {
  const cup = G.cup, db = G.db;
  myMatch = CUP.playerMatchOfRound(cup);
  if (!myMatch) { window.UI.go('cup'); return; }
  /* TÁTICAS · na primeira entrada abrimos a tela dedicada de escalação/
     táticas; ao tocar "Iniciar", ela marca a flag e reentra em open(), que
     dessa vez monta a partida com as funções escolhidas (já em G.lineup). */
  if (!open._ready) {
    const oppSid0 = (myMatch.h === cup.playerSid ? myMatch.a : myMatch.h);
    const oppName0 = (db.byId[oppSid0] && db.byId[oppSid0].c) || 'Adversário';
    openPreMatch(oppName0, function () { open._ready = true; open(); });
    return;
  }
  open._ready = false;
  isKO = cup.phase !== 'groups';
  mySide = myMatch.h === cup.playerSid ? 0 : 1;

  const oppSid = mySide === 0 ? myMatch.a : myMatch.h;
  const opp = CUP.teamFor(db, oppSid, 'ME');
  // cor do adversário: evita ouro (cor do jogador)
  const oppColors = ['#2e9bff','#e84040','#9b59b6','#1abc9c','#e67e22'];
  const sidHash = String(oppSid).split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  opp.color = oppColors[sidHash % oppColors.length];

  const me = { squad: db.byId.ME, name: db.byId.ME.c, flag: '⭐', color: '#ffcb45',
    lineup: G.lineup, bench: G.bench.slice(), style: G.style, axes: G.axes };

  const A = mySide === 0 ? me : opp;
  const B = mySide === 0 ? opp : me;
  teamColors = [A.color, B.color];

  feed=[]; finished=false; tab='campo'; acc=0; lastT=0; paused=false;
  trailPts=[]; goalFlash=null; celebration=null; replay=null; replayBuf=[]; penScene=null; fkScene=null; setPieceRequest=null; shootoutState=null; breakOv=null; slowmo=null; latestEvent=null; minorCd=0; statsT=0; momHist=[]; momT=0; keyEvents=[]; playerMotions=[];
  endOfPlay._done = false;
  fastForwardFullTime._done = false;  /* PONTO 4: novo jogo, nova janela de compressão */
  camX = 320; camY = 207;

  sim = new MatchSim(A, B, { onEvent, onSetPiece: openSetPieceMinigame });
  sim.setInteractive(mySide);
  render(A, B);
  playUXSound('start');
  startLoop();
}

/* ─── EVENTOS ─────────────────────────────────────────────────────────── */
function fxAt(p, type, ttl) {
  if (!p) return;
  vfx.push({ type, x: p.x/105, y: p.y/68, ttl: ttl||0.9, max: ttl||0.9 });
  if (vfx.length > 8) vfx.shift();
}
function motionAt(p, type, duration, dir) {
  const id = p && p.ref && p.ref.id; if (!id) return;
  const now = performance.now(), ms = (duration || 0.8) * 1000;
  playerMotions = playerMotions.filter(m => m.id !== id && m.until > now);
  playerMotions.push({ id, type, dir: dir || 0, start: now, until: now + ms });
  if (playerMotions.length > 10) playerMotions.shift();
}
function activeMotion(p, now) {
  const id = p && p.ref && p.ref.id; if (!id) return null;
  return playerMotions.find(m => m.id === id && m.until > now) || null;
}
function zoneOf(p) {
  const y = p.y/68;
  return y < 0.36 ? ' pela esquerda' : y > 0.64 ? ' pela direita' : ' pelo meio';
}

// ═══ eixos segmentados (§item4) — cópia local (arquivos autocontidos) ═══
const AXES_DEF = [
  {k:'line',name:'Linha defensiva',lo:'Baixa',hi:'Alta'},
  {k:'press',name:'Pressão',lo:'Contida',hi:'Intensa'},
  {k:'width',name:'Largura',lo:'Compacto',hi:'Aberto'},
  {k:'tempo',name:'Ritmo',lo:'Cadenciado',hi:'Direto'},
  {k:'posture',name:'Postura',lo:'Retranca',hi:'Ofensivo'}
];
const AX_STEPS = [0,25,50,75,100];
function axesSegHtml(axes) {
  return AXES_DEF.map(a => {
    const v = axes[a.k];
    const near = AX_STEPS.reduce((b,s)=>Math.abs(s-v)<Math.abs(b-v)?s:b, 0);
    return `<div style="margin-bottom:11px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;color:#9fb0c8;margin-bottom:4px">
        <span>${a.lo}</span><span style="color:#e8edf7;font-weight:700">${a.name}</span><span>${a.hi}</span>
      </div>
      <div data-ax="${a.k}" style="display:flex;gap:5px">
        ${AX_STEPS.map(s=>`<button class="axseg" data-v="${s}" style="flex:1;height:30px;border-radius:8px;border:1.5px solid ${s===near?'#ffcb45':'rgba(255,255,255,.14)'};background:${s===near?'#ffcb45':'rgba(255,255,255,.05)'};cursor:pointer;transition:all .12s"></button>`).join('')}
      </div>
    </div>`;
  }).join('');
}
function bindAxesSeg(root, getAxes, onChange) {
  root.querySelectorAll('[data-ax]').forEach(seg => {
    seg.querySelectorAll('.axseg').forEach(b => b.onclick = () => {
      const axes = getAxes();
      axes[seg.dataset.ax] = +b.dataset.v;
      seg.querySelectorAll('.axseg').forEach(x => {
        const on = x === b;
        x.style.border = `1.5px solid ${on?'#ffcb45':'rgba(255,255,255,.14)'}`;
        x.style.background = on ? '#ffcb45' : 'rgba(255,255,255,.05)';
      });
      onChange(axes);
    });
  });
}

/* =================== MINIGAME DE BOLA PARADA ==========================
   A mira define direção; puxar a bola para trás define força; o deslocamento
   lateral do gesto aplica curva. Atributos e pressão ainda determinam o cone
   de erro, portanto habilidade ajuda sem transformar toda cobrança em gol. */
/* A câmera muda a lente conforme distância e orientação. Em retrato o canvas
   é recortado nas laterais, então o gol usa uma abertura menor em coordenadas
   internas para continuar inteiro e proporcional dentro da faixa visível. */
/* ============================================================================
   PONTO 1c · CÂMERA REBAIXADA + BARREIRA EM PROFUNDIDADE — spPerspective()
   ============================================================================
   Modelo mental da cena (pseudo-3D): a "câmera" fica atrás da bola; o eixo Y
   da tela codifica profundidade (quanto MENOR o y, mais LONGE o objeto). Três
   grandezas controlam a lente:
     · horizon — a linha onde o gramado encontra a arquibancada. Numa câmera
       real, o horizonte fica na ALTURA DO OLHO. Abaixar a câmera até o nível
       da grama comprime brutalmente a faixa de gramado visível: por isso o
       horizon DESCEU (205→248 retrato, 198→240 paisagem). Menos grama entre a
       bola e o gol = sensação física de estar agachado atrás da bola.
     · goalY — o gol agora é ANCORADO ao novo horizonte (base do gol ≈ linha
       do horizonte) em vez de flutuar em constantes soltas. Com a câmera mais
       baixa, gol e barreira dividem a mesma faixa vertical — e é exatamente
       essa sobreposição que faz a barreira "engolir" a boca do gol.
     · wallY — profundidade da barreira. O deslocamento a partir da bola subiu
       de 61/70 px para 96/116 px: a barreira RECUOU no eixo de profundidade
       (mais perto do gol, mais longe do cobrador), como pedido.
   POR QUE ISSO A DEIXA MAIS ALTA SEM MEXER NA ESCALA: os sprites da barreira
   mantêm o MESMO tamanho de antes (fórmulas de gkScale/wallScale intocadas),
   porém agora estão desenhados mais fundo na cena — onde a perspectiva
   "esperaria" figuras menores. Tamanho igual em profundidade maior = objeto
   percebido como MAIOR. Somado ao horizonte baixo, as cabeças da barreira
   passam a alcançar a região da trave: a parede fica imponente na visão do
   cobrador, sem alterar um único fator de escala.
   ============================================================================ */
function spPerspective(scene){
  const portrait=!!(window.matchMedia&&window.matchMedia('(max-width:700px) and (orientation:portrait)').matches);
  const dist=clamp(+(scene&&scene.dist)||((scene&&scene.mode==='shootout')?11:24),11,32);
  const penalty=dist<=12.5||(scene&&scene.mode==='shootout');
  const goalW=portrait
    ? (penalty?310:clamp(246-(dist-18)*3.3,205,248))
    : (penalty?570:clamp(470-(dist-18)*9.6,335,472));
  const goalH=goalW/3;
  /* CÂMERA MAIS BAIXA: horizonte desce → faixa de gramado encolhe. */
  const horizon=portrait?248:240;
  /* Gol ancorado ao horizonte (base do gol ~8/10 px acima da linha). O clamp
     inferior (26) impede o travessão de sair da tela nos pênaltis paisagem. */
  const goalY=clamp(horizon-goalH-(portrait?8:10),26,horizon-40);
  const goal={x:(CW-goalW)/2,y:goalY,w:goalW,h:goalH};
  const ballY=portrait?360:374;
  /* BARREIRA MAIS PROFUNDA (eixo de profundidade = Y de tela): offset da bola
     sobe 61→96 (retrato) e 70→116 (paisagem). O multiplicador por distância
     continua idêntico — faltas de longe ainda afastam a parede um pouco mais. */
  const wallY=ballY-(portrait?96:116)*clamp(1+(dist-24)*.008,.95,1.06);
  /* ESCALAS INALTERADAS — exigência do Ponto 1c: o tamanho dos bonecos da
     barreira e do goleiro é rigorosamente o mesmo de antes do refactor. */
  const gkScale=goal.h*.77/47;
  const wallScale=gkScale*clamp(1.26+(dist-18)*.018,1.26,1.52);
  return {
    portrait,dist,penalty,goal,ballY,horizon,wallY,gkScale,wallScale,
    takerScale:clamp(wallScale*1.08,portrait?2.05:3.0,portrait?3.05:4.25),
    ballR:portrait?7.6:11,
    targetBallR:clamp(goal.h*.044,3.2,6.8),
    vanishX:CW*.5
  };
}
function spGoalRect(scene) { return spPerspective(scene).goal; }
function spSceneBall(scene) {
  const view=spPerspective(scene);
  const baseX=scene&&scene.ballX!=null?scene.ballX:CW*.5;
  /* PONTO 1b · TREMOR DE TENSÃO: acima de 50% de força a bola puxada vibra em
     alta frequência (senos dessincronizados em X/Y), com amplitude que cresce
     até ~3,5 px no máximo. É feedback tátil-visual: o jogador SENTE o elástico
     no limite antes mesmo de olhar a barra de força. Abaixo de 50%, zero
     jitter — a mira fina em força baixa continua estável. */
  const t=scene&&scene.drag?clamp(scene.power||0,0,1):0;
  const j=t>.5?(t-.5)*7:0;
  const now=j?performance.now():0;
  return {
    x:baseX + ((scene.pull&&scene.pull.x)||0) + (j?Math.sin(now/23)*j:0),
    y:view.ballY + ((scene.pull&&scene.pull.y)||0) + (j?Math.cos(now/19)*j*.7:0)
  };
}
function spCanvasPoint(ev) {
  const cv=$('#fieldcv'), r=cv.getBoundingClientRect();
  return { x:(ev.clientX-r.left)*CW/r.width, y:(ev.clientY-r.top)*CH/r.height };
}
function spUpdateHud(scene) {
  const fill=$('.sp-power-fill'); if(fill) fill.style.width=Math.round((scene.power||0)*100)+'%';
  const pv=$('#sp-power-v'); if(pv) pv.textContent=Math.round((scene.power||0)*100)+'%';
  const cv=$('#sp-curve-v'); if(cv) cv.textContent=Math.abs(scene.curve||0)<.08?'RETA':scene.curve<0?'ESQUERDA':'DIREITA';
  document.querySelectorAll('.sp-curve').forEach(b=>b.classList.toggle('on',Math.sign(+b.dataset.curve)===Math.sign(scene.curve||0) && (Math.abs(+b.dataset.curve)<.1)===(Math.abs(scene.curve||0)<.1)));
}
function setPieceHud(req, scene) {
  const host=$('#setpiece-ui'); if(!host)return;
  const isFk=req.kind==='freekick';
  const name=esc((req.taker&&req.taker.ref?req.taker.ref:req.taker).n||'Cobrador');
  const title=req.training?'DESAFIO DE FALTAS':(isFk?'FALTA PERIGOSA':'PÊNALTI');
  const detail=isFk&&req.dist?' · '+Math.round(req.dist)+' METROS':'';
  /* PONTO 1b · VENTO NO HUD: cada falta sorteia um vento lateral (criado em
     openSetPieceMinigame). Ele é exibido aqui com direção e intensidade para
     que o cobrador possa COMPENSAR a curva conscientemente — o vento desloca
     a bola no ar (spEffectiveCurve) e, sem o alvo na tela, esta leitura é a
     única pista numérica que o jogador recebe. */
  const wind=isFk&&scene&&scene.wind?(' · VENTO '+(scene.wind.dir<0?'⟵ ':'⟶ ')+scene.wind.kmh+' KM/H'):'';
  const angle=req.training&&req.sideLabel?' · '+req.sideLabel.toUpperCase():'';
  const badge=req.training?`COBRANÇA ${req.round}/${req.total}`:'MIRE · PUXE · SOLTE';
  host.innerHTML=`<div class="setpiece-ui ${req.training?'is-training':''}">
    <div class="sp-top">
      <div><div class="sp-title">${title}</div><div class="sp-sub">${name}${detail}${angle}${wind}</div></div>
      <div class="sp-badge">${badge}</div>
    </div>
    <div class="sp-bottom">
      <div class="sp-card">
        <div class="sp-label"><span>Curva</span><span id="sp-curve-v">RETA</span></div>
        <div class="sp-curves"><button class="sp-curve" data-curve="-.72" aria-label="Curva para a esquerda"><span class="sp-curve-icon">↶</span><span class="sp-curve-text">ESQ.</span></button><button class="sp-curve on" data-curve="0" aria-label="Chute reto"><span class="sp-curve-icon">•</span><span class="sp-curve-text">RETA</span></button><button class="sp-curve" data-curve=".72" aria-label="Curva para a direita"><span class="sp-curve-icon">↷</span><span class="sp-curve-text">DIR.</span></button></div>
      </div>
      <div class="sp-card">
        <div class="sp-label"><span>Força</span><span id="sp-power-v">0%</span></div>
        <div class="sp-power-track"><div class="sp-power-fill"></div></div>
        <button class="sp-shoot" id="sp-shoot"><span class="sp-shoot-main">SEGURE PARA CARREGAR</span><span class="sp-shoot-sub">solte para chutar</span></button>
        <div class="sp-hint">Segure a bola e puxe para trás: distância = força, ângulo = curva. O vento indicado acima desvia a bola no ar — compense a mira.</div>
      </div>
    </div>
  </div>`;
  bindSetPieceGesture(req,scene);
}
function bindSetPieceGesture(req,scene){
  const cv=$('#fieldcv'); if(!cv)return;
  cv.classList.add('sp-active');
  const goal=spGoalRect(scene);
  const setAim=pt=>{
    scene.aimX=clamp((pt.x-goal.x)/goal.w,.04,.96);
    scene.aimY=clamp((pt.y-goal.y)/goal.h,.05,.96);
  };
  const down=ev=>{
    if(!setPieceRequest||scene.phase!=='aim')return;
    const pt=spCanvasPoint(ev), ball=spSceneBall(scene);
    if(Math.hypot(pt.x-ball.x,pt.y-ball.y)<86){
      scene.drag={id:ev.pointerId,start:pt}; scene.pull={x:0,y:0}; scene.power=0;
      try{cv.setPointerCapture(ev.pointerId);}catch(_){}
    }else if(pt.x>=goal.x&&pt.x<=goal.x+goal.w&&pt.y>=goal.y&&pt.y<=goal.y+goal.h) setAim(pt);
    spUpdateHud(scene); ev.preventDefault();
  };
  /* ==========================================================================
     PONTO 1b · DRAG-TO-SHOOT COM VETOR DE FORÇA REAL
     ==========================================================================
     O modelo antigo somava pixels de forma linear (dy + |dx|*0.18)/112 — isso
     misturava força e curva no mesmo número, tinha teto artificial em 105/125
     px e respondia igual em qualquer tamanho de tela. O modelo novo trata o
     arraste como um VETOR de verdade:
       · magnitude  = hypot(dx, dy_para_trás)  → FORÇA
       · ângulo     = atan2(dx, dy_para_trás)  → CURVA (0 rad = puxão reto)
     Detalhes de calibração, na ordem em que aparecem no código:
       1. DEAD (10 px): zona morta — micro-tremores do dedo não armam o chute.
       2. REF adaptável (160 retrato / 205 paisagem, em unidades do canvas):
          o puxão "máximo" é proporcional ao espaço físico disponível; celular
          e desktop atingem 100% com o MESMO gesto relativo.
       3. smoothstep + expoente 0.82: resposta suave no início (mira fina de
          força baixa) e progressiva no fim, sem o "degrau" do modelo linear.
       4. Curva por ÂNGULO, não por dx bruto: puxar 30° para o lado dá a mesma
          curva num arraste curto ou longo — é a direção que manda. O fator
          clamp(mag/70) apenas exige um gesto mínimo antes de girar a bola.
       5. ELÁSTICO (k = 260/(260+mag)): a bola exibida resiste ao dedo como uma
          banda de borracha — quanto mais longe, menor a fração do arraste que
          ela acompanha. Junto do tremor (spSceneBall) e do medidor visual
          (drawSpTension), a tensão fica evidente sem nenhum texto.
     ========================================================================== */
  const DEAD=10;
  const refLen=()=>spPerspective(scene).portrait?160:205;
  const move=ev=>{
    if(!scene.drag||scene.drag.id!==ev.pointerId)return;
    const pt=spCanvasPoint(ev);
    const dxRaw=pt.x-scene.drag.start.x;                 // componente lateral
    const backRaw=Math.max(0,pt.y-scene.drag.start.y);   // só PARA TRÁS arma o chute
    const mag=Math.hypot(dxRaw,backRaw);                 // módulo do vetor de força
    const REF=refLen();
    const lin=clamp((mag-DEAD)/(REF-DEAD),0,1);          // normaliza c/ zona morta
    const eased=lin*lin*(3-2*lin);                       // smoothstep
    scene.power=clamp(Math.pow(eased,.82),0,1);          // resposta perceptual
    const ang=Math.atan2(dxRaw,Math.max(backRaw,1));     // 0 = reto para trás
    if(mag>DEAD+4) scene.curve=clamp(ang/(Math.PI*.40),-1,1)*clamp(mag/70,0,1);
    const k=260/(260+mag);                               // constante do elástico
    scene.pull={x:clamp(dxRaw*k*.85,-120,120),y:clamp(backRaw*k*.85,0,118)};
    spUpdateHud(scene); ev.preventDefault();
  };
  const up=ev=>{
    if(!scene.drag||scene.drag.id!==ev.pointerId)return;
    scene.drag=null; scene.pull=null;
    const enough=scene.power>=.16;
    if(enough) commitSetPiece(req,scene); else {scene.power=0;spUpdateHud(scene);}
    ev.preventDefault();
  };
  cv.onpointerdown=down; cv.onpointermove=move; cv.onpointerup=up; cv.onpointercancel=up;
  document.querySelectorAll('.sp-curve').forEach(b=>b.onclick=()=>{scene.curve=+b.dataset.curve;spUpdateHud(scene);});
  const bt=$('#sp-shoot');
  if(bt){
    let start=0,active=false;
    const tick=now=>{if(!active)return;scene.power=clamp((now-start)/1150,0,1);spUpdateHud(scene);spChargeRAF=requestAnimationFrame(tick);};
    const begin=ev=>{if(scene.phase!=='aim')return;active=true;start=performance.now();cancelAnimationFrame(spChargeRAF);spChargeRAF=requestAnimationFrame(tick);ev.preventDefault();};
    const release=ev=>{if(!active)return;active=false;cancelAnimationFrame(spChargeRAF);if(scene.power>=.16)commitSetPiece(req,scene);else{scene.power=0;spUpdateHud(scene);}ev.preventDefault();};
    bt.onpointerdown=begin; bt.onpointerup=release; bt.onpointercancel=release; bt.onpointerleave=ev=>{if(active)release(ev);};
  }
}
function clearSetPieceControls(){
  cancelAnimationFrame(spChargeRAF);
  const host=$('#setpiece-ui');if(host)host.innerHTML='';
  const cv=$('#fieldcv');if(cv){cv.classList.remove('sp-active');cv.onpointerdown=cv.onpointermove=cv.onpointerup=cv.onpointercancel=null;}
}
function commitSetPiece(req,scene){
  if(scene.phase!=='aim')return;
  scene.phase='locked';
  clearSetPieceControls();
  setPieceRequest=null;
  const late=sim?clamp((sim.minute-75)/45,0,1):0;
  /* PONTO 1b · O motor de resolução recebe a CURVA EFETIVA (curva do jogador
     + desvio do vento). Assim o vento não é só cosmético: ele muda de fato o
     ponto de chegada calculado por resolveFreeKickPhysics, na mesma proporção
     em que a trajetória desenhada se desloca (spFlightPoint usa a MESMA
     função). Visual e física ficam permanentemente sincronizados. */
  req.resolve({aimX:scene.aimX,aimY:scene.aimY,power:scene.power,curve:spEffectiveCurve(scene),pressure:clamp((req.pressure||0)+late*(isKO?.18:.05),0,1)});
}
function openSetPieceMinigame(req){
  const app=$('#app');if(app)app.classList.remove('match-panel-open');
  setPieceRequest=req;
  const taker=req.taker&&req.taker.ref?req.taker.ref:req.taker;
  const defTeam=req.team==null?1-mySide:1-req.team;
  const scene={
    mode:req.kind==='shootout'?'shootout':'live', interactive:true, phase:'aim', t:0,
    shooter:taker?taker.n:'Cobrador', taker:taker, color:sim&&sim.teams[req.team||0]?sim.teams[req.team||0].color:'#ffcb45',
    defColor:sim&&sim.teams[defTeam]?sim.teams[defTeam].color:'#e84040',
    gkName:req.gk&&req.gk.ref?req.gk.ref.n:'Goleiro', result:null, aimX:.5, aimY:.42,
    power:0, curve:0, gkDir:0, pull:null, dist:req.dist||11, wallN:req.kind==='freekick'?(req.dist<20?5:req.dist<25?4:3):0,
    /* CENTRALIZAÇÃO DA FALTA: a cena de cobrança é uma composição
       cinematográfica própria — bola, barreira, goleiro e gol pertencem ao
       MESMO eixo vertical (CW/2). Antes, um ballX deslocado (vindo do treino)
       quebrava essa simetria e, no retrato — onde o CSS recorta as laterais
       do canvas —, empurrava a bola para fora do quadro visível. Agora o eixo
       é fixo no centro; o LADO da falta continua existindo como informação
       (rótulo no HUD) e como física (curva/vento), só não desloca a câmera. */
    ballX:CW*.5, until:Infinity,
    /* PONTO 1b · VENTO POR COBRANÇA (mantido influenciando a curva):
       · dir   → -1 sopra p/ esquerda, +1 p/ direita (sorteio 50/50);
       · force → 0..0.9, intensidade contínua;
       · kmh   → leitura amigável exibida no HUD (4 a ~26 km/h).
       Pênaltis e shootout ficam com wind=null: distância curta demais para o
       vento importar, e o duelo 1x1 deve continuar puramente psicológico. */
    wind:req.kind==='freekick'?(function(){
      const dir=Math.random()<.5?-1:1;
      const force=Math.random()*.9;
      return { dir, force, kmh: Math.round(4+force*24) };
    })():null,
    tension:0
  };
  if(req.kind==='freekick')fkScene=scene;else penScene=scene;
  setPieceHud(req,scene);
}

function onEvent(e) {
  // REAÇÕES TÁTICAS DO OPONENTE (§FM): o jogador VÊ o rival ajustar
  if (e.type === 'ai_shape') { const nm = clip(sim.teams[e.team].name||sim.teams[e.team].squad.c, 14); latestEvent = { txt: `🔄 <b>${esc(nm)}</b> mudou para ${e.form} ${e.why==='chasing'?'(vai pra cima!)':'(fecha atrás)'}`, min: Math.floor(sim.minute) }; }
  if (e.type === 'ai_sub') { const nm = clip(sim.teams[e.team].name||sim.teams[e.team].squad.c, 14); latestEvent = { txt: `🔁 <b>${esc(nm)}</b> faz mudança ofensiva`, min: Math.floor(sim.minute) }; }
  if (e.type === 'gk_bad_distribution') latestEvent = { txt:`⚠️ <b>${esc(lastWord(e.by.ref.n,14))}</b> se complica na saída de bola!`, min:Math.floor(sim.minute) };
  if (e.type === 'gk_sweep') latestEvent = { txt:`🧤 <b>${esc(lastWord(e.gk.ref.n,14))}</b> sai da área e corta a bola em profundidade!`, min:Math.floor(sim.minute) };
  if (e.type === 'defensive_error') latestEvent = { txt:`⚠️ <b>${esc(lastWord(e.by.ref.n,14))}</b> perde a referência defensiva!`, min:Math.floor(sim.minute) };
  if (e.type === 'low_cross_shot') latestEvent = { txt:`⚡ Cruzamento rasteiro para <b>${esc(lastWord(e.by.ref.n,14))}</b> finalizar!`, min:Math.floor(sim.minute) };
  // ADAPTAÇÃO CONTEXTUAL: mudanças de plano entram na narração e no feed,
  // sem duplicar os eventos comuns processados mais abaixo.
  if (e.type === 'tactical_shift') {
    const tm = sim.teams[e.team];
    const nm = clip(tm.name || tm.squad.c, 16);
    const who = e.team === mySide ? 'Seu time' : esc(nm);
    const txt = `✦ <b>${who}</b>: ${esc(e.label)} — ${esc(e.reason)}`;
    const min = Math.floor(sim.minute);
    feed.unshift({ min, txt, imp: true, team: e.team!=null ? e.team : null });
    if (feed.length > 80) feed.pop();
    latestEvent = { txt, min };
    updateNarr();
    paintAdaptiveLive();
    return;
  }
  // COERÊNCIA do pênalti (§item5): fixa o pulo do goleiro assim que o resultado
  // chega — no TOPO, antes do processamento pesado de gol, pra nunca ficar solto.
  if (penScene && penScene.mode==='live' && penScene.result===null) {
    if (e.type === 'goal') { penScene.result='goal'; penScene.gkDir = -penScene.dir; }
    else if (e.type === 'pen_miss') {
      penScene.result = e.saved ? 'save' : 'miss';
      penScene.gkDir = e.saved ? penScene.dir : -penScene.dir;
    }
  }
  // TIMELINE FM: eventos-chave viram chips tocáveis
  if (e.type==='goal'||e.type==='yellow'||e.type==='red'||e.type==='sub'){
    const ic=e.type==='goal'?'⚽':e.type==='yellow'?'🟨':e.type==='red'?'🟥':'🔁';
    const side=e.by?e.by.team:(e.team!=null?e.team:0);
    const nm=e.by&&e.by.ref?lastWord(e.by.ref.n,10):'';
    keyEvents.push({min:Math.floor(sim.minute),ic,side,txt:(nm?nm+' ':'')+e.type});
    paintTimeline();
  }
  // narração de construção (throttled) + efeitos visuais por lance
  if (e.type === 'pass') {
    if (passNarrCd <= 0 && Math.random() < 0.6) {
      passNarrCd = 6.5;
      const a = esc(lastWord(e.by.ref.n, 12)), b = esc(lastWord(e.to.ref.n, 12));
      latestEvent = { txt: pick(PASS_NARR)(a, b, zoneOf(e.to)), min: Math.floor(sim.minute) };
      updateNarr();
    }
    return;
  }
  if (e.type === 'dribble' && e.by) { fxAt(e.by, 'ring', 0.7); fxAt(e.by, 'dust', 0.6);
    if (e.flair && e.move) { const nm = e.by.ref ? lastWord(e.by.ref.n, 12) : ''; latestEvent = { txt: `✨ <b>${esc(nm)}</b> — ${e.move}!`, min: Math.floor(sim.minute) }; }
  }
  if (e.type === 'tackle' && e.by) fxAt(e.by, 'star', 0.7);
  if (e.type === 'intercept' && e.by) fxAt(e.by, 'cut', 0.6);
  if (e.type === 'foul' && e.on) { fxAt(e.on, 'foul', 1.1); playUXSound('foul'); }
  if (e.type === 'save' && e.gk) {
    fxAt(e.gk, 'save', 0.9);
    motionAt(e.gk, 'dive', 0.9, (sim.ball.y - e.gk.y) >= 0 ? 1 : -1);
  }
  if (e.type === 'gk_claim' && e.gk) { fxAt(e.gk, 'save', 0.9); motionAt(e.gk, 'claim', 0.85); }
  if (e.type === 'gk_claim_miss' && e.gk) motionAt(e.gk, 'claim', 0.8);
  if (e.type === 'post') fxAt({ x: sim.ball.x, y: sim.ball.y }, 'post', 0.9);
  if (e.type === 'blocked') fxAt({ x: sim.ball.x, y: sim.ball.y }, 'block', 0.7);
  if (e.type === 'cross' && e.by) fxAt(e.by, 'arrow', 0.7);
  if (e.type === 'shot_taken' && e.by) fxAt(e.by, 'ring', 0.5);   // #impacto: anel de força no chute
  if (e.type === 'run_break' && e.by) fxAt(e.by, 'arrow', 0.5);   // infiltração: seta de movimento
  if (e.type === 'header_clear' && e.by) { fxAt(e.by, 'head', 0.6); motionAt(e.by, 'jump', 0.68); }
  if (e.type === 'corner' && e.by) fxAt(e.by, 'corner', 1.15);
  if (e.type === 'miss' && e.by) fxAt(e.by, 'miss', 0.8);
  if (e.type === 'yellow' && e.p) fxAt(e.p, 'card', 1.2);
  if (e.type === 'red' && e.p) fxAt(e.p, 'redcard', 1.4);
  if (e.type === 'legend' && e.by) fxAt(e.by, 'fire', 1.6);

  // artilharia da copa
  if (e.type === 'goal' && e.by) {
    const sid = e.by.team === 0 ? myMatch.h : myMatch.a;
    const key = sid + ':' + e.by.ref.n;
    const sc = G.cup.scorers;
    (sc[key] = sc[key] || { n: e.by.ref.n, sid, gols: 0 }).gols++;
    goalFlash = { team: e.by.team, alpha: 1.0 };
    // Comemoração: sempre exibida, independente da velocidade do jogo.
    // O replay só aparece se houver frames gravados; caso contrário vai direto para confete.
    // A duração mínima é 2800ms para garantir que o overlay seja visível mesmo em TURBO.
    const H = G.db.byId[myMatch.h], A = G.db.byId[myMatch.a];
    const isMine = (e.by.team === mySide);
    // A cena dedicada já é o replay da bola parada. Reusar o buffer do campo
    // mostrava, depois do gol, uma jogada anterior que não continha a cobrança.
    const setPieceGoal = !!(fkScene || penScene);
    const hasReplay = setPieceGoal ? false : startReplay();
    if (setPieceGoal) replay = null;
    const now0 = performance.now();
    // A cena da cobrança vem primeiro; replay e comemoração começam depois dela,
    // em vez de expirarem escondidos atrás da falta ou do pênalti.
    const sceneUntil = Math.max(fkScene ? fkScene.until : 0, penScene ? penScene.until : 0);
    const celebStart = Math.max(now0, sceneUntil ? sceneUntil + 120 : now0);
    const replayMs = hasReplay ? 3400 : 0;
    const celebDur = Math.max(2800, replayMs + 2400);  // mínimo 2.8s de comemoração
    celebration = {
      scorer: e.by.ref.n, team: e.by.team, color: sim.teams[e.by.team].color,
      min: Math.floor(sim.minute), mine: isMine,
      hName: H.c, aName: A.c,
      start: celebStart,
      replayUntil: celebStart + replayMs,
      until: celebStart + celebDur,
      confetti: makeConfetti(e.by.team === 0),
    };
  }
  // INTERVALO/PRORROGAÇÃO: pausa dramática com troca de lados
  if (e.type === 'halftime') breakOv = { t1:'INTERVALO', t2:'Os times trocam de lado', until: performance.now() + 2400 };
  if (e.type === 'extratime') breakOv = { t1:'PRORROGAÇÃO', t2:'Mais 30 minutos — troca de lado', until: performance.now() + 2400 };
  if (e.type === 'et_halftime') breakOv = { t1:'2º TEMPO DA PRORROGAÇÃO', t2:'Última troca de lado', until: performance.now() + 2000 };

  // SLOW-MO: chute perigoso ganha câmera lenta ("mostra que é gol")
  if (e.type === 'shot_taken' && e.xg >= 0.28) slowmo = { until: performance.now() + 750, f: 0.38 };

  // #6/#17 — ÁUDIO CONTEXTUAL: sons nos momentos-chave (o jogo era mudo)
  if (e.type === 'shot_taken') playUXSound('kick');
  if (e.type === 'goal') playUXSound('goal');
  if (e.type === 'penalty' || e.type === 'freekick') playUXSound('penalty');
  if (e.type === 'halftime' || e.type === 'et_halftime') playUXSound('whistle');

  // CABECEIO AO VIVO: câmera lenta + destaque
  if (e.type === 'header_shot' && e.by) {
    slowmo = { until: performance.now() + 650, f: 0.4 };
    fxAt(e.by, 'star', 0.9); motionAt(e.by, 'jump', 0.72);
  }

  // CENA DE FALTA: anima exatamente o resultado resolvido pelo motor.
  if (e.type === 'fk_scene' && e.by) {
    const wallN = e.dist < 20 ? 5 : e.dist < 25 ? 4 : 3;
    const vis=e.visual||{};
    const curve = vis.curve!=null?vis.curve:(Math.random()<.5?-.55:.55);
    const actualX=vis.actualX!=null?vis.actualX:(curve<0?.25:.75);
    const shotDir=actualX<.5?-1:1;
    const gkDir = e.result === 'save' ? shotDir : -shotDir;
    fkScene = {
      taker: e.by.ref.n, color: sim.teams[e.by.team].color,
      defColor: sim.teams[e.defTeam].color, gkName: e.gk ? e.gk.ref.n : 'Goleiro',
      result: e.result, wallN, dist: e.dist,
      phase: 'set', t: 0, curve, gkDir, aimX:vis.aimX==null?.5:vis.aimX,
      aimY:vis.aimY==null?.46:vis.aimY, actualX, actualY:vis.actualY==null?.48:vis.actualY,
      power:vis.power==null?.72:vis.power, execution:vis.execution==null?.7:vis.execution,
      until: performance.now() + 4300,
    };
  }

  // CENA DE PÊNALTI durante o jogo (falta na área): anima a cobrança
  if (e.type === 'penalty' && e.by) {
    const attTeam = e.by.team;
    const gkP = sim.teams[1-attTeam].players.find(p=>p.isGK && !p.red);
    const vis=e.visual||{};
    const actualX=vis.actualX==null?R(.18,.82):vis.actualX;
    const dir = actualX<.5?-1:1;
    penScene = {
      mode: 'live', shooter: e.by.ref.n, color: sim.teams[attTeam].color,
      gkName: gkP ? gkP.ref.n : 'Goleiro', phase: 'set', t: 0,
      dir, gkDir: dir, result: null, aimX:vis.aimX==null?.5:vis.aimX,
      aimY:vis.aimY==null?.48:vis.aimY, actualX, actualY:vis.actualY==null?.5:vis.actualY,
      power:vis.power==null?.72:vis.power, curve:vis.curve||0,
      execution:vis.execution==null?.7:vis.execution, until: performance.now() + 3900,
    };
  }
  // resultado chega: fixa o pulo do goleiro coerente (defesa=mesmo lado, gol=oposto)
  // (resultado do pênalti já resolvido no topo do onEvent — coerência §item5)

  const f = NARR[e.type];
  if (!f) return;
  if (MINOR.has(e.type)) { if (minorCd > 0) return; minorCd = 4; }
  const txt = f(e);
  if (!txt) return;
  const min = sim ? Math.floor(sim.getState().minute) : 0;
  const imp = ['goal','yellow','red','penalty','pen_miss','save','gk_claim','post','halftime','extratime','freekick','legend'].includes(e.type);
  const feedTeam = e.by ? e.by.team : (e.team!=null ? e.team : (e.p ? e.p.team : (e.gk ? e.gk.team : (e.on ? e.on.team : null))));
  feed.unshift({ min, txt, imp, team: feedTeam });
  if (feed.length > 80) feed.pop();
  // Gol: atualiza a narração imediatamente e bloqueia substituição por 8s
  if (e.type === 'goal') {
    latestEvent = { txt, min };
    updateNarr();
    updateScore();
    minorCd = 8;  // bloqueia eventos menores durante a comemoração
    if (tab === 'lances') paintTabBody();
    return;
  }
  latestEvent = { txt, min };
  updateNarr();
  if (tab === 'lances') paintTabBody();
}

/* ─── LOOP ────────────────────────────────────────────────────────────── */
function startLoop() {
  cancelAnimationFrame(raf);
  lastT = performance.now();
  const step = now => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    try {
    const penActive = (penScene && now < penScene.until) || (fkScene && now < fkScene.until) || (breakOv && now < breakOv.until);
    // Comemoração de gol: pausa o simulador completamente durante o overlay.
    // Isso garante que o placar e o nome do goleador fiquem visíveis em qualquer velocidade.
    const celebrating = celebration && now < celebration.until;
    /* PONTO 4 · DETECÇÃO DO FIM FORA DO GATE: sim.isOver() agora é consultado
       ANTES do bloqueio de overlays. No frame em que os 90'/120' se completam,
       fastForwardFullTime comprime tudo o que estiver na tela; ~850 ms depois
       os overlays expiram, o gate reabre e endOfPlay dispara. Sem isto, um gol
       no último lance segurava o cartão de resultado por 6–9 segundos. */
    const matchOver = !finished && sim && sim.isOver();
    if (matchOver) fastForwardFullTime(now);
    if (!finished && !paused && !celebrating && !penActive) {
      if (!matchOver) {
        acc += dt * (slowmo ? Math.min(G.speed, 1) * slowmo.f : G.speed);
        const h = 1/60; let g = 0;
        while (acc >= h && g++ < 500) {
          sim.step(h); acc -= h; minorCd = Math.max(0, minorCd - h);
        }
      } else {
        /* Jogo encerrado: zera o acumulador para o relógio não "vazar" passos
           extras de simulação enquanto os overlays finais se despedem. */
        acc = 0;
      }
      if (sim.isOver()) { endOfPlay(); /* sem overlays pendentes, o resultado entra na hora */ }
      // visual ticks
      recordSnapshot();
      trackTrail();
      if (goalFlash) goalFlash.alpha = Math.max(0, goalFlash.alpha - dt * 1.6);
      passNarrCd = Math.max(0, passNarrCd - dt * G.speed);
      for (const v of vfx) v.ttl -= dt * Math.min(G.speed, 2.5);
      vfx = vfx.filter(v => v.ttl > 0);
      statsT += dt;
      momT += dt;
      if (momT > 1.6 && sim) { momT = 0; momHist.push(sim.momentum||0); if (momHist.length>110) momHist.shift(); paintMom(); }
      if (statsT > 0.35) {
        statsT=0; updateStatsBar(); updateClock();
        stTick++;
        if (tab === 'stats' && stTick % 5 === 0) paintTabBody();      // stats ao vivo
        if ((tab === 'campo' || tab === 'adv') && stTick % 6 === 0) paintTabBody();  // visão geral / adversário ao vivo
        if (tab === 'tatica' && stTick % 3 === 0) paintAdaptiveLive(); // só o resumo contextual, sem recriar os controles
      }
    }
    if (penScene) {
      if (now >= penScene.until) penScene = null;
      else advancePenScene(dt);
    }
    if (fkScene) {
      if (now >= fkScene.until) fkScene = null;
      else advanceFkScene(dt);
    }
    if (breakOv && now >= breakOv.until) breakOv = null;
    if (slowmo && now >= slowmo.until) slowmo = null;
    playerMotions = playerMotions.filter(m => m.until > now);
    // após o fim, o loop segue só para animar overlays (shootout/comemoração)
    if (celebration) {
      if (now >= celebration.until) { celebration = null; replay = null; acc = 0; /* zera o acumulador para evitar salto de tempo */ }
      else if (now >= (celebration.start || 0)) {
        // durante a janela de replay, avança os frames (loop); depois, confete
        if (replay && now < celebration.replayUntil) {
          replay.idx += 36 * dt;   // equivalente a 0,6 frame a 60 Hz
          if (replay.idx >= replay.frames.length) replay.idx = 0;
        } else {
          replay = null;
          const frameScale = dt * 60;
          for (const c of celebration.confetti) {
            c.x += c.vx * frameScale; c.y += c.vy * frameScale;
            c.vy += 0.0002 * frameScale; c.spin += 0.15 * frameScale;
          }
        }
      }
    }
    paintField();                          // campo nunca congela (fix)
    } catch (err) { try { if (window.console) window.__cdsDebugWarn('frame recuperada:', err && err.message); } catch (_) {} }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

function advancePenScene(dt) {
  const ps = penScene; if (ps.phase === 'aim') return;
  ps.t += dt;
  /* PONTO 4: a pose parada de "preparação" caiu de 450 ms para 300 ms — corta
     tempo morto de TODA cena de pênalti (jogo e disputa) sem tocar na corrida
     nem no voo da bola, que são a parte legível da animação. */
  if (ps.phase==='set' && ps.t>.30) { ps.phase='run'; ps.t=0; }
  else if (ps.phase==='run' && ps.t>.52) { ps.phase='strike'; ps.t=0; playUXSound('kick'); }
  else if (ps.phase==='strike' && ps.t>.82) { ps.phase='result'; ps.t=0; }
}

function drawSpBackdrop(ctx,scene,view){
  const p=view||spPerspective(scene);
  const sky=ctx.createLinearGradient(0,0,0,p.horizon+72);
  sky.addColorStop(0,'#020711');sky.addColorStop(.55,'#0b1b31');sky.addColorStop(1,'#1b4a67');
  ctx.fillStyle=sky;ctx.fillRect(0,0,CW,p.horizon+80);

  // Arquibancada e luzes em planos separados para dar profundidade à câmera.
  ctx.fillStyle='#07101d';ctx.fillRect(0,p.horizon-116,CW,105);
  ctx.fillStyle='rgba(7,13,24,.82)';ctx.fillRect(0,p.horizon-50,CW,44);
  for(let i=0;i<128;i++){
    const x=(i*79)%CW,y=p.horizon-104+((i*43)%86);
    ctx.fillStyle=i%11===0?'rgba(255,220,132,.70)':i%5===0?'rgba(111,185,230,.42)':'rgba(172,193,220,.22)';
    ctx.fillRect(x,y,i%9===0?3:2,i%7===0?3:2);
  }
  const flood=ctx.createRadialGradient(CW*.5,p.horizon-95,8,CW*.5,p.horizon-95,CW*.52);
  flood.addColorStop(0,'rgba(195,229,255,.20)');flood.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=flood;ctx.fillRect(0,0,CW,p.horizon+120);

  const grass=ctx.createLinearGradient(0,p.horizon,0,CH);
  grass.addColorStop(0,'#17683a');grass.addColorStop(.42,'#105c32');grass.addColorStop(1,'#07391f');
  ctx.fillStyle=grass;ctx.fillRect(0,p.horizon,CW,CH-p.horizon);
  for(let i=0;i<12;i++){
    ctx.fillStyle=i%2?'rgba(255,255,255,.026)':'rgba(0,0,0,.055)';
    ctx.beginPath();ctx.moveTo(p.vanishX,p.horizon);ctx.lineTo(i*CW/12,CH);ctx.lineTo((i+1)*CW/12,CH);ctx.closePath();ctx.fill();
  }
  // Linhas transversais comprimidas perto do horizonte reforçam os metros.
  ctx.save();ctx.strokeStyle='rgba(227,242,235,.11)';ctx.lineWidth=1;
  for(let i=1;i<=5;i++){
    const t=i/5,y=p.horizon+(CH-p.horizon)*Math.pow(t,1.72);
    ctx.beginPath();ctx.moveTo(0,y);ctx.quadraticCurveTo(CW*.5,y-4,CW,y);ctx.stroke();
  }
  ctx.restore();
  const vignette=ctx.createRadialGradient(CW*.5,CH*.56,80,CW*.5,CH*.55,CW*.69);
  vignette.addColorStop(.58,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.42)');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,CW,CH);
}
function drawSpGoal(ctx,r,ripple){
  const wave=(ripple||0),post=Math.max(3.2,Math.min(6,r.h*.035));
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.y+r.h+8,r.w*.54,8+r.h*.03,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(210,235,246,.025)';ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='rgba(218,235,245,.28)';ctx.lineWidth=Math.max(.75,post*.22);
  for(let i=1;i<13;i++){
    const x=r.x+i*r.w/13,offset=Math.sin(i*.9+wave*7)*wave*r.h*.035;
    ctx.beginPath();ctx.moveTo(x,r.y);ctx.quadraticCurveTo(x+offset,r.y+r.h*.55,x-offset*.35,r.y+r.h);ctx.stroke();
  }
  for(let i=1;i<7;i++){
    const y=r.y+i*r.h/7,offset=Math.sin(i+wave*8)*wave*r.h*.025;
    ctx.beginPath();ctx.moveTo(r.x,y);ctx.quadraticCurveTo(r.x+r.w*.5,y+offset,r.x+r.w,y);ctx.stroke();
  }
  ctx.shadowColor='rgba(255,255,255,.6)';ctx.shadowBlur=7;ctx.strokeStyle='#f5f8fb';ctx.lineWidth=post;
  ctx.beginPath();ctx.moveTo(r.x,r.y+r.h);ctx.lineTo(r.x,r.y);ctx.lineTo(r.x+r.w,r.y);ctx.lineTo(r.x+r.w,r.y+r.h);ctx.stroke();
  ctx.shadowBlur=0;ctx.restore();
}
/* ============================================================================
   MELHORIA (goleiro/barreira) · drawSpFigure COM POSES INTERPOLÁVEIS
   ============================================================================
   A função ganhou um 8º parâmetro opcional `t` (0..1, default 1) e duas poses:
     · t — PROGRESSO da pose. Antes, 'dive' e 'jump' eram binários: o boneco
       TELETRANSPORTAVA da posição em pé para a rotação final do mergulho.
       Agora rotação, deslocamento e extensão dos braços interpolam com t,
       então o goleiro DESDOBRA o mergulho quadro a quadro e a barreira sobe
       e desce de verdade. Chamadas antigas (sem t) continuam idênticas.
     · 'ready' — postura de goleiro em prontidão: joelhos fletidos, tronco
       inclinado, braços abertos na altura da cintura e um quique contínuo
       nos calcanhares (senoide no relógio real). É o idle da fase de mira.
     · 'down' — atleta caído após o mergulho: corpo deitado (rotação ~90°),
       sombra alongada. Vende o peso da queda depois da defesa ou do gol.
   ============================================================================ */
function drawSpFigure(ctx,x,y,s,color,pose,flip,t){
  const now=performance.now(),run=Math.sin(now/82),dive=pose==='dive',kick=pose==='kick',jump=pose==='jump',ready=pose==='ready',down=pose==='down';
  const T=t==null?1:clamp(t,0,1);
  const kit=color||'#2e9bff',skin='#c78f6a',dark='#07111f';
  /* Sombra de contato: no ar (jump) ela encolhe/clareia com T; caído (down)
     ela se alonga sob o corpo inteiro. */
  ctx.save();ctx.fillStyle='rgba(0,0,0,'+(jump?(.28-.12*T):down?.34:.28)+')';ctx.beginPath();
  ctx.ellipse(x+(down?(flip?6:-6)*s*.9:0),y+2,(down?15:8.5-(jump?2.2*T:0))*s,2.25*s,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(x,y-(jump?2.7*s*T:0));ctx.scale((flip?-1:1)*s,s);
  if(dive){ctx.translate(0,-8*T);ctx.rotate(-Math.PI*.42*T);}          // mergulho progressivo
  if(down){ctx.translate(-7,4);ctx.rotate(-Math.PI*.5);}               // deitado no gramado
  if(ready){ctx.translate(0,1.4+Math.sin(now/150)*.8);ctx.rotate(Math.sin(now/560)*.03);} // quique + micro-balanço
  ctx.lineCap='round';ctx.lineJoin='round';

  // Pernas estreitas e articuladas deixam cada jogador legível mesmo quando
  // os ombros da barreira quase se encostam.
  let hipL=-3.1,hipR=3.1,kneeL=-3.8,kneeR=3.8,footL=-4.8,footR=4.8,footLY=9,footRY=9;
  if(pose==='run'){kneeL=-4-run*2.3;kneeR=4+run*2.3;footL=-5-run*5.5;footR=5+run*5.5;footLY=9-run;footRY=9+run;}
  if(kick){kneeR=7;footR=15;footRY=-1;}
  if(dive||down){kneeL=-7;kneeR=7;footL=-15+(down?2:(1-T)*8);footR=16-(down?2:(1-T)*9);footLY=4;footRY=3;}
  if(ready){kneeL=-5.4;kneeR=5.4;footL=-7;footR=7;footLY=8.4;footRY=8.4;} // base larga, joelhos fletidos
  ctx.strokeStyle=dark;ctx.lineWidth=2.8;ctx.beginPath();ctx.moveTo(hipL,-7);ctx.lineTo(kneeL,1);ctx.lineTo(footL,footLY);ctx.moveTo(hipR,-7);ctx.lineTo(kneeR,1);ctx.lineTo(footR,footRY);ctx.stroke();
  ctx.strokeStyle=kit;ctx.globalAlpha=.9;ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(kneeL,1);ctx.lineTo(footL,footLY-1);ctx.moveTo(kneeR,1);ctx.lineTo(footR,footRY-1);ctx.stroke();ctx.globalAlpha=1;
  ctx.strokeStyle='#02060c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(footL-1,footLY);ctx.lineTo(footL+3,footLY);ctx.moveTo(footR-1,footRY);ctx.lineTo(footR+3,footRY);ctx.stroke();

  ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-5.2,-14);ctx.lineTo(5.2,-14);ctx.lineTo(4.5,-6);ctx.lineTo(.8,-5);ctx.lineTo(0,-8);ctx.lineTo(-.8,-5);ctx.lineTo(-4.5,-6);ctx.closePath();ctx.fill();
  ctx.fillStyle=kit;ctx.beginPath();ctx.moveTo(-6.7,-30);ctx.quadraticCurveTo(0,-33,6.7,-30);ctx.lineTo(5,-13);ctx.quadraticCurveTo(0,-10,-5,-13);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.16)';ctx.beginPath();ctx.moveTo(-4.7,-29);ctx.lineTo(-2.2,-30.5);ctx.lineTo(-1.4,-14);ctx.lineTo(-3.7,-14.5);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(2,8,16,.38)';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(0,-31);ctx.lineTo(0,-13);ctx.stroke();

  // Mangas e antebraços têm espessuras diferentes: a pose protege o corpo na
  // barreira, enquanto o goleiro abre os braços para reagir.
  ctx.strokeStyle=kit;ctx.lineWidth=3.15;ctx.beginPath();
  if(dive||down){const ax=-5.2-9.8*T,ay=-27-7*T;ctx.moveTo(-5.2,-27);ctx.lineTo(ax,ay);ctx.moveTo(5.2,-27);ctx.lineTo(-ax,ay);} // braços ESTICAM com o progresso do mergulho
  else if(jump){const jx=7.5+1.5*T,jy=-20-10*T;ctx.moveTo(-5.2,-27);ctx.lineTo(-jx,jy);ctx.moveTo(5.2,-27);ctx.lineTo(jx,jy);} // barreira ERGUE os braços ao saltar
  else if(pose==='wall'){ctx.moveTo(-5.2,-27);ctx.lineTo(-7.5,-20);ctx.moveTo(5.2,-27);ctx.lineTo(7.5,-20);}
  else if(ready){ctx.moveTo(-5.2,-27);ctx.lineTo(-12.5,-23+Math.sin(now/150)*.6);ctx.moveTo(5.2,-27);ctx.lineTo(12.5,-23+Math.sin(now/150)*.6);} // braços abertos, prontos
  else if(kick){ctx.moveTo(-5.2,-27);ctx.lineTo(-10,-19);ctx.moveTo(5.2,-27);ctx.lineTo(10,-17);}
  else {ctx.moveTo(-5.2,-27);ctx.lineTo(-10+run,-18);ctx.moveTo(5.2,-27);ctx.lineTo(10-run,-18);}
  ctx.stroke();
  ctx.strokeStyle=skin;ctx.lineWidth=2.05;ctx.beginPath();
  if(dive||down){const ax=-5.2-9.8*T,ay=-27-7*T;ctx.moveTo(ax,ay);ctx.lineTo(ax-9*T,ay+1);ctx.moveTo(-ax,ay);ctx.lineTo(-ax+9*T,ay);}
  else if(jump){const jx=7.5+1.5*T,jy=-20-10*T;ctx.moveTo(-jx,jy);ctx.lineTo(-jx-1.5,jy-6*T);ctx.moveTo(jx,jy);ctx.lineTo(jx+1.5,jy-6*T);}
  else if(pose==='wall'){ctx.moveTo(-7.5,-20);ctx.lineTo(-2,-15);ctx.moveTo(7.5,-20);ctx.lineTo(2,-15);}
  else if(ready){ctx.moveTo(-12.5,-23);ctx.lineTo(-15.5,-17.5);ctx.moveTo(12.5,-23);ctx.lineTo(15.5,-17.5);}
  else {ctx.moveTo(-10+run,-18);ctx.lineTo(-12+run,-13);ctx.moveTo(10-run,-18);ctx.lineTo(12-run,-13);}
  ctx.stroke();
  if(dive||down){const ax=-5.2-9.8*T,ay=-27-7*T;ctx.fillStyle='#f5f7fb';ctx.beginPath();ctx.arc(ax-10*T,ay+1,2.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(-ax+10*T,ay,2.5,0,Math.PI*2);ctx.fill();} // luvas acompanham as mãos
  if(ready){ctx.fillStyle='#f5f7fb';ctx.beginPath();ctx.arc(-15.5,-17.5,2.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(15.5,-17.5,2.3,0,Math.PI*2);ctx.fill();}

  ctx.fillStyle=skin;ctx.fillRect(-1.8,-35,3.6,4);
  ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-39,4.7,5.4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#101827';ctx.beginPath();ctx.arc(0,-40.7,4.7,Math.PI,Math.PI*2);ctx.lineTo(4.1,-38.8);ctx.quadraticCurveTo(0,-41,-4.1,-38.8);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(4,9,16,.45)';ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(0,-39,4.7,5.4,0,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
/* MELHORIA (bola) · parâmetros opcionais sx/sy/ang: deformação de squash &
   stretch ao longo de um eixo arbitrário (o da velocidade). A deformação é
   aplicada ANTES da rotação de spin — a bola estica no rumo do voo e continua
   girando dentro da própria silhueta esticada. Sem os parâmetros, comporta-se
   exatamente como antes (todas as chamadas antigas seguem válidas). */
function drawSpBall(ctx,x,y,r,spin,sx,sy,ang){
  ctx.save();ctx.translate(x,y);
  if((sx!=null&&sx!==1)||(sy!=null&&sy!==1)){ctx.rotate(ang||0);ctx.scale(sx==null?1:sx,sy==null?1:sy);ctx.rotate(-(ang||0));}
  ctx.rotate(spin||0);ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=Math.max(4,r*.8);
  const g=ctx.createRadialGradient(-r*.32,-r*.38,r*.08,0,0,r);g.addColorStop(0,'#fff');g.addColorStop(.72,'#edf2f7');g.addColorStop(1,'#aeb9c7');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#172033';ctx.lineWidth=Math.max(1,r*.11);ctx.stroke();ctx.fillStyle='#243044';
  ctx.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5,rr=r*.27;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*r*.62,Math.sin(a)*r*.62,Math.max(.7,r*.095),0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function drawSpAim(ctx,scene,r){
  const view=spPerspective(scene),x=r.x+scene.aimX*r.w,y=r.y+scene.aimY*r.h,p=1+Math.sin(performance.now()/180)*.1;
  const rr=view.portrait?10:14,arm=view.portrait?17:22;
  ctx.save();ctx.translate(x,y);ctx.scale(p,p);ctx.strokeStyle='#ffcb45';ctx.lineWidth=view.portrait?1.5:2;ctx.shadowColor='#ffcb45';ctx.shadowBlur=10;
  ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.moveTo(-arm,0);ctx.lineTo(-rr*.55,0);ctx.moveTo(rr*.55,0);ctx.lineTo(arm,0);ctx.moveTo(0,-arm);ctx.lineTo(0,-rr*.55);ctx.moveTo(0,rr*.55);ctx.lineTo(0,arm);ctx.stroke();ctx.restore();
}
function drawSpImpact(ctx,x,y,t,color){
  const p=clamp(t/.22,0,1);if(p>=1)return;ctx.save();ctx.translate(x,y);ctx.globalAlpha=1-p;ctx.strokeStyle=color||'#ffcb45';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,12+p*26,0,Math.PI*2);ctx.stroke();for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.moveTo(Math.cos(a)*16,Math.sin(a)*16);ctx.lineTo(Math.cos(a)*(30+p*24),Math.sin(a)*(30+p*24));ctx.stroke();}ctx.restore();
}

/* ============================================================================
   PONTO 1b · CURVA EFETIVA — jogador + vento numa única fonte de verdade
   ============================================================================
   TODO ponto do jogo que precisa saber "quanto a bola vai desviar" chama esta
   função: a trajetória desenhada (spFlightPoint), a linha-guia (drawSpGuide),
   o efeito de rotação (drawSpSpinFx) e a resolução física (commitSetPiece).
   O fator .28 converte a força do vento (0..0.9) em fração de curva — um
   vendaval de 26 km/h desloca tanto quanto ~1/4 de curva máxima do cobrador,
   o suficiente para errar um canto se for ignorado, sem virar loteria. */
function spEffectiveCurve(scene){
  const w=scene&&scene.wind;
  return clamp((scene.curve||0)+(w?w.dir*w.force*.28:0),-1.25,1.25);
}

/* ============================================================================
   PONTO 1b · AERODINÂMICA DA BOLA — spFlightPoint() reescrita
   ============================================================================
   O modelo antigo era puramente decorativo: interpolação linear + um seno
   simétrico para a altura e outro para a curva. Três defeitos visíveis:
   (a) a bola viajava com velocidade constante (sem arrasto), (b) o pico do
   voo ficava sempre no meio exato do trajeto, (c) a curva "ia e voltava"
   (seno) em vez de acumular como um efeito Magnus real. O modelo novo:
     1. ARRASTO — pe = 1-(1-p)^1.16: reparametriza o tempo de voo; a bola sai
        rápida do pé e desacelera ao se aproximar do gol, como um chute real
        perdendo energia para o ar.
     2. MAGNUS — bend ∝ pe² : a força lateral (curva do jogador + vento) é uma
        ACELERAÇÃO constante; deslocamento acumulado cresce com o quadrado do
        tempo. É por isso que a curva "fecha" no fim — exatamente a assinatura
        das faltas por cima da barreira. O fator (1.18-.18·pe) satura de leve
        o final para a bola não serpentear.
     3. BALÍSTICA — lift = 4·pe·(1-pe)·arc é a parábola do projétil; e o arc
        agora é INVERSO à força: chute forte = trajetória rasteira e tensa,
        chute fraco = bola encobrindo por cima. (Antes era o contrário —
        quanto mais forte, mais alto — fisicamente absurdo.)
   Bloqueio na barreira e espalmada do goleiro continuam interceptando a rota,
   agora referenciados em pe para casarem com o novo relógio da bola.
   ============================================================================ */
function spFlightPoint(scene,p,view,opts){
  opts=opts||{};const goal=view.goal,baseX=scene.ballX==null?CW*.5:scene.ballX;
  let tx=goal.x+clamp(scene.actualX==null?.5:scene.actualX,-.2,1.2)*goal.w;
  let ty=goal.y+clamp(scene.actualY==null?.46:scene.actualY,-.2,1.22)*goal.h;
  const pe=1-Math.pow(1-p,1.16);                       // (1) arrasto aerodinâmico
  if(opts.blocked){tx=CW*.5-(scene.curve||0)*goal.w*.06;ty=view.wallY-view.wallScale*31;}
  else if(opts.saved&&pe>.72){tx=opts.gkx;ty=opts.gky-view.gkScale*20;}
  const eff=spEffectiveCurve(scene);                   // curva jogador+vento
  const curveAmp=(view.portrait?58:126)*(opts.penalty?.28:1);
  const bend=eff*curveAmp*(pe*pe)*(1.18-.18*pe);       // (2) Magnus acumulativo
  const power=scene.power==null?.7:scene.power;
  const arc=opts.penalty?(16+(1-power)*22):(40+(1-power)*52);
  const lift=4*pe*(1-pe)*arc;                          // (3) parábola balística
  /* MELHORIA (bola) · PROJEÇÃO NO CHÃO: além da posição da bola, a função
     devolve gy — o ponto do gramado exatamente ABAIXO dela em cada instante
     (interpolação bola→base do alvo, sem o termo de altura). É sobre gy que
     as cenas desenham a sombra de contato que "descola" da bola conforme ela
     sobe: a pista visual clássica que faz o olho LER a altura do voo num
     plano 2D. h = gy − y é a altura instantânea, usada para dosar o tamanho
     e a transparência dessa sombra. */
  const gEnd=opts.blocked?view.wallY+2:goal.y+goal.h+2;
  const gy=lerp(view.ballY,gEnd,pe);
  const yv=lerp(view.ballY,ty,pe)-lift+(opts.blocked&&pe>.76?Math.pow((pe-.76)/.24,2)*view.wallScale*16:0);
  return {
    x:lerp(baseX,tx,pe)+bend,
    y:yv,
    gy:gy,
    h:Math.max(0,gy-yv),
    r:lerp(view.ballR,view.targetBallR,pe),
    spin:pe*26*(1+eff*1.7)
  };
}
/* PONTO 1 · LINHA DIRECIONAL — MANTIDA por exigência do briefing. Ela indica
   apenas a TRAJETÓRIA INICIAL pretendida (bola → ponto de mira), com a flexão
   lateral já contaminada pelo vento (spEffectiveCurve): o jogador vê para onde
   a bola tende a derivar, mas NÃO vê mais o marcador do ponto de impacto
   (removido em drawFkScene — Ponto 1a). Ler a linha + o HUD de vento e
   compensar mentalmente passa a ser a habilidade central da cobrança. */
function drawSpGuide(ctx,scene,view){
  const goal=view.goal,baseX=scene.ballX==null?CW*.5:scene.ballX;
  const tx=goal.x+scene.aimX*goal.w,ty=goal.y+scene.aimY*goal.h;
  const bend=spEffectiveCurve(scene)*(view.portrait?44:90);
  ctx.save();ctx.globalAlpha=.32;ctx.strokeStyle='#eaf4ff';ctx.lineWidth=view.portrait?1.1:1.5;ctx.setLineDash(view.portrait?[4,8]:[7,11]);
  ctx.beginPath();ctx.moveTo(baseX,view.ballY-view.ballR-3);ctx.quadraticCurveTo((baseX+tx)/2+bend,(view.ballY+ty)/2-(view.portrait?56:74),tx,ty);ctx.stroke();ctx.restore();
}

/* ============================================================================
   PONTO 1b · MEDIDOR DE TENSÃO DO ARRASTE — drawSpTension() (novo)
   ============================================================================
   Substitui a antiga linha tracejada estática por quatro camadas de feedback,
   todas moduladas pela força atual (t = scene.power):
     1. ELÁSTICO — traço da âncora até a bola puxada; espessura (1.6→5 px) e
        brilho crescem com t; a cor percorre branco-gelo → dourado → vermelho
        (rampa térmica), a linguagem universal de "estou no limite".
     2. ANEL DE CARGA — arco de progresso ao redor do ponto de origem da bola,
        fechando 360° em t=1. Leitura de força sem desviar o olhar do gesto.
     3. CHEVRONS — três setas apontando na direção REAL do chute (oposta ao
        arraste), ganhando opacidade/tamanho com a tensão: reforça o modelo
        mental de estilingue.
     4. PERCENTUAL — número junto à bola puxada, para quem prefere precisão.
   Combina com o tremor da bola (spSceneBall) para tornar a tensão "sentível".
   Usada tanto na falta quanto no pênalti: o gesto é o mesmo nos dois modos.
   ============================================================================ */
function drawSpTension(ctx,baseX,view,scene){
  const anchorX=baseX, anchorY=view.ballY;
  const ball=spSceneBall(scene);
  const t=clamp(scene.power||0,0,1);
  const col=t<.5
    ? 'rgba('+Math.round(234+42*t)+','+Math.round(244-82*t)+','+Math.round(255-372*t)+',.9)'
    : 'rgba(255,'+Math.round(203-280*(t-.5))+','+Math.round(69-80*(t-.5))+',.95)';
  ctx.save();
  /* 1) elástico */
  ctx.strokeStyle=col; ctx.lineCap='round';
  ctx.lineWidth=1.6+t*3.4;
  ctx.shadowColor=col; ctx.shadowBlur=4+t*10;
  ctx.beginPath(); ctx.moveTo(anchorX,anchorY); ctx.lineTo(ball.x,ball.y); ctx.stroke();
  ctx.shadowBlur=0;
  /* 2) anel de carga */
  ctx.lineWidth=2.4;
  ctx.strokeStyle='rgba(255,255,255,.25)';
  ctx.beginPath(); ctx.arc(anchorX,anchorY,15,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=col;
  ctx.beginPath(); ctx.arc(anchorX,anchorY,15,-Math.PI/2,-Math.PI/2+t*Math.PI*2); ctx.stroke();
  /* 3) chevrons na direção do chute (oposta ao arraste) */
  const dx=anchorX-ball.x, dy=anchorY-ball.y, mag=Math.hypot(dx,dy)||1;
  const ux=dx/mag, uy=dy/mag, rot=Math.atan2(uy,ux);
  ctx.fillStyle=col; ctx.globalAlpha=.35+t*.6;
  for(let i=1;i<=3;i++){
    const px=anchorX+ux*(20+i*14), py=anchorY+uy*(20+i*14), sz=4.4+t*2.4;
    ctx.save(); ctx.translate(px,py); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(sz,0); ctx.lineTo(-sz*.7,-sz*.8); ctx.lineTo(-sz*.7,sz*.8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1;
  /* 4) percentual junto à bola puxada */
  ctx.font="800 12px 'Barlow Condensed',sans-serif"; ctx.textAlign='center';
  ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=6;
  ctx.fillText(Math.round(t*100)+'%',ball.x,ball.y-view.ballR-9);
  ctx.restore();
}
/* ============================================================================
   MELHORIA (goleiro) · drawSpKeeper — máquina de estados do arqueiro
   ============================================================================
   Substitui o goleiro binário ('set' parado → 'dive' teleportado) por quatro
   estados encadeados, compartilhados pela falta e pelo pênalti:
     1. PRONTIDÃO (diveP=0): pose 'ready' deslizando alguns pixels de um poste
       ao outro (duas senoides dessincronizadas), como um goleiro real lendo o
       cobrador. O quique nos calcanhares vem da própria pose.
     2. COILING (primeiros 16% do mergulho): antes de voar, o corpo AGACHA
       ~2,5px e comprime ~6% — o princípio de animação da antecipação; é o
       "carregar a mola" que dá força visual à explosão lateral.
     3. VOO (restante): pose 'dive' com progresso t — rotação e braços abrem
       gradualmente enquanto gkx/gky percorrem o arco calculado pela cena.
     4. NO CHÃO (fase de resultado, após o pico): pose 'down' no ponto de
       queda — o goleiro não volta a ficar de pé por teletransporte.
   Devolve o quanto o estado "voo" progrediu para quem precisar sincronizar.
   ============================================================================ */
function drawSpKeeper(ctx,scene,view,gkx,gky,diveP,phase){
  const goal=view.goal, now=performance.now();
  if(diveP<=0){
    const sway=Math.sin(now/560)*goal.w*.045+Math.sin(now/233)*goal.w*.012;
    drawSpFigure(ctx,CW*.5+sway,goal.y+goal.h-2,view.gkScale,'#ffcb45','ready',Math.sin(now/560)<0);
    return 0;
  }
  const coil=clamp(diveP/.16,0,1), fly=clamp((diveP-.16)/.84,0,1);
  if(fly<=0){
    drawSpFigure(ctx,CW*.5,goal.y+goal.h-2+coil*2.5,view.gkScale*(1-.06*coil),'#ffcb45','ready',scene.gkDir<0);
    return 0;
  }
  if(phase==='result'&&scene.t>.24){
    drawSpFigure(ctx,CW*.5+scene.gkDir*goal.w*.31,goal.y+goal.h-1,view.gkScale,'#ffcb45','down',scene.gkDir<0);
    return 1;
  }
  drawSpFigure(ctx,gkx,gky,view.gkScale,'#ffcb45','dive',scene.gkDir<0,fly);
  return fly;
}

/* MELHORIA (bola) · SOMBRA DE CONTATO NO GRAMADO: elipse desenhada na
   PROJEÇÃO da bola no chão (pt.gy, vinda de spFlightPoint). Quanto mais alto
   o voo (pt.h), menor e mais transparente a sombra — é o descolamento entre
   bola e sombra que faz o cérebro ler "ela subiu por cima da barreira". */
function drawSpBallShadow(ctx,pt){
  if(pt.gy==null)return;
  const hn=clamp((pt.h||0)/130,0,1);
  ctx.save();ctx.fillStyle='rgba(0,0,0,'+(.32*(1-.72*hn)+.03).toFixed(3)+')';
  ctx.beginPath();ctx.ellipse(pt.x,pt.gy,pt.r*(1.55-.75*hn),pt.r*(.52-.24*hn),0,0,Math.PI*2);ctx.fill();ctx.restore();
}

/* MELHORIA (bola) · GRAMA DO CHUTE: no impacto do pé, sete lascas de grama
   voam do ponto da bola em leque determinístico (nada de Math.random por
   frame — as trajetórias são função pura de t, então não tremem). Gravidade
   simples devolve as lascas ao chão enquanto desvanecem. */
function drawSpKickDebris(ctx,x,y,t,dir){
  if(t>=.34)return;
  ctx.save();ctx.lineCap='round';
  for(let i=0;i<7;i++){
    const a=-2.35+i*.20+dir*.25, sp=46+i*11, tt=t/.34;
    const px=x+Math.cos(a)*sp*t*2.6, py=y+Math.sin(a)*sp*t*2.6+150*t*t;
    ctx.strokeStyle='rgba(126,214,110,'+((1-tt)*.85).toFixed(3)+')';
    ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(a)*3.6,py+Math.sin(a)*3.6+2.2*tt);ctx.stroke();
  }
  ctx.restore();
}
function drawSpFlightTrail(ctx,scene,p,view,opts){
  if(p<=.025)return;const from=Math.max(0,p-.25),steps=9;
  ctx.save();ctx.lineCap='round';ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const q=lerp(from,p,i/steps),pt=spFlightPoint(scene,q,view,opts);
    if(i===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y);
  }
  const end=spFlightPoint(scene,p,view,opts),start=spFlightPoint(scene,from,view,opts);
  const grad=ctx.createLinearGradient(start.x,start.y,end.x,end.y);grad.addColorStop(0,'rgba(194,230,255,0)');grad.addColorStop(.55,'rgba(214,239,255,.22)');grad.addColorStop(1,'rgba(255,255,255,.66)');
  ctx.strokeStyle=grad;ctx.lineWidth=Math.max(1.2,end.r*.48);ctx.shadowColor='rgba(132,211,255,.45)';ctx.shadowBlur=7;ctx.stroke();ctx.shadowBlur=0;
  for(let i=2;i<steps;i+=2){const q=lerp(from,p,i/steps),pt=spFlightPoint(scene,q,view,opts);ctx.globalAlpha=.08+i/steps*.18;ctx.fillStyle='#dff5ff';ctx.beginPath();ctx.arc(pt.x,pt.y,Math.max(.7,pt.r*.22),0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function drawSpSpinFx(ctx,pt,curve){
  if(Math.abs(curve||0)<.08)return;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate((curve||0)*.35);ctx.strokeStyle='rgba(201,235,255,.58)';ctx.lineWidth=Math.max(1,pt.r*.15);ctx.setLineDash([pt.r*.6,pt.r*.5]);
  ctx.beginPath();ctx.ellipse(0,0,pt.r*1.65,pt.r*.72,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}

// Câmera em primeira pessoa atrás da bola: não há avatar do cobrador. A curta
// aproximação é sugerida pelo avanço da câmera e pelo impacto no gramado.
function drawPenScene(ctx) {
  const ps=penScene;if(!ps)return;const view=spPerspective(ps),goal=view.goal;
  const runP=ps.phase==='run'?clamp(ps.t/.52,0,1):ps.phase==='strike'||ps.phase==='result'?1:0;
  const shake=ps.phase==='strike'&&ps.t<.14?(1-ps.t/.14)*3.5:0;
  ctx.save();ctx.translate(Math.sin(ps.t*95)*shake,Math.cos(ps.t*81)*shake-runP*2);drawSpBackdrop(ctx,ps,view);
  const scored=ps.result==='goal',saved=ps.result==='save';
  drawSpGoal(ctx,goal,ps.phase==='result'&&scored?Math.max(0,1-ps.t*1.25):0);
  let flightP=0;if(ps.phase==='strike')flightP=clamp(ps.t/.82,0,1);else if(ps.phase==='result')flightP=1;
  let diveP=0;if(ps.phase==='strike')diveP=clamp((flightP-.34)/.54,0,1);else if(ps.phase==='result')diveP=1;
  const gkx=CW*.5+ps.gkDir*goal.w*.29*diveP,gky=goal.y+goal.h-2-Math.sin(diveP*Math.PI)*goal.h*.2;
  /* MELHORIA (goleiro): pênalti usa a MESMA máquina de estados da falta —
     prontidão quicando na linha, antecipação, mergulho progressivo, caído. */
  drawSpKeeper(ctx,ps,view,gkx,gky,diveP,ps.phase);
  const baseX=ps.ballX==null?CW*.5:ps.ballX,start=spSceneBall(ps),opts={penalty:true,saved,gkx,gky};
  if(ps.phase==='aim'){drawSpGuide(ctx,ps,view);drawSpAim(ctx,ps,goal);}
  let pt={x:start.x,y:start.y,gy:start.y+view.ballR*.9,h:0,r:view.ballR,spin:0};
  if(ps.phase==='strike'||ps.phase==='result'){
    drawSpFlightTrail(ctx,ps,flightP,view,opts);pt=spFlightPoint(ps,flightP,view,opts);
    if(ps.phase==='result'&&saved){pt.gy=gky+2;pt.y=Math.min(pt.y+Math.min(36,ps.t*50),pt.gy-pt.r*.55);}
    pt.h=Math.max(0,pt.gy-pt.y);
  }
  if(ps.phase==='strike'){drawSpImpact(ctx,baseX,view.ballY,ps.t,ps.color);drawSpKickDebris(ctx,baseX,view.ballY,ps.t,spEffectiveCurve(ps)>=0?1:-1);}
  /* MELHORIA (bola): sombra de contato + squash & stretch — ver drawFkScene. */
  drawSpBallShadow(ctx,pt);
  let bsx=1,bsy=1,bang=0;
  if(ps.phase==='strike'&&flightP>0&&flightP<.16){
    const nx=spFlightPoint(ps,Math.min(1,flightP+.06),view,opts);
    bang=Math.atan2(nx.y-pt.y,nx.x-pt.x);
    const kk=1-flightP/.16; bsx=1+.45*kk; bsy=1-.28*kk;
  } else if(ps.phase==='result'&&saved&&ps.t<.12){
    const kk=1-ps.t/.12; bsx=1-.24*kk; bsy=1+.28*kk;
  }
  drawSpSpinFx(ctx,pt,spEffectiveCurve(ps));drawSpBall(ctx,pt.x,pt.y,pt.r,pt.spin,bsx,bsy,bang);
  /* PONTO 1b: pênalti compartilha o mesmo gesto de arraste da falta, então
     recebe o mesmo medidor de tensão — consistência de linguagem visual. */
  if(ps.phase==='aim'&&ps.pull)drawSpTension(ctx,baseX,view,ps);
  ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=12;
  if(ps.phase==='result'&&ps.result){ctx.font="900 38px 'Anton',sans-serif";ctx.fillStyle=scored?'#45df79':saved?'#ff5d78':'#e5ebf4';ctx.fillText(scored?'GOL!':saved?'DEFENDEU!':'PARA FORA!',CW/2,54);}
  ctx.shadowBlur=0;if(ps.mode==='shootout'&&ps.tally){ctx.font="800 15px 'Barlow Condensed',sans-serif";ctx.fillStyle='#fff';ctx.fillText(ps.tally,CW/2,78);}ctx.restore();
}

function advanceFkScene(dt) {
  const f = fkScene; if (f.phase === 'aim') return;
  f.t += dt;
  if (f.phase==='set' && f.t>.32) { f.phase='run'; f.t=0; }
  else if (f.phase==='run' && f.t>.68) { f.phase='strike'; f.t=0; playUXSound('kick'); }
  else if (f.phase==='strike' && f.t>1.04) { f.phase='result'; f.t=0; }
}

// Falta em perspectiva: a curva altera a trajetória até o alvo e a barreira
// participa fisicamente da cena em vez de ser apenas um texto de resultado.
function drawFkScene(ctx) {
  const f=fkScene;if(!f)return;const view=spPerspective(f),goal=view.goal;
  const scored=f.result==='goal',saved=f.result==='save',blocked=f.result==='wall';
  const runP=f.phase==='run'?clamp(f.t/.68,0,1):f.phase==='strike'||f.phase==='result'?1:0;
  const impactShake=f.phase==='strike'&&f.t<.16?(1-f.t/.16)*4.2:0;
  ctx.save();ctx.translate(Math.sin(f.t*97)*impactShake,Math.cos(f.t*83)*impactShake-runP*2.5);
  drawSpBackdrop(ctx,f,view);
  drawSpGoal(ctx,goal,f.phase==='result'&&scored?Math.max(0,1-f.t*1.3):0);
  let flightP=0;if(f.phase==='strike')flightP=clamp(f.t/1.02,0,1);else if(f.phase==='result')flightP=1;
  let diveP=0;if(f.phase==='strike')diveP=clamp((flightP-.5)/.43,0,1);else if(f.phase==='result')diveP=1;
  const gkx=CW*.5+f.gkDir*goal.w*.29*diveP,gky=goal.y+goal.h-2-Math.sin(diveP*Math.PI)*goal.h*.19;
  /* MELHORIA (goleiro): estados prontidão→antecipação→mergulho progressivo→
     caído, todos em drawSpKeeper (comentado lá). */
  drawSpKeeper(ctx,f,view,gkx,gky,diveP,f.phase);
  /* ==========================================================================
     MELHORIA (barreira) · JOGADORES INDIVIDUAIS, NÃO UM BLOCO
     ==========================================================================
     Antes: os N homens da barreira pulavam JUNTOS, na mesma fase e altura —
     um bloco sólido subindo e descendo. Agora cada um é um atleta:
       · wallRnd(i): pseudo-aleatório DETERMINÍSTICO por posição (seno-hash).
         Mesmos valores em todo frame → nada tremula; jogadores diferentes →
         comportamentos diferentes.
       · Salto escalonado: cada um dispara com até 90 ms de atraso individual
         (rj*.09 na fase) e alcança alturas próprias (6→9,5 × escala) — a
         barreira "ondula" como nas transmissões reais.
       · Espera viva: durante a mira/corrida, balanço lateral sutil e
         dessincronizado (senoide com fase i*1.9) — ninguém fica estátua.
       · Braços erguem com o progresso do próprio salto (t na pose 'jump').
       · Bloqueio: quando o chute morre na barreira, o homem mais próximo do
         ponto de impacto (índice resolvido uma única vez em f._hitIdx)
         RECUA tremendo por ~0,5 s — a parede deixa de ser cenário e reage.
     ========================================================================== */
  const nowMs=performance.now();
  const wallGap=clamp(view.wallScale*15,view.portrait?24:38,view.portrait?37:56),wallStart=CW*.5-(f.wallN-1)*wallGap*.5;
  const wallRnd=i=>{const v=Math.sin((i+1)*127.1)*43758.5453;return v-Math.floor(v);};
  if(blocked&&f._hitIdx==null&&f.wallN>0){
    const bx=CW*.5-(f.curve||0)*goal.w*.06;
    f._hitIdx=Math.max(0,Math.min(f.wallN-1,Math.round((bx-wallStart)/wallGap)));
  }
  for(let i=0;i<f.wallN;i++){
    const rj=wallRnd(i), rh=wallRnd(i+11);
    const idle=(f.phase==='aim'||f.phase==='set'||f.phase==='run')?Math.sin(nowMs/300+i*1.9)*1.1:0;
    const ph=f.phase==='strike'?clamp((flightP-.16-rj*.09)/.52,0,1):0;
    const jmp=Math.sin(ph*Math.PI)*view.wallScale*(6+rh*3.5);
    let wx=wallStart+i*wallGap+idle, wy=view.wallY-jmp;
    if(blocked&&f.phase==='result'&&i===f._hitIdx){
      const rec=Math.max(0,1-f.t*2);
      wx+=Math.sin(f.t*42)*3*rec; wy+=Math.min(2.5,f.t*6);           // recuo + tremor do impacto
    }
    drawSpFigure(ctx,wx,wy,view.wallScale,f.defColor||'#e84040',jmp>1?'jump':'wall',false,clamp(ph*1.5,0,1));
  }
  const baseX=f.ballX==null?CW*.5:f.ballX;
  const start=spSceneBall(f),opts={blocked,saved,gkx,gky};
  /* PONTO 1a · ALVO REMOVIDO NA FALTA: a chamada a drawSpAim() (a retícula
     dourada pulsante que marcava o ponto EXATO de colisão da bola no gol) foi
     eliminada desta cena. O cobrador agora mira por intuição, guiado apenas
     pela linha direcional (drawSpGuide, mantida por exigência) e pelo HUD de
     vento. Nos pênaltis a retícula continua existindo: o briefing restringiu
     a remoção às cobranças de falta, e drawSpAim segue viva para essa cena. */
  if(f.phase==='aim')drawSpGuide(ctx,f,view);
  let pt={x:start.x,y:start.y,gy:start.y+view.ballR*.9,h:0,r:view.ballR,spin:0};
  if(f.phase==='strike'||f.phase==='result'){
    drawSpFlightTrail(ctx,f,flightP,view,opts);pt=spFlightPoint(f,flightP,view,opts);
    if(f.phase==='result'&&blocked){pt.x+=(f.curve||.25)*Math.min(34,f.t*42);pt.y=Math.min(pt.y+Math.min(55,f.t*70),pt.gy-pt.r*.55);}
    else if(f.phase==='result'&&saved){pt.gy=gky+2;pt.y=Math.min(pt.y+Math.min(42,f.t*54),pt.gy-pt.r*.55);}
    pt.h=Math.max(0,pt.gy-pt.y);
  }
  if(f.phase==='strike'){drawSpImpact(ctx,baseX,view.ballY,f.t,f.color);drawSpKickDebris(ctx,baseX,view.ballY,f.t,spEffectiveCurve(f)>=0?1:-1);}
  /* MELHORIA (bola) · sombra de contato + squash & stretch:
     · a sombra na projeção pt.gy descola da bola conforme ela sobe;
     · nos primeiros ~14% do voo a bola ESTICA na direção da velocidade
       (amostrando o ponto seguinte da trajetória para obter o ângulo);
     · no impacto (barreira/defesa) ela COMPRIME no mesmo eixo por ~120 ms.
     O peão de rotação (drawSpSpinFx) continua usando a curva efetiva. */
  drawSpBallShadow(ctx,pt);
  let bsx=1,bsy=1,bang=0;
  if(f.phase==='strike'&&flightP>0&&flightP<.14){
    const nx=spFlightPoint(f,Math.min(1,flightP+.05),view,opts);
    bang=Math.atan2(nx.y-pt.y,nx.x-pt.x);
    const kk=1-flightP/.14; bsx=1+.5*kk; bsy=1-.3*kk;
  } else if(f.phase==='result'&&(blocked||saved)&&f.t<.12){
    const kk=1-f.t/.12; bsx=1-.26*kk; bsy=1+.3*kk;
  }
  drawSpSpinFx(ctx,pt,spEffectiveCurve(f));drawSpBall(ctx,pt.x,pt.y,pt.r,pt.spin,bsx,bsy,bang);
  /* PONTO 1b: a antiga linha tracejada do arraste deu lugar ao medidor de
     tensão completo (elástico + anel + chevrons + %). */
  if(f.phase==='aim'&&f.pull)drawSpTension(ctx,baseX,view,f);
  ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=12;
  if(f.phase==='result'){
    ctx.font="900 36px 'Anton',sans-serif";ctx.fillStyle=scored?'#45df79':saved?'#ff5d78':'#e5ebf4';
    ctx.fillText(scored?'GOLAÇO DE FALTA!':saved?'DEFENDEU!':blocked?'NA BARREIRA!':'PARA FORA!',CW/2,52);
  }
  ctx.shadowBlur=0;ctx.restore();
}

/* ======================== REPLAY DOS LANCES =============================== */
function recordSnapshot() {
  const st = sim.getState();
  const snap = {
    ball: { x: st.ball.x, y: st.ball.y, z: st.ball.z },
    p: [],
  };
  for (const tm of st.teams) for (const pl of tm.players) {
    if (pl.red) continue;
    snap.p.push({ x: pl.x, y: pl.y, c: tm.color, num: pl.num, gk: pl.slot === 'GK', ball: pl.hasBall });
  }
  replayBuf.push(snap);
  if (replayBuf.length > 150) replayBuf.shift();   // ~2.5s a 60fps
}

function startReplay() {
  // Replay só funciona se houver frames suficientes (mínimo 10 para não travar)
  if (replayBuf.length < 10) return false;
  // Pega os últimos ~2.2s de jogada (ou menos se o buffer for pequeno)
  const frameCount = Math.min(135, replayBuf.length);
  const frames = replayBuf.slice(-frameCount).map(s => ({ ball: {...s.ball}, p: s.p.map(x=>({...x})) }));
  replay = { frames, idx: 0, until: performance.now() + 3400 };
  return true;
}

function trackTrail() {
  const b = sim.getState().ball;
  trailPts.unshift({ x: b.x, y: b.y });
  if (trailPts.length > 7) trailPts.pop();
}

/* ============================================================================
   PONTO 4 · APITO FINAL SEM ESPERA — fastForwardFullTime()
   ============================================================================
   DIAGNÓSTICO DO ATRASO: o fim de jogo (endOfPlay) só era avaliado dentro do
   bloco de simulação do loop, e esse bloco fica BLOQUEADO enquanto houver
   comemoração (>=2,8 s), cena de falta (4,3 s), cena de pênalti (3,9 s) ou
   overlay de intervalo na tela. Um gol nos acréscimos, portanto, empilhava:
   cena da cobrança + replay + confete + comemoração ANTES de o jogo sequer
   perceber que os 90' acabaram — 6 a 9 segundos de tela parada até o cartão
   de resultado aparecer. Era exatamente o "delay excessivo e monótono".
   A SOLUÇÃO não é cortar as celebrações a seco (um gol de título merece o seu
   segundo de confete), e sim COMPRIMIR as janelas pendentes assim que a
   simulação cruza o tempo final: cada overlay ativo tem seu `until` rebaixado
   para agora+850 ms — tempo suficiente para o "GOL!" registrar na retina — e
   o replay em loop é encerrado em 260 ms. Na sequência natural do loop, os
   overlays expiram e endOfPlay/finishMatch disparam de imediato.
   O flag _done garante execução única por partida; ele é rearmado junto de
   endOfPlay._done nos pontos de reinício (nova partida e prorrogação).
   ============================================================================ */
const FT_OVERLAY_GRACE = 850;   // sobrevida máxima (ms) de qualquer overlay após o apito
function fastForwardFullTime(now){
  if (fastForwardFullTime._done) return;
  const cap = now + FT_OVERLAY_GRACE;
  if (celebration){
    if (celebration.until > cap) celebration.until = cap;
    if (celebration.replayUntil > now + 260) celebration.replayUntil = now + 260;
  }
  if (fkScene && fkScene.until !== Infinity && fkScene.until > cap) fkScene.until = cap;
  /* Só cenas de pênalti DE JOGO ("live"): a disputa por pênaltis roda com
     finished=true e tem cadência própria — jamais deve ser comprimida aqui. */
  if (penScene && penScene.mode === 'live' && penScene.until !== Infinity && penScene.until > cap) penScene.until = cap;
  if (breakOv && breakOv.until > cap) breakOv.until = cap;
  slowmo = null;                 // câmera lenta não tem lugar depois do apito
  fastForwardFullTime._done = true;
}

function endOfPlay() {
  if (endOfPlay._done) return; endOfPlay._done = true;
  if (isKO && sim.score[0] === sim.score[1] && sim.half <= 2) {
    endOfPlay._done = false;   // prorrogação: permite novo fim depois
    fastForwardFullTime._done = false;  // PONTO 4: rearma a compressão p/ o apito dos 120' 
    feed.unshift({ min:90, txt:'⚡ <b>PRORROGAÇÃO!</b>', imp:true });
    latestEvent = { txt:'⚡ <b>PRORROGAÇÃO!</b>', min:90 };
    updateNarr(); sim.beginExtraTime(); startLoop(); return;
  }
  if (isKO && sim.score[0] === sim.score[1]) return doShootout();
  finishMatch(null);
}

function doShootout() {
  finished = true;
  feed.unshift({ min:120, txt:'🔴 <b>DISPUTA DE PÊNALTIS!</b>', imp:true });
  latestEvent = { txt:'🔴 <b>DISPUTA DE PÊNALTIS!</b>', min:120 };
  updateNarr();
  openPenaltyOrder();
}

function penaltyEligible(team){return sim.teams[team].players.filter(p=>!p.red);}
function openPenaltyOrder(){
  const host=$('#setpiece-ui');if(!host){startInteractiveShootout([]);return;}
  const eligible=penaltyEligible(mySide).slice().sort((a,b)=>facet(b,'pen')-facet(a,'pen'));
  const suggested=eligible.filter(p=>!p.isGK);
  let chosen=(suggested.length>=5?suggested:eligible).slice(0,Math.min(5,eligible.length));
  const renderOrder=()=>{
    const available=eligible.filter(p=>!chosen.includes(p));
    const row=(p,i,selected)=>{
      const ref=p.ref||p,skill=Math.round(facet(p,'pen'));
      return `<div class="po-player" data-po="${p.idx}"><span class="po-num">${selected?i+1:'+'}</span><span><b>${esc(ref.n)}</b><span class="po-meta">PÊNALTI ${skill} · OVR ${ref.r}</span></span>${selected?`<span class="po-actions"><button class="po-move" data-up="${i}" aria-label="Subir">↑</button><button class="po-move" data-down="${i}" aria-label="Descer">↓</button><button class="po-move" data-remove="${i}" aria-label="Remover">×</button></span>`:`<span class="po-ovr">${skill}</span>`}</div>`;
    };
    host.innerHTML=`<div class="pen-order-ui">
      <div class="po-head"><h3>ESCOLHA OS COBRADORES</h3><p>Esta é a ordem sugerida. Ajuste os cinco primeiros antes da disputa.</p></div>
      <div class="po-grid"><div><div class="sp-label"><span>Ordem das cobranças</span><span>${chosen.length}/5</span></div><div class="po-list">${chosen.map((p,i)=>row(p,i,true)).join('')}</div></div>
      <div><div class="sp-label"><span>Jogadores disponíveis</span><span>Toque para adicionar</span></div><div class="po-list">${available.map((p,i)=>row(p,i,false)).join('')||'<div class="mut">Todos selecionados.</div>'}</div></div></div>
      <button class="po-confirm" id="po-confirm" ${chosen.length<Math.min(5,eligible.length)?'disabled':''}>CONFIRMAR ORDEM E COMEÇAR</button>
    </div>`;
    host.querySelectorAll('[data-po]').forEach(el=>{if(el.querySelector('[data-up]'))return;el.onclick=()=>{const p=eligible.find(q=>q.idx===+el.dataset.po);if(p&&chosen.length<5){chosen.push(p);renderOrder();}};});
    host.querySelectorAll('[data-up]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=+b.dataset.up;if(i>0){[chosen[i-1],chosen[i]]=[chosen[i],chosen[i-1]];renderOrder();}});
    host.querySelectorAll('[data-down]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=+b.dataset.down;if(i<chosen.length-1){[chosen[i+1],chosen[i]]=[chosen[i],chosen[i+1]];renderOrder();}});
    host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=e=>{e.stopPropagation();chosen.splice(+b.dataset.remove,1);renderOrder();});
    const confirm=$('#po-confirm');if(confirm)confirm.onclick=()=>{host.innerHTML='';startInteractiveShootout(chosen);};
  };
  renderOrder();
}
function resolveShootoutAttempt(kicker,gk,input,pressure){
  const ks=facet(kicker,'pen'),gs=facet(gk,'pen_gk'),comp=getAttr(kicker,'compostura')/100;
  const ideal=.72,power=clamp(input.power==null?.72:input.power,0,1),powerQ=clamp(1-Math.abs(power-ideal)*2.6,0,1);
  const aimX=clamp(input.aimX==null?.5:input.aimX,-.2,1.2),aimY=clamp(input.aimY==null?.48:input.aimY,-.2,1.2),curve=clamp(input.curve||0,-1,1);
  const execution=clamp(ks/100*.47+powerQ*.35+comp*.18-pressure*(1-comp)*.28,0,1);
  const err=lerp(.13,.018,execution),actualX=aimX+(R(-err,err)+R(-err,err))*.5+curve*.012,actualY=aimY+(R(-err,err)+R(-err,err))*.25-(power-ideal)*.58;
  const off=actualX<.015||actualX>.985||actualY<.015||actualY>1.03;
  const corner=clamp(Math.hypot((actualX-.5)*1.65,(actualY-.52)*1.3),0,1);
  const pGoal=clamp(.65+(ks-gs)/100*.30+execution*.16+corner*.08-pressure*(1-comp)*.13,.45,.94);
  const result=off?'miss':chance(pGoal)?'goal':'save';
  return {ok:result==='goal',result,visual:{aimX,aimY,actualX,actualY,power,curve,execution}};
}
function startInteractiveShootout(chosen){
  const all=[penaltyEligible(0),penaltyEligible(1)],n=Math.max(1,Math.min(all[0].length,all[1].length));
  const equate=(list,count)=>{
    const gk=list.find(p=>p.isGK),field=list.filter(p=>p!==gk).sort((a,b)=>facet(b,'pen')-facet(a,'pen'));
    return gk?[gk].concat(field.slice(0,Math.max(0,count-1))):field.slice(0,count);
  };
  all[0]=equate(all[0],n);all[1]=equate(all[1],n);
  const selected=chosen.filter(p=>all[mySide].includes(p));
  const userOrder=selected.concat(all[mySide].filter(p=>!selected.includes(p)).sort((a,b)=>facet(b,'pen')-facet(a,'pen')));
  const orders=[];orders[mySide]=userOrder.length?userOrder:all[mySide];orders[1-mySide]=all[1-mySide];
  shootoutState={score:[0,0],kicks:[0,0],index:0,orders,marks:[[],[]]};
  nextShootoutKick();
}
function shootoutFinished(s){
  const rem=[Math.max(0,5-s.kicks[0]),Math.max(0,5-s.kicks[1])];
  // Encerramento matemático vale na série inicial. Na alternada, o segundo
  // time sempre recebe sua cobrança antes de comparar o placar do par.
  if((s.kicks[0]<5||s.kicks[1]<5)&&(s.score[0]>s.score[1]+rem[1]||s.score[1]>s.score[0]+rem[0]))return true;
  if(s.kicks[0]>=5&&s.kicks[1]>=5&&s.kicks[0]===s.kicks[1]&&s.score[0]!==s.score[1])return true;
  return false;
}
function shootoutTally(s){
  const a=sim.teams[0].name||sim.teams[0].squad.c,b=sim.teams[1].name||sim.teams[1].squad.c;
  const dots=t=>s.marks[t].map(ok=>ok?'●':'○').join(' ');
  return `${a} ${s.score[0]} [${dots(0)}]  ·  [${dots(1)}] ${s.score[1]} ${b}`;
}
function presentShootoutKick(team,kicker,outcome,done){
  const vis=outcome.visual,dir=vis.actualX<.5?-1:1;
  const preview={score:shootoutState.score.slice(),marks:[shootoutState.marks[0].slice(),shootoutState.marks[1].slice()]};
  preview.marks[team].push(outcome.ok);if(outcome.ok)preview.score[team]++;
  penScene={mode:'shootout',shooter:(kicker.ref||kicker).n,color:sim.teams[team].color,phase:'set',t:0,dir,gkDir:outcome.result==='save'?dir:-dir,result:outcome.result,
    aimX:vis.aimX,aimY:vis.aimY,actualX:vis.actualX,actualY:vis.actualY,power:vis.power,curve:vis.curve,tally:shootoutTally(preview),until:performance.now()+2450};
  /* PONTO 4 · CADÊNCIA DA DISPUTA: a janela por cobrança cai de 3350 ms para
     2500 ms. A cena em si dura ~1,6 s (fases set+run+strike encurtadas em
     advancePenScene); sobram ~0,85 s para ler o resultado e o placar da série
     — numa disputa completa de 10 cobranças, são ~8,5 s a menos de espera. */
  setTimeout(done,2500);
}
function completeShootoutAttempt(team,kicker,outcome){
  const s=shootoutState;if(!s)return;
  s.kicks[team]++;s.marks[team].push(outcome.ok);if(outcome.ok)s.score[team]++;
  const nm=esc((kicker.ref||kicker).n),txt=outcome.ok?`⚽ <b>${nm}</b> converte!`:outcome.result==='save'?`🧤 O goleiro pega a cobrança de <b>${nm}</b>!`:`❌ <b>${nm}</b> manda para fora!`;
  feed.unshift({min:'',txt,imp:true});latestEvent={txt,min:''};updateNarr();
  s.index++;
  /* PONTO 4: decidiu, acabou — 180 ms de respiro (era 550) e o cartão de
     resultado assume. O jogador não fica olhando para um gol vazio. */
  if(shootoutFinished(s)){penScene=null;setTimeout(()=>finishMatch(s.score.slice()),180);return;}
  nextShootoutKick();
}
function nextShootoutKick(){
  const s=shootoutState;if(!s)return;const team=s.index%2,kicker=s.orders[team][s.kicks[team]%s.orders[team].length],gk=s.orders[1-team].find(p=>p.isGK)||s.orders[1-team][0];
  const pressure=clamp(.24+s.index*.045,0,1);
  if(team===mySide){
    openSetPieceMinigame({kind:'shootout',team,taker:kicker,gk,pressure,resolve:input=>{
      const out=resolveShootoutAttempt(kicker,gk,input,pressure);presentShootoutKick(team,kicker,out,()=>completeShootoutAttempt(team,kicker,out));
    }});
  }else{
    const input={aimX:R(.12,.88),aimY:R(.14,.78),power:R(.58,.88),curve:R(-.22,.22)};
    const out=resolveShootoutAttempt(kicker,gk,input,pressure*.82);
    presentShootoutKick(team,kicker,out,()=>completeShootoutAttempt(team,kicker,out));
  }
}

function finishMatch(pens) {
  finished = true;
  playUXSound('end');
  cancelAnimationFrame(raf);
  /* ==========================================================================
     PONTO 4 · LIMPEZA IMEDIATA (reset acelerado)
     ==========================================================================
     Com o raf cancelado, qualquer overlay ainda vivo congelaria NA TELA por
     baixo do cartão de resultado (confete parado no ar, cena de falta pela
     metade, faixa de intervalo…). Zeramos aqui, de uma vez, todo o estado
     visual transitório da partida e pintamos UM último frame já limpo — o
     campo fica estático e organizado sob o painel de resultado, e a próxima
     partida nasce sem nenhum resíduo da anterior. Este é o "reset" pedido no
     briefing: síncrono, completo e sem setTimeout.
     ========================================================================== */
  celebration = null; replay = null;
  fkScene = null; penScene = null;
  breakOv = null; slowmo = null; goalFlash = null;
  vfx = []; trailPts = [];
  try { paintField(); } catch (_) {}
  const sc = [sim.score[0], sim.score[1]];
  CUP.recordPlayerMatch(G.cup, myMatch, sc, pens);
  const myS = sc[mySide], oppS = sc[1-mySide];
  const won  = pens ? pens[mySide] > pens[1-mySide] : myS > oppS;
  const draw = !pens && myS === oppS;
  const label = won ? '🏆 VITÓRIA!' : draw ? 'EMPATE' : '😞 DERROTA';
  const color = won ? 'var(--verde)' : draw ? 'var(--ouro)' : 'var(--rosa)';
  // atualiza relógio com FIM
  const ck = $('#clock');
  if (ck) { ck.textContent = 'FIM'; ck.style.color = color; }
  updateScore();
  feed.unshift({ min: sim.half>=3?120:90, txt:`<b>FIM DE JOGO!</b> ${label}`, imp:true, team:null });
  latestEvent = { txt:`<b>FIM DE JOGO!</b> ${label}`, min:'' };
  updateNarr(); if (tab==='lances') paintTabBody();
  // substitui barra de velocidade pelo painel de resultado (redesign §item1)
  const spdRow = document.querySelector('.spd-row');
  if (spdRow) {
    const craque = (() => { let bp=null,br=-1; for(const t of sim.teams)for(const q of t.players){if(!q.red&&(q.rating||6)>br){br=q.rating||6;bp=q;}} return bp; })();
    const st = sim.stats;
    const possTot = Math.max(0.1, (st[0].possTime||0) + (st[1].possTime||0));
    const poss = [Math.round((st[0].possTime||0) / possTot * 100), 0]; poss[1]=100-poss[0];
    const cA = teamColors[mySide], cB = teamColors[1-mySide];
    const nmA = clip(sim.teams[mySide].name||sim.teams[mySide].squad.c, 16), nmB = clip(sim.teams[1-mySide].name||sim.teams[1-mySide].squad.c, 16);
    const flA = sim.teams[mySide].flag || '⭐', flB = sim.teams[1-mySide].flag || '🏳️';
    const statRow = (lb, a, b) => `<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0"><span style="width:38px;text-align:right;font-weight:800;color:${cA}">${a}</span><span style="flex:1;text-align:center;color:#9fb0c8;font-size:11px;text-transform:uppercase;letter-spacing:.5px">${lb}</span><span style="width:38px;font-weight:800;color:${cB}">${b}</span></div>`;
    const shotDiff = `${st[mySide].shots}–${st[1-mySide].shots}`;
    const xgDiff = `${st[mySide].xg.toFixed(2)}–${st[1-mySide].xg.toFixed(2)}`;
    const passPctA = Math.round(st[mySide].passOk/Math.max(1,st[mySide].passes)*100);
    const passPctB = Math.round(st[1-mySide].passOk/Math.max(1,st[1-mySide].passes)*100);
    spdRow.innerHTML = `
      <div class="result-card" style="border:2px solid ${color};border-radius:18px;width:100%;padding:0;overflow:hidden;background:linear-gradient(180deg,rgba(10,16,30,.62),rgba(10,16,30,.94))">
        <div style="text-align:center;padding:14px 14px 8px"><div class="result-centerbox" style="border:none;background:transparent;padding:0"><div class="label" style="color:${color}">${label}</div>${pens?`<div style="margin-top:6px;color:${color};font-size:13px">Pênaltis ${pens[mySide]}–${pens[1-mySide]}</div>`:''}</div></div>
        <div class="result-hero-grid" style="padding:0 16px 12px"><div class="result-sidecard"><div class="team">${window.flagSvg(flA, 16)} <span>${esc(nmA)}</span></div><div class="bar" style="background:${cA}"></div></div><div class="result-centerbox"><div class="score">${myS}<span style="color:#4a5a78">–</span>${oppS}</div><div class="mut" style="margin-top:6px;font-size:12px">Resumo final da partida</div></div><div class="result-sidecard"><div class="team right"><span>${esc(nmB)}</span> ${window.flagSvg(flB, 16)}</div><div class="bar" style="background:${cB}"></div></div></div>
        <div class="result-kpis"><div class="result-kpi"><div class="k">Posse</div><div class="v">${poss[0]}% <span style="color:#4a5a78">×</span> ${poss[1]}%</div></div><div class="result-kpi"><div class="k">Chutes</div><div class="v">${shotDiff}</div></div><div class="result-kpi"><div class="k">xG</div><div class="v">${xgDiff}</div></div><div class="result-kpi"><div class="k">Passe certo</div><div class="v">${passPctA}% <span style="color:#4a5a78">×</span> ${passPctB}%</div></div></div>
        <div class="result-stat-grid"><section class="result-block"><div class="ttl">Comparativo</div>${statRow('No alvo', st[mySide].onTarget, st[1-mySide].onTarget)}${statRow('Escanteios', st[mySide].corners, st[1-mySide].corners)}${statRow('Passes certos', st[mySide].passOk, st[1-mySide].passOk)}${statRow('Desarmes', st[mySide].tackles, st[1-mySide].tackles)}${statRow('Interceptações', st[mySide].interceptions, st[1-mySide].interceptions)}${statRow('Faltas', st[mySide].fouls, st[1-mySide].fouls)}</section><section class="result-block"><div class="ttl">Destaque do jogo</div>${craque?`<div class="result-mvp"><div class="star">⭐</div><div style="flex:1"><div style="font-weight:800;font-size:15px;color:#eef3fb">${esc(craque.ref.n)}</div><div class="mut" style="font-size:12px;margin-top:2px">Craque da partida · nota ${(craque.rating||6).toFixed(1)}</div></div><div class="ovr ${ovrClass(craque.ref.r)}">${craque.ref.r}</div></div>`:'<div class="mut">Sem destaque definido.</div>'}</section></div>
        <div style="padding:0 16px 16px"><button class="btn btn-gold" id="bt-continue" style="width:100%;padding:14px 16px;font-size:15px;font-weight:800">CONTINUAR ›</button></div>
      </div>`;
    $('#bt-continue').onclick = () => {
      /* PONTO 4 · TRANSIÇÃO SÍNCRONA: o setTimeout(40 ms) que existia aqui só
         adiava o avanço da Copa sem nenhum ganho perceptível — o processamento
         (playGroupRound/playKnockoutStage + save) leva poucos milissegundos.
         Agora o clique desabilita o botão e navega NA MESMA pilha de execução:
         resposta instantânea entre "fim de partida" e "próxima tela". */
      $('#bt-continue').disabled = true; $('#bt-continue').textContent = '…';
      advanceAfterPlayerDone();
      window.UI.go('cup');
    };
  }
}

/* ─── AVANÇO DA COPA ─────────────────────────────────────────────────── */
function advanceAfterPlayerDone() {
  const cup = G.cup, db = G.db;
  if (cup.phase === 'groups') { CUP.playGroupRound(cup, db, false); CUP.advanceGroupRound(cup); }
  else if (cup.phase !== 'done') { CUP.playKnockoutStage(cup, db, false); if (CUP.stageComplete(cup)) CUP.advanceKnockout(cup); }
  if (window._saveCopa) window._saveCopa();   // L2: persiste o avanço da Copa após cada partida
}

/* ─── RENDER (HTML) ──────────────────────────────────────────────────── */
function render(A, B) {
  const fmA = G.formKey, fmB = B.formKey || '4-3-3';
  document.querySelector('#app').innerHTML = `
    <div class="mh" id="mh">
      <div class="mh-side">
        <span class="mh-flag" aria-hidden="true">${window.flagSvg(A.flag, 24)}</span>
        <div class="mh-team-copy">
          <div class="mh-name">${esc(clip(A.name||A.squad.c, 22))}</div>
          <div class="mh-form mut">${fmA}</div>
        </div>
      </div>
      <div class="mh-center">
        <div class="mh-sc" id="score">${sim.score[0]}–${sim.score[1]}</div>
        <div class="mh-ck" id="clock">${(() => { const mm = Math.floor(sim.minute), ss = Math.floor((sim.minute - mm) * 60); const ph = ['', '1ºT', '2ºT', 'PR1', 'PR2'][sim.half] || ''; return `${ph} ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; })()}</div>
      </div>
      <div class="mh-side right">
        <div class="mh-team-copy ta-r">
          <div class="mh-name">${esc(clip(B.name||B.squad.c, 22))}</div>
          <div class="mh-form mut">${fmB}</div>
        </div>
        <span class="mh-flag" aria-hidden="true">${window.flagSvg(B.flag, 24)}</span>
      </div>
    </div>

    <div class="spd-row" aria-label="Velocidade da partida">
      ${SPEEDS.map(s=>`<button class="spd spdbtn ${G.speed===s.v?'on':''}" data-spd="${s.v}" title="Velocidade ${s.k}">${s.k}</button>`).join('')}
      <button class="spd spdbtn" id="bt-pause" title="Pausar ou continuar" aria-label="Pausar ou continuar">Ⅱ</button>
    </div>

    <div class="statsbar statsb" id="statsb">
      <div class="poss-wrap sb-poss">
        <span id="pA" class="poss-label" style="color:${A.color}">50%</span>
        <div class="poss-track sb-track">
          <div id="pbA" style="background:${A.color};width:50%;height:100%;border-radius:3px 0 0 3px;transition:width .5s"></div>
          <div id="pbB" style="background:${B.color};width:50%;height:100%;border-radius:0 3px 3px 0;transition:width .5s"></div>
        </div>
        <span id="pB" class="poss-label" style="color:${B.color}">50%</span>
      </div>
      <div class="quick-stat sb-nums">
        <span class="sbn"><b id="sA">0</b>–<b id="sB">0</b> chutes</span>
        <span class="sbn"><b id="oA">0</b>–<b id="oB">0</b> no alvo</span>
        <span class="sbn"><b id="cA">0</b>–<b id="cB">0</b> escanteios</span>
      </div>
      <div class="momentum-strip"><span>Momentum</span><canvas id="momcv" width="1024" height="20"></canvas></div>
    </div>
    <div id="tline" class="tline"></div>

    <div class="field-wrap">
      <canvas id="fieldcv" width="1024" height="500" aria-label="Campo da partida com câmera dinâmica"></canvas>
      <div id="narr" class="narr"></div>
      <div id="setpiece-ui"></div>
    </div>
    <div class="match-scroll-hint" aria-hidden="true">Arraste para cima para ver estatísticas, elenco e tática</div>

    <nav class="mtabs" aria-label="Informações e comandos da partida">
      <button class="mt on" data-mt="campo" aria-selected="true"><span class="mt-icon">◉</span><span>Visão geral</span></button>
      <button class="mt" data-mt="stats" aria-selected="false"><span class="mt-icon">▥</span><span>Estatísticas</span></button>
      <button class="mt" data-mt="adv" aria-selected="false"><span class="mt-icon">VS</span><span>Adversário</span></button>
      <button class="mt" data-mt="elenco" aria-selected="false"><span class="mt-icon">♟</span><span>Elenco</span></button>
      <button class="mt" data-mt="tatica" aria-selected="false"><span class="mt-icon">✦</span><span>Tática</span></button>
    </nav>
    <div id="tbody" class="tbody" aria-live="polite"></div>`;

  bindControls();
  if (sim && sim.setInteractive) sim.setInteractive(mySide);
  paintTabBody();
  paintField();
}

function clip(s, n) { return !s || s.length<=n ? s : s.slice(0,n-1)+'…'; }

function bindControls() {
  document.querySelectorAll('[data-spd]').forEach(b => b.onclick = () => {
    G.speed = +b.dataset.spd;
    document.querySelectorAll('[data-spd]').forEach(x => x.classList.toggle('on', +x.dataset.spd === G.speed));
  });
  const bp = $('#bt-pause');
  if (bp) bp.onclick = () => {
    paused = !paused; bp.textContent = paused ? '▶' : '⏸';
    bp.classList.toggle('on', paused);
    if (!paused) lastT = performance.now();
  };
  document.querySelectorAll('.mt').forEach(b => b.onclick = () => {
    const app=$('#app');
    const drawerMode=window.matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
    const closing=drawerMode && b.dataset.mt===tab && app.classList.contains('match-panel-open');
    if(closing){app.classList.remove('match-panel-open');return;}
    tab = b.dataset.mt;
    document.querySelectorAll('.mt').forEach(x => {
      const active = x.dataset.mt === tab;
      x.classList.toggle('on', active);
      x.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    paintTabBody();
    if(drawerMode)app.classList.add('match-panel-open');
    if (!drawerMode && window.matchMedia('(min-width: 900px)').matches) {
      requestAnimationFrame(() => $('#tbody')?.scrollIntoView({ behavior:'smooth', block:'start' }));
    } else if (!drawerMode && window.matchMedia('(max-width: 899px) and (orientation: portrait)').matches) {
      requestAnimationFrame(() => document.querySelector('.mtabs')?.scrollIntoView({ behavior:'smooth', block:'start' }));
    }
  });
  const field=$('#fieldcv');
  if(field){
    field.addEventListener('click',()=>{
      if(window.matchMedia('(orientation: landscape) and (max-height: 600px)').matches)$('#app').classList.remove('match-panel-open');
    });
    /* ========================================================================
       PONTO 2 · GESTO DE CÂMERA — "arrastar para baixo = ver o campo todo"
       ========================================================================
       Implementado com Pointer Events (unifica toque, caneta e mouse — sem o
       clássico bug de mousedown sem fallback de touchstart) e registrado via
       addEventListener em canal PRÓPRIO: os handlers de bola parada usam as
       propriedades on*, então os dois sistemas coexistem sem se sobrescrever.
       Regras do gesto:
         · Só em telas móveis (desktop >=900px mantém campo integral fixo).
         · Ignorado durante bola parada (classe .sp-active no canvas): ali o
           arraste pertence ao chute.
         · Braço do gesto: 44 px de deslocamento vertical PARA BAIXO a partir
           do toque → camHold=true (panorâmica). Subir de volta acima de 18 px
           ou soltar/cancelar o ponteiro → camHold=false e a câmera retorna à
           visão aproximada sozinha (a transição vive em paintField).
         · Listeners passivos: o gesto nunca bloqueia o compositor de rolagem;
           o CSS do Ponto 2 (touch-action:none no canvas móvel) é quem entrega
           o toque do gramado inteiro para nós.
         · pointerup também é ouvido em window: se o dedo escorregar para fora
           do canvas, o estado não fica preso em "panorâmica". */
    let camPid = null, camY0 = 0, camArmed = false;
    field.addEventListener('pointerdown', ev => {
      if (field.classList.contains('sp-active')) return;               // bola parada manda
      if (window.matchMedia('(min-width: 900px)').matches) return;     // desktop: campo fixo
      /* TÓPICO 2 · no retrato o campo é uma mesa tática ESTÁTICA: nenhum
         gesto de câmera é armado, então tocar/arrastar sobre o gramado
         nunca desloca a visão nem conflita com os botões de tática. */
      if (isPortraitPhone()) return;
      camPid = ev.pointerId; camY0 = ev.clientY; camArmed = false;
    }, { passive: true });
    field.addEventListener('pointermove', ev => {
      if (camPid !== ev.pointerId) return;
      const dy = ev.clientY - camY0;
      if (dy > 44) { camHold = true; camArmed = true; }                 // abriu a panorâmica
      else if (camArmed && dy < 18) { camHold = false; }               // recolheu o gesto
    }, { passive: true });
    const camEnd = ev => { if (camPid === ev.pointerId) { camPid = null; camHold = false; } };
    field.addEventListener('pointerup', camEnd, { passive: true });
    field.addEventListener('pointercancel', camEnd, { passive: true });
    window.addEventListener('pointerup', camEnd, { passive: true });
  }
}

/* ─── CANVAS ──────────────────────────────────────────────────────────── */
const CW=1024, CH=500, M=14;
const cx = x => M + x*(CW-M*2);
const cy = y => M + y*(CH-M*2);
const fW = CW-M*2, fH = CH-M*2;

/* ============================================================================
   PONTO 3 · CANVAS EM TELAS DE ALTA DENSIDADE — syncCanvasResolution()
   ============================================================================
   O canvas nascia com backing store fixo de 1024×500 e era esticado por CSS.
   Em celulares com devicePixelRatio 2–3 isso causava dois problemas:
     (a) imagem borrada (1 pixel lógico virava 2–3 pixels físicos interpolados);
     (b) em alguns WebViews Android o par "backing pequeno + CSS gigante +
         getContext tardio" devolvia contexto nulo — e o jogo congelava mudo,
         exatamente o sintoma reportado no mobile.
   Estratégia adotada:
     · O MUNDO LÓGICO continua sendo 1024×500 — nenhuma outra função do jogo
       precisa saber de DPR. Só o backing store muda de tamanho.
     · k = (larguraCSS × dpr) / 1024, com trava em 2.5: acima disso o ganho
       visual é nulo e o iOS começa a recusar canvases grandes (limite de
       ~16,7 mi de pixels por elemento).
     · A razão 1024:500 é preservada no atributo width/height, então o layout
       (que deriva o aspecto dos atributos) não se move um pixel.
     · k é quantizado em passos de 0.05 para não realocar o backing store a
       cada flutuação de subpixel do layout.
   paintField consome cv._k como transform base — ver comentário lá.
   ============================================================================ */
function syncCanvasResolution(cv){
  try{
    const rect = cv.getBoundingClientRect();
    const cssW = rect.width || CW;                       // 0 => usa o lógico
    const dpr  = Math.min(window.devicePixelRatio || 1, 2.5);
    let k = clamp((cssW * dpr) / CW, .75, 2.5);
    k = Math.round(k * 20) / 20;                         // quantiza (passos .05)
    if (cv._k === k) return;                             // nada mudou: não realoca
    cv._k = k;
    cv.width  = Math.max(1, Math.round(CW * k));
    cv.height = Math.max(1, Math.round(CH * k));
  }catch(_){ cv._k = cv._k || 1; }
}

function paintField() {
  const cv = $('#fieldcv'); if (!cv) return;
  /* PONTO 3 · GUARDA DE CONTEXTO: getContext('2d') PODE devolver null em
     WebViews com aceleração quebrada ou memória de GPU esgotada. Antes isso
     estourava um TypeError silencioso dentro do rAF e o jogo "morria" sem
     mensagem. Agora avisamos uma única vez no banner de diagnóstico e saímos
     limpo do frame. */
  const ctx = cv.getContext('2d');
  if (!ctx) {
    if (window.__showBootError && !paintField._ctxWarned) {
      paintField._ctxWarned = true;
      window.__showBootError('Canvas 2D indisponível neste navegador/WebView.');
    }
    return;
  }

  /* PONTO 3 · SINCRONIZAÇÃO DPR: reavalia o backing store (i) na primeira
     pintura, (ii) quando resize/rotação marcou _dprDirty e (iii) a cada ~90
     frames como rede de segurança para mudanças de layout que não disparam
     resize (barras do navegador móvel recolhendo, por exemplo). O transform
     base do frame passa a ser a escala k — todo o restante do código continua
     desenhando em coordenadas lógicas 1024×500 sem saber que o DPR existe. */
  if (_dprDirty || !cv._k || ((paintField._t = (paintField._t || 0) + 1) % 90 === 0)) {
    syncCanvasResolution(cv);
    _dprDirty = false;
  }
  const _K = cv._k || 1;
  ctx.setTransform(_K, 0, 0, _K, 0, 0);
  ctx.clearRect(0, 0, CW, CH);
  // cenas dedicadas têm prioridade total sobre o campo
  if (fkScene && performance.now() < fkScene.until) { drawFkScene(ctx); return; }
  if (penScene && performance.now() < penScene.until) { drawPenScene(ctx); return; }

  /* Desktop: campo inteiro e estável. Em telas menores, a câmera original
     continua acompanhando a bola para preservar a legibilidade móvel. */
  const desktopFullField = window.matchMedia('(min-width: 900px)').matches;
  const visualNow = performance.now();
  const rframe = (replay && celebration && visualNow >= (celebration.start || 0) && visualNow < celebration.replayUntil)
    ? replay.frames[Math.min(Math.floor(replay.idx), replay.frames.length - 1)] : null;
  ctx.save();
  if (!desktopFullField) {
    if (rframe) {
      const tx = cx(rframe.ball.x), ty = cy(rframe.ball.y);
      camX += (tx - camX) * 0.12; camY += (ty - camY) * 0.12;
    } else if (sim) {
      const sb = sim.getState().ball;
      const tx = cx(sb.x), ty = cy(sb.y);
      camX += (tx - camX) * 0.055;
      camY += (ty - camY) * 0.055;
    }
    /* PONTO 2 · MISTURA FECHADA↔PANORÂMICA:
       1. camOverviewT persegue o alvo (camHold ? 1 : 0) com ganho .16/frame —
          decaimento exponencial: acelera no início, assenta macio no fim.
       2. tEase aplica smoothstep sobre o interpolador para eliminar qualquer
          quina perceptível na largada/chegada do movimento.
       3. z interpola entre camBaseZoom() (1.55 retrato / 1.35 paisagem) e 1.0
          (campo inteiro). Com z=1, o clamp de cpx/cpy abaixo colapsa a câmera
          exatamente no centro do campo — a panorâmica é matematicamente o
          próprio limite do sistema de follow, sem caso especial. */
    camOverviewT += ((camHold ? 1 : 0) - camOverviewT) * .16;
    if (camOverviewT < .002) camOverviewT = 0;
    const tEase = camOverviewT * camOverviewT * (3 - 2 * camOverviewT);
    const zClose = camBaseZoom();
    const z = zClose + (1 - zClose) * tEase;
    const vw = CW / z, vh = CH / z;
    const cpx = Math.max(vw / 2, Math.min(CW - vw / 2, camX));
    const cpy = Math.max(vh / 2, Math.min(CH - vh / 2, camY));
    ctx.translate(CW / 2, CH / 2);
    ctx.scale(z, z);
    ctx.translate(-cpx, -cpy);
  } else {
    camX = CW / 2;
    camY = CH / 2;
  }

  /* gramado listrado */
  const nS = 8, sw = fW/nS;
  for (let i=0;i<nS;i++) {
    ctx.fillStyle = i%2===0 ? '#1b7a36' : '#177030';
    ctx.fillRect(M+i*sw, M, sw, fH);
  }

  /* marcações */
  ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(M, M, fW, fH);
  ctx.beginPath(); ctx.moveTo(CW/2,M); ctx.lineTo(CW/2,CH-M); ctx.stroke();
  // círculo central
  ctx.beginPath(); ctx.arc(CW/2, CH/2, (9.15/68)*fH, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(CW/2,CH/2,2.5,0,Math.PI*2); ctx.fill();
  // áreas de penalti
  const paW=(16.5/105)*fW, paH=(40.32/68)*fH;
  ctx.strokeRect(M,(CH-paH)/2,paW,paH);
  ctx.strokeRect(CW-M-paW,(CH-paH)/2,paW,paH);
  // áreas pequenas
  const gaW=(5.5/105)*fW, gaH=(18.32/68)*fH;
  ctx.strokeRect(M,(CH-gaH)/2,gaW,gaH);
  ctx.strokeRect(CW-M-gaW,(CH-gaH)/2,gaW,gaH);
  // pênaltis
  const psW=(11/105)*fW;
  ctx.fillStyle='rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.arc(M+psW,CH/2,2.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(CW-M-psW,CH/2,2.5,0,Math.PI*2); ctx.fill();
  // arcos de canto
  const ca=5;
  ctx.beginPath(); ctx.arc(M,M,ca,0,Math.PI/2); ctx.stroke();
  ctx.beginPath(); ctx.arc(CW-M,M,ca,Math.PI/2,Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(M,CH-M,ca,-Math.PI/2,0); ctx.stroke();
  ctx.beginPath(); ctx.arc(CW-M,CH-M,ca,Math.PI,3*Math.PI/2); ctx.stroke();
  // goleiras
  const goalH=(7.32/68)*fH;
  ctx.fillStyle='rgba(255,255,255,.9)';
  ctx.fillRect(M-7,(CH-goalH)/2,7,goalH);
  ctx.fillRect(CW-M,(CH-goalH)/2,7,goalH);
  ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=.8;
  ctx.strokeRect(M-7,(CH-goalH)/2,7,goalH);
  ctx.strokeRect(CW-M,(CH-goalH)/2,7,goalH);

  if (!sim) return;
  const st = sim.getState();

  // fonte de desenho: durante o replay, usa o frame gravado
  const playersToDraw = rframe
    ? rframe.p.map(pl => ({ x: pl.x, y: pl.y, color: pl.c, num: pl.num, slot: pl.gk ? 'GK' : '', hasBall: pl.ball, n: '', yellow: 0, red: false }))
    : null;

  /* rastro da bola (só ao vivo) — mais visível, com brilho */
  if (!rframe) { ctx.save(); ctx.shadowColor = 'rgba(255,215,50,.9)';
    trailPts.forEach((tp, i) => {
      const f = 1 - i / trailPts.length;
      ctx.shadowBlur = 9 * f;
      ctx.fillStyle = `rgba(255,226,80,${f * 0.75})`;
      ctx.beginPath(); ctx.arc(cx(tp.x), cy(tp.y), Math.max(0, 4.6 - i * .5), 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();
  }

  /* jogadores — agrupa por "time" (ao vivo) ou lista única (replay) */
  const groups = playersToDraw
    ? [{ color: null, players: playersToDraw }]
    : st.teams.map(t => ({ color: t.color, players: t.players }));
  for (const tmSt of groups) {
    const C = tmSt.color || (tmSt.players[0] && tmSt.players[0].color) || '#2e9bff';
    const perPlayerColor = !tmSt.color;   // no replay cada jogador traz sua cor
    for (const p of tmSt.players) {
      if (p.red) continue;
      const pc = perPlayerColor ? (p.color || '#2e9bff') : C;
      const isGold = pc === '#ffcb45';
      const numCol = isGold ? '#3a2000' : '#ffffff';
      const gkC   = isGold ? '#7a5000' : '#0a2d6a';
      // #anti-cardume (VISUAL): leve balanço de corrida PERPENDICULAR ao movimento,
      // com ritmo próprio por jogador (fase pelo número). Só no DESENHO — a posição
      // real (física) não muda, o equilíbrio fica intacto — mas quebra o efeito de
      // "bloco andando junto": cada um oscila no seu tempo enquanto corre.
      let _rx = cx(p.x), _ry = cy(p.y);
      const _pk = p.ref && p.ref.n;
      if (_pk) {
        const _pp = _prevScreen[_pk];
        if (_pp) {
          const _dx = _rx - _pp.x, _dy = _ry - _pp.y, _sp = Math.hypot(_dx, _dy);
          if (_sp > 0.06) {
            const _ang = Math.atan2(_dy, _dx) + Math.PI / 2, _mv = Math.min(1, _sp / 2.2), _tt = performance.now() / 1000;
            const _amp = Math.sin(_tt * (14 + (p.num % 5) * 2.4) + p.num * 1.7) * 2.2 * _mv;
            _rx += Math.cos(_ang) * _amp; _ry += Math.sin(_ang) * _amp;
          }
        }
        _prevScreen[_pk] = { x: cx(p.x), y: cy(p.y) };
      }
      const groundX=_rx, groundY=_ry;
      let x=groundX, y=groundY, r=13, divePose=false, actionWave=0;
      const motion = activeMotion(p, visualNow);
      if (motion) {
        const phase = Math.max(0, Math.min(1, (visualNow - motion.start) / (motion.until - motion.start)));
        actionWave = Math.sin(Math.PI * phase);
        if (motion.type === 'jump') { y -= actionWave * 11; r += actionWave * 3.2; }
        else if (motion.type === 'claim') { y -= actionWave * 8; r += actionWave * 4; }
        else if (motion.type === 'dive') { y += motion.dir * actionWave * 27; x += actionWave * 3; divePose = true; }
      }

      // A sombra fica no gramado; o corpo se separa dela no salto/pulo.
      ctx.save(); ctx.globalAlpha=.25;
      ctx.beginPath(); ctx.ellipse(groundX,groundY+5,r*(1+actionWave*.18),r*.72,0,0,Math.PI*2);
      ctx.fillStyle='#000'; ctx.fill(); ctx.restore();

      // aura (dono da bola)
      if (p.hasBall) {
        ctx.save(); ctx.globalAlpha=.28;
        ctx.beginPath(); ctx.arc(x,y,r+9,0,Math.PI*2);
        ctx.fillStyle=pc; ctx.fill(); ctx.restore();
      }

      // aura de LENDA: anel dourado pulsante (r>=92); brilho forte se em chamas
      const isLegend = p.ref && p.ref.legend;
      if (isLegend) {
        const pulse = 2 + Math.sin(performance.now()/300)*1.2;
        ctx.save();
        ctx.strokeStyle = p._onFire ? '#ffd970' : 'rgba(255,203,69,.85)';
        ctx.lineWidth = p._onFire ? 3 : 2;
        ctx.shadowColor = '#ffcb45'; ctx.shadowBlur = p._onFire ? 14 : 7;
        ctx.beginPath(); ctx.arc(x, y, r + 3.5 + pulse*0.4, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
      // corpo: no mergulho do goleiro vira uma elipse lateral, deixando o pulo
      // legível sem alterar a posição física usada pelo motor.
      ctx.beginPath();
      if (divePose) ctx.ellipse(x,y,r*1.42,r*.72,Math.PI/2,0,Math.PI*2);
      else ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle = p.slot==='GK' ? gkC : pc; ctx.fill();

      // borda
      ctx.lineWidth = p.hasBall ? 2.5 : 1.5;
      ctx.strokeStyle = p.hasBall ? '#fff' : 'rgba(255,255,255,.42)';
      ctx.stroke();

      if (motion && (motion.type === 'claim' || motion.type === 'dive')) {
        ctx.save(); ctx.strokeStyle = p.slot==='GK' ? '#ffcb45' : '#fff'; ctx.lineWidth=3;
        ctx.beginPath();
        if (motion.type === 'dive') { ctx.moveTo(x-10,y); ctx.lineTo(x+10,y); }
        else { ctx.moveTo(x-15,y-5); ctx.lineTo(x+15,y-5); }
        ctx.stroke(); ctx.restore();
      }

      // cartão amarelo (flag no ombro)
      if (p.yellow>=1) { ctx.fillStyle='#ffcb45'; ctx.fillRect(x+r-6,y-r-3,5,7); }

      // número da camisa
      ctx.fillStyle = numCol;
      ctx.font = `bold 10px Arial,sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.num||'', x, y);

      // sobrenome em pill escuro — INTELIGENTE: só perto da bola (ou em 1X),
      // pra 22 chips não virarem poluição no movimento (leitura estilo FM)
      const _bs = st.ball;
      const _bd = Math.hypot(x - cx(_bs.x), y - cy(_bs.y));
      if (G.speed <= 0.61 || _bd < 92) {
      const nm = lastWord(p.n, 9);
      ctx.font = `bold 7.5px Arial,sans-serif`;
      const tw = ctx.measureText(nm).width;
      const pw = tw + 8, ph2 = 11, py2 = y + r + 2;
      ctx.fillStyle = 'rgba(4,8,18,.78)';
      ctx.beginPath();
      ctx.roundRect(x - pw/2, py2, pw, ph2, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(nm, x, py2 + ph2/2 + 0.5);
      }
    }
  }

  /* trajetória: passe tracejado amarelo / chute linha branca */
  const bT = st.ball;
  if (bT.traveling && bT.from && bT.target) {
    const x1=cx(bT.from.x), y1=cy(bT.from.y), x2=cx(bT.target.x), y2=cy(bT.target.y);
    ctx.save();
    if (bT.kind === 'shot') {
      ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=2; ctx.setLineDash([]);
    } else {
      ctx.strokeStyle='rgba(255,220,40,.9)'; ctx.lineWidth=2; ctx.setLineDash([7,6]);
    }
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    // ponta de seta
    const ang=Math.atan2(y2-y1,x2-x1);
    ctx.setLineDash([]);
    ctx.fillStyle = bT.kind==='shot' ? 'rgba(255,255,255,.85)' : 'rgba(255,220,40,.95)';
    ctx.beginPath();
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-9*Math.cos(ang-0.42), y2-9*Math.sin(ang-0.42));
    ctx.lineTo(x2-9*Math.cos(ang+0.42), y2-9*Math.sin(ang+0.42));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* efeitos por tipo de lance */
  for (const v of vfx) {
    const a = Math.max(0, v.ttl / v.max);
    const x = cx(v.x), y = cy(v.y);
    ctx.save(); ctx.globalAlpha = a;
    if (v.type === 'ring') {                     // drible: onda dupla expansiva
      ctx.strokeStyle = `rgba(125,240,255,${a})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 16 + (1-a)*16, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = `rgba(125,240,255,${a*0.5})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 22 + (1-a)*22, 0, Math.PI*2); ctx.stroke();
    } else if (v.type === 'star') {              // desarme
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (let i=0;i<4;i++){ const an=i*Math.PI/2+0.6;
        ctx.beginPath(); ctx.moveTo(x+8*Math.cos(an),y+8*Math.sin(an));
        ctx.lineTo(x+(15+(1-a)*7)*Math.cos(an),y+(15+(1-a)*7)*Math.sin(an)); ctx.stroke(); }
    } else if (v.type === 'foul') {              // falta
      ctx.font='bold 22px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('❌', x, y - 24 - (1-a)*8);
    } else if (v.type === 'save') {              // defesa
      ctx.strokeStyle='#ffcb45'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x, y, 22, -1.1, 1.1); ctx.stroke();
      ctx.font='bold 17px Arial'; ctx.textAlign='center'; ctx.fillText('🧤', x, y-30);
    } else if (v.type === 'post') {              // trave
      ctx.font='bold 20px Arial'; ctx.textAlign='center'; ctx.fillText('💥', x, y-20);
    } else if (v.type === 'card') {
      ctx.fillStyle='#ffcb45'; ctx.fillRect(x-6, y-38-(1-a)*10, 12, 17);
      ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.strokeRect(x-6, y-38-(1-a)*10, 12, 17);
    } else if (v.type === 'redcard') {
      ctx.fillStyle='#e23a3a'; ctx.fillRect(x-6, y-38-(1-a)*10, 12, 17);
      ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.strokeRect(x-6, y-38-(1-a)*10, 12, 17);
    } else if (v.type === 'dust') {              // poeira do drible (partículas)
      ctx.fillStyle = `rgba(220,230,255,${a*0.5})`;
      for (let i=0;i<5;i++){ const an=i*1.25+v.max; const d=(1-a)*16;
        ctx.beginPath(); ctx.arc(x-Math.cos(an)*d, y-Math.sin(an)*d, 2.5*a, 0, Math.PI*2); ctx.fill(); }
    } else if (v.type === 'cut') {               // interceptação: linha cortada
      ctx.strokeStyle='#7df0ff'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(x-12,y-12+(1-a)*6); ctx.lineTo(x+12,y+12-(1-a)*6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+12,y-12+(1-a)*6); ctx.lineTo(x-12,y+12-(1-a)*6); ctx.stroke();
    } else if (v.type === 'block') {             // bloqueio de chute
      ctx.strokeStyle='#ffcb45'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x, y, 10+(1-a)*8, 0, Math.PI*2); ctx.stroke();
      ctx.font='bold 14px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🛡️', x, y);
    } else if (v.type === 'arrow') {             // cruzamento
      ctx.strokeStyle=`rgba(255,203,69,${a})`; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+12,y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+12,y); ctx.lineTo(x+6,y-5); ctx.moveTo(x+12,y); ctx.lineTo(x+6,y+5); ctx.stroke();
    } else if (v.type === 'corner') {            // preparação do escanteio
      const pulse = 18 + (1-a)*16;
      ctx.strokeStyle=`rgba(255,203,69,${a})`; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([5,4]); ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(x, y, pulse+9, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      ctx.font="bold 13px 'Barlow Condensed',Arial"; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#ffcb45';
      ctx.fillText('ESCANTEIO', Math.max(60,Math.min(CW-60,x)), y < CH/2 ? y+38 : y-34);
    } else if (v.type === 'head') {              // cabeçada de defesa
      ctx.font='bold 15px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🗣️', x, y-22-(1-a)*6);
    } else if (v.type === 'fire') {              // momento de lenda
      for (let ri=0;ri<3;ri++){
        ctx.strokeStyle=`rgba(255,203,69,${a*(1-ri*0.28)})`; ctx.lineWidth=3-ri*0.8;
        ctx.beginPath(); ctx.arc(x, y, 14+ri*8+(1-a)*22, 0, Math.PI*2); ctx.stroke();
      }
      ctx.font='bold 16px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⭐', x, y-26-(1-a)*8);
    } else if (v.type === 'miss') {              // finalização pra fora
      ctx.strokeStyle=`rgba(160,175,205,${a})`; ctx.lineWidth=2; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /* bola */
  const b = rframe ? rframe.ball : st.ball;
  const bx=cx(b.x), by=cy(b.y)-(b.z||0)*22;
  // #brilho da bola — halo suave que facilita seguir a jogada
  ctx.save();
  const _bhalo = ctx.createRadialGradient(bx, by, 0, bx, by, 15);
  _bhalo.addColorStop(0, 'rgba(255,238,140,.5)'); _bhalo.addColorStop(1, 'rgba(255,238,140,0)');
  ctx.fillStyle = _bhalo; ctx.beginPath(); ctx.arc(bx, by, 15, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha=.28;
  ctx.beginPath(); ctx.arc(cx(b.x),cy(b.y)+3,5,0,Math.PI*2);
  ctx.fillStyle='#000'; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(bx,by,7,0,Math.PI*2);
  const bg=ctx.createRadialGradient(bx-2.5,by-2.5,0,bx,by,7);
  bg.addColorStop(0,'#ffffff'); bg.addColorStop(1,'#c8c8c8');
  ctx.fillStyle=bg; ctx.fill();
  ctx.strokeStyle='#444'; ctx.lineWidth=.8; ctx.stroke();
  // costura
  ctx.strokeStyle='rgba(80,80,80,.5)'; ctx.lineWidth=.5;
  ctx.beginPath(); ctx.arc(bx,by,4,0,Math.PI*2); ctx.stroke();

  ctx.restore();   // fim do mundo com câmera

  // #impacto — FLASH DE GOL (estava criado mas nunca desenhado): a tela pisca
  // forte no momento do gol e some rápido. Em espaço de tela, por cima do campo.
  if (goalFlash && goalFlash.alpha > 0.01) {
    ctx.fillStyle = 'rgba(255,255,255,' + (goalFlash.alpha * 0.5) + ')';
    ctx.fillRect(0, 0, CW, CH);
  }

  // SELO DE REPLAY (durante a janela de replay do gol)
  if (rframe) {
    // barras cinematográficas
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, CW, 22); ctx.fillRect(0, CH-22, CW, 22);
    // badge REPLAY piscando
    const blink = (Math.floor(performance.now()/400) % 2) === 0;
    ctx.save();
    ctx.fillStyle = blink ? '#ff4d6d' : '#c0223e';
    ctx.beginPath(); ctx.arc(20, 34, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold 13px 'Barlow Condensed',Arial,sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('REPLAY', 30, 34);
    ctx.restore();
  }

  // OVERLAY DE INTERVALO/PRORROGAÇÃO (pausa dramática com aviso de troca de lado)
  if (breakOv && performance.now() < breakOv.until) {
    ctx.fillStyle='rgba(6,12,28,.78)'; ctx.fillRect(0, CH*0.34, CW, CH*0.32);
    ctx.textAlign='center'; ctx.shadowColor='rgba(0,0,0,.9)'; ctx.shadowBlur=10;
    ctx.font="700 34px 'Anton',sans-serif"; ctx.fillStyle='#ffcb45';
    ctx.fillText(breakOv.t1, CW/2, CH*0.46);
    ctx.font="bold 15px 'Barlow Condensed',sans-serif"; ctx.fillStyle='#e8edf7';
    ctx.fillText(breakOv.t2, CW/2, CH*0.55);
    ctx.shadowBlur=0;
  }

  /* flash de gol (tela cheia, fora do zoom) */
  // COMEMORAÇÃO DE GOL: overlay dramático (nome, placar, confete)
  if (celebration && visualNow >= (celebration.start || 0) && !rframe) {
    const C2 = celebration.color || '#ffcb45';
    const isG = C2 === '#ffcb45';
    ctx.save();
    // véu escuro + faixa da cor do time
    ctx.fillStyle = 'rgba(4,8,18,.72)'; ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle = C2; ctx.globalAlpha = 0.16; ctx.fillRect(0, CH*0.30, CW, CH*0.40);
    ctx.globalAlpha = 1;
    // confete
    for (const c of celebration.confetti) {
      ctx.save(); ctx.translate(cx(c.x), cy(c.y)); ctx.rotate(c.spin);
      ctx.fillStyle = c.c; ctx.fillRect(-c.r/2, -c.r/2, c.r, c.r*1.6); ctx.restore();
    }
    // GOL / GOLAÇO
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=16;
    ctx.font=`700 62px 'Anton',Arial Black,sans-serif`;
    ctx.fillStyle = C2;
    ctx.fillText(celebration.mine ? 'GOOOL!' : 'GOL', CW/2, CH*0.36);
    // nome do goleador
    ctx.shadowBlur=10;
    ctx.font=`bold 26px 'Barlow Condensed',Arial,sans-serif`;
    ctx.fillStyle='#ffffff';
    ctx.fillText(celebration.scorer.toUpperCase(), CW/2, CH*0.54);
    // placar + minuto
    ctx.font=`700 20px 'Anton',sans-serif`;
    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.fillText(`${celebration.hName} ${sim.score[0]} – ${sim.score[1]} ${celebration.aName}`, CW/2, CH*0.66);
    ctx.font=`bold 13px 'Barlow Condensed',sans-serif`;
    ctx.fillStyle=C2;
    ctx.fillText(`${celebration.min}'`, CW/2, CH*0.74);
    ctx.shadowBlur=0;
    ctx.restore();
  } else if (goalFlash && goalFlash.alpha>0.02) {
    // brilho residual após a comemoração
    const alpha = goalFlash.alpha;
    const C2 = st.teams[goalFlash.team]?.color || '#ffcb45';
    ctx.save(); ctx.globalAlpha = alpha*0.28;
    ctx.fillStyle = C2; ctx.fillRect(0,0,CW,CH);
    ctx.restore();
  }
}

/* ─── ATUALIZAÇÕES UI ─────────────────────────────────────────────────── */
function updateScore() {
  const el=$('#score'); if(!el||!sim) return;
  el.textContent=`${sim.score[0]}–${sim.score[1]}`;
}
function updateClock() {
  const el=$('#clock'); if(!el||!sim) return;
  const st=sim.getState();
  const mm=Math.floor(sim.minute), ss=Math.floor((sim.minute-mm)*60);
  const ph=['','1ºT','2ºT','PR1','PR2'][st.half]||'';
  el.textContent=`${ph} ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  const myS=sim.score[mySide], oppS=sim.score[1-mySide];
  const losing = myS<oppS && st.minute>75;
  el.classList.toggle('urgent', losing);
  if (!losing) el.style.color='';
}
function updateNarr() {
  const el=$('#narr'); if(!el||!latestEvent) return;
  const min = latestEvent.min!==''&&latestEvent.min!==undefined ? `<span class="narr-min">${latestEvent.min}'</span>` : '';
  el.innerHTML = min + latestEvent.txt;
}
function paintMom(){
  const cv=$('#momcv'); if(!cv) return; const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height; ctx.clearRect(0,0,W,H);
  const mid=H/2;
  const bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,'rgba(255,255,255,.06)'); bg.addColorStop(1,'rgba(255,255,255,.02)');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,mid+.5); ctx.lineTo(W,mid+.5); ctx.stroke();
  const n=momHist.length; if(!n) return; const bw=W/110;
  for(let i=0;i<n;i++){ const m=momHist[i], h=Math.min(H/2-1,Math.abs(m)*(H/2-1)), x=i*bw; const c=m>=0?teamColors[0]:teamColors[1]; const y=m>=0?mid-h:mid; const grad=ctx.createLinearGradient(0,y,0,m>=0?mid:y+h); grad.addColorStop(0,c); grad.addColorStop(1,'rgba(255,255,255,.22)'); ctx.fillStyle=grad; ctx.fillRect(x,y,Math.max(1,bw-1),h); ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(x,y,Math.max(1,bw-1),1.1); }
  ctx.fillStyle='rgba(255,255,255,.06)'; for(let x=0;x<W;x+=Math.max(12,Math.round(W/12))) ctx.fillRect(x,0,1,H);
}
function paintTimeline(){
  const el=$('#tline'); if(!el) return;
  el.innerHTML=keyEvents.map((k,i)=>`<span data-ke="${i}" style="flex:0 0 auto;font-size:11px;padding:2px 7px;border-radius:9px;background:#101a2e;border:1.5px solid ${teamColors[k.side]};cursor:pointer">${k.ic} ${k.min}'</span>`).join('');
  el.querySelectorAll('[data-ke]').forEach(s=>s.onclick=()=>{const k=keyEvents[+s.dataset.ke];toast(k.ic+' '+k.min+"' — "+k.txt);});
  el.scrollLeft=el.scrollWidth;
}
function updateStatsBar() {
  if (!sim) return;
  const s=sim.stats;
  const tot=Math.max(0.1,(s[0].possTime||0)+(s[1].possTime||0));
  const pa=Math.round((s[0].possTime||0)/tot*100);
  const set=(id,v)=>{ const e=$(id); if(e) e.textContent=v; };
  const setW=(id,v)=>{ const e=$(id); if(e) e.style.width=v+'%'; };
  set('#pA',pa+'%'); set('#pB',(100-pa)+'%');
  setW('#pbA',pa); setW('#pbB',100-pa);
  set('#sA',s[0].shots); set('#sB',s[1].shots);
  set('#oA',s[0].onTarget); set('#oB',s[1].onTarget);
  set('#cA',s[0].corners); set('#cB',s[1].corners);
}

/* ─── ABAS ───────────────────────────────────────────────────────────── */
function paintTabBody() {
  const el=$('#tbody'); if(!el) return;
  if (tab==='campo')  { el.innerHTML=overviewHtml(); return; }
  if (tab==='tatica') { paintTaticaTab(el); return; }
  if (tab==='stats')  { el.innerHTML=statsHtml() + '<div style=\"margin-top:12px\">' + feedSplitHtml(24) + '</div>'; return; }
  if (tab==='adv')    { el.innerHTML=oppHtml(); return; }
  if (tab==='elenco') { paintSquadTab(el); return; }
}

// VISÃO GERAL (§item3): preenche o espaço antes vazio — placar de posse já está
// no topo; aqui vai o feed de lances + resumo rápido, pra a 1ª aba ter conteúdo.
function overviewHtml() {
  if (!sim) return '';
  const own = mySide, opp = 1 - mySide;
  const craque = (() => { let bp=null,br=-1; for(const t of sim.teams)for(const q of t.players){if(!q.red&&(q.rating||6)>br){br=q.rating||6;bp=q;}} return bp; })();
  const stA = sim.stats[own], stB = sim.stats[opp];
  const possTot = Math.max(.1,(stA.possTime||0)+(stB.possTime||0));
  const pa = Math.round((stA.possTime||0)/possTot*100), pb = 100-pa;
  const mm = Math.floor(sim.minute || 0), ss = Math.floor(((sim.minute || 0) - mm) * 60);
  const phase = ['', '1ºT', '2ºT', 'PR1', 'PR2'][sim.half] || '1ºT';
  const timeLabel = `${phase} ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  const nmA = esc(clip(sim.teams[own].name||sim.teams[own].squad.c,18));
  const nmB = esc(clip(sim.teams[opp].name||sim.teams[opp].squad.c,18));
  return `<div class="ux-shell">
    <section class="ux-surface">
      <div class="ux-section-head"><div><div class="ttl">Resumo da partida</div><div class="sub">Leitura rápida do que está acontecendo no jogo</div></div></div>
      <div class="ux-team-scoreboard">
        <article class="ux-team-card"><div><div class="nm">${window.flagSvg(sim.teams[own].flag || '⭐', 15)} <span>${nmA}</span></div><div class="meta">${sim.teams[own].atkForm || sim.teams[own].defForm || G.formKey} · ${stA.shots} chutes · ${stA.xg.toFixed(2)} xG</div></div><div class="bar" style="background:${teamColors[own]}"></div></article>
        <article class="ux-score-core"><div class="label">Placar ao vivo</div><div class="score">${sim.score[own]}<span style="color:#596b8d">–</span>${sim.score[opp]}</div><div class="clock">${timeLabel}</div></article>
        <article class="ux-team-card"><div><div class="nm">${window.flagSvg(sim.teams[opp].flag || '🏳️', 15)} <span>${nmB}</span></div><div class="meta">${sim.teams[opp].atkForm || sim.teams[opp].defForm || '4-3-3'} · ${stB.shots} chutes · ${stB.xg.toFixed(2)} xG</div></div><div class="bar" style="background:${teamColors[opp]}"></div></article>
      </div>
      <div class="ux-kpi-grid">
        <div class="ux-kpi"><div class="k">Posse</div><div class="v">${pa}% <span style="color:#5d7191">×</span> ${pb}%</div><div class="hint">controle de bola</div></div>
        <div class="ux-kpi"><div class="k">Chutes</div><div class="v">${stA.shots} <span style="color:#5d7191">×</span> ${stB.shots}</div><div class="hint">volume ofensivo</div></div>
        <div class="ux-kpi"><div class="k">No alvo</div><div class="v">${stA.onTarget} <span style="color:#5d7191">×</span> ${stB.onTarget}</div><div class="hint">eficiência</div></div>
        <div class="ux-kpi"><div class="k">Momentum</div><div class="v">${Math.round((clamp((sim.momentum || 0) * (mySide===0?1:-1), -1, 1) + 1) * 50)}%</div><div class="hint">pressão atual do seu time</div></div>
      </div>
    </section>
    ${craque?`<section class="ux-surface soft"><div class="ux-section-head"><div><div class="ttl">Destaque</div><div class="sub">Quem está puxando o jogo neste momento</div></div></div><div class="ux-mvp-card"><div class="ux-mvp-star">⭐</div><div style="flex:1"><div class="name">${esc(craque.ref.n)}</div><div class="sub">Craque atual da partida · nota ${(craque.rating||6).toFixed(1)}</div></div><div class="ovr ${ovrClass(craque.ref.r)}">${craque.ref.r}</div></div></section>`:''}
    <section class="ux-surface"><div class="ux-section-head"><div><div class="ttl">Lances por time</div><div class="sub">Separados para ficar mais fácil de acompanhar</div></div></div>${feedSplitHtml(18)}</section>
  </div>`;
}

// ADVERSÁRIO (§item2): formação + posições + notas de TODOS — read-only.
function oppHtml() {
  if (!sim) return '';
  const o = 1 - mySide, tm = sim.teams[o];
  const players = tm.players.filter(p => !p.red);
  const fk = tm.atkForm || tm.defForm || '4-3-3';
  const styleName = (STYLE_FX[tm.styleKey] && STYLE_FX[tm.styleKey].l) || 'Equilibrado';
  const avg = Math.round(players.reduce((a,p)=>a + (p.ref.r||0), 0) / Math.max(1, players.length));
  const best = players.slice().sort((a,b)=>(b.rating||0)-(a.rating||0))[0];
  const avgSta = Math.round(players.reduce((a,p)=>a + (p.stamina||0), 0) / Math.max(1, players.length));
  return `<div class="ux-shell"><section class="ux-surface"><div class="ux-section-head"><div><div class="ttl">Raio-x do adversário</div><div class="sub">Leitura mais amigável do time rival</div></div></div><div class="opp-layout"><section class="opp-card"><div class="ux-stat-hero" style="margin-bottom:10px"><div class="ux-stat-chip"><div class="k">Formação</div><div class="v">${fk}</div></div><div class="ux-stat-chip"><div class="k">Estilo</div><div class="v" style="font-size:18px">${styleName}</div></div><div class="ux-stat-chip"><div class="k">Overall médio</div><div class="v">${avg}</div></div><div class="ux-stat-chip"><div class="k">Fôlego médio</div><div class="v">${avgSta}%</div></div></div><div class="ux-section-head" style="margin-bottom:8px"><div><div class="ttl" style="font-size:12px">Visual da formação</div><div class="sub">Escalação em campo do rival</div></div><div class="ovr ${ovrClass(best?best.ref.r:avg)}">${best ? best.ref.r : avg}</div></div>${formationPreview(fk, o)}</section><section class="opp-card"><div class="ux-section-head"><div><div class="ttl" style="font-size:12px">Quem está em campo</div><div class="sub">Todos os titulares com nota e físico</div></div></div><div class="ux-list-grid">${players.map(p=>`<article class="player-pill-card"><div class="ovr ${ovrClass(p.ref.r)}">${p.ref.r}</div><div class="player-pill-main"><div class="nm">${p.ref.num?p.ref.num+'. ':''}${esc(p.ref.n)}${best===p?' ⭐':''}${p.yellow?' 🟨':''}</div><div class="sb">${SLOT_PT[p.slotPos]||p.slotPos} · ${Math.round(p.stamina)}% físico · nota ${(p.rating||6).toFixed(1)}</div><div class="sta-line"><i style="width:${Math.round(p.stamina)}%"></i></div></div></article>`).join('')}</div></section></div></section></div>`;
}

// preview visual: desenha a formação escolhida com os jogadores reais do time
function formationPreview(formKey, which) {
  if (!sim || !FORMATIONS[formKey]) return '';
  const side = (which==null ? mySide : which);
  const tm = sim.teams[side];
  const alive = tm.players.filter(p => !p.red);
  const varI = (G.varIdx || 0) % FORMATIONS[formKey].variations.length;
  const slots = FORMATIONS[formKey].variations[varI].slots;
  // atribui cada jogador vivo ao slot compatível mais próximo (mesma lógica do motor)
  const used = new Set();
  const assigned = slots.map(sl => {
    let best = null, bestScore = -1e9;
    for (const p of alive) {
      if (used.has(p)) continue;
      const compat = canPlay(p.ref, sl.pos) ? 5 : 0;
      const samePos = (p.slotPos === sl.pos) ? 4 : 0;
      const score = compat + samePos + p.ref.r * 0.05;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) used.add(best);
    return { sl, p: best };
  });
  const W = 340, H = 188, pad = 17;
  const col = teamColors && teamColors[side] ? teamColors[side] : (side === 0 ? '#2e9bff' : '#ffcb45');
  const dots = assigned.map(({ sl, p }) => {
    // campo na horizontal: x da formação = profundidade, y = lateral
    const px = pad + sl.x * (W - 2*pad);
    const py = pad + sl.y * (H - 2*pad);
    const nm = p ? lastWord(p.ref.n, 10) : sl.pos;
    const isGK = sl.pos === 'GK';
    const c = isGK ? '#f0b429' : col;
    const posLbl = p ? (p.slotPos || sl.pos) : sl.pos;
    const value = p ? p.ref.r : sl.pos;
    return `<g>
      <ellipse cx="${px.toFixed(0)}" cy="${(py+13).toFixed(0)}" rx="12" ry="3.5" fill="rgba(0,0,0,.32)"/>
      <circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="12.5" fill="${c}" stroke="#06101e" stroke-width="2.5"/>
      <circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="11" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1"/>
      <text x="${px.toFixed(0)}" y="${(py-17).toFixed(0)}" font-size="7" fill="rgba(238,244,252,.8)" text-anchor="middle" font-weight="800" style="paint-order:stroke;stroke:#08122a;stroke-width:2px">${posLbl}</text>
      <text x="${px.toFixed(0)}" y="${(py+0.5).toFixed(0)}" font-size="8.5" fill="${isGK?'#3a2600':'#08122a'}" text-anchor="middle" dominant-baseline="middle" font-weight="900">${value}</text>
      <text x="${px.toFixed(0)}" y="${(py+25).toFixed(0)}" font-size="8" fill="#eef3fb" text-anchor="middle" font-weight="700" style="paint-order:stroke;stroke:#08122a;stroke-width:2.6px">${esc(nm)}</text>
    </g>`;
  }).join('');
  let stripes = '';
  for (let i = 0; i < 6; i++) stripes += `<rect x="${(i*W/6).toFixed(1)}" y="0" width="${(W/6).toFixed(1)}" height="${H}" fill="${i%2?'rgba(255,255,255,.045)':'transparent'}"/>`;
  return `<div class="formation-shell">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Formação ${esc(formKey)}" style="background:linear-gradient(90deg,#176d34,#1f8540)">
      ${stripes}
      <line x1="${W/2}" y1="6" x2="${W/2}" y2="${H-6}" stroke="rgba(255,255,255,.3)" stroke-width="1.4"/>
      <circle cx="${W/2}" cy="${H/2}" r="21" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.4"/>
      <circle cx="${W/2}" cy="${H/2}" r="2.5" fill="rgba(255,255,255,.45)"/>
      <rect x="5" y="${H/2-34}" width="27" height="68" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2" rx="2"/>
      <rect x="${W-32}" y="${H/2-34}" width="27" height="68" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2" rx="2"/>
      ${dots}
    </svg>
  </div>`;
}

function adaptiveTeamHtml(t) {
  if (!sim || !sim.teams[t]) return '';
  const tm = sim.teams[t];
  const a = tm.adaptive || (sim._neutralAdaptive ? sim._neutralAdaptive() : { label:'Equilíbrio', reason:'Contexto sem urgência', intensity:0 });
  const pct = Math.round(Math.max(0, Math.min(1, a.intensity || 0)) * 100);
  const base = (STYLE_FX[tm.styleKey] && STYLE_FX[tm.styleKey].l) || 'Equilibrado';
  const tone = ({ all_out:'#ff6b5e', chase:'#ffad45', regain:'#4db6ff', control:'#6fd6a8', protect_lead:'#8db8ff', close_game:'#83a0c8', ten_men:'#c89cff', save_energy:'#8fb0a5' })[a.key] || '#ffcb45';
  const effects = [
    ['Linha', a.line, 'mais alta', 'mais baixa'],
    ['Ritmo', a.ritmo, 'acelera', 'reduz'],
    ['Risco', a.risk, 'aumenta', 'reduz'],
    ['Pressão', a.pressReach, 'avança', 'recua']
  ].filter(x => Math.abs(x[1] || 0) >= 0.025)
   .sort((x,y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0,3)
   .map(x => `<span style="padding:3px 7px;border:1px solid rgba(255,255,255,.10);border-radius:999px;background:rgba(255,255,255,.035);font-size:10.5px;color:#b9c6da">${x[0]} ${x[1] > 0 ? x[2] : x[3]}</span>`).join('');
  const side = a.focusSide === 'L' ? ' · preferência pelo corredor esquerdo' : a.focusSide === 'R' ? ' · preferência pelo corredor direito' : '';
  return `<div class="card" style="padding:10px 11px;border-top:2px solid ${tone};min-width:0">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="min-width:0"><div class="mut" style="font-size:10px;letter-spacing:1.2px;text-transform:uppercase"><span aria-hidden="true">${window.flagSvg(tm.flag || (t===mySide?'⭐':'🏳️'), 11)}</span> ${t===mySide?'Seu time':'Adversário'} · base ${esc(base)}</div>
      <div style="font-weight:850;color:${tone};font-size:14px;margin-top:2px">${esc(a.label || 'Equilíbrio')}</div></div>
      <span style="font-family:var(--f-cond);font-size:11px;color:${tone};white-space:nowrap">${pct}%</span>
    </div>
    <div style="height:4px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;margin:7px 0 6px"><div style="width:${pct}%;height:100%;background:${tone};border-radius:4px"></div></div>
    <div class="mut" style="font-size:11.5px;line-height:1.35">${esc(a.reason || 'Contexto sem urgência')}${side}</div>
    ${effects ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px">${effects}</div>` : ''}
  </div>`;
}

function adaptiveLiveHtml() {
  if (!sim) return '';
  return `<div class="eyebrow" style="margin-bottom:6px">LEITURA CONTEXTUAL · ATUALIZA SOZINHA</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-bottom:14px">
      ${adaptiveTeamHtml(mySide)}${adaptiveTeamHtml(1-mySide)}
    </div>`;
}

function paintAdaptiveLive() {
  const live = $('#adaptive-live');
  if (live) live.innerHTML = adaptiveLiveHtml();
}

function paintTaticaTab(el) {
  const cur = sim.teams[mySide].styleKey || G.style;
  const atkForm = G.atkForm || G.formKey;
  const defForm = G.defForm || G.formKey;
  el.innerHTML = `<div class="ux-shell"><section class="ux-surface">${adaptiveLiveHtml()}</section><section class="ux-surface"><div class="ux-section-head"><div><div class="ttl">Plano tático</div><div class="sub">Escolha o estilo e ajuste a estrutura do seu time</div></div></div><div class="tactic-summary-grid" style="margin-bottom:14px"><div class="tactic-summary-card"><div class="k">Estilo atual</div><div class="big">${STYLE_FX[cur].l}</div><div class="sub">${STYLE_FX[cur].d}</div></div><div class="tactic-summary-card"><div class="k">Com bola</div><div class="big">${atkForm}</div><div class="sub">Estrutura ofensiva</div></div><div class="tactic-summary-card"><div class="k">Sem bola</div><div class="big">${defForm}</div><div class="sub">Estrutura defensiva</div></div></div><div class="ux-line-sep"><div class="ttl">Estilos base</div><div class="sub">Troque instantaneamente durante o jogo</div></div><div class="tactic-style-grid">${STYLE_KEYS.map(k => { const st = STYLE_FX[k]; const icon = { tiki:'🎯', counter:'⚡', press:'🔥', direct:'🚀', wings:'🦅', balanced:'⚖️', park:'🚌' }[k] || '⚽'; return `<div class="stylerow ${cur===k?'on':''}" data-st="${k}"><div class="st-i">${icon}</div><div><div class="st-t">${st.l}</div><div class="st-d">${st.d}</div></div></div>`; }).join('')}</div></section><section class="ux-surface"><div class="ux-section-head"><div><div class="ttl">Ajustes finos</div><div class="sub">Controle o comportamento coletivo da equipe</div></div></div><div class="squad-card">${axesSegHtml(G.axes || STYLE_AXES[cur] || STYLE_AXES.balanced)}</div></section><section class="ux-surface"><div class="ux-section-head"><div><div class="ttl">Estrutura em campo</div><div class="sub">Visualize separado com e sem posse</div></div></div><div style="display:flex;gap:8px;margin-bottom:10px">${[['atk','⚔️ Com bola'],['def','🛡️ Sem bola']].map(([m,lb])=>{ const on = (G.tacView||'atk')===m; return `<button data-tv="${m}" style="flex:1;padding:10px 0;border-radius:12px;font-weight:800;font-size:13px;letter-spacing:.4px;cursor:pointer;border:1.5px solid ${on?'#ffcb45':'rgba(255,255,255,.14)'};background:${on?'rgba(255,203,69,.16)':'rgba(255,255,255,.04)'};color:${on?'#ffcb45':'#9fb0c8'}">${lb}</button>`; }).join('')}</div>${(()=>{ const m=(G.tacView||'atk'); const cur2 = m==='atk' ? atkForm : defForm; return `<div class="pills">${FORMATION_KEYS.map(k=>`<button class="pill ${cur2===k?'on':''}" data-fk="${k}">${k}</button>`).join('')}</div><div class="squad-card" style="margin-top:12px">${formationPreview(cur2, mySide)}<p class="mut" style="font-size:12px;margin-top:10px">A visualização muda para mostrar a estrutura ofensiva ou defensiva do seu time.</p></div>`; })()}</section></div>`;
  el.querySelectorAll('[data-st]').forEach(r => r.onclick = () => { const k = r.dataset.st; sim.setStyle(mySide, k); G.style = k; G.axes = Object.assign({}, STYLE_AXES[k] || STYLE_AXES.balanced); window.UI.toast(`Estilo: ${STYLE_FX[k].l}!`); paintTaticaTab(el); });
  bindAxesSeg(el, () => { if (!G.axes) G.axes = Object.assign({}, STYLE_AXES[sim.teams[mySide].styleKey || G.style] || STYLE_AXES.balanced); return G.axes; }, (axes) => sim.setAxes(mySide, axes));
  const applyShapes = () => { sim.setShapes(mySide, G.defForm || G.formKey, G.varIdx || 0, G.atkForm || G.formKey, G.varIdx || 0); paintTaticaTab(el); };
  el.querySelectorAll('[data-tv]').forEach(b => b.onclick = () => { G.tacView = b.dataset.tv; paintTaticaTab(el); });
  el.querySelectorAll('[data-fk]').forEach(b => b.onclick = () => { const k = b.dataset.fk; if ((G.tacView||'atk')==='atk') { G.atkForm = k; window.UI.toast(`Ataque em ${k}`); } else { G.defForm = k; window.UI.toast(`Defesa em ${k}`); } applyShapes(); });
}

function feedHtml() {
  const imp = feed.filter(f => f.imp).slice(0, 40);
  if (!imp.length) return '';
  return `<div class="eyebrow" style="padding:4px 14px">LANCES DO JOGO</div><div class="mfeed" style="max-height:none">`
    + imp.map(f=>`<div class="mev imp">
        <span class="mev-min">${f.min!==undefined&&f.min!==''?f.min+"'":'•'}</span>
        <span>${f.txt}</span>
      </div>`).join('')
    + '</div>';
}

function feedSplitHtml(limit){
  const imp = feed.filter(f => f.imp).slice(0, limit || 40);
  if (!imp.length || !sim) return '';
  const cols = [[], []];
  imp.forEach(f => { if (f.team === 0 || f.team === 1) cols[f.team].push(f); });
  return `<div class="eyebrow" style="padding:4px 0 10px">LANCES DO JOGO · SEPARADOS POR TIME</div>
    <div class="split-feed">
      ${[0,1].map(t=>`<section class="split-feed-col">
        <div class="split-feed-head" style="color:${teamColors[t]}"><span>${window.flagSvg(sim.teams[t].flag || (t===mySide?'⭐':'🏳️'), 13)} ${esc(clip(sim.teams[t].name||sim.teams[t].squad.c, 18))}</span><span>${cols[t].length}</span></div>
        <div class="split-feed-body">
          ${cols[t].length ? cols[t].map(f=>`<article class="split-feed-item"><div class="min">${f.min!==undefined&&f.min!==''?f.min+"'":'•'}</div><div class="txt">${f.txt}</div></article>`).join('') : '<div class="split-feed-empty">Sem lances de destaque até agora.</div>'}
        </div>
      </section>`).join('')}
    </div>`;
}

function statsHtml() {
  if (!sim) return '';
  const s=sim.stats;
  const [Ac,Bc]=teamColors;
  const possTot=Math.max(.1,(s[0].possTime||0)+(s[1].possTime||0));
  const pa=Math.round((s[0].possTime||0)/possTot*100),pb=100-pa;
  const own = mySide, opp = 1-mySide;
  const groups=[
    ['Ataque',[
      ['Finalizações',s[0].shots,s[1].shots],['No alvo',s[0].onTarget,s[1].onTarget],['xG',s[0].xg,s[1].xg,'decimal'],['Escanteios',s[0].corners,s[1].corners]
    ]],
    ['Construção',[
      ['Posse',pa,pb,'percent'],['Passes',s[0].passes,s[1].passes],['Passes certos',s[0].passOk,s[1].passOk],['Precisão',Math.round(s[0].passOk/Math.max(1,s[0].passes)*100),Math.round(s[1].passOk/Math.max(1,s[1].passes)*100),'percent'],['Dribles certos',s[0].dribblesCompleted,s[1].dribblesCompleted]
    ]],
    ['Defesa e disciplina',[
      ['Desarmes',s[0].tackles,s[1].tackles],['Interceptações',s[0].interceptions,s[1].interceptions],['Defesas do goleiro',s[0].saves,s[1].saves],['Faltas',s[0].fouls,s[1].fouls],['Amarelos',s[0].yellow,s[1].yellow],['Impedimentos',s[0].offsides,s[1].offsides]
    ]],
    ['Motor 4.0',[
      ['Bolas em profundidade',s[0].throughBalls||0,s[1].throughBalls||0],['Profundidade certa',s[0].throughOk||0,s[1].throughOk||0],['Cruzamentos rasteiros',s[0].lowCrosses||0,s[1].lowCrosses||0],['Recuperações por pressão',s[0].pressWins||0,s[1].pressWins||0],['Erros defensivos',s[0].defErrors||0,s[1].defErrors||0],['Saídas do goleiro',s[0].gkSweeps||0,s[1].gkSweeps||0]
    ]]
  ];
  const n0 = esc(clip(sim.teams[0].name||sim.teams[0].squad.c,16)), n1 = esc(clip(sim.teams[1].name||sim.teams[1].squad.c,16));
  const f0 = window.flagSvg(sim.teams[0].flag || (mySide===0?'⭐':'🏳️'), 13), f1 = window.flagSvg(sim.teams[1].flag || (mySide===1?'⭐':'🏳️'), 13);
  return `<div class="ux-shell"><section class="ux-surface"><div class="ux-section-head"><div><div class="ttl">Estatísticas detalhadas</div><div class="sub">Comparativo completo dos dois times</div></div></div><div class="ux-stat-hero"><div class="ux-stat-chip"><div class="k">Placar</div><div class="v">${sim.score[0]} <span style="color:#5b7090">×</span> ${sim.score[1]}</div></div><div class="ux-stat-chip"><div class="k">Posse</div><div class="v">${pa}% <span style="color:#5b7090">×</span> ${pb}%</div></div><div class="ux-stat-chip"><div class="k">xG</div><div class="v">${s[own].xg.toFixed(2)} <span style="color:#5b7090">×</span> ${s[opp].xg.toFixed(2)}</div></div><div class="ux-stat-chip"><div class="k">Precisão de passe</div><div class="v">${Math.round(s[own].passOk/Math.max(1,s[own].passes)*100)}%</div><div class="hint">seu time</div></div></div><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:2px 0 12px;font-family:var(--f-cond);font-size:11px;font-weight:750;letter-spacing:.5px"><span style="text-align:right;color:${Ac};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f0} ${n0}</span><span class="mut" style="font-size:10px">VS</span><span style="color:${Bc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f1} ${n1}</span></div><div class="stat-board">`
    + groups.map(([title,rows])=>`<section class="stat-group"><div class="stat-group-title">${title}</div>${rows.map(([lbl,a,b,fmt])=>{
      const total=Math.max(.0001,(+a||0)+(+b||0)),ap=(+a||0)/total*100,bp=(+b||0)/total*100;
      const out=v=>fmt==='decimal'?(+v||0).toFixed(2):fmt==='percent'?`${v}%`:v;
      return `<div class="stat-row"><div class="stat-row-head"><span class="stat-value" style="color:${Ac}">${out(a)}</span><span class="stat-row-label">${lbl}</span><span class="stat-value" style="color:${Bc}">${out(b)}</span></div><div class="stat-track"><i style="width:${ap}%;background:${Ac}"></i><i style="width:${bp}%;background:${Bc};margin-left:auto"></i></div></div>`;
    }).join('')}</section>`).join('')+'</div></section></div>';
}

function paintSquadTab(body) {
  if (!sim) { body.innerHTML=''; return; }
  const simTm = sim.teams[mySide];
  const players = simTm.players;
  const bench = simTm.bench || [];
  const active = players.filter(p => !p.red);
  let bestP=null,bestR=-1; for(const q of active){ if((q.rating||6)>bestR){bestR=q.rating||6;bestP=q;} }
  const avgSta = Math.round(active.reduce((a,p)=>a + (p.stamina||0),0) / Math.max(1,active.length));
  const avgOvr = Math.round(active.reduce((a,p)=>a + (p.ref.r||0),0) / Math.max(1,active.length));
  body.innerHTML = `<div class="ux-shell"><section class="ux-surface"><div class="ux-section-head"><div><div class="ttl">Gestão do elenco</div><div class="sub">Substituições, físico e desempenho do seu time</div></div></div><div class="tactic-summary-grid" style="margin-bottom:14px"><div class="tactic-summary-card"><div class="k">Substituições</div><div class="big">${simTm.subsLeft||0}</div><div class="sub">restantes</div></div><div class="tactic-summary-card"><div class="k">Craque atual</div><div class="big">${bestP ? (bestP.rating||6).toFixed(1) : '--'}</div><div class="sub">${bestP ? esc(lastWord(bestP.ref.n, 16)) : '—'}</div></div><div class="tactic-summary-card"><div class="k">Overall médio</div><div class="big">${avgOvr}</div><div class="sub">dos titulares</div></div><div class="tactic-summary-card"><div class="k">Fôlego médio</div><div class="big">${avgSta}%</div><div class="sub">em campo</div></div></div><div class="ux-line-sep"><div class="ttl">Em campo</div><div class="sub">Toque em quem sai</div></div><div class="ux-list-grid">${players.map((p,ri)=>{ if (p.red) return ''; const r=p.ref.r; return `<article class="player-pill-card" data-ridx="${ri}" style="cursor:pointer"><div class="ovr ${ovrClass(r)}">${r}</div><div class="player-pill-main"><div class="nm">${p.ref.num?p.ref.num+'. ':''}${esc(p.ref.n)}${p===bestP?' ⭐':''}${p.yellow?' 🟨':''}</div><div class="sb">${SLOT_PT[p.slotPos]||p.slotPos} · ${Math.round(p.stamina)}% físico · nota ${(p.rating||6).toFixed(1)}</div><div class="sta-line"><i style="width:${Math.round(p.stamina)}%"></i></div></div></article>`; }).join('')}</div>${bench.length?`<div class="ux-line-sep"><div class="ttl">Banco</div><div class="sub">Depois toque em quem entra</div></div><div class="ux-list-grid">${bench.map((b,bi)=>`<article class="player-pill-card" data-in="${bi}" style="cursor:pointer"><div class="ovr ${ovrClass(b.r)}">${b.r}</div><div class="player-pill-main"><div class="nm">${esc(b.n)}</div><div class="sb">${SLOT_PT[b.slot]||b.slot||''}</div><div class="sta-line"><i style="width:${Math.max(40,Math.min(100,b.stamina||100))}%"></i></div></div></article>`).join('')}</div>` : '<div class="mut" style="margin-top:10px;font-size:13px">Banco vazio.</div>'}<p class="mut" style="font-size:12px;margin-top:10px">Fluxo recomendado: escolha o titular que vai sair e depois selecione uma peça do banco.</p></section></div>`;
  let outSel=-1;
  body.querySelectorAll('[data-ridx]').forEach(r=>r.onclick=()=>{ outSel=+r.dataset.ridx; body.querySelectorAll('[data-ridx]').forEach(x=>x.classList.toggle('sel',+x.dataset.ridx===outSel)); body.querySelectorAll('.a8').forEach(x=>x.remove()); const p = players[outSel]; if (p) r.insertAdjacentHTML('afterend', a8Html(p.ref)); });
  body.querySelectorAll('[data-in]').forEach(r=>r.onclick=()=>{ if (outSel<0) { toast('Toque primeiro em quem vai sair.'); return; } const inP=bench[+r.dataset.in]; if (!inP) return; if (sim.substitute(mySide,outSel,inP)) { toast('Substituição! 🔄'); paintSquadTab(body); } else toast('Sem substituições restantes.'); });
}


// hook de teste (usado pelo QA automatizado)
})();

