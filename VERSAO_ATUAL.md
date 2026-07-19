# Copa dos Sonhos — versão atual 4.3.2

Este pacote contém a versão mais atual existente do projeto no momento da entrega.

## Conteúdo

- HTML autocontido jogável em `dist/`.
- Código-fonte modular em `src/`.
- Banco V3 com 7.739 jogadores.
- Motor ADV4 4.3.2.
- Ferramentas de build e verificação em `tools/`.
- Testes automatizados em `tests/`.
- Metas e relatórios do laboratório em `calibration/` e `reports/`.
- Baseline congelado em `reference/`.

## Estado da Fase 3

A infraestrutura e as calibrações mais recentes estão incluídas. A Fase 3 ainda não foi declarada encerrada porque a revalidação estatística final do motor 4.3.2 continua pendente. O código entregue é, entretanto, a versão mais atual do jogo.

## Gerar o HTML

```bash
python3 tools/build.py
```

## Verificações básicas

```bash
node --check src/scripts/40-match-engine-and-manager-ai.js
node tests/phase3_determinism.js
node tests/phase3_fixed_step.js
```
