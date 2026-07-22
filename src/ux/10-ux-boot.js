/* Copa dos Sonhos · Camada UX · boot (não invasivo)
 * Liga o "modo dev" (revela os overlays de ferramentas) quando ?dev=1 na URL
 * ou localStorage cds_dev==='1'. ?dev=0 desliga. Nada aqui toca o motor. */
(function () {
  'use strict';
  try {
    var params = new URLSearchParams(location.search || '');
    var flag = params.get('dev');
    var dev = false;
    try { dev = localStorage.getItem('cds_dev') === '1'; } catch (e) {}
    if (flag === '1') { dev = true; try { localStorage.setItem('cds_dev', '1'); } catch (e) {} }
    if (flag === '0') { dev = false; try { localStorage.removeItem('cds_dev'); } catch (e) {} }
    if (dev) document.documentElement.classList.add('cds-dev');
  } catch (e) { /* silencioso: UX nunca deve travar o boot do jogo */ }
})();

/* ── A11-011..015: feed vivo de eventos para leitor de tela ──────────────────
 * Regiões aria-live persistentes + window.__cdsAnnounce(texto, urgente). O motor
 * chama isso nos eventos-chave (gol/cartão/substituição) via patch render-side.
 * Grande parte da partida é canvas; este é o canal textual acessível. */
(function () {
  'use strict';
  function inject() {
    if (!document.body || document.getElementById('cds-a11y-live')) return;
    var mk = function (id, mode) {
      var el = document.createElement('div');
      el.id = id; el.className = 'cds-sr-only';
      el.setAttribute('aria-live', mode);
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('role', mode === 'assertive' ? 'alert' : 'status');
      document.body.appendChild(el);
      return el;
    };
    var polite = mk('cds-a11y-live', 'polite');
    var urgent = mk('cds-a11y-alert', 'assertive');
    window.__cdsAnnounce = function (txt, isUrgent) {
      try {
        var el = isUrgent ? urgent : polite;
        el.textContent = '';                       // limpa p/ forçar re-anúncio
        setTimeout(function () { el.textContent = String(txt || ''); }, 30);
      } catch (e) {}
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
