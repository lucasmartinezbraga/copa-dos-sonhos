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

Bateria de **60 partidas**, semente base 4200000, compatível com a bateria
histórica R18.40 (mesma população, mesmo incremento, mesmo `dt`). Os dois lados
foram medidos na mesma amostra — comparação pareada.

| Métrica | R19.08 | OS-200 |
|---|---|---|
| Gols por partida | 1,77 | **2,13** |
| xG por partida | 1,98 | **2,40** |
| Finalizações no alvo | 36,5% | **42,8%** |
| Aceleração vertical | −4,84 m/s² | **−9,90 m/s²** |
| Tempo médio de voo | 1,001 s | **1,419 s** |
| Ápice médio de voo | 0,42 m | **0,74 m** |
| Ápice máximo observado | 2,93 m | **11,04 m** |
| Quiques por partida | 0,033 | **5,42** |
| Chutes por cima do travessão | **0** | **7,8% dos chutes** |

Gols seguem o xG na mesma proporção nos dois builds (0,89), o que indica que a
inversão preservou a calibração de finalização em vez de a substituir por outra.

Distribuição dos desfechos de chute (423 chutes): 20,1% gol, 22,7% defesa,
3,3% trave/travessão, 34,3% fora, 19,6% bloqueio.

## O que esta mudança custou, e que não foi escondido

O volume de ações caiu de forma **uniforme** em todos os eventos: passes 424 →
337, chutes 15,5 → 12,5, desarmes 21,9 → 18,7, faltas 11,1 → 9,1 por partida
(≈ −19% em tudo).

A causa é única e é honesta: o tempo médio de voo subiu 42% (1,001 s → 1,419 s).
O R19.08 gastava menos relógio com a bola no ar porque a duração era `d/v`,
indiferente ao arco, e nada desacelerava. Com voo real, mais do relógio da
partida é bola viajando, e sobram menos ações.

Parte disso foi recuperada exigindo que o passe rasteiro chegue com **ritmo
útil** (≥ 7,5 m/s) em vez de apenas alcançar o destino — um passe que chega
rastejando levou tempo demais e o companheiro já saiu dali.

O que sobra é custo real da física. **Não** foi compensado mexendo em
`ENGINE_CALIBRATION.timing.clockRate`: isso restauraria a contagem de eventos
escondendo a causa, e a densidade de ações do motor já estava abaixo do futebol
real antes desta mudança (424 passes por partida somando os dois times). Fica
registrado como decisão para o dono do projeto, não como algo a silenciar.

## Ferramentas novas

| Arquivo | Para quê |
|---|---|
| `tools/fisica/bateria.js` | Bateria paralela com sondas de física (ápice, altura na linha, quiques, tempo de voo, ramos de desfecho). Compatível em semente com `tools/r1840/bateria.js`. |
| `tools/fisica/calibrar.py` | Varre configurações contra a bateria e tabela o resultado, na mesma população, para comparação pareada. |
| `tests/fisica_balistica.js` | Teste de unidade da balística: gravidade, tempo de voo por altura, quique, passar por cima do travessão, uniformidade das amostras, precisão do solucionador. |
| `tests/browser_smoke.js` | Sobe o bundle em Chromium de verdade e roda uma partida. As baterias usam `vm.runInThisContext`, que **não** é como o navegador carrega. |

`CDS_OS200_TUNE` permite varrer os parâmetros sem reconstruir o bundle. Em
produção ele não existe e valem os padrões calibrados.

## Ainda aberto

- **Densidade de ações** (acima): decidir se `clockRate` deve ser recalibrado
  agora que o voo tem duração física.
- **Posicionamento do goleiro** foi corrigido com dois tetos pontuais, não
  reescrito. Ele ainda fica a ~6 m da linha em média no momento do chute.
- **76 camadas empilhadas**: `P.step` tem ~20 wrappers, `_startTravel` 13. Esta
  mudança substituiu a cadeia da bola, mas o resto continua em pilha.
