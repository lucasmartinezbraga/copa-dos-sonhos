#!/usr/bin/env python3
"""
"Depois do primeiro gol a tela fica tingida" — mede, com linha de base própria.

POR QUE ESTA FERRAMENTA EXISTE, se já há `browser_goal_celebration.py`:
aquela usa limiar absoluto `lum < 60` enquanto a própria linha de base do jogo
é ~58,7. Ou seja, ela acusa "velado" desde o primeiro quadro, antes de qualquer
gol — e de fato reportou `veil_stuck=true` com `goal_first_seen_s=null` e placar
0–0. É um detector que não sabe reprovar nem aprovar.

Aqui a linha de base é medida ANTES do gol, no mesmo pixel, e a pergunta é
relativa: depois do gol, a cor do gramado VOLTA ao que era?

Amostra o CENTRO do campo (onde o véu de tela cheia aparece), não a faixa
superior (arquibancada/horizonte, que quase não muda).

  python tools/r15/browser_goal_tint.py "dist/COPA DOS SONHOS - R17.1.html"
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
    window.GAME.open._ready = true;
    window.GAME.open();
    G.speed = __SPEED__;
    return { ok: true, speed: G.speed };
  } catch (e) { return { ok: false, erro: String((e && e.message) || e) }; }
}
"""

# Cor média do MIOLO do campo + placar. O véu de gol é fillRect de tela cheia,
# então o centro é onde ele mais aparece.
PROBE = r"""
() => {
  const cv = document.querySelector('#fieldcv');
  if (!cv) return { err: 'sem canvas' };
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  let r = 0, gg = 0, b = 0, n = 0;
  try {
    const d = g.getImageData(Math.floor(w*0.30), Math.floor(h*0.45),
                             Math.floor(w*0.40), Math.floor(h*0.35)).data;
    for (let i = 0; i < d.length; i += 32) { r += d[i]; gg += d[i+1]; b += d[i+2]; n++; }
  } catch (e) { return { err: String(e.message) }; }
  const el = document.querySelector('#score');
  return { r: +(r/n).toFixed(1), g: +(gg/n).toFixed(1), b: +(b/n).toFixed(1),
           score: el ? el.textContent.trim() : '?' };
}
"""


def dist(a, b):
    return max(abs(a["r"] - b["r"]), abs(a["g"] - b["g"]), abs(a["b"] - b["b"]))


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit('uso: browser_goal_tint.py "<build.html>" [--out f]')
    build = args[0]
    out_rel = args[args.index("--out") + 1] if "--out" in args else "reports/r15/goal-tint.json"
    # A velocidade IMPORTA: em TURBO a comemoração/replay é atropelada, em 2X ela
    # roda inteira. O relato do usuário é em 2X.
    speed = args[args.index("--speed") + 1] if "--speed" in args else "6.0"
    rep = {"build": Path(build).name, "speed": float(speed), "amostras": [], "erros": []}
    setup_js = SETUP.replace("__SPEED__", speed)

    with sync_playwright() as pw:
        br = pw.chromium.launch()
        page = br.new_page(viewport={"width": 1440, "height": 810})
        page.on("pageerror", lambda e: rep["erros"].append(str(e)))
        page.goto((ROOT / build).as_uri())
        page.wait_for_timeout(1500)
        s = page.evaluate(setup_js)
        rep["setup"] = s
        if not s.get("ok"):
            print("FALHA no setup:", s.get("erro")); br.close(); return 1
        page.wait_for_timeout(1500)

        base, gol_t, gol_score = [], None, None
        for k in range(600):                      # até 150 s reais
            m = page.evaluate(PROBE)
            if m.get("err"):
                rep["erros"].append(m["err"]); break
            t = round(k * 0.25, 2)
            m["t_s"] = t
            rep["amostras"].append(m)

            if gol_t is None:
                sc = m["score"].replace("–", "-").replace(" ", "")
                if sc not in ("0-0", "?", ""):
                    gol_t, gol_score = t, m["score"]
                    rep["gol_em_s"], rep["gol_placar"] = t, m["score"]
                    page.screenshot(path=str(ROOT / "reports/r15/tint-no-gol.png"))
                elif t > 3:
                    base.append(m)                # linha de base: antes do gol
            elif t - gol_t > 40:
                break
            page.wait_for_timeout(250)

        if gol_t is None:
            rep["veredito"] = "NENHUM GOL — inconclusivo"
        elif not base:
            rep["veredito"] = "SEM LINHA DE BASE — inconclusivo"
        else:
            mid = len(base) // 2
            bl = {c: sorted(x[c] for x in base)[mid] for c in "rgb"}
            rep["linha_de_base"] = bl
            depois = [x for x in rep["amostras"] if x["t_s"] > gol_t]
            marcos = {}
            for lbl, dt in (("+3s", 3), ("+6s", 6), ("+12s", 12), ("+20s", 20)):
                c = [x for x in depois if x["t_s"] - gol_t >= dt]
                if c:
                    marcos[lbl] = {**{k: c[0][k] for k in "rgb"},
                                   "desvio": round(dist(c[0], bl), 1)}
            rep["marcos"] = marcos
            page.screenshot(path=str(ROOT / "reports/r15/tint-depois.png"))
            fim = marcos.get("+20s") or marcos.get("+12s") or {}
            rep["desvio_final"] = fim.get("desvio")
            rep["veredito"] = ("TINGIMENTO PRESO" if (fim.get("desvio", 0) > 6)
                               else "COR VOLTA AO NORMAL")
        br.close()

    (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / out_rel).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"build: {rep['build']}")
    print(f"gol em: {rep.get('gol_em_s')} s  placar {rep.get('gol_placar')}")
    if rep.get("linha_de_base"):
        bl = rep["linha_de_base"]
        print(f"linha de base (antes do gol): R{bl['r']} G{bl['g']} B{bl['b']}")
        for lbl, v in (rep.get("marcos") or {}).items():
            print(f"  {lbl:>5}: R{v['r']} G{v['g']} B{v['b']}   desvio {v['desvio']}")
    print(f"erros de pagina: {len(rep['erros'])}")
    print(rep.get("veredito"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
