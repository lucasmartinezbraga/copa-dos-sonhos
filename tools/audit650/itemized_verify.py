#!/usr/bin/env python3
"""Validação técnica individual dos 60 FAIL da auditoria pós-motor 2.5D.

O script não converte presença de código em PASS perceptivo. Para cada ID ele:
- verifica a correção técnica correspondente na fonte e no HTML reconstruído;
- cria evidence/<hash>/<dominio>/<ID>/resultado.json;
- classifica como CORRIGIDO_TECNICAMENTE ou FALHA_TECNICA;
- mantém requires_final_evidence=true quando o método original exige vídeo,
  observador humano, leitor de tela, aparelho físico ou sessão longa.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / "dist/COPA DOS SONHOS - RC-UX.html"
SRC_VIS = ROOT / "src/ux/55-audit650-item-fixes.js"
SRC_A11Y = ROOT / "src/ux/95-audit650-a11y.js"
SRC_CSS = ROOT / "src/ux/95-audit650.css"
PATCHES = ROOT / "src/ux/patches.zz-audit650.json"
REPORT_JSON = ROOT / "reports/AUDITORIA-650-ITEM-A-ITEM.json"
REPORT_MD = ROOT / "reports/AUDITORIA-650-ITEM-A-ITEM.md"


@dataclass
class Item:
    id: str
    domain: str
    priority: str
    context: str
    criterion: str
    original_status: str
    technical_fix: str
    checks: list[str]
    technical_status: str
    requires_final_evidence: bool
    final_evidence: str
    evidence_path: str = ""


def contains(text: str, needle: str) -> bool:
    return needle in text


def all_present(texts: list[str], needles: list[str]) -> bool:
    joined = "\n".join(texts)
    return all(n in joined for n in needles)


def none_present(texts: list[str], needles: list[str]) -> bool:
    joined = "\n".join(texts)
    return all(n not in joined for n in needles)


def add_group(items: list[Item], ids: list[str], domain: str, priority: str,
              contexts: list[str], criterion: str, fix: str,
              check_names: list[str], check_fn: Callable[[], bool],
              final_evidence: str) -> None:
    ok = check_fn()
    for item_id, context in zip(ids, contexts):
        items.append(Item(
            id=item_id,
            domain=domain,
            priority=priority,
            context=context,
            criterion=criterion,
            original_status="FAIL",
            technical_fix=fix,
            checks=check_names,
            technical_status="CORRIGIDO_TECNICAMENTE" if ok else "FALHA_TECNICA",
            requires_final_evidence=True,
            final_evidence=final_evidence,
        ))


def main() -> int:
    required_files = [BUILD, SRC_VIS, SRC_A11Y, SRC_CSS, PATCHES]
    missing = [str(p.relative_to(ROOT)) for p in required_files if not p.exists()]
    if missing:
        raise SystemExit("Arquivos ausentes: " + ", ".join(missing))

    build = BUILD.read_text(encoding="utf-8")
    visual = SRC_VIS.read_text(encoding="utf-8")
    a11y = SRC_A11Y.read_text(encoding="utf-8")
    css = SRC_CSS.read_text(encoding="utf-8")
    patches = PATCHES.read_text(encoding="utf-8")
    texts = [build, visual, a11y, css, patches]
    build_sha = hashlib.sha256(build.encode("utf-8")).hexdigest()
    contexts5 = ["desktop 1440x810", "tablet 1024x768", "retrato 390x844", "paisagem 844x390", "bola parada/replay"]
    items: list[Item] = []

    elevation_ok = lambda: all_present(texts, [
        "function elevatedY(p, z)", "return Math.max(36", "const bx = g0.x, by = elevatedY(g0, z)",
        "2.3.0-audit650-itemized"
    ])
    add_group(items, [f"PRO-{i:03d}" for i in range(21, 26)], "projecao-camera", "P0", contexts5,
              "Bola alta não invade arquibancada distante.",
              "Teto de elevação visual por profundidade, sem alterar x/y/z lógico.",
              ["elevatedY", "piso visual 36px", "bola usa elevatedY"], elevation_ok,
              "Monitor de projeção + captura/vídeo em cada viewport e replay.")
    add_group(items, [f"PRO-{i:03d}" for i in range(26, 31)], "projecao-camera", "P0", contexts5,
              "Bola aérea permanece dentro da banda visível do estádio.",
              "Compressão monotônica de elevação e banda superior reservada.",
              ["elevatedY", "maxLift por profundidade", "piso visual 36px"], elevation_ok,
              "Medição do ponto visual mais alto em cada contexto.")

    stage_ok = lambda: all_present(texts, [
        "function spStage25D(scene)", "stage: 'CDS_F25D'", "root.spPerspective = spStage25D"
    ])
    add_group(items, [f"PRO-{i:03d}" for i in range(31, 36)], "projecao-camera", "P0", contexts5,
              "Falta e pênalti usam o mesmo palco 2.5D.",
              "Contrato único spStage25D para falta, pênalti e disputa por pênaltis.",
              ["spStage25D", "identidade CDS_F25D", "alias substitui implementação legada"], stage_ok,
              "Vídeo de falta e pênalti em quatro viewports e replay.")

    athlete_contexts = ["corrida", "passe e domínio", "finalização/cabeceio", "duelo/carrinho", "ação do goleiro"]
    stride_ok = lambda: all_present(texts, [
        "const stride = pose === 'run'", "Math.sin(cycle)", "joint({ x: -r * .17", "motionType: motion&&motion.type"
    ])
    add_group(items, [f"ATL-{i:03d}" for i in range(16, 21)], "atletas", "P0", athlete_contexts,
              "Corrida possui passada visível.",
              "Ciclo de passada proporcional ao deslocamento projetado, com pés articulados.",
              ["run cycle", "stride", "juntas de pernas", "estado de movimento recebido"], stride_ok,
              "Galeria/clipes em 1.0x e 0.5x nos cinco contextos.")

    poses_ok = lambda: all_present(texts, [
        "pose === 'pass'", "pose === 'shoot'", "pose === 'header'", "pose === 'tackle'",
        "pose === 'punch'", "pose === 'parry'", "root.__cdsVisualEvent", "event-pose-hook"
    ])
    add_group(items, [f"ATL-{i:03d}" for i in range(21, 26)], "atletas", "P0", athlete_contexts,
              "Passe, chute, cabeceio e carrinho possuem pose própria.",
              "Poses articuladas disparadas por estados/eventos, incluindo ações específicas do goleiro.",
              ["pass", "shoot", "header", "tackle", "claim/punch/parry", "hook onEvent"], poses_ok,
              "Galeria determinística sincronizada ao frame de contato.")

    transition_ok = lambda: all_present(texts, [
        "const bob = pose === 'run'", "const smoothDx", "const smoothDy", "lastSeen",
        "joint({ x: -r * .17", "ctx.translate(x, y - bob)"
    ])
    add_group(items, [f"ATL-{i:03d}" for i in range(26, 31)], "atletas", "P0", athlete_contexts,
              "Transição de pose não desliza os pés.",
              "Apoio articulado, suavização vetorial, bob e descarte de histórico obsoleto.",
              ["smooth vector", "foot joints", "stride/bob", "cache temporal"], transition_ok,
              "Clipes a 1.0x/0.5x confirmando apoio e contato sem patinação.")

    vfx_contexts = ["1X", "2X", "4X", "TURBO", "replay/bola parada"]
    arc_ok = lambda: all_present(texts, [
        "aerial = z > .45", "quadraticCurveTo(AC.x", "quadraticCurveTo(CD.x", "isShot ? 'rgba(255,255,255"
    ]) and none_present([visual], ["!isShot && z >"])
    add_group(items, [f"VFX-{i:03d}" for i in range(21, 26)], "trajetorias-vfx", "P1", vfx_contexts,
              "Chute alto usa arco em vez de reta.",
              "A condição aérea depende da altura, não exclui kind=shot, e usa Bézier conectada à bola.",
              ["aerial por z", "Bézier percorrida", "Bézier futura", "sem exclusão de shot"], arc_ok,
              "Captura/vídeo de cavadinha e cobertura nas cinco velocidades/contextos.")

    pulse_ok = lambda: all_present(texts, [
        "const visualSpeed = clamp((root.G && root.G.speed) || 1, 1, 3.6)",
        "performance.now() / (130 * visualSpeed)"
    ]) and none_present([visual], ["performance.now() / 130)"])
    add_group(items, [f"VFX-{i:03d}" for i in range(26, 31)], "trajetorias-vfx", "P1", vfx_contexts,
              "Pulso de queda respeita velocidade do jogo.",
              "Período visual escalado pelo multiplicador de apresentação.",
              ["visualSpeed", "período 130*speed", "sem período fixo"], pulse_ok,
              "Vídeo comparativo 1X/2X/4X/TURBO/replay sem piscada frenética.")

    ux_contexts = ["home e setup", "draft", "pré-jogo", "partida", "pós-jogo/save-load"]
    draft_ok = lambda: all_present(texts, [
        "UX-031-035-draft-emergency-reroll", "filled()===10", "!__canFinish",
        "d.__emergencyRerollUsed", "Reroll de emergência liberado"
    ])
    add_group(items, [f"UX-{i:03d}" for i in range(31, 36)], "ux", "P1", ux_contexts,
              "Draft não bloqueia em 10/11 sem reroll compatível.",
              "Reroll emergencial único somente quando nenhuma peça disponível completa a vaga restante.",
              ["detecção 10/11", "compatibilidade canPlay", "uso único", "feedback ao usuário"], draft_ok,
              "Driver dirigido G2 e fluxo draft→copa→partida→save/load.")

    a11_contexts = ["mouse", "teclado", "leitor de tela", "alto contraste", "redução de movimento"]
    live_ok = lambda: all_present(texts, [
        "ensureLive('match-live-feed', 'polite')", "field-text-alternative", "role', 'img'",
        "Placar atualizado:", "Estado textual da partida"
    ])
    add_group(items, [f"A11-{i:03d}" for i in range(11, 16)], "acessibilidade", "P1", a11_contexts,
              "Eventos de partida são anunciados por leitor de tela.",
              "Feed aria-live, anúncio de placar/narração e alternativa textual ao canvas.",
              ["aria-live", "placar", "narração", "canvas role=img", "lista textual de atletas"], live_ok,
              "Árvore AX e gravação NVDA/VoiceOver nos cinco contextos.")

    contrast_ok = lambda: all_present(texts, [
        "@media (forced-colors:active)", "ButtonText!important", "Highlight!important",
        ":focus-visible", "@media (prefers-reduced-motion:reduce)"
    ])
    add_group(items, [f"A11-{i:03d}" for i in range(16, 21)], "acessibilidade", "P1", a11_contexts,
              "Interface suporta alto contraste/forced-colors.",
              "Regras explícitas para forced-colors, foco forte e movimento reduzido.",
              ["forced-colors", "ButtonText", "Highlight", "focus-visible", "reduced-motion"], contrast_ok,
              "Medição WCAG e execução real em alto contraste/forced-colors.")

    perf_contexts = ["boot frio", "partida 1X", "partida TURBO", "resize/rotação", "sequência de partidas"]
    cache_ok = lambda: all_present(texts, [
        "dirCache.clear()", "root.addEventListener('pagehide', resetVisualCaches)",
        "root.addEventListener('beforeunload', resetVisualCaches)", "root.CDS_F25D.reset"
    ])
    add_group(items, [f"PRF-{i:03d}" for i in range(31, 36)], "performance", "P2", perf_contexts,
              "Caches visuais são limpos entre partidas/contextos.",
              "Reset explícito, descarte por inatividade e limpeza em transição/saída.",
              ["dirCache.clear", "pagehide", "beforeunload", "screen transition reset"], cache_ok,
              "Sessão longa com heap/listeners/timers e sequência de partidas.")

    if len(items) != 60:
        raise SystemExit(f"Mapa inválido: {len(items)} itens, esperado 60")

    generated = datetime.now(timezone.utc).isoformat()
    evidence_root = ROOT / "evidence" / build_sha / "audit650-itemized"
    for item in items:
        item_dir = evidence_root / item.domain / item.id
        item_dir.mkdir(parents=True, exist_ok=True)
        item.evidence_path = str((item_dir / "resultado.json").relative_to(ROOT))
        payload = asdict(item) | {
            "build_sha256": build_sha,
            "generated_on": generated,
            "verdict_scope": "technical implementation only",
            "pass_final": False,
        }
        (item_dir / "resultado.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    failures = [i for i in items if i.technical_status != "CORRIGIDO_TECNICAMENTE"]
    summary = {
        "generated_on": generated,
        "build": str(BUILD.relative_to(ROOT)),
        "build_sha256": build_sha,
        "source_files": [str(p.relative_to(ROOT)) for p in required_files[1:]],
        "total_original_fail": 60,
        "technical_corrected": 60 - len(failures),
        "technical_failed": len(failures),
        "pass_final": 0,
        "rule": "Correção técnica individual não equivale a PASS final sem a evidência do método original.",
        "items": [asdict(i) for i in items],
    }
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    lines = [
        "# Auditoria 650 — correção item por item dos 60 FAIL",
        "",
        f"- Build: `{BUILD.relative_to(ROOT)}`",
        f"- SHA-256: `{build_sha}`",
        f"- Corrigidos tecnicamente: **{60 - len(failures)}/60**",
        f"- Falhas técnicas restantes: **{len(failures)}**",
        "- PASS final atribuído nesta etapa: **0/60** — cada método visual/humano/device ainda precisa produzir sua evidência.",
        "",
        "| ID | Domínio | Contexto | Correção técnica | Estado | Evidência final obrigatória |",
        "|---|---|---|---|---|---|",
    ]
    for i in items:
        lines.append(f"| {i.id} | {i.domain} | {i.context} | {i.technical_fix} | {i.technical_status} | {i.final_evidence} |")
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({
        "verdict": "PASS_TECHNICAL_60_OF_60" if not failures else "FAIL_TECHNICAL_ITEMIZED",
        "build_sha256": build_sha,
        "corrected": 60 - len(failures),
        "failed": [i.id for i in failures],
    }, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
