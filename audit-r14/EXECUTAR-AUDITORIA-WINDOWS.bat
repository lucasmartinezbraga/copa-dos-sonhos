@echo off
setlocal
cd /d %~dp0
python -m pip install -r requirements-auditoria.txt
python -m playwright install chromium
python scripts\run_all.py
pause
