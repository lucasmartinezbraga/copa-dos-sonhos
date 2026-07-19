# Copa dos Sonhos — Fase 8 concluída

## Versão

- **Versão funcional:** 5.1.0
- **Fase:** 8 — Goleiros e bolas paradas
- **Base imediata:** Build 5.0.0 das Fases 4–7
- **Motor-base certificado:** 4.3.2
- **Passo fixo:** 1/60 s
- **Branch:** `agent/fase-8-goleiros-bolas-paradas`
- **Build:** `dist/COPA DOS SONHOS - FASE 8 - GOLEIROS E BOLAS PARADAS - V5.1.0.html`
- **SHA-256:** `e36ad25d177b67dd2274f2e338564f0d837b09aee16a6f50d1c01019b4535cae`

## Objetivo

Transformar goleiros e bolas paradas em sistemas contextuais, rastreáveis e ligados ao estado real da partida. A fase preserva o princípio do projeto: o placar emerge dos lances simulados; nenhuma rotina predetermina o resultado.

## Implementação

### 1. Resolução contextual de defesas

Todos os caminhos relevantes de finalização passam pelo resolvedor contextual do goleiro:

- chute comum;
- um contra um;
- cabeceio;
- cruzamento rasteiro;
- falta direta.

A defesa pode terminar em:

- defesa segura;
- espalmada para escanteio;
- rebote lateral vivo;
- rebote central vivo.

O rebote usa `_looseBall()`, portanto volta ao estado real do campo e é disputado pelos dois times.

### 2. Saídas em profundidade

A saída do goleiro deixou de ser sucesso automático. O sistema separa:

1. decisão de sair;
2. execução técnica;
3. consequência.

A decisão considera função, distância e capacidade no um contra um. A execução considera atributos de saída e aceleração. Quando falha, o goleiro permanece fora da posição por uma janela de 2,5 segundos e o atacante recebe uma oportunidade real contra o gol vulnerável.

### 3. Cruzamentos e domínio de área

Em bolas aéreas, o goleiro pode:

- permanecer fora da disputa;
- tentar dominar;
- agarrar;
- socar;
- errar a saída.

O resultado confronta domínio de área, saída, reflexos e segurança contra a ameaça aérea e a pressão do atacante.

### 4. Distribuição do goleiro

Foram adicionadas decisões e métricas separadas para:

- reposição curta;
- reposição longa;
- reposição completa;
- reposição falha;
- erro sob pressão.

Os erros continuam produzindo bola viva, e não apenas texto narrativo.

### 5. Escanteios ofensivos

Rotinas disponíveis:

- primeiro poste;
- segundo poste;
- marca do pênalti;
- curto.

Os jogadores recebem responsabilidades transitórias explícitas:

- cobrador;
- alvo principal;
- alvo secundário;
- segunda bola;
- rebote;
- cobertura;
- opção curta.

### 6. Escanteios defensivos

Estruturas disponíveis:

- zonal;
- individual;
- mista.

Defensores recebem papéis de zona, marcação, cobertura de rebote e preparação para contra-ataque. A estrutura modifica posições reais antes da cobrança.

### 7. Faltas

A IA pode escolher:

- cobrança direta;
- cobrança cruzada;
- passe curto.

A escolha considera distância, qualidade do cobrador e vantagem aérea. O minigame do usuário permanece associado à cobrança direta, preservando a interface existente.

### 8. Pênaltis

Foram auditadas e instrumentadas:

- cobranças realizadas;
- gols;
- defesas;
- erros para fora;
- decomposição obrigatória de todos os resultados.

A física e os atributos existentes foram preservados.

### 9. Estatísticas e interface

A tela de estatísticas passou a mostrar blocos próprios para:

- defesas seguras;
- espalmadas;
- rebotes;
- saídas certas e falhas;
- cruzamentos dominados;
- socos;
- reposições;
- finalizações e gols de bola parada;
- primeiro contato;
- faltas diretas e cruzadas;
- escanteios curtos;
- pênaltis convertidos.

Também foram incluídas narrações para socos do goleiro, falhas de saída e tipos de escanteio.

### 10. API da Fase 8

O módulo `src/scripts/46-phase8-goalkeepers-setpieces.js` expõe:

```js
window.CDS_PHASE8.VERSION === "5.1.0"
```

E fornece `getPhase8Data(team)` com dados estruturados de goleiro e bola parada.

## Testes automatizados

### Defesas contextuais

Arquivo: `tests/phase8_gk_saves.js`

Resultado em três partidas:

- chutes enfrentados: 31;
- defesas seguras: 15;
- espalmadas: 16;
- rebotes vivos: 6;
- decomposição consistente;
- determinismo aprovado.

### Goleiros e bolas paradas

Arquivo: `tests/phase8_goalkeepers_setpieces.js`

Cobertura validada:

- quatro rotinas ofensivas de escanteio;
- três estruturas defensivas;
- faltas diretas, cruzadas e curtas;
- 30 pênaltis: 23 gols, 6 defesas e 1 erro;
- 80 saídas aéreas: 42 dominadas, 10 socos e 28 erros;
- falha determinística de saída em profundidade;
- 240 tentativas de distribuição e 235 resultados finalizados;
- determinismo preservado.

### Disputa por pênaltis

Arquivo: `tests/phase8_penalty_shootout.js`

- ordem dos cobradores definida pelo atributo de pênalti;
- goleiros não aparecem antes dos jogadores de linha;
- encerramento antecipado das cinco cobranças validado;
- morte súbita produz vencedor;
- mesma seed produz a mesma ordem e os mesmos resultados;
- cenário validado: 4–2 em oito cobranças.

### Partida completa

Arquivo: `tests/phase8_live_match.js`

- versão: 5.1.0;
- placar: 3–1;
- passos: 24.275;
- estados inválidos: 0;
- métricas de goleiro e bola parada válidas;
- decomposição de defesas, saídas e pênaltis aprovada.

### Regressão funcional final

Arquivo: `reports/phase8/regression8-v510.json`

Oito partidas completas em passo 1/60:

- estados inválidos: 0;
- gols por partida: 3,125;
- chutes por partida: 23,625;
- xG por partida: 2,638;
- chutes no alvo: 39,7%;
- precisão de passe: 79,5%;
- escanteios por partida: 4,25;
- faltas por partida: 25,375;
- finalizações de bola parada por partida: 3,5;
- participação de gols de bola parada: 12%;
- 50 defesas enfrentadas: 26 seguras e 24 espalmadas;
- 9 rebotes vivos;
- 24 saídas em profundidade certas e 2 falhas;
- 34 saídas aéreas: 27 dominadas, 4 socos e 3 erros;
- 308 reposições certas e 68 falhas.

### Verificação integral

`python tools/verify.py` aprovado:

- manifesto e módulos íntegros;
- JavaScript válido;
- banco com 7.739 jogadores preservado;
- 13.284 escalações preservadas;
- determinismo aprovado;
- passo fixo aprovado;
- matriz oficial de 214 partidas preservada;
- regressão certificada de 3.200 partidas da base preservada.

### Smoke test visual

Arquivo: `tests/phase8_browser_smoke.py`

Viewports testados:

- desktop: 1366×768;
- celular vertical: 390×844;
- celular horizontal: 844×390.

Resultados:

- zero erros de página;
- zero erros de console;
- zero overflow horizontal;
- HTML autocontido carregado;
- módulo 5.1.0 presente;
- partida completa executada no Chromium;
- 7.739 jogadores disponíveis.

## Limites conhecidos

A tentativa de executar a regressão final de 100 partidas pelo runner paralelo não terminou dentro da janela de execução. Por isso, a versão 5.1.0 é declarada como **build funcional validada**, mas não como nova certificação estatística massiva.

A certificação estatística de 3.200 partidas continua válida para o motor-base 4.3.2. A regressão funcional final da camada 5.1.0 possui oito partidas completas e os testes direcionados cobrem os ramos raros de pênaltis, saídas, socos e rotinas de bola parada.

Na amostra funcional de oito partidas, a rotina automática de escanteio curto não ocorreu naturalmente. Ela foi validada diretamente no teste de rotinas, incluindo posicionamento, passe curto e continuidade da bola.

## Definition of Done

- [x] código integrado ao motor;
- [x] rebotes e segundas bolas reais;
- [x] decisões contextuais de goleiro;
- [x] rotinas ofensivas e defensivas de escanteio;
- [x] rotinas de falta;
- [x] auditoria de pênaltis e disputa por pênaltis;
- [x] métricas estruturadas;
- [x] estatísticas na interface;
- [x] testes automatizados;
- [x] determinismo;
- [x] partida completa;
- [x] regressão funcional;
- [x] desktop;
- [x] mobile vertical;
- [x] mobile horizontal;
- [x] build autocontida;
- [x] manifesto;
- [x] relatório;
