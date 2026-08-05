# Fila de trabalho depois da R18.87

Regra que vale para todos: **previsão registrada antes de medir**, direção e não
porcentagem, e a bateria antes de promover — em **seis** bases, não três (ver
`baseline_r1886_6bases.md`).

Onde está escrito **medido**, tem número. Onde está escrito **localizado**, eu
achei a âncora e **não** medi — não invente um número para ela.

---

## 1. O chute para fora cruza a linha entre as traves — MEDIDO, ABERTO

**Este é o maior desta fila, e a R18.87 não o resolveu.**

Medido na R18.86, 8 partidas, 63 chutes para fora, retro-projetando a bola real
(posição e velocidade no quadro da emissão) até `x = g.x`:

| grandeza | valor |
|---|---:|
| cruzaram a linha **entre os postes**, sob o travessão | **27 de 63 · 42,9%** |
| passaram por cima do travessão | 0 |
| penetração máxima dentro do gol | **3,39 m** (meia largura: 3,66) |
| folga ao poste, mediana | 0,48 m |
| folga ao poste, p10 | **−1,02 m** |

Quase metade dos chutes que o jogo narra como "manda pra fora" **entram no gol**.

### Mecanismo

O alvo do desfecho `miss` fica 2 a 3 m **atrás** da linha, com desvio lateral
sorteado em torno do centro do gol — `:5413`, `:5524`, `:5526`, `:6314`,
`:6338`, `:6355`, `:6386`, `:6982`, `:6989`, `:6991`, `:7065`. A bola viaja em
reta do pé até lá. Como o alvo está atrás da linha, o segmento cruza a linha
**antes**, num ponto mais para dentro — tanto mais quanto mais fechado o ângulo.
O desvio foi sorteado para o ponto de **parada**; quem decide o que o olho vê é
o ponto de **cruzamento**.

### Três tentativas, três falsificações — leia antes de tentar a quarta

| versão | onde injetei | o que a medição mostrou |
|---|---|---|
| v1 | camada nova no fim do arquivo, **antes** de chamar a original | alterou alvo de todo chute e chegou a empurrar um bom para dentro (folga 1,14 → −0,29) |
| v2 | dentro do **núcleo** de `_startTravel` | núcleo é alcançado (49 chamadas / 49 chutes) e calculou correção para **30** chutes — bateria saiu **byte a byte igual** à base |
| v3 | camada no fim, **depois** de chamar a original | corrigiu `ball.target` **30 vezes** (confirmado) e a bola ainda assim chegou ao alvo **antigo** |

A prova da v3, num lance: alvo corrigido de `38,045` para `39,569`, e a bola
terminou em **`38,05`**.

### O que isso ensina, e que vale mais que o patch

**Quatorze** sítios envolvem `_startTravel` neste arquivo: `:14672`, `:14789`,
`:15253`, `:16286`, `:16534`, `:16734`, `:19247`, `:21424`, `:22195`, `:23123`,
`:23471`, `:24650`, `:24762`, `:24878`. Nem a camada mais externa nem o núcleo
mandam na trajetória. **Alguém fotografa o voo e o executa a partir dessa
fotografia** — o candidato é a camada de física/timeline em `:14785`–`:15253`
(`p04StartTravel`, `actorPoint`, `motionDistance`).

**Próximo passo, e não é escrever patch:** instrumentar quem escreve
`ball.x/ball.y` durante um voo de chute, com a técnica do HANDOFF §2A (setter na
propriedade, capturando a pilha). Só depois de saber quem executa o voo é que
existe lugar certo para corrigir a geometria.

### Consequência já assumida na R18.87

A camada de apresentação ancorava o veredito no ponto de cruzamento
retro-projetado. Como esse ponto cai dentro da meta em 42,9% dos casos, ela
desenharia "FORA" dentro do gol. Enquanto a geometria não for corrigida, o
veredito é ancorado **onde o motor de fato encerrou o lance**, e a folga
anunciada é a desse ponto. É uma afirmação verdadeira sobre o que o jogo
decidiu — não sobre o que a física deveria ter feito.

---

## 2. O lateral não é cobrado — LOCALIZADO, não medido

> "Aconteceu também do Neymar ir bater o lateral e sair driblando."

`_ballOut`, `:7165`–`:7175`:

```js
} else {
  // lateral: reposição para o time que não tocou por último
  this.dead = 0.65;
  const to = 1 - lastTeam;
  this.pendingRestart = () => {
    const y = clamp(b.y, 1, FW-1);
    const cand = this.teams[to].players.filter(p=>!p.red&&!p.isGK)
                 .sort((a,b2)=> Math.abs(a.y-y)-Math.abs(b2.y-y))[0];
    if (cand){ cand.x = clamp(b.x,1,FL-1); cand.y = y; this._giveBall(cand); cand.settle = 0.5; }
    else this._contestLoose();
  };
}
```

Não existe arremesso. O jogador mais próximo é **teletransportado** para o ponto
da bola (`cand.x = ...; cand.y = y`), recebe a posse e, passado o `settle` de
0,5 s, **joga**. É por isso que ele "sai driblando": ele nunca cobrou nada.

É o mesmo defeito de classe que a OS-77 resolveu para a falta comum — "cerimônia
reduzida virou cerimônia nenhuma" — e a máquina para consertar já existe:
`armTaker`, `_setPieceRole`, `settle`, e o guarda de afastamento `__os36Guard`
(`:24583`, `:24597`, `:25067`).

**Meça antes de patchar:** deslocamento entre o ponto de saída e onde a bola
reaparece; distância do cobrador à bola no reinício; e o salto por quadro
(`diag_os37_frame_jump`), porque hoje há teletransporte explícito.

---

## 3. A saída pela lateral não é visível — LOCALIZADO

> "Deveria ficar mais evidente no campo que a bola saiu pra fora nos laterais e
> no chute."

O chute foi tratado na R18.87. A lateral não. O mecanismo é o mesmo: em
`_ballOut` a bola simplesmente **para** e 0,65 s depois um jogador aparece com
ela na linha.

A camada `shotFx` da OS-84 já sabe continuar uma trajetória interrompida e
morrer quando o motor devolve a posse. Estendê-la para `_ballOut` é reaproveitar
código existente — **mas só depois do item 2**, porque a leitura correta é "a
bola saiu **e** alguém vai buscá-la para cobrar".

---

## 4. O time que fez a falta não recua — LOCALIZADO, não medido

> "O time quando fez uma falta e o adversário vai bater, seria interessante
> recuar."

A máquina existe: `__os36Guard` (`:24583`, `:24597`, `:25067`) e a marca
`_os36Wall` (`:24558`, `:24612`). A OS-77 mediu o afastamento **na falta atrás**
e publicou p10 do adversário em 3,168 m — mas isso é o ramo de reinício rápido,
não a cobrança com barreira.

**Não sei** qual é a distância do adversário numa cobrança normal, nem se o
recuo é visível. Meça primeiro: distância do adversário mais próximo à bola no
instante da cobrança, por tipo de falta.

---

## 5. Passe para trás com espaço à frente, e falta de faro de gol — LOCALIZADO

> "O jogador dá uns passes pra trás quando tem espaço pra correr pra frente...
> já vi o Neymar driblar, infiltrar na ponta e tocar pra trás em vez de chutar,
> e não é só ele."

Duas âncoras, e são diferentes.

**a) A penalidade de passe para trás**, `:5672`:

```js
const backPen = progressM < -4 ? (1.1 * (1 - Math.min(0.9, circ))) : 0;
```

Só pune passe que recua **mais de 4 m**, e a punição encolhe até 0,11 quando o
humor de circulação (`circ`) está alto. Entra no escore em `:5752` como
`- backPen * (2 - mood.risk)`.

**b) O portão do chute**, `:5292`–`:5295`:

```js
const minimum   = oneOnOne?.05:dtg<10?.045:dtg<16?.052:dtg<21?.062:dtg<25?.082:.105;
const choiceRatio = oneOnOne?.22:longshot?.82:.38;
let take = longPermission && shotUtility>=minimum && shotUtility>=passUtility*choiceRatio;
```

O chute só acontece se valer **38%** da melhor opção de passe (22% no
mano a mano). Quem driblou e infiltrou costuma ter um passe de alta utilidade
disponível — e o portão manda passar.

**Armadilha registrada, e é séria:** `choiceRatio` e `backPen` mudam a
**ecologia inteira**, não só o lance que incomodou. Subir o faro de gol sobe
chutes e xG, e `ECO-02` reprova em xG > 2,7. Antes de tocar em qualquer um dos
dois, meça a população: em quantas ações o jogador está no terço final, sem
pressão, com ângulo, e escolhe passe para trás? Se forem poucas, o defeito é de
**percepção** (o lance é raro mas memorável) e mexer no portão vai estragar o
jogo inteiro para consertar uma cena.

---

## 6. O que continua aberto dos MDs anteriores, sem novidade

| item | medido | referência real |
|---|---|---|
| domínio da bola | 0,37 s (mediana) | 1,1–1,4 s |
| bola no ar | ~55% | ~28% |
| passes por segundo de ação | 0,67 | ~0,27 |
| distância por jogador | 18,8 km | ~10,5 km |

Sobre esses, uma correção ao registro anterior. O relatório OS-65/66 explica a
falsificação da OS-68 dizendo que "`decideT` corre livre durante o voo e chega
vencido". A leitura tem uma consequência que ninguém tirou:

```js
:6798   this.decideT = Math.min(this.decideT, .10);   // dentro de _giveBall
```

Isto é um **teto** aplicado a um contador que já está **negativo** quando a bola
chega. `Math.min(-0,8 , 0,10)` = `-0,8`. O teto **nunca é aplicado**.
Multiplicá-lo por 2,6 dá `Math.min(-0,8 , 0,26)` = `-0,8` — idêntico. A OS-68
mexeu no **valor** de uma expressão cujo **operador** já a tornava inerte; ela
não testou a hipótese que queria testar.

A hipótese ainda não testada é trocar o **operador**, não o valor: fazer a
recepção **atribuir** o intervalo em vez de tomar o mínimo com ele. O
instrumento `diag_os85_decidet.js` está escrito e mede as três coisas que
decidem isso — valor de `decideT` na recepção, fração em que o `Math.min` chega
a mudar algo, e tempo real entre receber e soltar. **Não foi rodado.**
