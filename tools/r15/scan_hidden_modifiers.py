#!/usr/bin/env python3
"""
§41/§42 — VARREDURA DE MODIFICADORES OCULTOS.

Procura, no HTML que efetivamente EMBARCA, qualquer trecho em que um gatilho
proibido (lenda, nacionalidade, placar, minuto, momentum, nome) esteja perto de
uma escrita de CAPACIDADE (velocidade, aceleração, probabilidade, atributo).

Distinção que o §37/§42 exigem e que este script implementa:

  CAPACIDADE  — velocidade, precisão, força, probabilidade de sucesso,
                atributo. Proibido condicionar a gatilho de roteiro.
  PREFERÊNCIA — com que frequência o jogador TENTA algo, para quem olha
                primeiro, quanto risco aceita. Permitido, desde que o
                resultado continue dependendo de contexto e atributo.

Cada achado precisa de veredito explícito no registro abaixo. Um trecho novo,
não registrado, é reportado como `UNREVIEWED` e reprova o gate — é assim que a
varredura protege contra regressão silenciosa.

Uso:
    python tools/r15/scan_hidden_modifiers.py --build "dist/....html" \
        [--out reports/r15/modificadores-ocultos.json]
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# ─────────────────────────────────────────────────────────────────────────────
# Gatilhos proibidos pelo §41 (o "porquê" ilegítimo de uma vantagem)
# ─────────────────────────────────────────────────────────────────────────────
TRIGGERS = {
    "lenda":         r"_onFire|_legendFired|\.legend\b|legendEdge|legendPull",
    "nacionalidade": r"_chem\b|byNat|_byNat",
    "placar":        r"this\.score\[[^\]]+\]\s*-\s*this\.score|scoreDiff|_losingLate|\blosing\b",
    "minuto":        r"this\.minute\s*>=?\s*\d+|minute\s*>\s*\d+",
    "momentum":      r"_bumpMom|this\.momentum|momentumDelta",
    # §41 lista "nome da formação" e "nome do estilo" como gatilhos proibidos:
    # a resposta deve nascer da ocupação espacial real, não do rótulo.
    "nome_estilo":   r"styleKey\s*===?\s*['\"]|formKey\s*===?\s*['\"]",
}

# ─────────────────────────────────────────────────────────────────────────────
# Escritas de CAPACIDADE (o "o quê" que não pode ser presenteado)
# ─────────────────────────────────────────────────────────────────────────────
CAPABILITY = re.compile(
    r"""
      maxSpd\s*[*+/-]?=            # velocidade máxima
    | \.acc\s*[*+/-]?=             # aceleração
    | \.turn\s*[*+/-]?=            # agilidade de giro
    | (?:fx\.)?ritmo\s*\*=         # ritmo coletivo (afeta decideT)
    | \bpa\s*=|\bpd\s*=            # forças de duelo
    | \bwinP\s*=|\bfoulP\s*=       # probabilidades de desfecho
    | base\s*\*=                   # xG base do chute
    | duelProb\s*\(
    | getAttr|attr\s*\(            # leitura de atributo dentro do trecho
    """,
    re.VERBOSE,
)

# ─────────────────────────────────────────────────────────────────────────────
# REGISTRO DE VEREDITOS. Chave = assinatura literal única no HTML embarcado.
#   verdict: CAPABILITY_VIOLATION | PREFERENCE_OK | NEUTRAL_OK | REMOVED
# ─────────────────────────────────────────────────────────────────────────────
REGISTRY = [
    {
        "signature": "hero.maxSpd *= 1.05",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "10-base-bundle.js ~2752 (vivo: step)",
        "why": "Velocidade física concedida por ser lenda + estar empatado/perdendo "
               "por 1 + ter passado do minuto 75. Três gatilhos do §41 numa linha; "
               "§42 proíbe explicitamente criar velocidade inexistente.",
    },
    {
        "signature": "hero._onFire = true",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "10-base-bundle.js ~2751 (vivo: step)",
        "why": "Liga o estado que alimenta os bônus de duelo e de xG abaixo.",
    },
    {
        "signature": "(o._onFire?5:0)",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "29-r12-transactional-core.js:125 (vivo: P._dribble)",
        "why": "+5 na força de drible por estado de roteiro, não por atributo.",
    },
    {
        "signature": "const fire=o._onFire?1.18:1",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "10-base-bundle.js:3822 (vivo: _shoot)",
        "why": "Multiplica o xG base em 18% — bônus direto de gol (§56).",
    },
    {
        "signature": "fx.ritmo *= (1 + Math.min(0.08, (_chem - 2) * 0.025))",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "10-base-bundle.js:2380 (vivo: aplicação de estilo)",
        "why": "Química por nacionalidade acelera decideT do time inteiro. §19 "
               "proíbe multiplicador global de química; §41 lista nacionalidade "
               "e quantidade de jogadores da mesma origem. Agrava: só o time do "
               "usuário carrega `from`, então a matriz de gates nunca mediu isso.",
    },
    {
        "signature": "(o._onFire ? 7 : 0) + legendEdge",
        "verdict": "REMOVED",
        "site": "10-base-bundle.js:3573 (CÓDIGO MORTO: _dribble do bundle base)",
        "why": "Substituído por P._dribble em 29-r12-transactional-core.js. Não "
               "executa. Fica registrado para não ser 'redescoberto' como achado.",
    },
    {
        "signature": "const legendPull = (m.ref && m.ref.legend) ? 0.38 : 0",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "10-base-bundle.js:3415 (vivo: _bestPass)",
        "why": "A bola gravita para quem tem `legend` (flag de overall>=92), não "
               "para quem está melhor posicionado ou tem melhor atributo. É "
               "preferência — mas ancorada num rótulo de fama, o que o §40 proíbe "
               "('não crie exceções por nome'). Deve derivar de atributo percebido.",
    },
    {
        "signature": "if (action === 'shot' && p.ref && p.ref.traits && p.ref.traits.includes('CLUTCH_PLAYER') && this.minute >= 75) execution += .055;",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "10-base-bundle.js ~4918 do HTML (vivo: _actionContext)",
        "why": "+0,055 em `execution` — o multiplicador de qualidade de execução "
               "que entra em TODO cálculo de chute — por trait + minuto. Não "
               "estava no handoff. Mesma proibição do §42; agrava por atuar na "
               "camada de contexto, que muitos outros sistemas leem.",
    },
    {
        "signature": "+ hunger + tendB + legendPull + comboB",
        "verdict": "CONSUMPTION_OF",
        "site": "10-base-bundle.js ~5564 do HTML (vivo: soma de _bestPass)",
        "why": "Ponto onde legendPull entra na pontuação do passe. Registrado "
               "para rastreabilidade; a violação é contada na definição.",
    },
    {
        "signature": "if(this.minute>80 && o.ref.traits.indexOf('CLUTCH_PLAYER')!==-1)pGoal*=1.15;",
        "verdict": "CAPABILITY_VIOLATION",
        "site": "10-base-bundle.js ~5925 do HTML (vivo: conversão de chute)",
        "why": "+15% na PROBABILIDADE DE GOL por ter o trait CLUTCH_PLAYER depois "
               "do minuto 80. Não estava no handoff. §42 é literal: traits mentais "
               "não podem criar precisão inexistente. §56 proíbe bônus direto de "
               "gol e scripting de fim de jogo. Independente do buff de lenda: "
               "atinge qualquer jogador com o trait, mesmo sem `legend`.",
    },
    {
        "signature": "const urgency = this.minute > 72 && scoreDiff < 0 ? .038 : 0",
        "verdict": "PREFERENCE_OK",
        "site": "10-base-bundle.js:3108 (vivo: decisão de chute)",
        "why": "Altera a UTILIDADE de chutar (frequência de tentativa) quando o "
               "time perde no fim. Não altera precisão nem xG. §37 permite "
               "explicitamente que contexto mude preferência.",
    },
    {
        "signature": "const restraint = this.minute > 72 && scoreDiff > 0 ? .022 : 0",
        "verdict": "PREFERENCE_OK",
        "site": "10-base-bundle.js:3109 (vivo: decisão de chute)",
        "why": "Simétrico do anterior: quem vence arrisca menos. Preferência.",
    },
    {
        "signature": "+ (Math.abs(this.score[p.team] - this.score[1-p.team]) <= 1 && this.minute >= 72 ? 0.035 : 0)",
        "verdict": "PREFERENCE_OK",
        "site": "10-base-bundle.js:2820 (vivo: _actionContext)",
        "why": "Aumenta `importance`, que REDUZ `execution` — e a redução é "
               "mediada por compostura. É um NERF simétrico sob pressão de "
               "momento decisivo, não um buff. §42 proíbe conceder capacidade; "
               "não proíbe modelar nervosismo mediado por atributo.",
    },
    {
        "signature": "const _losingLate = this.minute > 80 && this.score[p.team] < this.score[1 - p.team]",
        "verdict": "PREFERENCE_OK",
        "site": "10-base-bundle.js:4957 (vivo: postura coletiva)",
        "why": "Empurra a POSTURA (linha mais alta) de quem perde no fim. É "
               "decisão tática observável, não capacidade. Continua sujeita a "
               "ser punida no contra-ataque.",
    },
]


def load(build_rel):
    p = ROOT / build_rel
    if not p.exists():
        sys.exit(f"ERRO: build não encontrada: {p}")
    return p.read_text(encoding="utf-8", errors="replace")


def line_of(text, idx):
    return text.count("\n", 0, idx) + 1


def scan(text):
    """Varredura ampla: gatilho e capacidade na mesma janela."""
    hits = []
    for trig_name, trig_re in TRIGGERS.items():
        for m in re.finditer(trig_re, text):
            a, b = max(0, m.start() - 260), min(len(text), m.end() + 260)
            window = text[a:b]
            cap = CAPABILITY.search(window)
            if not cap:
                continue
            hits.append({
                "trigger": trig_name,
                "trigger_text": m.group(0)[:80],
                "capability_text": cap.group(0)[:80],
                "offset": m.start(),
                "line": line_of(text, m.start()),
                "excerpt": re.sub(r"\s+", " ", window[180:380]).strip()[:200],
            })
    return hits


def main():
    args = sys.argv[1:]
    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d

    build = opt("--build")
    if not build:
        sys.exit("ERRO: --build é obrigatório")
    text = load(build)

    # 1) Registro curado: cada assinatura conhecida ainda está embarcada?
    registry_state = []
    violations_live = 0
    for entry in REGISTRY:
        present = entry["signature"] in text
        state = dict(entry)
        state["present_in_build"] = present
        if entry["verdict"] == "CAPABILITY_VIOLATION":
            state["status"] = "ATIVO" if present else "CORRIGIDO"
            if present:
                violations_live += 1
        elif entry["verdict"] == "REMOVED":
            state["status"] = "CODIGO_MORTO" if present else "AUSENTE"
        elif entry["verdict"] == "CONSUMPTION_OF":
            # Ponto de uso de uma violação já contada na definição.
            state["status"] = "RASTREIO" if present else "AUSENTE"
        else:
            state["status"] = "ACEITO" if present else "AUSENTE"
        registry_state.append(state)

    # 2) Varredura ampla: algo novo, fora do registro?
    known = [e["signature"] for e in REGISTRY]
    raw_hits = scan(text)
    unreviewed = []
    for h in raw_hits:
        a = h["offset"]                       # posição REAL do casamento
        near = text[max(0, a - 500): a + 500]
        if any(k in near for k in known):
            continue
        unreviewed.append(h)

    # Deduplicação por (gatilho, linha) — o mesmo trecho casa vários padrões.
    seen, dedup = set(), []
    for h in unreviewed:
        key = (h["trigger"], h["line"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(h)

    import hashlib
    sha = hashlib.sha256((ROOT / build).read_bytes()).hexdigest()
    report = {
        "build": build,
        "sha256": sha,
        "sites_scanned": len(raw_hits),
        "capability_modifiers_found": violations_live,
        "unreviewed_sites": len(dedup),
        # O gate DEVE ler este campo, não `capability_modifiers_found`.
        # Um modificador NOVO não está no registro curado: ele aparece como
        # `unreviewed`. Contar só o registro fazia a varredura enxergar apenas
        # os problemas que ela já conhecia — provado pela mutação
        # `mut-hidden-style-bonus`, que injetou um bônus de gol por nome de
        # estilo e passou com 0 violações.
        "blocking_findings": violations_live + len(dedup),
        "registry": registry_state,
        "unreviewed": dedup[:60],
    }

    out = opt("--out", "reports/r15/modificadores-ocultos.json")
    (ROOT / out).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / out).write_text(json.dumps(report, indent=1, ensure_ascii=False),
                            encoding="utf-8")

    print(f"build: {build}")
    print(f"trechos varridos (gatilho perto de capacidade): {len(raw_hits)}")
    print(f"violações de CAPACIDADE ainda embarcadas: {violations_live}")
    print(f"trechos sem veredito registrado: {len(dedup)}")
    print("\n── registro ──")
    for s in registry_state:
        print(f"  [{s['status']:<12}] {s['verdict']:<22} {s['site']}")
        print(f"       {s['signature'][:88]}")
    if dedup:
        print("\n── sem veredito (precisam de análise) ──")
        for h in dedup[:25]:
            print(f"  linha {h['line']:>6} gatilho={h['trigger']:<14} "
                  f"cap={h['capability_text'][:28]}")
    print(f"\nartefato: {out}")
    return 0 if violations_live == 0 and not dedup else 1


if __name__ == "__main__":
    sys.exit(main())
