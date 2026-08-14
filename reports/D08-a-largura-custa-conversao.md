# D08 · A largura funciona, move pouco, e paga o pedágio da conversão

**Data:** 2026-08-13 · **Camada 92, construída, medida e REVERTIDA** ·
**Varredura:** 5 configurações × 48 partidas pareadas, com controle.

---

## O que foi testado — pela primeira vez

As duas tentativas anteriores do D08 (A3, o arremesso; A4, o resgate de bola
fora) morreram, e a terceira premissa — *a direção do desvio* — foi refutada em
`reports/D08-a-bola-nao-vai-na-linha.md`. O que sobrou foi **ocupação da
lateral**, e ela nunca tinha sido testada.

> Correção de uma confusão minha: a camada 91 do par do D35 (o "ombro") valia só
> para ST/CF e mexia em **x**. Os oito papéis de flanco nunca foram tocados por
> ela. Eu tinha contabilizado aquele fracasso como se fosse do D08, e não era.

A camada 92 puxa o alvo **lateral** dos papéis de flanco em direção à própria
linha, com posse no campo de ataque. Aditiva e unidirecional: só abre.

O desenho veio da decomposição em `ramo-d08c.js` (668.493 amostras):

| | dist. até a lateral |
|---|---|
| alvo do `_attackTarget` | 10,43 m |
| alvo no `_integrate` | 10,53 m |
| corpo depois do quadro | 13,02 m |

A cadeia é **transparente** (0,39 m de perda): o teto é o alvo, e é nele que a
camada mexe.

---

## A medição, com controle na mesma população

`margem: 99` desliga a camada de fato — é o controle pareado.

| config | LAT | ΔLAT | gols | Δgols | chutes | gol/alvo | Δ |
|---|---|---|---|---|---|---|---|
| **controle (OFF)** | 15,81 | — | 2,729 | — | 23,08 | 0,386 | — |
| padrão (m5, prog .45) | 16,85 | +1,04 | 2,625 | −0,104 | 22,96 | 0,356 | −0,030 |
| m3,5 | 16,94 | +1,13 | 3,188 | +0,459 | 24,15 | 0,406 | +0,020 |
| **m5, prog .25** | **18,73** | **+2,92** | **3,313** | **+0,584** | 24,54 | **0,419** | **+0,033** |
| m3,5, prog .25, suave .85 | 18,08 | +2,27 | 3,188 | +0,459 | 23,62 | 0,399 | +0,013 |

Faixas do futebol real: gols **2,5–3,0** · golPorChuteNoAlvo **0,27–0,38** ·
laterais **33–48**. SE em n=48: gols ≈ 0,25, laterais ≈ 0,55.

---

## O veredito, e a minha previsão que caiu

**A alavanca existe e responde.** +2,92 laterais é ~5 SE — sinal sólido, não
ruído. A camada faz o que promete.

**E move pouco.** 15,81 → 18,73 é 3 dos ~18 laterais que faltam para a faixa.

**E paga o pedágio.** Eu havia escrito, ao escolher o D08:

> *"Alargar muda **onde** o jogo acontece, não quantos gols saem por chute no
> alvo. O teto de conversão que matou o D19 não se aplica."*

**Está errado.** Na configuração que mais rende laterais, `gols` vai de 2,729
para **3,313** — para fora da faixa 2,5–3,0 — e `golPorChuteNoAlvo` de 0,386
para **0,419**, contra teto de 0,38. Os chutes sobem 6% e os gols sobem 21%: a
conversão sobe junto.

O mecanismo é plausível em retrospecto — time mais aberto estica a defesa e as
chances que sobram são melhores — mas eu não previ, afirmei o contrário, e a
medição me corrigiu. **É a quinta previsão minha derrubada nesta investigação.**

A configuração branda (padrão) é o inverso: não quebra nada e também não faz
nada. +1,04 lateral numa base de 15,8, com tudo o mais dentro do ruído. Não vale
uma mudança de comportamento permanente.

---

## O que isto fecha

**O D08 não tem conserto por largura dentro do orçamento de conversão atual.**
Entre "move 3 laterais e quebra os gols" e "move 1 lateral e não muda nada", não
há configuração que entregue os 18 laterais que faltam sem estourar o teto.

E isso confirma a **B14** num terreno onde eu apostei que ela não valeria: a
conversão em 0,379 contra teto de 0,38 restringe **qualquer** mudança que
aumente o volume ofensivo, inclusive as que só mexem em espaçamento.

Junto com D19, D35 e D36, são **quatro famílias de mudança** barradas pelo mesmo
número.

## O que fica reconstruível

- a camada 92 inteira está descrita aqui e no commit `1fb1ec8`
- `tools/fisica/ramo-d08c.js` — a decomposição da cadeia do y
- `bateria.js --tuneD08` — o knob, com o controle `margem: 99`
- `reports/D08-a-bola-nao-vai-na-linha.md` — a recontagem que refutou a direção

**Ordem para quem retomar:** recalibrar a conversão primeiro. Enquanto
`golPorChuteNoAlvo` estiver colado no teto, todo ganho de volume vira ganho de
gol e reprova.
