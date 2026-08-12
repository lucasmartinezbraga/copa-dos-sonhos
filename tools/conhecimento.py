#!/usr/bin/env python3
"""CONHECIMENTO.json — tudo que uma IA precisa saber, num arquivo só.

Consolida o que hoje esta espalhado por doze arquivos: o catalogo de defeitos,
as faixas-alvo, a sensibilidade das constantes, a linha de base, o painel de
trajetoria, o inventario de camadas, as regras que nao se negociam, as licoes
que custaram caro e — o mais importante — **as premissas que foram REFUTADAS**,
para que ninguem gaste um ciclo repetindo um erro ja pago.

Uso:  python3 tools/conhecimento.py
"""
from __future__ import annotations

import collections
import glob
import json
import os
import re
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def ler(rel: str):
    p = RAIZ / rel
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf8"))
    except Exception:
        return None


def inventario_camadas() -> dict:
    linhas = 0
    camadas = []
    metodos = collections.Counter()
    for f in sorted(glob.glob(str(RAIZ / "src/scripts/layers/*.js"))):
        src = Path(f).read_text(encoding="utf8")
        n = src.count("\n") + 1
        linhas += n
        ms = sorted(set(re.findall(r"\bP\.(_?[A-Za-z_$][\w$]*)\s*=", src)))
        for m in ms:
            metodos[m] += 1
        camadas.append({"arquivo": os.path.basename(f), "linhas": n, "sobrescreve": ms})
    return {
        "arquivos": len(camadas), "linhas": linhas,
        "com_sobrescrita": sum(1 for c in camadas if c["sobrescreve"]),
        "nomes_distintos": len(metodos),
        "atribuicoes_totais": sum(metodos.values()),
        "mais_disputados": [{"metodo": m, "camadas": c} for m, c in metodos.most_common(15)],
        "camadas": camadas,
    }


REGRAS = [
    {"id": "R1", "regra": "Descubra quem e o dono do metodo ANTES de editar",
     "como": "node tools/fisica/pilha.js dist/index.html 14",
     "porque": "362 sobrescritas em 60 camadas. Uma camada pode substituir um metodo e nao chamar a de baixo.",
     "custo_de_ignorar": "editar o motor e nada acontecer — ocorreu SEIS vezes",
     "limite": ("pilha.js diz se o METODO e alcancado, NAO se uma LINHA dentro dele e. "
                "Na sexta vez ela respondeu VIVA e estava certa. Quando o alvo e uma linha, "
                "escreva uma sonda de ramo de ~40 linhas.")},
    {"id": "R2", "regra": "Edite src/, nunca dist/",
     "porque": "dist/index.html e gerado por tools/build.py; edicao direta e apagada no proximo build."},
    {"id": "R3", "regra": "Nada entra sem medicao",
     "como": "bash tools/aceitar.sh --antes / --depois / --depois --identico",
     "criterio": "uma metrica SE MOVEU quando |delta| >= 2 x SE",
     "regra_dura": ("mover 2 SE PARA PIOR uma metrica que voce nao declarou que ia mexer "
                    "REPROVA a mudanca, mesmo que o alvo declarado tenha melhorado")},
    {"id": "R4", "regra": "A bateria nao ve a tela",
     "porque": "roda em vm.runInThisContext e nao desenha nada",
     "como": ("trajetoria -> tools/fisica/tela/pinga.js; movimentacao -> tela/forma.js; "
              "sempre -> tests/browser_smoke.js")},
    {"id": "R5", "regra": "CAL nao existe no escopo de uma camada",
     "porque": "o core e uma IIFE. Use ENGINE_CALIBRATION. O lint do verify.py reprova o build.",
     "caso_real": ("a camada 66 lia por root.CAL (undefined) e caia num 0,66 congelado — "
                   "a calibracao ficou desconectada e ninguem via")},
    {"id": "R6", "regra": "Toda camada nova publica contadores por ramo",
     "porque": ("a camada 45 publica e o D09 foi mensuravel em 20 minutos; a 84 nao publica "
                "e o D15 continua sendo opiniao depois de toda a investigacao")},
    {"id": "R7", "regra": "Marque toda afirmacao",
     "como": "[LIDO] li o codigo · [MEDIDO] rodei e contei · [HIPOTESE] pode estar errada"},
]

LICOES = [
    {"licao": "Numero decorativo vira numero fisico quando o integrador liga",
     "caso": "b.z = 0.12 so desenhava a bola acima do gramado; ao ligar a integracao virou altura "
             "inicial real e o passe rasteiro passou a quicar 54 vezes por minuto de jogo",
     "custo": "uma OS inteira"},
    {"licao": "Quando aumentar um recurso PIORA o resultado, o modelo esta usando o recurso errado",
     "caso": "subir a envergadura do goleiro de 1,05 para 1,45 levou os gols de 3,27 a 3,40. "
             "O resultado invertido revelou a causa real: ele mergulhava no PRIMEIRO instante "
             "alcancavel, nao no melhor",
     "custo": "um ciclo — e valeu por dez"},
    {"licao": "Quase nenhuma mudanca de comportamento e uniforme no campo",
     "caso": "o plano do portador aplicado no campo inteiro levou o placar de design de 11/13 "
             "para 6/13; restrito ao proprio campo, funcionou",
     "custo": "um ciclo"},
    {"licao": "Uma metrica parada ha varias medicoes nao precisa de outra tentativa do mesmo tipo",
     "caso": "throwIns esta fora da faixa ha 8 medicoes seguidas e duas tentativas de conserto "
             "foram revertidas. O problema e o diagnostico, nao o esforco",
     "custo": "duas tentativas revertidas (A3 e A4)"},
    {"licao": "Medicao vence leitura, inclusive quando quem leu foi voce",
     "caso": "seis premissas do proprio documento cairam quando foram medidas",
     "custo": "cinco sondas de ~40 linhas — e nenhuma virou conserto ruim no jogo"},
]

REFUTADAS = [
    {"defeito": "D01", "afirmava": "~150 lances por partida caem no integrador de g = 20 m/s2",
     "medido": "ZERO quadros de voo sem plano fisico em 12 partidas",
     "porque": "a camada 07 cria o plano logo depois de chamar o core; o desvio sempre teve g = 9,81",
     "sonda": "tools/fisica/ramo-g20.js",
     "sobrou": "a segunda fisica existe em _looseRoll: 39,25 quadros/partida, ate 2,685 m de altura"},
    {"defeito": "D02", "afirmava": "21,3 entregas por partida com o mais proximo a mais de 3 m",
     "medido": "distancia maxima de quem recebeu: 1,53 m; 100% dentro de 1,7 m",
     "porque": "as camadas 08 e 45 filtram antes; o filtro sem limite do core nao e alcancado",
     "sonda": "tools/fisica/ramo-d02.js", "sobrou": "nada — NAO IMPLEMENTAR"},
    {"defeito": "D25", "afirmava": "o desvio escapava da maquina de reinicio",
     "medido": "77,5 quadros/partida com bola de desvio fora do campo e ZERO _ballOut em voo",
     "porque": "as saidas ja vinham por _looseRoll, um quadro depois",
     "sonda": "tools/fisica/ramo-d25.js", "sobrou": "o comentario, como documentacao"},
    {"defeito": "D12", "afirmava": "a camada declara lateral e o core desfaz entregando a posse",
     "medido": "o core devolve a posse em 2,8% das chamadas; 97,2% ficam soltas",
     "sonda": "tools/fisica/ramos.js",
     "sobrou": "19,92 alvos chegam fora e so 11 pousam fora — os ~9 de diferenca nao foram investigados"},
    {"defeito": "D16", "afirmava": "a falsificacao de _breaking vaza para _cross",
     "medido": "_breaking saiu diferente ZERO vezes em 886.981 chamadas por partida",
     "sonda": "tools/fisica/ramos.js",
     "sobrou": "o defeito e de legibilidade, nao de corretude; severidade rebaixada"},
    {"defeito": "D24", "afirmava": "a tarja sobra a esquerda e a direita do gramado",
     "medido": "a sobra e VERTICAL: 19,2% a 42,7% da caixa, acima e abaixo",
     "porque": "aspect-ratio 1024/500 com object-fit: contain num conteiner mais alto que 2,048",
     "sonda": "tools/fisica/tela/caixa.js", "sobrou": "o defeito, com a causa agora localizada"},
    {"defeito": "D08", "afirmava": "cinco pontos de chamada de _deflectTo com clamp para dentro",
     "medido": "um deles estava DENTRO de codigo morto, removido pelo D03",
     "sobrou": "o fenomeno (85,8% dos alvos a mais de 8 m da lateral) segue medido; a causa precisa ser refeita"},
]

FERRAMENTAS = [
    ("bash tools/doutor.sh", "o ambiente esta pronto?", "5 s"),
    ("python3 tools/defeito.py <ID>", "UM defeito: ficha + codigo atual + secao", "instantaneo"),
    ("python3 tools/defeito.py --proximo", "o que fazer agora", "instantaneo"),
    ("python3 tools/defeitos.py", "valida que os enderecos ainda apontam certo", "2 s"),
    ("python3 tools/monitorar.py --html", "ESTA DANDO RESULTADO? trajetoria por metrica", "instantaneo"),
    ("bash tools/aceitar.sh --antes/--depois", "a mudanca entra ou nao", "~25 min"),
    ("python3 tools/comparar.py a.json b.json", "aplica o criterio de 2 SE", "instantaneo"),
    ("node tools/fisica/bateria.js", "as 14 metricas + sondas de fisica", "~20 min / 300 partidas"),
    ("python3 tools/fisica/placar.py", "13 metricas de design", "instantaneo"),
    ("python3 tools/fisica/futebol_real.py", "21 metricas de futebol de elite", "instantaneo"),
    ("node tools/fisica/pilha.js", "quais sobrescritas rodam (metodo, nao linha)", "~40 s"),
    ("node tools/fisica/ramos.js", "os ramos dos defeitos formulados por leitura", "~3 min"),
    ("node tools/fisica/ramo-d25.js|ramo-g20.js|ramo-rolagem.js|ramo-d02.js", "um ramo especifico", "~2 min"),
    ("node tools/fisica/narrar.js", "a partida em prosa de futebol", "~5 s"),
    ("node tools/fisica/direcao.js", "para onde a bola e mandada", "~2 min"),
    ("node tools/fisica/tela/*.js", "o que o JOGADOR ve (Chromium real)", "~1-2 min cada"),
    ("node tools/dossie/fotos.js", "capturas anotadas do jogo", "~1 min"),
    ("python3 tools/dossie/graficos.py", "os 8 graficos", "3 s"),
    ("python3 tools/dossie/pdf.py && node tools/dossie/imprimir.js", "o PDF", "~40 s"),
    ("python3 tools/dossie/indice.py", "o INDICE.html do dossie", "1 s"),
    ("python3 tools/conhecimento.py", "ESTE arquivo", "2 s"),
]


def main() -> int:
    sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True,
                         cwd=RAIZ).stdout.strip()
    defeitos = ler("reports/defeitos.json") or {}
    painel = ler("reports/painel.json") or {}
    ref = (ler("reports/REFERENCIA.json") or {}).get("agregado", {})
    est = collections.Counter(x["estado"] for x in defeitos.get("defeitos", []))

    doc = {
        "_leia_primeiro": (
            "Este arquivo e a base de conhecimento do projeto num lugar so. Se voce e uma IA: "
            "carregue ISTO, nao o relatorio de 5.000 linhas. Depois use "
            "`python3 tools/defeito.py <ID>` para o defeito em que vai trabalhar."),
        "projeto": "Copa dos Sonhos — simulador de futebol web",
        "gerado_em": "2026-08-12",
        "commit": sha,
        "branch": "claude/game-ball-physics-issues-50m9e6",
        "placar": {"design": "12/13", "futebol_real": "15/21",
                   "alvo_realista": "19/21 — passes nao fecha sem mexer no clockRate (D21)"},
        "tamanho": {
            "motor_linhas": 5086,
            "motor_arquivo": "src/scripts/40-match-engine-and-manager-ai.js",
            "javascript_total": 25410,
        },
        "regras_que_nao_se_negociam": REGRAS,
        "licoes_que_custaram_caro": LICOES,
        "premissas_refutadas": REFUTADAS,
        "aviso_metodologico": (
            "SEIS premissas deste catalogo cairam quando foram medidas. A causa e comum: as "
            "sondas originais mediram o CODIGO DO MOTOR, e com 362 sobrescritas em 60 camadas o "
            "que roda e o TOPO DA PILHA. Antes de consertar um ramo especifico, escreva uma sonda "
            "de ~40 linhas que conte AQUELE ramo. Ver Volume VIII-A do relatorio."),
        "defeitos": defeitos.get("defeitos", []),
        "defeitos_por_estado": dict(est),
        "linha_de_base_300_partidas": {
            k: {"media": v.get("media"), "desvio": v.get("desvio"),
                "dois_SE": round(2 * v.get("desvio", 0) / (300 ** 0.5), 4)}
            for k, v in ref.items()
        },
        "faixas_de_design": (ler("calibration/targets.json") or {}).get("metrics", {}),
        "sensibilidade_das_constantes": ler("calibration/sensibilidade.json"),
        "painel_esta_dando_resultado": painel,
        "inventario_de_camadas": inventario_camadas(),
        "sondas_de_ramo_ja_feitas": ler("reports/ramos-sonda.json"),
        "ferramentas": [{"comando": c, "responde": r, "custo": t} for c, r, t in FERRAMENTAS],
        "arquivos_do_dossie": {
            "briefing_2_paginas": "reports/LEIA-PRIMEIRO.md",
            "para_colar_numa_IA": "reports/COLE-ISTO.txt",
            "contrato_de_agentes": "AGENTS.md",
            "relatorio_completo": "reports/INVESTIGACAO-COMPLETA-2026-08.md",
            "indice_navegavel": "reports/pdf/INDICE.html",
            "monitoramento": "reports/pdf/PAINEL.html",
            "fotos_anotadas": "reports/fotos/",
            "graficos": "reports/graficos/",
        },
    }
    saida = RAIZ / "reports" / "CONHECIMENTO.json"
    saida.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf8")
    kb = saida.stat().st_size // 1024
    print(f"CONHECIMENTO.json  {kb} KB")
    print(f"  {len(doc['defeitos'])} defeitos · {len(REGRAS)} regras · {len(LICOES)} licoes · "
          f"{len(REFUTADAS)} premissas refutadas")
    print(f"  {doc['inventario_de_camadas']['arquivos']} camadas · "
          f"{doc['inventario_de_camadas']['atribuicoes_totais']} atribuicoes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
