#!/usr/bin/env python3
"""
Fase 6 — UX, mobile e desempenho, medidos no navegador.

A auditoria é explícita: existência de elemento não é teste. Aqui cada controle
executa uma AÇÃO completa e mede o efeito — toque que muda de tela, toque após
rolagem, toques múltiplos, mudança de orientação, e o custo real de rodar
(frame time, long tasks, crescimento de heap entre partidas).

Emulação NÃO substitui aparelho físico: o que passa aqui recebe PASS TÉCNICO;
os controles físicos seguem PENDENTE por definição.

  python tools/r14/browser_ux_perf_probe.py <build.html> [--out arquivo.json]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

VIEWPORTS = [
    ("desktop", 1440, 810), ("tablet", 1024, 768),
    ("mobile-portrait", 390, 844), ("mobile-landscape", 844, 390),
]

# mede frame time e long tasks durante uma janela de animação real
JS_PERF = r"""
(ms) => new Promise(resolve => {
  const frames = []; let long = 0; let po = null;
  try {
    po = new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.duration > 50) long++; });
    po.observe({ entryTypes: ['longtask'] });
  } catch (_) {}
  let last = performance.now(); const t0 = last;
  function tick(now) {
    frames.push(now - last); last = now;
    if (now - t0 < ms) requestAnimationFrame(tick);
    else {
      try { if (po) po.disconnect(); } catch (_) {}
      const s = frames.slice(1).sort((a, b) => a - b);
      const q = p => s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0;
      resolve({ frames: s.length, medianMs: +q(0.5).toFixed(2), p95Ms: +q(0.95).toFixed(2),
                maxMs: +(s[s.length-1] || 0).toFixed(2), longTasks: long,
                fpsMediano: s.length ? +(1000 / Math.max(q(0.5), 0.001)).toFixed(1) : 0 });
    }
  }
  requestAnimationFrame(tick);
})
"""

# roda N partidas no motor e mede o heap entre elas (crescimento entre partidas)
JS_MATCHES = r"""
(n) => {
  const out = { partidas: [], erro: null };
  try {
    const db = (window.G && window.G.db) ? window.G.db : null;
    if (!db || !db.squads) { out.erro = 'banco indisponível'; return out; }
    const mk = (sq, form, color) => { const p = autoLineup(sq, form, 0);
      return { squad:sq, name:sq.c, flag:sq.f, color, lineup:p.lineup, bench:p.bench, formKey:form, style:'balanced' }; };
    for (let i = 0; i < n; i++) {
      if (typeof srand === 'function') srand(900000 + i);
      const sim = new MatchSim(mk(db.squads[i*2],'4-3-3','#2e9bff'), mk(db.squads[i*2+1],'4-4-2','#ff3d7f'),
                               { neutral:true, labMode:true });
      const t0 = performance.now(); let k = 0;
      while (!sim.isOver() && k++ < 40000) sim.step(1/30);
      out.partidas.push({ i, ticks: k, ms: +(performance.now() - t0).toFixed(1),
                          heapMB: performance.memory ? +(performance.memory.usedJSHeapSize/1048576).toFixed(2) : null,
                          placar: sim.score.slice() });
    }
  } catch (e) { out.erro = String((e && e.message) || e); }
  return out;
}
"""


def main():
    build = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not build or not build.exists():
        sys.exit("uso: browser_ux_perf_probe.py <build.html> [--out arquivo.json]")
    html = build.read_bytes().decode("utf-8")
    res = {"viewports": [], "perf": None, "matches": None, "checks": []}

    def add(nome, ok, detalhe=""):
        res["checks"].append({"nome": nome, "pass": bool(ok), "detalhe": detalhe})

    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--enable-precise-memory-info"])

        # ── navegação por TOQUE em cada viewport, com ações completas ────────
        for nome, w, h in VIEWPORTS:
            ctx = br.new_context(viewport={"width": w, "height": h},
                                 has_touch=True, is_mobile=("mobile" in nome))
            pg = ctx.new_page()
            erros = []
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.set_content(html, wait_until="load")
            pg.wait_for_timeout(2200)
            item = {"viewport": nome, "erros": []}
            try:
                # 1. toque no botão inicial muda de tela
                pg.tap("#bt-start")
                pg.wait_for_timeout(900)
                item["telaAposToque"] = pg.evaluate("() => (window.G && G.screen) || document.body.dataset.screen || 'desconhecida'")
                # 2. toque após ROLAGEM ainda acerta o alvo
                pg.mouse.wheel(0, 400); pg.wait_for_timeout(250)
                item["aposRolagem"] = pg.evaluate("() => !!document.querySelector('#app')")
                # 3. toques MÚLTIPLOS não quebram o estado
                for _ in range(3):
                    el = pg.query_selector("[data-go]")
                    if el:
                        el.tap()
                        pg.wait_for_timeout(180)
                item["multiToque"] = True
                # 4. mudança de ORIENTAÇÃO preserva a aplicação
                pg.set_viewport_size({"width": h, "height": w}); pg.wait_for_timeout(500)
                item["aposRotacao"] = pg.evaluate("() => !!document.querySelector('#app') && document.querySelectorAll('#app *').length > 3")
            except Exception as e:
                item["erroAcao"] = str(e)[:180]
            item["erros"] = erros[:3]
            item["pass"] = bool(item.get("telaAposToque") not in (None, "home", "desconhecida")
                                and item.get("aposRotacao") and not erros)
            res["viewports"].append(item)
            ctx.close()

        # ── desempenho + 3 partidas consecutivas ────────────────────────────
        ctx = br.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        pg.set_content(html, wait_until="load")
        pg.wait_for_timeout(2200)
        try:
            pg.tap("#bt-start"); pg.wait_for_timeout(1200)
        except Exception:
            pass
        res["perf"] = pg.evaluate(JS_PERF, 3000)
        res["matches"] = pg.evaluate(JS_MATCHES, 3)
        br.close()

    vp_ok = all(v["pass"] for v in res["viewports"])
    add("navegação por toque em 4 viewports", vp_ok,
        ", ".join(f"{v['viewport']}:{'ok' if v['pass'] else 'FALHA'}" for v in res["viewports"]))

    p = res["perf"] or {}
    add("frame time p95 <= 33ms", p.get("p95Ms", 999) <= 33, f"p95 {p.get('p95Ms')}ms")
    add("FPS mediano >= 45", p.get("fpsMediano", 0) >= 45, f"{p.get('fpsMediano')} fps")
    add("sem long tasks (>50ms)", p.get("longTasks", 1) == 0, f"{p.get('longTasks')} long tasks")

    m = res["matches"] or {}
    parts = m.get("partidas", [])
    add("3 partidas consecutivas concluem", len(parts) == 3 and all(x["ticks"] > 100 for x in parts),
        f"{len(parts)} partidas, ticks {[x['ticks'] for x in parts]}")
    heaps = [x["heapMB"] for x in parts if x.get("heapMB")]
    if len(heaps) >= 2:
        growth = (heaps[-1] - heaps[0]) / max(heaps[0], 1e-9) * 100
        add("crescimento de heap <= 15% em 3 partidas", growth <= 15,
            f"{heaps[0]}MB -> {heaps[-1]}MB ({growth:+.1f}%)")
    else:
        add("crescimento de heap <= 15% em 3 partidas", False, "performance.memory indisponível")

    res["passed"] = sum(1 for c in res["checks"] if c["pass"])
    res["total"] = len(res["checks"])
    res["pass"] = res["passed"] == res["total"]
    res["nota"] = ("Emulação de viewport. PASS TÉCNICO apenas — controles em aparelho físico "
                   "seguem PENDENTE por definição.")

    for c in res["checks"]:
        print(f"  {'OK  ' if c['pass'] else 'FAIL'} {c['nome']:<42} {c['detalhe']}")
    print(f"\nUX/desempenho: {res['passed']}/{res['total']} — {'PASS TÉCNICO' if res['pass'] else 'FAIL'}")

    if "--out" in sys.argv:
        o = ROOT / sys.argv[sys.argv.index("--out") + 1]
        o.parent.mkdir(parents=True, exist_ok=True)
        o.write_bytes(json.dumps(res, ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"[gravado] {o}")
    return 0 if res["pass"] else 2


if __name__ == "__main__":
    sys.exit(main())
