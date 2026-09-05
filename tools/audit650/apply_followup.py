#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

TARGET = Path("dist/COPA DOS SONHOS - RC-UX.html")
REPORT = Path("reports/AUDITORIA-650-FOLLOWUP-RESULTADO.json")
EXPECTED_SHA256 = "45b3493751b5fdc9df522a2bf5b6ccf760785d0afde68af31ff93fca8c161729"
MARKER = "AUDIT650-RCUX-FOLLOWUP-1"


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(text: str, old: str, new: str, control: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{control}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def main() -> int:
    original = TARGET.read_text(encoding="utf-8")
    before = digest(original)

    if MARKER in original:
        print(f"{MARKER}: already applied")
        return 0

    if before != EXPECTED_SHA256:
        raise RuntimeError(
            f"candidate hash mismatch: expected={EXPECTED_SHA256} actual={before}"
        )

    text = replace_once(
        original,
        "const pulse = 1 + Math.sin(performance.now() / 130) * .18;",
        "const visualSpeed = clamp((root.G && root.G.speed) || 1, 1, 3.6);\n"
        "      const pulse = 1 + Math.sin(performance.now() / (130 * visualSpeed)) * .18;",
        "VFX-026..030-speed-aware-landing-pulse",
    )

    text = replace_once(
        text,
        "<!-- AUDIT650-RCUX-FIXPACK-2 -->",
        "<!-- AUDIT650-RCUX-FIXPACK-2 -->\n<!-- AUDIT650-RCUX-FOLLOWUP-1 -->",
        "INT-followup-identity-marker",
    )

    after = digest(text)
    TARGET.write_text(text, encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        json.dumps(
            {
                "followup": MARKER,
                "generatedOn": datetime.now(timezone.utc).isoformat(),
                "target": str(TARGET),
                "beforeSha256": before,
                "afterSha256": after,
                "logicalBaselineChanged": False,
                "fixedControls": ["VFX-026", "VFX-027", "VFX-028", "VFX-029", "VFX-030"],
                "change": "Landing pulse period now scales with presentation speed; logical time, RNG, ball trajectory and results are untouched.",
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"before": before, "after": after, "followup": MARKER}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"AUDIT650 FOLLOWUP FAILED: {exc}", file=sys.stderr)
        raise
