/* Copa dos Sonhos · Auditoria 650 · acessibilidade itemizada
 * Implementa suporte técnico para A11Y-001..025. Testes com NVDA/VoiceOver e
 * painel humano continuam obrigatórios antes de declarar PASS final. */
(function (root) {
  'use strict';
  let lastModalTrigger = null;
  let lastScore = '';
  let lastScreen = '';

  function ensureLive(id, politeness) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement('div');
      node.id = id;
      node.className = 'audit650-sr';
      node.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
      node.setAttribute('aria-live', politeness || 'polite');
      node.setAttribute('aria-atomic', 'true');
      document.body.appendChild(node);
    }
    return node;
  }

  function visibleText(el) {
    return String(el.getAttribute('aria-label') || el.title || el.textContent || '')
      .replace(/\s+/g, ' ').trim();
  }

  function makeControlAccessible(el) {
    if (!el || el.matches('input,select,textarea,button,a[href]')) return;
    const clickable = el.hasAttribute('onclick') || el.classList.contains('btn') || el.getAttribute('role') === 'button';
    if (!clickable) return;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  }

  function syncStates() {
    document.querySelectorAll('[role="tab"],.tab,.spd,.seg button,.nav-item').forEach(el => {
      const active = el.classList.contains('active') || el.classList.contains('on') || el.getAttribute('data-active') === '1';
      if (el.getAttribute('role') === 'tab' || el.classList.contains('tab')) el.setAttribute('aria-selected', String(active));
      else el.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[aria-hidden="true"] [tabindex="0"]').forEach(el => el.setAttribute('tabindex', '-1'));
  }

  function buildFieldAlternative() {
    const cv = document.getElementById('fieldcv');
    if (!cv) return;
    cv.setAttribute('role', 'img');
    cv.setAttribute('tabindex', '0');
    cv.setAttribute('aria-label', 'Partida em campo 2.5D. Placar, eventos e escalações possuem alternativas textuais.');
    let alt = document.getElementById('field-text-alternative');
    if (!alt) {
      alt = document.createElement('section');
      alt.id = 'field-text-alternative';
      alt.className = 'audit650-sr';
      alt.setAttribute('aria-label', 'Estado textual da partida');
      cv.insertAdjacentElement('afterend', alt);
    }
    try {
      const sim = root.GAME && root.GAME._sim && root.GAME._sim();
      if (!sim) return;
      const st = sim.getState();
      const parts = [];
      (st.teams || []).forEach((team, ti) => {
        parts.push(`Time ${ti + 1}: ` + (team.players || []).map(p => `${(p.ref && p.ref.n) || p.n || 'Jogador'}, posição ${p.slot || 'não informada'}`).join('; '));
      });
      alt.textContent = parts.join('. ');
    } catch (_) { /* alternativa é melhor esforço; nunca quebra a partida */ }
  }

  function install() {
    document.documentElement.lang = 'pt-BR';
    const polite = ensureLive('match-live-feed', 'polite');
    const assertive = ensureLive('error-live-feed', 'assertive');

    document.querySelectorAll('button,a,[role="button"],.btn,.tab,.spd,[onclick]').forEach(el => {
      makeControlAccessible(el);
      if (!el.hasAttribute('aria-label')) {
        const name = visibleText(el);
        if (name) el.setAttribute('aria-label', name);
      }
    });

    document.querySelectorAll('.modal,.dialog,[aria-modal="true"]').forEach(modal => {
      if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
    });

    document.querySelectorAll('.error,.toast.error,[data-error]').forEach(el => {
      const text = visibleText(el);
      if (text && assertive.textContent !== text) assertive.textContent = text;
    });

    const score = document.getElementById('score');
    const scoreText = score ? visibleText(score) : '';
    if (scoreText && scoreText !== lastScore) {
      if (lastScore) polite.textContent = `Placar atualizado: ${scoreText}`;
      lastScore = scoreText;
    }
    const narr = document.getElementById('narr');
    const narration = narr ? visibleText(narr) : '';
    if (narration && polite.dataset.lastNarr !== narration) {
      polite.dataset.lastNarr = narration;
      polite.textContent = narration;
    }

    syncStates();
    buildFieldAlternative();

    const screen = (root.G && (root.G.screen || root.G.page || root.G.mode)) || document.body.dataset.screen || '';
    if (lastScreen && screen !== lastScreen && root.CDS_F25D && root.CDS_F25D.reset) root.CDS_F25D.reset();
    lastScreen = screen;
  }

  document.addEventListener('pointerdown', e => {
    const trigger = e.target.closest('button,a,[role="button"],.btn,[onclick]');
    if (trigger) lastModalTrigger = trigger;
  }, true);

  document.addEventListener('keydown', e => {
    const el = document.activeElement;
    if ((e.key === 'Enter' || e.key === ' ') && el && el.getAttribute('role') === 'button') {
      e.preventDefault(); el.click(); return;
    }
    if (e.key === 'Escape') {
      const close = document.querySelector('[aria-modal="true"] [data-close],.modal.on .close,.dialog.on .close,.modal:not([hidden]) .close');
      if (close) {
        e.preventDefault(); close.click();
        requestAnimationFrame(() => { if (lastModalTrigger && document.contains(lastModalTrigger)) lastModalTrigger.focus(); });
      }
    }
    const draggable = el && (el.draggable || el.matches('[data-player],[data-slot],.player-card'));
    if (draggable && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
      const peers = [...document.querySelectorAll('[data-player],[data-slot],.player-card')].filter(n => n.offsetParent !== null);
      const index = peers.indexOf(el);
      if (index >= 0 && peers.length > 1) {
        e.preventDefault();
        const delta = /Left|Up/.test(e.key) ? -1 : 1;
        peers[(index + delta + peers.length) % peers.length].focus();
      }
    }
  });

  const observer = new MutationObserver(install);
  root.addEventListener('DOMContentLoaded', () => {
    install();
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] });
  });
})(typeof window !== 'undefined' ? window : globalThis);
