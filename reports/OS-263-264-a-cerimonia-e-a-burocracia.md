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

## OS-267 — o corte do lance

O dono trouxe a decisão de design junto com o relato: *"ela eh batida do nada,
os times as vezes tao ate mal comportado... veja se eh melhor fazer um corte no
lance e voltar com tudo ja reajustado ou reajustar ali mesmo."*

**O corte, e a resposta é medida.** Reajustar ali mesmo foi tentado duas rodadas
seguidas: a caminhada escreve em `__spTarget`, compartilhado com falta,
escanteio, lateral e goleiro, e toda variante contaminou a cobrança. O corte não
tem esse problema porque **não toca em nada do motor**: sai da imagem, o
reposicionamento acontece escondido, a imagem volta com o campo montado.

A coreografia da falta ficou assim, e cada peça já existia:

| beat | de onde vem |
|---|---|
| contato em câmera lenta 0,40× por 650 ms | OS-266 |
| escurece em 240 ms | OS-267 |
| escuro por 200 ms — o reposicionamento acontece aqui | OS-267 |
| clareia em 320 ms | OS-267 |
| pausa em tempo real | OS-263 |
| cobrança | |

**A aceleração foi retirada, e o porquê vale mais que ela.** A ideia era adiantar
a bola morta por baixo do escuro. Funciona no papel e destrói o lance na
prática: o laço de render é de passo fixo e roda muitos `sim.step` por quadro
desenhado, então com 9× sobre o 3× do botão **um quadro come 0,45 s de
simulação** — e a cobrança saía *debaixo do escuro*, com a imagem voltando com a
bola já longe. Quatro contenções tentadas e medidas:

| tentativa | resultado |
|---|---|
| margem de 0,55 s de `dead` | pior caso 22,3 → 10,1 m |
| margem de 1,20 s | ~12 m |
| guarda na condição do laço | conserta a falta e **congela o jogo** (`bola_parada_fora_do_campo` 48×) |
| teto no orçamento de `acc` | volta a 90,5% com pior 18,9 m |
| **só o véu, sem aceleração** | **F2 23/23 · pior 0,85 m** |

O véu sozinho já faz o trabalho — ele esconde o reposicionamento, que é o
pedido. Sem a aceleração a camada não passa de um `fillRect` com alfa: não pode
afetar a simulação nem por acidente.

---

## OS-268 — o pontapé depois do gol, e a cerimônia que não sabia acabar

O relato do dono é o mesmo de sempre, e é o caso com a pior arrumação medida:
*"quando rola um gol o jogo começa do nada sem os jogadores se organizarem"*.

A OS-264 diagnosticou isso por completo (o poste anda 32,6 m, os atletas
perseguem um alvo que foge) e a correção por posição foi revertida três vezes
por contaminar a cobrança de falta. **O corte resolve por outro caminho: não
arruma nada, só não mostra a arrumação.** Zero escrita no motor.

**A primeira versão do corte de pontapé foi um fracasso instrutivo.** Medida em
partida inteira a 3×, três gols:

| | duração do véu | quadros pretos | ainda caminhando ao voltar |
|---|---|---|---|
| pontapé 1 | 1835 ms | 91 | 11 |
| pontapé 2 | 1969 ms | 88 | 11 |
| pontapé 3 | 1933 ms | 91 | 11 |

Um segundo e meio de tela preta **e** a imagem voltando com onze jogadores ainda
andando. O pior dos dois lados.

**A causa não estava no corte.** A linha do tempo de um gol denuncia:

```
goal       t = 268634
_kickoff   t = 269801   dead = 2,2 s   22 alvos de caminhada
arrumado   t = 271785   ->  1984 ms de PAREDE caminhando de volta
```

A caminhada de volta à formação leva 2,2 s de *simulação*, que como burocracia
normal (`_espera` 3,5× sobre o botão) caberia em ~210 ms de parede a 3×. Levava
1984 ms porque **a janela de cerimônia da OS-263 ainda estava valendo depois do
pontapé**, segurando `_espera` em 1 e o multiplicador do botão em 1.

E isso é a OS-263 aplicada larga demais — exatamente o erro que ela própria
diagnosticou na OS-203, agora cometido por mim. A comemoração vai do apito até a
bola ser colocada no círculo central; o que vem **depois** do `_kickoff` é
caminhada de volta, burocracia pura. Ninguém transmite isso.

**§OS-263b** encerra a janela no `_kickoff` — apaga um estado de *apresentação*
que já cumpriu o que tinha para cumprir, sem tocar `dead`, posição ou RNG, e sem
encurtar um milissegundo da comemoração. Com ela, a mesma caminhada:

| | antes | depois |
|---|---|---|
| caminhada de volta, em parede | 1850 · 1984 · 1952 ms | 518 · 618 · 685 ms |

Aí o corte passou a caber. **§OS-268b** derrubou o teto do escuro de 1500 para
700 ms, e **§OS-267c** deixou a entrada terminar: matar o véu no meio dela —
que era o que acontecia quando a bola voltava a rolar aos ~600 ms — troca um
clareamento de 300 ms por um *pop*. Fade sobre bola rolando é exatamente a cara
de uma volta de transmissão.

| pontapé após gol | duração do véu | quadros pretos | **ainda caminhando ao voltar** |
|---|---|---|---|
| primeira versão | 1835–1969 ms | ~90 | **11** |
| **final** | **983 ms** | **30** | **0** |

Zero. A imagem volta com o campo inteiro montado. Na folha de contato
(`reports/imagens/lance-gol-corte.png`): gol e comemoração até +1052 ms,
escurece em +1169, preto de +1403 a +1987, imagem de volta **já no círculo
central com o campo montado** em +2221, bola rolando em +2338.

O pontapé de *começo de partida* ficou de fora do corte (`start === true`): não
há nada a esconder ali — o dono acabou de mandar começar e o campo já está na
formação. Cortar seria um piscar preto na primeira imagem do jogo.

**A lição, e ela se repete nesta rodada inteira:** o defeito não estava na peça
nova. Estava numa peça anterior minha, correta na intenção e larga demais na
aplicação — a mesma frase que escrevi sobre a OS-203 sessenta linhas acima.

---

## OS-269 — o motor desistia da caminhada no meio

Com o corte no ar, a sonda nova (`tools/fisica/tela/o-corte-do-lance.js`)
mostrou que o resultado era **bimodal**:

```
dur   900 ms   caminhando 22 ->  0   vales 0
dur   603 ms   caminhando 21 -> 10   vales 0
dur   543 ms   caminhando 22 -> 11   vales 0
```

`vales 0` mata a hipótese de quadro perdido: `__spTarget` nunca oscila dentro da
janela. Ou os 22 chegam, ou metade do time para no meio do caminho — e o véu,
corretamente, deixa de esconder o que já não está acontecendo.

**A causa é o `DEAD_CAP = 2,2 s` da camada 18**, e ela é deliberada: 2,2 s a
~6 m/s cobrem ~13 m, e o comentário de lá diz por quê — *"jogador atrasado para
o escanteio existe"*. Para o escanteio, certo. Para o pontapé depois de um gol,
os 22 estão amontoados numa área e `far` passa dos 13 m quase sempre.

A OS-269 estica `dead` **só nesse pontapé** até caber a caminhada mais longa que
a camada 18 acabou de agendar. Ela **lê** `__spTarget` e não escreve nele — foi
a escrita nesse alvo compartilhado que derrubou as cinco tentativas da OS-264.

**E aqui eu ia errar a justificativa.** Escrevi na camada que a regra "cada time
na própria metade" estava sendo violada. Medi antes de fechar, 34 partidas e
160 pontapés, e ela não estava:

| | sem OS-269 | com OS-269 |
|---|---|---|
| R1 distância média ao posto | 15,9 m | 16,0 m |
| **R6 fração na própria metade** | **100%** | **100%** |
| R2 atleta mais longe, pior caso | 56,0 m | **45,3 m** |
| R7 maior invasão da metade, pior | 13,3 m | **5,4 m** |

R6 é 100% dos dois lados. E **R1 não melhora porque não pode**: o posto `hx/hy`
anda 32,5 m durante a parada (R4), então o atleta chega no alvo que perseguia e
o posto já é outro. Isso continua sendo a OS-264, em aberto.

O que a OS-269 entrega é a **cauda** e a apresentação: o pior atleta deixa de
terminar a 56 m do posto, a pior invasão cai pela metade, e a caminhada termina
em vez de ser abandonada — que era o que fazia o véu devolver a imagem com dez
ou onze atletas parados em lugares aleatórios.

**R6 e R7 são novos em `o-reinicio.js`**, e existem porque R1 mente quando a
janela muda de tamanho: ele mede contra um posto que se move, então esticar a
janela deixa o atleta chegar **e** dá mais tempo para o alvo fugir. R1 pode
piorar enquanto o campo fica mais arrumado.

**Bateria, 48 partidas, antes e depois:** 10/13 → 12/13 métricas na faixa
(`goalsPerMatch` 3,21 → 3,17 e `redsPerMatch` 0,375 → 0,271 entraram;
`onTargetRate` 0,325 → 0,338, ainda abaixo do piso 0,34). Com 48 partidas isso é
pouco para cravar melhora — o que importa é que **nada saiu da faixa**. O custo
em tempo de jogo é de ~3 s de simulação por pontapé, dois ou três por partida,
e `dead` não move o relógio da partida.

### O teto do escuro, e uma previsão que não se sustentou

A primeira versão do teto convertia bola morta em parede pela conta do próprio
laço de render, `parede = simulação / (botão × ADIANTA_PARADA)`. Parece exata:

```
dead 5,50 s   far 34,7 m   teto previsto 907 ms   caminhada real 569 ms
dead 3,38 s   far 18,1 m   teto previsto 634 ms   caminhada real 634 ms
```

A conta supõe `_espera` cheio a parada inteira, e basta um punhado de quadros em
que ela não valha para a parede esticar sem o teto esticar junto. **Previsão
errada é pior que teto generoso**, porque quem decide o fim do escuro nunca foi
o teto — é a arrumação terminar. O teto só existe para a tela não ficar presa no
preto. Ele escala pelo botão (`2400 / velocidade`, entre 400 e 1800 ms) e sobra
de propósito.

Resultado, quatro corridas seguidas da sonda, oito cortes de pontapé:

| | primeira OS-268 | final |
|---|---|---|
| chegaram ao posto | 11 de 22 em metade dos casos | **22 de 22, 8 em 8** |
| duração do véu | 1835–1969 ms | 847–963 ms |
| tela preta | ~1500 ms | 356–498 ms |

---

## Três sondas consertadas no caminho

Perseguindo essas medições descobri que **três gates estavam medindo a coisa
errada**, e cada um me custou uma hipótese falsa:

**`validar-lances` media F2/F3 em falta comum.** O motor tem dois desfechos e
escreve os dois de propósito: `dtg < 42 && chance(.92)` vira cobrança e põe a
bola no ponto; o resto é *falta comum*, que reinicia com posse para o
companheiro mais próximo. Medir "a bola terminou no ponto" na segunda é cobrar
uma regra que o jogo não tem. Isso deixava F2/F3 **bimodais** — 23/23 numa
passada e 13/15 na seguinte, no mesmo build. Das 26 faltas de uma janela, só 9
viravam cobrança.

**`sanidade` chamava a bola na rede de defeito.** `bola_parada_fora_do_campo`
dava 48 ocorrências numa partida e 96 em outra, sempre com x = −2,8 — uma por
gol. É a bola parada na rede durante a comemoração. Entre sair e ser reposta,
bola parada fora do campo é o estado **certo**.

**`sanidade` chamava goleiro esperando de congelado.** Os exemplos eram Courtois
e Seaman, parados enquanto o jogo acontecia no outro campo.

E a lição de método, que é minha: **eu li demais uma amostra limpa.** Um 17/17
do build anterior me fez afirmar que a OS-264 era regressão certa — com n=17 e
taxa de ~4%, a chance de zero ocorrências é 50%. Repeti o erro ao ler uma única
execução de `sanidade` como prova. As duas vezes, rodar o build anterior mais
vezes derrubou a conclusão.

---

## O que continua em aberto

- **`atleta_congelado_20s` é intermitente e PRÉ-EXISTENTE**, e desta vez com
  medição pareada em vez de impressão. Quatro execuções de cada lado, mesma
  janela de 230 s:

  | | HEAD | build desta rodada |
  |---|---|---|
  | `atleta_congelado_20s` | 2 · 8 · 7 · 8 | 6 · 1 · 2 · 4 |
  | `atletas_empilhados` | 22 · 0 · 0 · 0 | 0 · 0 · 0 · 0 |

  O flag aparece em 4/4 do HEAD e o build novo fica **abaixo** dele — a Mesa
  estava vermelha nisso antes desta rodada. Mas continua defeito de verdade: um
  atleta que não anda 1,5 m em 20 s de jogo **vivo** não é futebol, e o exemplo
  é sempre goleiro (Seaman, Courtois) com a bola a menos de 35 m. Fica na fila,
  e a `sanidade` deveria rodar com semente fixa para deixar de ser loteria.
  `atletas_empilhados` tem causa conhecida: `_resolveOverlaps` exclui goleiros
  por construção.
- **O POSTE que anda 32,5 m durante a parada** é o que sobra da OS-264, e a
  OS-269 confirmou que não dá para contornar por tempo: com janela maior o
  atleta chega ao alvo que perseguia e o alvo já é outro (R1 fica em 16 m dos
  dois lados). A correção medida existe — re-mirar no poste vivo quadro a quadro
  levava R1 a 3,2 m — e continua barrada pelo mesmo motivo: ela precisa de um
  **alvo de caminhada próprio**, que não seja `__spTarget`, com a camada 18
  ensinada a respeitá-lo. Isso é mudança na camada 18.


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
