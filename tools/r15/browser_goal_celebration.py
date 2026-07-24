#!/usr/bin/env python3
"""
Reproduz o bug "após o primeiro gol o jogo fica na opacidade do replay".

Abre uma partida em navegador real, força velocidade TURBO, espera o primeiro
gol e amostra o ciclo de vida da comemoração: se `celebration` volta a ser null
(véu sai) ou fica preso, e quais são os valores de `until`, `now`, `replay` no
momento em que travar.

  python tools/r15/browser_goal_celebration.py <build.html> [--out arquivo.json]
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
    G.formKey = '4-3-3'; G.style = 'balanced';
    G.cup = CUP.createCup(G.db, 'ME');
    window.GAME.open._ready = true;
    window.GAME.open();
    G.speed = 6.0;   // TURBO
    return { ok: true };
  } catch (e) { return { ok: false, erro: String((e && e.message) || e) }; }
}
"""

# Lê o estado de comemoração de dentro do closure de render. Os símbolos são
# locais do IIFE, então expomos via um probe que o próprio jogo não oferece:
# procuramos por um gol na barra de placar e medimos se a tela fica velada.
PROBE = r"""
() => {
  // O véu é um fillRect rgba(4,8,18,.72) desenhado sobre o canvas quando há
  // comemoração. Medimos a luminância média do canvas do campo: velado = escuro.
  const cv = document.querySelector('#fieldcv');
  if (!cv) return { err: 'sem canvas' };
  const g = cv.getContext('2d');
  let sum = 0, n = 0;
  try {
    const w = cv.width, h = cv.height;
    const d = g.getImageData(0, Math.floor(h*0.15), w, Math.floor(h*0.2)).data;
    for (let i = 0; i < d.length; i += 40) { sum += d[i] + d[i+1] + d[i+2]; n += 3; }
  } catch (e) { return { err: String(e.message) }; }
  const lum = n ? sum / n : 0;
  const score = (window.G && G.match && G.match.score) ? G.match.score.slice()
              : (document.querySelector('.mh-sc') ? document.querySelector('.mh-sc').textContent : '?');
  return { lum: +lum.toFixed(1), score: JSON.stringify(score),
           clock: (document.querySelector('.mh-clock')||{}).textContent || '' };
}
"""


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit("uso: browser_goal_celebration.py <build.html> [--out f]")
    build = Path(args[0])
    if not build.is_absolute():
        build = ROOT / build
    if not build.exists():
        sys.exit(f"ERRO: build não encontrada: {build}")
    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d
    out_rel = opt("--out", "reports/r15/goal-celebration.json")

    report = {"build": build.name, "samples": []}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1024, "height": 640})
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(build.as_uri(), wait_until="load")
        page.wait_for_timeout(1200)
        s = page.evaluate(SETUP)
        report["setup"] = s
        if not s.get("ok"):
            report["erro"] = s.get("erro")
            (ROOT / out_rel).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
            print("FALHA no setup:", s.get("erro"))
            browser.close(); return 1

        # Amostra a cada 500 ms por até 90 s de tempo real (TURBO cobre o 1º tempo).
        goal_seen_at = None
        dark_run = 0
        stuck = False
        import time
        for k in range(180):
            m = page.evaluate(PROBE)
            m["t_s"] = round(k * 0.5, 1)
            report["samples"].append(m)
            lum = m.get("lum", 999)
            # Detecta gol pela mudança de placar; véu = luminância baixa sustentada.
            if lum < 60:          # tela velada
                dark_run += 1
            else:
                dark_run = 0
            if goal_seen_at is None and m.get("score") not in ('[0,0]', '"0 - 0"', '?', None):
                if any(ch.isdigit() and ch != '0' for ch in str(m.get("score"))):
                    goal_seen_at = m["t_s"]
            # Véu escuro por mais de 12 s seguidos (24 amostras) = preso.
            if dark_run >= 24:
                stuck = True
                report["stuck_at_s"] = m["t_s"]
                report["stuck_sample"] = m
                break
            page.wait_for_timeout(500)

        report["goal_first_seen_s"] = goal_seen_at
        report["veil_stuck"] = stuck
        report["page_errors"] = errs[:10]
        page.screenshot(path=str(ROOT / "reports/r15/goal-celebration.png"))
        browser.close()

    (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / out_rel).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"gol visto em: {report.get('goal_first_seen_s')} s")
    print(f"véu preso: {report['veil_stuck']}" + (f" a partir de {report.get('stuck_at_s')} s" if stuck else ""))
    lums = [s.get("lum") for s in report["samples"] if isinstance(s.get("lum"), (int, float))]
    if lums:
        print(f"luminância: min {min(lums)} · máx {max(lums)}")
    if report["page_errors"]:
        print("erros de página:", report["page_errors"][:3])
    print(f"artefato: {out_rel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
