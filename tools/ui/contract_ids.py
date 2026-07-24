#!/usr/bin/env python3
"""
Portao do contrato de integracao UI: os 11 nos que o motor escreve continuam
existindo depois da casca? (reports/ui/01-AUDITORIA-UI-ATUAL.md §3)

A casca do redesign nao pode mover nem renomear nenhum destes `id`s/seletores,
senao as funcoes de paint escrevem no vazio e a UI para de atualizar sem erro.
Tambem tira um screenshot 1920 e um 1366 para regressao visual.

  python tools/ui/contract_ids.py "dist/COPA DOS SONHOS - R17.2.html"
"""
import json
import sys
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
    G.formKey = '4-3-3'; G.style = 'balanced';
    G.cup = CUP.createCup(G.db, 'ME');
    window.GAME.open._ready = true; window.GAME.open();
    G.speed = 2.0;
    return { ok: true };
  } catch (e) { return { ok: false, erro: String((e && e.message) || e) }; }
}
"""

# id -> funcao de paint que escreve nele (so para o relatorio)
CONTRACT = {
    "fieldcv": "paintField", "score": "updateScore", "clock": "updateClock",
    "narr": "updateNarr", "momcv": "paintMom", "tline": "paintTimeline",
    "pbA": "updateStatsBar", "pbB": "updateStatsBar", "pA": "updateStatsBar",
    "pB": "updateStatsBar", "sA": "updateStatsBar", "sB": "updateStatsBar",
    "oA": "updateStatsBar", "oB": "updateStatsBar", "cA": "updateStatsBar",
    "cB": "updateStatsBar", "tbody": "paintTabBody", "statsb": "updateStatsBar",
}

PROBE = "() => { const r={}; for (const id of %s) r[id] = !!document.getElementById(id); return r; }" \
        % json.dumps(list(CONTRACT))


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit('uso: contract_ids.py "<build.html>"')
    build = args[0]
    out = args[args.index("--out") + 1] if "--out" in args else "reports/ui/contract-ids.json"
    rep = {"build": Path(build).name, "erros": []}
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        page = br.new_page(viewport={"width": 1920, "height": 950})
        page.on("pageerror", lambda e: rep["erros"].append(str(e)))
        page.goto((ROOT / build).as_uri())
        page.wait_for_timeout(1500)
        s = page.evaluate(SETUP)
        if not s.get("ok"):
            print("FALHA no setup:", s.get("erro")); br.close(); return 1
        page.wait_for_timeout(1500)
        present = page.evaluate(PROBE)
        rep["nos"] = present
        rep["faltando"] = [k for k, v in present.items() if not v]
        page.screenshot(path=str(ROOT / "reports/ui/shell-1920.png"))
        page.set_viewport_size({"width": 1366, "height": 768})
        page.wait_for_timeout(400)
        page.screenshot(path=str(ROOT / "reports/ui/shell-1366.png"))
        # mede letterbox do canvas
        rep["canvas"] = page.evaluate("""() => {
          const cv = document.querySelector('#fieldcv');
          const w = document.querySelector('.field-wrap');
          if (!cv || !w) return null;
          const cr = cv.getBoundingClientRect(), wr = w.getBoundingClientRect();
          const drawnW = cr.height * (cv.width / cv.height);   // largura desenhada (contain)
          return { wrapW: Math.round(wr.width), wrapH: Math.round(wr.height),
                   cssH: Math.round(cr.height), drawnW: Math.round(drawnW),
                   letterbox: Math.round(cr.width - drawnW) };
        }""")
        br.close()
    rep["veredito"] = "CONTRATO OK" if not rep["faltando"] and not rep["erros"] else "FALHA"
    (ROOT / out).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / out).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"build: {rep['build']}")
    print(f"nos do contrato presentes: {sum(rep['nos'].values())}/{len(CONTRACT)}")
    if rep["faltando"]:
        print("  FALTANDO:", ", ".join(rep["faltando"]))
    c = rep.get("canvas") or {}
    if c:
        print(f"campo (1366): wrap {c['wrapW']}x{c['wrapH']}  canvas alt {c['cssH']}  "
              f"desenhado {c['drawnW']}px  letterbox {c['letterbox']}px")
    print(f"erros de pagina: {len(rep['erros'])}")
    print(rep["veredito"])
    return 0 if rep["veredito"] == "CONTRATO OK" else 1


if __name__ == "__main__":
    raise SystemExit(main())
