# Metodologia da Fase 3

## Princípio central

Uma partida usada para calibrar o motor deve percorrer o mesmo caminho lógico de uma partida vista pelo jogador. A bateria oficial usa passo fixo de **1/60 s**, correspondente ao acumulador do loop do navegador.

A primeira tentativa da fase mostrou que acelerar o relógio usando passos maiores alterava desarmes, faltas e cartões. Por isso, resultados obtidos em outro passo não são aceitos como calibração oficial.

## Matriz ampla

- 30 partidas de paridade, com elenco, estilo e formação iguais nos dois lados;
- 40 partidas aleatórias em pares espelhados;
- 40 confrontos entre equipes fortes e fracas em pares espelhados;
- 70 partidas de estilos, comparadas ao Equilibrado com o mesmo elenco e formação;
- 34 partidas de formação, comparadas ao 4-3-3.

Total da matriz ampla: **214 partidas completas de 90 minutos**.

## Revalidação de estilos

Depois da matriz ampla, os presets alterados são testados novamente em uma matriz ampliada e espelhada. Essa etapa mede simultaneamente:

- identidade estatística do estilo;
- equilíbrio de resultados;
- posse e precisão;
- volume ofensivo permitido e produzido;
- passes em profundidade, cruzamentos e recuperações por pressão;
- custo de energia.

## Reprodutibilidade

Toda partida possui seed, equipes, estilos, formações e variações salvos. O mesmo cenário pode ser repetido exatamente. Os elencos são clonados antes da partida para impedir contaminação entre execuções.

## Segurança de execução

O modo seguro grava checkpoints atômicos e retoma pelos IDs concluídos. O modo paralelo divide a matriz em pequenos lotes independentes, reduzindo o custo de inicialização sem reunir toda a execução em um único processo frágil.

## Interpretação

- Métricas globais e suítes com amostra suficiente podem orientar calibração.
- Intervalos de confiança são exibidos para deixar explícita a incerteza.
- Resultados individuais de uma formação com poucos jogos servem para detectar extremos e regressões, não para criar ranking definitivo.
- Uma mudança não é aprovada apenas por melhorar placares: ela também precisa preservar a identidade tática e passar nos testes estruturais.
