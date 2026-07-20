# Fase 10 — Persistência da Copa — Relatório de entrega 5.3.0

## 1. Baseline

- Fonte: snapshot exato do head `f3f134b87c044b35c869e9860bfa54f1a3d01ecd` do PR #5.
- Branch local: `agent/fase-10-persistencia-copa`.
- Versão-pai: 5.2.2.
- Motor-base certificado: 4.3.2.
- Passo fixo: 1/60 s.
- Banco preservado: 7.739 jogadores e 13.284 escalações.

## 2. Objetivo

Fazer cada partida produzir consequências reais e persistentes para a próxima, sem criar moral ou química como bônus mágicos.

## 3. Sistemas implementados

### Condição e fadiga

A condição inicial da partida vem do estado persistente do atleta. Minutos jogados, stamina final e prorrogação geram carga. Reservas e jogadores pouco utilizados se recuperam mais entre partidas.

### Lesões e indisponibilidade

Lesões geram duração determinística de uma a quatro partidas, influenciada pela condição final. Titulares indisponíveis são substituídos pelo melhor jogador disponível compatível com a posição. Reservas indisponíveis também cumprem corretamente a duração.

### Cartões e suspensões

Amarelos persistem na Copa. Dois amarelos acumulados geram uma partida de suspensão; vermelho também gera suspensão. O contador é consumido somente quando a equipe disputa uma partida sem o atleta.

### Forma, confiança e sequência

A forma usa as cinco notas mais recentes. A confiança é contextual e limitada: decisão, finalização e defesa. A sequência de gols registra partidas consecutivas marcando, sem bônus genérico de moral.

### Adaptação à função

Cada combinação de posição, função e foco possui familiaridade própria. Minutos na função e treino tático aumentam gradualmente a familiaridade, que afeta apenas leitura e execução de forma limitada.

### Pressão do mata-mata

O contexto é definido pela partida atual — grupos, oitavas, quartas, semifinal ou final — e entra na importância do lance. Não existe handicap para usuário ou IA.

### Preparação entre jogos

| Escolha | Efeito transparente |
|---|---|
| Recuperação física | +12 de condição e −8 de fadiga acumulada |
| Treino tático | +6% de familiaridade nas funções atuais e até +1,2% de execução |
| Bolas paradas | +3,5% de execução em faltas, escanteios e pênaltis |
| Finalização | +2,5% de execução dos chutes |
| Preparação defensiva | +2,5% em pressão, cobertura e duelos defensivos |

A IA escolhe automaticamente de acordo com condição média e rotação determinística de prioridades.

## 4. Arquitetura

- Novo módulo puro: `src/scripts/49-phase10-cup-persistence.js`.
- Save V3: `src/scripts/48-save-contract.js`.
- Integração do motor: `40-match-engine-and-manager-ai.js`.
- Integração do torneio: `50-tournament.js`.
- Interface e save: `60-ui-flow.js`.
- Captura pós-jogo: `70-game-runtime-and-rendering.js`.
- Build: `tools/build_phase10.py`.

## 5. Testes

### Testes específicos

- `phase10_save_migration.js`: V1→V3, V2→V3, roundtrip V3, corrompido e versão futura.
- `phase10_persistence.js`: preparação, condição, lesão, reposição automática, familiaridade, pressão eliminatória e suspensão de reserva.
- `phase10_live_match.js`: partida completa, registro dos dois times e repetição determinística.
- `phase10_cup_chain.js`: três partidas consecutivas repetidas com as mesmas seeds, estado integral idêntico.
- `phase10_browser_smoke.py`: desktop, mobile vertical e mobile horizontal.

### Resultados da cadeia de três partidas

- placares: 5–0, 3–0 e 3–1;
- três partidas registradas para cada equipe;
- 33 participações persistidas;
- condição média final: 47,3%;
- pressão das oitavas: 0,35;
- preparação do usuário: recuperação, tático, defensivo;
- repetição com mesmas seeds: estado idêntico.

### Compatibilidade

Aprovadas as suítes das Fases 4–9, incluindo decisor probabilístico, goleiros, bolas paradas, pênaltis e IA do treinador.

### Validação estrutural

`tools/verify.py` aprovado:

- 7.739 jogadores;
- 13.284 escalações;
- zero escalação inválida;
- matriz oficial de 214 partidas: 93,135/100;
- regressão histórica de 3.200 partidas: 93,159/100;
- build autocontida e JavaScript válido.

### Smoke visual

Três viewports aprovados, sem erro de console e sem overflow horizontal:

- 1366×768;
- 390×844;
- 844×390.

## 6. Build

- Arquivo: `dist/COPA DOS SONHOS - FASE 10 - PERSISTENCIA DA COPA - V5.3.0.html`
- Tamanho: 1.399.844 bytes.
- SHA-256: `f18183ec93c91044866ffaa388ab489fca145b31f9a21eba71fb7b2f24c38991`.
- Manifesto: `manifests/phase10-build.json`.

## 7. Definition of Done

- [x] consequências entre partidas;
- [x] preparação limitada e transparente;
- [x] persistência para usuário e IA;
- [x] save antigo e novo;
- [x] determinismo por seed;
- [x] passo fixo 1/60;
- [x] banco preservado;
- [x] HTML autocontido;
- [x] desktop e mobile;
- [x] testes e relatório;
- [ ] publicação remota e PR próprio — pendente exclusivamente pela indisponibilidade do conector GitHub nesta sessão.
