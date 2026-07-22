$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python -m pip install -r requirements-auditoria.txt
try { python -m playwright install chromium } catch { Write-Warning "Chromium do Playwright não foi baixado; o script tentará Chrome/Edge do sistema." }
python scripts/run_all.py
Write-Host "Etapa automática inicial concluída. Consulte 00-LEIA-ME.md e PLANO-DE-EXECUCAO-R14.md."
