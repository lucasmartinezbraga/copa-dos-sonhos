#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re
from pathlib import Path

TARGET = Path("dist/COPA DOS SONHOS - RC-UX.html")
REPORT = Path("reports/AUDITORIA-650-STATIC-VERIFY.json")

REQUIRED = {
    "fixpack marker": "AUDIT650-RCUX-FIXPACK-2",
    "auditable 2.5D version": "2.2.0-audit650",
    "aerial projector": "function elevatedY(p, z)",
    "articulated athlete": "function body650(ctx, o)",
    "articulated stride": "const stride=pose==='run'",
    "event poses": "window.__cdsVisualEvent",
    "goalkeeper punch": "pose==='punch'",
    "goalkeeper parry": "pose==='parry'",
    "unified set-piece stage": "function spStage25D(scene)",
    "stage identity": "stage:'CDS_F25D'",
    "draft rescue": "Reroll de emergência liberado",
    "touch targets": "min-height:44px",
    "portrait context": "orientation:portrait",
    "safe area": "safe-area-inset-left",
    "reduced motion": "prefers-reduced-motion:reduce",
    "forced colors": "forced-colors:active",
    "live region": "aria-live','polite'",
    "keyboard escape": "e.key==='Escape'",
    "cache reset": "reset:resetVisualCaches",
    "R12 auditor preserved": "getR12Audit",
    "pre-2.5D auditor preserved": "getPre25DAuditReport",
    "historical database preserved": "window.DATA =",
}

FORBIDDEN_REGEX = {
    "legacy set-piece perspective": r"\bspPerspective\b",
    "shot arcs disabled": r"const\s+aerial\s*=\s*!isShot\s*&&",
    "raw ball lift": r"const\s+bx\s*=\s*g0\.x\s*,\s*by\s*=\s*g0\.y\s*-\s*z\s*\*\s*22\s*\*\s*s\s*;",
    "raw trail lift": r"p\.y\s*-\s*\(tp\.z\s*\|\|\s*0\)\s*\*\s*22\s*\*\s*p\.s",
    "raw guide lift": r"g\.y\s*-\s*z\s*\*\s*22\s*\*\s*g\.s",
}


def main() -> int:
    text = TARGET.read_text(encoding="utf-8")
    checks, failed = [], []
    for name, needle in REQUIRED.items():
        ok = needle in text
        checks.append({"name": name, "ok": ok, "type": "required"})
        if not ok:
            failed.append(name)
    for name, pattern in FORBIDDEN_REGEX.items():
        ok = re.search(pattern, text) is None
        checks.append({"name": name, "ok": ok, "type": "forbidden-regex"})
        if not ok:
            failed.append(name)
    stripped = text.lstrip("\ufeff\r\n\t ")
    conflict_pattern = re.compile(r"(?m)^<<<<<<<\s+.+$|^=======$|^>>>>>>>\s+.+$")
    structural = {
        "standardsDoctypeAtStart": stripped.lower().startswith("<!doctype html>"),
        "singleBodyClose": text.lower().count("</body>") == 1,
        "singleHtmlClose": text.lower().count("</html>") == 1,
        "canvasPresent": 'id="fieldcv"' in text,
        "databaseObjectPresent": "window.DATA =" in text,
        "auditorsStillCallable": "getR12Audit" in text and "getPre25DAuditReport" in text,
        "noGitConflictMarkers": conflict_pattern.search(text) is None,
    }
    for name, ok in structural.items():
        checks.append({"name": name, "ok": ok, "type": "structural"})
        if not ok:
            failed.append(name)
    result = {
        "target": str(TARGET),
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "passed": len(checks) - len(failed),
        "total": len(checks),
        "failed": failed,
        "checks": checks,
        "verdict": "PASS_STATIC_FIXPACK" if not failed else "FAIL_STATIC_FIXPACK",
        "note": "Static PASS validates safeguards and absence of known blockers; final perceptual release still requires dynamic and human gates.",
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
