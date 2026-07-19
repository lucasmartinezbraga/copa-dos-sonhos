# Fase 3 — Changelog técnico

## Motor 4.3

- O laboratório usa exatamente o mesmo passo fixo de **1/60 s** utilizado pelo navegador.
- Passos diferentes são recusados em calibrações oficiais e só podem ser usados com a opção experimental explícita.
- A tentativa de desarme passou a usar taxa temporal (`1 - exp(-taxa × dt)`).
- O cooldown do desarme só começa depois de uma tentativa real. Antes, verificações sem bote também bloqueavam novas ações e tornavam o resultado dependente da frequência de atualização.
- Tiki-Taka, Contra-Ataque e Retranca receberam uma segunda calibração por confrontos espelhados contra o Equilibrado.
- A eficiência aérea de bolas paradas recebeu um ajuste leve depois de aparecer abaixo da faixa mínima da matriz 4.2.
- O modo de laboratório não retém heatmaps, mapas de passe ou eventos visuais desnecessários.
- Cada partida recebe cópias isoladas dos elencos, impedindo vazamento de fadiga, cartões, funções e caches entre simulações.

## Laboratório

- Execução headless com seed determinística.
- Matriz oficial com paridade, confrontos aleatórios, favorito contra azarão, estilos e formações.
- Confrontos espelhados para neutralizar mando lógico e ordem dos times.
- Checkpoint atômico e retomada por ID no modo sequencial seguro.
- Execução paralela em pequenos lotes no modo de validação acelerada.
- Intervalos de confiança de 95% para médias e proporções.
- Controle de viés entre lado A e lado B.
- Relatórios de estilos e formações exportáveis em CSV.
- Testes automáticos de determinismo, passo fixo, estrutura da matriz e limites de regressão.
