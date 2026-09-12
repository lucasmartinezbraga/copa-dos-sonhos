# PACOTE DE AUDITORIA MESTRA R14 — 800 ITENS

Este pacote transforma a auditoria anterior em um protocolo de liberação completo para o **Motor Vivo 2.5D**.

## O que existe aqui

- `docs/`: documento oficial de auditoria.
- `matriz/`: matriz operacional em XLSX, CSV e JSON.
- `candidate/`: HTML de partida usado como ponto de partida. **Não está aprovado.**
- `scripts/`: coleta de identidade, auditoria estática, smoke real em quatro viewports, integração com a sonda de trava, consolidação e gate de release.
- `templates/`: modelos de evidência, observação humana e mobile.
- `evidence/`: destino de todas as evidências por ID.
- `references/`: auditorias e relato anterior.

## Identidade do ponto de partida

- Arquivo: `COPA DOS SONHOS - RC-UX - MOBILE BUTTON FIX.html`
- Bytes: 1.720.780
- SHA-256: `08716e3df6f7a08a052090343ef79d13551aea3fee7d4f2669788f51546b492f`
- Classificação: **PONTO DE PARTIDA NÃO APROVADO**

## Como executar no Windows

1. Extraia o ZIP dentro do repositório `copa-dos-sonhos` ou copie a pasta para a raiz do repositório.
2. Execute `EXECUTAR-AUDITORIA-WINDOWS.bat`.
3. Para testes de navegador, o instalador pedirá Python Playwright e Chromium.
4. Preencha os controles humanos/mobile no XLSX e coloque evidências em `evidence/<dominio>/<ID>/`.
5. Execute `scripts/release_gate.py` para obter APROVADO ou BLOQUEADO.

## Regra central

Nenhum item recebe PASS apenas porque há uma função ou pose no código. O comportamento precisa existir no campo, ser reproduzível e ter evidência vinculada ao mesmo SHA-256.
