# CHANGELOG — R14.4 → R15.0

Baseline preservada: `dist/COPA DOS SONHOS - R14.4.html`
`7fdf183581162115344e320d5bfbada3f02f6a47e30a01948f08eba816c8b071`

Candidata: `dist/COPA DOS SONHOS - R15.0.html`
`54a8160c7d374fed1b73def9695de3fc64629fc0fe6b31812ec1e3ebeb0c5db4`
1 747 807 bytes · 2026-07-23

A base R13.0 (`363d9a91…9818a8`) permanece congelada e byte-verificável.
Toda divergência é declarada em `src/r14/patches-engine.json`.

---

## Ferramentas (não alteram o motor)

### `tools/build_ux.py` — contrato de experimento
`enabled: false` passa a ser respeitado; `--with <id>` / `--without <id>`
permitem ligar e desligar patches individualmente.

**Motivo:** o build aplicava `_exp-clock` — marcado como EXPERIMENTO e descrito
no handoff como "não embarcar" — incondicionalmente. A fonte versionada produzia
`9bc436a1…`, não a R14.4 declarada. Nenhuma medição feita a partir desse ponto
seria atribuível à build certificada.

**Verificação:** rebuild reproduz `7fdf1835…c8b071` byte a byte.

### `tools/r15/aggregate_release.py` + `manifests/r15-release-gates.json`
Agregador único de certificação (§26). 48 gates sobre os 23 domínios exigidos,
seis estados reais, `min_samples` por gate, exclusão de amostras vazias,
nenhum status herdado.

### `tools/r15/scan_hidden_modifiers.py`
Varredura estática de modificadores ocultos (§41) com registro de veredito por
sítio. Trecho novo sem veredito reprova o gate.

### `tools/r15/mutation_test.py`
Seis defeitos deliberados (§7) para provar que o agregador reprova.

### `tools/r15/patch_effect.py`
A/B pareado por patch de motor (§45). Detecta patch ancorado em código morto.

### `tools/r15/skill_tiers.js`
Diferenciação individual 97/90/80/70 (§24/§25) — métrica que não existia.

### `tools/r15/run_integrity.py`
Artefato de integridade consumido pelo agregador.

---

## Motor — remoções (§41/§42/§56)

Sete patches, todos P0, todos removendo capacidade concedida por gatilho de
roteiro. Nenhum adiciona comportamento novo: esta entrega **tira**, não põe.

| id | o que remove | proibição |
|---|---|---|
| `r15-drop-legend-speed-buff` | `hero.maxSpd *= 1.05` + `_onFire` + narração de lenda | §42 velocidade por lenda/placar/minuto |
| `r15-drop-onfire-dribble-bonus` | `+5` na força de drible por `_onFire` | §42 vantagem técnica por roteiro |
| `r15-drop-onfire-xg-bonus` | `base *= 1.18` no xG por `_onFire` | §56 bônus direto de gol |
| `r15-drop-nationality-chemistry` | `fx.ritmo *= 1.08` por nº de compatriotas | §19 química global · §41 nacionalidade · §56 bônus por nacionalidade |
| `r15-drop-legend-pass-pull` | `legendPull = 0.38` na pontuação do passe | §40 exceção por nome/rótulo |
| `r15-drop-clutch-xg-bonus` | `pGoal *= 1.15` para trait CLUTCH após 80' | §42 trait criando precisão · §56 scripting de fim de jogo |
| `r15-drop-clutch-execution-bonus` | `execution += .055` para trait CLUTCH após 75' | §42, na camada de contexto compartilhada |

Os dois últimos **não constavam de nenhum relatório anterior**. Foram
encontrados pela varredura automática, não por leitura dirigida.

### Sítios examinados e MANTIDOS, com justificativa

| sítio | veredito | razão |
|---|---|---|
| `urgency` / `restraint` na decisão de chutar | PREFERENCE_OK | muda a frequência de tentativa, não a precisão (§37) |
| `_losingLate` na postura coletiva | PREFERENCE_OK | decisão tática observável e punível no contra-ataque |
| `importance` em `_actionContext` | PREFERENCE_OK | **reduz** execução sob pressão, mediado por compostura — nervosismo, não buff |
| `(o._onFire ? 7 : 0) + legendEdge` no `_dribble` do bundle base | CÓDIGO MORTO | substituído por `P._dribble` da camada R12; registrado para não ser redescoberto |

---

## Consequência conhecida e não resolvida

`r15-drop-legend-pass-pull` removeu o **único** termo em que a qualidade do
RECEPTOR pesava na escolha do passe. O §54 exige que o jogador de elite
influencie o coletivo. Essa influência precisa voltar derivada de atributo
percebido — não de rótulo de fama — e ser validada pelos testes do §24/§25.
Está registrado como pendência, não como resolvido.

---

## R15.4 — bola parada sem teleporte

`src/r14/20-setpiece-walk.js` · build `ec024153fca9d09ed66fe4ded6a32ce3fdaef0d0930db12553cca69e49ff1b26`

`_setCorner` calcula os postos de 12 jogadores e escreve `p.x/p.y` direto,
depois dá `dead = .6` — a 6,5 m/s isso cobre 3,9 m, enquanto a rotina realoca
gente pelo terço ofensivo inteiro. §17: a forma deve surgir da movimentação
física, nunca de teletransporte.

A camada intercepta sem tocar no corpo da função: fotografa as posições, deixa
o original calcular os destinos, devolve cada jogador para onde estava, guarda
o destino como alvo, alonga `dead` na medida de quem está mais longe (teto 6 s)
e caminha cada um até o posto respeitando `maxSpd`. A bola fica na bandeirinha
— quem anda até ela é o cobrador. Mesmo desenho de `r14-throwin-walk`.

`dead` não consome minuto de jogo (10-base-bundle.js:2662), então o custo é
tempo de física.

**Medição** (`tools/r15/teleport_profiler.js`, 6 partidas, saltos > 1,5 m):

| método | antes | depois |
|---|---:|---:|
| `_setCorner` | 170 | **0** |
| `_goalKickOrRestart` | 268 | **0** |
| `_resetPositions` | 637 | 573 (máx 87,9 → 53,4 m) |
| `_switchSides` (legítimo) | 132 | 132 |
| `_emit` | 88 | 122 |
| **total** | **1.296** | **837** (−35,4%) |

### O que só apareceu medindo

A primeira versão envolveu apenas `_setCorner`, e `_goalKickOrRestart` continuou
com 25% dos saltos. Causa: a camada R12 (`29-…:138`) capturou `oldSetCorner` no
carregamento, antes deste wrapper, e chama a referência original direto na
rotina de escanteio vindo de cruzamento. Envolver a função externa inteira
resolveu.

É a mesma armadilha que tornou `r14-shadow-lane` inerte: neste motor não se sabe
o que executa sem verificar qual camada guardou qual referência.

### O que NÃO foi corrigido

`_resetPositions` continua respondendo por 68,5% dos saltos restantes — kickoff,
intervalo e reinício após gol. `_emit` aparece movendo jogadores 42,9 m em média
e não deveria mover nenhum: ponta solta não investigada.

### R15.5 — calibração do teto de `dead`: EMBARCAR

`dist/COPA DOS SONHOS - R15.5.html` · `1794333d218faa27e0d18c23423b502f685ea59998dc578b3d6419f2d9fa5ac8`

A regressão de gols da R15.4 (abaixo) tinha uma hipótese: o teto de 6 s em
`dead` injetava tempo de física demais com o jogo parado, deslocando a razão
entre jogo corrido e bola parada. Teto reduzido para 2,2 s (~13 m a 6 m/s, a
distância típica de reposicionamento de escanteio) e `MIN_MOVE` de 0,5 para
3,0 m. A hipótese se confirmou em 294 partidas com elencos reais:

| | R15.2 (antes) | R15.4 (teto 6s) | R15.5 (teto 2,2s) |
|---|---:|---:|---:|
| gols/jogo | 3,065 | 2,619 | **3,269** |
| escanteios/jogo | 8,86 | 10,35 | **9,10** |
| teleportes/partida | 204,9 | 94,8 | **111,3 (−46%)** |
| cobertura ameaça | 0,555 | 0,543 | **0,562** |
| dist. marcador | 8,47 | 8,87 | **8,34** |
| `spatialOverload` | 27/294 | 8/294 | **30/294** |

Tudo que a R15.4 havia piorado voltou ao patamar da R15.2 ou o superou —
`spatialOverload` foi de 27 para 30, cobertura e distância do marcador melhoram.
O teleporte de bola parada segue neutralizado: no perfilador, `_setCorner` e
`_goalKickOrRestart` deixam apenas 5 e 10 saltos residuais, todos abaixo de 3 m.
Consistência transacional 294/294. Integridade e varredura: limpas.

É o caso raro nesta sessão em que uma correção corta um P0 (§56, evento sem
causa física no reinício) e move os gates de futebol na direção certa ao mesmo
tempo. **Esta build substitui a R15.3 como candidata corrente.**

### VEREDITO R15.4: NÃO EMBARCAR (substituída pela R15.5)

Regressão em 294 partidas com elencos reais, R15.2 → R15.4:

| | R15.2 | R15.4 | Δ |
|---|---:|---:|---:|
| teleportes/partida | 204,9 | **94,8** | **−54%** |
| linha desconectada | 0,3993 | 0,3636 | −0,036 |
| **gols/jogo** | 3,065 | **2,619** | **−0,446 (−14,6%)** |
| chutes/jogo | 19,524 | 21,895 | +2,371 |
| escanteios/jogo | 8,861 | 10,350 | +1,490 (+17%) |
| dist. marcador | 8,471 | 8,872 | +0,40 |
| cobertura ameaça | 0,5553 | 0,5430 | −0,012 |
| gate `spatialOverload` | 27/294 | 8/294 | |

Consistência transacional permanece 294/294.

O objetivo foi cumprido — o teleporte de bola parada acabou. Mas **mais chutes e
mais escanteios produzindo menos gols** é mudança grande de comportamento cujo
mecanismo NÃO foi explicado. As hipóteses óbvias não fecham: com marcação mais
distante e cobertura menor, era de esperar mais gols, não menos.

Embarcar sem entender a causa seria aceitar um número plausível sem prova —
o erro que esta auditoria existe para impedir.

**Hipótese a testar primeiro:** o teto de `dead` em 6 s por escanteio. Como
`dead` não move o relógio da partida, uma partida de 90 minutos passou a ter
muito mais passos de física em bola morta, o que pode ter deslocado a proporção
entre jogo corrido e bola parada. Uma matriz de 15 minutos com o teto reduzido
responde.

**Candidata segura enquanto isso:** R15.3 `1ff2cbc4…` — motor certificado da
R15.2 mais o campo inteiro visível.

## Patch herdado que deve sair

`r14-shadow-lane` está ancorado no `_defendTarget` do bundle base, que a camada
R13 substitui. A/B em 49 seeds: **49/49 placares idênticos**, todas as métricas
agregadas iguais até 1e-9, cobertura de ameaça idêntica (0,62271).

O patch embarca, consta do changelog anterior como correção de comportamento
("shadow fecha a linha de passe em vez de correr na bola") e **não altera uma
única partida**. O comportamento que ele pretendia corrigir continua presente:
o shadow vivo usa `lerp13(b, a, .40)` — 60% do caminho em direção à bola.

Mantido nesta build para isolar o efeito das remoções do §41. Deve ser removido
ou reancorado no dono vivo em mudança separada e medida.
