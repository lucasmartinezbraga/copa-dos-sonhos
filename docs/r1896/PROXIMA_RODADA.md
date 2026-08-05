# Ordem de serviço para a próxima IA

Leia `HANDOFF.md` primeiro — ele tem as armadilhas e o contrato de método.
Este documento é a **fila de trabalho**.

Onde está escrito **medido**, tem número. Onde está **localizado**, eu achei a
âncora e **não** medi — não invente um número para ela.

Regra que vale para todos: **previsão registrada antes de medir**, direção e não
porcentagem, e a bateria de **seis** bases antes de promover.

---

## PARTE A — o que o dono pediu e ainda não foi feito

### A0. Os 1,13 chutes que somem no jogo corrido · ABERTO · É O PRÓXIMO

**Herança direta da OS-107, que foi promovida com este custo na mesa.**

`chutes` caiu de 19,13 para 17,59 por partida, **negativo nas seis bases**. A
decomposição por fase (`diag_os108`, tempo vivo como base) diz onde:

| fase | Δ chutes | leitura |
|---|---:|---|
| janela do cruzamento (0–2,5 s) | −1,54 | **pretendido** — a área passou a ser defendida |
| pós-reinício (2,5–12 s) | +0,38 | **ganho** — 0,715 → 1,066 chute/min vivo |
| jogo corrido | **−1,13** | **sem canal isolado** |

**O que já está descartado, não refaça:**

- **fadiga.** `:4859` dá `return` antes do bloco de stamina: bola morta não gasta
  fôlego nem relógio. Medido: tempo vivo 748,0 → 750,6 s, stamina final 45,15 →
  45,35, distância 2805 → 2833 m;
- **a E3.** A culpa é do **pino**: "só o pino", que não marca papel nenhum, perde
  1,21 sozinho (`--pino=1 --falta=0 --defesa=0`);
- **o vazamento de papel**, que existia e foi corrigido — valia só +0,29 chute.

**A hipótese a medir:** o pino segura a forma dos dois times até a cobrança,
então o lance termina com o time que ataca comprometido dentro da área e o resto
fora da posição tática. Meça a **reorganização depois do reinício**: quanto tempo
vivo cada equipe leva para voltar à distância tática média, e o que acontece com
a finalização nesse intervalo. Sinal compatível que **não** prova: retenção de
posse 10 s após o reinício caiu de 12,2% para 7,9%.

**Cuidado especial nesta rodada:** a R18.97 está a **0,0125 do piso** do gate de
gols, cujo ruído é ±0,3. Não há folga. Rode a bateria completa antes de concluir
qualquer coisa, e olhe consistência entre bases, não média.

### A1. O time não se move para o lance no escanteio e na falta · RESOLVIDO · PROMOVIDO NA R18.97

> *"Quando acontecer o escanteio o time tem que ir pra área, mesma coisa a falta,
> isso você está pecando, o time não se move para a direção do lance igual em uma
> partida real."*

**O censo foi feito** (`tools/r1896/diag_os107_bloco_bola_parada.js`, 12 partidas)
e **o dono estava certo, com número**:

| | medido na R18.96 |
|---|---:|
| atacantes na grande área quando o escanteio é cobrado | **0,656** |
| postos do escanteio ainda ocupados no reinício | **28,8%** (chegam 100%) |
| defensores dentro da própria área na falta cruzada, no apito | **0,095** |
| teleporte dos alvos na falta cruzada | **247 de 840**, máx **70,40 m** |

A coreografia do escanteio **existe e acerta 100%** — ela é desfeita nos ~3 s de
bola morta que sobram, porque `:18287` limpa `__spTarget` no snap de chegada e
nada segura o jogador depois disso. A falta cruzada não tem coreografia
nenhuma: `:6951` escreve posição direto (a R15 nunca foi estendida a
`_freeKick`) e o time que defende não recebe posto algum.

**A correção está NA CADEIA desde a R18.97**
(`tools/r1896/patch_os107_bloco_bola_parada.js`, com flags `--pino`, `--falta`,
`--defesa`, `--teto` que separam as três edições). Leia
`reports/r1896/RODADA_OS107_BLOCO_BOLA_PARADA.md` e
`RODADA_OS108_OS109_CANAL_DOS_CHUTES.md`.

**O que ela resolve, medido:** postos ocupados no reinício 28,8% → 94,3%;
atacantes na área 0,656 → 2,233; defensor na própria área na falta 0,262 →
4,468; teleporte de 70,4 m → **zero em 2140 jogadores**.

**O que ela custa.** Com a bateria oficial (24 × 6 = 144 partidas) ela
**reprovou**: gols 2,1805 → 1,9722, pior base 1,5417 contra um piso de 1,8.
Com **48 × 6 = 288 partidas ela passa nos três gates**, 6/6, pior base 1,8125.

Isso não é contradição, é a bateria oficial não tendo resolução — leia a §3.2b
nova do HANDOFF. Duas metades da **mesma base e mesma build** chegam a diferir
**0,79 gol**; a folga do gate é 0,075.

### Como ela foi de reprovada a promovida — e por que isso não é troca de régua

Vale a pena entender a sequência, porque ela é o método funcionando:

1. com a bateria de então (24 × 6) ela **reprovou**: gols 1,9722, pior base
   1,5417 contra um piso de 1,8;
2. 288 partidas mostraram que aquela reprovação era **ruído do protocolo** —
   duas metades da mesma base e mesma build diferem até 0,79 gol (§3.2b);
3. o protocolo oficial passou para **48 partidas por base**, a linha de base foi
   re-medida e a §4 do HANDOFF foi reescrita — **item A3, feito**;
4. a OS-108/OS-109 achou e corrigiu um **bug do próprio patch** (o papel `zone`
   vazando para o jogo corrido, §2.3c), e decompôs o custo restante;
5. a build corrigida passou nos **três gates 6/6** na bateria nova;
6. o dono decidiu promover com o preço na mesa.

**O preço aceito, com número:** chutes 19,13 → 17,59 por partida, negativo nas
seis bases, em troca da área deixar de ser cobrada vazia dos dois lados.

Nota sobre um falso alarme já descartado: com 24 partidas parecia que **só o
pino** derrubava escanteios de 4,785 para 4,028 (pior base 3,458). Com 288
partidas o efeito some (4,9305 contra 4,8785, e só 2 das 6 bases negativas).
Era ruído. Não gaste rodada nisso.

**O que ficou aberto virou o item A0, no topo desta fila.**

### A2. A física da espalmada do goleiro · NÃO INICIADO

> *"A física da espalmada do goleiro precisa ser melhorada."*

Nada medido. Comece por: para onde a bola vai depois da espalmada, com que
velocidade, se sai para escanteio ou fica viva, e se o vetor de saída tem
qualquer relação com o ângulo de chegada e com o lado do mergulho.

Contexto útil já medido: `_gkResolveSave` produz 2,167 espalmadas por partida, das
quais 1,0 vira escanteio e 1,167 fica viva (contadores da camada R18.18.3, que
são legítimos e funcionam).

---

### A3. A bateria oficial passou para 48 partidas por base · FEITO

**Isto vinha antes de qualquer decisão de gol, e está feito.**

Medido na OS-107: entre duas metades da **mesma base com a mesma build**, gols
diferem até **0,7916**. A folga da build promovida acima do piso é **0,075**.
O gate reprovou um patch que passa com o dobro da amostra.

O que foi feito:

1. a linha de base da R18.96 foi re-medida com 48 partidas nas seis bases —
   `reports/r1896/bateria_48x6_base.json`;
2. a §4 do HANDOFF foi reescrita com essa amostra (gols 2,149 / pior 1,958,
   xG 2,170, escanteios 4,879 / pior 4,417, chutes 19,13);
3. o protocolo oficial passou para 48 e está na §3.1, com um único comando:
   `tools/r1896/bateria_oficial.sh <build.html>`.

**O que isso NÃO resolve:** diferença de gol menor que ~0,3 continua fora do
alcance. Antes de acreditar numa média, olhe se o sinal se repete nas **seis**
bases — foi assim que a OS-107 separou `chutes` (negativo em 6 de 6, real) de
`gols` (troca de sinal, não estabelecido).

---

## PARTE B — o achado mais importante que ficou aberto

### B1. O teto de 1,74 m: o ângulo superior do gol não existe

**MEDIDO.** Passei `z = 3,55` ao planejador de trajetória e ele devolveu `2,35`:

```js
:19691  if(target&&Number.isFinite(target.z))return clamp(target.z,0,2.35);
:19697  if(kind==='shot'){ ... return clamp(finite(base,.72),.14,1.74); }
```

- chute **sem** `z` explícito: travado em **1,74 m**
- chute **com** `z` explícito: travado em **2,35 m**
- travessão: **2,44 m**

Consequência: **nenhuma bola chega à parte de cima da meta** — nem para entrar,
nem para o goleiro voar, nem para sair por cima. Medido em todas as builds:
`passaramPorCimaDoTravessao = 0`.

Isto é provavelmente a raiz de várias sensações de "estranho" na finalização, e
pode explicar por que a tentativa B2 abaixo custou gols.

**Cuidado:** o teto geral existe por um motivo — sem ele, passe e cruzamento
viram bola aérea absurda. Qualquer mudança tem de distinguir chute de passe.

---

## PARTE C — medidos, funcionam, e foram REPROVADOS pela bateria

Não os refaça sem entender por que caíram. Estão no repositório, desligados.

### C1. Chute por cima do travessão (OS-104) — `patch_os92_chute_fora.js --porCima=1`

**Funciona:** `passaramPorCimaDoTravessao` vai de **0 para 15 em 51** chutes
(29,4%, faixa real ~30–40%), e a garantia da OS-92 sobrevive — **zero** voltam a
cruzar entre as traves.

**Reprovou:**

| semente | gols |
|---:|---:|
| 4200000 | 2,2917 |
| 8400000 | 1,8333 |
| 1260000 | 1,8750 |
| **2100000** | **1,4583** ✗ |
| 6300000 | 2,5833 |
| 3150000 | 2,0833 |
| **média** | **2,0208** (contra 2,181) |

**A pergunta a responder antes de religar:** nenhum lance muda de desfecho — o
chute já era erro e continua erro, só voa mais alto. Então deveria ser caos puro.
**1,4583 é forte demais para caos.** Descubra o canal. Suspeita: o voo alto dura
mais, e a duração muda a sequência de RNG de tudo o que vem depois.

### C2. Condução da bola (OS-105) — `patch_os105_conducao.js`

**O defeito é real e está medido.** `_ballGlue` (`:6674`) solda a bola a exatos
**0,55 m** do jogador, sempre apontando para o **gol** — não para onde ele corre.
Quem se desloca de lado leva a bola flutuando ao lado do corpo. Ela nunca quica,
nunca sai do pé.

Isso ficou visível depois da OS-98: o finalizador passou a carregar a bola em
**19 dos 19 quadros** antes do chute (era 16, com p25 de 12).

**Reprovou:** primeira base de 12 partidas deu **gols 1,4167**. É a armadilha que
eu havia registrado no cabeçalho: `_ballGlue` roda **todo quadro** e afastar a
bola do pé a aproxima dos adversários.

**Se voltar:** reduza o teto de 0,78 para perto de 0,60 m e **meça desarmes e
interceptações** antes de gastar a bateria.

---

## PARTE D — o estrutural, com a alavanca já encontrada

### D1. Domínio da bola: 0,267 s contra 1,1–1,4 s reais

A alavanca **existe e foi encontrada** (OS-98, promovida): trocar `Math.min` por
atribuição em `:6798` fez o domínio responder ao parâmetro pela primeira vez.

| espera | domínio | xG | passes |
|---|---:|---:|---:|
| base | 0,200 s | 2,064 | 459,8 |
| **0,28** (promovido) | **0,267 s** | 2,004 | 444,4 |
| 0,60 | 0,567 s | 1,560 (−24%) | 397,1 |

**Ela não fecha o buraco sozinha.** Chegar a 1,1 s exigiria espera de ~1,2 s, e a
varredura mostra que aí a ecologia desaba.

**Não tente compensar por `clockRate`** — já foi falsificado: escalar
`decisionInterval` e `clockRate` juntos levou passes de 451 para 758 e gols de
1,81 para 4,38. O produto não é constante.

### D2. Volume global: o jogo roda a 45–65% do futebol

| por partida | jogo | real | proporção |
|---|---:|---:|---:|
| passes | 442 | ~900 | 49% |
| escanteios | 4,8 | ~10,5 | 46% |
| faltas | 14,5 | ~22 | 66% |
| chutes | 19,2 | ~25 | 77% |
| gols | 2,18 | ~2,7 | 81% |

**Escanteio não está quebrado.** Eu investiguei a fundo: `_setCorner` é chamado
10,25×/partida, 5,8 contam, e a diferença **não é supressão** (essa é
0,25/partida) — a camada R18.18.3 converte bloqueio, espalmada e soco em
trajetória física e o escanteio nasce depois em `_ballOut`. Três medições
independentes fecham entre si.

O que existe é que **escanteio está na mesma proporção que passe e falta**. É
volume global, governado por `clockRate = 0,13`. Mexer no escanteio isoladamente
é consertar sintoma — e o gate `ECO-05` (4–10) foi calibrado em volta dos ~5 do
próprio jogo, com o futebol real encostado no teto.

**Esta é a rodada mais perigosa do projeto.** Se for encarada, encare o volume,
não um evento por vez.

---

## PARTE E — abertos menores, com número

| item | medido | referência |
|---|---:|---:|
| gol de falta, especialista | 6,68% | ~8–10% |
| barreira na falta | 17–18% | ~20–25% |
| bola no ar | ~55% do tempo | ~28% |
| distância por jogador | 18,8 km | ~10,5 km |
| passe para trás com espaço à frente | **só localizado** | — |

### Sobre a barreira (`wallRisk`, `:2882`)

Eu preparei um patch (`patch_os102_barreira.js`) e **não o rodei na bateria**.
Ele corrige nível **e forma**: hoje `wallRisk` **não usa `dtg`**, então o risco é
o mesmo a 18 m e a 32 m — e o pouco que varia está **invertido** (16,86% a 22 m
contra 18,04% a 28 m). Com `base=0.48` o modelo puro dá 23,6% a 22 m e 20,0% a
28 m, monotônico e na faixa real.

**Correção importante a um erro meu:** eu escrevi que subir a barreira "abriria
folga no ECO-02". **Não abre.** `stats.xg += pGoal` acontece em `:7003`
**antes** de ramificar o desfecho — barreira tira gol e **não** tira xG.

### Sobre o passe para trás

> *"O jogador dá uns passes pra trás quando tem espaço pra correr pra frente...
> já vi o Neymar driblar, infiltrar na ponta e tocar pra trás em vez de chutar."*

Duas âncoras **localizadas e não medidas**:

```js
:5672  const backPen = progressM < -4 ? (1.1 * (1 - Math.min(0.9, circ))) : 0;
:5295  let take = longPermission && shotUtility>=minimum && shotUtility>=passUtility*choiceRatio;
       // choiceRatio = oneOnOne?.22 : longshot?.82 : .38
```

Só pune recuo maior que 4 m, e a punição encolhe até 0,11. O chute só acontece se
valer 38% da melhor opção de passe.

**Armadilha séria:** os dois mudam a ecologia inteira. **Meça a população
primeiro** — em quantas ações o jogador está no terço final, sem pressão, com
ângulo, e escolhe passe para trás? Se forem poucas, o defeito é de **percepção**
(o lance é raro mas memorável) e mexer no portão vai estragar o jogo inteiro
para consertar uma cena.

---

## PARTE F — não repita estes

Falsificados com número. O registro completo está nos `RODADA_*.md`.

| tentativa | o que a medição mostrou |
|---|---|
| corrigir trajetória de chute na camada externa, **antes** da original | alterou alvos que já saíam bem; empurrou um bom para dentro (folga 1,14 → −0,29) |
| corrigir trajetória no **núcleo** de `_startTravel` | núcleo é alcançado (49/49) e calculou 30 correções — bateria saiu **byte a byte igual** |
| corrigir trajetória na camada externa, **depois** da original | corrigiu `ball.target` 30× e a bola foi ao alvo antigo (38,045 → 39,569, terminou em 38,05) |
| limitar o empurrão da barreira por "teto físico" | a régua estava errada: `VMAX = 7` é a velocidade do **empurrão**, não de corrida. A correção **piorou** (1,14% → 1,48%) |
| criar seleção própria de cobrador de lateral | matou o teleporte e fez a bola reaparecer a **4,6 m** do ponto |
| multiplicar o **valor** do teto de `decideT` (OS-68, rodada anterior) | domínio idêntico — o **operador** já o tornava inerte |
| acoplar `decisionInterval` e `clockRate` (OS-67, rodada anterior) | passes 451 → 758, gols 1,81 → 4,38 |
