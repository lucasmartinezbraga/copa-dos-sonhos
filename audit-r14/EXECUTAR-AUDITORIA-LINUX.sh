#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m pip install -r requirements-auditoria.txt
python3 -m playwright install chromium
python3 scripts/run_all.py
