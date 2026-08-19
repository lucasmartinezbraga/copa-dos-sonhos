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

## OS-264 — investigada, **reprovada pela própria medição, e não embarcada**

A segunda metade do relato — *"quando rola um gol o jogo começa do nada sem os
jogadores se organizarem"* — não foi resolvida. Três hipóteses, todas testadas,
todas derrubadas:

**1. Teleporte.** Errada. Zero teleportes em 64 reinícios.

**2. A janela de caminhada é curta demais.** `deferPositions` (camada 18) tem
teto `DEAD_CAP = 2.2` s, que a 5,98 m/s cobre 13 m; depois de um gol a volta ao
posto passa de 40 m. Implementei o alongamento — e a métrica direta *("a que
distância do posto o atleta está quando a bola volta a rolar")* **reprovou a
correção**: 16,5 m na média, pior a 43 m. O traço quadro a quadro mostrou o
oposto do esperado:

```
KICKOFF  dead 0 -> 3.48 | com __spTarget 22/22 | mais longe 17.2 m
   dead 3.48 | alvos 22 | ao posto: media   7.0 m
   dead 3.07 | alvos 21 | ao posto: media  18.5 m    <- AFASTANDO
   dead 2.27 | alvos 12 | ao posto: media  26.1 m    <- AFASTANDO
   dead -0.01 | alvos  0 | ao posto: media  16.5 m
```

No instante do pontapé eles estão a **7 m** do posto e depois **andam para
longe**. Alongar `dead` *piora*: dá mais tempo para se dispersarem.

**3. Quem chega ao posto é solto para a IA tática.** A camada 18 apaga
`__spTarget` na chegada e a OS-229 só cede o comando enquanto ele existe.
Implementei um pino que reassina o alvo: `alvos` passou a ficar em 22/22 e a
distância **continuou crescendo** (8,4 → 25,9 m). A hipótese também não explica.

**O que falta separar, e por isso nada foi embarcado:** a sonda mede distância
ao `hx`/`hy` **vivo**, e a camada tática recalcula esses postos. Então "o atleta
se afastou" e "o posto se moveu debaixo dele" dão exatamente o mesmo número.
Até isso ser separado, qualquer correção aqui é chute — e já houve três.

O que ficou do gol foi a **pausa**: 733 ms → 3048 ms, e ela vem inteira da
OS-263, que é apresentação pura.

## O resultado, na mesma sonda e na mesma velocidade

Partida de confirmação com o build que embarca (OS-263 sozinha), 94 minutos,
60 reinícios, 3X:

| reinício | antes | depois |
|---|---|---|
| **falta** | **300 ms** | **1916 ms** |
| **gol** | **733 ms** | **3116 ms** |
| escanteio | 517 ms | 1183 ms |
| rotina (burocracia) | — | 456 ms |

```
   VEREDITO
     ok  a CERIMONIA se ve? (mediana >= 700 ms)        1924 ms em 25 paradas
     ok  a BUROCRACIA continua passando rapido?         456 ms em 35 paradas
     ok  depois do GOL da tempo de se organizar?       3116 ms
     ok  depois do GOL os atletas ANDAM ate a posicao?  0 teleportes
    NAO  no reinicio, os atletas CHEGARAM ao posto?    15,8 m na media
     ok  a FALTA para o jogo?                          1916 ms
     ok  a bola chega a ficar parada na falta?         18 de 18
```

A cerimônia e a burocracia agora estão separadas por um fator de 4, que é o
desenho pretendido. E a linha que **continua reprovando** é a que eu mesmo
acrescentei para julgar a OS-264 — ela fica no relatório de propósito.

## O custo, medido

A OS-263 é **apresentação pura**: não toca `dead`, nem `pendingRestart`, nem
posição, nem RNG. A bateria nem enxerga a camada `cds-ux-boot`-adjacente, e o
simulador recebe os mesmos passos com os mesmos resultados. Não há placar a
comparar porque não há nada no motor que possa ter mudado.

A OS-264, que **mexia** em `dead`, foi medida antes de ser descartada — 96
partidas, mesmas sementes: 9/13 sem ela, 10/13 com ela. Só que assim que `dead`
muda, o número de chamadas de `step` muda, o consumo de RNG desfasa e as duas
rodadas viram partidas diferentes depois do primeiro gol; **não é comparação
pareada**. Como ela também foi reprovada no que se propunha a corrigir, saiu.

Mesa: **APROVADO nas sete etapas**.

## O que continua em aberto

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
