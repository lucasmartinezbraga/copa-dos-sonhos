# OS-251 / OS-252 · O subsistema de corrida na área planeja 21 e completa 0,08

Nenhuma das duas correções entrou. As duas medições ficam porque o **achado**
é grande e não depende delas.

---

## Como cheguei aqui

A varredura estática (`tools/varredura-do-conceito.js`) achou, no motor:

```js
// 40-match-engine-and-manager-ai.js:3028
const ballDuty = p === presser || p === tm._cover || p === this.ball.owner ||
                 (this.ball.traveling && this.ball.receiver === p) ||
                 !!(p.__r1821BoxRun && p.__r1821BoxRun.ate > this.t);
if (!ballDuty) { /* aplica separação de 5,5 m dos companheiros */ }
```

`__r1821BoxRun` **não é escrito em lugar nenhum** — uma ocorrência no bundle
inteiro, e é esta leitura. A intenção é clara: quem faz corrida na área fica
isento da separação, para atacar primeiro pau ou segundo pau sem ser empurrado.
Quem faz a corrida é a camada 36 e ela marca `p._r18161BoxTarget` com prazo em
`until` — nome e campo diferentes, eras diferentes (R18.21 contra R18.161).

## OS-251 · A ponte funciona e não serve

Liguei o espelho. Medido em 6 partidas: **128 amostras com alvo vivo em 247.848
passos** — 0,05%, cerca de 21 quadros por partida para o time inteiro. Uma
isenção que quase nunca tem a quem se aplicar não move métrica nenhuma, e por
isso não vale o risco de uma mudança de motor. **Não entrou.**

Mas a razão de haver tão pouca amostra é o achado de verdade.

## O achado: 1,6% dos planos viram corrida

A própria camada mantém contadores. Medidos em **24 partidas**:

| | controle |
|---|---|
| `plans` | 510 · **21,25 por partida** |
| `assignments` / `runsEligible` | idem |
| `runsStarted` | 8 · **0,33 por partida** |
| `runsCompleted` | **2 em 24 partidas** |
| taxa de execução | **1,6%** |

Vinte e uma corridas planejadas por partida, uma a cada três partidas começa,
uma a cada doze partidas termina. A camada tem 110 linhas densas — funções por
papel (primeiro poste, segundo poste, intervalo entre zagueiros, cutback,
entrada atrasada, rebote), IQ por atributo, atraso de reação, congelamento de
alvo, verificação de impedimento — e o que chega ao gramado é decorativo.

## Por que não começa, medido por causa

Instrumentei o portão contando a causa de cada rejeição, 12 partidas:

```
longe da zona (teto 5,5 / 7,5)   70,4%
rebote longe (teto 3,5)           5,2%   mediana 4,9 m
rebote com IQ baixo (piso 88)     3,9%   mediana 56,3
esperando reação                  5,9%
PASSOU                           14,7%
```

E dentro disso havia um defeito nítido, do feitio da casa: **`a.distance` é
congelado quando o plano nasce e nunca atualiza.** O portão usava esse valor
parado para decidir se o jogador pode iniciar a corrida — ou seja, *para ter
permissão de correr até a zona, ele precisava já estar nela*.

## OS-252 · Corrigi isso, e não bastou

Passei a medir a distância onde o jogador está, com os mesmos tetos.
24 partidas por braço:

| | controle | OS-252 |
|---|---|---|
| planos | 510 | 527 |
| corridas iniciadas | 8 (1,6%) | 16 (3,0%) |
| **corridas completadas** | **2** | **2** |
| canceladas | 6 | 14 |

Dobrou o início — 8 contra 16 em 24 partidas é 1,6 σ, nem significativo — e
**não moveu o que importa**: as corridas a mais apenas passam a ser
canceladas. Pela regra desta base, mudança de motor que não entrega não entra.
**Revertida.**

## O que isto é, de verdade

Não é bug de uma linha: é **decisão de projeto pendente**. O plano vive no
máximo 0,90 s (`clamp(voo+0,18 · 0,45 · 0,90)`), gasta ~0,24 s em atraso de
reação, e é cancelado assim que sai a próxima entrega — e 21 dos 23 planos
nascem de chute (`plansShot`), ou seja, de rebote, que é o papel com os tetos
mais apertados (3,5 m e IQ ≥ 88, contra IQ mediano de 56).

Três caminhos, e a escolha é do dono porque muda o futebol, não só o código:

1. **Aceitar como está** e remover a leitura morta do motor, que hoje mente
   sobre uma isenção que não existe.
2. **Alargar a janela** (0,9 s é menos que o tempo de um cruzamento cruzar a
   área) e medir gol, escanteio e finalização na bateria.
3. **Trocar o critério**: escolher quem corre *pela chance de chegar* em vez de
   por IQ e distância congelada — hoje o seletor otimiza IQ e o portão exige
   proximidade, e os dois brigam.

Fica anotado com os números, que é o que faltava para a conversa existir.
