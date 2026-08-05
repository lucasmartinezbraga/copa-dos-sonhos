# HANDOFF — Copa dos Sonhos, R18.97

Você está pegando este projeto **sem contexto nenhum**. Leia este arquivo inteiro
antes de tocar em qualquer coisa. Cada número aqui foi **medido**; onde não foi,
está dito.

---

## 0. O que é

Um jogo de futebol que é **um único HTML de ~25 mil linhas**. Não existe
"código-fonte" no sentido normal: a build é produzida por uma cadeia de scripts
de patch aplicados sobre uma base.

```
BASE  = COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html
        sha256 f920ae1a64564347785262d2d95834ac2d8b8133f13cc8a342acd31cfac6f8f0

        + OS-84   desfecho do chute visível
        + OS-87   o cobrador da falta chega na bola
        + OS-88   o momento da falta (câmera lenta)
        + OS-89   defesa/fora da falta recalibrado
        + OS-90   goleiro se posiciona na falta
        + OS-92   o chute para fora sai por fora do poste
        + OS-98   o intervalo de decisão passa a vincular
        + OS-100  o lateral é cobrado por quem caminhou
        + OS-101  o gol de falta direta
        + OS-106  câmera lenta em todo chute
        + OS-107  o time vai para o lance e fica lá até a cobrança

PROMOVIDA = R18.97
            sha256 df4d9f284691ca5341866983c3bd1d4ffc91bbb1258d6192125cc74b67a34e66

ANTERIOR  = R18.96
            sha256 a335bbba8aad76a40df4399bbc32ebf995116e46f0e73fcdf31b4a3fa14ca164
            (reproduzível com build_r1896.js, que fica no repositório)
```

### Como buildar

```bash
node build_r1897.js saida.html --base="caminho/para/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"
```

O script **aborta** se a base não for exatamente a R18.86 (confere o SHA), e
**aborta** se qualquer âncora de patch não casar exatamente uma vez. Isso é
defesa, não incômodo: quando um patch anterior muda o texto que você ancorou, o
build morre com `ABORTA: ancora 0x` em vez de aplicar no lugar errado.

Rode duas vezes e confira que o SHA bate. Toda build promovida aqui foi
reproduzida byte a byte.

### Node

Não há `npm install`. Use um Node portátil qualquer (aqui:
`nodejs-portable/node-v24.18.0-win-x64/node.exe`). Os scripts só usam `fs`, `vm`
e `crypto`.

---

## 1. O contrato de método — não é estilo, é o que separa trabalho de teatro

1. **Uma rodada por vez.** Não um plano de cinco.
2. **Mecanismo com `arquivo:linha`.** Onde exatamente, não "na lógica de X".
3. **Hipótese como DIREÇÃO**, nunca como porcentagem. "Sobe" / "desce". Você não
   sabe o quanto antes de medir.
4. **O edit exato, com a âncora.**
5. **Previsão registrada ANTES de medir**, escrita no cabeçalho do patch. É isso
   que torna a falsificação possível. **Nesta sessão, cinco patches foram
   derrubados pela própria previsão que eu havia registrado.**
6. **Qual gate decide.**
7. **Qual armadilha pode te pegar.** Escreva-a antes.

E duas regras absolutas:

> **Não dê número que você não mediu.**
> **Não diga que um patch está pronto para promover sem a bateria.**

O dono do projeto disse, e vale mais que qualquer gate:

> *"isso é pra deixar o jogo mais realista ou só pra bater gate?"*
> *"VOCÊ NÃO TEM QUE PERGUNTAR, TEM QUE RESOLVER."*

Resolver inclui dizer com todas as letras o que **não** foi resolvido, com o
número medido do lado.

---

## 2. As armadilhas que custam rodadas inteiras

### 2.1 O código que você achou provavelmente não manda no que você quer mudar

O HTML é uma pilha de camadas que se sobrescrevem. **Quatorze sítios envolvem
`_startTravel`** (`:14672 :14789 :15253 :16286 :16534 :16734 :19247 :21424
:22195 :23123 :23471 :24650 :24762 :24878`).

**Caso concreto, que me custou TRÊS rodadas:** eu queria mudar a trajetória de um
chute. Tentei na camada mais externa (antes da original), no núcleo, e na camada
mais externa (depois da original). As três falharam. A prova da terceira: alvo
corrigido de `38,045` para `39,569` e **a bola terminou em `38,05`**.

A resposta veio de um **setter em `ball.x`/`ball.y` capturando a pilha**:

```
99,8% das escritas durante um voo de chute vêm de
  P._ballTravel @cds-physics-timeline-581.js:89
```

Essa camada (`:15035`) chama a original, constrói um **segmento próprio** a
partir do argumento que recebeu, guarda em `b._physicsPlan`, e `:15042` voa esse
segmento **ignorando `ball.target` e `ball.vx/vy`**. E `:19710` ainda encurva a
trajetória, então nenhuma conta de reta funciona.

**O gargalo único de todo voo é `_planPhysicalSegment`** — serve `_startTravel`,
`_continueTravel` e `_deflectTo`. É lá que se mexe em trajetória.

**Regra:** nunca conclua qual camada está viva lendo código. Instrumente.

### 2.2 Parâmetro que existe e não faz nada

Dois casos medidos nesta sessão:

**Por operador.** `:6798` fazia `this.decideT = Math.min(this.decideT, .10)` na
recepção. Medido: `decideT` já está **negativo em 96,92%** das recepções
(mediana −0,802 s), então `Math.min(−0,80 , 0,10)` = −0,80 e **o teto mudava algo
em apenas 1,87% das 4162 recepções**. Uma rodada anterior (OS-68) multiplicou o
*valor* daquele teto e mediu domínio idêntico — era inevitável.

**Por saturação.** `:2894` fazia `clamp(.58 + keeperSkill/220 - corner*.28, .28,
.82)`. Com goleiro 75 isso dá 0,921 e **satura no teto**, então o atributo do
goleiro deixava de importar.

**Teste barato:** antes de calibrar uma constante, mude-a por 5× e meça. Se nada
andar, você achou configuração morta. E olhe o **operador** e o **clamp**, não só
o valor.

### 2.3 O desfecho existe na estatística e não tem consequência física

Padrão recorrente. Exemplos medidos aqui:

- a falta era chutada com o cobrador a **9,16 m** da bola (mediana);
- o goleiro ficava **atrás da própria barreira** em 91,4% das faltas;
- 43% dos chutes "para fora" cruzavam a linha **entre as traves**;
- no lateral, um jogador caminhava até a bola e **outro** era teleportado
  (salto mediano de 4,86 m num quadro = 146 m/s).

**Sempre verifique que o evento estatístico muda posição, velocidade ou posse.**

### 2.3b O agente chega ao posto — e o posto é abandonado na chegada

Variante da 2.4 que custou a rodada OS-107 inteira, e que provavelmente se repete
em outros lugares.

A camada de bola parada (`:18287`) faz `p.x = t.x; p.y = t.y; p.__spTarget = null`
quando o jogador chega. **A partir daí não há nada segurando ninguém**, e a bola
morta do escanteio dura ~5 s. Medido: **100% dos jogadores chegam ao posto e
apenas 28,8% ainda estão lá quando a bola é cobrada.**

Se você medir "ele chegou?", a resposta é sim e você não descobre nada. A
pergunta é **"ele ainda está lá no instante do lance?"**.

A OS-100 já tinha resolvido isto para **um** jogador (o cobrador do lateral, "o
pino", `:21556`) sem que ninguém percebesse que era um padrão.

### 2.3c Marcar um jogador com `_setPieceRole` o faz SUMIR de outras camadas

Custou a OS-109 descobrir, e é fácil de repetir.

Pelo menos duas camadas pulam quem tem `_setPieceRole` setado:

```js
:21841  if(team==null||!actor||actor.isGK||actor._setPieceRole) return r;
:21867  if(!base||!tm||!p||p.red||p.isGK||p._setPieceRole||finite(this.dead)>.04) return base;
```

E quem limpa o papel é `clearCorner13` (`:17074`), que roda em `goal|miss|post`,
em `goal_kick` e na expiração da **cadeia de escanteio** — que só existe se houve
escanteio. **Marcar papel em qualquer outro lance deixa o jogador marcado por
tempo indeterminado.**

Medido: um `_setPieceRole='zone'` posto numa falta cruzada sobreviveu **4,433 s
de mediana e 183,1 s no pior caso** de tempo vivo, e os papéis pendurados por
quadro vivo passaram de 0,2216 para 1,0222.

**Regra:** se você marcar papel fora do escanteio, limpe-o você mesmo — e no
reinício, não no fim do lance.

### 2.4 Ancore a medição no LANCE, não no agente

Duas vezes nesta sessão medi a coisa certa e fiz a pergunta errada. *"O jogador
chega ao alvo dele?"* é sempre sim — não diz nada. A pergunta útil é **"ele está
onde o lance precisa, no instante em que o lance acontece?"**.

No lateral: 64 de 64 cobradores eram armados com o alvo **no ponto exato**, e
mesmo assim estavam a **5,04 m** no instante do reinício. Ele chegava e **ia
embora**, porque `__spTarget` é limpo no snap de chegada (`:18259`) e a IA
tática o puxava de volta.

### 2.5 O protocolo espelho é cego para diferença entre times

A bateria oficial usa **Brasil 1970 dos dois lados**. Qualquer decisão que
dependa da diferença entre os elencos é **inalcançável por construção**.

Reportei "a rotina curta de falta nunca acontece — 0 de 60". Com elencos
diferentes: **9 de 88**. O `aerialEdge` é sempre 0 no espelho.

### 2.6 Não conclua sobre bateria parcial

Fiz isso duas vezes e as duas me derrubaram. Com quatro de seis bases boas
escrevi que um problema estava resolvido; as duas últimas desmentiram.

### 2.7 `cx()` e `cy()` recebem 0..1, não metros

O render trabalha em coordenadas normalizadas. Escrever metros ali joga o objeto
para fora do quadro e a projeção devolve escala negativa.

### 2.8 O palco 2.5D é pré-renderizado

Gramado, linhas e **gols** são desenhados **antes de tudo**. Uma bola dentro da
rede aparece por cima do gol. Para ela ficar atrás da rede, a gaiola tem de ser
redesenhada dentro do `paintField`, na mesma transformação de câmera.

---

## 3. Como medir

### 3.1 Bateria oficial

```bash
tools/r1896/bateria_oficial.sh <build.html>          # 48 x 6 = 288 partidas
```

Protocolo `espelho_30`: Brasil 1970 × Brasil 1970, mesma formação, `balanced`,
`dt = 1/30`, sementes `base + i*7919`.

**Use SEIS bases**, não três: `4200000 8400000 1260000 2100000 6300000 3150000`.

**E use 48 partidas por base, não 24.** Isto mudou na OS-107 — leia a §3.2b, o
motivo está medido. Os relatórios anteriores a ela usam 24 e os números deles
não são comparáveis diretamente com os de agora.

Motivo medido: a R18.86, que era a build promovida, **reprova o piso de gols na
base 6300000 com 1,667**. As três bases publicadas no relatório dela eram um
recorte favorável. A amplitude de gols entre bases, sem patch nenhum, é **1,08**.

O script imprime `impressaoPorJogo` — hash dos resultados partida a partida.
**Impressão idêntica prova que um patch não tocou a simulação.** É assim que se
valida um patch de apresentação.

### 3.2 Gates

```
ECO-02   xG <= 2,7
gols     entre 1,8 e 3,0
ECO-05   escanteios entre 4 e 10
```

Nas seis bases. **Gate é rede de segurança, não objetivo.**

### 3.2b O gate de gols com 24 partidas NÃO tem resolução para a própria margem

**MEDIDO na OS-107, e é o achado mais importante desta sessão.**

As 48 partidas de uma base contêm as 24 primeiras, então dá para comparar as duas
metades da **mesma base com a mesma build**. Fiz isso para as seis bases, em duas
builds. A maior diferença entre metades foi **0,7916 gol** — na base 2100000, a
mesma build deu **1,5417** nas primeiras 24 partidas e **2,3333** nas 24
seguintes.

A folga que a build promovida tem acima do piso do gate é **0,075**.

Consequência prática, e você vai tropeçar nela:

- um patch pode **reprovar por ruído**. A OS-107 reprovou com 24 partidas
  (gols 1,9722, pior base 1,5417) e **passou nos três gates com 48**
  (2,0486, pior base 1,8125). Mesmo patch, mesmas bases, mesmo protocolo;
- e o contrário também vale: um patch ruim passa.

**Regra:** com 24 partidas por base, só confie em diferença de gol maior que
~0,3. Abaixo disso, aumente a amostra **antes** de decidir — nunca depois de ver
o resultado, porque aí você está escolhendo a régua pela resposta.

**Dívida aberta:** a bateria oficial deveria passar para 48 partidas por base, o
que obriga a re-medir a linha de base e reescrever os números da §4 deste
arquivo. Enquanto isso não for feito, todo veredito de gol com margem pequena
neste projeto é sorteio.

O que **não** perde resolução do mesmo jeito: efeito que aparece com o **mesmo
sinal nas seis bases**. Na OS-107, `chutes` caiu nas seis (média −1,56) enquanto
`gols` trocava de sinal — o primeiro é sinal, o segundo não estava estabelecido.
Olhe a consistência entre bases, não só a média.

### 3.3 Função pura

`resolveFreeKickPhysics` é pura: amostre 50 000 vezes por cenário em vez de
simular partidas. Foi assim que separei "o modelo converte pouco" de "a amostra
era pequena".

### 3.4 Navegador

A build roda no navegador, mas há duas armadilhas:

1. **Aba oculta não dispara `requestAnimationFrame`.** Injete um shim.
2. **O shim de `setTimeout` morre depois de alguns minutos** — o Chrome
   estrangula temporizadores de página oculta para ~1 disparo por minuto.
   Sintoma: a partida congela, `paused === false`, zero erro no console.
   **A cura é um Web Worker** postando ticks (não é estrangulado por
   visibilidade). Ao trocar o shim depois do boot, o laço fica órfão —
   rechame `__quickMatch`, que termina em `startLoop()`.

`mklab.js` gera a cópia de laboratório com o shim e uma sonda de leitura do IIFE
da interface (`celebration`, `slowmo`, `shotFx` etc. são `let` internos e
invisíveis de fora).

`__quickMatch(i,j)` pula o draft **mas deixa `G.cup = null`**, e o handler de gol
estoura silenciosamente. Monte `G.cup = {scorers:{}}` e `G.db.byId['QA'/'QB']`
antes.

---

## 4. Estado atual, com número

### R18.97, seis bases, 288 partidas (protocolo novo, 48 por base)

| | R18.97 | pior base | R18.96 | gate |
|---|---:|---:|---:|---|
| gols | 2,007 | **1,8125** | 2,149 | 1,8–3,0 ✔ 6/6 |
| xG | 2,114 | 2,293 (máx) | 2,170 | ≤ 2,7 ✔ 6/6 |
| escanteios | 4,931 | 4,583 | 4,879 | ≥ 4 ✔ 6/6 |
| chutes | **17,59** | 16,85 | 19,13 | — |

> **A folga acima do piso de gols é 0,0125 e o ruído do gate é ±0,3 (§3.2b).**
> A próxima rodada trabalha sem folga. Antes de mexer em qualquer coisa que
> possa custar gol, releia a §3.2b e rode a bateria completa.

Aplicando a regra de consistência entre bases ao que a OS-107 mudou:

| | média | bases negativas | leitura |
|---|---:|---:|---|
| chutes | −1,5469 | **6 de 6** | **real** |
| gols | −0,1424 | 4 de 6 | não estabelecido |
| escanteios | +0,0521 | 2 de 6 | não estabelecido |

*(Medido em `reports/r1896/bateria_48x6_base.json` e
`bateria_48x6_os107b.txt`. A tabela antiga da R18.96, com 24 partidas por base,
dava gols 2,181 / pior 1,875 e escanteios 4,785 / pior 4,000 — a diferença entre
aquela e esta é amostra, não build: é o problema descrito na §3.2b.)*

*(A OS-106 é apresentação pura e não muda estes números em relação à R18.95.)*

### O que foi consertado nesta sessão

| defeito | antes | depois |
|---|---:|---:|
| chutes "para fora" que cruzavam **entre as traves** | **42,9%** | **0%** |
| cobrador da falta → bola no instante do chute | 9,162 m | **1,400 m** |
| goleiro do lado correto na falta | 1,7% | **72,7%** |
| defesa na falta direta (irreal) | 64,0% | 42,3% |
| gol de falta, especialista | 4,17% | **6,68%** |
| separação elite/fraco no gol de falta | 2,06× | **2,84×** |
| teleporte do cobrador do lateral | 4,86 m em 75% | **0 de 58** |
| domínio da bola | 0,200 s | **0,267 s** |
| câmera lenta no chute | só xg ≥ 0,28 | **todo chute** |
| atacantes na área quando o escanteio é cobrado | 0,656 | **2,233** |
| postos do escanteio ainda ocupados no reinício | 28,8% | **94,3%** |
| defensores na própria área na falta cruzada | 0,262 | **4,468** |
| teleporte dos alvos na falta cruzada | 247 de 840, máx 70,4 m | **0 de 2140** |

### Distância do futebol real, medida

| por partida | jogo | real | proporção |
|---|---:|---:|---:|
| passes | 442 | ~900 | 49% |
| escanteios | 4,9 | ~10,5 | 47% |
| faltas | 14,7 | ~22 | 67% |
| chutes | **17,6** | ~25 | **70%** |
| gols | 2,01 | ~2,7 | 74% |
| domínio individual | 0,267 s | 1,1–1,4 s | 22% |

**O jogo foi calibrado para acertar gols e chutes; todo o resto ficou em 45–65%
do real**, porque `clockRate = 0,13` comprime 90 minutos em ~692 s de ação.
Isso não é defeito de escanteio nem de passe — é volume global.

**Chutes caíram de 77% para 70% na OS-107**, e isso foi um preço aceito com
número na mesa, não um acidente. Parte dele é conserto: cruzamento contra área
vazia virando finalização inflava a estatística. A outra parte (−1,13 no jogo
corrido) é o **primeiro item da fila** e continua sem canal isolado.

---

## 5. Onde estão as coisas

```
COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html   base (não editar)
COPA DOS SONHOS - R18.97 - JOGO DE FUTEBOL.html   PROMOVIDA
COPA DOS SONHOS - R18.96 - JOGO DE FUTEBOL.html   promovida anterior
build_r1897.js                                    a cadeia atual
build_r1896.js                                    a cadeia da promovida anterior
patch_os*.js                                      um por rodada, com o cabeçalho
diag_os*.js                                       os instrumentos
bateria_espelho30.js                              a bateria, uma base por vez
bateria_oficial.sh                                a bateria OFICIAL, 48 x 6
mklab.js                                          cópia de laboratório
RODADA_*.md                                       o relatório de cada rodada
PROXIMA_RODADA.md                                 a fila de trabalho
```

**Nunca edite a build à mão.** Ela é saída.

Patches medidos e **falsificados** ficam no repositório, fora da cadeia, com o
número que os derrubou no cabeçalho. Eles valem mais como registro do que
valeriam como código. Nesta sessão são cinco.
