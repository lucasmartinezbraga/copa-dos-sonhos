# Copa dos Sonhos — versão atual 4.3.2

Esta é a versão final da **Fase 3 — Laboratório estatístico e calibração do motor**.

## Estado da Fase 3

**Concluída.** O motor 4.3.2 passou pela matriz oficial de 214 partidas em passo fixo de 1/60 s, sem métricas ou estilos fora dos critérios. A regressão adicional de 3.200 partidas obteve 93,16/100, também sem reprovações, usando o mesmo motor e o mesmo passo.

### Evidências principais

- matriz oficial: 214/214 partidas;
- nota: 93,14/100;
- métricas reprovadas: 0;
- identidades táticas reprovadas: 0;
- lado A em jogos decisivos: 50,0%;
- determinismo e passo fixo: aprovados;
- banco: 7.739 jogadores e 13.284 escalações validadas.

## Conteúdo

- HTML autocontido jogável em `dist/COPA DOS SONHOS - FASE 3 - MOTOR CALIBRADO.html`;
- código-fonte modular em `src/`;
- metas em `calibration/targets.json`;
- relatório oficial em `reports/phase3/validation214-v43.json`;
- regressão massiva em `reports/phase3/regression3200-v432-3200.json`;
- relatório legível e CSVs em `reports/phase3/final/`;
- manifesto de conclusão em `manifests/phase3-qa.json`.

## Verificação integral

```bash
python3 tools/finalize_phase3.py
python3 tools/build.py
python3 tools/verify.py
```
