# Copa dos Sonhos

Simulador de futebol histórico em HTML único, construído para montar seleções de diferentes Copas do Mundo e disputar partidas em um motor próprio de futebol.

[**Jogar no navegador**](https://lucasmartinezbraga.github.io/copa-dos-sonhos/)

## Estado atual

| Frente | Versão / situação |
|---|---|
| Build pública no GitHub Pages | **5.0.0** |
| Baseline atual de desenvolvimento | **R18.50 — Preservar Energia** |
| Rodada técnica em andamento | **OS-05A — censo do corte aéreo efetivo** |
| Situação da OS-05A | Instrumentação observacional; ainda depende das baterias de medição e **não está promovida** |

A R18.50 é a referência da linhagem atual. A OS-05A foi adicionada exclusivamente para investigar a baixa geração de escanteios sem alterar o comportamento da partida. Ela não substitui a versão jogável publicada.

## O jogo

- draft de jogadores e seleções históricas;
- elencos de diferentes edições de Copa do Mundo;
- formações, mentalidade, funções e ajustes táticos;
- partidas em campo 2.5D;
- atributos e perfis individuais influenciando decisões;
- bolas paradas, goleiros e inteligência do treinador adversário;
- interface para desktop e celular;
- entrega jogável em um único arquivo HTML.

## Arquivos principais

- `docs/index.html`: versão jogável publicada no GitHub Pages;
- `dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html`: baseline atual de desenvolvimento;
- `dist/COPA DOS SONHOS - R18.50 - OS05A CENSO.html`: build instrumental da rodada OS-05A;
- `reports/r1851/RODADA_OS05A.md`: mecanismo, hipótese, previsão anterior à medição, gates e armadilhas;
- `tools/r1851/`: patch reproduzível e diagnóstico da OS-05A;
- `src/`: código modular do projeto;
- `tests/` e `tools/`: validações, auditorias e laboratórios.

## Rodada atual — OS-05A

O objetivo imediato é entender o destino real dos cortes no primeiro contato aéreo antes de propor outra alteração comportamental para o gate de escanteios.

A rodada:

- separa jogada corrida de bola parada;
- distingue posse limpa, bola viva e trajetórias para as linhas;
- observa o resultado depois das sobrescritas efetivas de `_turnover`;
- não usa RNG e não altera posse, trajetória ou estatísticas;
- exige 48 partidas em cada uma das três bases de semente antes da próxima decisão.

Leia o relatório completo em [`reports/r1851/RODADA_OS05A.md`](reports/r1851/RODADA_OS05A.md).

## Desenvolvimento

Para reconstruir e verificar a estrutura modular:

```bash
python3 tools/build.py
python3 tools/verify.py
python3 tests/browser_smoke.py
```

A versão em `docs/` é a publicada. As builds instrumentais em `dist/` só devem ser promovidas depois de passarem pelos gates e pelas baterias previstas.
