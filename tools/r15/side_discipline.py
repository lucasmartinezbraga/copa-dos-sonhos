#!/usr/bin/env python3
"""
§26/§53 — DISCIPLINA DE LADO, medida contra a posição-base de cada jogador.

Corrige um falso positivo de medição da coletânea. O coletor marcava invasão
lateral assim (script/gerar_coletanea_r15_expandida.py:141-142):

    se slot ∈ {LB,LWB,LM,LW} e y > 0.63  → invasão
    se slot ∈ {RB,RWB,RM,RW} e y < 0.37  → invasão

Regra de `y` ABSOLUTO, aplicada igual aos dois times. Mas os lados são
espelhados por equipe, porque cada uma ataca para um lado — medido no estado
bruto (match_03, quadro 0):

    slot   time 0 (hy)   time 1 (hy)
    LB        0.110         0.785
    RB        0.890         0.215

O lateral-esquerdo do time 1 fica em y≈0.785 NA PRÓPRIA POSIÇÃO-BASE e era
marcado como invasor. Resultado: `persistent_wrong_side` satura em 1.000 em
119 dos 120 lances — não porque o motor erre, mas porque a régua está invertida
para metade do campo.

A medida correta usa o `hy` do próprio jogador, que já está nos dados: o jogador
está no seu lado quando `y` e `hy` caem do mesmo lado da linha média.

Saída: reports/r15/estrutura-tatica.json — artefato do gate `side_discipline`.

Uso:
    python tools/r15/side_discipline.py [--coletanea <dir>] [--out ...]
"""
import glob, gzip, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

WIDE_SLOTS = {"LB", "LWB", "LM", "LW", "RB", "RWB", "RM", "RW"}
MID = 0.5
# Faixa morta em torno do meio: um ala que passa de 0,5 por 3 cm não "trocou de
# lado". 0,08 normalizado ≈ 5,4 m num campo de 68 m.
DEAD = 0.08


def analyse(base):
    files = sorted(glob.glob(str(base / "dados" / "match_*.json.gz")))
    if not files:
        sys.exit(f"ERRO: nenhum match_*.json.gz em {base / 'dados'}")

    samples = tot_wide = on_side = 0
    collector_flags = 0
    per_slot = {}
    offenders = {}

    for fp in files:
        d = json.load(gzip.open(fp, "rt", encoding="utf-8"))
        for cand in d.get("candidates", []):
            for fr in cand.get("frames", []):
                samples += 1
                for p in fr.get("players", []):
                    slot = p.get("slot")
                    if slot not in WIDE_SLOTS:
                        continue
                    y, hy = p.get("y"), p.get("hy")
                    if y is None or hy is None:
                        continue
                    tot_wide += 1

                    # Régua correta: mesmo lado da linha média que a base.
                    same = (y - MID) * (hy - MID) > 0 or abs(y - MID) <= DEAD
                    if same:
                        on_side += 1
                    else:
                        k = f"{slot}"
                        offenders[k] = offenders.get(k, 0) + 1

                    st = per_slot.setdefault(slot, {"n": 0, "ok": 0})
                    st["n"] += 1
                    st["ok"] += 1 if same else 0

                    # Régua do coletor, para quantificar o falso positivo.
                    if slot[0] == "L" and y > 0.63:
                        collector_flags += 1
                    elif slot[0] == "R" and y < 0.37:
                        collector_flags += 1

    share = on_side / tot_wide if tot_wide else None
    return {
        "samples": samples,
        "wide_player_samples": tot_wide,
        "side_respect_share": round(share, 5) if share is not None else None,
        "invasions": tot_wide - on_side,
        "collector_rule_flags": collector_flags,
        "collector_rule_flag_share": round(collector_flags / tot_wide, 5) if tot_wide else None,
        "per_slot": {k: {"n": v["n"], "share": round(v["ok"] / v["n"], 5)}
                     for k, v in sorted(per_slot.items())},
        "invasions_by_slot": dict(sorted(offenders.items(), key=lambda x: -x[1])),
        "method": ("lado respeitado quando y e hy caem do mesmo lado da linha "
                   "média, com faixa morta de 0.08 (~5,4 m)"),
        "collector_defect": ("A régua do coletor usa y absoluto igual para os "
                             "dois times; os lados são espelhados por equipe, "
                             "então todo ala de um dos times é marcado na "
                             "própria posição-base."),
    }


def main():
    args = sys.argv[1:]
    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d

    base = Path(opt("--coletanea", str(Path.home() / "Downloads" / "COLETANEA_R15" /
                                      "COLETANEA_VISUAL_R15_0_EXPANDIDA")))
    rep = analyse(base)

    out = ROOT / opt("--out", "reports/r15/estrutura-tatica.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"quadros analisados          : {rep['samples']}")
    print(f"amostras de alas/laterais   : {rep['wide_player_samples']}")
    print()
    print(f"REGRA CORRETA (vs posição-base)")
    print(f"  lado respeitado           : {rep['side_respect_share']:.4f}")
    print(f"  invasões                  : {rep['invasions']}")
    print()
    print(f"REGRA DO COLETOR (y absoluto)")
    print(f"  marcações                 : {rep['collector_rule_flags']} "
          f"({rep['collector_rule_flag_share']:.4f})")
    print()
    print("por slot (fração no lado correto):")
    for k, v in rep["per_slot"].items():
        print(f"  {k:<5} n={v['n']:>7}  {v['share']:.4f}")
    print(f"\nartefato: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
