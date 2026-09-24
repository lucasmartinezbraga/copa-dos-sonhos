#!/usr/bin/env python3
"""
Prova, NO NAVEGADOR, que a ponte de animação produz estados durante uma partida.

O smoke de navegador só chega à tela de preparação: ele mostra que a página
carrega, não que a máquina de estados roda. Aqui a partida é instanciada no
contexto da página e avançada tick a tick; depois se lê quantos atletas
receberam estado, quantos estados distintos apareceram e se as fases da ação
(preparação/contato/continuidade/recuperação) foram efetivamente visitadas.

  python tools/r14/browser_anim_probe.py <build.html> [--out reports/r14/anim/browser.json]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

JS = r"""
() => {
  const out = { ok:false, erro:null, bridge:false, atletas:0, estados:{}, fases:{}, amostra:[] };
  try {
    if (typeof MatchSim !== 'function') { out.erro = 'MatchSim ausente'; return out; }
    if (!window.CDS_ANIM) { out.erro = 'CDS_ANIM ausente'; return out; }
    out.bridge = !!MatchSim.prototype.__CDS_ANIM_BRIDGE__;
    if (!out.bridge) { out.erro = 'ponte não instalada'; return out; }

    // usa o banco JÁ construído pela página (G.db); reconstruí-lo aqui produzia
    // elencos malformados e quebrava autoLineup
    const db = (window.G && window.G.db) ? window.G.db
             : ((typeof buildDB === 'function') ? buildDB(window.CDSDataV3 || {}) : null);
    if (!db || !db.squads || !db.squads.length) { out.erro = 'banco indisponível'; return out; }
    if (typeof srand === 'function') srand(870000);
    const mk = (sq, form, color) => {
      const p = autoLineup(sq, form, 0);
      return { squad:sq, name:sq.c, flag:sq.f, color, lineup:p.lineup, bench:p.bench, formKey:form, style:'balanced' };
    };
    const a = db.squads[0], b = db.squads[1];
    const sim = new MatchSim(mk(a,'4-3-3','#2e9bff'), mk(b,'4-4-2','#ff3d7f'), { neutral:true, labMode:true });

    let n = 0;
    while (!sim.isOver() && n++ < 40000) {
      sim.step(1/30);
      const st = sim.__animState;
      if (st) {
        for (const id in st) {
          const s = st[id];
          out.estados[s.state] = (out.estados[s.state] || 0) + 1;
          if (s.segment) out.fases[s.segment] = (out.fases[s.segment] || 0) + 1;
          if (s.inAction && out.amostra.length < 6) {
            out.amostra.push({ atleta:id, state:s.state, phase:s.phase, segment:s.segment, actionId:s.actionId });
          }
        }
      }
    }
    out.atletas = sim.__animState ? Object.keys(sim.__animState).length : 0;
    out.ticks = n;
    out.ok = true;
  } catch (e) { out.erro = String((e && e.message) || e); }
  return out;
}
"""


def main():
    build = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not build or not build.exists():
        sys.exit("uso: browser_anim_probe.py <build.html> [--out arquivo.json]")
    html = build.read_bytes().decode("utf-8")

    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1440, "height": 810})
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.set_content(html, wait_until="load")
        pg.wait_for_timeout(2500)
        res = pg.evaluate(JS)
        br.close()

    res["pageErrors"] = erros[:5]
    estados = res.get("estados", {})
    fases = res.get("fases", {})
    exigidas = ["pass_prepare", "pass_contact", "pass_followthrough", "pass_recover"]
    res["fasesDaAcaoVisitadas"] = [f for f in exigidas if f in estados]
    res["pass"] = bool(
        res.get("ok") and res.get("bridge") and res.get("atletas", 0) >= 20
        and len(estados) >= 6 and len(res["fasesDaAcaoVisitadas"]) == 4 and not erros
    )

    print(f"ponte instalada : {res.get('bridge')}")
    print(f"erro            : {res.get('erro')}")
    print(f"atletas c/estado: {res.get('atletas')}  (ticks {res.get('ticks')})")
    print(f"estados distintos: {len(estados)}")
    top = sorted(estados.items(), key=lambda kv: -kv[1])[:12]
    for k, v in top:
        print(f"   {k:<22} {v}")
    print(f"fases da ação visitadas: {res['fasesDaAcaoVisitadas']}")
    if res.get("amostra"):
        print("amostra:", json.dumps(res["amostra"][:3], ensure_ascii=False))
    print(f"\nVEREDITO: {'PASS' if res['pass'] else 'FAIL'}")

    if "--out" in sys.argv:
        p = ROOT / sys.argv[sys.argv.index("--out") + 1]
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(json.dumps(res, ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"[gravado] {p}")
    return 0 if res["pass"] else 2


if __name__ == "__main__":
    sys.exit(main())
