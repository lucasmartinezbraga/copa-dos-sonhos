#!/usr/bin/env python3
"""
Gera o KIT HUMANO: converte os controles que exigem olho humano ou aparelho
físico em folhas de resposta simples, e depois LÊ essas folhas de volta como
evidência da auditoria.

O gargalo da R14 não é técnico: 582 dos 800 controles precisam de uma pessoa
olhando. Este script existe para que esse tempo humano vire evidência
verificável sem digitar JSON — a pessoa marca [x] num arquivo de texto e o
reconciliador consome.

  python tools/r14/make_human_kit.py            gera as folhas
  python tools/r14/make_human_kit.py --ler      lê as respostas preenchidas

Formato da folha (uma linha por controle):

  [ ] ANM-004  Transição de corrida para chute é legível
      > cenário: assistir um gol de fora da área em 1x
      > aceite:  a preparação aparece antes do contato com a bola

Marcar `[x]` = PASS, `[!]` = FAIL, `[?]` = não consegui avaliar.
Linhas em branco e comentários são ignorados. Nada é inventado: um controle
sem marcação continua PENDENTE.
"""
import json, re, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MATRIX = ROOT / "audit-r14/matriz/AUDITORIA-MESTRA-R14-800-ITENS.json"
KIT = ROOT / "reports/r14/kit-humano"
BUILD = ROOT / "dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html"

# como agrupar as folhas: por natureza do esforço, não por domínio da matriz
GRUPOS = [
    ("01-assistir-partida", lambda m, d: "VIS" in m and "MOB" not in d and "12." not in d,
     "Assistir partidas no desktop e julgar o que aparece na tela."),
    ("02-aparelho-fisico", lambda m, d: "12." in d or "MOB" in d,
     "Exige Android ou iPhone REAL. Emulação não vale."),
    ("03-painel-humano", lambda m, d: "PAINEL" in m or "HUMANO" in m,
     "Precisa de 3 observadores independentes; cada um preenche sua cópia."),
    ("04-acessibilidade", lambda m, d: "A11Y" in m or "13." in d,
     "Leitor de tela, contraste, navegação por teclado."),
    ("05-execucao-dirigida", lambda m, d: "DIR" in m or "MANUAL" in m or "DEV" in m,
     "Passo a passo dirigido: seguir o cenário e conferir o aceite."),
]


def gerar():
    itens = json.loads(MATRIX.read_bytes().decode("utf-8"))["items"]
    pend = [i for i in itens if i.get("result") != "PASS"]
    KIT.mkdir(parents=True, exist_ok=True)
    usados, total = set(), 0

    for nome, filtro, ajuda in GRUPOS:
        sel = [i for i in pend if i["id"] not in usados
               and filtro(i.get("method", ""), i.get("domain", ""))]
        if not sel:
            continue
        for i in sel:
            usados.add(i["id"])
        linhas = [
            f"# {nome}  ({len(sel)} controles)",
            f"# {ajuda}",
            "#",
            "# Marque:  [x] passou   [!] falhou   [?] não consegui avaliar",
            "# Deixe [ ] no que não testar — fica PENDENTE, e tudo bem.",
            f"# Build a testar: {BUILD.name}",
            "",
        ]
        for i in sel:
            linhas.append(f"[ ] {i['id']}  {i['control']}")
            if i.get("scenario"):
                linhas.append(f"    > cenário: {i['scenario']}")
            if i.get("acceptance"):
                linhas.append(f"    > aceite:  {i['acceptance']}")
            linhas.append("")
        p = KIT / f"{nome}.txt"
        p.write_bytes("\n".join(linhas).encode("utf-8"))
        total += len(sel)
        print(f"  {p.relative_to(ROOT)}  —  {len(sel)} controles")

    (KIT / "00-LEIA-ME.md").write_bytes((
        "# Kit humano — R14\n\n"
        f"São {total} controles que dependem de uma pessoa. Não precisa fazer tudo,\n"
        "nem de uma vez: **cada linha marcada vira evidência**; o resto continua\n"
        "`PENDENTE` sem prejuízo.\n\n"
        "## Como usar\n\n"
        "1. Abra a build em `dist/` e deixe aberta ao lado.\n"
        "2. Escolha um arquivo `.txt` deste diretório.\n"
        "3. Para cada linha, siga o `cenário` e confira o `aceite`.\n"
        "4. Troque `[ ]` por `[x]` (passou), `[!]` (falhou) ou `[?]` (não deu).\n"
        "5. Rode: `python tools/r14/make_human_kit.py --ler`\n\n"
        "## Por onde começar (maior retorno primeiro)\n\n"
        "- `01-assistir-partida.txt` — só precisa de um navegador. É o maior grupo\n"
        "  e destrava a Fase 5, que hoje está parcial.\n"
        "- `02-aparelho-fisico.txt` — 20 minutos com o celular na mão fecham o\n"
        "  domínio Mobile inteiro, que nenhuma emulação pode fechar.\n"
        "- `03-painel-humano.txt` — precisa de 3 pessoas; deixe por último.\n\n"
        "## O que acontece com o que você marcar\n\n"
        "`[!]` (falhou) é tão útil quanto `[x]`: vira um defeito registrado com o\n"
        "SHA da build, e eu consigo investigar. Não force `[x]` — auditoria com\n"
        "item aprovado sem observação não vale nada.\n"
    ).encode("utf-8"))
    print(f"\n{total} controles distribuídos em {KIT.relative_to(ROOT)}")


def ler():
    itens = json.loads(MATRIX.read_bytes().decode("utf-8"))["items"]
    por_id = {i["id"]: i for i in itens}
    marca = re.compile(r"^\[([ x!?])\]\s+([A-Z0-9]+-\d+)")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    import hashlib
    sha = hashlib.sha256(BUILD.read_bytes()).hexdigest() if BUILD.exists() else "PREENCHER"

    contagem = {"PASS": 0, "FAIL": 0, "PENDENTE": 0}
    lidos = []
    for f in sorted(KIT.glob("*.txt")):
        for linha in f.read_bytes().decode("utf-8").splitlines():
            m = marca.match(linha.strip())
            if not m:
                continue
            marcador, rid = m.group(1), m.group(2)
            if rid not in por_id or marcador == " ":
                continue
            res = {"x": "PASS", "!": "FAIL", "?": "PENDENTE"}[marcador]
            it = por_id[rid]
            it["result"] = res
            it["owner"] = "observador humano"
            it["executed_at"] = now
            it["evidence_path"] = str(f.relative_to(ROOT)).replace("\\", "/")
            it["notes"] = f"Marcado por observação humana em {f.name}"
            contagem[res] += 1
            lidos.append((rid, res))

    if not lidos:
        print("Nenhuma marcação encontrada. Edite os .txt em "
              f"{KIT.relative_to(ROOT)} trocando [ ] por [x], [!] ou [?].")
        return 0

    MATRIX.write_bytes(json.dumps({"items": itens}, ensure_ascii=False, indent=1).encode("utf-8"))
    base = ROOT / "audit-r14/evidence"
    for rid, res in lidos:
        achado = list(base.glob(f"*/{rid}/resultado.json"))
        if not achado:
            continue
        p = achado[0]
        o = json.loads(p.read_bytes().decode("utf-8"))
        o.update({"result": res, "candidate_sha256": sha, "executed_at": now,
                  "notes": "Observação humana (kit-humano)"})
        p.write_bytes(json.dumps(o, ensure_ascii=False, indent=2).encode("utf-8"))

    print(f"{len(lidos)} controles lidos:  PASS {contagem['PASS']}  "
          f"FAIL {contagem['FAIL']}  PENDENTE {contagem['PENDENTE']}")
    if contagem["FAIL"]:
        print("\nFALHAS registradas (me traga estas que eu investigo):")
        for rid, res in lidos:
            if res == "FAIL":
                print(f"  {rid}  {por_id[rid]['control']}")
    print("\nAgora rode: cd audit-r14 && python scripts/release_gate.py")
    return 0


if __name__ == "__main__":
    sys.exit(ler() if "--ler" in sys.argv else (gerar() or 0))
