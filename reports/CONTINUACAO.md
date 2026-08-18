# Briefing para quem continuar

Escrito para ser colado inteiro num modelo novo. Não presume nada da sessão
anterior.
**Índice** — 1 o projeto · 2 a regra de medição · 3 armadilhas que falham em
silêncio · 4 o padrão de defeito que se repete · 5 estado atual · 6 fila aberta ·
7 mapa do código · 8 calibração · 9 eventos · 10 máquina de animação ·
11 receitas · 12 glossário · 13 convenções · 14 como o dono trabalha

Se você só tem tempo para duas seções, leia a **2** e a **3**.

---

## 1. O que é o projeto

Simulador de futebol num único HTML autocontido. `dist/index.html` é **gerado**,
nunca editado à mão: `tools/build.py` remonta o bundle a partir de `src/`
guiado por `manifests/build-manifest.json`.

O bundle é uma pilha de ~80 blocos `<script>`. O primeiro grande é o **core**
(9 módulos em `src/scripts/`); os outros são **camadas** em
`src/scripts/layers/`, cada uma envolvendo métodos de `MatchSim.prototype` com
o padrão `const old = P.metodo; P.metodo = function(){...}`.

**A ordem do documento decide quem roda por fora de quem.** Isso não é detalhe
de estilo — é a causa-raiz de mais de um defeito real. A camada mais nova é a
mais externa.

Antes de qualquer commit:

```bash
python3 tools/build.py     # regenera dist/index.html
python3 tools/verify.py    # sintaxe e reprodutibilidade de todos os blocos
node tests/browser_smoke.js  # prova que o jogo SOBE num Chromium de verdade
```

---

## 2. A regra que vale mais que qualquer outra

**Mudança sem número não é entrega, é dívida.** Este código já foi calibrado
contra alvos de design, e mexer no motor "porque faz sentido" quebra coisa que
ninguém estava olhando.

```bash
node tools/fisica/bateria.js --build=dist/index.html --matches=96 --workers=8 \
  --out=reports/minha-medicao.json
python3 tools/fisica/placar.py reports/minha-medicao.json
```

O placar pontua 13 métricas contra `calibration/targets.json`. **A linha de
base é 12/13 com 96 partidas.** Se sua mudança derruba isso, ela não está
pronta — não importa quão certo esteja o diagnóstico.

E: **sempre meça o controle no MESMO tamanho de amostra.** Comparar 48 contra
96 partidas produz conclusão errada. Aconteceu comigo: uma dose parecia
11/13 com 48 partidas e era 9/13 com 96.

### O que a bateria NÃO vê

Ela pula o bloco `cds-ux-boot` (`bateria.js:65`), que é onde moram a ponte de
animação e o desenhista. **Nada de apresentação aparece na bateria.** Para isso
existem as sondas de tela, que sobem o jogo de verdade com
`window.__quickMatch(40, 120)`:

| ferramenta | o que mede |
|---|---|
| `tools/fisica/tela/gestos.js` | quais estados de animação chegam a ser desenhados |
| `tools/fisica/tela/gesto-perdido.js` | **onde** um gesto morre: pedido / recusado no tier / entrou e foi sobrescrito |
| `tools/fisica/tela/passada-parada.js` | salto e tremor da posição **desenhada** |
| `tools/fisica/tela/cerimonia.js` | pose contra movimento na bola parada |
| `tools/fisica/tela/validar-lances.js` | 16 invariantes de falta, roubada, lateral e pontapé |

---

## 3. Armadilhas de medição que já custaram caro

Todas me pegaram nesta sessão. Cada uma produziu um número convincente e
errado, e nenhuma dá erro — falham em silêncio.

1. **`CDS_F25D` é `Object.freeze`.** Trocar um método dentro dele falha sem
   avisar; a sonda reporta zero com o jogo desenhando normalmente. Troque o
   objeto inteiro: `window.CDS_F25D = Object.assign({}, window.CDS_F25D)`.

2. **O botão de velocidade entra na conta.** Entre dois quadros desenhados
   passa `parede × G.speed` de tempo de jogo. Medir salto com tempo de parede
   cru a 6× acusou 38% de teleporte que era só avanço rápido.

3. **Geometria não pega a saída de bola.** O motor detecta e resolve no mesmo
   passo. Observar `ball.y` na borda contou 1 lateral em 61 min; a bateria mede
   16 por partida. Use o evento (`throw_in`) e o envelope (`_ballOut`).

4. **A marca do batedor morre antes da cobrança.** As camadas de espera limpam
   `__cdsTakerWait` assim que ele chega, e só depois `dead` expira. Medir por
   ela devolve **zero amostra** — não "tudo certo", zero. Lembre o último.

5. **`_setPieceRole` não identifica a barreira.** Marca zona e marcação
   também. A barreira está em `__os36Guard.wall`. E meça **na cobrança**: desde
   a R18.99 ela caminha até os 9,15 m. Medindo na criação, acusei "barreira a
   0,29 m" que não existe — o valor real é 9,54 m.

6. **Confirme a forma do objeto antes de filtrar por ela.** `_bestPass`
   devolve `{m, score, proj, dist, progressM, risk, intoBox, ...}` — **não tem
   `target`**. Testei `best.target`, rejeitei 100% em silêncio, e a bateria deu
   números idênticos à base. Parecia "sem efeito colateral"; era "sem efeito
   nenhum".

7. **Número idêntico à linha de base geralmente significa que sua camada não
   rodou.** Desconfie antes de comemorar.

8. **`browser_smoke.js` prova que o jogo SOBE, não que ele DESENHA.** Ele
   instancia `MatchSim` e roda `step`, mas nunca chama `paintField`. Um erro
   no laço de desenho passa por ele intacto — aconteceu: um TDZ em
   `CDS_F25D.ball` derrubava o primeiro quadro com bola em campo e o smoke
   deu verde. Para código de desenho, a prova é uma sonda de render
   (`__quickMatch` + `page.on('pageerror')`).

9. **O placar a 96 partidas é ruído na borda da faixa. Dose só se compara a
   288+.** Descoberto na OS-231: duas doses do mesmo parâmetro (fator 1,55 e
   1,45 da corrida do batedor) mediram 11/13 e 8/13 — e a velocidade de trote
   de um jogador não pode mexer nisso. A verificação que fecha o assunto:

   > **o controle, sem nenhuma alteração, mede 11/13 a 96 partidas e 10/13 a 288.**

   `blowoutRate`, `redsPerMatch` e `goalsPerMatch` são de contagem baixa e
   ficam encostadas no limite da faixa; a 96 partidas o placar oscila 1–3
   pontos sozinho. Rode 288 (≈15 min com `--workers=8`) antes de aceitar ou
   reprovar uma dose — e compare **métrica a métrica contra o controle no mesmo
   N**, nunca só o "X/13".

   Cuidado extra: **`--semente` não chega aos workers.** Passá-la não muda nada
   e devolve exatamente os mesmos números, o que parece confirmação e é o
   mesmo bundle rodando de novo. Para variar a amostra, use `--matches`.

10. **Sonda que casa dois lances por estado ambiente mede o lance errado.**
   A `validar-lances.js` casava "a falta aberta" com "o último batedor" sem
   perguntar de que rota a espera era: o salto do escanteio era cobrado da
   falta (`F6` acusando 16,83 m numa falta perfeita), e uma falta em que o juiz
   deu vantagem sobrevivia para ser medida contra o reinício da falta seguinte
   (`F2` 22,04 m, `F3` 18,54 m de defeito inexistente). A amarra tem de ser
   por construção — a espera criada dentro de `_awardFoul` é a espera daquela
   falta — e não por proximidade no tempo.

11. **`catch` mudo transforma pane total em "tudo certo".** A ponte de
   amostragem da animação tinha `catch (_) { }`. Um `ReferenceError` por quadro
   dentro de `Controller.update` desligou a **máquina de estados inteira** — 22
   atletas sem gesto, `__animState` nunca escrito, `__CDS_ANIM_BY_KEY` nunca
   publicado — e passaram: `verify.py`, `browser_smoke.js`, a bateria e as
   sondas de tela. O console ficou limpo. Só uma contradição entre duas
   medições (48417 trocas contra 75) forçou a olhar.
   Regras que saíram daí: **zero observação não é zero defeito** (toda sonda
   prova que estava olhando antes de aprovar — é a seção 0 do Árbitro), e
   `catch` que engole erro tem de deixar rastro (`__CDS_ANIM_ERRO`).
   O portão único é `python3 tools/mesa.py`, e ele inclui `--autoteste`:
   injeta essa mesma pane e exige que o Árbitro reprove.

12. **`_emit('pass')` é a CHEGADA da bola, não a saída do pé.** Ele está dentro
   do `onArrive` de `_startTravel`. Ancorar a sonda nele mostra o gesto de
   passe completo "1,3 s antes do evento" — que é o tempo de voo — e faz a
   sonda reprovar 55% dos passes que estavam perfeitos. A saída é o próprio
   `_startTravel(o, alvo, 'pass', …)`. Vale para qualquer medição que amarre
   gesto a evento: **pergunte se o evento marca o começo ou o fim do lance.**

13. **`controle-288.json` está velho — use `controle-288-r1915.json`.** O
   controle antigo é anterior à OS-234 e mede `cornersPerMatch` 12,82 e
   `redsPerMatch` 0,243. Comparar contra ele credita ou culpa a rodada de hoje
   por efeito de rodadas antigas: foi assim que quase atribuí `redsPerMatch`
   0,368 a uma camada que nem roda. A linha de base atual (R19.15, 288
   partidas) é 11/13, com `onTargetRate` 0,324 e `redsPerMatch` 0,368 fora.
   **Antes de comparar, confira de quando é o controle.**

---

## 4. Padrão de defeito que se repete neste código

Vale procurar ativamente, porque já apareceu em três andares diferentes:

> **Um conceito é escrito, é lido, e não pode acontecer.**

- 8 estados de animação declarados e desenhados que nunca viravam quadro —
  três deles eram *pedidos* e atropelados no mesmo tier (OS-210).
- `firstTime` em `_evaluateShotDecision:954` só é calculado dentro de
  `_decide`, que só roda com `settle <= 0` — logo é **sempre falso** (OS-212).
- A correção de velocidade da R18.99/T7 é aplicada quatro níveis por fora da
  ponte de animação, então a animação nunca a vê (OS-207).

Quando encontrar um, **instrumente os três pontos** (pedido → entrada →
efeito) antes de propor conserto. Foi assim que descobri que minha hipótese de
"barrado pelo tier" estava errada: nenhum dos oito era.

---

## 5. Estado atual

Branch `claude/falta-escanteio-animation-bug-97xwj4`. Bateria **11/13** com 96
partidas. Fora da faixa: `onTargetRate` (0,316; piso 0,34) e
`redsPerMatch` — os dois são custo do toque de primeira (OS-212), ligado por
decisão do dono depois de o preço ser apresentado.

`verify`, `browser_smoke` e a varredura de sanidade passam; zero erro de página
em 30.181 quadros.

### Motor

| | o que era | o que é |
|---|---|---|
| **OS-207** | animação amostrada no meio da cadeia de `step` | amostra depois de todos os escritores |
| **OS-210** | `gk_kick`/`gk_throw`/`first_touch_pass`/`placed_shot` entravam e nunca viravam quadro | desenhados |
| **OS-212** | `firstTime` era código morto — a bola nunca andava de primeira | tabelinha sob pressão (dose D de uma varredura de 5) |
| **OS-213** | 24% de quem era desarmado não reagia | 61/61 |
| **OS-214** | pontapé após gol com o time a 19,27 m do posto | 11,60 m |
| **OS-219** | bola alçada saía a 33° e pousava a 0,35 m | 39° e 1,25 m |
| **OS-229** | tático e bola parada disputavam o mesmo corpo | um escritor a menos |

### Desenho

| | o que era | o que é |
|---|---|---|
| **OS-208** | corpo teletransportava junto com a ficha | teto de passo no desenho |
| **OS-209** | 3 caches indexados por nome (homônimos colidiam) | chave por time |
| **OS-215** | fase da passada avançada por deslocamento de quadro | avança no tempo, com teto de cadência |
| **OS-216/218** | balanço decorativo e >100 partículas de rotina por partida | removidos |
| **OS-217** | rastro da bola e anel do portador | removidos (pedido) |
| **OS-220** | bola girava pela posição; ninguém olhava o jogo; quique sem peso | rolagem real, corpo virado para a bola, achatamento |
| **OS-221/222** | pé passava longe da bola; rede estática | contato no alcance; rede estufa |
| **OS-223/226** | câmera com ganho por quadro, sem antecipação | independente de framerate, com lead amortecido |
| **OS-227** | desenhava o estado discreto da simulação | interpolação de passo fixo |

Jitter medido na tela: tremor **6,09% → 4,16%**, salto **53,5% → 32,7%**.

### Validação por invariante (não por média)

```
FALTA     F1 22/22 · F2 22/22 · F4 3/3 (9,54 m) · F5 22/22 · F3 21/22 · F6 19/20
ROUBADA   R1 52/52 · R2 14/14 · R4 10/10 · R3 61/61
LATERAL   L1..L5 todos 22/22
```

---

## 5b. Onde o jitter realmente mora (medido por situação de jogo)

`tools/fisica/tela` — reversão de direção da posição FÍSICA, por quadro:

| situação | reversão | passo médio |
|---|---:|---:|
| portador | 0,1% | 0,062 m |
| arranque | 0,2% | 0,058 m |
| presser | 0,4% | 0,072 m |
| bloco (jogo rolando) | 0,6% | 0,046 m |
| bola morta, sem alvo | 0,6% | 0,037 m |
| **bola morta, COM `__spTarget`** | **2,5%** | **0,166 m** |

A física é suave em toda parte **menos** numa população: quem tem alvo de bola
parada durante a bola morta — passo 3,5× maior e reversão 4× mais frequente.
É o cabo-de-guerra da OS-207, isolado e com número.

**Consequência prática:** atacar a falta pelo desenho é paliativo. A raiz é
arbitragem entre escritores (R15 caminha, OS-107 contém, OS-36 arma a barreira,
o tático puxa), e acrescentar mais um escritor final **piora** — foi medido:
estender o escritor único do pontapé à falta levou o tremor de 4,88% para 8,53%.

---

## 5c. A interpolação de passo fixo, e a armadilha da própria sonda

O laço é de passo fixo e o número de passos por quadro desenhado **varia**
(1, 2, 3). Sem interpolação, um atleta a velocidade constante avança quantidades
diferentes por quadro — jitter de quantização em tudo que se move. Corrigido
(OS-227): salto 53,5% → 32,7%, tremor 6,09% → 4,16%.

**Mas atenção ao escolher onde capturar o estado anterior.** Três variantes:

| captura | tremor | salto |
|---|---:|---:|
| antes da rajada (a que ficou) | 4,16% | 32,7% |
| antes de cada passo | 7,75% | 55,0% |
| antes do último passo | 6,35% | 44,8% |

As duas últimas são a fórmula de livro e mediram **pior**. Ficou a empírica,
com a ressalva: a sonda conta reversão do deslocamento **desenhado**, então ela
pode estar premiando o desenho mais lento. **Quem mexer aqui precisa de uma
sonda que separe suavidade de atraso — a atual não separa.**

---

## 6. Fila aberta, por ordem de evidência

1. **Time espalhado no pontapé após o gol** — relatado pelo dono e confirmado:
   `G1 0/5` (nenhum pontapé com os dois times na própria metade, 4,2 jogadores
   do lado errado), `G2 0/5` (19,27 m médios do posto de formação).
   **Tentei e falhei**: alongar a janela de caminhada (OS-211) derrubou a
   bateria para 10/13 **e não corrigiu** — G1 seguiu 0/4. Revertida.
   *Causa provável*: o sistema tático roda a 100% durante a bola morta e desfaz
   a volta para casa. É o **mesmo cabo-de-guerra** da OS-207: `freeze` é um
   degrau em `dead = 0.4` e as camadas de espera o mantêm desligado segurando
   `dead = 0.12`. A bugadinha da falta e o time espalhado são o mesmo defeito
   visto de dois lugares. Exige rodada de calibração própria — já reprovou uma
   vez.

2. **R3: 24% de quem é desarmado não ganha gesto de perda** (36/46).

3. **`gk_smother` entra 3–5× e nunca vira quadro**, em três rodadas seguidas.
   É o único dos oito gestos que sobrou.

4. **F6: 3 batedores em 22 saltam na cobrança** — o snap de
   `snapTakerBeforeRestart` escapa do orçamento da R18.99 por duas exceções (o
   quadro do reinício termina com `dead <= 0`, e saltos acima de 2,5 m são
   tratados como recolocação administrativa).

5. **Afinar a OS-212** se o dono quiser mais fluidez. O eixo que mais morde é
   `NOTA_MIN` (hoje 2,80); depois `HABILIDADE` (82) e `PRESSAO` (3,8). A
   varredura inteira está no cabeçalho da camada.


---

## 7. Mapa do código

### O core (`src/scripts/`, concatenados nesta ordem — bloco 6 do bundle)

| arquivo | o que vive lá |
|---|---|
| `00-polyfills.js` | boot, guardas de ambiente |
| `10-data.js` | banco de seleções e jogadores (o maior; ~410 KB) |
| `20-core.js` | `ENGINE_CALIBRATION`, utilitários (`clamp`, `lerp`, `facet`, `getAttr`, `chance`, `R`, `FL`, `FW`) |
| `25-data-integrity-v3.js` | validação do banco |
| `30-tactics.js` | formações, estilos, papéis |
| `40-match-engine-and-manager-ai.js` | **`MatchSim` inteiro** + IA de treinador |
| `50-tournament.js` | chaveamento da Copa |
| `60-ui-flow.js` | telas de draft/pré-jogo |
| `70-game-runtime-and-rendering.js` | laço de rAF, `paintField`, todo o desenho |

**`CAL` é local ao core.** Camadas leem a calibração por `ENGINE_CALIBRATION`
(global). `facet`, `chance`, `R`, `clamp`, `FL`, `FW`, `getAttr` e `lerp` são
globais e podem ser usados direto.

### Pontos de entrada globais (úteis para sondar)

```js
window.MatchSim                 // o construtor; prototype é onde as camadas mexem
window.GAME._sim()              // a partida em curso, quando há uma
window.__quickMatch(40, 120)    // sobe partida com render de verdade, pulando o draft
window.CDS_F25D                 // o desenhista 2.5D (CONGELADO — ver armadilha 1)
window.CDS_ANIM                 // máquina de animação: STATES, SEQ, Controller, Machine
window.CDS_ANIM_BRIDGE          // { amostrar, dono } — a ponte, adiável pela OS-207
window.__CDS_ANIM_BY_KEY        // estado de animação por chave de desenho
window.__CDS_SCREEN             // { p: {chave: {x,y,r,s}}, m: matriz } posição de tela
window.G                        // { speed, CW, M, db, cup, screen, ... } estado da UI
```

### A cadeia de `P.step` (ordem do documento = quem roda por fora)

Cada camada faz `const old = P.step; P.step = function(){ ... old.apply(...) ... }`.
A **última do documento é a mais externa**, então ela vê o quadro já terminado.

```
core.step
 └ 12 r7 · 14 r10 · 16 r12/r13 · 17 r13-cadence · 18 r14
    └ 21 ux-boot            <- a ponte de ANIMAÇÃO amostra aqui
       └ 33 · 36 · 39 · 41 · 42 · 43
          └ 60 os46-anim · 63 os77-falta · 64 os83 · 67 os100-lateral
             └ 68 os107-bloco · 69 os112 · 72 r1899-antiteleporte
                └ 75 r1905 · 78 os206 · 79 OS-207 · 80 OS-212   <- mais externas
```

**Consequência que já causou defeito real:** a OS-77, OS-83, OS-100, OS-107,
OS-112 e a R18.99 escrevem `p.x/p.y` **depois** que a ponte de animação (21) já
escolheu a pose. Foi por isso que a OS-207 existiu: ela reamostra no fim.

### Fluxo de um passo

```
step(dt)
 ├ dead > 0 ?  ── sim → _movePlayers(dt, freeze) ; se dead<=0 dispara pendingRestart ; RETORNA
 │                     (não avança o relógio: `minute` só cresce com dead <= 0)
 ├ física da bola: _ballTravel | _ballGlue | _looseRoll
 ├ decisão do portador  ← PORTÃO: owner.settle <= 0 && decideT <= 0  → _decide(o)
 ├ _pressAndTackle / duelos
 └ _movePlayers → _integrate (por jogador) → _resolveOverlaps → commitMovement
```

`commitMovement` é o **único** escritor legítimo de `p.x/p.y` durante o jogo
vivo, e ele deriva `p.vx/p.vy` do deslocamento real. Qualquer camada que
escreve posição sem escrever velocidade cria o "boneco deslizando".

### Campos do jogador que importam

```
x, y            posição em metros (campo 105 × 68)
vx, vy          velocidade — DEVE contar a mesma história que o deslocamento
hx, hy          casa da formação;  dhx, dhy  casa defensiva;  ahx, ahy  ofensiva
maxSpd, acc, turn   limites físicos
settle          > 0 = ainda dominando a bola. BLOQUEIA a decisão.
react           constante de tempo individual (0,062–0,27) usada na suavização
stamina, yellow, red, rating
isGK, slotPos, idx, ref     (ref = registro do banco: id, n, num, a8, attributesV3)
_setPieceRole   'taker' | 'zone' | 'cover' | 'rebound' | 'counter' | 'rest_defence' | 'short_option'
_beatenUntil    defensor passado, penalidade de tempo
__spTarget      alvo de caminhada da bola parada (R15)  ← consumido no bloco 16
```

### Objeto bola

```
x, y, z, vx, vy, vz
owner           jogador com a posse (null = solta)
traveling       em voo
lastTouch, receiver, target, kind ('pass'|'shot'|'cross'), from
```

### Estado da partida

```
sim.t           segundos de simulação
sim.minute      minuto de jogo  (avança só com dead <= 0, a clockRate 0,085)
sim.dead        > 0 = bola morta. NÃO consome relógio de jogo.
sim.pendingRestart   callback que dispara quando dead chega a 0
sim.waiting     pausa administrativa (intervalo, gol)
sim.__cdsTakerWait   { taker, x, y, until } — o batedor armado (some cedo! ver armadilha 4)
sim.__os36Guard      { wall: [...] } — a barreira de falta
```

---

## 8. Calibração (`ENGINE_CALIBRATION`, em `20-core.js`)

Mexer aqui muda placar. Sempre com bateria antes/depois.

```
timing      clockRate 0,085   (min de jogo por s de simulação — NÃO é velocidade de tela)
            decisionInterval 0,28    deadBallRecovery 0,062    tackleCooldown 0,55
possession  firstTouchMin 0,10   firstTouchMax 0,34   transitionProtection 0,42
passing     speedShort 16,2  speedThrough 19,5  speedLaunch 22,5
            baseError 0,018  pressureError 0,075  longPassError 0,090  maxError 0,24
defending   foulBase 0,29  yellowFirst 0,125  yellowSecond 0,05  straightRed 0,0008
            tackleAttemptRate 12,0  boxAttemptRate 4,2
shooting    speedBase 34  speedMin 32  speedMax 54  conversionScale 2,25
attributes  duelSpread 10,5  shotDuelSpread 13,5  traitEffect 0,55
```

**Armadilha de conceito:** `clockRate` decide *quanto futebol acontece* dentro
dos 90 minutos. O botão de velocidade (`G.speed`, padrão 3X) decide *quão
rápido você assiste*. São coisas diferentes — não conserte tempo de tela
mexendo no `clockRate`.

---

## 9. Eventos do motor (`_emit`)

A apresentação inteira se pendura aqui. `by` é quase sempre quem **fez**; em
desfechos defensivos, quem **sofreu** está em `on` — ler só `by` já deixou
gestos mudos.

```
posse/passe    pass{by,to,kind} · bad_pass{by,to,kind} · long_pass{to,progressM}
               intercept{by,contact,through,controlled} · miscontrol_out{by}
duelo          tackle{by,on,source} · tackle_attempt{by,on,distance}
               tackle_missed{by,on,distance} · loose_duel{by,on} · containment{by,on,source}
               dribble{by,on,ok,flair,move} · blocked{by,contact,y,distance}
finalização    shot_taken{by} · header_shot{by,xg} · low_cross_shot{by,from,xg}
               goal{by,golaco,minute} · miss{by,reason,porCima,larga} · post
falta/cartão   foul{by,on} · yellow{p} · red{p,second} · injury{by,team}
               freekick{by,direct,manual,result,pGoal} · falta_cobrada{by,x,y}
bola parada    corner{team,by,x,y,routine,defStyle} · corner_delivery{team,by,swing}
               throw_in{team,by,x,y,to} · goal_kick{team} · offside{by,on}
               offside_restart{team,by,x,y} · kickoff{team}
goleiro        save{gk,big,kind} · gk_claim{gk,by,kind} · gk_claim_miss{gk,by}
               gk_punch{gk,by,corner,x,y} · gk_sweep{gk,by,contact,controlled}
               gk_bad_distribution{by}
contrato       action_prepare{by,action,actionId,prepareDuration}
               action_contact{by,contract} · action_interrupted{by,actionId}
treinador      ai_sub{team,why} · ai_shape{team,form,why} · manager_plan · manager_change
tempo          halftime · extratime · et_halftime
```

---

## 10. Máquina de animação (bloco 21, `cds-ux-boot`)

64 estados em `CDS_ANIM.STATES`, cada um `{ tier, dur }` ou `{ tier, loop:true }`.

```
tiers   T_LOCO 0  <  T_BALL 1  <  T_DEF 2  <  T_ACTION 3  <  T_GK 4
```

Regras que já morderam:

- `request(estado, now, {force, entao})` recusa tier menor sobre gesto em
  curso. `force:true` passa por cima. `entao` encadeia UM desfecho.
- **`beginAction` não passava pela regra** — entrava direto por `_enter`. A
  OS-210 fez a sequência **adotar** a variante (`power_shot`, `first_touch_pass`,
  `cross`…) como primeira fase, em vez de apagá-la.
- O **piso** (locomoção, ou `goleiroFor` para o goleiro) reentra quando a
  duração acaba. Estado com `dur > 0` segura o quadro até expirar.
- `POSE[estado]` = `{esc, spr, inc, agacha, braco, estica}` modula o desenho.
  Sem entrada em `POSE`, o estado desenha como corrida.
- `animWave(estado, fase)` dá o envelope. **Estado sem envelope volta 0 e o
  gesto não se move** — foi o defeito da interceptação (§D39).
- A chave de desenho é `<time>:<ref.id ou nome>` (OS-209). Ponte e desenhista
  **têm de casar**, senão a animação inteira para.

---

## 11. Receitas

### Adicionar uma camada

1. `src/scripts/layers/NN-nome.js` com o padrão IIFE + guarda de idempotência
   (`if (P.__MINHA__) return;`).
2. Marcador `/*__CDS_BLOCK_N__*/` em `src/index.template.html`, na posição
   desejada (**mais no fim = roda por fora**).
3. Entrada em `manifests/build-manifest.json` (`index`, `kind`, `id`, `file`).
4. `build.py` → `verify.py` → `browser_smoke.js`.

### Medir antes de mexer

```bash
# motor
node tools/fisica/bateria.js --build=dist/index.html --matches=96 --workers=8 --out=reports/antes.json
python3 tools/fisica/placar.py reports/antes.json
# tela (o que a bateria não vê)
node tools/fisica/tela/gestos.js dist/index.html --segundos=180
node tools/fisica/tela/validar-lances.js dist/index.html --segundos=420
```

### Sondar sem sujar o jogo

Envolver `P.step` ou `P._emit` numa `page.evaluate` **antes** de
`__quickMatch`. Para o desenho, trocar o objeto `CDS_F25D` inteiro (é
congelado). Nunca editar `dist/` — o próximo build apaga.

### Reimportar um HTML que veio na frente do repo

```bash
python3 tools/import_build.py caminho/do/jogo.html   # reescreve src/ + manifesto
python3 tools/build.py                               # confere sha256: "identico ao HTML importado"
```

---

## 12. Glossário (o código é em português)

```
bola parada / bola morta  set piece / dead ball (sim.dead > 0)
batedor        taker            barreira       wall
cobrança       the kick itself  passada        the stride/gait
lateral        throw-in         escanteio      corner
falta          foul             roubada de bola  tackle/dispossession
pontapé de saída  kickoff       tiro de meta   goal kick
folego         stamina          portador       ball carrier
marcador       marker           cabo-de-guerra tug-of-war (dois sistemas puxando o mesmo jogador)
camada         layer            sonda          probe
laudo          report           dose           the magnitude of a tuning change
```

---

## 13. Convenções do projeto

- **Comentário explica o PORQUÊ e traz o número medido.** O código aqui é
  quase todo comentado assim, e é o que torna possível continuar — mantenha.
- Commits em português, Conventional Commits, com a medição no corpo.
- Camada nova ganha número `OS-NNN` e laudo em `reports/`.
- Nunca reintroduzir teto de altura em `_physicalTargetZ` (era ele que impedia
  chute por cima do travessão — ver `reports/OS-200-fisica-da-bola.md`).
- O ramo `if (p === presser)` do core **não roda** — a camada R13 intercepta
  antes.
- `tools/fisica/calibrar.py` faz varredura de parâmetro sem rebuild, via
  `CDS_OS200_TUNE`.

---

## 14. Como o dono trabalha

Ele reporta por sensação — "bugadinha", "espalhado", "quero sentir fluidez" —
e **está certo todas as vezes**. Traduza a sensação em invariante medível antes
de escrever código; a sonda quase sempre acha mais do que ele descreveu.

Ele aceita "não consegui" com o número do lado. Não aceita — e não deve —
número que você não conferiu.
