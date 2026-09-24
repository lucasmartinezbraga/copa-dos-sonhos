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
