# OS-207 · A "bugadinha" da bola parada

Relato do dono: *"a bugadinha que dá na animação na hora que o jogador vai bater
falta, escanteio, sofre falta"*.

Não é uma. São quatro defeitos independentes que se encontram no mesmo instante
do jogo — justamente o instante em que a bola está parada, nada acontece e o
olho tem tempo de olhar.

O HTML entregue estava à frente do `src/` (tinha OS-203 e OS-206; o repositório
parava na OS-202). Ele foi importado com `tools/import_build.py` antes de
qualquer correção, e `tools/build.py` confirmou que remontava o arquivo do dono
byte a byte (`sha256` idêntico) antes de começar.

---

## Os quatro defeitos

### 1 · A passada do batedor saltava de volta (OS-89, desenho)

`70-game-runtime-and-rendering.js`

A OS-89 avança o corpo do batedor sobre a bola só no desenho. O fator subia até
1 no primeiro terço e **ficava** em 1 pelos 66% restantes dos 420 ms; no quadro
em que a animação terminava, o deslocamento caía a zero de uma vez. O desenho
saltava de volta o vetor inteiro jogador→bola — até 6 m.

E isso acontece embaixo do `slowmo` de 0,35× que a OS-88 liga *justamente para o
dono olhar a cobrança*. Era o pulo mais visível do jogo.

Agora o pé avança, encosta e o corpo volta ao eixo físico de forma contínua: em
`_e = 1` o deslocamento já **é** zero, então não existe quadro de salto.

### 2 · O tremor do #anti-cardume na bola parada (desenho)

`70-game-runtime-and-rendering.js`

O balanço #anti-cardume foi calibrado para quem **corre**: amplitude até 2,2 px
oscilando a 14–24 rad/s, proporcional ao deslocamento de tela do quadro. Ele
entra no desenho, e `CDS_F25D.body` deriva a passada do deslocamento
**desenhado** (`d.vms`) — então o balanço realimenta a própria cadência das
pernas.

Correndo isso é tempero (a §D41 mediu 2% de `mv`). Na bola parada, que é quando
todo mundo **caminha** a ~1 m/s até o posto, o deslocamento real por quadro cai
para a mesma ordem de grandeza do balanço — e ele deixa de ser tempero para
virar a maior parte do sinal.

Bola parada não tem cardume para quebrar: ninguém está correndo em bloco. O
balanço desliga com a bola morta e volta com ela rolando.

### 3 · Quem sofre a falta não tinha gesto nenhum

`21-cds-ux-boot.js` + `60-cds-os46-anim-wiring.js`

São 62 estados de animação declarados e **nenhum deles é levar uma falta**. O
motor emite `foul` com `by` e `on` desde sempre; a apresentação tinha só
`fxAt(e.on,'foul')` — uma partícula e um som. O jogador derrubado seguia com a
locomoção que tivesse, então a falta lia como "apitou do nada" e ele saía
trotando do próprio tombo.

É o evento mais frequente sem gesto: ~21 por partida nesta build.

Entram `fouled` (o desequilíbrio) e `get_up` (a recomposição), em *tier* de ação
para que a locomoção não os sobrescreva, com envelope e pose próprios. O
infrator ganha `standing_tackle → recover` — antes só o ramo do bote pedia pose,
e a maior parte das faltas vem de outros ramos.

### 4 · A animação lia a velocidade antes da bola parada escrever a posição

`79-os207-cerimonia-sem-tremor.js` (camada nova, a última do documento)

Cada camada envolve `P.step` capturando a anterior, então a **ordem do
documento** decide quem roda por fora de quem. A ponte de animação é o bloco 21.
Depois dela ainda escrevem `p.x/p.y` — várias também `p.vx/p.vy` — a OS-77
(falta comum), a OS-83 (impedimento), a OS-100 (lateral), a OS-107 (bloco de
bola parada), a OS-112 e a R18.99.

Ou seja: **tudo** que move gente durante a cerimônia escreve depois que a
animação já escolheu a pose do quadro. O desenhista pinta a posição final; a
máquina de estados escolheu a pose com a velocidade do meio do caminho.

A R18.99/T7 diagnosticou exatamente este sintoma — o comentário dela diz, com
todas as letras, *"o 'meio bugadinho' que se vê na hora da falta"* — e a conta
dela está certa. Só que ela aplica a correção **quatro níveis por fora** da
ponte: a velocidade corrigida existe e a animação nunca a vê, porque o quadro
dela já passou.

A correção não é refazer a conta, é mudar a **hora**.

---

## Medição

`tools/fisica/tela/cerimonia.js` (sonda nova). Ela existe porque a bateria de
física **não consegue** medir isto: ela pula o bloco `cds-ux-boot`
(`bateria.js:65`), que é onde moram a ponte de animação e o desenhista.

A sonda compara a faixa de locomoção que a máquina de estados escolheu com a
velocidade que o deslocamento do quadro implica — as duas coisas que o
desenhista junta na tela. 6 partidas, bola morta apenas.

| | antes | depois |
|---|---:|---:|
| quadros de bola morta | 32.283 | 32.283 |
| amostras de locomoção | 247.258 | 237.583 |
| pose fora da faixa | 61.116 (24,72%) | 27.650 (11,64%) |
| **desenhado PARADO e deslizando** | **316** | **0** |
| **desenhado CORRENDO e parado** | **10.617 (4,29%)** | **0** |

As duas linhas em negrito são a "bugadinha" descrita. Zeradas.

O resíduo de 11,64% é discordância de faixa **vizinha** (`walk` desenhado com a
velocidade já em `jog`), que é inerente: a animação suaviza e as faixas são
discretas. As duas categorias patológicas não existem mais.

### Custo: nenhum

`reports/antes-os207.json` e `reports/depois-os207.json`, 48 partidas, mesmas
sementes. Os agregados são **idênticos campo a campo** — conferido por
comparação de JSON, não a olho. 12/13 métricas de design, as mesmas antes e
depois. O smoke de navegador devolve o mesmo placar (0x1, 15 chutes) e a sonda
conta os mesmos 32.283 quadros de bola morta.

Isso é por construção: a velocidade honesta é **emprestada**. A camada troca
`p.vx/p.vy` pelo valor coerente com o deslocamento, manda a ponte amostrar, e
devolve os originais no mesmo passo, num `finally`. O motor termina o quadro com
exatamente os números que teria sem a camada.

---

## O que foi tentado e revertido

A primeira versão da OS-207 também mexia no motor, e a bateria a reprovou.

**Freio contínuo da cerimônia.** O motor chama
`_movePlayers(pdt, this.waiting || this.dead > 0.4)` e isso vira `freeze ? .5 : 1`.
São dois defeitos reais: (a) no quadro em que `dead` cruza 0,4 os 22 jogadores
dobram de velocidade juntos; (b) as camadas de espera do batedor seguram o
reinício devolvendo `dead = 0.12` quadro a quadro, e como 0,12 < 0,4 o freio
fica **desligado durante toda a cerimônia** — o sistema tático corre a 100%
disputando cada jogador com o alvo de bola parada.

O diagnóstico continua de pé. A correção não: trocar o degrau por uma rampa
levou **12/13 → 11/13**, com `zeroZeroRate` indo de 0,062 para 0,146 (faixa
0,045–0,12) e `onTargetRate` caindo para fora por baixo. Bola parada é onde se
fazem gols; mexer no passo de quem se posiciona muda quantos saem. É a mesma
armadilha que a R18.35 documentou — as métricas de volume não viram, a
distribuição de placares viu.

**Escritor final do batedor.** `snapTakerBeforeRestart` crava o batedor no ponto
no quadro do reinício, e a R18.99/T3 não o alcança: ela roda só quando `dead > 0`
nos dois extremos do quadro, e o quadro do reinício termina com `dead <= 0` —
além de pular qualquer salto acima de 2,50 m como recolocação administrativa.
O snap cai exatamente nas duas exceções.

Medido no HTML original: **5,66% dos reinícios** (15 de 265) com salto acima do
passo físico, média 0,95 m, máximo 4,94 m. É pequeno e quase sempre invisível.
A tentativa de corrigi-lo por fora andava junto com o freio e não foi possível
separar o efeito sem outra rodada de calibração.

**Fica registrado como pendência**, não como corrigido. É trabalho de motor, com
medição própria — não de apresentação.

---

## Pendência adicional encontrada (não corrigida)

O desenhista guarda três caches por **nome** do jogador: `_prevScreen` (balanço),
`dirCache` (passada, em `CDS_F25D.body`) e `__CDS_SCREEN.p` (posição de tela,
lida pela OS-21). A ponte de animação já corrigiu esta exata colisão para os
seus próprios ids — *"ids sem o time colidiam entre os dois lados e dois atletas
dividiam o mesmo controlador (22 jogadores viravam 17 estados)"* — mas os três
caches do desenho ficaram por nome.

Dois jogadores homônimos em campo dividem passada e balanço a partida inteira.
Não é o defeito relatado (não é específico de bola parada) e a correção cruza
quatro arquivos e um contrato entre camadas, então ficou de fora desta rodada.


---

# Verificacao independente (pedido: "verifique se arrumou mesmo")

As tres correcoes de desenho nao tinham sido medidas na camada de desenho — so
por raciocinio de codigo. Duas sondas novas fecham isso.

## `tools/fisica/tela/gestos.js` — os gestos chegam ao desenho?

Intercepta `CDS_F25D.body` numa partida real (`window.__quickMatch`, com rAF,
canvas e `paintField` de verdade) e conta o estado entregue ao desenho.

`fouled` e `get_up` aparecem: **33 e 34 amostras desenhadas** em 3 minutos de
tela. O gesto que nao existia existe.

Achado de brinde, medido: **8 estados declarados nunca chegam ao desenho** —
`first_touch_pass`, `placed_shot`, `volley`, `body_feint`, `gk_punch`,
`gk_smother`, `gk_throw`, `gk_kick`. Tres deles (`placed_shot`, `gk_kick`,
`gk_throw`) chegam a ser PEDIDOS pela OS-46 e mesmo assim nunca sao vistos:
sao atropelados no mesmo tier antes de virar quadro. Fica registrado.

## `tools/fisica/tela/passada-parada.js` — o corpo salta ou anda?

Le a posicao DESENHADA de cada atleta em cada quadro, na velocidade padrao do
jogo. Duas armadilhas que a primeira versao caiu e o comentario do arquivo
guarda: `CDS_F25D` e `Object.freeze` (trocar um metodo dentro dele falha em
silencio) e o teto de salto tem de descontar `G.speed`, senao o avanco rapido
vira "defeito".

| bola morta, 3X | seu HTML | OS-207 | OS-208 |
|---|---:|---:|---:|
| tremor (reversao de direcao) | 7,69% | 5,32% | 5,72% |
| salto de desenho | 58,23% | 62,30% | **34,52%** |
| salto maximo | 4,59 m | 5,33 m | — |

O tremor caiu como esperado (confirmado tambem a 6X: 15,72% -> 9,46%).

**O salto NAO tinha caido** — a OS-207 nao mexia nele, e a sonda provou que era
o maior defeito visivel que restava. Dai a OS-208.

---

# OS-208 · o corpo nao teletransporta, mesmo quando a ficha teletransporta

`70-game-runtime-and-rendering.js`

A causa dos 58% nao e bug de fisica: sao as **recolocacoes administrativas**.
Troca de campo, formacao inicial, reinicio apos gol e o snap do batedor poem o
atleta noutro lugar de uma vez, de proposito. A R18.99 catalogou isso e decidiu
— com razao — nao tocar: `SALTO_ADMIN` existe para o motor poder recolocar quem
precisa recolocar.

O erro foi deixar essa decisao vazar para a TELA. O motor pode recolocar uma
ficha; o corpo desenhado nao pode aparecer noutro lugar.

O desenho passa a perseguir a posicao real com teto de passo. O teto e generoso
de proposito — 15 m/s, o dobro do sprint — para que nenhuma corrida real fique
devendo: no jogo normal o passo nunca chega ao teto, entao nao existe atraso.
Quem dispara e so o que ja era impossivel. Acima de 34 m nao ha o que animar (o
atleta trocou de metade do campo) e o corte e honesto.

**Medido: 58,23% -> 34,52% de saltos, media 0,63 m.** Fisica intocada: e o laco
de desenho, nao o motor.

O residuo de 34,5% e a folga deliberada do teto — saltos entre o maximo fisico
(~7 m/s) e os 15 m/s do teto ainda passam. Apertar o teto reduz o residuo e
comeca a atrasar o corpo em relacao a bola; a folga foi escolhida para o lado
de nunca dever corrida.


---

# OS-209 · a chave de desenho passa a ser qualificada por time

Tres caches do desenho indexavam o atleta so pelo **nome**: `_prevScreen` (o
balanco), `dirCache` (a passada, dentro de `CDS_F25D.body`) e `__CDS_SCREEN.p`
(a posicao de tela, lida pela OS-21). Dois homonimos em campo dividiam passada,
balanco e posicao a partida inteira.

A ponte de animacao ja tinha achado e corrigido esta mesma colisao para os ids
dela — *"22 jogadores viravam 17 estados"*. Os tres caches do desenho ficaram
para tras. Agora os quatro pontos usam a mesma formula.

Risco conferido: se a chave do desenhista e a da ponte nao casarem, a animacao
inteira para. Medido com `gestos.js` — 79.024 amostras, 22 sem estado (0,03%,
os primeiros quadros antes da primeira publicacao) e os mesmos 49 estados.

---

# Fila medida, ainda aberta

Ordenada por evidencia, nao por palpite. Cada item ja tem o numero que o
justifica.

1. **8 gestos declarados e nunca desenhados** (`gestos.js`): `first_touch_pass`,
   `placed_shot`, `volley`, `body_feint`, `gk_punch`, `gk_smother`, `gk_throw`,
   `gk_kick`. Tres deles (`placed_shot`, `gk_kick`, `gk_throw`) chegam a ser
   **pedidos** pela OS-46 e ainda assim nunca viram quadro — sao atropelados no
   mesmo tier. `placed_shot` sai so abaixo de 20 m e `power_shot` desenhou 94
   amostras contra 0 dele, o que sugere que o predicado de distancia, e nao o
   tier, e o culpado. Precisa de instrumentacao do caminho pedido -> desenho.

2. **Salto de desenho residual: 34,5%.** O teto da OS-208 e 15 m/s, o dobro do
   sprint, escolhido para nunca dever corrida. Apertar reduz o residuo e comeca
   a atrasar o corpo em relacao a bola — precisa de medicao do atraso, nao so
   do salto.

3. **O freio da cerimonia** (diagnostico de pe, correcao reprovada). O `freeze`
   e um degrau em `dead = 0.4` e as camadas de espera o mantem desligado
   segurando `dead = 0.12`. Qualquer correcao aqui muda placar: exige rodada de
   calibracao propria.

4. **O snap do batedor no reinicio**: 5,66% dos reinicios, media 0,95 m, maximo
   4,94 m. Escapa do orcamento da R18.99 por duas excecoes. A OS-208 disfarca no
   desenho; a fisica continua saltando.


---

# Validacao de lance — e as tres armadilhas de medicao

`tools/fisica/tela/validar-lances.js`. Valida INVARIANTE POR OCORRENCIA em vez
de media por partida: agregado dentro da faixa esconde lance individual
quebrado, e lance quebrado e o que o dono ve.

A primeira versao caiu em tres armadilhas, todas produzindo numero convincente
e errado. Ficam escritas no arquivo:

1. **A geometria nao pega a saida.** Observar `ball.y` na borda perde quase todo
   lateral — o motor detecta e resolve a saida no MESMO passo. A sonda contou
   1 lateral em 61 min; a bateria mede 15,98 por partida. O gatilho tem de ser
   o evento (`throw_in`) e o envelope, `_ballOut`.

2. **A marca do batedor morre antes da cobranca.** As camadas de espera limpam
   `__cdsTakerWait` assim que ele chega, e so DEPOIS `dead` expira. Medir por
   ela devolve ZERO amostra — nao "tudo certo", zero.

3. **`_setPieceRole` nao identifica a barreira.** Ele marca zona, marcacao e
   cobertura tambem. Pegar o adversario mais proximo entre todos que o carregam
   mede o MARCADOR em cima da bola: acusou "barreira a 0,29 m" que nao existe.
   E medir a barreira certa na hora errada tambem engana — desde a R18.99 ela
   CAMINHA ate os 9,15 m, entao o que vale e onde ela esta na COBRANCA.
   Corrigidas as duas coisas: **3/3 a 9,54 m**. A barreira sempre esteve certa.

## Resultado com o instrumento consertado

    FALTA (14-22 ocorrencias)
      ok   F1 vira reinicio                          22/22
      ok   F2 bola no ponto da falta                 22/22   pior 0,85 m
      ATN  F3 batedor na bola na cobranca            21/22
      ok   F4 barreira a 9,15 m                        3/3   menor 9,54 m
      ok   F5 gesto de falta em quem sofreu          22/22
      BAI  F6 batedor nao salta na cobranca          19/22

    ROUBADA DE BOLA (52 desarmes, 14 errados)
      ok   R1 desarme troca a posse                  52/52
      ok   R2 bote errado: bola fica, defensor atrasa 14/14
      BAI  R3 gesto de perda em quem foi desarmado   36/46   78,3%
      ok   R4 bola nao teleporta na troca            10/10   pior 1,52 m

    LATERAL (22 saidas, 22 reposicoes)
      ok   L1 posse para o adversario do ultimo toque 22/22
      ok   L2 bola reposta sobre a linha              22/22
      ok   L3 cobrador na bola na reposicao           22/22   pior 0,54 m
      ok   L4 a reposicao entra em campo              22/22
      ok   L5 cobrador nao salta para a bola          22/22   pior 0,10 m

**O lateral esta integro nos cinco invariantes.** Falta e roubada de bola
passam no essencial, com tres pontas abertas: F3/F6 (um batedor em 22 chega
longe e tres saltam) e R3 (24% de quem e desarmado nao ganha gesto de perda).

---

# O pontape apos o gol — relatado, confirmado, NAO corrigido

RELATO: *"depois que rola o gol o jogo comeca do nada com os jogadores
espalhados no campo"*.

CONFIRMADO, e e grave:

    SAIDA DE BOLA APOS GOL (5 ocorrencias)
      G1  os dois times na propria metade     0 de 5
          pior invasao 31,5 m; 4,2 jogadores do lado errado, em media
      G2  time armado (<= 6 m do posto)       0 de 5
          distancia media ao posto 19,27 m; pior caso 69,1 m
      G3  circulo central so com quem deve    3 de 5

## O que tentei, e por que nao ficou

Hipotese: `_resetPositions` poe os 22 na formacao, a R15 converte isso em
caminhada (certo, para o corpo nao piscar) mas fecha a janela em `DEAD_CAP`
2,2 s — e voltar da area adversaria sao 40-70 m, uns 11 s. O pontape sairia com
o time no meio do caminho.

Escrevi a OS-211 abrindo a janela na medida de quem esta mais longe, e o
runtime passou a simular durante a comemoracao enquanto a bola esta morta (a
comemoracao ja e uma pausa de >= 2,8 s em que nada acontece no gramado — seria
tempo de graca).

**Reprovado duas vezes, e a hipotese estava errada:**

- A bateria caiu de 12/13 para 10/13 (`zeroZeroRate` 0,042 contra o piso
  0,045; `blowoutRate` 0,208 contra o teto 0,190). Congelar o folego durante a
  janela — porque `deadBallRecovery` transformava 30 s a mais de bola morta em
  descanso gratis — nao mudou nada, o que ja indicava que a causa era outra.
- E, decisivo: **a correcao nao corrigiu**. G1 continuou 0 de 4 e a distancia
  media ao posto foi de 19,27 m para 19,68 m. O pior caso melhorou (69,1 ->
  37,8 m) e so.

Revertida. A bateria voltou a 12/13 com `averageEndingStamina` em 64,40,
identico a linha de base — o que confirma que a camada era mesmo a causa da
queda, e que a reversao esta limpa.

## A causa provavel, para a proxima rodada

Se alongar a caminhada nao resolve, quem desfaz a volta para casa nao e o
tempo: e o **sistema tatico**, que roda a 100% durante a bola morta e puxa cada
jogador de volta para a bola enquanto a maquina de bola parada o puxa para o
posto. E o MESMO cabo-de-guerra diagnosticado na OS-207 — o `freeze` e um
degrau em `dead = 0.4` e as camadas de espera o mantem desligado segurando
`dead = 0.12`.

Ou seja: a "bugadinha" da falta e o "time espalhado" no pontape sao o mesmo
defeito, visto de dois lugares. A correcao dele ja foi tentada e reprovada uma
vez (OS-207, primeira versao) porque mexe no passo de quem se posiciona e isso
muda placar. **Nao e trabalho de uma tacada: e uma rodada de calibracao
propria, com dose medida como a R18.35 fez.**

O que ficou no jogo desta tentativa: durante a comemoracao a simulacao continua
enquanto a bola esta morta, entao a caminhada que JA existia (os 2,2 s) acontece
debaixo do confete em vez de virar pausa depois dele. E apresentacao pura e nao
aparece na bateria — mas nao resolve o relato, e nao vou dizer que resolve.


---

# OS-212 · "quero sentir fluidez dos toques igual futebol"

## O defeito, medido

    tempo entre GANHAR a bola e SOLTA-LA (161 passes de partida real)
      p10  0,433 s     p25  0,467 s     p50  0,950 s
      abaixo de 0,35 s: 2 passes em 161  (1,2%)

Nao existe tabelinha. Toda bola para no pe e so depois anda. E por isso que o
jogo nao "flui": sao passes deliberados, um de cada vez.

**Nao e acidente, e um portao.** O nucleo so decide quando
`owner.settle <= 0 && decideT <= 0` (40-match-engine:478), e a recepcao atribui
os dois — `settle` (0,10–0,34 dividido pela execucao) e `decideT = 0,28`.

E a prova de que o motor JA QUERIA isto: `_evaluateShotDecision` calcula
`const firstTime = o.settle > 0 && o.settle < .45` (:954) e decide com esse
valor. So que essa funcao so roda dentro de `_decide`, que so e chamado com
`settle <= 0`. **`firstTime` e sempre falso.** O conceito esta escrito, e lido,
e nao pode acontecer — o mesmo padrao dos gestos que entravam e nunca viravam
quadro, um andar abaixo.

## A correcao, e por que ela ainda nao entrou

A camada nao inventa passe nenhum: abre o portao mais cedo quando o passe de
primeira esta na mesa, e deixa o proprio `_decide` escolher, com a mesma
logica e o mesmo sorteio. Nenhum RNG novo.

Funciona. O que falta e a DOSE — e o caminho ate aqui tem uma licao:

**Primeira medicao: numeros identicos a linha de base.** Parecia "sem efeito
colateral". Era "sem efeito nenhum": eu testava `best.target`, e `_bestPass`
devolve `{m, score, proj, dist, progressM, risk, intoBox, ...}` — o companheiro
e `m` e `target` nao existe. A camada rejeitava 100% das ocasioes em silencio.
Escala real, medida depois: score p10 0,46 / p50 1,63 / p90 3,05; risk p10
-0,08 / p50 -0,03 / p90 0,66.

Com a forma certa, duas doses em 48 partidas cada:

| dose | resultado |
|---|---|
| habilidade 62, nota 1,05, "pressao **OU** tabelinha" | **9/13** — gols 3,31 (teto 3,2), vermelhos 0,354 (teto 0,3), goleadas 0,271 (teto 0,19) |
| habilidade 76, nota 2,20, "pressao **E** curto" | **11/13** — vermelhos 0,313, 0 a 0 em 0,146; e `drawRate` ENTROU na faixa (0,125 → 0,312) |

Linha de base: 12/13. A segunda dose troca um defeito por outros dois — nao e
claramente pior *em especie*, mas e pior pela regua do projeto.

**A camada fica no repo, fora do bundle** (`src/scripts/layers/80-os212-…`,
sem entrada no manifesto), com as duas medicoes no cabecalho. A terceira dose e
varredura, nao palpite: `tools/fisica/calibrar.py` existe exatamente para isso,
e os eixos na ordem em que mordem sao `NOTA_MIN`, `HABILIDADE`, `JANELA_MIN`.

O que eu nao vou fazer e ligar no seu jogo uma mudanca que derruba duas
metricas de design para entregar uma sensacao que eu nao medi.
