# Copa dos Sonhos — Fase 9 concluída — versão 5.2.1

## Estado

- **Fase:** 9 — Inteligência do treinador adversário
- **Versão funcional:** 5.2.1
- **Base imediata:** 5.1.0
- **Motor-base certificado:** 4.3.2
- **Passo fixo:** 1/60 s
- **Build:** `dist/COPA DOS SONHOS - FASE 9 - IA DO TREINADOR - V5.2.1.html`
- **Tamanho:** 1,367,390 bytes
- **SHA-256:** `ab2845d4951f26c03f533c5846ece7364ba5e5657123a99dbebd5ad4e94faf2e`

## Escopo 8.1 — Perfil do treinador

Cada treinador possui agressividade, tolerância a risco, adaptabilidade, preferência de pressão, preferência de posse, preferência defensiva e momento de substituição. Esses parâmetros alteram tempo de reação, limiar de evidência, persistência, tipo de resposta e propensão a substituir; não concedem bônus diretos ao time.

## Escopo 8.2 — Plano pré-jogo

A IA usa somente informações disponíveis no estado visível ou fornecidas como conhecimento público da Copa:

- formação com e sem bola;
- jogadores-chave;
- funções prováveis;
- velocidade;
- força aérea;
- pé dominante quando disponível, ou `unknown`;
- qualidade do goleiro com a bola;
- resultados recentes;
- fadiga;
- cartões;
- suspensões;
- lesões.

Informações ausentes permanecem explicitamente desconhecidas; a IA não inventa dados.

## Escopo 8.3 — Leitura durante a partida

Foram validados diagnósticos para:

- lado sobrecarregado e corredor vulnerável;
- linha alta vencida;
- meio-campo em inferioridade;
- ataque ou ponta desconectado;
- saída curta e distribuição do goleiro falhando;
- pressão ineficiente;
- cruzamentos perigosos;
- excesso de chutes ruins;
- jogador amarelado sob ataque;
- adversário amarelado vulnerável;
- fadiga crítica;
- baixa ocupação de zona;
- função incompatível;
- instruções conflitantes.

## Escopo 8.4 — Respostas

A IA pode:

- mudar formação com e sem bola;
- alterar função e dever individual;
- ajustar pressão, linha, largura, ritmo e postura;
- orientar pressão por setor;
- reforçar corredor;
- proteger ou explorar jogador amarelado;
- adicionar volante ou atacante por mudança estrutural;
- trocar tipo de cruzamento;
- alterar construção e distribuição do goleiro;
- proteger vantagem, buscar resultado e reagir a expulsão;
- fazer substituições físicas, táticas e disciplinares.

As alterações utilizam `setTeamInstructions`, `setAxes`, `setShapes`, `setPlayerPhaseRole` e `substitute`; não modificam diretamente a probabilidade de gol.

## Escopo 8.5 — Memória, avaliação e saves

Cada decisão registra:

- minuto;
- diagnóstico;
- evidências;
- jogadores e setores afetados;
- intensidade;
- configuração anterior e posterior;
- expectativa;
- métricas antes e depois;
- resultado positivo, negativo ou inconclusivo;
- decisão de manter, ajustar ou desfazer.

A IA registra também por que decidiu não agir. A memória possui cooldown, limite de cinco intervenções normais e seis em emergência. `exportManagerState()` e `importManagerState()` realizam round-trip de perfil, histórico, conhecimento, configuração, funções e avaliação pendente.

## Testes

### Complementação dirigida

- diagnósticos novos: aprovados;
- função e dever individual: aprovados;
- pressão dirigida: aprovada;
- tipo de cruzamento: aprovado;
- contexto público da Copa: aprovado;
- save round-trip: aprovado.

### Adaptação dirigida

- análises: 3;
- mudanças: 3;
- avaliações: 2;
- reversões: 1.

### Partida completa

- placar: 0–0;
- passos: 23820;
- estados inválidos: 0;
- análises: 12;
- mudanças: 5;
- avaliações: 5;
- motivos para não agir: 7.

### Regressão pareada — 8 partidas

- estados inválidos: **0**;
- gols por partida: **3.250**;
- chutes por partida: **25.375**;
- xG por partida: **3.509**;
- precisão de passe: **80.0%**;
- escanteios por partida: **5.000**;
- faltas por partida: **26.625**;
- mudanças do treinador por partida: **5.625**;
- substituições: **9**;
- diagnósticos: **270**.

Comparação com 5.1.0:

- gols: +4.0%;
- chutes: +7.4%;
- xG: +33.0%;
- precisão de passe: +0.5% relativo.

A amostra curta não apresentou ruptura estrutural, mas o aumento de xG deve continuar sendo observado em regressão massiva.

### Browser e mobile

Aprovado em:

- desktop 1366×768;
- mobile vertical 390×844;
- mobile horizontal 844×390;
- zero erros de página;
- zero erros de console;
- zero overflow horizontal;
- 7.739 jogadores preservados.

## Limite conhecido

A 5.2.1 é uma **build funcional validada**, não uma nova certificação estatística massiva. A certificação de 3.200 partidas continua pertencendo ao motor-base 4.3.2.
