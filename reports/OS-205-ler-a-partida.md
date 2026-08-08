# OS-205 · Ler a partida em vez de contá-la

## Por que este instrumento existia que faltar

A bola quicando em todo passe rasteiro — 54 saltos por minuto, o defeito mais
visível que este jogo teve nesta fase — **não moveu nenhuma das 34 métricas.**
Nem as 13 de design, nem as 21 do futebol real. Quem viu foi uma pessoa abrindo
o jogo e dizendo que estava horrível.

Isso é uma condenação do aparato inteiro de medição, não um azar. Contar gols,
chutes, faltas e escanteios não diz se aquilo **parece futebol**.

`tools/fisica/narrar.js` transforma uma partida em texto de futebol — quem,
onde no campo, sob que pressão, em que minuto — para dar para **ler**. Não há
alvo a bater. A saída é material bruto para alguém dizer "isso aí não é
futebol".

```bash
node tools/fisica/narrar.js dist/index.html --partidas=4
node tools/fisica/narrar.js dist/index.html --so=suspeitos
```

## Duas acusações que eu ia fazer e eram do meu instrumento

Registro porque é o ponto da ferramenta: ela também erra, e erra parecendo
certa.

**"Pinball: 212 por partida."** Durante o voo de um passe, `ball.owner` fica
`null`. Contar toda mudança de `owner` transforma um passe normal em duas
trocas de posse. Corrigido para contar só mudança de **pé**: caiu para **2,3**.

**"Expulso continua jogando: 43 lances por partida."** Os eventos `red` e
`yellow` não carregam `by`, então o ator caía no `ball.owner` — outro jogador.
Lendo `p.red` direto do estado do motor: **nenhum caso**. O jogo está certo e
minha sonda estava mentindo.

Um instrumento novo mente antes de acertar. As duas correções estão comentadas
no arquivo para o próximo não repetir.

## O achado: ninguém fica com a bola

```
POSSE INDIVIDUAL: 693 posses na partida
  mediana 0,43 s   p90 0,70 s   MAXIMA DA PARTIDA INTEIRA 4,4 s
  73% das posses duram menos de meio segundo

futebol real: ~1,1 s de media com a bola no pe
```

Metade do tempo de posse do futebol real, e um teto de **4,4 segundos na
partida inteira**. No futebol de verdade um zagueiro sai jogando com a bola por
6 segundos, um ponta isola o lateral por 8, um goleiro segura por 10.

Aqui isso nunca acontece. A bola é batata quente.

### O mecanismo, e ele está numa linha só

`20-core.js:574` — `decisionInterval: 0.28`.

O portador é perguntado *"o que você faz?"* **3,5 vezes por segundo**, e passar
é opção em todas. A camada R13 aperta ainda mais, para 0,20 s em transição.

Mas a curva de sobrevivência mostra que não é só rápido — é **bimodal**:

```
ja com a bola ha 0,00s  ->  segue com ela em 98%   (693 casos)
ja com a bola ha 0,28s  ->  segue com ela em 26%   (679 casos)   <- o precipicio
ja com a bola ha 0,56s  ->  segue com ela em 32%   (178 casos)
ja com a bola ha 0,84s  ->  segue com ela em 67%    (57 casos)
ja com a bola ha 1,12s  ->  segue com ela em 87%    (38 casos)
ja com a bola ha 1,68s  ->  segue com ela em 82%    (28 casos)
```

**74% das posses morrem na primeira decisão.** Quem sobrevive a ela entra num
"carregar" e aí fica com a bola 82–87% a cada intervalo.

Ou seja, o motor tem dois estados e nada entre eles:

- **soltar imediato** (74%) — recebe e devolve, sem olhar;
- **arrancada longa** (poucos) — e aí não larga mais.

O futebol real vive justamente no meio que não existe aqui: recebe, dá um
toque, levanta a cabeça, espera o apoio, então passa. Um segundo e meio de
posse com intenção. **Esse regime não está implementado.**

Isso também explica o segundo achado da narração: **drible parado, 6,8 por
partida** — o mesmo jogador driblando três, quatro vezes no mesmo pedaço de
campo. Quando o portador entra em "carregar", ele carrega sem destino, porque
não existe a intenção que daria destino a ele.

### Por que nenhuma métrica viu

Porque todas as agregadas saem certas. Passes por partida, posse por time,
acerto de passe, gols — nada disso muda se a bola troca de pé a cada 0,43 s ou
a cada 1,1 s. O que muda é **como a partida se lê**, e não havia instrumento
para isso.

## O que mais a leitura marcou

| | por partida | |
|---|---|---|
| Posse relâmpago (< 0,8 s) | 650 | o achado acima |
| Drible parado (3+ no mesmo lugar) | 6,8 | consequência do "carregar" sem destino |
| Impedimento repetido do mesmo time | 4,0 | bate com impedimentos 2× o real (OS-204) |
| Pinball (6 pés em 5 s) | 2,3 | aceitável |
| Chute sem ângulo | 0,3 | raro |

## O que isto muda no plano

O problema não é calibração e não é física. É que **o modelo não tem intenção
que dure**. Uma decisão é tomada, executada em 0,28 s, e reavaliada do zero.
Futebol é feito de intenções de 2 a 5 segundos — sair jogando, atrair a marcação,
segurar até o apoio chegar, conduzir para abrir a linha de passe.

Não dá para consertar mexendo no `decisionInterval`: subir 0,28 para 0,60 dá
batata quente mais lenta, não futebol. O que falta é um nível acima —
**plano do portador**, que sobrevive a vários quadros e só é reavaliado quando
alguma condição muda (chegou marcação, abriu linha, acabou o espaço).

Isso é a especificação do motor novo começando a se escrever sozinha, e ela
está vindo de leitura, não de planilha.
