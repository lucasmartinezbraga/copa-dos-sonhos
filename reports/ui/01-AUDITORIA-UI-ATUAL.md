# Redesign da partida — passo 1: auditoria da UI atual e mapa de integrações

Primeiro item da ordem de execução do brief. Nada de visual foi alterado ainda.
Tudo abaixo foi lido no código ou medido em navegador real nesta sessão.

Base: **R17.1** `22a0b268f95bb9ad4d430e502aba4d4db4f6738893458d219ee2b6e4b6b5ee3c`
(commit `4ad48d2`, branch `claude/r14-motor-vivo-auditoria-800`).

---

## 1. O achado que decide a arquitetura do redesign

> **A tela de partida não é um componente. É uma template string dentro do
> bundle de 1,1 MB, e 41 patches de apresentação ancoram nela por texto.**

`render(A, B)` — `src/r13/scripts/10-base-bundle.js:10668` — devolve o HTML da
partida inteiro como literal. Os patches de `src/ux/patches.json` fazem
find/replace sobre esse texto, e `tools/build_ux.py` **aborta** se qualquer
âncora não ocorrer exatamente 1 vez.

Consequência direta: **reescrever a marcação quebra os 41 patches de uma vez** —
exatamente a mesma armadilha que o motor tem com os 23 patches de engine.

### 1.1 O caminho que funciona

O projeto já resolveu esse problema uma vez, para o motor: as camadas R12/R13/R14
não editam o bundle, **substituem métodos do protótipo depois que ele existe**.

O equivalente para a UI é reestruturar o DOM **depois** de `render()` — a camada
`cds-ux-boot` já roda por último e já tem acesso a tudo. Ou seja: a casca nova
monta o grid, e **move** os nós existentes para dentro dele, preservando os
mesmos `id`s. Os 41 patches continuam válidos porque o texto do template não
muda; o que muda é onde os nós ficam na árvore.

**Isso não é gambiarra: é o único caminho que preserva o contrato de build e
permite paridade verificável.** Uma reescrita do template exigiria reancorar 41
patches sem teste de regressão visual — e o projeto não tem esse teste hoje.

---

## 2. Estrutura atual (ordem no DOM)

```
.mh                    cabeçalho: escudo, nome, formação, placar, relógio
.spd-row               1x / 2x / 4x / TURBO / pausa
.statsb                posse (#pbA #pbB #pA #pB)
                       chutes (#sA #sB) · no alvo (#oA #oB) · escanteios (#cA #cB)
                       .momentum-strip > #momcv
#tline                 faixa de eventos
.field-wrap            #fieldcv (1024×500) · #narr · #setpiece-ui
.match-scroll-hint     "arraste para cima…"
.mtabs                 Visão geral · Estatísticas · Adversário · Elenco · Tática
#tbody                 corpo da aba ativa
```

**É uma pilha vertical.** O brief pede campo (68–74%) + painel lateral (26–32%).
A mudança é de topologia, não de estilo.

## 3. Pontos públicos de leitura e escrita — o contrato de integração

Estes são os únicos lugares onde o motor toca a UI. **A casca nova tem de
preservar todos os `id`s**, senão quebra silenciosamente.

| função | linha | escreve em |
|---|---|---|
| `paintField()` | 10858 | `#fieldcv` (canvas) |
| `updateScore()` | 11307 | `#score` |
| `updateClock()` | 11313 | relógio |
| `updateNarr()` | 11324 | `#narr` |
| `paintMom()` | 11331 | `#momcv` |
| `paintTimeline()` | 11342 | `#tline` |
| `updateStatsBar()` | 11348 | `#pbA #pbB #pA #pB #sA #sB #oA #oB #cA #cB` |
| `paintTabBody()` | 11363 | `#tbody` |
| `paintAdaptiveLive()` | 11512 | `#tbody` |
| `paintTaticaTab(el)` | 11517 | `#tbody` |
| `paintSquadTab(body)` | 11593 | `#tbody` |

Nenhuma delas recalcula estatística: todas leem `sim.getState()` / `this.stats`.
**A regra "não duplicar lógica de cálculo no componente visual" já é respeitada
hoje** — e precisa continuar sendo.

### 3.1 Cadência de atualização

`paintField()` roda no rAF. As demais rodam por evento ou por tick do relógio.
Não há re-render global. **O critério de aceite "não há re-render global por
tick" já passa hoje** — a casca nova não pode introduzir um.

---

## 4. O campo: por que está pequeno (medido)

Medido em navegador real a 1920×950 (`tools/r15/browser_match_layout.py`):

```
fieldWrap  217 → 882   h=665   max-height: calc(100dvh - 285px)  ← binding
fieldcv    217 → 843   h=626   object-fit: contain
narr       843 → 881   h=38
mtabs      896 → 946   h=50    (janela 950 — 4px de folga)
```

O canvas tem razão **fixa 2,048** (`CW=1024, CH=500`) e altura 626 →
renderiza **1282px de largura dentro de 1920**. São **638px (33%) de letterbox
lateral** — exatamente as *"grandes margens verdes vazias"* que o brief proíbe.

A projeção 2.5D está correta: conferi que a razão do trapézio é 0,713, que bate
com `R0 = 0.72`. **O problema é só o tamanho do elemento, não o desenho.**

Para preencher 1920 de largura o canvas precisaria de 937px de altura, e só há
665. Com a casca do brief (campo 68–74% da largura, sidebar ao lado), a largura
útil do campo cai para ~1340px, que a 626px de altura fica **quase sem
letterbox** — o layout novo resolve o problema por construção, sem tocar na
razão do canvas nem na câmera.

> Isto responde a pergunta que ficou aberta antes do brief chegar: não é preciso
> escolher entre "recuperar espaço vertical" e "deixar rolar". A casca de duas
> colunas elimina a causa.

## 5. Rótulos de desenvolvimento a remover da UI do jogador

O brief pede remoção de versão do motor, número de fase e nome interno de
auditoria. Presentes hoje na identidade da build (`r15-identity-title-tag`,
`r15-identity-document-title`). **Atenção:** esses patches existem para resolver
um P0 de rastreabilidade (três declarações de versão conflitantes). Remover o
rótulo da tela **não pode** remover a declaração do artefato — a versão sai do
que o jogador vê, não do `<title>` nem do manifesto.

## 6. O que NÃO existe hoje e o brief pede

Registrado para não virar dado fictício:

| pedido | estado real |
|---|---|
| xG | existe no motor |
| momentum | existe (`#momcv`) |
| destaque do jogo | existe `paintAdaptiveLive` |
| foto de jogador | **não existe** — usar iniciais/silhueta (o brief permite) |
| mapa de finalizações | dados existem; widget não |
| instruções individuais (dobrar marcação, forçar pé fraco) | **motor não suporta** — brief manda desabilitar, não simular |
| forma com/sem bola desenhada | **agora é possível** via §18 Contrato de Função (`corridor`, `homeZone`, `line`) — commit `4ad48d2` |
| pontos fortes / vulnerabilidades do adversário | derivável de atributos + telemetria; **não inventar** |

O §18 que acabou de entrar é o que torna a tela **Tática** honesta: a forma
coletiva pode ser desenhada a partir do contrato real de cada jogador em vez de
um 4-4-2 decorativo.

## 7. Riscos

| risco | mitigação |
|---|---|
| reescrever o template quebra 41 patches | reestruturar o DOM após `render()`, preservando `id`s |
| perder um `id` do contrato da §3 | teste que verifica a presença dos 11 nós antes/depois |
| regressão de FPS | `browser_match_fps.py` antes e depois |
| regressão visual sem detecção | capturar as 6 telas de referência antes de mexer |
| mexer em UI alterar o motor | matriz de 294 é imune (runner headless pula `cds-ux-boot`) |

## 8. Próximo passo

Passo 3 da ordem do brief: **tokens + casca**, sem tocar em nenhuma tela ainda.
O portão é o mesmo do §18: a casca entra e **nenhum dos 11 nós do contrato pode
sumir**, FPS não regride, e as 294 partidas continuam idênticas.
