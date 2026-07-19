# Copa dos Sonhos — versão atual 5.2.0

Esta é a versão funcional concluída da **Fase 9 — Inteligência do treinador adversário**.

## Base

- motor-base certificado: 4.3.2;
- Fases 4–7: camada 5.0.0;
- Fase 8: camada 5.1.0;
- Fase 9: camada 5.2.0;
- passo fixo: 1/60 s;
- banco: 7.739 jogadores e 13.284 escalações.

## Principais sistemas

- perfis determinísticos de treinador;
- plano pré-jogo baseado no adversário;
- leitura contextual da partida;
- limiar de evidência e memória tática;
- alterações de formação, instruções e corredores;
- substituições físicas, táticas e disciplinares;
- avaliação posterior das mudanças;
- reversão de decisões ruins;
- painel e API da IA do treinador.

## Build

```text
dist/COPA DOS SONHOS - FASE 9 - IA DO TREINADOR - V5.2.0.html
```

SHA-256:

```text
315fcc3a2fcd708772e0bdeaed5c4b8e9dabca05d3406602c3fec17cd620018e
```

## Validação

```bash
node tests/phase9_manager_profiles.js
node tests/phase9_adaptation.js
node tests/phase9_live_match.js
node tests/phase9_regression8.js
python3 tests/phase9_browser_smoke.py
python3 tools/verify.py
python3 tools/build_phase9.py
```

Relatório completo:

```text
reports/phase9/FASE_9_RELATORIO.md
```

A camada 5.2.0 é uma build funcional validada. A certificação estatística massiva continua pertencendo ao motor-base 4.3.2, cuja regressão oficial possui 3.200 partidas.
