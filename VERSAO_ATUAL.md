# Copa dos Sonhos — versão atual 5.1.0

Esta é a versão funcional concluída da **Fase 8 — Goleiros e bolas paradas**.

## Base

- motor-base certificado: 4.3.2;
- Fases 4–7: camada 5.0.0;
- Fase 8: camada 5.1.0;
- passo fixo: 1/60 s;
- banco: 7.739 jogadores e 13.284 escalações.

## Principais sistemas

- defesas seguras, espalmadas e rebotes vivos;
- saídas em profundidade com risco real;
- domínio, soco e erro em cruzamentos;
- distribuição curta e longa do goleiro;
- quatro rotinas ofensivas de escanteio;
- três estruturas defensivas de escanteio;
- faltas diretas, cruzadas e curtas;
- pênaltis instrumentados;
- estatísticas e API próprias da Fase 8.

## Build

```text
 dist/COPA DOS SONHOS - FASE 8 - GOLEIROS E BOLAS PARADAS - V5.1.0.html
```

SHA-256:

```text
e36ad25d177b67dd2274f2e338564f0d837b09aee16a6f50d1c01019b4535cae
```

## Validação

```bash
node tests/phase8_gk_saves.js
node tests/phase8_goalkeepers_setpieces.js
node tests/phase8_live_match.js
node tests/phase8_regression8.js
python tests/phase8_browser_smoke.py
python tools/verify.py
python tools/build_phase8.py
```

Relatório completo:

```text
reports/phase8/FASE_8_RELATORIO.md
```

A camada 5.1.0 é uma build funcional validada. A certificação estatística massiva continua pertencendo ao motor-base 4.3.2, cuja regressão oficial possui 3.200 partidas.
