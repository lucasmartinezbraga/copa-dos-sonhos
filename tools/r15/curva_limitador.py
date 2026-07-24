#!/usr/bin/env python3
"""
Curva de troca do limitador angular (`r15-angular-rate-limit`).

PERGUNTA QUE ESTE ARQUIVO EXISTE PARA RESPONDER:
o veredito `AJUSTA_A_CURVA`, emitido duas vezes por `evaluate_r160.py`, é uma
instrução executável? Ou seja: existe alguma constante do termo de alívio em
baixa velocidade que satisfaça ao mesmo tempo o bloco A (fluidez) e o bloco B
(marcação) do critério pré-registrado?

Se não existir, insistir em ajustar a curva é gastar rodada de matriz num
espaço vazio — o mesmo erro das cinco calibrações de marcação que já falharam.

O termo sob variação é o `bonus` em:

    _max = turn * (14/(1.2+v) + bonus/(1+v*v)) * dt

    R16.0  bonus = 0   (sem termo de alívio)
    R16.2  bonus = 6
    R16.1  bonus = 10

`bonus` maior = mais liberdade de giro em baixa velocidade = mais parecido com
o controle, que não tem limitador nenhum.

IMPORTANTE — BASELINE CORRIGIDA. O critério pré-registrado ancorou o bloco B em
números que atribuiu à R15.9 mas que são, verbatim, os da R15.4
(`real-r154.json`: markerMeanDistance 8,8716 · threatCoverage 0,5430 ·
marking 1/294). O controle real da R16.x é a R15.8/R15.9 (`real-r158.json`:
8,4752 · 0,5591 · 3/294) — R15.9 difere da R15.8 só em CSS, sem uma linha de
motor. Este script mede contra o controle REAL e deixa as duas leituras à
vista; não reescreve o critério original.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Tolerâncias do critério pré-registrado, aplicadas ao controle REAL.
TOL_MARKER = 0.03     # "markerMeanDistance <= controle + 0,03"
TOL_COVER = 0.013     # "threatCoverage >= controle - 0,013"
LIM_HARSH = 0.004     # bloco A: fracao_giros_bruscos_25g

PONTOS = [
    # rótulo, bonus, matriz, jitter
    ("R15.9 (controle)", None, "reports/r15/real-r158.json", "reports/r15/jitter-overlap.json"),
    ("R16.0", 0.0, "reports/r15/real-r160.json", "reports/r15/jitter-r160.json"),
    ("R16.2", 6.0, "reports/r15/real-r162.json", "reports/r15/jitter-r162.json"),
    ("R16.1", 10.0, "reports/r15/real-r161.json", "reports/r15/jitter-r161.json"),
]


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def rate(doc, key, guard):
    v = [o["rates"][key] for r in doc["results"]
         if (o := r.get("observedFootball") or {}) and (o.get("metrics") or {}).get(guard)]
    return sum(v) / len(v) if v else None


def gate(doc, name):
    return sum(1 for r in doc["results"]
               if ((r.get("observedFootball") or {}).get("gates") or {}).get(name))


def main():
    linhas = []
    for rot, bonus, mp, jp in PONTOS:
        if not (ROOT / mp).exists():
            print(f"[ausente] {rot}: {mp} — rode a matriz antes")
            continue
        m, j = load(mp), load(jp)
        linhas.append({
            "rotulo": rot, "bonus": bonus, "sha": m.get("sha256", "")[:12],
            "n": len(m["results"]),
            "harsh": j["fracao_giros_bruscos_25g"],
            "harsh_bola": j["fracao_giros_bruscos_perto_da_bola"],
            "giro_medio": j["giroMedio_graus_por_quadro"],
            "marker": rate(m, "markerMeanDistance", "markerSamples"),
            "cover": rate(m, "threatCoverage", "dangerousThreats"),
            "overload_cov": rate(m, "spatialOverloadCoverage", "spatialOverloadSamples"),
            "g_marking": gate(m, "marking"),
            "g_overload": gate(m, "spatialOverload"),
            "g_lines": gate(m, "lines"),
            "gols": m["summary"]["perMatch"]["goals"],
        })

    ctl = next(x for x in linhas if x["bonus"] is None)
    alvo_marker = ctl["marker"] + TOL_MARKER
    alvo_cover = ctl["cover"] - TOL_COVER

    print("=" * 104)
    print("CURVA DE TROCA DO LIMITADOR ANGULAR — controle REAL = R15.8/R15.9")
    print("=" * 104)
    print(f"{'build':<18}{'bonus':>7}{'sha':>14}{'bruscos':>10}{'marcador':>11}"
          f"{'penal.':>9}{'cobert.':>9}{'marking':>9}{'overload':>10}{'gols':>8}")
    print("-" * 104)
    for x in sorted(linhas, key=lambda y: (y["bonus"] is not None, y["bonus"] or 0)):
        b = "—" if x["bonus"] is None else f"{x['bonus']:.0f}"
        pen = x["marker"] - ctl["marker"]
        print(f"{x['rotulo']:<18}{b:>7}{x['sha']:>14}{x['harsh']:>10.4f}"
              f"{x['marker']:>11.4f}{pen:>+9.4f}{x['cover']:>9.4f}"
              f"{str(x['g_marking'])+'/294':>9}{str(x['g_overload'])+'/294':>10}{x['gols']:>8.3f}")
    print("-" * 104)
    print(f"alvo bloco A: bruscos <= {LIM_HARSH}")
    print(f"alvo bloco B (controle real): marcador <= {alvo_marker:.4f} · "
          f"cobertura >= {alvo_cover:.4f} · marking >= {ctl['g_marking']}/294")

    # ── extrapolação sobre o knob ─────────────────────────────────────────────
    pts = [x for x in linhas if x["bonus"] is not None]
    pts.sort(key=lambda y: y["bonus"])
    if len(pts) < 2:
        print("\nPontos insuficientes para extrapolar.")
        return 0

    def interp_bonus(campo, alvo):
        """bonus em que `campo` cruza `alvo`, por interpolação/extrapolação linear
        entre os dois pontos medidos mais próximos do alvo."""
        seq = [(p["bonus"], p[campo]) for p in pts]
        for (b0, v0), (b1, v1) in zip(seq, seq[1:]):
            if (v0 - alvo) * (v1 - alvo) <= 0 and v1 != v0:
                return b0 + (alvo - v0) * (b1 - b0) / (v1 - v0)
        (b0, v0), (b1, v1) = seq[-2], seq[-1]
        if v1 == v0:
            return None
        return b0 + (alvo - v0) * (b1 - b0) / (v1 - v0)

    b_harsh = interp_bonus("harsh", LIM_HARSH)      # onde A começa a REPROVAR
    b_marker = interp_bonus("marker", alvo_marker)  # onde B começa a APROVAR

    print("\n" + "=" * 104)
    print("EXTRAPOLAÇÃO NO KNOB `bonus`")
    print("=" * 104)
    print(f"  bloco A reprova a partir de bonus ≈ {b_harsh:.1f}"
          if b_harsh else "  bloco A: sem cruzamento")
    print(f"  bloco B só aprova a partir de bonus ≈ {b_marker:.1f}"
          if b_marker else "  bloco B: sem cruzamento")

    if b_harsh and b_marker:
        if b_marker <= b_harsh:
            print(f"\n  JANELA EXISTE: bonus em [{b_marker:.1f}, {b_harsh:.1f}] satisfaz A e B.")
            print("  AJUSTA_A_CURVA é executável — vale mais uma rodada de matriz.")
        else:
            print(f"\n  NÃO HÁ JANELA. B exigiria bonus ≈ {b_marker:.1f}, "
                  f"que é {b_marker/b_harsh:.1f}x o valor em que A já reprova ({b_harsh:.1f}).")
            print("  `AJUSTA_A_CURVA` NÃO é executável neste knob: o critério")
            print("  pré-registrado, ancorado no controle real, é insatisfazível")
            print("  por calibração. A marcação deste motor é REATIVA — depende da")
            print("  taxa de reorientação que o limitador corta por construção.")
            print("  Sair do impasse exige marcação ANTECIPATÓRIA (§18 Contrato de")
            print("  Função), não uma sexta constante.")

    out = {
        "controle": {"rotulo": ctl["rotulo"], "sha": ctl["sha"],
                     "marker": ctl["marker"], "cover": ctl["cover"],
                     "marking": ctl["g_marking"], "harsh": ctl["harsh"]},
        "alvos": {"harsh_max": LIM_HARSH, "marker_max": alvo_marker,
                  "cover_min": alvo_cover, "marking_min": ctl["g_marking"]},
        "pontos": linhas,
        "bonus_onde_A_reprova": b_harsh,
        "bonus_onde_B_aprova": b_marker,
        "janela_existe": bool(b_harsh and b_marker and b_marker <= b_harsh),
    }
    dest = ROOT / "reports/r15/curva-limitador.json"
    dest.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\nartefato: reports/r15/curva-limitador.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
