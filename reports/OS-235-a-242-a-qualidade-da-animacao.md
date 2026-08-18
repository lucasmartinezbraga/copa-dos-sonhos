# OS-235 a 242 · A qualidade da animação

**Relato do dono, em várias mensagens seguidas:**

> "a curva da bola na hora do lançamento tá estranha" · "a animação da bola
> ainda não me agrada" · "quando rola uma falta a animação não me agrada nada" ·
> "a pingada da bola não me agrada" · "o pulo do jogador tá estranho também" ·
> "são várias animações" · **"o problema principal é a qualidade das animações"**

E depois, autorizando o escopo:

> "se você achar melhor mude os bonecos, layout, reconstrua a parte gráfica"

---

## O achado que organiza tudo

Não eram várias animações ruins. Eram **oito causas**, e nenhuma estava na
máquina de estados — que tem 64 estados, envelopes por fase e fiação de evento,
tudo funcionando. O problema estava inteiro no **desenho**.

Tudo aqui é apresentação: o bloco `cds-ux-boot` é pulado pela bateria, então
nenhuma métrica de design pode se mexer. Foi medido na tela, não no placar.

---

## OS-235 · A pose era um corte seco

O desenho lia `POSE[st]` **direto**, no estado do quadro. Quando o estado
mudava, os seis parâmetros da silhueta trocavam de valor no mesmo quadro — e
como `bob` carrega `- r * P.agacha`, o boneco **afundava e subia num quadro só**.

Toda troca de gesto era um corte. Não existe pose boa o bastante para
sobreviver a isso — e é por isso que a queixa era "várias animações".

Agora a silhueta desenhada persegue a do estado por smoothstep em 0,11 s de
relógio de parede. A onda só é misturada quando há degrau real (`fouled` termina
em 0,70 e `get_up` começa em 1,0; gesto que cai em estado sem envelope apagava
de uma vez).

| medido alternando `CDS_MIX_T` 4× na mesma partida | antes | depois |
|---|---|---|
| salto médio de silhueta | 0,138 | **0,084** (−39%) |
| pior salto num quadro | 2,98 | **1,35** (−55%) |

## OS-236 · A curva do lançamento era uma cúpula

A física estava certa: apice 6,97 m em 34,8 m de alcance — confere com a conta
à mão para 40° de saída. O erro era a conversão **altura → pixel**: fiel só até
2,6 m, e a derivada no ápice caía para **0,19**. A parábola achatava justamente
onde o lançamento vive.

Faixa fiel vai a 9,0 m; o teto de `air` (tamanho da bola e encolhimento da
sombra) vai de 3,2 para 8,0 m. Não há risco de invadir a arquibancada porque a
altura desenhada já escala com a profundidade.

## OS-237 · Membros sem articulação

Cada perna e cada braço era um `fillRect` **alinhado aos eixos**. Retângulo
alinhado não gira — só translada. Nenhum envelope faz um bloco que não gira
parecer perna.

Agora: `quadril → joelho → pé` e `ombro → cotovelo → mão`, com a dobra do joelho
crescendo na perna que vai para trás (calcanhar subindo) e a do cotovelo na que
vem à frente. Vale para locomoção, chute, carrinho, bloqueio e cabeceio.

## OS-238 · Proporção

A perna era **30%** da altura do boneco; num corpo humano é ~48%. O pedaço que
se move era pequeno demais na silhueta, então a passada não lia. Torso mais
curto e estreito, perna mais longa, mesma altura total — e tudo numa tabela só,
em unidades de `r`.

## OS-239 · A bola não caía: sumia

O quique estava **certo** (a bola cai de 5,97 m, toca a 0,09 e sobe a 1,755 m —
exatamente restituição 0,55 sobre −10,5 m/s). O defeito era outro:

```
212 saltos de altura por partida além do que a gravidade permite
 31 de 157 registrados passam de 0,5 m
 e o padrão é sempre o mesmo: 0,7 a 2,6 m  ->  ZERO, num quadro
 causas: ganhou dono · terminou a viagem · perdeu dono
```

São recolocações administrativas, e fazem sentido para o motor. O que não pode é
vazar para a tela. Agora a altura desenhada **persegue** a física com teto de
velocidade de queda — teto que sai de uma média móvel da própria queda observada,
para que um chute descendo a 25 m/s continue a 25.

| medido alternando `CDS_ZSUAVE` 4× na mesma partida | antes | depois |
|---|---|---|
| saltos desenhados > 0,35 m | 194 | **11** (−94%) |
| pior salto num quadro | 1,58 m | **0,52 m** |

## OS-240 · O cabeceio não tinha pulo

Estava estranho porque **não existia**. O estado `header` mexia em três coisas —
braços ao alto, cabeça à frente e cabeça subindo 0,10 r — e em nenhuma delas o
corpo saía do chão. As pernas seguiam no ciclo de corrida, porque `heading`
nunca entrou na cadeia de pernas.

Agora o corpo sobe 0,62 r com o pico no mesmo quadro em que a onda vale 1 — o
quadro em que a bola sai —, as pernas recolhem, e o goleiro que sai para encaixar
cruzamento sobe junto.

## OS-241 · Quem sofre falta cai

`fouled` era `agacha 0,30` e `inc -0,34`: quatro pixels de agachamento e 19° de
tronco. Isso é **cambalear**. O gesto principal da falta — o único que se olha
no instante em que o juiz apita — praticamente não existia.

Agora o corpo gira até perto da horizontal e desce ao gramado, com as pernas
dobradas em vez do ciclo de corrida, e `get_up` desfaz o mesmo caminho.

## OS-242 · Cada atleta tem o porte dele

Os 22 eram desenhados com **exatamente o mesmo corpo**. O dado para corrigir já
existia e já era calculado: `ref.profileV3.heightCmSim`. Medido em campo, os 22
vão de **167 a 194 cm** — 15% de diferença entre o mais baixo e o mais alto, e
nada disso chegava ao desenho.

O ponto de apoio não muda: crescer `r` sem compensar enterraria o jogador alto
no gramado, então a origem sobe pela mesma diferença.

---

## Erros de medição desta rodada — três, e todos convincentes

1. **A pingada que não existia.** Meu detector de quique usava `z <= 0,02`, e a
   bola nunca desce disso (o mínimo é 0,05, o raio). E a "altura do quique" lia a
   amostra *anterior* ao solo, que depende de onde o passo caiu na descida. Saiu
   "todo quique tem 0,200 m", que é o passo de amostragem, não a física. Quase
   fui consertar uma restituição que estava certa.

2. **As 22 placas de nome.** A primeira versão do `print-de-jogo` congelava o
   jogo com `G.speed = 0` para capturar o mesmo quadro. A placa de nome é
   condicional a `speed <= 0,61 || perto da bola` — congelar **acende as 22**.
   A imagem mostrava uma poluição visual que só existia na sonda.

3. **Armadilha nº 8 do briefing, ao vivo.** A primeira versão do bloco da queda
   lia `dphase` antes da declaração. `verify.py` passou e `browser_smoke`
   passaria: nenhum dos dois chama `paintField`. Quem pegou o TDZ foi a sonda de
   desenho. **Código de desenho só se valida desenhando.**

---

## Ferramentas novas

Todas produzem o antes e o depois a partir do **mesmo build**, alternando um
interruptor em tempo de execução — sem variância de build entre as medições.

| ferramenta | o que faz |
|---|---|
| `solavanco-da-pose.js` | mede o salto de silhueta entre quadros |
| `salto-da-bola.js` | descontinuidade de altura da bola, física e desenhada |
| `voo-da-bola.js` | ápice, alcance, tempo e ângulo por tipo de lance |
| `folha-de-poses.js` | os 51 estados numa imagem, e quais quase não mudam |
| `comparar-boneco.js` | a mesma passada nos dois desenhos |
| `comparar-pose.js` | o mesmo roteiro de estados, com e sem mistura |
| `comparar-arco.js` | a mesma parábola nos dois mapeamentos de altura |
| `print-de-jogo.js` | quadros consecutivos da mesma partida |
| `gif-de-jogo.js` | GIF disparado pelo lance, mais folha de contato |
| `gif-encoder.js` | GIF89a com LZW, em JS — não há ffmpeg neste ambiente |

Imagens em `reports/imagens/`.

---

## O que ficou de fora, e por quê

* **Câmera mais fechada.** O atleta tem 13 px de raio: é o maior limitador de
  percepção que resta, e nenhuma quantidade de detalhe vence isso. Mas fechar a
  câmera troca visão de jogo por tamanho de boneco, e essa é uma decisão de
  gosto do dono, não minha.
* **Tom de pele por atleta.** Os jogadores são pessoas reais e nomeadas. Variar
  tom de pele por sorteio a partir do id representaria pessoas de verdade de
  forma inventada. Altura tem dado; tom de pele não tem.
* **`pass_prepare` e `shot_prepare`** aparecem na folha com variação de 0,26%
  entre as fases. São estados de preparação curta e podem estar corretos assim,
  mas ficam anotados como próximos candidatos.
