# OS-203 · A bola para de pingar

## A reclamação

> "O JOGO ESTÁ QUEBRADO, A BOLA PINGANDO FICOU HORRÍVEL. AINDA NÃO PARECE
> FUTEBOL DE VERDADE."

A primeira metade estava certa e era minha. A segunda eu fui medir, e a
resposta é diferente do que eu esperava.

## O que a tela mostrava

Sonda nova (`pinga.js`): registra a altura da bola a cada passo de simulação
numa partida de verdade no navegador, e classifica cada vez que ela deixa o
gramado. Em 3,9 minutos de jogo:

```
fracao do tempo no chao   68,9%
subidas por minuto        54,5
  ate 10 cm                94
  10 a 30 cm              100    <- 92% das subidas abaixo de 30 cm
  30 a 60 cm                1
  60 cm a 1,5 m             4
  acima de 1,5 m           12
```

E o traço bruto entregou o padrão de graça:

```
{p:0,141 d:0,217} {p:0,038 d:0,133}
{p:0,141 d:0,217} {p:0,039 d:0,133}
{p:0,138 d:0,217} {p:0,042 d:0,133}   ...
```

Um par se repetindo: 14 cm por 0,22 s, depois 4 cm por 0,13 s. A razão entre
os dois é 0,30 — que é exatamente `RESTITUICAO²` (0,55² = 0,3025). Não era
ruído: era **todo passe rasteiro quicando**, sempre igual.

## De onde vinham os 14 cm

Segunda sonda (`rasteira.js`), decompondo o ápice em `z₀ + v_z²/2g`:

```
z0=0,12  v=23,1  vz=0,69   previsto 0,144   medido 0,143
z0=0,12  v=24,7  vz=0,74   previsto 0,148   medido 0,146
z0=0     v=24,6  vz=0,74   previsto 0,028   medido 0,026
```

A previsão bate na terceira casa. São duas causas somadas, e a maior é a
primeira:

**1. A bola nascia a 12 cm do chão** (0,12 dos 0,141 m). Vem de
`40-match-engine-and-manager-ai.js`:

```js
// ARCO baixo no passe rasteiro (bola no pé, não lob)
b.z = passKind === 'launch' ? 0.3 : 0.12;
```

Esse 0,12 é da época em que `z` **só servia para desenhar**. Desde a OS-200 a
camada 88 lê esse valor como altura de saída real e integra a queda. O
comentário diz "bola no pé, não lob" — a intenção era não subir. O efeito,
depois que a física ficou real, é uma queda de 12 cm no primeiro toque.

**2. O ângulo de saída era 0,03 rad** (~1,7°), documentado como "sai rente, não
colada". Com integração real, 1,7° é um lançamento: acrescenta os 2,5 cm que
faltavam.

Esta é a terceira vez neste projeto que um número decorativo vira número
físico ao ligar o integrador — as outras duas estão registradas na OS-200 (o
arrasto da R13) e na OS-202 (o ramo morto do `presser`). O padrão já tem nome:
**código sem efeito na trajetória antiga não é código sem efeito.**

## O conserto

Zero, e não um valor pequeno. Com `theta = 0` e `z = 0` o integrador entra no
ramo de rolagem já no primeiro passo e a bola **nunca deixa o gramado**: ela
rola, perde velocidade para o arrasto e para a resistência de rolagem, e chega
viva do outro lado. Que é o que um passe rasteiro é.

O achatamento é **por regime**. Chute e bola alta continuam saindo da altura
que o motor informou — lá os 12 cm são a bola no pé, e a calibração da mira
(`ERRO_BASE`, `DEFESA_BASE`, `FORCA_ESCALA`) depende disso.

## Resultado

| | antes | depois |
|---|---|---|
| Quiques por passe rasteiro (planejado) | 2,47 | **0,00** |
| Subidas por minuto de jogo | 54,5 | **6,5** |
| Subidas abaixo de 30 cm | 194 de 211 | **6 de 25** |
| Fração do tempo no chão | 68,9% | **84,4%** |
| Pico mediano de uma subida | 0,138 m | **1,55 m** |

A última linha é a que resume: antes, a subida típica da bola era um pingo de
14 cm; agora é uma bola alta de 1,55 m. As subidas que sobraram são cruzamento,
lançamento e chute — futebol.

## O jogo não mudou, só a aparência

120 partidas, mesmas sementes, contra a referência da OS-202:

| | OS-202 | OS-203 | Δ/SE |
|---|---|---|---|
| Gols | 2,758 | 3,033 | +1,10 |
| Finalizações | 21,26 | 21,73 | +0,54 |
| Faltas | 16,09 | 15,59 | −0,75 |
| Passes certos | 491,9 | 487,3 | −0,64 |
| Amarelos | 5,17 | 4,73 | −1,43 |
| Escanteios | 10,05 | 9,64 | −0,82 |

**Nenhuma métrica se moveu 2 SE.** O que se moveu foi a física medida:
quiques por partida de 9,63 para 5,84, ápice médio de 0,744 m para 0,650 m.

No placar contra `calibration/targets.json` isso aparece como 10/13 contra
11/13 da OS-202. As duas que trocaram de lado — faltas (16,09 → 15,59, mínimo
16,0) e empates (0,258 → 0,183) — são as mesmas que a OS-202 já registrou
vivendo em cima da linha. Não recalibrei: com Δ/SE de −0,75 eu estaria
ajustando contra a amostra, que é exatamente o erro que a OS-202 documentou ter
cometido.

## "Ainda não parece futebol de verdade"

Fui medir a forma das equipes, que é o que separa futebol de 22 pontos
correndo atrás da bola. 470 amostras com bola dominada:

| métrica | medido | referência real |
|---|---|---|
| Comprimento do bloco (com bola) | 39,1 m | 30–40 m |
| Largura do bloco (com bola) | 48,5 m | 40–55 m |
| Apoio mais próximo do portador | 11,9 m | 8–15 m |
| Apoios até 20 m | 2,9 | 3–5 |
| Adversário mais próximo | 5,8 m | 2–8 m |
| Comprimento do bloco (sem bola) | 36,8 m | 25–35 m |
| Largura do bloco (sem bola) | 45,1 m | 30–45 m |

**A forma está boa.** Eu tinha olhado um quadro em que o atacante estava
sozinho com o companheiro mais próximo a 37 m e quase saí consertando isso —
era um contra-ataque, não a norma. As duas linhas fora da faixa são as de
**bloco sem bola**: a equipe que defende fica uns 5 m mais longa e mais larga
do que um bloco real, o que aparece na tela como espaço entre os setores.
É a próxima pedra, e é pequena comparada com o pingo.

## O que ficou medido e não consertado

**A tarja preta come de 19% a 43% da área reservada ao campo.** Medido em
quatro larguras:

| viewport | backing | caixa | tarja |
|---|---|---|---|
| 1920×1080 | 1434×700 | 1410×852 | 19,2% |
| 1400×900 | 973×475 | 986×672 | 28,4% |
| 1280×800 | 870×425 | 890×572 | 24,0% |
| 1024×768 | 768×375 | 634×540 | **42,7%** |

A regra vencedora da cascata é
`#app:has(#fieldcv) > .field-wrap > #fieldcv { height: calc(100% - var(--cds-narr-h)); aspect-ratio: auto }`
em `19-cds-ux-system.css`, que **cancela** o `aspect-ratio: 1024/500` da regra
de desktop. O comentário dela diz que "a pequena faixa de letterbox some porque
a célula já fica perto de 2.048" — a célula está em 1,467.

Não consertei por CSS de propósito: o mundo lógico do render é fixo em 1024×500
(`CW`/`CH`, com a câmera, o palco 2.5D e o palco pré-renderizado todos
derivados dali). Encolher a caixa por CSS não aumenta o campo — só troca tarja
preta por espaço morto abaixo dele. O conserto que **aumenta** o campo é dar
proporção maior ao mundo lógico, e isso é mudança de renderer, não de folha de
estilo.

**A bola cai de 30–90 cm para o gramado em um único passo, ~2,8 vezes por
minuto.** Acontece quando uma viagem termina com a bola ainda no ar e o
tratador de chegada zera `z`. Separação medida: descida legítima em voo chega a
12,0 m/s no p99; o teletransporte é 54 m/s. Um limitador de descida no render
resolveria no 1X, mas no 3X padrão a descida legítima já ocupa a mesma faixa de
pixels por quadro — o limitador ou não faria efeito ou distorceria trajetória
real. Fica anotado com o número, não remendado.

## Como reproduzir

```bash
node tools/fisica/bateria.js --build=dist/index.html --matches=120 --workers=8 \
  --out=reports/minha-medicao.json
python3 tools/fisica/placar.py reports/minha-medicao.json
```

As sondas de tela desta ordem de serviço (`pinga.js`, `rasteira.js`, `forma.js`,
`salto.js`) medem coisas que a bateria não vê, porque a bateria carrega o bundle
com `vm.runInThisContext` e não desenha nada. Elas rodam em Chromium de verdade,
pelo `window.__quickMatch`.
