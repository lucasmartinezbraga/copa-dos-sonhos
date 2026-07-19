# Copa dos Sonhos — Fase 9 concluída

## Versão

- **Versão funcional:** 5.2.0
- **Fase:** 9 — Inteligência do treinador adversário
- **Base imediata:** Build 5.1.0 da Fase 8
- **Motor-base certificado:** 4.3.2
- **Passo fixo:** 1/60 s
- **Branch:** `agent/fase-9-ia-treinador`
- **Build:** `dist/COPA DOS SONHOS - FASE 9 - IA DO TREINADOR - V5.2.0.html`
- **Tamanho:** 1.347.742 bytes
- **SHA-256:** `315fcc3a2fcd708772e0bdeaed5c4b8e9dabca05d3406602c3fec17cd620018e`

## Objetivo

Substituir a reação simples baseada apenas em minuto e placar por um treinador que observa evidências reais, escolhe intervenções coerentes com seu perfil, mantém memória do que já tentou e avalia o efeito das próprias decisões.

O sistema não consulta resultados futuros e não altera diretamente probabilidades de gol. Toda intervenção utiliza os mesmos mecanismos disponíveis ao usuário: instruções coletivas, eixos, formações, funções e substituições.

## Auditoria da IA anterior

A versão anterior já conseguia:

- atacar quando perdia depois dos 60 minutos;
- defender quando vencia com vantagem;
- realizar uma substituição ofensiva;
- deslocar defensores para um lado muito atacado.

As limitações encontradas foram:

- nenhuma identidade de treinador;
- plano pré-jogo inexistente;
- leitura concentrada em placar e minuto;
- ausência de limiar de evidência;
- ausência de memória;
- nenhuma avaliação posterior;
- substituições pouco contextuais;
- risco de repetição da mesma resposta;
- nenhuma explicação estruturada da decisão.

## Arquitetura

A Fase 9 foi implementada em:

```text
src/scripts/47-phase9-manager-ai.js
```

O módulo estende o `MatchSim` sem reescrever o motor. Ele integra-se aos sistemas já existentes por meio de:

- `_buildTeam()` — cria perfil e memória;
- `_blankStats()` — adiciona métricas;
- `setInteractive()` — gera o plano pré-jogo do adversário;
- `_aiReact()` — executa a nova leitura contextual;
- `setTeamInstructions()` — altera instruções da Fase 6;
- `setAxes()` — altera linha, pressão, largura, ritmo e postura;
- `setShapes()` — altera formas com e sem bola;
- `substitute()` — realiza trocas reais;
- `getAdvancedData()` e `getState()` — expõem os dados.

## Perfis de treinador

Foram adicionados quatro arquétipos:

### Pragmático

- maior preferência defensiva;
- tolerância moderada a risco;
- valoriza controle de espaço e proteção do placar.

### Agressivo

- pressão e risco elevados;
- reage mais cedo quando precisa atacar;
- aceita maior exposição.

### Controlador

- preferência por posse;
- busca superioridade no meio;
- prioriza qualidade das chances.

### Adaptável

- menor limiar de evidência;
- avalia mudanças mais cedo;
- maior probabilidade de desfazer intervenções ruins.

A derivação do perfil usa hash determinístico de equipe e estilo. Não consome o gerador de aleatoriedade da partida.

## Plano pré-jogo

A IA analisa:

- formação adversária;
- estilo;
- velocidade média dos jogadores ofensivos;
- ameaça aérea;
- perfil do próprio treinador.

O plano registra:

- preset escolhido;
- motivo;
- evidências observadas;
- adversário analisado;
- resultado esperado.

Perfis diferentes produzem planos diferentes. O teste validou, por exemplo:

- perfil agressivo → `highPress`;
- perfil controlador → `possession`.

## Diagnósticos durante a partida

O treinador pode identificar:

- inferioridade numérica;
- desvantagem tardia;
- vantagem a proteger;
- sobrecarga pelo corredor esquerdo ou direito;
- linha alta exposta;
- inferioridade no meio-campo;
- atacante isolado;
- saída curta falhando;
- pressão ineficiente;
- finalizações de baixa qualidade;
- fadiga coletiva;
- risco disciplinar;
- ameaça aérea;
- conflitos táticos.

Cada diagnóstico contém código, gravidade, descrição, evidências e objetivo.

## Decisão e memória

A IA não executa toda resposta disponível. As candidatas são avaliadas por:

- gravidade do problema;
- limiar de evidência do perfil;
- tolerância a risco;
- preferência defensiva ou de posse;
- tempo desde a última mudança;
- histórico recente da mesma ação;
- intervenção ainda em avaliação.

A memória impede alternância aleatória e repetição em intervalos curtos.

Cada decisão registra:

- minuto;
- diagnóstico;
- evidências;
- gravidade;
- ação;
- expectativa;
- substituição, quando houver;
- avaliação posterior;
- reversão, quando houver.

## Avaliação posterior

Depois de uma janela definida pelo perfil, o treinador compara métricas anteriores e posteriores:

- xG criado;
- xG sofrido;
- finalizações criadas;
- finalizações sofridas;
- posse na janela.

O resultado é classificado como:

- positivo;
- negativo;
- inconclusivo.

Treinadores adaptáveis podem restaurar a configuração anterior quando a intervenção é claramente negativa. O teste direcionado confirmou uma reversão completa.

## Alterações possíveis

A IA pode:

- selecionar presets;
- ajustar pressão, linha, largura, ritmo e postura;
- alterar formação com bola;
- alterar formação sem bola;
- reforçar corredor defensivo;
- impedir cruzamentos;
- proteger a área;
- aproximar o ataque;
- adicionar presença no meio;
- contornar pressão;
- reduzir desgaste;
- trabalhar melhor as chances;
- proteger vantagem;
- buscar empate ou virada;
- reorganizar o time após expulsão.

## Substituições

Foram adicionadas trocas por:

- necessidade ofensiva;
- necessidade defensiva;
- fadiga;
- risco disciplinar.

A escolha considera:

- linha e compatibilidade do reserva;
- overall;
- nota;
- stamina;
- cartão;
- objetivo tático.

A IA mantém intervalo mínimo entre trocas e limita-se a três substituições autônomas, sem impedir substituições obrigatórias por lesão.

## Interface e API

A build inclui o painel:

```text
IA DO TREINADOR 5.2
```

Ele mostra:

- perfil;
- atributos do treinador;
- diagnóstico atual;
- histórico recente;
- expectativa;
- avaliação;
- métricas agregadas.

API:

```js
window.CDS_PHASE9.VERSION === "5.2.0"
sim.getManagerData(team)
```

Os dados também aparecem em:

```js
sim.getAdvancedData(team).phase9
sim.getState().phase9
```

## Testes automatizados

### Perfis e plano pré-jogo

Arquivo:

```text
tests/phase9_manager_profiles.js
```

Validado:

- perfil derivado determinístico;
- plano determinístico;
- perfil explícito preservado;
- planos diferentes por perfil;
- plano pré-jogo contabilizado.

### Adaptação dirigida

Arquivo:

```text
tests/phase9_adaptation.js
```

Resultado:

- 3 análises;
- 6 diagnósticos;
- 3 mudanças;
- 2 substituições;
- 2 avaliações;
- 1 avaliação positiva;
- 1 avaliação negativa;
- 1 reversão;
- memória e cooldown aprovados.

### Partida completa

Arquivo:

```text
tests/phase9_live_match.js
```

Resultado determinístico:

- placar: 2–0;
- 23.859 passos;
- 15 análises;
- 22 diagnósticos;
- 7 mudanças;
- 2 substituições;
- 6 avaliações;
- 1 reversão;
- 0 estados inválidos.

### Regressão pareada de 8 partidas

Arquivo:

```text
tests/phase9_regression8.js
```

As mesmas oito partidas, seeds, equipes, formações, estilos e presets da regressão 5.1.0 foram utilizadas.

Resultados 5.2.0:

- estados inválidos: **0**;
- gols por partida: **2,500**;
- chutes por partida: **22,000**;
- xG por partida: **2,337**;
- chutes no alvo: **39,2%**;
- precisão de passe: **78,7%**;
- escanteios por partida: **4,125**;
- faltas por partida: **24,125**;
- análises da IA: **120**;
- diagnósticos: **97**;
- mudanças: **35**;
- substituições: **12**;
- avaliações: **25**;
- positivas: **6**;
- negativas: **15**;
- inconclusivas: **4**.

Comparação pareada com 5.1.0:

- gols: **−20,0%**;
- chutes: **−6,9%**;
- xG: **−11,4%**;
- chutes no alvo: **−0,5 ponto percentual**;
- precisão de passe: **−0,8 ponto percentual**;
- escanteios: **−2,9%**;
- faltas: **−4,9%**.

A amostra indica partidas um pouco mais controladas, sem ruptura estrutural nos indicadores de volume, precisão ou disciplina. A queda de gols está no limite superior aceitável para uma amostra curta e deve continuar sendo observada em regressão massiva.

### Compatibilidade da Fase 8

Continuaram passando:

- defesas contextuais;
- rebotes vivos;
- saídas e domínio aéreo;
- rotinas de bola parada;
- pênaltis.

### Browser e mobile

Arquivo:

```text
tests/phase9_browser_smoke.py
```

Aprovado em:

- desktop 1366×768;
- mobile vertical 390×844;
- mobile horizontal 844×390.

Resultados:

- zero erros de página;
- zero erros de console;
- zero overflow horizontal;
- botão da IA presente;
- partida 5.2.0 completa no Chromium;
- 7.739 jogadores preservados.

## Integridade

`python3 tools/verify.py` confirmou:

- 7.739 jogadores;
- 13.284 escalações;
- zero escalações inválidas;
- zero cruzamentos posicionais absurdos;
- dados e build-base íntegros.

## Limites conhecidos

A Fase 9 possui regressão funcional pareada de oito partidas, mas ainda não possui certificação estatística massiva própria. A certificação de 3.200 partidas continua pertencendo ao motor-base 4.3.2.

O próximo laboratório de longa duração deve observar principalmente:

- queda de gols em relação à 5.1.0;
- frequência de mudanças por treinador;
- eficácia por arquétipo;
- taxa de reversão;
- comportamento em expulsões;
- substituições em prorrogação.

## Definition of Done

- implementação integrada: **aprovada**;
- perfis de treinador: **aprovados**;
- plano pré-jogo: **aprovado**;
- leitura contextual: **aprovada**;
- memória: **aprovada**;
- avaliação posterior: **aprovada**;
- reversão: **aprovada**;
- substituições: **aprovadas**;
- estatísticas e API: **aprovadas**;
- interface: **aprovada**;
- determinismo: **aprovado**;
- compatibilidade com Fase 8: **aprovada**;
- desktop e mobile: **aprovados**;
- build autocontida: **aprovada**;
- certificação estatística massiva da camada: **pendente**.
