
/* Diagnóstico técnico opcional. Em produção fica silencioso para não poluir
   o console nem criar faixas de erro sobre o jogo. Ative manualmente com
   window.CDS_DEBUG = true antes do boot quando precisar investigar. */
(function(){
  window.CDS_DEBUG = false;
  window.__cdsDebugWarn = function(){
    if (!window.CDS_DEBUG) return;
    try { if (window.console && console.warn) console.warn.apply(console, arguments); } catch (_) {}
  };
  function show(msg){
    try{
      var d=document.getElementById('__err__');
      if(!d){
        d=document.createElement('div'); d.id='__err__';
        d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#b00020;color:#fff;font:13px/1.5 -apple-system,system-ui,sans-serif;padding:12px 14px;white-space:pre-wrap;word-break:break-word;max-height:75vh;overflow:auto;box-shadow:0 2px 12px rgba(0,0,0,.5)';
        (document.body||document.documentElement).appendChild(d);
      }
      d.textContent += msg + "\n\n";
    }catch(_){}
  }
  window.__showBootError = show;
  if (!window.CDS_DEBUG) return;
  window.addEventListener('error', function(e){
    show('ERRO JS: ' + (e.message||e.type) + (e.filename? ('  ('+e.filename+':'+e.lineno+':'+e.colno+')') : ''));
  }, true);
  window.addEventListener('unhandledrejection', function(e){
    var r=e.reason; show('PROMISE: ' + ((r&&(r.stack||r.message))||r));
  });
})();
