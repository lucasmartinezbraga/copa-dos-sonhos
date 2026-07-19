# Fase 9 — Changelog

## 5.2.0

### Perfis de treinador

- adiciona quatro arquétipos: pragmático, agressivo, controlador e adaptável;
- adiciona agressividade, tolerância a risco, adaptabilidade, preferência de pressão, posse, defesa e momento de substituição;
- deriva perfis de forma determinística, sem consumir o RNG da partida;
- permite perfil explícito por equipe.

### Plano pré-jogo

- analisa formação, estilo, velocidade ofensiva e ameaça aérea do adversário;
- seleciona plano inicial coerente com o perfil;
- registra evidências, expectativa e instruções adotadas;
- utiliza somente informações disponíveis ao treinador.

### Leitura durante a partida

- detecta desvantagem e vantagem tardias;
- identifica sobrecarga lateral;
- identifica linha alta exposta;
- identifica inferioridade no meio-campo;
- identifica ataque isolado e finalizações ruins;
- identifica falha na saída, pressão ineficiente, fadiga, cartões e ameaça aérea;
- considera coerência das instruções.

### Adaptação e memória

- adiciona limiar de evidência por perfil;
- impede alterações repetitivas em intervalos curtos;
- registra diagnóstico, ação, minuto, evidências e resultado esperado;
- avalia as métricas após cada mudança;
- classifica avaliações como positivas, negativas ou inconclusivas;
- permite que treinadores adaptáveis desfaçam mudanças claramente ruins.

### Alterações e substituições

- altera presets, eixos, formações com e sem bola e corredores defensivos;
- reforça o lado sob sobrecarga;
- protege vantagem ou busca resultado conforme contexto;
- realiza substituições táticas, físicas e disciplinares;
- limita a três substituições autônomas por treinador para evitar trocas excessivas.

### Interface e API

- adiciona painel “IA DO TREINADOR 5.2”;
- mostra perfil, diagnóstico, histórico, expectativas e avaliações;
- adiciona `window.CDS_PHASE9`;
- adiciona `getManagerData(team)` e dados da Fase 9 em `getAdvancedData()` e `getState()`.

### Engenharia e QA

- adiciona módulo `src/scripts/47-phase9-manager-ai.js`;
- adiciona build autocontida 5.2.0;
- adiciona testes de perfis, adaptação, memória, reversão, partida completa e regressão pareada;
- preserva Fases 4–8, banco, determinismo e passo fixo de 1/60 s.
