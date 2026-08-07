
/* R18.17.3.1 · HOTFIX DE ENTRADA MÓVEL
   A ponte antiga interceptava touchend em capture e chamava preventDefault().
   Em Safari/iOS e em certos WebViews isso podia impedir o click sintetizado,
   deixando botões visíveis porém inertes. A navegação antecipada agora reage
   somente ao click real. Um fallback separado observa um toque curto e chama
   click() apenas se o WebView não tiver gerado o click nativo. */
(function (root) {
  'use strict';
  function closestHomeAction(target) {
    return target && target.closest ? target.closest('#bt-start,#bt-about,[data-go]') : null;
  }
  function routeFor(el) {
    if (!el) return null;
    if (el.id === 'bt-start') return 'setup';
    if (el.id === 'bt-about') return 'howto';
    return el.getAttribute('data-go');
  }
  function paintPending(route) {
    root.__CDS_PENDING_ROUTE = route || 'home';
    var app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div id="boot-loading" role="status" aria-live="polite" style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:28px;background:#070b14;color:#fff;font:16px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-align:center"><div><b style="display:block;color:#ffcb45;font-size:19px;margin-bottom:8px">Iniciando Copa dos Sonhos…</b><span style="color:#aebbd0">Preparando a tela solicitada. Não é necessário tocar novamente.</span></div></div>';
    }
    try { if (typeof root.__CDS_BOOT_NOW === 'function') root.__CDS_BOOT_NOW(); } catch (_) {}
  }
  document.addEventListener('click', function (ev) {
    var el = closestHomeAction(ev.target);
    if (!el) return;
    if (root.UI && typeof root.UI.go === 'function' && root.G && root.G.db) return;
    var route = routeFor(el);
    if (!route) return;
    ev.preventDefault();
    ev.stopPropagation();
    paintPending(route);
  }, true);

  /* Fallback para WebViews que não sintetizam click após o toque.
     Não usa preventDefault, não interfere na rolagem e só dispara depois de
     confirmar que nenhum click nativo ocorreu. */
  var pending = null;
  var lastNativeClickAt = -1e9;
  function actionable(target) {
    return target && target.closest ? target.closest('button,.btn,[role="button"],[data-go],input[type="button"],input[type="submit"]') : null;
  }
  document.addEventListener('click', function () {
    lastNativeClickAt = Date.now();
    if (pending) pending.clicked = true;
  }, true);
  document.addEventListener('touchstart', function (ev) {
    if (!ev.touches || ev.touches.length !== 1) { pending = null; return; }
    var el = actionable(ev.target);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') { pending = null; return; }
    var t = ev.touches[0];
    pending = { el: el, x: t.clientX, y: t.clientY, at: Date.now(), clicked: false };
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (ev) {
    if (!pending || !ev.touches || ev.touches.length !== 1) return;
    var t = ev.touches[0];
    if (Math.hypot(t.clientX - pending.x, t.clientY - pending.y) > 14) pending = null;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function (ev) {
    var p = pending; pending = null;
    if (!p || !p.el || !p.el.isConnected) return;
    var endedAt = Date.now();
    setTimeout(function () {
      if (!p.el.isConnected || p.el.disabled || p.el.getAttribute('aria-disabled') === 'true') return;
      if (p.clicked || lastNativeClickAt >= endedAt) return;
      try { p.el.click(); } catch (_) {}
    }, 420);
  }, { capture: true, passive: true });
})(window);
