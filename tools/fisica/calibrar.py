#!/usr/bin/env python3
"""Varre configuracoes da camada OS-200 contra a bateria e tabela o resultado.

Cada linha da saida e uma configuracao medida na MESMA populacao de partidas
(mesma semente base, mesmo incremento), entao as comparacoes sao pareadas.

Uso:
  python3 tools/fisica/calibrar.py --matches 24 --workers 8 \
      --grade '[{"erroBase":14},{"erroBase":16}]'
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Alvos: a bateria historica do R19.08 media 1,771 gol/partida com 36,8% de
# finalizacoes no alvo. Sao esses numeros que a nova fisica precisa preservar.
ALVO_GOLS = (1.55, 2.15)
ALVO_NO_ALVO = (0.32, 0.44)


def rodar(build: str, matches: int, workers: int, tune: dict) -> dict:
    cmd = ["node", "tools/fisica/bateria.js", f"--build={build}",
           f"--matches={matches}", f"--workers={workers}"]
    if tune:
        cmd.append("--tune=" + json.dumps(tune))
    cp = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=1800)
    if cp.returncode != 0:
        raise SystemExit(f"bateria falhou: {cp.stderr[-2000:]}")
    return json.loads(cp.stdout)


def linha(tune: dict, d: dict) -> dict:
    a, f = d["agregado"], d["fisica"]
    shots = a["shots"]["media"] or 1e-9
    ramos = f.get("ramos", {})
    chutes = ramos.get("chutes", 0) or 1e-9
    dentro = ramos.get("gols", 0) + ramos.get("defesas", 0)
    return {
        "tune": tune,
        "gols": a["goals"]["media"],
        "chutes": a["shots"]["media"],
        "noAlvo": round(a["onTarget"]["media"] / shots, 3),
        "porCimaDoTravessao": f.get("passaramPorCimaDoTravessao", 0),
        "quiques": f.get("quiquesPorPartida", 0),
        "ramoGol": round(ramos.get("gols", 0) / chutes, 3),
        "ramoDefesa": round(ramos.get("defesas", 0) / chutes, 3),
        "ramoFora": round(ramos.get("fora", 0) / chutes, 3),
        "ramoBloqueio": round(ramos.get("bloqueios", 0) / chutes, 3),
        "ramoTrave": round(ramos.get("traves", 0) / chutes, 3),
        "defesaSobreNoAlvo": round(ramos.get("defesas", 0) / max(dentro, 1e-9), 3),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", default="dist/index.html")
    ap.add_argument("--matches", type=int, default=24)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--grade", required=True, help="lista JSON de objetos de tune")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    grade = json.loads(args.grade)
    resultados = []
    for tune in grade:
        d = rodar(args.build, args.matches, args.workers, tune)
        r = linha(tune, d)
        resultados.append(r)
        ok = (ALVO_GOLS[0] <= r["gols"] <= ALVO_GOLS[1]
              and ALVO_NO_ALVO[0] <= r["noAlvo"] <= ALVO_NO_ALVO[1])
        print(f"{'OK ' if ok else '   '}{json.dumps(tune)}"
              f"  gols={r['gols']:.2f}  noAlvo={r['noAlvo']:.3f}"
              f"  gol|chute={r['ramoGol']:.3f}  def|noAlvo={r['defesaSobreNoAlvo']:.3f}"
              f"  fora={r['ramoFora']:.3f}  bloq={r['ramoBloqueio']:.3f}"
              f"  porCima={r['porCimaDoTravessao']}", flush=True)

    if args.out:
        Path(ROOT / args.out).write_text(
            json.dumps(resultados, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
