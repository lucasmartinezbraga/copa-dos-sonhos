/* ═══════════ ui.js ═══════════ */
/* =========================================================================
   COPA DOS SONHOS — ui.js
   Fluxo: HOME → SETUP (modo/estilo/formação) → DRAFT (monta o time,
   1 jogador por seleção sorteada) → COPA (hub). Partida vive em game.js.
   ========================================================================= */
(function () {
'use strict';

/* ------------------------------- ESTADO --------------------------------- */
const G = window.G = {
  db: null,
  modo: 'classico',          // 'classico' (sem OVR no draft) | 'almanaque'
  style: null,               // chave de STYLE_FX
  axes: null,                // 5 eixos táticos 0..100 (partem do preset do estilo)
  formKey: '4-3-3',
  varIdx: 0,
  draft: null,               // estado do draft
  lineup: [], bench: [],     // time final (cópias do squad ME)
  cup: null,
  speed: 1.4,
  screen: 'home',
};

const $ = sel => document.querySelector(sel);
const app = () => $('#app');
const rnd = a => a[Math.floor(Math.random() * a.length)];

window.flagSvg = function(f, size) {
  var s = size || 24;
  if (f === '⭐') return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="#ffcb45" style="vertical-align:middle;display:inline-block"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    return '<span style="font-size:' + s + 'px; line-height: 1; vertical-align:middle; display:inline-block; font-family: apple color emoji, segoe ui emoji, noto color emoji, android emoji, emojisymbols, emojione mozilla, twemoji mozilla, segoe ui symbol;">' + f + '</span>';
  }

  // Alguns navegadores normalizam as sequências de tags de Inglaterra e
  // Escócia de forma diferente; detectar os codepoints evita o fallback cinza.
  var cps = Array.from(String(f||''), function(ch){ return ch.codePointAt(0); });
  var englandTag = cps.indexOf(0xE0065)>=0 && cps.indexOf(0xE006E)>=0 && cps.indexOf(0xE0067)>=0;
  var scotlandTag = cps.indexOf(0xE0073)>=0 && cps.indexOf(0xE0063)>=0 && cps.indexOf(0xE0074)>=0;

  // Desktop SVG
  if (f === '🇧🇷') return '<svg viewBox="0 0 32 20" width="' + (s*1.6) + '" height="' + s + '" style="border-radius:2px;vertical-align:middle;display:inline-block"><rect width="32" height="20" fill="#009739"/><path d="M16 2 L30 10 L16 18 L2 10 Z" fill="#fedf00"/><circle cx="16" cy="10" r="3.5" fill="#012169"/></svg>';
  if (f === '🇯🇵') return '<svg viewBox="0 0 32 20" width="' + (s*1.6) + '" height="' + s + '" style="border-radius:2px;vertical-align:middle;display:inline-block"><rect width="32" height="20" fill="#fff"/><circle cx="16" cy="10" r="6" fill="#bc002d"/></svg>';
  if (f === '🇨🇭') return '<svg viewBox="0 0 20 20" width="' + s + '" height="' + s + '" style="border-radius:2px;vertical-align:middle;display:inline-block"><rect width="20" height="20" fill="#ff0000"/><rect x="8" y="4" width="4" height="12" fill="#fff"/><rect x="4" y="8" width="12" height="4" fill="#fff"/></svg>';
  if (englandTag) return '<svg viewBox="0 0 32 20" width="' + (s*1.6) + '" height="' + s + '" style="border-radius:2px;vertical-align:middle;display:inline-block"><rect width="32" height="20" fill="#fff"/><rect x="14" width="4" height="20" fill="#ce1126"/><rect y="8" width="32" height="4" fill="#ce1126"/></svg>';
  if (scotlandTag) return '<svg viewBox="0 0 32 20" width="' + (s*1.6) + '" height="' + s + '" style="border-radius:2px;vertical-align:middle;display:inline-block"><rect width="32" height="20" fill="#005eb8"/><path d="M0 0 L32 20 M32 0 L0 20" stroke="#fff" stroke-width="4"/></svg>';

  var colors = {
    '🇩🇿':['#006233','#fff','#d21034'],'🇦🇷':['#74acdf','#fff','#74acdf'],'🇦🇺':['#00008b','#fff','#d21034'],'🇦🇹':['#ed2939','#fff','#ed2939'],
    '🇧🇪':['#000','#ffd100','#ff0f21'],'🇧🇬':['#fff','#00966e','#d21034'],'🇨🇲':['#007a5e','#ce1126','#fcd116'],
    '🇨🇱':['#fff','#0039a6','#d52b1e'],'🇨🇴':['#fcd116','#003893','#ce1126'],'🇨🇷':['#002b7f','#fff','#ce1126'],'🇭🇷':['#ff0000','#fff','#171796'],
    '🇨🇿':['#fff','#11457e','#d7141a'],'🇩🇰':['#c60c30','#fff','#c60c30'],'🇫🇷':['#002395','#fff','#ed2939'],
    '🇩🇪':['#000','#dd0000','#ffce00'],'🇬🇭':['#ce1126','#fcd116','#006b3f'],'🇭🇺':['#ce1126','#fff','#436f4d'],'🇮🇷':['#239f40','#fff','#da0000'],
    '🇮🇹':['#009246','#fff','#ce2b37'],'🇲🇽':['#006847','#fff','#ce1126'],'🇲🇦':['#c1272d','#006233','#c1272d'],
    '🇳🇱':['#ae1c28','#fff','#21468b'],'🇳🇬':['#008751','#fff','#008751'],'🇵🇾':['#d52b1e','#fff','#003893'],'🇵🇪':['#d91023','#fff','#d91023'],
    '🇵🇱':['#fff','#dc143c','#fff'],'🇵🇹':['#006600','#ff0000','#ff0000'],'🇷🇴':['#002b7f','#fcd116','#ce1126'],'🇷🇺':['#fff','#0039a6','#d52b1e'],
    '🇸🇦':['#006c35','#fff','#006c35'],'🇸🇳':['#00853f','#fdef42','#e31b23'],'🇰🇷':['#fff','#000','#cd2e3a'],
    '🇪🇸':['#aa151b','#f1bf00','#aa151b'],'🇸🇪':['#006aa7','#fecc00','#006aa7'],'🇹🇳':['#e70013','#fff','#e70013'],
    '🇺🇾':['#fff','#0038a8','#fff'],'🇺🇸':['#b22234','#fff','#3c3b6e'],'🇷🇸':['#c6363c','#0c4076','#fff']
  }[f] || ['#4a5a78','#9fb0c8','#4a5a78'];

  return '<svg viewBox="0 0 32 20" width="' + (s*1.6) + '" height="' + s + '" style="border-radius:2px;vertical-align:middle;display:inline-block"><rect width="32" height="20" fill="' + colors[0] + '"/><rect width="32" height="13.3" y="6.7" fill="' + colors[1] + '"/><rect width="32" height="6.7" y="13.3" fill="' + colors[2] + '"/></svg>';
};
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function ovrClass(r) { return r >= 90 ? 'g90' : r >= 80 ? 'g80' : r >= 70 ? 'g70' : 'g0'; }
function teamOvr(list) {
  const v = list.filter(l => l.p);
  return v.length ? Math.round(v.reduce((s, l) => s + l.p.r, 0) / v.length) : 0;
}
function toast(msg, ms) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms || 1800);
}
function header(phase, backTo) {
  return `<div class="top">
    ${backTo ? `<button class="back" data-go="${backTo}" aria-label="Voltar">‹</button>` : ''}
    <div class="brand">COPA DOS <b>SONHOS</b></div>
    <div class="phase">${phase || ''}</div>
  </div>`;
}
const GRP_OF_LINE = { GK: 'gk', DEF: 'def', MID: 'mid', FWD: 'att' };
const GRP_LABEL = { gk: 'GOL', def: 'DEF', mid: 'MEI', att: 'ATA' };
function posGroup(p) { return GRP_OF_LINE[LINE_OF[p.slot]] || 'mid'; }

/* --------------------------- NAVEGAÇÃO ---------------------------------- */
const SCREENS = {};
function go(name, arg) {
  G.screen = name;
  if (name === 'match') { window.GAME.open(); window.scrollTo(0, 0); return; }
  if (name === 'freekick') { window.GAME.openFreeKickTraining(); window.scrollTo(0, 0); return; }
  SCREENS[name](arg);
  window.scrollTo(0, 0);
}
window.UI = { go, toast, teamOvr, ovrClass, esc, header };

document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

/* Tap móvel tolerante: o botão dispara no pointerup mesmo quando o WebView
   deixa de sintetizar o click. Um deslocamento maior que 14px cancela a ação. */
function bindMobileTap(el, action) {
  if (!el) return;
  let pid = null, x0 = 0, y0 = 0, moved = false, firedAt = -1e9;
  el.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') return;
    pid = ev.pointerId; x0 = ev.clientX; y0 = ev.clientY; moved = false;
    try { el.setPointerCapture(pid); } catch (_) {}
  }, { passive: true });
  el.addEventListener('pointermove', ev => {
    if (ev.pointerId !== pid) return;
    if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 14) moved = true;
  }, { passive: true });
  const end = ev => {
    if (ev.pointerId !== pid) return;
    const fire = !moved;
    pid = null;
    if (fire) { firedAt = performance.now(); action(ev); }
  };
  el.addEventListener('pointerup', end, { passive: true });
  el.addEventListener('pointercancel', ev => { if (ev.pointerId === pid) pid = null; }, { passive: true });
  el.addEventListener('click', ev => {
    if (performance.now() - firedAt < 600) { ev.preventDefault(); return; }
    action(ev);
  });
}

/* ================================ HOME =================================== */
SCREENS.home = function () {
  const saved=hasSave();
  app().innerHTML = `
    <div class="home-v2">
      <header class="home-nav-v2">
        <div class="home-brand-v2"><span class="home-monogram">CDS</span><span class="home-wordmark">Copa dos <b>Sonhos</b></span></div>
        <span class="home-edition">Simulador histórico · edição 2026</span>
      </header>
      <main class="home-main-v2">
        <section class="home-copy-v2">
          <span class="home-status"><i></i> Motor 3.0 · futebol simulado lance a lance</span>
          <h1 class="display home-title-v2">Copa dos<span>Sonhos</span></h1>
          <p class="home-lead-v2">Escolha um craque de cada seleção histórica, construa um time impossível e leve suas lendas por uma Copa completa. Aqui, nome não ganha jogo: posição, atributos e decisões táticas aparecem dentro de campo.</p>
          <div class="home-facts"><span class="home-fact">369 seleções históricas</span><span class="home-fact">1934 → 2026</span><span class="home-fact">Momentos decisivos jogáveis</span></div>
          <div class="home-cta-v2">
            ${saved?'<button type="button" class="btn btn-gold" id="bt-continue">Continuar minha Copa</button>':''}
            <button type="button" class="btn ${saved?'btn-ghost':'btn-gold'}" id="bt-start">${saved?'Criar novo time':'Montar meu time'}</button>
            <button type="button" class="btn btn-ghost" id="bt-about">Como funciona</button>
            <button class="home-mode-v2" data-go="freekick" aria-label="Abrir o Desafio de Faltas">
              <span class="hm-icon">↗</span><span class="hm-copy"><small>Novo modo de habilidade</small><b>Desafio de Faltas</b><span>Cinco cobranças com a mesma física usada na Copa.</span></span><span class="hm-go">›</span>
            </button>
          </div>
        </section>
        <aside class="dream-stage" aria-hidden="true">
          <div class="dream-card">
            <div class="dream-card-head"><span>Onze épocas · um time</span><b>Seleção dos sonhos</b></div>
            <div class="dream-pitch">
              <div class="legend-chip lc1"><i>10</i><b>Pelé</b><span>1970</span></div>
              <div class="legend-chip lc2"><i>10</i><b>Maradona</b><span>1986</span></div>
              <div class="legend-chip lc3"><i>10</i><b>Messi</b><span>2026</span></div>
              <div class="legend-chip lc4"><i>8</i><b>Zidane</b><span>1998</span></div>
              <div class="legend-chip lc5"><i>3</i><b>Maldini</b><span>1994</span></div>
              <div class="legend-chip lc6"><i>4</i><b>Beckenbauer</b><span>1974</span></div>
              <div class="legend-chip lc7"><i>1</i><b>Yashin</b><span>1966</span></div>
            </div>
            <div class="dream-caption"><b>Não basta juntar os maiores.</b> Monte o time que melhor joga junto.</div>
          </div>
        </aside>
      </main>
    </div>`;
  const btC = $('#bt-continue');
  if (btC) bindMobileTap(btC, () => { if (loadGame()) go('cup'); else toast('Não consegui carregar o save — comece um novo.'); });
  bindMobileTap($('#bt-start'), () => go('setup'));
  bindMobileTap($('#bt-about'), () => go('howto'));
};

/* ============================ COMO FUNCIONA ============================== */
SCREENS.howto = function () {
  const steps = [
    ['🎲','O sorteio do draft','A cada rodada sai uma seleção histórica de alguma Copa (Brasil 1970, França 1998…). Você leva exatamente UM jogador dela para o seu time.'],
    ['↻','Rerolls','Não gostou do elenco sorteado? Você tem 4 rerolls: "Outra seleção" troca o país na mesma Copa; "Outra Copa" traz o mesmo país em outra época.'],
    ['🕶️','Clássico ou De almanaque','No Clássico os overalls ficam escondidos — vale o que você sabe de futebol. No De almanaque, os números aparecem.'],
    ['⚽','Monte os 11 + banco','Toque numa posição e escolha quem joga ali (a lista mostra só quem encaixa). Depois dos 11, escolha até 7 reservas. Dá pra trocar titulares de posição tocando num e depois no outro.'],
    ['🏆','A Copa','Sua Seleção dos Sonhos entra num Mundial de 32: fase de grupos, mata-mata, prorrogação e pênaltis. Só os 2 primeiros do grupo avançam.'],
    ['✦','Durante a partida','Mude o estilo-base na aba Tática, faça até 5 substituições no Elenco e acompanhe tudo em 1X a TURBO. Placar, tempo, momentum, fôlego e expulsões ajustam temporariamente o plano dos dois times — a leitura aparece ao vivo na própria aba Tática.'],
  ];
  app().innerHTML = `
    ${header('Como funciona', 'home')}
    <div class="screen">
      <div class="card">
        ${steps.map((s,i)=>`<div class="howstep">
          <div class="hs-n">${i+1}</div>
          <div><div class="hs-t">${s[0]} ${s[1]}</div><div class="hs-d">${s[2]}</div></div>
        </div>`).join('')}
      </div>
      <div style="margin-top:auto;padding-top:16px">
        <button class="btn btn-gold" data-go="setup">Montar meu time</button>
        <button class="btn btn-ghost" data-go="home">Voltar</button>
      </div>
    </div>`;
};

/* =============================== SETUP =================================== */

// ═══ TÁTICA SEM SLIDERS (§item4): eixos em 5 posições tocáveis ═══
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

SCREENS.setup = function () {
  function render() {
    const form = FORMATIONS[G.formKey];
    const vari = form.variations[G.varIdx % form.variations.length];
    app().innerHTML = `
      ${header('Preparação', 'home')}
      <div class="screen">
        <div class="eyebrow">Modo de draft</div>
        <div class="modegrid" style="margin-top:8px">
          <div class="modecard ${G.modo === 'classico' ? 'on' : ''}" data-modo="classico" role="button">
            <div class="mc-i">🕶️</div><div class="mc-t">Clássico</div>
            <div class="mc-d">Sem overall no draft. Vale o seu conhecimento de futebol.</div>
          </div>
          <div class="modecard ${G.modo === 'almanaque' ? 'on' : ''}" data-modo="almanaque" role="button">
            <div class="mc-i">📖</div><div class="mc-t">De almanaque</div>
            <div class="mc-d">Overall visível. Monte o time com os números na mão.</div>
          </div>
        </div>

        <div class="eyebrow" style="margin-top:16px">Estilo de jogo</div>
        <div style="margin-top:8px">
          ${STYLE_KEYS.map(k => {
            const st = STYLE_FX[k];
            const icon = { tiki: '🎯', counter: '⚡', press: '🔥', direct: '🚀', wings: '🦅', balanced: '⚖️', park: '🚌' }[k] || '⚽';
            return `<div class="stylerow ${G.style === k ? 'on' : ''}" data-style="${k}" role="button">
              <div class="st-i">${icon}</div>
              <div><div class="st-t">${st.l}</div><div class="st-d">${st.d}</div></div>
            </div>`;
          }).join('')}
        </div>

        ${G.style ? `<div class="eyebrow" style="margin-top:16px">Tática fina <span style="opacity:.55;font-weight:500">— toque na posição</span></div>
        <div style="margin-top:8px">${axesSegHtml(G.axes || STYLE_AXES[G.style] || STYLE_AXES.balanced)}</div>` : ''}

        <div class="eyebrow" style="margin-top:16px">Formação</div>
        <div class="pills" style="margin-top:6px">
          ${FORMATION_KEYS.map(k => `<button class="pill ${k === G.formKey ? 'on' : ''}" data-f="${k}">${k}</button>`).join('')}
        </div>
        <div class="pills">
          ${form.variations.map((v, i) => `<button class="pill ${i === G.varIdx % form.variations.length ? 'on' : ''}" data-v="${i}">${esc(v.name)}</button>`).join('')}
        </div>
        <div class="pitch sm" id="minipitch"><div class="mid"></div><div class="circle"></div></div>

        <div style="margin-top:auto;padding-top:16px">
          <button class="btn btn-gold" id="bt-draft">Iniciar draft</button>
        </div>
      </div>`;
    const mp = $('#minipitch');
    for (const sl of vari.slots) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.style.left = (sl.y * 100) + '%';
      chip.style.top = (100 - sl.x * 92 - 5) + '%';
      chip.innerHTML = `<div class="dot">${SLOT_PT[sl.pos]}</div>`;
      mp.appendChild(chip);
    }
    document.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { G.modo = b.dataset.modo; render(); });
    document.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { G.style = b.dataset.style; G.axes = Object.assign({}, STYLE_AXES[b.dataset.style] || STYLE_AXES.balanced); render(); });
    bindAxesSeg(document, () => {
      if (!G.axes) G.axes = Object.assign({}, STYLE_AXES[G.style] || STYLE_AXES.balanced);
      return G.axes;
    }, () => {});
    // reforço por DELEGAÇÃO (imune a re-render/closures): captura qualquer toque
    // num segmento de eixo no setup e grava direto em G.axes.
    if (!document._axDelegated) {
      document._axDelegated = true;
      document.addEventListener('click', (ev) => {
        const btn = ev.target.closest && ev.target.closest('.axseg');
        if (!btn) return;
        const seg = btn.closest('[data-ax]'); if (!seg || !seg.querySelector('.axseg')) return;
        // só age no setup (na partida o handler do game.js cuida)
        if (!document.querySelector('#bt-draft')) return;
        if (!G.axes) G.axes = Object.assign({}, STYLE_AXES[G.style] || STYLE_AXES.balanced);
        G.axes[seg.dataset.ax] = +btn.dataset.v;
        seg.querySelectorAll('.axseg').forEach(x => {
          const on = x === btn;
          x.style.border = `1.5px solid ${on?'#ffcb45':'rgba(255,255,255,.14)'}`;
          x.style.background = on ? '#ffcb45' : 'rgba(255,255,255,.05)';
        });
      });
    }
    document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { G.formKey = b.dataset.f; G.varIdx = 0; render(); });
    document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { G.varIdx = +b.dataset.v; render(); });
    $('#bt-draft').onclick = () => {
      if (!G.style) { toast('Escolha um estilo de jogo!'); return; }
      startDraft();
      go('draft');
    };
  }
  render();
};

/* =============================== DRAFT =================================== */
function draftSlots() {
  const form = FORMATIONS[G.formKey];
  return form.variations[G.varIdx % form.variations.length].slots;
}
function startDraft() {
  G.draft = {
    rerolls: 4, used: new Set(), cur: null, await: true,
    slots: draftSlots().map(sl => ({ pos: sl.pos, x: sl.x, y: sl.y, p: null, from: null })),
    benchPicks: [], selP: null, selSlot: null, targetSlot: null, busy: false,
  };
  G.atkForm = G.formKey; G.defForm = G.formKey;
}
function filled() { return G.draft.slots.filter(s => s.p).length; }
function keyOf(t) { return t.c + '|' + t.y; }
function rollTeam(kind) {
  const d = G.draft, all = G.db.squads;
  d.revealing = true;
  // roleta: pisca bandeiras aleatórias e desacelera até a sorteada
  d.rollFlags = []; for (let i=0;i<10;i++) d.rollFlags.push(rnd(all).f);
  clearInterval(d._rollIv);
  let tick = 0;
  d._rollIv = setInterval(() => {
    tick++;
    const fl = $('#fr-flag');
    if (fl) fl.innerHTML = window.flagSvg(rnd(all).f, 38);
    // desacelera: intervalos crescentes cortam sozinhos ao fim
  }, 70);
  setTimeout(() => {
    clearInterval(d._rollIv);
    if (G.draft) { G.draft.revealing = false; if (G.screen === 'draft') renderDraft(); }
  }, 560);
  let pool;
  if (kind === 'team' && d.cur) {          // outra seleção da MESMA Copa
    pool = all.filter(t => t.y === d.cur.y && t.c !== d.cur.c && !d.used.has(keyOf(t)));
    if (!pool.length) pool = all.filter(t => !d.used.has(keyOf(t)) && t.c !== d.cur.c);
  } else if (kind === 'cup' && d.cur) {    // a MESMA seleção em outra Copa
    pool = all.filter(t => t.c === d.cur.c && t.y !== d.cur.y && !d.used.has(keyOf(t)));
    if (!pool.length) pool = all.filter(t => t.y === d.cur.y && t.c !== d.cur.c && !d.used.has(keyOf(t)));
  } else {
    pool = all.filter(t => !d.used.has(keyOf(t)) && !(d.cur && t.c === d.cur.c && t.y === d.cur.y));
  }
  if (!pool.length) { d.used = new Set(); pool = all.slice(); }
  d.cur = rnd(pool);
  d.used.add(keyOf(d.cur));
  d.selP = null;
}
function placePick(slotIdx, p) {
  const d = G.draft, sl = d.slots[slotIdx];
  sl.p = p; sl.from = { c: d.cur.c, f: d.cur.f, y: d.cur.y, sid: d.cur.sid };
  d.selP = null; d.selSlot = null; d.targetSlot = null;
  confirmAndRoll(p.n, 'campo');
}
function confirmAndRoll(name, dest) {
  const d = G.draft;
  d.await = true; d.busy = false;
  renderDraft();
  const l = $('#d-plist');
  if (l) l.innerHTML = `<div class="tc"><div class="tc-ck">✅</div><div class="tc-nm">${esc(name.toUpperCase())}</div><div class="tc-ds">${dest === 'banco' ? 'Adicionado ao banco' : 'Adicionado ao time'}</div></div>`;
}
function pickedIds() {
  const d = G.draft, ids = new Set();
  d.slots.forEach(s => s.p && ids.add(s.p.id));
  d.benchPicks.forEach(b => ids.add(b.p.id));
  return ids;
}
function selectPlayer(pid) {
  const d = G.draft;
  if (d.busy || d.await || !d.cur) return;
  const p = d.cur.pl.find(x => x.id === pid);
  if (!p) return;
  if (pickedIds().has(p.id)) { toast('Já está no seu time.'); return; }
  if (filled() >= 11) {                                     // fase banco
    if (d.benchPicks.length >= 7) { toast('Banco cheio (7/7)!'); return; }
    d.benchPicks.push({ p, from: { c: d.cur.c, f: d.cur.f, y: d.cur.y, sid: d.cur.sid } });
    confirmAndRoll(p.n, 'banco'); renderBenchOnly(); return;
  }
  if (d.targetSlot !== null) {                              // slot já escolhido
    const ts = d.slots[d.targetSlot];
    if (ts && !ts.p) {
      if (!canPlay(p, ts.pos)) { toast(`${p.n} não joga de ${SLOT_PT[ts.pos]}.`); return; }
      placePick(d.targetSlot, p); renderDraft(true); return;
    }
  }
  d.selP = p; d.selSlot = null;
  renderDraft();
}
function clickSlot(idx) {
  const d = G.draft;
  if (d.busy) return;
  const slot = d.slots[idx];
  if (d.selP) {                                             // jogador → slot
    const p = d.selP;
    if (!canPlay(p, slot.pos)) { toast(`${p.n} não joga de ${SLOT_PT[slot.pos]}.`); return; }
    if (slot.p) { toast('Posição ocupada — toque num espaço vazio.'); d.selP = null; renderDraft(); return; }
    placePick(idx, p); renderDraft(true); return;
  }
  if (d.selSlot !== null) {                                 // slot → slot (troca)
    const A = d.slots[d.selSlot], B = d.slots[idx];
    if (d.selSlot === idx || !A.p) { d.selSlot = null; renderDraft(); return; }
    const aOk = canPlay(A.p, B.pos);
    const bOk = !B.p || canPlay(B.p, A.pos);
    if (aOk && bOk) {
      [A.p, B.p] = [B.p, A.p]; [A.from, B.from] = [B.from, A.from];
      d.selSlot = null; renderDraft();
    } else toast('Troca incompatível.');
    return;
  }
  if (!slot.p) { d.targetSlot = d.targetSlot === idx ? null : idx; renderDraft(); return; }
  d.selSlot = idx; d.targetSlot = null; renderDraft();
}

let draftFilter = 'all', draftSearch = '';
SCREENS.draft = function () { renderDraft(); };
function renderDraft(keepList) {
  const d = G.draft; if (!d) return;
  if (d.await || !d.cur) { renderAwait(); return; }
  const team = d.cur;
  const nPick = Math.min(filled() + 1, 11);
  const benchPhase = filled() >= 11;
  const hideOvr = (G.modo === 'classico') && !benchPhase;   // clássico: às cegas até fechar os 11

  app().innerHTML = `
    ${header(benchPhase ? `Banco ${d.benchPicks.length}/7` : `Escolha ${nPick}/11`)}
    <div class="screen" style="padding-bottom:14px">
      <div class="draft-team ${d.revealing ? 'revealing' : ''}">
        ${d.revealing
          ? `<div class="flagroll">
               <div class="fr-window"><span class="fr-flag" id="fr-flag">${window.flagSvg(d.rollFlags ? d.rollFlags[0] : '🏳️', 38)}</span></div>
               <div class="fr-txt"><div class="fr-nm spinning">Sorteando…</div><div class="fr-yr">girando o globo</div></div>
             </div>
             <div class="dt-rr"></div>`
          : `<div class="dt-flag landed" id="d-flag">${window.flagSvg(team.f, 40)}</div>
             <div>
               <div class="dt-name">${esc(team.c)}</div>
               <div class="dt-year">Copa de ${team.y} ${G.modo === 'almanaque' ? `· OVR ${team.r}` : ''}</div>
             </div>
             <div class="dt-rr">
               <button class="rrbtn" id="bt-rteam" ${d.rerolls <= 0 ? 'disabled' : ''}>↻ Outra seleção</button>
               <button class="rrbtn" id="bt-rcup" ${d.rerolls <= 0 ? 'disabled' : ''}>↻ Outra Copa</button>
             </div>`}
      </div>
      <div class="draft-hud">
        <div class="hud-pick">${benchPhase ? 'RESERVAS — toque para adicionar' : 'Leve <span class="gold">1 jogador</span> desta seleção'}</div>
        <div class="hud-rr">Rerolls <b id="d-rl">${d.rerolls}</b></div>
      </div>

      ${(() => { const nc = {}; d.slots.forEach(s => { if (s.p && s.from && s.from.c) nc[s.from.c] = (nc[s.from.c] || 0) + 1; }); const e = Object.entries(nc).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0]; return e ? `<div class="chem-note">🔗 Entrosamento: <b>${e[1]}</b> de ${esc(e[0])}${e[1] >= 3 ? ' · <span class="gold">bônus ativo!</span>' : ''}</div>` : ''; })()}
      <div class="pitch sm" id="dpitch"><div class="mid"></div><div class="circle"></div></div>
      ${benchPhase ? `<div class="benchbar" id="benchbar"></div>` : ''}
      ${d.selP ? a8Panel(d.selP, hideOvr) : `<p class="mut" style="font-size:12px;margin:8px 2px">${hintText()}</p>`}

      <div class="pills" style="padding-top:2px">
        ${['all', 'gk', 'def', 'mid', 'att'].map(f => `<button class="pill ${draftFilter === f ? 'on' : ''}" data-df="${f}">${f === 'all' ? 'Todos' : GRP_LABEL[f]}</button>`).join('')}
      </div>
      <input class="searchbox" id="d-search" placeholder="Buscar jogador…" value="${esc(draftSearch)}" autocomplete="off">
      <div class="card" style="padding:4px 10px;margin-top:8px">
        <div id="d-plist"></div>
      </div>
      <div id="d-actions" style="margin-top:12px"></div>
    </div>`;

  paintPitch();
  if (benchPhase) paintBench();
  if (!keepList) paintList();
  else paintList(); // lista sempre re-pinta (confirmAndRoll sobrescreve depois)
  paintActions();

  const rt = $('#bt-rteam'), rc = $('#bt-rcup');
  if (rt) rt.onclick = () => useReroll('team');
  if (rc) rc.onclick = () => useReroll('cup');
  document.querySelectorAll('[data-df]').forEach(b => b.onclick = () => { draftFilter = b.dataset.df; paintList(); document.querySelectorAll('[data-df]').forEach(x => x.classList.toggle('on', x.dataset.df === draftFilter)); });
  const sb = $('#d-search');
  sb.oninput = () => { draftSearch = sb.value; paintList(); };
}
function a8Panel(p, hide) {
  const items = attr8(p);
  return `<div class="a8">
    <div class="a8h"><span class="posb ${posGroup(p)}">${SLOT_PT[p.slot]||p.slot||''}</span><span class="nm">${esc(p.n)}</span><span class="ovr ${hide?'g0':ovrClass(p.r)}" style="font-family:var(--f-display);font-size:20px">${hide?'?':p.r}</span></div>
    ${items.map(a=>{
      const col = a.v>=88?'var(--ouro)':a.v>=78?'var(--verde)':a.v>=68?'var(--azul)':'#5a6c8f';
      return `<div class="a8i">
        <div class="v" style="color:${hide?'var(--mut)':col}">${hide?'?':a.v}</div>
        <div class="l">${a.k}</div>
        <div class="bar"><i style="width:${hide?0:a.v}%;background:${col}"></i></div>
      </div>`;
    }).join('')}
  </div>`;
}
function renderAwait() {
  const d = G.draft;
  const nPick = Math.min(filled() + 1, 11);
  const benchPhase = filled() >= 11;
  app().innerHTML = `
    ${header(benchPhase ? `Banco ${d.benchPicks.length}/7` : `Escolha ${nPick}/11`)}
    <div class="screen">
      <div class="draw-stage">
        <div class="eyebrow">${filled() === 0 && !d.benchPicks.length ? 'Hora de montar o time' : 'Próxima seleção'}</div>
        <div class="draw-pot"><div class="ball">?</div></div>
        <p class="mut" style="font-size:13px;max-width:280px;margin:10px auto 0">Sorteie uma seleção histórica — você leva <b class="gold">um jogador</b> dela.</p>
      </div>
      <div class="pitch sm" id="dpitch" style="margin-top:12px"><div class="mid"></div><div class="circle"></div></div>
      ${benchPhase ? `<div class="benchbar" id="benchbar"></div>` : ''}
      <div style="margin-top:auto;padding-top:14px">
        <button class="btn btn-gold" id="bt-roll">🎲 Sortear seleção</button>
        ${filled() >= 11 ? `<button class="btn btn-blue" id="bt-tocup" style="margin-top:8px">Ir para a Copa ⚽</button>` : ''}
      </div>
    </div>`;
  paintPitch();
  if (benchPhase) paintBench();
  $('#bt-roll').onclick = () => { d.await = false; rollTeam('auto'); renderDraft(); };
  const tc = $('#bt-tocup'); if (tc) tc.onclick = finishDraft;
}
function hintText() {
  const d = G.draft;
  if (filled() >= 11) return 'Time completo! Adicione reservas ou toque em <b>Ir para a Copa</b>. Toque em dois titulares para trocar posições.';
  if (d.targetSlot !== null) return `Escolha quem joga de <b>${SLOT_PT[d.slots[d.targetSlot].pos]}</b> — mostrando só quem encaixa.`;
  if (d.selP) return `Toque numa posição <b>vazia</b> do campo para colocar <b>${esc(d.selP.n)}</b>.`;
  return 'Toque num jogador da lista e depois numa posição do campo — ou toque primeiro na posição.';
}
function useReroll(kind) {
  const d = G.draft;
  if (d.busy || d.revealing) return;
  if (d.rerolls <= 0) { toast('Sem rerolls!'); return; }
  d.rerolls--; rollTeam(kind); renderDraft();
}
function paintPitch() {
  const d = G.draft, mp = $('#dpitch');
  const hideOvr = (G.modo === 'classico') && filled() < 11;
  d.slots.forEach((sl, i) => {
    const chip = document.createElement('div');
    let cls = 'chip';
    if (i === d.targetSlot) cls += ' target';
    if (i === d.selSlot) cls += ' sel';
    if (!sl.p) cls += ' empty';
    // destaque: posições onde o jogador selecionado encaixa (§feedback)
    if (d.selP) cls += (!sl.p && canPlay(d.selP, sl.pos)) ? ' can' : ' dim';
    else if (d.selSlot !== null && i !== d.selSlot && d.slots[d.selSlot].p) {
      const A = d.slots[d.selSlot];
      const ok = canPlay(A.p, sl.pos) && (!sl.p || canPlay(sl.p, A.pos));
      cls += ok ? ' can' : ' dim';
    }
    chip.className = cls;
    chip.style.left = (sl.y * 100) + '%';
    chip.style.top = (100 - sl.x * 92 - 5) + '%';
    if (sl.p) {
      const ovr = hideOvr ? '?' : sl.p.r;
      chip.innerHTML = `<div class="dot ${hideOvr ? 'hid' : (sl.p.r >= 88 ? 'ovr-hi' : '')}">${ovr}</div>
        <span class="flagmini">${window.flagSvg(sl.from.f, 12)}</span>
        <div class="tag">${esc(shortName(sl.p.n))}</div><div class="pos">${SLOT_PT[sl.pos]}</div>`;
    } else {
      chip.innerHTML = `<div class="dot">+</div><div class="pos">${SLOT_PT[sl.pos]}</div>`;
    }
    chip.onclick = () => clickSlot(i);
    mp.appendChild(chip);
  });
}
function paintBench() {
  const el = $('#benchbar'); if (!el) return;
  const d = G.draft;
  el.innerHTML = d.benchPicks.map((b, i) =>
    `<span class="bchip">${window.flagSvg(b.from.f, 13)} ${esc(shortName(b.p.n))} <span class="ovr ${ovrClass(b.p.r)}" style="font-size:14px">${b.p.r}</span><span class="x" data-bx="${i}">✕</span></span>`
  ).join('') || '<span class="mut" style="font-size:12px;padding:4px">Banco vazio — escolha até 7 reservas.</span>';
  el.querySelectorAll('[data-bx]').forEach(x => x.onclick = () => { d.benchPicks.splice(+x.dataset.bx, 1); paintBench(); const h = document.querySelector('.top .phase'); if (h) h.textContent = `Banco ${d.benchPicks.length}/7`; });
}
function renderBenchOnly() { paintBench(); }
function paintList() {
  const d = G.draft, el = $('#d-plist'); if (!el || d.busy) return;
  if (d.revealing) { el.innerHTML = '<div class="tc"><div class="tc-ck">🏆</div><div class="tc-ht">Sorteando próxima seleção…</div></div>'; return; }
  const benchPhase = filled() >= 11;
  const hideOvr = (G.modo === 'classico') && !benchPhase;
  const taken = pickedIds();
  const tSlot = d.targetSlot !== null ? d.slots[d.targetSlot] : null;
  let list = d.cur.pl.slice().sort((a, b) => (a.num || 99) - (b.num || 99));
  if (draftFilter !== 'all') list = list.filter(p => posGroup(p) === draftFilter);
  if (draftSearch.trim()) { const q = draftSearch.trim().toLowerCase(); list = list.filter(p => p.n.toLowerCase().includes(q)); }
  // draft inteligente (§8): com posição selecionada, só mostra quem encaixa
  if (tSlot) list = list.filter(p => canPlay(p, tSlot.pos) || taken.has(p.id));
  el.innerHTML = list.map(p => {
    const got = taken.has(p.id);
    const compat = tSlot ? canPlay(p, tSlot.pos) : true;
    const isLegend = p.r >= 92;   // #8 — craques lendários ganham destaque dourado no draft
    const cls = 'row' + (d.selP && d.selP.id === p.id ? ' sel' : '') + (tSlot && !compat && !got ? ' incompat' : '') + (got ? ' incompat' : '') + (isLegend ? ' legend-row' : '');
    return `<div class="${cls}" data-pid="${p.id}">
      <span class="posb ${posGroup(p)}">${SLOT_PT[p.slot] || p.slot}</span>
      <div class="grow">
        <div class="nm">${esc(p.n)} ${G.modo !== 'classico' ? ((p.r >= 88 || p.legend) ? '<span class="gold">★</span>' : (p.traits && p.traits.length ? '<span class="spec">◆</span>' : '')) : ''}</div>
        <div class="sb">${p.num ? 'Camisa ' + p.num : ''}${got ? ' · JÁ NO SEU TIME' : ''}</div>
      </div>
      <div class="ovr ${hideOvr ? 'g0' : ovrClass(p.r)}">${hideOvr ? '?' : p.r}</div>
    </div>`;
  }).join('') || '<div class="mut" style="padding:12px 4px;font-size:13px">Ninguém aqui com esse filtro.</div>';
  el.querySelectorAll('[data-pid]').forEach(r => r.onclick = () => selectPlayer(r.dataset.pid));
}
function paintActions() {
  const el = $('#d-actions'); if (!el) return;
  if (filled() >= 11) {
    el.innerHTML = `<button class="btn btn-gold" id="bt-tocup">Ir para a Copa ⚽</button>`;
    $('#bt-tocup').onclick = finishDraft;
  } else el.innerHTML = '';
}
/* ============================ SALVAR / CARREGAR (L2) =====================
   Persistência via localStorage. Salva o essencial: os picks do draft (jogador +
   nação + posição), o banco, os ajustes (estilo/eixos/formação) e a Copa inteira
   (G.cup é serializável — guarda times por SID, não objetos pesados). NÃO salva
   G.db (é reconstruída no boot a partir dos dados fixos). No load, recria o time
   "ME" com os mesmos picks (registerPlayerTeam) e restaura a Copa. Tudo blindado:
   qualquer erro no save/load é engolido e o jogo segue normal.
   Obs.: alguns previews de app não persistem localStorage — no Safari funciona. */
const SAVE_KEY = 'copa_save';
function saveGame() {
  try {
    if (!G.cup || !G.draft) return;
    const d = G.draft;
    const save = {
      v: 1, modo: G.modo, style: G.style, axes: G.axes, formKey: G.formKey, varIdx: G.varIdx,
      picks: d.slots.map(sl => ({ p: sl.p, from: sl.from, x: sl.x, y: sl.y, pos: sl.pos })),
      benchPicks: d.benchPicks,
      cup: G.cup,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (_) {}
}
window._saveCopa = saveGame;                       // pra o game.js chamar após cada partida
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; } }
function loadGame() {
  let save;
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (_) { return false; }
  if (!save || save.v !== 1 || !save.cup || !Array.isArray(save.picks) || save.picks.length < 11) return false;
  try {
    G.modo = save.modo; G.style = save.style; G.axes = save.axes; G.formKey = save.formKey; G.varIdx = save.varIdx;
    const me = CUP.registerPlayerTeam(G.db, save.picks.map(pk => ({ p: pk.p, from: pk.from })), save.benchPicks || []);
    G.lineup = save.picks.map((pk, i) => ({ p: me.pl[i], x: pk.x, y: pk.y, pos: pk.pos, from: pk.from }));
    G.bench = me.pl.slice(11);
    G.cup = save.cup;
    return true;
  } catch (e) { return false; }
}

function finishDraft() {
  const d = G.draft;
  if (filled() < 11) { toast('Complete os 11 titulares!'); return; }
  const picksOrdered = d.slots.map(sl => ({ p: sl.p, from: sl.from }));
  const me = CUP.registerPlayerTeam(G.db, picksOrdered, d.benchPicks);
  G.lineup = d.slots.map((sl, i) => ({ p: me.pl[i], x: sl.x, y: sl.y, pos: sl.pos, from: sl.from }));   // #7 leva a nação de origem (química)
  G.bench = me.pl.slice(11);
  G.cup = CUP.createCup(G.db, 'ME');
  saveGame();   // L2: salva o progresso ao terminar o draft
  go('cup');
}

/* ============================= HUB DA COPA =============================== */
let cupTab = 'rodada';
SCREENS.cup = function () {
  const cup = G.cup, db = G.db;
  const phaseName = { groups: ['1ª rodada', '2ª rodada', '3ª rodada'][cup.round] || 'Grupos',
    r16: 'Oitavas de final', qf: 'Quartas de final', sf: 'Semifinal', third: 'Disputa de 3º', final: 'FINAL', done: 'Fim da Copa' };

  function nextMatchCard() {
    if (cup.phase === 'done') return champCard();
    if (cup.phase === 'third' && CUP.playerAlive(cup) && !CUP.playerMatchOfRound(cup)) {
      CUP.playKnockoutStage(cup, db, false);
      CUP.advanceKnockout(cup);
    }
    const m = CUP.playerMatchOfRound(cup);
    if (!m) return elimCard();
    const H = db.byId[m.h], A = db.byId[m.a];
    return `<div class="card">
      <div class="eyebrow">${phaseName[cup.phase]}</div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin-top:8px;text-align:center">
        <div><div style="font-size:34px">${window.flagSvg(H.f, 30)}</div><div class="cond" style="font-size:13px">${esc(H.c)} ${H.y === 2026 && H.sid === 'ME' ? '' : H.y}</div></div>
        <div class="display" style="font-size:22px;color:var(--mut)">VS</div>
        <div><div style="font-size:34px">${window.flagSvg(A.f, 30)}</div><div class="cond" style="font-size:13px">${esc(A.c)} ${A.y === 2026 && A.sid === 'ME' ? '' : A.y}</div></div>
      </div>
      <div style="margin-top:12px"><button class="btn btn-gold" id="bt-play">Jogar partida</button></div>
    </div>`;
  }
  function elimCard() {
    return `<div class="card" style="text-align:center">
      <div style="font-size:40px">😞</div>
      <div class="display" style="font-size:22px;margin-top:6px">Fim de linha</div>
      <p class="mut" style="font-size:13px">Sua seleção foi eliminada. Acompanhe o resto da Copa ou recomece.</p>
      <button class="btn btn-blue" id="bt-simrest">Simular próxima fase</button>
      <div class="mut cond" id="simmsg" style="font-size:12px;margin-top:8px;display:none">Simulando…</div>
      <button class="btn btn-ghost" data-go="home" style="margin-top:8px">Jogar novamente</button>
    </div>`;
  }
  function champCard() {
    const c = db.byId[cup.champion];
    const mine = cup.champion === cup.playerSid;
    return `<div class="card champ">
      <div class="trophy">🏆</div>
      <h1 class="display">${mine ? 'CAMPEÃO!' : 'Copa encerrada'}</h1>
      <span class="flagbig">${window.flagSvg(c.f, 52)}</span>
      <div class="cond" style="font-size:16px;margin-top:4px">${esc(c.c)}${c.sid === 'ME' ? '' : ' ' + c.y} ${mine ? '— você levantou a taça!' : 'é o grande campeão.'}</div>
      <div class="mut" style="font-size:13px;margin-top:6px">Vice: ${window.flagSvg(db.byId[cup.runnerUp].f, 13)} ${esc(db.byId[cup.runnerUp].c)} · 3º: ${window.flagSvg(db.byId[cup.third].f, 13)} ${esc(db.byId[cup.third].c)}</div>
      <button class="btn btn-gold" data-go="home" style="margin-top:14px">Jogar novamente</button>
    </div>`;
  }
  function groupsHtml() {
    return cup.groups.map(g => {
      const rows = CUP.tableOf({ teams: g.teams.map(sid => ({ sid })) }, cup.results[g.name]);
      return `<div class="card">
        <div class="eyebrow">Grupo ${g.name}</div>
        <table class="tbl"><thead><tr><th>Seleção</th><th>P</th><th>J</th><th>SG</th><th>GP</th></tr></thead><tbody>
        ${rows.map((r, i) => {
          const t = db.byId[r.sid];
          return `<tr class="${r.sid === cup.playerSid ? 'me' : ''} ${i < 2 ? 'q' : ''}">
            <td><span class="tm">${window.flagSvg(t.f, 14)} ${esc(t.c)} <span class="y">${t.sid === 'ME' ? '' : t.y}</span></span></td>
            <td><b>${r.pts}</b></td><td>${r.j}</td><td>${r.gp - r.gc}</td><td>${r.gp}</td></tr>`;
        }).join('')}
        </tbody></table>
      </div>`;
    }).join('');
  }
  function tieHtml(m) {
    if (!m) return '';
    const H = db.byId[m.h], A = db.byId[m.a];
    const done = !!m.g;
    const w = done ? CUP.winnerOf(m) : null;
    const mine = m.h === cup.playerSid || m.a === cup.playerSid;
    return `<div class="tie ${mine ? 'me' : ''}">
      <div class="ln ${done && w === m.h ? 'w' : ''}"><span>${window.flagSvg(H.f, 15)}</span><span class="nm2">${esc(H.c)} ${H.sid === 'ME' ? '' : H.y}</span><span class="sc">${done ? m.g[0] : '–'}</span></div>
      <div class="ln ${done && w === m.a ? 'w' : ''}"><span>${window.flagSvg(A.f, 15)}</span><span class="nm2">${esc(A.c)} ${A.sid === 'ME' ? '' : A.y}</span><span class="sc">${done ? m.g[1] : '–'}</span></div>
      ${m.pens ? `<div class="pens">Pênaltis ${m.pens[0]}–${m.pens[1]}</div>` : ''}
    </div>`;
  }
  function bracketHtml() {
    if (!cup.ko) return `<div class="card mut" style="text-align:center">O chaveamento aparece após a fase de grupos.</div>`;
    const ko = cup.ko;
    const sec = (title, arr) => arr && arr.length ? `<div class="eyebrow" style="margin:10px 2px 6px">${title}</div><div class="bracket">${arr.map(m => tieHtml(m)).join('')}</div>` : '';
    return sec('Oitavas', ko.r16) + sec('Quartas', ko.qf) + sec('Semifinais', ko.sf) + sec('3º lugar', ko.third) + sec('Final', ko.final);
  }
  function scorersHtml() {
    const arts = CUP.topScorers(cup, db, 12);
    if (!arts.length) return `<div class="card mut" style="text-align:center">Ainda sem gols na Copa.</div>`;
    return `<div class="card">${arts.map((a, i) => `
      <div class="row" style="cursor:default${i === 0 ? ';background:linear-gradient(90deg,rgba(255,215,0,.14),transparent)' : ''}">
        <div class="display" style="width:24px;font-size:${i < 3 ? '17px' : '13px'};color:${i === 0 ? 'var(--ouro)' : 'var(--mut)'}">${i === 0 ? '🥇' : (i + 1)}</div>
        <div class="grow"><div class="nm"${i === 0 ? ' style="color:#ffdf70"' : ''}>${esc(a.n)}</div><div class="sb">${window.flagSvg(a.team.f, 12)} ${esc(a.team.c)} ${a.team.sid === 'ME' ? '' : a.team.y}</div></div>
        <div class="ovr g90">${a.gols}</div>
      </div>`).join('')}</div>`;
  }
  let squadExp = -1;
  function squadHtml() {
    return `<div class="card" style="padding:6px 10px">
      <div class="eyebrow" style="margin:6px 2px">Titulares · OVR ${teamOvr(G.lineup)} · toque para ver atributos</div>
      ${G.lineup.map((l, i) => `<div class="row" data-exp="${i}">
        <span class="posb ${GRP_OF_LINE[LINE_OF[l.pos]] || 'mid'}">${SLOT_PT[l.pos]}</span>
        <div class="grow"><div class="nm">${esc(l.p.n)}</div><div class="sb">${window.flagSvg(l.p.origin.f, 12)} ${esc(l.p.origin.c)} ${l.p.origin.y}</div></div>
        <div class="ovr ${ovrClass(l.p.r)}">${l.p.r}</div>
      </div>${squadExp === i ? a8Panel(l.p, false) : ''}`).join('')}
      ${G.bench.length ? `<div class="eyebrow" style="margin:12px 2px 6px">Banco</div>` + G.bench.map(b => `<div class="row" style="cursor:default">
        <span class="posb ${GRP_OF_LINE[LINE_OF[b.slot]] || 'mid'}">${SLOT_PT[b.slot] || ''}</span>
        <div class="grow"><div class="nm">${esc(b.n)}</div><div class="sb">${window.flagSvg(b.origin.f, 12)} ${esc(b.origin.c)} ${b.origin.y}</div></div>
        <div class="ovr ${ovrClass(b.r)}">${b.r}</div>
      </div>`).join('') : ''}
    </div>`;
  }

  function render() {
    app().innerHTML = `
      ${header(phaseName[cup.phase] || '')}
      <div class="screen">
        <div class="tabs">
          <button data-t="rodada" class="${cupTab === 'rodada' ? 'on' : ''}">Rodada</button>
          <button data-t="grupos" class="${cupTab === 'grupos' ? 'on' : ''}">Grupos</button>
          <button data-t="mata" class="${cupTab === 'mata' ? 'on' : ''}">Mata-mata</button>
          <button data-t="arti" class="${cupTab === 'arti' ? 'on' : ''}">Gols</button>
          <button data-t="time" class="${cupTab === 'time' ? 'on' : ''}">Time</button>
        </div>
        <div id="tabbody">
          ${cupTab === 'rodada' ? nextMatchCard() :
            cupTab === 'grupos' ? groupsHtml() :
            cupTab === 'mata' ? bracketHtml() :
            cupTab === 'arti' ? scorersHtml() : squadHtml()}
        </div>
      </div>`;
    document.querySelectorAll('.tabs [data-t]').forEach(b => b.onclick = () => { cupTab = b.dataset.t; render(); });
    document.querySelectorAll('[data-exp]').forEach(r => r.onclick = () => {
      squadExp = squadExp === +r.dataset.exp ? -1 : +r.dataset.exp; render();
    });
    const play = $('#bt-play');
    if (play) play.onclick = () => go('match');
    const simrest = $('#bt-simrest');
    if (simrest) simrest.onclick = () => {
      simrest.disabled = true; const msg = $('#simmsg'); if (msg) msg.style.display = '';
      setTimeout(() => { window.GAME.advanceAfterPlayerDone(); render(); }, 30);
    };
  }
  render();
};

/* ------------------------------- BOOT ------------------------------------ */
let _bootStarted = false;
/* ============================================================================
   PONTO 3 · BOOT/PRELOAD CROSS-DEVICE — REESCRITO
   ============================================================================
   Diagnóstico do travamento no mobile (por que só o celular quebrava):
   1. O agendamento antigo usava setTimeout(20ms). Em Safari/WebView móvel,
      timers disparados durante o parse da página podem rodar ANTES do primeiro
      frame ser pintado — a thread então mergulhava direto no buildDB (~5.600
      jogadores) e o usuário via a tela de carregamento congelar. A versão nova
      usa DOIS requestAnimationFrame encadeados: o 1º garante que o texto
      "Carregando…" foi COMPOSTO na tela; o 2º só então libera o trabalho
      pesado. É a única forma confiável de "pintar antes de calcular" no iOS.
   2. Só existia UM gatilho (DOMContentLoaded). Se ele fosse perdido — coisa
      comum quando a página volta do bfcache do iOS, ou quando um erro anterior
      interrompe o parser — o jogo simplesmente nunca iniciava. Agora há QUATRO
      gatilhos redundantes e idempotentes (o guard _bootStarted torna todos
      inofensivos entre si): DOMContentLoaded, load, um watchdog absoluto de
      1600 ms e o pageshow do bfcache.
   3. NENHUM asset externo participa do boot: nada de esperar fonte, imagem ou
      áudio. O jogo é 100% inline por design — a rotina agora deixa isso
      explícito e mensurável (status visível muda de fase na própria tela).
   ============================================================================ */
function bootGame() {
  if (_bootStarted) return;                 // idempotência entre os 4 gatilhos
  _bootStarted = true;
  const app = document.getElementById('app');
  if (app && !document.getElementById('boot-loading')) {
    app.innerHTML = '<div id="boot-loading" style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;background:#070b14;color:#ffcb45;font:700 18px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-align:center">Carregando Copa dos Sonhos…</div>';
  }
  // Status visível: se o boot parar, a mensagem congelada diz EM QUAL FASE.
  const paintStatus = function (txt) {
    const el = document.getElementById('boot-loading');
    if (el) el.textContent = txt;
  };
  const heavyInit = function () {
    try {
      paintStatus('Montando elencos e tabelas…');
      /* TIPOGRAFIA · AQUECIMENTO PARA O CANVAS: faces via @font-face só valem
         no canvas depois de carregadas; como são data-URI, isso é ~imediato,
         mas o load() explícito garante que o PRIMEIRO fillText da partida
         ("GOLAÇO...", HUD) já saia na fonte certa, sem um frame de fallback.
         Tudo assíncrono e à prova de navegador antigo (guard + catch). */
      try {
        if (document.fonts && document.fonts.load) {
          ["700 34px 'Anton'", "800 15px 'Barlow Condensed'",
           "600 14px 'Barlow Condensed'", "400 14px Inter"]
            .forEach(function (f) { document.fonts.load(f).catch(function () {}); });
        }
      } catch (_) {}
      srand(Date.now() >>> 0);
      if (!window.DATA) throw new Error('Banco de dados incorporado não encontrado.');
      G.db = buildDB(window.DATA);           // trabalho pesado: SÓ depois do 1º frame
      go('home');
    } catch (err) {
      const msg = 'Não foi possível iniciar o jogo: ' + ((err && err.message) || err);
      if (window.__showBootError) window.__showBootError(msg);
      if (app) app.innerHTML = '<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:28px;background:#070b14;color:#fff;font:16px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-align:center"><div><b style="color:#fb7185">Falha ao iniciar</b><br><br>' + String((err && err.message) || err).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}) + '<br><br><small style="color:#94a3b8">Abra o arquivo pelo Safari ou Chrome, fora da pré-visualização do aplicativo.</small></div></div>';
    }
  };
  // Duplo rAF: frame 1 pinta o "Carregando…", frame 2 executa o buildDB.
  // Fallback para setTimeout apenas em ambientes sem rAF (WebViews antigas).
  const frame = window.requestAnimationFrame
    ? function (f) { window.requestAnimationFrame(f); }
    : function (f) { setTimeout(f, 16); };
  frame(function () { frame(heavyInit); });
}
/* Gatilhos redundantes — todos idempotentes graças ao _bootStarted: */
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootGame, { once: true });
  window.addEventListener('load', bootGame, { once: true }); // se o DCL for perdido
  setTimeout(bootGame, 1600);                                // watchdog absoluto
} else {
  bootGame();                                                // script avaliado tarde
}
/* bfcache do iOS: ao voltar para a aba, o Safari pode restaurar a página sem
   redisparar DOMContentLoaded. pageshow cobre exatamente esse caso. */
window.addEventListener('pageshow', function () { if (!_bootStarted) bootGame(); });
})();


