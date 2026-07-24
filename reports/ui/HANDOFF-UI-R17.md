# HANDOFF — redesign da partida (R17.x) e o que falta

Para continuar numa janela nova sem redescobrir nada. Escrito ao fim da sessão
de redesign da UI de partida.

## 1. Estado / ambiente

```
REPO    C:\Users\lucmartinez\Downloads\COPA%20DOS%20SONHOS%20-%20FASE%201%20-%20PACOTE%20MODULAR (1)\COPA_DOS_SONHOS_FASE_1
BRANCH  claude/r14-motor-vivo-auditoria-800   (nada empurrado para o origin)
NODE    %LOCALAPPDATA%\nodejs-portable\node-v24.18.0-win-x64\node.exe  (fora do PATH)
PYTHON  3.11 no PATH · Playwright + Chromium instalados
```
Sempre: `export PATH="$LOCALAPPDATA/nodejs-portable/node-v24.18.0-win-x64:$PATH"`
e `export PYTHONIOENCODING=utf-8`.

Build corrente da UI: **R17.9** (rebuild via `python tools/build_ux.py --out
"dist/COPA DOS SONHOS - R17.9.html"`). Fallback do motor: **R16.2** `b168fd1a`
(candidata do limitador angular, ver `reports/r15/DECISAO-R16.md`).

## 2. Arquitetura da casca (o que NÃO reescrever)

A tela de partida é uma template string dentro de `render()` em
`src/r13/scripts/10-base-bundle.js`, com **41+ patches ancorados por texto** em
`src/ux/patches.json`. **NUNCA reescrever o template** — reposicionar por CSS e
editar conteúdo só por patch ancorado (build aborta se o `from` não ocorre 1×).

O motor escreve na UI por `id` (11 nós do contrato — ver
`reports/ui/01-AUDITORIA-UI-ATUAL.md`). A casca é master-detail:
- **campo à esquerda sempre visível** (`.field-wrap`, área grid `field`);
- **painel `#tbody` à direita troca de conteúdo pela aba** (Visão geral /
  Estatísticas / Adversário / Tática — Elenco fundido em Tática via `paintTeamTab`);
- `#statsb` oculto (redundante); `.spd-row` (aceleradores) na área `speed`.

CSS da casca: `src/ux/02-tokens.css`, `42-match-shell.css`, `43-match-panels.css`
(design system denso), `50-field25d.js` (canvas 2.5D).

**Armadilha real**: o CSS BASE (`src/r13/styles/00-bundle.css`) já tem um layout
próprio de 2 colunas (float, `@media(min-width:980px)`) e regras como
`.tbody{max-height:min(52vh,560px)}` e `.field-wrap{float:left}` que BRIGAM com a
casca-grid. Sempre conferir com `getComputedStyle` quem vence, não só a
especificidade no papel.

## 3. Ferramentas de verificação (rodar sempre)

```
tools/ux/probe_balllock.js    matriz de 294 (paridade). ~30 min.
tools/r15/parity_gate.py      294/294 idênticas vs R16.2 (prova motor intacto)
tools/ui/contract_ids.py      18 ids do contrato + letterbox do campo
tools/r15/browser_match_fps.py  FPS (deve ficar ~59.9)
```
Regra de ouro desta sessão: **medir/print antes de dizer que está pronto** —
nunca "no chute". Vários bugs (campo escuro, linhas coloridas, painel de 494px,
bandeira gigante do shot map) só foram achados com hook de canvas /
`getComputedStyle`.

## 4. O que foi entregue (R17.0 → R17.9)

- Casca de duas colunas; painel contextual master-detail; 4 menus (Elenco em
  Tática); §18 Contrato de Função inerte (paridade 294/294).
- Bugs corrigidos: campo não escurece pós-gol (`grass` globalAlpha vazado);
  sem "linhas coloridas" (barras `.bar` que vazavam do #tbody); sem corte do
  campo; aceleradores de volta; legenda de 1 linha (narração) no rodapé do campo;
  **tela de fim de jogo** (card de resultado ganhou área própria, não estoura
  mais); mapa de finalizações proporcional (bandeira/estrela da legenda
  renderizava a ~350px sem limite → 14px); momentum com **eixo de tempo**.
- Painéis densos (estilo FM): cortada a redundância (placar duplicado na Visão
  geral, chips-herói nas Estatísticas), cards gigantes → tiles compactos.

Commits: `4ad48d2` (§18) … `f72a81e` (shell+densidade). O commit do momentum/
fim-de-jogo/shot-map é o próximo a fechar (após a matriz R17.9).

## 5. O QUE FALTA — priorizado

### A. ESCANTEIO "teletransporte" (reportado) — é MOTOR, cuidado

`src/r14/20-setpiece-walk.js` JÁ faz o cobrador andar até a bandeirinha, mas o
`dead` é capado em **2,2 s** (decisão MEDIDA da R15.5: teto de 6 s derrubava os
gols 14,6%). Em 2x/4x/6x esses 2,2 s de FÍSICA passam rápido → parece
teletransporte; e cobrador longe (>~14 m) não chega antes de a bola voltar.

**NÃO mexer no `dead`/curva de gols às cegas** — reabre a calibração dos 294 e a
paridade. **Correção limpa (apresentação, sem tocar o sim)**: criar uma CENA DE
ESCANTEIO com ritmo em TEMPO REAL, como `drawFkScene`/`drawPenScene` já fazem
(elas usam `until: performance.now()+ms`, independente da velocidade de jogo).
Assim a corrida do cobrador é visível em qualquer velocidade sem alterar gols.
Ver `penScene`/`fkScene` em `10-base-bundle.js` como modelo. É trabalho de uma
cena nova (não trivial), mas é o caminho certo.

### B. Adversário — pontos fortes/fracos derivados (brief pede)

Hoje o painel mostra formação/overall/estilo/lista. Falta o bloco "pontos
fortes/fracos", que o brief quer DERIVADO de dados reais: lado de ataque por
`stats.attacksL/attacksR`, ameaça aérea por `facet(head_atk/head_def)`, pressão
por `pressWins`, etc. Não inventar — só derivar do que existe. Patch em `oppHtml`.

### C. Mobile (<900px) — bottom sheets

A casca desktop só vale ≥900px; no mobile continua a pilha antiga. O brief pede
bottom sheets (recolhido/médio/expandido), campo dominante, safe areas. Não
começado.

### D. Motor / auditoria (trilha separada, ver reports/r15/)

- §18 Contrato de Função: só o passo 1 (inerte) entrou. Faltam passos 2–6
  (`role_observable`, marcação persistente com `assignmentId`, cobertura,
  logger §23). Critério pré-registrado em `CRITERIO-POS-18-PRE-REGISTRADO.md`.
- Resíduos abertos: `_resolveOverlaps` (`RESIDUO-RESOLVE-OVERLAPS.md`),
  `r14-shadow-lane` inerte, métrica de orientação corporal tautológica,
  18 gates NOT_EXECUTED, 11 P0 (ver `CHECKPOINT-59-ETAPAS.md`).

## 6. O que VOCÊ (usuário) precisa fazer para continuar

1. **Abrir a build nova para testar**: `dist/COPA DOS SONHOS - R17.9.html` (ou o
   que a próxima janela gerar). É só abrir o HTML no navegador.
2. **Se quiser publicar** no GitHub Pages: copiar o HTML final para `docs/
   index.html`, garantir `.nojekyll`, commit e push (o remoto tem PAT embutido —
   regenere o token). Nada foi empurrado nesta sessão.
3. **Decidir a trilha da próxima janela** e dizer no primeiro prompt:
   - "UI": faz A (cena de escanteio), B (adversário), C (mobile) — apresentação.
   - "Motor": retoma o §18 passo 2+ e os gates — precisa de medição/matriz.
   Não misturar UI e motor na mesma matriz de regressão.
4. **Passar este arquivo** (`reports/ui/HANDOFF-UI-R17.md`) + o
   `HANDOFF-R16-POLIMENTO.md` + `reports/r15/DECISAO-R16.md` para a nova janela.
   Não precisa de zip: tudo já está no repo local, versionado nos commits.

## 7. Prompt sugerido para a próxima janela

> Continue o redesign da UI da partida do Copa dos Sonhos a partir de
> `reports/ui/HANDOFF-UI-R17.md`. Build corrente R17.9. Trilha: [UI | Motor].
> Comece por [A escanteio-cena | B adversário | C mobile]. Regras: não reescrever
> `render()`, só patches ancorados + CSS; medir/print antes de fechar; rodar
> paridade 294 se o bundle mudar. Não empurrar para o origin sem eu pedir.
