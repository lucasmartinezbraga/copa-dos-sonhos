# RODADA OS-94 a OS-98 · escanteios, e a alavanca do domínio

## 1. Escanteios — investigado e **sem patch**, de propósito

O pedido foi "ataque os escanteios". Ataquei, e a conclusão é que **não há
defeito de escanteio**. Registro o caminho porque ele derruba duas coisas que eu
mesmo tinha escrito.

### O que eu media, e o que estava errado

Primeiro censo (`diag_os94`): 27,75 desvios defensivos por partida e **zero**
terminando fora pela linha. Parecia o defeito.

**Era artefato do meu gancho.** Envolvi o `_deflectTo` externo, mas a camada
R18.18.3 resolve por `__r18183OldDeflect`, que passa por baixo dele. Refazendo no
gancho do núcleo (`diag_os97`):

| deflexões por partida | valor |
|---|---:|
| total | 8,333 |
| com defensor a ≤ 16 m da própria linha | 4,417 |
| **dessas, já vão para trás da linha** | **2,750 · 62%** |
| dessas, ficam em campo (a ~6,1 m da linha) | 1,667 |
| alvo atrás da linha, no total | **5,583** |

### O sistema está coerente

`_setCorner` é chamado 10,25×/partida e 5,833 contam. A diferença **não é
supressão**: a camada R18.18.3 converte bloqueio, espalmada e soco em
**trajetória física**, e o escanteio nasce depois em `_ballOut`. É o princípio do
HANDOFF §4 aplicado corretamente. Os contadores da própria camada:

| | por partida |
|---|---:|
| `cornersResolved` | 5,583 |
| `blockResolutions` → corner / vivo | 3,667 → 2,583 / 1,083 |
| `saveParriesResolved` → corner / vivo | 2,167 → 1,000 / 1,167 |
| `emergencyClearCorners` | 1,917 |
| **`unprovenSuppressed`** | **0,250** |

Os 5,583 resolvidos batem com os 5,583 desvios que vão para trás da linha, que
batem com os 5,833 escanteios contados. **Fecha.**

### A resposta real

| por partida | jogo | futebol real | proporção |
|---|---:|---:|---:|
| passes | 462,9 | ~900 | 51% |
| **escanteios** | **5,8** | **~10,5** | **55%** |
| faltas | 14,4 | ~22 | 65% |
| chutes | 20,7 | ~25 | 83% |
| gols | 2,43 | ~2,7 | 90% |

**Escanteio não está quebrado — está na mesma proporção que passe e falta.** O
jogo foi calibrado para acertar gols e chutes; todo o resto ficou em 50–65% do
real, porque `clockRate` comprime 90 minutos em ~692 s de ação. Mexer no
escanteio isoladamente seria consertar um sintoma, e o gate ECO-05 (4–10) foi
calibrado em volta dos ~5 do próprio jogo.

**Nenhum patch de escanteio entrou.**

---

## 2. OS-98 — a alavanca do domínio, encontrada

Este é o item que o HANDOFF chama de *"o problema aberto mais importante"* e
sobre o qual escreve *"ninguém achou a alavanca ainda"*.

### O mecanismo, medido

`diag_os85_decidet.js`, R18.92, 8 partidas, **4162 recepções**:

| grandeza | valor |
|---|---:|
| `decideT` no instante da recepção | mediana **−0,802 s** · p10 −1,533 · mín −12,8 |
| **já NEGATIVO ao receber** | **96,92%** |
| **fração em que o `Math.min` mudou algo** | **1,87%** |
| tempo entre receber e soltar | mediana 0,200 s |

```js
:6798   this.decideT = Math.min(this.decideT, .10);   // dentro de _giveBall
```

O contador corre livre durante o voo e chega vencido. `Math.min(−0,80 , 0,10)` é
−0,80: **o teto nunca é aplicado**.

### Isto invalida a falsificação da OS-68

A OS-68 está registrada como falsificada por multiplicar esse teto por 1,8 e 2,6
e medir domínio idêntico — 0,45 / 0,45 / 0,45. Era inevitável:
`Math.min(−0,80 , 0,26)` continua −0,80. **Ela mexeu no VALOR de uma expressão
cujo OPERADOR já a tornava inerte. A hipótese que ela queria testar nunca foi
testada.**

### A sonda: trocar o operador

`this.decideT = Math.min(this.decideT, .10)` → `this.decideT = <espera>`

| espera | receber→soltar (mediana) | média | fração em que muda algo |
|---|---:|---:|---:|
| base | 0,200 s | 0,266 | 1,87% |
| 0,10 | 0,200 s | 0,276 | 100% |
| **0,28** | **0,267 s** | 0,341 | 100% |
| **0,60** | **0,567 s** | 0,503 | 100% |

**Pela primeira vez o domínio responde ao parâmetro**, quase 1:1 acima de 0,28.
A alavanca existe, e estava atrás de um operador.

### O custo, uma base de 12 partidas

| | base | 0,28 | 0,60 |
|---|---:|---:|---:|
| domínio | 0,200 | **0,267** | **0,567** |
| xG | 2,064 | **2,004** (−2,9%) | 1,560 (−24%) |
| passes | 459,8 | **444,4** (−3,3%) | 397,1 (−14%) |
| chutes | 19,25 | 19,83 | 16,75 |
| gols | 2,417 | 1,750 | 1,250 |

Em **0,28** o domínio sobe 34% custando 2,9% de xG e 3,3% de passes. Em 0,60 o
custo é grande e real. E 0,28 não é número inventado: é o
`CAL.timing.decisionInterval` que sempre esteve na calibração e nunca vinculou.

### O que isto NÃO resolve

Domínio de 0,267 s continua muito longe dos 1,1–1,4 s de referência. Fechar a
diferença exigiria espera de ~1,2 s, e a varredura mostra que aí a ecologia
desaba. **A alavanca existe mas não fecha o buraco sozinha** — e a compensação
por `clockRate` já foi falsificada pela OS-67 (passes 451→758, gols 1,81→4,38).

### Bateria de seis bases — e o resultado inverteu o risco

| semente | gols | xG | chutes | escanteios | passes |
|---:|---:|---:|---:|---:|---:|
| 4200000 | 1,9583 | 2,0387 | 20,000 | 4,7500 | 443,6 |
| 8400000 | 2,1250 | 2,0540 | 18,542 | 4,2500 | 440,6 |
| 1260000 | 2,2917 | 2,2461 | 19,917 | 4,5000 | 447,2 |
| 2100000 | 2,3333 | 2,1311 | 19,958 | 4,7917 | 440,2 |
| 6300000 | 2,1667 | 2,1993 | 19,167 | 4,7500 | 444,6 |
| 3150000 | 2,2917 | 2,3250 | 20,833 | 5,2917 | 445,3 |
| **média** | **2,1945** | **2,1657** | 19,736 | **4,7222** | 443,6 |

**Gols abaixo de 1,8: 0 de 6. Escanteios abaixo de 4: 0 de 6. xG acima de 2,7:
0 de 6.** O 1,750 da base única de 12 partidas era ruído.

### Comparação

| | R18.86 | R18.92 | **R18.93** |
|---|---:|---:|---:|
| domínio | 0,200 s | 0,200 s | **0,267 s** |
| gols, pior base | **1,667** ✗ | 2,125 | **1,958** ✔ |
| xG, máximo | 2,323 | 2,425 | 2,325 ✔ |
| escanteios, pior base | 4,333 | **3,583** ✗ | **4,250** ✔ |
| escanteios, amplitude entre bases | 1,00 | 2,17 | **1,04** |
| passes | 463,6 | 462,3 | 443,6 |
| **bases reprovando algum gate** | 1 de 6 | 2 de 6 | **0 de 6** |

**É a única build do projeto que passa nos três gates nas seis bases**, e ela
**estabiliza os escanteios** — o custo que eu tinha declarado na R18.92
desaparece.

### Uma consequência que eu não previ e preciso registrar

Com `decideT` positivo na recepção, os **outros quatro tetos** passam a vincular
também: `:5076` (pressão, 0,20), `:17386-17388` (por fase, 0,20 / 0,31 / 0,44).
`Math.min(0,28 , 0,20)` sob pressão agora aplica de verdade. **A calibração
inteira de tempo de decisão ganha vida pela primeira vez** — o jogador
pressionado passa a decidir mais rápido, como sempre esteve escrito e nunca
aconteceu.

### Custo declarado

Passes 462,3 → 443,6 (−4,0%) e chutes 20,71 → 19,74 (−4,7%). O jogo já rodava a
51% do volume de passes do futebol; vai para 49%. Em troca, o domínio sai de 18%
da referência (1,1–1,4 s) para 24%.

### O que continua aberto

Domínio de 0,267 s ainda está longe de 1,1–1,4 s. A varredura mostra que
`espera = 0,60` leva a 0,567 s mas custa 24% de xG. **A alavanca existe e não
fecha o buraco sozinha.** Fechar exigiria compensação de volume, e a OS-67 já
falsificou o caminho por `clockRate`.

### Estado

**PROMOVIDA como R18.93**, sha256
`66dd49b4d698ed61f25633eea8bf0572af26ae7769e7c3590e031c0579cb3119`.
Cadeia reproduzida duas vezes byte a byte. Navegador: 3 cobranças diretas com
câmera lenta e passada (3/3), 3 finalizações para fora com zero cruzando entre
as traves, zero erros de página.
