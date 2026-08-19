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

## OS-264 — quatro hipóteses, quatro reprovações, nada embarcado

A **pausa** depois do gol foi resolvida pela OS-263 (733 ms → 3,3 s). A
**organização** não foi. Registro o que se tentou, porque isso vale mais que um
remendo não provado — e porque cada hipótese foi derrubada por medição, não por
argumento.

A sonda que decide é `tools/fisica/o-reinicio.js`: sem navegador, 34 partidas,
**164 pontapés**. A sonda de tela pega 2 a 5 por partida — e com essa amostra eu
já tinha proposto *duas* correções apoiadas em diferenças que eram ruído.

**Linha de base, 164 pontapés:**

```
R1 distancia MEDIA ao posto no reinicio      9,7 m
R2 atleta MAIS LONGE                        25,7 m
R4 quanto o POSTO andou na parada           32,6 m
R5 quanto o CORPO andou na parada           24,3 m
R3 ja posicionados (<= 3 m)                    27%
```

1. **Teleporte.** Errada — zero teleportes em 64 reinícios.
2. **A janela é curta** (`DEAD_CAP = 2,2` s cobre 13 m; a volta passa de 40 m).
   Aloguei: reprovou com 16,5 m. Alongar sozinho **piora**.
3. **Quem chega é solto para a IA tática.** Pino reassinando o alvo: `alvos` foi
   a 22/22 e a distância continuou crescendo.
4. **O alvo foge** — e `R4 = 32,6 m` mostra que é verdade: o *poste* anda mais
   que o corpo. Re-mirei no poste vivo (15,8 → 12,3 m na sonda de tela, dentro
   do ruído). Depois congelei o poste no instante do pontapé: **R1 foi de 9,7
   para 21,2 m e R3 de 27% para zero.**

**Por que a 4 não conclui, e é o ponto honesto:** congelar leva os atletas à
formação de *pontapé inicial*, que é onde o futebol os quer — mas R1 mede
distância ao `hx` **vivo**, e o jogo move esse `hx` para a forma tática assim
que a janela solta. Então o comportamento provavelmente *certo* pontua péssimo,
e a métrica não sabe distinguir os dois casos.

**O que falta não é código:** decidir qual formação vale no instante do pontapé
— a de pontapé inicial (congelada) ou a tática (viva). É decisão de design do
dono. Enquanto não houver, qualquer correção aqui pontua contra si mesma.

---

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
