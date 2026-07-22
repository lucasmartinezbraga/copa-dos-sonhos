# Copa dos Sonhos — Reconciliação da Auditoria Mestra 650 após o fixpack

## Identidade

- Candidata original auditada: `COPA DOS SONHOS - RC-UX.html`
- SHA-256 original: `a2f62022807a9b322bc64487bba5298c5c9f1b7cbf7255c9e140e9618c58f36c`
- Branch de correção: `agent/fechar-auditoria-650-2_5d`
- Candidata corrigida: `dist/COPA DOS SONHOS - RC-UX.html`
- SHA-256 corrigida: `438df2ce4a1a695935171d197d291735e0ccaba9755718f6c0f3c496bf20886c`
- Commit atual da branch após a execução automática: `27d8e1049c58091ce6c7fb54c4ec5b344c2f34da`

## Regra de leitura

Este relatório distingue três estados que não podem ser confundidos:

1. **Defeito confirmado na auditoria original** — item estava em `FAIL`.
2. **Causa corrigida no código** — implementação correspondente foi alterada e possui gate estático/dinâmico.
3. **PASS final da matriz** — somente pode ser atribuído após executar novamente o método e a evidência definidos para cada item, sobre a SHA final.

Portanto, os antigos `FAIL` abaixo estão **corrigidos no código e pendentes de revalidação integral**, não são silenciosamente reclassificados como `PASS`.

## Reconciliação dos 60 FAIL originais

| Domínio | FAIL originais | Causa consolidada | Correção aplicada | Evidência atual | Estado pós-fixpack |
|---|---:|---|---|---|---|
| Projeção e câmera | 15 | Bola alta ultrapassava a banda do estádio e cenas de falta/pênalti usavam perspectiva antiga | Projetor `elevatedY` com teto por profundidade; ampliação da banda superior; palco único `spStage25D` | 0 amostras acima da arquibancada nas duas partidas; padrões antigos proibidos pelo gate estático | CORRIGIDO — REVALIDAR 15/15 |
| Atletas | 15 | Corpo sem passada nem poses causalmente ligadas às ações | `body650`: passada, bob, chute, cabeceio, carrinho, mergulho, claim, soco e espalmada; poses alimentadas por estado/evento | Funções e estados presentes nos 37/37 gates; navegador sem erro | CORRIGIDO — REVALIDAR 15/15 COM GALERIA/VÍDEO |
| Trajetórias e VFX | 10 | Chute alto excluído do arco; pulso de queda usava período fixo | Arco para qualquer bola com `z>0.45`; pulso escalado por `G.speed` | Expressões antigas proibidas; follow-up VFX-026..030 versionado | CORRIGIDO — REVALIDAR 10/10 NAS VELOCIDADES |
| UX | 5 | Draft podia ficar preso em 10/11 sem reroll compatível | Reroll de emergência único quando não existe jogador compatível para a vaga restante | Salvaguarda presente no gate estático | CORRIGIDO — REVALIDAR FLUXO DIRIGIDO |
| Acessibilidade | 10 | Ausência de anúncio vivo e suporte incompleto a contraste/teclado/movimento reduzido | Região `aria-live`, rótulo do canvas, teclado, `forced-colors`, `prefers-reduced-motion` e touch targets | Requisitos presentes nos gates estáticos | CORRIGIDO — REVALIDAR ÁRVORE E LEITORES REAIS |
| Performance | 5 | Cache visual sem descarte explícito | Limpeza de `dirCache` e ações visuais; descarte por inatividade e em `pagehide` | Cache reset presente; 60,2 FPS nas duas partidas Chromium | CORRIGIDO — REVALIDAR SESSÃO LONGA/HEAP |
| **TOTAL** | **60** |  |  |  | **60 CORRIGIDOS NO CÓDIGO; PASS FINAL AINDA DEPENDE DO PROTOCOLO** |

## Evidência executada sobre a SHA final

### Gate estático

- 37/37 controles técnicos passaram;
- zero padrão legado de perspectiva de bola parada;
- zero fórmula antiga de elevação da bola, rastro ou guia;
- zero exclusão de chute alto do arco;
- zero pulso de queda com período fixo;
- auditores R12 e pré-2.5D continuam presentes;
- banco histórico, canvas, doctype e fechamento do documento preservados.

### Gate dinâmico em Chromium

Foram executadas duas partidas completas:

- ambas encerraram no minuto 90;
- ambas terminaram com estado canônico `CONSISTENT`;
- FPS em 1.0x: `60,2` e `60,2`;
- `ballAboveStands = 0`;
- `ballOffPitch = 0`;
- `nonFiniteVisual = 0`;
- `ballTeleports = 0`;
- `playerTeleports = 0`;
- `ownerNoContact = 0`;
- `invalidTimelines = 0`;
- todos os gols observados tiveram placar DOM igual ao placar do simulador;
- zero erro de página/console.

## O que continua obrigatório antes de promover a release

A candidata **não deve ser declarada 650/650 PASS** somente com a execução acima. Permanecem obrigatórios:

1. repetir as 876 partidas oficiais sobre a SHA `438df2ce…20886c`;
2. repetir os 25 cenários dirigidos e os 13 checks oficiais;
3. executar a galeria determinística específica de atletas, bolas altas, falta e pênalti;
4. validar em aparelhos físicos iOS e Android, retrato e paisagem;
5. executar testes com leitor de tela, teclado e contraste forçado reais;
6. coletar heap, listeners, timers, frame time e FPS em sessão longa;
7. executar observação humana cega dos gates perceptivos e atualizar, item a item, os 130 `PARCIAL` e 15 `PENDENTE` da auditoria original.

## Veredito desta etapa

**FIXPACK TÉCNICO APROVADO NOS GATES EXECUTADOS.**

Os bloqueadores de código identificados nos 60 `FAIL` foram atacados e a candidata passou nos gates estáticos e dinâmicos adicionados. A promoção final do motor visual 2.5D permanece condicionada ao protocolo integral da matriz de 650 itens sobre a SHA final.
