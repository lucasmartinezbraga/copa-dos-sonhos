#!/usr/bin/env python3
"""
Gera as entradas R15 de `src/r14/patches-engine.json` que removem os
modificadores ocultos do §41/§42.

Os textos-âncora são LIDOS dos módulos-fonte e conferidos por unicidade antes de
serem gravados, para que nenhuma âncora seja digitada à mão e depois falhe no
build. Idempotente: reexecutar não duplica entradas.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "src/r13/scripts/10-base-bundle.js"
R12 = ROOT / "src/r13/scripts/29-r12-transactional-core.js"
PATCHES = ROOT / "src/r14/patches-engine.json"


def grab(path, first, last=None):
    """Recorta o trecho literal entre a linha que contém `first` e a que contém
    `last` (inclusive), conferindo que o resultado é único no arquivo."""
    lines = path.read_text(encoding="utf-8").split("\n")
    i = next((k for k, l in enumerate(lines) if first in l), None)
    if i is None:
        sys.exit(f"ERRO: âncora inicial não encontrada em {path.name}: {first!r}")
    j = i if last is None else next(
        (k for k, l in enumerate(lines) if last in l and k >= i), None)
    if j is None:
        sys.exit(f"ERRO: âncora final não encontrada em {path.name}: {last!r}")
    snippet = "\n".join(lines[i:j + 1])
    if path.read_text(encoding="utf-8").count(snippet) != 1:
        sys.exit(f"ERRO: trecho não é único em {path.name}: {first!r}")
    return snippet


NEW = []

# ── 1. Buff de lenda: velocidade física + estado _onFire + narração ──────────
blk = grab(BUNDLE, "hero._onFire = true;", "this._emit('legend', { by: hero });")
NEW.append({
    "id": "r15-drop-legend-speed-buff",
    "priority": "P0",
    "audit_ids": "SCRIPT-001",
    "rationale": (
        "§42 — BUFF DE LENDA REMOVIDO. Aos 75'+, com o jogo empatado ou perdendo "
        "por 1, um jogador com `ref.legend` (overall>=92) e trait CLUTCH_PLAYER "
        "recebia `maxSpd *= 1.05` — VELOCIDADE FÍSICA — mais o estado `_onFire`, "
        "que alimentava +5 no duelo de drible e x1,18 no xG. São três gatilhos "
        "proibidos numa estrutura só: status de lenda, placar e minuto. O §42 é "
        "literal: nenhum jogador pode receber capacidade física adicional por ser "
        "lenda, por ter chegado a certo minuto ou por estar perdendo. A narração "
        "'a lenda assume o jogo' sai junto: sem efeito mecânico, ela seria um "
        "evento sem causa física (§56). Se o comportamento de responsabilidade "
        "for desejado, o §42 permite implementá-lo como PREFERÊNCIA (procura pela "
        "bola, tolerância a risco) — em mudança separada e medida à parte."
    ),
    "from": blk,
    "to": "          this._legendFired = true;",
})

# ── 2. _onFire no duelo de drible (camada viva R12) ─────────────────────────
NEW.append({
    "id": "r15-drop-onfire-dribble-bonus",
    "priority": "P0",
    "audit_ids": "SCRIPT-001",
    "rationale": (
        "§42 — consumidor do estado `_onFire`: +5 na força de ataque do duelo de "
        "drible. Vantagem técnica concedida por roteiro, não por atributo. "
        "O termo derivado de atributo (`elite`/`dri`) permanece intacto."
    ),
    "from": "+(o._onFire?5:0)+(elite?4+Math.max(0,dri-86)*.38:0)",
    "to": "+(elite?4+Math.max(0,dri-86)*.38:0)",
})

# ── 3. _onFire no xG do chute ───────────────────────────────────────────────
NEW.append({
    "id": "r15-drop-onfire-xg-bonus",
    "priority": "P0",
    "audit_ids": "SCRIPT-001",
    "rationale": (
        "§56 — 'bônus direto de gol'. `base *= fire` multiplicava o xG em 18% "
        "pelo estado de roteiro. Removido na origem."
    ),
    "from": "const fire=o._onFire?1.18:1;",
    "to": "const fire=1;",
})

# ── 4. Química por nacionalidade ────────────────────────────────────────────
NEW.append({
    "id": "r15-drop-nationality-chemistry",
    "priority": "P0",
    "audit_ids": "SCRIPT-002",
    "rationale": (
        "§19/§41/§56 — QUÍMICA POR NACIONALIDADE REMOVIDA. Contar quantos "
        "titulares vêm da mesma seleção e multiplicar `fx.ritmo` em até 8% "
        "acelerava `decideT` do time inteiro: o time decidia mais rápido por "
        "causa do passaporte dos jogadores. O §19 proíbe multiplicador global de "
        "química e exige familiaridade causal por comportamento; o §41 lista "
        "nacionalidade e quantidade de jogadores da mesma origem; o §56 lista "
        "'bônus por nacionalidade' e 'química mágica'. Agravante: só o elenco "
        "montado no draft carrega `sl.from`, então o bônus caía apenas no time do "
        "usuário — e a matriz de gates, que roda com times da IA, estruturalmente "
        "nunca o mediu. O campo `t._chem` é mantido para diagnóstico e para a "
        "futura familiaridade causal do §19."
    ),
    "from": "    if (_chem >= 3) { fx.ritmo *= (1 + Math.min(0.08, (_chem - 2) * 0.025)); t._chem = _chem; }",
    "to": "    if (_chem >= 3) { t._chem = _chem; }   /* §19/§41: sem multiplicador global de química */",
})

# ── 5. Atração da bola pelo rótulo de fama ──────────────────────────────────
NEW.append({
    "id": "r15-drop-legend-pass-pull",
    "priority": "P0",
    "audit_ids": "SCRIPT-003",
    "rationale": (
        "§40/§41 — 'não crie exceções por nome'. `legendPull` somava 0,38 fixos à "
        "pontuação de qualquer passe cujo receptor tivesse a flag `legend` "
        "(overall>=92). A bola gravitava para um RÓTULO, não para quem estava "
        "melhor posicionado nem para quem tinha melhor atributo percebido. "
        "Consequência colateral registrada: com a remoção, a qualidade do "
        "RECEPTOR deixa de pesar na escolha do passe — o §54 pede que o jogador "
        "de elite influencie o coletivo, e isso terá de vir de termo derivado de "
        "atributo, avaliado nos testes de diferenciação do §24/§25."
    ),
    "from": "      const legendPull = (m.ref && m.ref.legend) ? 0.38 : 0;   // a bola gravita pro craque",
    "to": "      const legendPull = 0;   /* §40/§41: sem exceção por rótulo de fama */",
})

# ── 6. Bônus de conversão por trait + minuto ────────────────────────────────
NEW.append({
    "id": "r15-drop-clutch-xg-bonus",
    "priority": "P0",
    "audit_ids": "SCRIPT-004",
    "rationale": (
        "§42/§56 — ACHADO NOVO, não registrado em nenhum relatório anterior. "
        "`pGoal *= 1.15` dava 15% a mais de PROBABILIDADE DE GOL a qualquer "
        "jogador com o trait CLUTCH_PLAYER depois do minuto 80. Independe do buff "
        "de lenda: atinge quem tem o trait mesmo sem `legend`. O §42 diz que "
        "traits mentais não podem criar precisão inexistente; o §56 proíbe bônus "
        "direto de gol e scripting de fim de jogo."
    ),
    "from": "    if(this.minute>80 && o.ref.traits.indexOf('CLUTCH_PLAYER')!==-1)pGoal*=1.15;\n",
    "to": "",
})

# ── 7. Bônus de execução por trait + minuto ─────────────────────────────────
NEW.append({
    "id": "r15-drop-clutch-execution-bonus",
    "priority": "P0",
    "audit_ids": "SCRIPT-005",
    "rationale": (
        "§42 — ACHADO NOVO, não registrado antes. `execution += .055` para "
        "CLUTCH_PLAYER a partir do minuto 75, dentro de `_actionContext` — a "
        "camada de contexto que TODOS os cálculos de chute leem. Mesma proibição "
        "do anterior, com alcance maior por atuar na camada compartilhada."
    ),
    "from": "    if (action === 'shot' && p.ref && p.ref.traits && p.ref.traits.includes('CLUTCH_PLAYER') && this.minute >= 75) execution += .055;\n",
    "to": "",
})


def main():
    existing = json.loads(PATCHES.read_bytes().decode("utf-8"))
    have = {p["id"] for p in existing}
    added = [p for p in NEW if p["id"] not in have]
    if not added:
        print("nada a fazer: todas as entradas R15 já existem")
        return 0

    # As remoções entram ANTES do experimento desligado, mantendo a ordem de
    # leitura do arquivo coerente com a ordem de aplicação.
    idx = next((i for i, p in enumerate(existing) if p["id"].startswith("_exp")),
               len(existing))
    merged = existing[:idx] + added + existing[idx:]
    PATCHES.write_text(json.dumps(merged, indent=1, ensure_ascii=False) + "\n",
                       encoding="utf-8")
    for p in added:
        print(f"  + {p['id']}")
    print(f"\n{len(added)} entradas adicionadas a {PATCHES.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
