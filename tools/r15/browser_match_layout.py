#!/usr/bin/env python3
"""
Sonda de LAYOUT da tela de partida em navegador real.

Destrava o bloqueio registrado no handoff §6 ("falta achar o controle que inicia
a partida"): a entrada é `window.GAME.open()`, chamada por `go('match')` em
10-base-bundle.js:7324. Com `GAME.open._ready = true` pula-se a tela de táticas
e cai-se direto na partida.

Mede a geometria real de cada bloco e responde à pergunta que o olho já
respondeu: o campo cabe inteiro na janela?

  python tools/r15/browser_match_layout.py <build.html> [--out arquivo.json]
      [--shot prefixo] [--viewport 1440x810]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

SETUP = r"""
() => {
  try {
    const sq = G.db.squads[0];
    const lu = autoLineup(sq, '4-3-3', 0);
    const picks = lu.lineup.map(s => ({ p: s.p, from: sq.c }));
    const me = CUP.registerPlayerTeam(G.db, picks, (lu.bench || []).map(p => ({ p, from: sq.c })));
    G.lineup = lu.lineup.map((s, i) => ({ p: me.pl[i], x: s.x, y: s.y, pos: s.pos, from: sq.c }));
    G.bench = me.pl.slice(11);
    G.formKey = '4-3-3';
    G.style = 'balanced';
    G.cup = CUP.createCup(G.db, 'ME');
    window.GAME.open._ready = true;
    window.GAME.open();
    return { ok: true, screen: G.screen };
  } catch (e) { return { ok: false, erro: String((e && e.message) || e) }; }
}
"""

MEASURE = r"""
() => {
  const box = sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      display: cs.display, position: cs.position,
      aspectRatio: cs.aspectRatio, maxHeight: cs.maxHeight,
      objectFit: cs.objectFit, overflow: cs.overflow
    };
  };
  const vh = window.innerHeight, vw = window.innerWidth;
  const wrap = box('.field-wrap'), cv = box('#fieldcv');
  let insideWrap = null, cropped = null;
  if (wrap && cv) {
    const shown = Math.max(0, Math.min(wrap.bottom, cv.bottom) - Math.max(wrap.top, cv.top));
    insideWrap = cv.h ? +(shown / cv.h).toFixed(4) : null;
    cropped = +(cv.h - shown).toFixed(1);
  }
  let inViewport = null;
  if (cv) {
    const shown = Math.max(0, Math.min(vh, cv.bottom) - Math.max(0, cv.top));
    inViewport = cv.h ? +(shown / cv.h).toFixed(4) : null;
  }
  return {
    viewport: { w: vw, h: vh },
    scrollY: window.scrollY,
    docHeight: document.documentElement.scrollHeight,
    pageScrolls: document.documentElement.scrollHeight > vh + 2,
    blocks: {
      mh: box('.mh'), fieldWrap: wrap, fieldcv: cv,
      narr: box('.narr'), mtabs: box('.mtabs'), statsb: box('.statsb')
    },
    canvasInsideWrapShare: insideWrap,
    canvasCroppedPx: cropped,
    canvasInViewportShare: inViewport
  };
}
"""


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit("uso: browser_match_layout.py <build.html> [--out f] [--shot pref] [--viewport WxH]")
    build = Path(args[0])
    if not build.is_absolute():
        build = ROOT / build
    if not build.exists():
        sys.exit(f"ERRO: build não encontrada: {build}")

    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d

    out_rel = opt("--out", "reports/r15/layout-partida.json")
    shot = opt("--shot")
    vp = opt("--viewport", "1440x810")
    vw, vh = (int(x) for x in vp.lower().split("x"))

    report = {"build": build.name, "viewport": vp}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": vw, "height": vh})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(build.as_uri(), wait_until="load")
        page.wait_for_timeout(1500)

        setup = page.evaluate(SETUP)
        report["setup"] = setup
        if not setup.get("ok"):
            report["measure"] = None
            report["page_errors"] = errors[:10]
            (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
            (ROOT / out_rel).write_text(json.dumps(report, indent=1, ensure_ascii=False),
                                        encoding="utf-8")
            print("FALHA ao entrar na partida:", setup.get("erro"))
            browser.close()
            return 1

        page.wait_for_timeout(2500)
        report["measure"] = page.evaluate(MEASURE)
        report["page_errors"] = errors[:10]

        if shot:
            sp = ROOT / f"{shot}-{vp}.png"
            sp.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(sp))
            report["screenshot"] = str(sp.relative_to(ROOT)).replace("\\", "/")
        browser.close()

    (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / out_rel).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")

    m = report["measure"]
    b = m["blocks"]
    print(f"viewport {m['viewport']['w']}x{m['viewport']['h']} · doc {m['docHeight']}px "
          f"· rola={m['pageScrolls']} · scrollY={m['scrollY']}")
    for k in ("mh", "fieldWrap", "fieldcv", "narr", "mtabs", "statsb"):
        v = b.get(k)
        print(f"  {k:<10} " + ("ausente" if not v else
              f"top={v['top']:>8} bottom={v['bottom']:>8} h={v['h']:>7} "
              f"ar={v['aspectRatio']} maxH={v['maxHeight']} fit={v['objectFit']}"))
    print(f"\ncanvas dentro do wrap    : {m['canvasInsideWrapShare']}")
    print(f"canvas recortado (px)    : {m['canvasCroppedPx']}")
    print(f"canvas dentro da janela  : {m['canvasInViewportShare']}")
    if report["page_errors"]:
        print("\nerros de página:", report["page_errors"][:3])
    print(f"\nartefato: {out_rel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
