# D35 · A marca de arrancada que nunca sai

**Data:** 2026-08-13 · **Sondas:** `tools/fisica/ramo-d08.js`, `ramo-d08b.js` ·
**Achado durante a recontagem obrigatória do D08.**

---

## Como apareceu

A ficha do D08 manda recontar antes de atacar. A recontagem instrumentou o topo
da pilha e atribuiu cada chamada de `_deflectTo`/`_looseBall` ao seu ponto de
chamada real. Ao medir também o alvo lateral pedido pelo `_attackTarget`, 34%
das chamadas para papéis de flanco voltaram sem `y` legível.

`JSON.stringify` imprimiu `[19.94, null]` e o `null` custou dez minutos: não era
`null`, era **NaN** — `JSON.stringify(NaN)` produz `null`. Vale como armadilha
por si só (**C5**).

---

## O defeito

`src/scripts/layers/17-cds-r13-football-observer-cadence.js`, ao armar o
cobrador do lateral:

```js
taker._breaking = taker._breaking || { throwInDuty: true };
```

`p._breaking` tem um contrato de duas chaves — `{t, dir}` — criado assim pelo
motor:

```js
p._breaking = { t: 1.4, dir: chance(0.5) ? 1 : -1 };
```

e apagado assim:

```js
if (p._breaking) { p._breaking.t -= dt; if (p._breaking.t <= 0) p._breaking = null; }
```

O objeto da camada 17 não tem `t`. `undefined - dt` é **NaN**, e **`NaN <= 0` é
falso** — então a marca nunca é apagada. **Quem cobrar um lateral fica marcado
como se estivesse em arrancada até o apito final.**

---

## O tamanho do estrago (16 partidas)

| | |
|---|---|
| quadros de jogador com marca **válida** (arrancada de verdade) | 3.402 |
| quadros de jogador com marca **envenenada** | **174.719** |
| percentual do tempo de jogo envenenado | **20,4%** |
| jogadores de linha envenenados no apito final | **6,19 de 20** |
| minuto médio do contágio | 36,6 |
| chamadas de `_attackTarget` com `ty` NaN | **18,6%** |
| chamadas de `_integrate` recebendo `ty` NaN | **902.014** (6,4%) |

A marca legítima é **51× mais rara** que a envenenada. Na prática, neste jogo
`p._breaking` significava "já cobrou um lateral".

O cobrador é escolhido entre `['LB','RB','LWB','RWB','LM','RM']` com bônus de
−2 na ordenação — ou seja, **exatamente os papéis de flanco**, que são os que o
D08 precisa ver perto da linha.

---

## Oito consequências, todas permanentes

`p._breaking` é lido em oito lugares. Para o jogador envenenado, todos passam a
valer para sempre:

| onde | o que passa a valer |
|---|---|
| `_attackTarget:3340` | `ty = clamp(ty + undefined*9, …)` → **alvo lateral NaN** |
| `_attackTarget:3339` | fica sempre **16 m à frente da bola** |
| `_attackTarget:3345` | **isento do teto de impedimento**, para sempre |
| `_movePlayers:3015` | pula a **suavização de reação** (`ballDutyEarly`) |
| `_bestPass:1377` | **+2,4** no escore — vira alvo preferencial de passe |
| `_bestPass:1434` | +0,25 na ameaça de bola em profundidade |
| `_attackTarget:3191` | `!p._breaking` → **nunca mais inicia uma arrancada real** |
| `_attackTarget:3288` | excluído do papel de `_thirdMan` |
| `_defendTarget:3471` | a defesa o trata como **perigoso** permanentemente |

O NaN é o mais visível, mas não é o pior. O pior é a isenção de impedimento
somada ao empurrão de 16 m: um terço do time de linha joga o segundo tempo
adiantado e imune ao juiz.

---

---

## ⛔ O CONSERTO FOI MEDIDO E REPROVOU — leia antes de tentar de novo

O conserto abaixo está **correto** e **não entrou**. Ele foi revertido em
2026-08-13, depois de 300 partidas pareadas.

As invariantes passaram, sem margem para dúvida:

| | antes | depois |
|---|---|---|
| `_integrate` recebendo alvo NaN | 220.103 | **0** |
| marcas `_breaking` malformadas | 21.464 | **0** |

E o jogo caiu:

| métrica | antes | depois | 2 SE | |
|---|---|---|---|---|
| **offsides** | 5,167 | **1,043** | 0,486 | ⬇⬇ 8,5 SE |
| shots | 23,710 | 19,990 | 1,220 | ⬇ saiu da faixa 20–30 |
| goals | 2,877 | 2,380 | 0,296 | ⬇ saiu da faixa 2,4–3,2 |
| xg | 3,013 | 2,483 | 0,189 | ⬇ |
| corners | 11,337 | 9,287 | 0,708 | ⬇ |
| goalKicks | 12,947 | 10,877 | 0,758 | ⬇ |
| **zeroZeroRate** | 0,080 | **0,167** | — | 4,03 SE, faixa 0,045–0,12 |
| throwIns | 15,787 | 17,570 | 1,077 | ⬆ (+1,78 — e insuficiente) |

**Placar de design 12/13 → 9/13.** Dez das catorze métricas agregadas se
moveram 2 SE, e nenhuma delas era objetivo declarado.

### Por que — e é a parte que vale

**O volume do jogo está apoiado no defeito.** Dos oito efeitos permanentes, o
que sustentava o placar era a **isenção do teto de impedimento**: cerca de seis
jogadores por partida atacavam as costas da linha sem nenhum freio, ficavam 16 m
à frente da bola e eram premiados com +2,4 no `_bestPass`. Isso produzia
impedimentos, chutes, escanteios e gols.

Consertado o bug, os seis voltam para trás da linha — e **nada** os manda para
frente de novo. Os impedimentos desabam de 5,17 para **1,04 por partida**: o
futebol de elite tem 4–8, então o jogo passa de "certo por acidente" para
"errado com o código limpo".

> **A armadilha A5 em escala grande.** *"Ao limpar um efeito colateral, pergunte
> primeiro quem está de pé em cima dele."* No D11 era um veto de 1,15 s. Aqui é
> o volume ofensivo inteiro.
>
> E é a **A2 do goleiro** de novo, invertida: lá, aumentar um recurso piorou o
> jogo; aqui, **remover um defeito** piorou. As duas dizem a mesma coisa — o
> modelo está usando o recurso pelo motivo errado.

---

## ⛔ O PAR TAMBÉM FOI TENTADO, MEDIDO E REVERTIDO (2026-08-13)

A recomendação abaixo — *"consertar a marca **e** dar um motivo legítimo de
atacar as costas da linha"* — foi executada. A metade legítima virou a camada
**91 · o ombro do último defensor**: com posse no campo de ataque, o homem de
referência posiciona-se no ombro do penúltimo defensor em vez de 12,7 m atrás.

**Ela recuperou dois terços do estrago e não fechou.**

| | base (com o bug) | só o conserto | **conserto + ombro** |
|---|---|---|---|
| shots | 23,710 | 19,990 | **20,957** |
| goals | 2,877 | 2,380 | **2,407** |
| xg | 3,013 | 2,483 | **2,656** |
| corners | 11,337 | 9,287 | **9,660** |
| zeroZeroRate | 0,080 | 0,167 | **0,123** (faixa ≤0,12) |
| **placar de design** | 12/13 | 9/13 | **11/13** |
| offsides | 5,167 | 1,043 | **0,910** |

Faltaram **0,003** no `zeroZeroRate` e o impedimento ficou em 0,91 contra a
faixa 2,5–6,0 do futebol real.

### Três alavancas varridas, três becos sem saída

Cada linha é uma varredura de 48 partidas **pareadas** contra a mesma população.

**1 · margem do ombro** — cinco configurações, impedimento entre **0,88 e 1,06**.
Encerra a hipótese de calibração: **quem está no ombro está onside por
construção**, e mexer em quanto ele cola na linha não muda isso.

**2 · duração da arrancada** — sobe monotônico e não chega:

| `tArrancada` | gols | chutes | noAlvo | **offside** |
|---|---|---|---|---|
| 1,4 (motor) | 2,604 | 21,42 | 0,339 | **0,94** |
| 2,2 | 2,063 | 21,00 | 0,313 | **1,17** |
| 3,0 | 2,542 | 19,60 | 0,321 | **1,27** |
| 3,0 + margens | 2,604 | 21,69 | 0,317 | **1,46** |
| 4,0 + margens | 2,375 | 21,62 | 0,322 | **1,71** |

Chegar a 2,5 exigiria 5–6 s. Uma "quebra explosiva" de seis segundos não é
arrancada: é o jogador **morando atrás da linha** — o próprio defeito, com outro
nome.

**3 · quais papéis jogam no ombro** — alargar **piora**:

| papéis | gols | chutes | noAlvo | offside |
|---|---|---|---|---|
| ST,CF (padrão) | **2,604** | 21,42 | **0,339** | 0,94 |
| +LW,RW | 2,542 | 21,10 | 0,340 | 0,94 |
| +CAM | 2,313 | 20,62 | 0,317 | 0,75 |

**4 · o custo do impedimento no `_bestPass` (A1)** — e aqui eu estava errado.

| | gols | chutes | noAlvo | offside |
|---|---|---|---|---|
| padrão | **2,604** | **21,42** | **0,339** | 0,94 |
| escala 0,45 + teto 1,6 | 2,417 | 20,46 | 0,328 | 1,40 |
| + arrancada 2,6 | 2,167 | **19,62** | 0,320 | **2,21** |

Eu previ que o termo estivesse taxando demais o passe em profundidade, por ter
sido ajustado contra um jogo com seis impedidos permanentes. **Soltá-lo não
recupera gol — perde gol**, e troca gol por impedimento até furar o piso de
chutes. A A1 faz o que deve.

> E antes disso eu tinha previsto que a A1 sufocava o centroavante no ombro.
> Também errado, por outro motivo: `penaImped` só existe acima de
> `margem > -1,2`, e a camada 91 estaciona o atacante **abaixo** do limiar.

### O que isto estabeleceu — e vale mais que o par

**O jogo não tem corrida cronometrada contra a linha.** `p._breaking` é um
temporizador de 1,4 s que não consulta onde a defesa está nem quando o passe vai
sair. Impedimento é erro de sincronia, e não há sincronia para errar. Foi por
isso que a isenção permanente do defeito era a **única** coisa capaz de produzir
impedimento na taxa do futebol de elite.

Isso virou o **D36**, e ele é **pré-requisito do D35**: sem ele, remover o
defeito derruba o impedimento para ~0,9 faça o que fizer. E é **feature, não
conserto**.

### Por que reverti em vez de entregar 11/13

O par melhora sobre o conserto sozinho, mas fica abaixo do estado aceito. O
código fica mais limpo e o jogo fica **pior no campo**: 0,91 impedimento por
partida é menos futebol do que 5,17, ainda que os 5,17 saiam de um bug. Essa
troca é decisão de produto, não minha — e o portão do projeto diz não.

Fica tudo reconstruível: o desenho da camada 91 está neste laudo, os knobs
`CDS_D35_TUNE` (`suave`, `margemBoa`, `margemRuim`, `progMin`, `tArrancada`,
`papeis`, `penaEscala`, `penaTeto`) continuam documentados, e
`tools/fisica/bateria.js --tuneD35` continua no lugar para quem retomar.

---

### O que fazer, quando alguém voltar a isto

Este é o **par** que o defeito exige, e é a única exceção conhecida à armadilha
B5 (*não meça duas coisas que se tocam na mesma rodada*): as duas **têm** de
entrar juntas, porque uma sozinha reprova por construção.

1. consertar a marca (o código abaixo, que já está escrito e medido);
2. dar ao atacante um motivo **legítimo** de atacar as costas da linha — hoje o
   `onsideCap` em `_attackTarget:3347` prende todo mundo e a única forma de
   escapar dele era estar envenenado.

Alvo de aceite: `offsides` entre 4 e 8, `shots >= 20`, `goals` 2,4–3,2,
`zeroZeroRate <= 0,12`. Medição da tentativa reprovada guardada em
`reports/d35-tentativa-reprovada.json`; a sonda de invariantes é
`tools/fisica/ramo-d35.js` (fora da suíte porque hoje ela **reprova de
propósito**, documentando o defeito).

---

## O conserto que foi revertido

Duas linhas, na mesma camada que criou o problema.

**1 · o objeto passa a cumprir o contrato.** `dir: 0` porque a intenção da
camada é fazer o cobrador correr até a bola, não empurrá-lo de lado — e porque
`chance()` consumiria RNG e faria toda semente divergir por outro motivo.

```js
taker._breaking = taker._breaking ||
  { t: 1.4, dir: 0, throwInDuty: true, until: finite13(this.t) + 1.4 };
```

**2 · uma varredura por quadro** remove qualquer marca malformada ou vencida,
venha de onde vier. O decaimento do motor mora dentro de `_attackTarget`, que
não roda quando o time está defendendo — sem a varredura, a marca de um zagueiro
que cobrou o lateral sobreviveria mesmo com `t` válido.

```js
function varreArrancadaInvalida13(sim){
  const agora=finite13(sim.t);
  for(const tm of sim.teams||[]) for(const p of (tm&&tm.players)||[]){
    const br=p&&p._breaking; if(!br) continue;
    if(!Number.isFinite(+br.t)||!Number.isFinite(+br.dir)||
       (Number.isFinite(+br.until)&&agora>+br.until)) p._breaking=null;
  }
}
```

---

## O que isto NÃO é

**Não é o D08.** O D08 pergunta por que há 15,9 laterais contra 33–48 do futebol
real. O conserto levou `throwIns` de 15,79 para **17,57** — mexeu, na direção
certa, e ficou a 15 laterais do alvo. Confirma o que o laudo do D08 já dizia:
o gargalo é ocupação da linha, não um ramo torto.

**E o D08 agora depende do D35.** A parcela 3 do D08 — *"o jogador nunca chega
ao alvo que ele mesmo pediu, 4,11 m de erro médio"* — é em boa parte este NaN.
Enquanto o D35 não for consertado **com o par**, medir o D08 é medir em cima de
um integrador que recebe alvo inválido 6,4% das vezes.

O que a recontagem do D08 já estabeleceu, e que independe deste defeito, está em
`reports/D08-a-bola-nao-vai-na-linha.md`.
