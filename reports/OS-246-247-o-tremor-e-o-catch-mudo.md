# OS-246 / OS-247 · O tremor do gesto, e o `catch` que escondeu tudo

**Relato do dono:**

> "caça tudo que quebra a fluidez"
>
> e depois, sobre as ferramentas:
>
> **"Você ainda não tem um mecanismo bom o suficiente para avaliar se o lance é
> futebol de verdade ou não"**

Ele está certo. Esta rodada prova, com um caso concreto, o quanto.

---

## OS-247 · O erro que atravessou todas as validações

Por uma rodada inteira a **máquina de estados de animação esteve desligada**.
Não degradada: desligada. Um `ReferenceError: root is not defined` era lançado a
cada quadro dentro de `Controller.update` — código meu, da primeira versão da
OS-246, que leu `root` dentro da fábrica do módulo, onde `root` não existe
(a fábrica também roda em Node, via `module.exports`).

O erro subia até este `catch`, na ponte de amostragem:

```js
      } catch (_) { }
```

E ali morria. Consequência em cadeia:

```
Controller.update estoura
   -> Machine.update estoura
      -> this.__animState nunca e escrito
         -> __CDS_ANIM_BY_KEY nunca e publicado
            -> os 22 atletas sao desenhados sem estado nenhum
```

O que **passou** com o motor de animação morto:

| validação | resultado |
|---|---|
| `python3 tools/verify.py` | passou |
| `node tests/browser_smoke.js` | passou |
| `tools/fisica/bateria.js` + `placar.py` | inalterado (o bloco é pulado) |
| `tools/fisica/tela/fluidez.js` | **relatou números** — e eu quase concluí deles |
| console do navegador | limpo |

A varredura de fluidez chegou a medir "75 trocas de gesto" contra as 48417 da
passada anterior — uma diferença de 800×. Foi essa contradição, e só ela, que
me obrigou a olhar. Se o número tivesse caído 30% em vez de 600×, eu teria
comemorado uma melhora que era uma pane.

**Correções, as duas permanentes:**

1. O `catch` deixou de ser mudo. Continua sem derrubar o motor — apresentação
   não pode quebrar partida — mas registra o primeiro erro e a contagem em
   `__CDS_ANIM_ERRO`, e o Árbitro (abaixo) reprova a build se ele existir.
2. A fábrica ganhou `GLOBAL` e `ajuste(nome, padrao)`, o jeito certo de ler
   interruptor de tempo de execução de dentro de um módulo que também roda fora
   do navegador.

**A lição, e é a resposta ao dono:** *zero observação não é zero defeito.*
Toda sonda que reporta "nenhum problema" precisa primeiro provar que estava
olhando. Nenhuma das minhas fazia isso.

---

## O ÁRBITRO — a sonda que faltava

`tools/fisica/tela/arbitro.js`. Não mede média nem suavidade: **confronta
camadas que precisam concordar** e trata desacordo como defeito com exemplo
nomeado. Emite veredito APROVADO/REPROVADO com os limites escritos no código.

| seção | pergunta |
|---|---|
| 0. A sonda enxerga | quantos dos 22 desenhos têm estado publicado? |
| 1. O gesto e o corpo | `run` com o atleta parado? `idle` a 3 m/s? |
| 2. O evento e o gesto | todo passe/chute/desarme/falta/defesa do motor vira gesto no autor em 0,35 s? |
| 3. A bola tem dono | posse que troca a distância, bola órfã, aceleração sem ninguém perto, bola fora com jogo vivo |
| 4. Os corpos ocupam espaço | dois atletas no mesmo ponto |
| 5. A fase anda | estado que dura com fase parada é quadro congelado com nome de animação |

A seção 0 existe por causa da OS-247: **"sem amostra" é reprovação, não
aprovação.**

### A primeira rodada do Árbitro reprovou 4 itens — e 3 eram a sonda errando

Isto fica escrito porque cada um dos três produziu um número convincente e
falso, e porque é exatamente o erro que o dono está apontando: instrumento ruim
não é o que não acha nada, é o que acha coisa que não existe.

1. **"bola fora do campo em 66% dos quadros, pior 29,1 s".** Eu testei
   `|x| > FL/2`. O campo deste jogo é **0..105 × 0..68**, não centrado na
   origem: eu estava acusando a metade direita do gramado. O teste certo é o do
   próprio motor, `b.x < -0,5 || b.x > FL+0,5 || …`.

2. **"só 0,7% dos gestos têm fase avançando".** Estado **cíclico** tem
   `dur = 0`, e `snapshot()` devolve `phase = 0` sempre — por construção. O
   ciclo da perna dele vem da onda do desenhista, não da fase. Eu tinha medido
   a definição de estado cíclico e chamado de quadro congelado. A checagem só
   vale para gesto com duração.

3. **"só 17,4% dos passes viram gesto de passe".** A sequência
   `pass_prepare → pass_contact → …` é pedida **antes** de a bola sair, e
   `_emit('pass')` acontece **na saída**. Olhando só para frente a partir do
   evento, o passador já tinha voltado a correr. A janela tem de ser simétrica
   em torno do evento — e ainda precisa do histórico de estado por atleta para
   poder olhar para trás.

E um quarto que era meio e meio: **"walk a 18,93 m/s"**. Ninguém anda a 18,9
m/s — aquilo era recolocação administrativa do motor, não animação mentindo.
São dois defeitos diferentes e agora são duas linhas diferentes; misturados,
o número de um escondia o do outro. E o gesto que persiste "errado" por menos
de 0,30 s não conta: os 150 ms de permanência da OS-246 são de propósito.

### O quinto erro, e o mais instrutivo: `_emit('pass')` é chegada, não saída

Corrigidos os três, o passe ainda reprovava: 45,3%. Fui olhar a **fita de
estados** em volta do evento em vez do estado no instante dele:

```
-1.30:pass_prepare  -1.13:pass_contact  -1.05:pass_followthrough
-0.92:pass_recover  -0.77:strafe  -0.67:accelerate  -0.37:sprint
 0.00:<evento 'pass'>
```

O gesto de passe estava lá, completo e na ordem certa — **1,3 s antes**. Aquilo
é o tempo de voo da bola: `this._emit('pass', …)` está dentro do `onArrive` de
`_startTravel`, ou seja, dispara quando a bola **chega ao companheiro**. A saída
do pé é o próprio `_startTravel`.

Ancorado na saída: **137 de 137, 100%.**

Placar honesto desta sonda: **cinco reprovações na primeira rodada, cinco eram
a sonda.** O jogo estava certo nas cinco. Um instrumento ruim não é o que deixa
de achar defeito — é o que acha defeito que não existe, e o custo dele é uma
rodada de conserto no lugar errado.

### E a sonda prova que pega o defeito

Uma sonda que nunca foi vista reprovar não está provada. `--autoteste` desliga
de propósito a publicação de estado — exatamente o efeito do `ReferenceError`
da OS-247 — e exige que o Árbitro reprove:

```
VEREDITO: REPROVADO — 8 item(ns)
   · atletas desenhados com estado publicado: 0.0% (minimo 95%)
   · SEM AMOSTRA: chute (a sonda nao viu nada -- isso nao e aprovacao)
   ...
AUTOTESTE OK: o Arbitro reprovou a pane que a OS-247 escondeu por uma rodada inteira.
```

O autoteste é uma etapa da Mesa: **o portão se prova antes de julgar.**

### Veredito do Árbitro no build final

```
0. A SONDA ENXERGA         estado publicado em 100,0% dos desenhos, 22 atletas
1. O GESTO E O CORPO       teleporte 100,0% · gesto coerente 100,0%
2. O EVENTO E O GESTO      passe 137/137 · chute 12/12 · desarme 31/31
                           falta 3/3 · defesa 6/6
3. A BOLA TEM DONO         posse 163/163 · sem órfã · sem fantasma · dentro do campo
4. OS CORPOS               sem sobreposição em 23939 quadros
5. A FASE ANDA             23/23
VEREDITO: APROVADO em todos os itens observados.
```

---

## A MESA — porque sonda que não roda vale zero

O Árbitro sozinho não teria salvado a rodada: `gesto-perdido.js` **já existia** e
teria acusado o erro no primeiro minuto. Ele simplesmente não foi rodado naquele
dia. Ferramenta que depende de eu lembrar dela não é validação, é sorte.

`python3 tools/mesa.py` roda o ritual inteiro num comando e dá **um** veredito:

```
build → verify → smoke → sanidade → árbitro → validação de lance
```

E as três sondas de tela ganharam **código de saída de verdade**. Antes todas
saíam 0, sempre, achando defeito ou não — o que as tornava inúteis como portão.

### E a primeira coisa que a Mesa reprovou foi a própria Mesa

Primeira execução completa: passou em build, verify, smoke, autoteste, sanidade
e Árbitro, e **reprovou em `lances`**:

```
· F3 batedor NA bola na cobranca (<=1,5 m)  88.9%
· F4 barreira a 9,15 m                      50.0%
· E2 batedor nao salta na cobranca          75.0%
```

`F4 50,0%` é **uma barreira de duas**. Falta, barreira e escanteio são raros:
numa janela de 120 s a sonda vê duas ou três de cada, e limiar de 90% sobre
denominador 2 não mede nada — mede ruído com cara de gravidade.

Portão que reprova por ruído é pior que portão nenhum, porque ensina a ignorar
reprovação. Duas correções:

* **piso de amostra (8).** Abaixo disso o invariante fica `ins` (inconclusivo)
  e não reprova sozinho. Mas — regra da OS-247 — **inconclusivo não é
  aprovação**: se metade ou mais do painel ficar sem amostra, a sonda reprova
  pedindo janela maior, em vez de fingir que olhou.
* a etapa de lances roda com **o dobro do tempo das outras, mínimo 300 s**,
  porque é a que depende de evento raro.

## OS-246 · O tremor do gesto

Com a máquina viva de novo, a medida honesta, em janelas pareadas de 15 s
alternando o interruptor dentro da **mesma partida** (lição da OS-244: comparar
duas execuções é comparar ruído):

```
trocas de gesto           9,03 por atleta por segundo
duracao mediana do gesto    83 ms
gestos com menos de 0,12 s  87% de todas as trocas
```

83 ms de mediana contra os **110 ms** que a mistura de pose da OS-235 leva para
completar. Ou seja: na maioria das vezes **a silhueta nunca chegava à pose**
antes de o estado já ser outro. A OS-235 estava sendo anulada na origem.

### As duas causas

**1. Todo seletor de piso decide por limiar puro sobre grandeza contínua.**
`v < 2,4` no jockey, `v < 0,25` no idle, `dot < -0,55` no backpedal, a tabela
`LOCO` inteira. Quem corre com a velocidade encostada em 3,6 m/s alterna
jog/run a cada quadro — e correr com velocidade oscilando é o normal.

`locoFor(speed, prev)` **declarava** o parâmetro da histerese e nunca o lia; o
único chamador nem o passava. A intenção estava escrita nas duas pontas e não
acontecia em nenhuma — o mesmo padrão pela **nona** vez nesta base.

**2. O ramo de transição escapava de qualquer permanência.**
`transicaoFor` decide por `dSpeed` e `giro`, as duas grandezas mais ruidosas do
contexto, e **devolve cedo**. A primeira versão da OS-246 impôs permanência
mínima só no ramo cíclico lá embaixo: derrubou o tremor em 17% e não moveu a
mediana (83 → 84 ms). O remédio estava no lugar errado.

### O que foi feito

* banda morta assimétrica em `LOCO` (sair da faixa exige ultrapassar o limiar
  por 0,45 m/s; entrar não exige nada), em `posturaFor` e em `transicaoFor`;
* permanência mínima de 150 ms cobrando **os dois** caminhos de piso, no
  relógio de parede — porque é o olho que julga tremor, e a mistura da OS-235
  também roda em parede. `now` chega ao controlador em segundos de *simulação*:
  a 3X, 0,25 s de simulação são 83 ms de tela. A unidade importa e já me custou
  uma medição.
* gesto de **ação** não passa por nada disso: continua entrando no quadro
  exato, que é o que faz o pé bater na bola na hora. O A/B verifica isso como
  guarda explícita.

Interruptores para medir cada metade separada: `CDS_DWELL` e `CDS_HISTERESE`.

### O que a permanência entregou, medido em janelas pareadas

Com a histerese ligada nos dois lados, alternando só `CDS_DWELL` — 8 ciclos de
15 s, 120 s por balde, mesma partida:

| | `CDS_DWELL = 0` | `CDS_DWELL = 150` |
|---|---|---|
| trocas por atleta por segundo | 7,73 | **6,25** (−19%) |
| gestos com menos de 0,12 s | 85,8% | **66,7%** |
| duração mediana do gesto | 84 ms | **99 ms** |
| *guarda:* gestos de ação por segundo | 4,77 | 5,23 (preservado) |

A guarda é o número que importa tanto quanto o ganho: se a permanência
reduzisse o tremor **engolindo** chute, desarme e cabeceio, a métrica melhoraria
e o jogo pioraria. Não engoliu — gesto de ação não passa pelo portão.

A mediana ainda não chega aos 150 ms do piso porque **gesto de ação não é
governado por ele**: quando uma sequência de passe ou chute termina, o corpo
volta ao piso na hora, e essa volta entra na conta. Os 33% de gestos curtos que
sobraram são, na maior parte, esses retornos — que são o comportamento certo.
