# Copa dos Sonhos — Fase 3 concluída

Motor de partidas **ADV4 4.3.2** calibrado por simulação determinística, com passo fixo de **1/60 s** e entrega final em um único HTML autocontido.

## Resultado oficial

- Matriz fixa: **214/214 partidas válidas**.
- Nota de calibração: **93,14/100**.
- Métricas fora da faixa: **0**.
- Estilos fora da identidade: **0**.
- Viés do lado A: **50,0%** das partidas decisivas.
- Gols: **2,90** por partida; chutes: **22,58**; escanteios: **5,90**; empates: **26,2%**.
- Regressão adicional: **3.200 partidas**, nota **93,16/100**, sem métricas ou estilos reprovados, no mesmo passo de 1/60 s.
- Banco preservado: **7.739 jogadores** e **13.284 escalações** validadas.

Os resultados completos estão em `reports/phase3/validation214-v43.json`, `reports/phase3/regression3200-v432-3200.json` e `reports/phase3/final/`.

## O que a Fase 3 entrega

- laboratório estatístico executável, paralelo e reproduzível;
- matriz oficial com paridade, confrontos espelhados, forte×fraco, estilos e 17 formações;
- passo fixo igual ao jogo real;
- determinismo por semente;
- intervalos de confiança de 95%;
- controle de viés de lado;
- calibração de gols, chutes, xG, cartões, escanteios e bolas paradas;
- identidade validada de Tiki-Taka, Pressão, Contra-Ataque, Jogo Direto, Alas e Retranca;
- regressão automática que bloqueia o fechamento quando qualquer critério oficial falha.

## Gerar e verificar

```bash
python3 tools/finalize_phase3.py
python3 tools/build.py
python3 tools/verify.py
```

Testes específicos:

```bash
node tests/phase3_determinism.js
node tests/phase3_fixed_step.js
node tests/phase3_job_matrix.js
node tests/phase3_regression_thresholds.js reports/phase3/validation214-v43.json
```

Reexecutar a bateria massiva:

```bash
python3 tools/run_lab_suite.py --matches 3200 --chunk-size 10 --parallel 8 --dt 0.016666666666666666 --label regression3200-v432 --mode full
```

O HTML final é `dist/COPA DOS SONHOS - FASE 3 - MOTOR CALIBRADO.html`. Edite apenas os módulos em `src/`; o arquivo em `dist/` é gerado pelo build.
