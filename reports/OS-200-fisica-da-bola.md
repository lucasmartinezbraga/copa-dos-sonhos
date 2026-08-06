# OS-200 · Física da bola: do playback pré-assado à balística real

## O diagnóstico

O motor tinha um integrador de verdade em `_ballTravel` (`40-match-engine-and-manager-ai.js`,
bloco "Física contínua da bola"): gravidade, restituição 0,4, atrito. **Ele nunca rodava.**

Desde a camada `cds-physics-timeline-581`, todo chute, passe e desvio grava
`ball._physicsPlan`, e o `_ballTravel` daquela camada troca a integração por
reprodução de uma curva pré-assada:

```js
z = lerp(z0, targetZ, p) + 4 * arc * p * (1 - p)
```

Isso é uma parábola no **progresso**, não no tempo. Consequências, medidas na
bateria de 48 partidas do R19.08 e num harness isolado de trajetória:

| Medida | R19.08 | Esperado |
|---|---|---|
| Aceleração vertical implícita | −4,84 m/s² (e não constante) | −9,81 |
| Voo de 40 m, bola alta (ápice 2,35 m) | 1,818 s | ~2,8 s |
| Voo de 40 m, bola rasteira (ápice 0,13 m) | 1,818 s | ~1,8 s |
| Diferença de tempo entre as duas | **0,0000 s** | ~+1 s |
| Quiques em 48 partidas | **2** | muitos |
| Chutes por cima do travessão | **0** | ~5–10% |
| z máximo ao cruzar a linha | 1,794 m | trave a 2,44 m |

O "arrasto" também era ilusório em duas frentes: a camada R13 multiplicava
`ball.vx/vy` por um fator de drag que o playback sobrescrevia no quadro
seguinte, e o `eased()` da R18.3 redistribuía o percurso **dentro da mesma
duração** — desacelerava visualmente e chegava na mesma hora.

### Por que a OS-104 não conseguiu consertar

O teto de altura era duplo: `_physicalTargetZ` travava qualquer alvo em 2,35 m
e um chute sem `z` explícito em 1,74 m, contra um travessão de 2,44 m. A OS-104
já tinha medido e documentado isso ("o motor era fisicamente incapaz de mandar
por cima do gol"), mas deixou a correção **desligada** (`ALTO_ON = false`)
porque ligá-la derrubava a média de gols para 1,4583, abaixo do piso de 1,8.

A causa dessa queda é o problema raiz: **o desfecho era sorteado antes da bola
sair do pé.**

```js
if (chance(pGoal)) _startTravel(..., () => this._goal(o))
```

A trajetória era fabricada para chegar num resultado já escolhido. Trajetória e
desfecho eram o mesmo objeto, então qualquer mexida na física mexia no placar.
Por isso balística e inversão de causalidade tiveram de entrar juntas: tirar o
teto sem inverter produziria o absurdo oposto — chutes marcados como GOL
passando por cima do travessão.

## A mudança

### 1. Balística real (`src/scripts/layers/88-os200-balistica-real.js`)

`_planPhysicalSegment` e `_trajectoryPoint` foram **reescritos**, não
encadeados. A trajetória passa a sair de integração numérica com passo fixo:

- gravidade 9,81 m/s²;
- arrasto quadrático com `k = ½ρC_dA/m ≈ 0,0135 1/m` (bola oficial, regime turbulento);
- quique com restituição 0,55, e atrito horizontal **proporcional à violência do
  impacto** — perda fixa por toque matava a bola em metros, porque um passe
  rasteiro roça o gramado dezenas de vezes;
- rolagem com resistência própria somada ao arrasto.

Três regimes, porque um solucionador só não serve para os três:

| Regime | Usado por | Incógnita |
|---|---|---|
| Rasteira | passe curto, enfiada | a **força** (sai rente e rola até o destino) |
| Alta | lançamento, cruzamento, lateral | a **força**, com ângulo fixo por tipo |
| Tensa | chute | o **ângulo** (a força é do jogador e não se negocia) |

Duas armadilhas que o teste pegou e que valem registro:

- Tratar passe rasteiro como projétil que *pousa* no alvo obriga um lob: para
  cair a 40 m com 22 m/s a física exige 27° de saída. Passe rasteiro é bola
  **rolada**, e a incógnita certa é a força.
- Resolver o ramo alto na velocidade pedida produzia bola de lua (ápice 13,7 m,
  voo 5,7 s para 40 m). Lançamento de verdade sai perto de 33° e a **força** é
  que se ajusta.

O contrato do segmento (amostras uniformes no tempo, `duration`, `origin`,
`target`, `speed`) foi preservado na forma, então todo consumidor a jusante —
playback, timeline visual, replays, solucionadores de interceptação — continua
funcionando. **Atenção a um contrato não óbvio:** `segmentPoint` indexa as
amostras por `t/duration × (n−1)`, ou seja assume espaçamento uniforme no tempo;
o integrador reamostra por causa disso.

### 2. Geometria da meta decide o desfecho

`_os200Desfecho` lê onde a trajetória cruza o plano do gol e classifica:
`dentro` / `trave` / `travessao` / `fora` / `curto`. A faixa de trave tem a
espessura real do poste (6 cm), então "na trave" deixa de ser sorteio e passa a
ser o que é: uma bola que passou a 6 cm de entrar.

**O rebote também deixou de ser sorteado.** O ramo antigo decidia com
`chance(postCorner)` se a bola saía, e mandava o rebote para um ponto aleatório
num raio de 3 a 9 m. Agora o poste é um cilindro: procuramos na trajetória a
amostra mais próxima do eixo, tiramos a normal dali — o que dá à normal a
componente `x` de volta para o campo, já que a bola toca a face dianteira — e
refletimos a velocidade incidente com restituição 0,68. O destino sai de
integrar esse rebote; sair ou seguir em jogo passa a depender de para onde a
bola foi.

Uma armadilha que o teste pegou: o contato acontece **em cima da linha de
fundo**, então testar a saída desde o primeiro passo da integração declarava
"saiu" antes de a bola se mexer — 4 de 5 traves saíam. A saída só passa a valer
depois que a bola volta ao campo de verdade. Medido depois da correção: 6 saem,
5 seguem vivas.

### 3. Inversão da causalidade no chute

`pGoal` continua sendo calculado como antes — é um bom modelo de xG. O que muda
é o papel: ele deixa de sortear o placar e passa a calibrar a **pontaria**. O
jogador mira em 3D, a bola voa, e gol/trave/fora/defesa saem da geometria.

O gancho no core é mínimo e reversível: se a camada de física não estiver
carregada, o ramo antigo continua ali e o motor se comporta como antes.

### 4. Dois defeitos do goleiro que a inversão expôs

Enquanto a defesa era pré-sorteada, a posição do goleiro não decidia nada e
podia derivar à vontade. Com a geometria decidindo, ela decide tudo — e estava
errada:

- **Ele saía 9,9 m da própria linha** no momento do chute (medido). `narrow`
  cresce conforme o atacante se aproxima, então um chute de 16 m o punha a 6 m
  do batedor e a bola passava por ele antes do tempo de reação acabar. Agora o
  avanço tem teto fora do mano a mano: `1,6 + distância × 0,15`.
- **`breakaway` era `cover > 6`**, sem exigir proximidade do gol — um chute de
  25 m sem marcador por perto era classificado como mano a mano e o goleiro
  ignorava o teto. Passou a exigir também `danger < 18`.

O modelo de defesa também mudou de forma: em vez de medir a distância do
goleiro até o ponto onde a bola cruza a linha, ele procura o **primeiro instante
do voo** em que o goleiro alcança a bola. Um goleiro adiantado intercepta onde
ele está, bem antes da meta; a versão anterior o castigava por isso.

### 5. Altura na tela

Os 22 px/m do renderizador foram calibrados quando a bola não passava de
2,35 m. Com balística real um lançamento chega a 6–10 m e batia no teto
`G.topY + 8`, ficando **grudado na arquibancada**. A altura passou a usar
mapeamento compressivo: **1:1 até 2,6 m** — para que uma bola por cima do
travessão *pareça* por cima do travessão — saturando suavemente acima disso.

## Resultado medido

Bateria de **120 partidas** por lado, semente base 4200000, compatível com a
bateria histórica R18.40 (mesma população, mesmo incremento, mesmo `dt`). Os
dois builds foram medidos na mesma amostra — comparação pareada. A coluna
`Δ/EP` é a diferença em erros-padrão: abaixo de ~2 não dá para distinguir de
ruído amostral.

| Métrica | R19.08 | OS-200 | Δ/EP |
|---|---|---|---|
| Gols por partida | 1,88 | 1,75 | −0,7 |
| xG por partida | 1,85 | 1,93 | +0,7 |
| Finalizações por partida | 14,72 | 12,82 | −2,9 |
| No alvo por partida | 5,42 | 4,92 | −1,5 |
| Passes por partida | 426,9 | 329,6 | −18,4 |
| Escanteios por partida | 3,59 | 4,82 | +4,1 |
| Faltas por partida | 10,82 | 9,38 | −3,1 |

**Gols ficaram estatisticamente iguais** (Δ = −0,7 erro-padrão). A taxa de
finalização no alvo subiu de 36,8% para 38,4%, e gols/xG ficou em 0,90 contra
1,01 do R19.08.

O que de fato mudou é a física:

| Métrica de física | R19.08 | OS-200 |
|---|---|---|
| Aceleração vertical | −4,84 m/s² | **−9,90 m/s²** |
| Tempo médio de voo | 1,000 s | **1,429 s** |
| Ápice médio de voo | 0,42 m | **0,75 m** |
| Ápice máximo observado | 3,00 m | **11,03 m** |
| Quiques por partida | 0,033 | **5,16** |
| Chutes por cima do travessão | **0** | **11,5% dos chutes** |

Distribuição dos desfechos de chute: 16,4% gol, 22,1% defesa, 2,9%
trave/travessão, 39,5% fora, 19,1% bloqueio. Das 25 bolas na trave, 8 saíram e
17 seguiram vivas — decidido pela reflexão, não por sorteio.

### Um efeito colateral que precisou de conserto

Com `pGoal` virando entrada de pontaria, ele deixou de ser a probabilidade de
gol — e a coluna de xG passou a superestimar de forma sistemática (2,41 de xG
para 1,68 gol numa medição de 60 partidas). Na tela isso leria "azarado" toda
partida. O xG **registrado** passou a levar uma escala medida (0,70), que mora
junto da calibração da física e precisa ser refeita se `ERRO_BASE`,
`DEFESA_BASE` ou `FORCA_ESCALA` mudarem.

## Quem manda na bola hoje (e por que não achatei mais que isto)

O plano previa achatar a cadeia da bola num módulo só. A **física** foi
achatada: geração de trajetória, colisão e desfecho vivem em
`88-os200-balistica-real.js`, e `_planPhysicalSegment` / `_trajectoryPoint`
são substituídos, não encadeados. O resto da cadeia **não** foi, e a razão está
medida.

Mapa real, na ordem em que roda:

| Camada | O que decide |
|---|---|
| `_startTravel` do core | alvo e callback do lance |
| `07-physics-timeline-581` | grava o plano, reproduz o voo quadro a quadro, captura timeline e replays |
| `17-r13-...` (`_startTravel`) | **velocidade inicial, altura de saída e `ball.speed`** por tipo de bola |
| `17-r13-...` (`_ballTravel`) | multiplica `ball.vx/vy` por um fator de arrasto após o voo do quadro |
| `88-os200-balistica-real` | a física: trajetória, colisão, desfecho |

Tentei remover o arrasto da R13 tratando-o como código morto. **Ele não é.**
A prova de que não influencia a trajetória continua válida — medido em 8
partidas, `_ballTravel` rodou 127.980 vezes sempre com plano de física (o ramo
legado do integrador do core: **zero execuções**), e o `vx` escrito ali
sobrevive ao quadro seguinte em 0,2% das amostras, porque o playback reescreve
`vx/vy/vz` a partir do segmento.

Mas remover mudou **todas** as métricas da bateria (gols 1,917 → 1,667 nas
mesmas 24 partidas e sementes). O valor não chega à trajetória, e ainda assim é
**lido** por consumidores dentro do mesmo quadro. Reverti, e os números voltaram
idênticos à referência.

Fica o registro: nesta base, "código comprovadamente sem efeito na trajetória"
**não** é sinônimo de "código sem efeito". O critério de aceitação que pegou
isso — rodar a bateria com as mesmas sementes e exigir agregados idênticos — é
o que qualquer limpeza futura nessas camadas precisa passar antes de ser
promovida.

Consequência prática que vale saber: a velocidade que o planejador balístico
recebe para passes vem dos clamps da R13 (passe curto 14,1–17,5 m/s, lançamento
20–23,4 m/s), não do core.

## Ainda aberto

- **Densidade de ações** (acima): decidir se `clockRate` deve ser recalibrado
  agora que o voo tem duração física.
- **Posicionamento do goleiro** foi corrigido com dois tetos pontuais, não
  reescrito. Ele ainda fica a ~6 m da linha em média no momento do chute.
- **Achatar o resto da cadeia da bola** (velocidade inicial da R13, playback da
  camada 581) exige re-hospedar bookkeeping de timeline e replays que hoje é
  privado ao IIFE da 581. É trabalho próprio, com o critério de aceitação acima.
- **76 camadas empilhadas**: `P.step` tem ~20 wrappers, `_startTravel` 13. Esta
  mudança substituiu a geração de trajetória, mas o resto continua em pilha.
