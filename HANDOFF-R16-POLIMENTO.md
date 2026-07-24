# HANDOFF — polimento do motor rumo ao padrão FM

Contexto mínimo para uma janela nova continuar sem redescobrir nada.
Escrito em 2026-07-23, ao fim da sessão de auditoria R15/R16.

---

## 0. Ambiente

```
REPO   C:\Users\lucmartinez\Downloads\COPA%20DOS%20SONHOS%20-%20FASE%201%20-%20PACOTE%20MODULAR (1)\COPA_DOS_SONHOS_FASE_1
NODE   %LOCALAPPDATA%\nodejs-portable\node-v24.18.0-win-x64\node.exe   (não está no PATH)
PYTHON 3.11 no PATH · Playwright + Chromium instalados
BRANCH claude/r14-motor-vivo-auditoria-800
```

Sempre `export PATH="$LOCALAPPDATA/nodejs-portable/node-v24.18.0-win-x64:$PATH"`
e `export PYTHONIOENCODING=utf-8`.

## 1. Estado das builds

> **DESATUALIZADO a partir daqui — ver `reports/r15/DECISAO-R16.md` e
> `reports/r15/PROMOCAO-R16.2.md` (2026-07-23).** A R16.2 **foi promovida**.
> Duas afirmações desta seção não se sustentaram na medição: (a) "os gols caem
> 6,2%" é ruído (pareado por seed, n=294, t = −1,49); (b) a decisão dependia de
> ajustar a curva — três matrizes mostram que não existe constante que satisfaça
> os blocos A e B ao mesmo tempo.

| build | SHA-256 | o que é |
|---|---|---|
| R14.4 | `7fdf1835…c8b071` | fallback anterior, preservada |
| R15.9 | `b3e10532…9c74c7a0a1` | **fallback atual** — reprova 2 gates de fluidez |
| R16.0 | `b9a20967…6e49cd1f97` | limitador, `bonus 0` — reprova bloco E |
| R16.1 | `1e0e8dc3…4f1e0cedf` | limitador, `bonus 10` — reprova bloco A |
| **R16.2** | `b168fd1a…266626a3b47` | **candidata corrente (promovida)** |

Custo aceito, medido e pareado: `threatCoverage` −0,0074 · `markerMeanDistance`
+0,133 m. Registrado como dívida que o §18 tem de pagar — critério já
pré-registrado em `reports/r15/CRITERIO-POS-18-PRE-REGISTRADO.md`.

## 2. O que já foi corrigido e medido

| item | resultado |
|---|---|
| 8 modificadores ocultos (§41/§42) | removidos; validados com elencos reais (93% dos placares mudaram) |
| Reprodutibilidade do build | corrigida — `enabled:false` + `--with`/`--without` |
| Identidade da build | três declarações conflitantes unificadas |
| Linha defensiva | `cover`/`shadow` presos à linha: desvio 20–22 m → 2,8–3,0 m |
| Teleporte em bola parada e kickoff | 204,9 → 17,1 por partida (−92%) |
| Campo cortado + legenda sobrepondo | corrigido e verificado em navegador |
| Auditor que não sabia reprovar | agregador de 60 gates com 6 estados reais |

## 3. O que a comparação com o FM revela

Analisei 5 quadros estáticos (3D e 2D). **Não dá para julgar fluidez, animação
ou física a partir de imagem parada** — o que segue é o que a estrutura mostra.

### 3.1 O achado principal: posições e marcações fixas

Na UI tática do FM aparecem slots explícitos: `DR`, `DCR`, `DCL`, `DL`, `DM`,
`WB(R)`, `M(C)`, `AM(R)`. Cada jogador **pertence** a um slot com zona, lado e
função. No 2D de campo inteiro, a forma do time é legível: quatro atrás,
distâncias regulares, ninguém fora do corredor sem motivo.

Isso é exatamente o **§18 Contrato de Função**, que este motor NÃO tem. Hoje a
função é inferida de `slotPos` em vários lugares independentes (`lineOf`,
`_assignDefRoles`, `_attackTarget`, `_defendTarget`) sem contrato único. É a
causa-raiz de:

- marcação travada em 0,54–0,56 de cobertura (pior gate aberto);
- 4 dos 18 gates que não têm como ser medidos;
- impossibilidade de distinguir erro posicional de rotação legítima.

**Cinco tentativas de calibrar marcação por parâmetro já falharam** (registradas
no handoff anterior). Não tente a sexta antes do contrato.

### 3.2 O que é polimento e o que é outro produto

Separação honesta, para não perder tempo:

**Alcançável no motor atual (canvas 2.5D):**
- estrutura posicional e marcação fixa por função — §18
- ocupação de corredores, compactação, cobertura
- câmera que acompanha a bola com suavização
- animação de estado (correr/frear/chutar) — já existe base em
  `src/ux/60-anim-state-machine.js` e `61-anim-bridge.js`
- bola dentro da rede, barreira em falta, goleiro com decisão

**NÃO alcançável como "polimento":** o motor 3D do FM (estádio, público,
sombras, blending de animação, motion capture). Isso é outro produto e outra
stack. O 2D do FM, que é onde a **inteligência** aparece, é o alvo realista —
e é justamente o que o seu jogo já tenta ser.

## 4. Ordem de trabalho recomendada

### Etapa 1 — Contrato de Função (§18) · PRIORIDADE MÁXIMA

Criar um objeto por jogador, fonte única de verdade, com:

```
posição-base · lado · corredor preferencial · zona permitida · altura média
função com bola · função sem bola · função na transição ofensiva/defensiva
comportamento no lado da bola / no lado oposto
responsabilidade de cobertura
condições para abandonar a zona · condições para retornar
quem compensa a saída · ações preferenciais · ações proibidas · tolerância a risco
```

Depois **rotear** `_attackTarget`, `_defendTarget` e `_assignDefRoles` para ler
esse contrato, em vez de cada um inferir por conta própria.

Isso destrava, em ordem: marcação, zona canônica, lado, corredor, cobertura,
compensação, e 4 gates hoje impossíveis de medir.

### Etapa 2 — Falta não repõe a bola

`10-base-bundle.js:4396`. O ramo de falta comum faz:

```js
this.dead = 0.82;
this.pendingRestart = () => { this._giveBall(this._nearestFieldMate(victim)); … };
```

A bola **nunca é reposicionada no ponto da falta** e o ramo não limpa
`ball.owner`/`ball.traveling` — compare com os ramos de vermelho (linhas 4374 e
4378), que limpam. Por isso "a jogada não para e o cara já sai chutando".

Correção: colocar a bola em `(victim.x, victim.y)`, limpar owner/traveling,
escolher cobrador, estender `dead` pela distância — reaproveitando o padrão já
provado em `src/r14/20-setpiece-walk.js`.

### Etapa 3 — Decidir a R16.2

Trade-off descrito na seção 1. Se aceitar, promover; se não, ajustar a curva
na faixa média de velocidade (é lá que o defensor perde reação).

### Etapa 4 — `_resolveOverlaps` progressivo

`29-r12-transactional-core.js:81` empurra jogadores a <1,7 m com correção
instantânea de até 0,30 m/quadro, escrita direto na posição, fora do
integrador. Responde por 3,2% de giro brusco dentro do raio (mas só 0,26% dos
quadros). Trocar deslocamento instantâneo por força integrada ao steering.

### Etapa 5 — só então migração modular / TypeScript

## 5. Regras de trabalho que funcionaram

- **Medir ANTES de mexer.** Toda mudança com número antes/depois em 294 seeds.
- **Critério pré-registrado.** Escreva o limite de aceite ANTES de ver o
  resultado. Ver `reports/r15/CRITERIO-R16.0-PRE-REGISTRADO.md`.
- **Triagem barata antes de matriz cara.** O jitter probe (1 min) matou uma
  candidata antes de gastar 15 min de matriz.
- **Uma variável por vez.** Duas mudanças na mesma regressão impedem atribuir
  o efeito.
- **Armadilha de código morto:** este motor tem camadas que sobrescrevem o
  protótipo. Confirme quem é o dono VIVO antes de ancorar patch. Dois patches
  já embarcaram sem efeito nenhum por causa disso (`r14-shadow-lane`).
- **Nunca marque PASS sem artefato vinculado ao SHA.** O agregador recusa
  misturar builds.

## 6. Ferramentas

```
tools/r15/aggregate_release.py     agregador de 60 gates, 6 estados
tools/r15/scan_hidden_modifiers.py varredura de scripting (§41)
tools/r15/mutation_test.py         prova que os gates reprovam (§7)
tools/r15/patch_effect.py          A/B por patch — detecta patch inerte
tools/r15/jitter_probe.js          fluidez: giro por quadro, 6 dimensões
tools/r15/line_probe.js            desvio da linha defensiva por papel
tools/r15/teleport_profiler.js     atribui teleporte ao método responsável
tools/r15/skill_tiers.js           diferenciação 97/90/80/70
tools/r15/side_discipline.py       respeito ao lado vs posição-base
tools/r15/browser_match_layout.py  geometria da tela em navegador real
tools/r15/browser_match_fps.py     FPS da partida ao vivo
tools/r15/traceability_matrix.py   matriz dos 120 lances da coletânea
tools/r15/evaluate_r160.py         avalia build contra critério pré-registrado
```

Receita para abrir a partida em navegador (destravou bloqueio antigo):

```js
const sq=G.db.squads[0], lu=autoLineup(sq,'4-3-3',0);
const picks=lu.lineup.map(s=>({p:s.p,from:sq.c}));
const me=CUP.registerPlayerTeam(G.db,picks,(lu.bench||[]).map(p=>({p,from:sq.c})));
G.lineup=lu.lineup.map((s,i)=>({p:me.pl[i],x:s.x,y:s.y,pos:s.pos,from:sq.c}));
G.bench=me.pl.slice(11); G.formKey='4-3-3'; G.style='balanced';
G.cup=CUP.createCup(G.db,'ME');
window.GAME.open._ready=true; window.GAME.open();
```

## 7. O que continua REPROVADO

Certificação: **38 de 60 gates medidos · 18 NOT_EXECUTED · 4 INCONCLUSIVE**.

Nunca executados: percepção (§20), contrato de função (§18), logger de decisão
(§23), cadeia causal evento↔física (§36), determinismo por seed, navegador real
(boot desktop/mobile, erro fatal), aprovação humana (§55).

**Não esconda isso.** A cobertura aparece no topo do relatório de propósito.
