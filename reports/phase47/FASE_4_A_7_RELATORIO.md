# Copa dos Sonhos — Relatório final das Fases 4 a 7

## Identificação

- Versão do motor: **5.0.0**
- Motor-base: **4.3.2**
- Passo fixo: **1/60 s**
- Build: `dist/COPA DOS SONHOS - BUILD FINAL FASES 4 A 7 - V5.0.0.html`
- Tamanho: **1.305.646 bytes**
- SHA-256: `67de5d0d2a003f25cc64a9d46bf47883f26a6c0820c7e02b00ce4cfe071d8bc6`

## Entregas implementadas

### Fase 4 — Modelo completo de decisão

- construção de contexto por jogador;
- identificação de construção, progressão, transição e último terço;
- candidatas de passe curto, passe vertical, passe em profundidade, condução, drible, cruzamento e chute;
- pontuação por habilidade, encaixe tático, espaço, pressão, fadiga e risco;
- decisão e execução mantidas como etapas separadas;
- métricas de quantidade, qualidade e aderência das decisões.

### Fase 5 — Funções com e sem bola

- posição, função e dever separados para `inPossession` e `outOfPossession`;
- alteração das âncoras ofensivas e defensivas;
- API para mudar função durante a partida;
- funções expostas no relatório avançado do motor;
- compatibilidade com o sistema de shapes já existente.

### Fase 6 — Instruções coletivas por fase

- construção, progressão, último terço, transição e bloco defensivo;
- presets Equilibrado, Posse, Contra-ataque, Pressão alta, Bloco baixo e Alas;
- efeitos reais em verticalidade, largura, ritmo, pressão, desgaste, chute, cruzamento e passe;
- sistema de coerência tática;
- alertas para combinações contraditórias;
- Central Tática 5.0 disponível dentro do HTML.

### Fase 7 — Movimentação coletiva avançada

- ocupação dos cinco corredores;
- amostragem espacial por equipe;
- correção física de amontoamentos persistentes;
- suporte a overlap e underlap;
- preservação do sistema anterior de terceiro homem e movimentos coordenados;
- métricas de ocupação, correções, ultrapassagens e amostras espaciais.

## Validações executadas

### Integridade herdada

`python3 tools/verify.py` foi aprovado integralmente, preservando:

- banco com 7.739 jogadores;
- 13.284 escalações validadas;
- módulos do projeto;
- build autocontido;
- matriz oficial e regressão massiva da Fase 3;
- SHA da build calibrada 4.3.2.

### Testes automáticos

- sintaxe da nova camada: **aprovada**;
- smoke test das Fases 4–7: **aprovado**;
- determinismo: **aprovado**;
- passo fixo de 1/60 s: **aprovado**;
- geração do HTML autocontido: **aprovada**;
- workflow final do GitHub: **aprovado**.

### Partida funcional completa

Uma partida completa de 90 minutos produziu:

- 171 decisões contextuais para uma equipe;
- 1.505 amostras espaciais;
- ocupação registrada nos cinco corredores;
- 38 correções antiamontoamento;
- 268 movimentos de underlap registrados;
- função ofensiva e função defensiva diferentes para o mesmo jogador;
- nenhuma coordenada ou estado numérico inválido.

### Regressão funcional de oito partidas

Executada com passo real de 1/60 s e confrontos variados:

| Métrica | Resultado | Faixa anterior | Leitura |
|---|---:|---:|---|
| Estados inválidos | 0 | 0 | aprovado |
| Gols por partida | 3,25 | 2,4–3,2 | 0,05 acima; amostra pequena |
| Chutes por partida | 27,38 | 20–30 | dentro |
| xG por partida | 3,5008 | 2,3–3,5 | no limite superior |
| Precisão de passe | 81,33% | 75–89% | dentro |
| Escanteios por partida | 9,00 | 5–11,5 | dentro |
| Faltas por partida | 26,63 | 16–28 | dentro |
| Amarelos por partida | 3,75 | 2,4–5,6 | dentro |
| Vermelhos por partida | 0,125 | 0,06–0,30 | dentro |
| Decisões contextuais por partida | 323,5 | nova métrica | registrada |
| Correções antiamontoamento por partida | 48,38 | nova métrica | registrada |
| Amostras espaciais por partida | 3.005 | nova métrica | registrada |

Essa bateria é uma regressão funcional, não substitui uma calibração massiva.

### Mobile

O HTML gerado pelo GitHub foi aberto em Chromium com viewport móvel de **390 × 844**:

- erros de página: 0;
- erros de console: 0;
- largura do documento: 390 px;
- largura do viewport: 390 px;
- API carregada: 5.0.0;
- botão Central Tática 5.0: presente.

## Limite de certificação

A regressão planejada de 1.000 partidas foi iniciada, mas não terminou dentro do limite contínuo do ambiente de execução. Por isso:

- a build está **funcionalmente concluída**;
- a integração, o mobile, o determinismo, o passo fixo e a integridade estão aprovados;
- a versão ainda não deve ser descrita como **estatisticamente certificada em 1.000 partidas**;
- a regressão massiva de 3.200 partidas continua válida para o motor-base 4.3.2, não para todas as alterações da 5.0.0.

## Conclusão

As Fases 4, 5, 6 e 7 foram integradas em uma build autocontida nova, com código-fonte, teste estrutural, build reproduzível, manifesto, validação móvel e métricas próprias. O único fechamento restante é executar a calibração massiva da versão 5.0.0 sem limite de duração e ajustar o motor caso a amostra ampla confirme desvios.
