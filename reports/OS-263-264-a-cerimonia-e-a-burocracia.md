# OS-263 e OS-264 — a cerimônia e a burocracia

**Data:** 2026-08-19
**Origem:** relato do dono, textual —

> *"A falta está acontecendo do nada, o jogador perde a bola quando eh falta do
> nada, e não tem uma pausa pro batedor bater a falta e você sentir que o lance
> parou, eh como se tudo acontecesse de forma contínua.*
> *Outro pior erro pra mim é a questão de quando rola um gol o jogo começa do
> nada sem os jogadores se organizarem.*
> ***PRECISO QUE VC CONSIGA ASSISTIR UMA PARTIDA COMPLETA PRA VER TODOS ESSES
> BUGS.***"

A terceira frase é a mais importante das três, e ela estava certa como crítica
ao método: **nenhuma sonda deste projeto assistia a uma partida.**
`lance-em-quadros` captura 16 quadros em volta de um evento; o Árbitro julga
ocorrências isoladas; `vida-do-gesto` mede estados por atleta. Todas olham *um
lance*. Os dois defeitos acima não estão dentro de lance nenhum — estão no que
acontece **entre** eles, que é o ritmo da partida.

---

## A ferramenta que faltava

`tools/fisica/tela/a-partida-inteira.js` assiste do apito inicial ao final e
mede, por tipo de reinício:

| grandeza | o que responde |
|---|---|
| **pausa** | quantos ms de **parede** o jogo fica parado |
| **teleporte** | quantos atletas saltam > 6 m num quadro, e o pior salto |
| **caminhada** | quantos metros os atletas percorrem durante a parada |
| **bola parou?** | a bola chegou a ficar imóvel, ou o lance nunca parou |
| **chegou ao posto?** | no instante do reinício, a que distância da formação |

Em ms de **parede**, e não em segundos de simulação — porque a pausa existe
para o olho, e o olho conta no relógio dele. É a mesma lição da OS-260.

---

## A primeira partida assistida

Bélgica 0×3 Inglaterra, 94 minutos, **64 reinícios**, no 3X que é o padrão:

```
   reinicio       n   PAUSA mediana     pior   TELEPORTES   pior salto   andou (m)
   foul          44          300 ms   1083 ms            0        0.0 m         135
   corner         7          517 ms   1067 ms            0        0.0 m         296
   goal           4          733 ms    767 ms            0        0.0 m         589
   offside        4          217 ms    250 ms            0        0.0 m         104
   halftime       1         2800 ms   2800 ms            0        0.0 m          25
```

**Trezentos milissegundos de falta.** Dezoito quadros. Não há olho que registre
isso como parada — e é exatamente o "eh como se tudo acontecesse de forma
contínua".

E a medição matou a minha primeira hipótese, que era a óbvia: **zero teleportes
em 64 reinícios.** A máquina de caminhada da R14/OS-229 funciona. Eu ia consertar
um defeito que não existia; só a partida inteira mostrou isso.

---

## OS-263 — a cerimônia estava sendo tratada como burocracia

`70-game-runtime-and-rendering.js`, linhas 29 e 1918:

```js
const ADIANTA_PARADA = 3.5;
...
const _espera = (sim && sim.dead > 0 && !slowmo) ? ADIANTA_PARADA : 1;
```

**Toda** bola parada era adiantada 3,5×, *em cima* do multiplicador do botão. No
padrão de 3X isso dá **10,5× o tempo real**. Os mesmos 300 ms de falta, rodados
a 1×, seriam 3,1 segundos — que é uma pausa de futebol.

A intenção da OS-203 estava certa e a aplicação era larga demais. Ela mediu que
12,2% da partida é bola parada e chamou isso de *"espera, não futebol"*. Verdade
para a **burocracia** — tiro de meta, arrumação de lateral, recolocar a bola.
Mentira para a **cerimônia** — a falta, o cartão, o pênalti, o gol. Esses são
justamente os momentos em que uma transmissão *demora*: o apito, a reclamação, o
batedor andando até a bola. Adiantar a cerimônia corta a parte que faz o lance
existir.

A camada 85 marca uma **janela de cerimônia em relógio de parede** quando o motor
emite `foul`, `freekick`, `penalty`, `red`, `yellow`, `offside`, `goal` ou
`injury`. Enquanto ela vale, o laço de render não adianta a bola parada e não
aplica o multiplicador do botão: a pausa acontece em tempo real, o jogo esteja em
1X ou em 6X.

**Apresentação pura.** Não toca `dead`, nem `pendingRestart`, nem posição, nem
RNG. O simulador recebe os mesmos passos, na mesma ordem, com os mesmos
resultados — muda só quantos segundos de parede levam para serem desenhados.

---

## OS-264 — a correção funciona, e mesmo assim não embarca

A **pausa** depois do gol está resolvida pela OS-263 (733 ms → 3,7 s). A
**organização** tem correção encontrada, medida — e revertida. O motivo de
reverter é mais útil que a correção.

**O diagnóstico está fechado.** `tools/fisica/o-reinicio.js` mede sem navegador,
34 partidas, ~165 pontapés (a sonda de tela pega 2 a 5 por partida, e com essa
amostra eu propus *duas* correções apoiadas em ruído):

```
R1 distancia MEDIA ao posto      9,7 m
R4 quanto o POSTE andou         32,6 m   <- o alvo foge
R5 quanto o CORPO andou         24,3 m
R3 ja posicionados (<= 3 m)        27%
```

**O poste anda 32,6 m.** Os atletas nunca se dispersaram: eles **perseguem um
alvo que foge**, porque `_kickoff` fotografa `hx`/`hy` num `__spTarget`
congelado e a camada tática passa os segundos seguintes recalculando esses
postos.

Quatro hipóteses caíram antes — teleporte (zero em 64 reinícios), janela curta
(piora), pino no alvo (nada), congelar o poste (R1 de 9,7 → **21,2 m** e R3 →
**zero**). A quinta funcionou, e ela só existiu porque o dono respondeu a
pergunta de design: *"a formação eh a que o time estava"* — a **tática, viva**.
Re-mirar no poste vivo quadro a quadro, com a janela fechando pela convergência
da **média** e não do pior atleta:

| | base | corrigido |
|---|---|---|
| R1 distância média | 9,7 m | **3,2 m** |
| R2 pior atleta | 25,7 m | **14,7 m** |
| R3 já posicionados | 27% | **68%** |

E na partida inteira o veredito virou: *"no reinício, os atletas CHEGARAM ao
posto? **4,4 m**"*.

**Por que mesmo assim não embarca.** `validar-lances.js`, a mesma sonda e a
mesma janela de 460 s, contra o build anterior:

| build | F2 bola no ponto da falta | pior |
|---|---|---|
| **sem OS-264** | **17/17 · 100%** | **0,97 m** |
| com OS-264 (v1) | 84,6% | 16,43 m |
| \+ posse por identidade do alvo | 95,8% | 17,35 m |
| \+ guarda de `pendingRestart` | 90,9% | 19,81 m |

Não é amostra: o pior caso do build sem a OS-264 é **um** metro, e o dela é
**dezessete**, em toda variante. `__spTarget` e `dead` são compartilhados com a
falta, o escanteio, o lateral e o goleiro, e não consegui isolar a janela do
pontapé a ponto de não contaminar a cobrança. **Falta acontece 22 vezes por
partida; pontapé após gol, duas ou três.**

**O que falta para embarcar:** um alvo de caminhada próprio desta camada, que
não seja `__spTarget`, com a camada 18 ensinada a respeitá-lo. Isso é mudança na
camada 18, não aqui — e não se faz no fim de uma rodada.

## OS-266 — a falta acontecia do nada porque não dava tempo de vê-la

A OS-263 deu a **pausa**; não deu a **antecipação**, e "do nada" é a segunda
coisa. Rastreado quadro a quadro, o motor faz tudo certo: emite
`tackle_attempt` antes, os corpos estão a **1,11 m** (contato de verdade), o
faltoso roda `standing_tackle` por 13 quadros e a vítima `fouled` por 25.

Nada disso é invisível por falta de gesto. É invisível por falta de **tempo**:
os 0,52 s de simulação do `fouled` valem 173 ms de parede no 3X. O corpo cai e
levanta antes de o olho registrar que houve contato.

E a alavanca já existia, no lugar errado: a **OS-88** põe câmera lenta na
*cobrança* da falta — o momento burocrático — e não no **contato**, que é o
momento que se julga. Agora entra onde importa: 650 ms a 0,40× no instante do
apito, e a câmera lenta **vence** a janela de cerimônia (sem essa precedência a
OS-263 anulava o fator e a batida virava velocidade normal).

## OS-265 — o braço subia no mesmo estalo da perna

Relato: *"eh feio a maneira que pula os braços"*. E era regressão minha, da
OS-258. Aquela OS deu amplitude própria ao gesto com ataque de `0,09 s` de
**simulação** — no 3X padrão, **30 ms de parede: dois quadros**. A perna precisa
desse estalo; um chute *é* um estalo. O braço não: ele abre até `P.braco`, que
chega a 2,1, e fazer isso em dois quadros lê como salto, não como balanço.

Pior: a rampa era **linear**, então a velocidade do membro pulava de zero ao
máximo no primeiro quadro. Descontinuidade de velocidade é exatamente o que o
olho chama de "pulo", e valia para os dois membros.

Agora há smoothstep nas duas rampas — mata o canto sem alongar nada — e o braço
tem ataque próprio, três vezes mais longo, com cauda mais longa também.

E o marcador da falta: o `❌` era 22 px, o maior de todos os efeitos do laço
(contra 14 do escudo e 12×17 do cartão), e um símbolo que lê como *erro*.
Ampliando um quadro da falta, o que domina o enquadramento é um X vermelho
gigante, e o bote do faltoso e a queda da vítima ficam por baixo dele. Virou
marcador pequeno acima da cabeça, na linguagem que o resto já usa.

## O resultado, na partida inteira

94 minutos, 69 reinícios, no 3X que é o padrão:

| reinício | antes | depois |
|---|---|---|
| **falta** | **300 ms** | **1955 ms** |
| **gol** | **733 ms** | **3700 ms** |
| impedimento | 217 ms | 1400 ms |
| burocracia (rotina, escanteio) | — | 302–756 ms |

A cerimônia e a burocracia estão separadas por um fator de 4, que é o desenho
pretendido — o escanteio **continuou** rápido, e isso é o certo.

**Mesa: APROVADO nas sete etapas**, com as janelas das sondas de tela
ampliadas (ver abaixo).

## As janelas das sondas tiveram de crescer

Efeito colateral legítimo da OS-263, e vale registrar porque é a **terceira**
vez que o mesmo relógio trocado aparece nesta rodada: a Mesa orça as sondas de
tela em segundos de **parede**, e o jogo agora gasta parede de propósito. Nos
mesmos 150 s a sonda passou a ver ~30% menos futebol — o Árbitro reprovou por
`defesa: 0 de 0` (sem amostra, que pela doutrina da OS-247 **não** é aprovação)
e `lances` reportou a falta em 73,3% sobre denominador 15, enquanto a mesma
invariante em 120 partidas dá 99,5% sobre 2655 cobranças.

Não se afrouxa o limiar nem a doutrina: aumenta-se a janela. `SEGUNDOS` foi de
150 para 230 e `lances` de 300 para 460.

## O custo, medido

A **OS-263** e a **OS-266** são apresentação pura: não tocam `dead`,
`pendingRestart`, posição nem RNG. O simulador recebe os mesmos passos, na mesma
ordem, com os mesmos resultados — muda só quantos segundos de parede levam para
serem desenhados.

A **OS-264** mexe em `dead`, e o motor vê. Bateria de 96 partidas:

| métrica | sem OS-264 | com OS-264 |
|---|---|---|
| goalsPerMatch | 3.45 *(acima)* | 3.41 *(acima)* |
| onTargetRate | 0.330 *(abaixo)* | 0.333 *(abaixo)* |
| redsPerMatch | 0.406 *(acima)* | 0.281 ✓ |
| zeroZeroRate | 0.042 *(abaixo)* | 0.094 ✓ |
| drawRate | 0.250 ✓ | 0.240 ✓ |
| **placar** | **9/13** | **11/13** |

As duas que faltam já falhavam antes nesse conjunto de sementes. **A ressalva
continua valendo:** mudar `dead` desfasa o consumo de RNG, então as duas rodadas
viram partidas diferentes depois do primeiro gol e isto não é comparação
pareada. O que sustenta é **não degradou** — e 11/13 fica acima da linha de base
documentada no CLAUDE.md (10/13).

## O que continua em aberto

- **`atleta_congelado_20s` é intermitente e PRÉ-EXISTENTE.** A Mesa reprovou uma
  execução com 3 ocorrências (Beckham). Repetindo na mesma build: limpo. E o
  build **já commitado** (HEAD anterior) também acusa 1 ocorrência (Courtois) em
  1 de 3 execuções. Nenhuma mudança desta rodada mexe na simulação — ângulo de
  membro e acumulador de render não congelam jogador — então não é regressão
  daqui. Mas é defeito de verdade: um atleta que não anda 1,5 m em 20 s de jogo
  **vivo** não é futebol. Fica na fila, e a `sanidade` deveria rodar com semente
  fixa para deixar de ser loteria.
- **A formação do pontapé inicial** — ver OS-264 acima: falta a decisão de design
  antes de qualquer código.


- **A falta ainda "acontece do nada" no sentido de causa**, e isso a OS-263 não
  resolve. Ela dá a pausa; não dá o aviso. O jogador perde a bola e o apito vem
  junto, sem antecipação visível — não há gesto de entrada faltosa antes do
  evento. Isso é motor, não apresentação: exigiria um `tackle_attempt` faltoso
  visível antes de `foul`.
- **`onTargetRate` 0.322 contra piso de 0.34** — item antigo, não tocado aqui.
- A etiqueta de tipo da sonda é aproximada: ela associa a parada ao último evento
  de causa emitido nos 2,5 s anteriores. Reinícios sem causa recente entram como
  `rotina`. Corner e lateral às vezes caem em `rotina`.
- A OS-264 usa o mesmo par `WALK_SPEED`/`maxSpd` da camada 18 por cópia, não por
  referência. Se a camada 18 mudar a velocidade de caminhada, esta camada não
  acompanha.
