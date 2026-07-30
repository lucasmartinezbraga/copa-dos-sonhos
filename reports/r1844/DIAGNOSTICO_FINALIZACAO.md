# Diagnóstico de finalização — de onde vem o xG por chute

Instrumento: `tools/r1843/diag_xg.js`. Build medida: R18.43
(`0062c2eaad18`), base s1 = 4200000, n=48. Este documento é o diagnóstico
pedido antes de escrever qualquer patch de conversão.

---

## 1. A estatística chamada `xg` não é xG

Em `_shoot`, bloco base do bundle:

```js
let pGoal = base*CAL.shooting.conversionScale*angMul*(1+skill*CAL.shooting.skillInfluence)*ctx.execution;
pGoal *= oneOnOne ? .70 : longshot ? .50 : 0.62;
pGoal  = clamp(pGoal, CAL.shooting.minGoalChance, oneOnOne ? .72 : CAL.shooting.maxGoalChance);
const xg = pGoal; this.stats[o.team].xg += xg;
```

`xg` **é** o `pGoal` — a probabilidade contra a qual o motor sorteia
`chance(pGoal)`. Não é um modelo de expectativa independente. O xG posicional
existe e é emitido em separado como `baseXg = base*angMul`.

Isso importa porque `ECO-02` (xG por partida, faixa 1,8–2,7) está, na verdade,
medindo **taxa de conversão × volume**, não qualidade de chance. E porque a razão
entre as duas grandezas é onde o defeito mora:

| banda | `baseXg` (posicional) | `pGoal` (usado) | razão |
|---|---:|---:|---:|
| <6 m | 0,460 | 0,510 | 1,11 |
| 6–11 m | 0,240 | 0,357 | 1,49 |
| 11–16 m | 0,137 | 0,204 | 1,49 |
| 16–22 m | 0,078 | 0,124 | 1,60 |
| 22–30 m | 0,029 | 0,038 | 1,33 |
| ≥30 m | 0,010 | 0,013 | 1,27 |

O `baseXg` médio do jogo aberto é **0,103**, praticamente o ~0,11 do futebol
real: **os chutes de jogo aberto saem de posições plausíveis.** O que está fora
da curva é a conversão aplicada sobre elas — `conversionScale 2,25 × 0,62 = 1,395`
mais perícia e execução.

## 2. São cinco caminhos de finalização, e o maior ignora a distância

| caminho | % das finalizações | usa `distanceXg`? | `pGoal` |
|---|---:|---|---|
| `low_cross_shot` | **44,2%** | **não** | achatado 0,06–0,40, base fixa 0,16 |
| `shot_taken` (jogo aberto) | 39,8% | sim | curva × conversão |
| `header_shot` | 11,4% | **não** | base fixa 0,105 |
| `freekick` | 4,3% | não | — |
| `penalty` | 0,3% | não | ~0,65+ |

**56% das finalizações nunca consultam a curva de distância.**

### 2.1 Por que a alavanca de conversão da R18.40B não podia funcionar

`conversionScale` aparece **só** no caminho de jogo aberto. Não toca
`low_cross_shot` nem `header_shot`. Mover 2,25 → 2,12 (−5,8%) podia afetar ~40%
dos chutes em ~6%, ou seja ~2,4% no total — abaixo da variância entre bases. O
handoff concluiu "não insista nesse lever" e estava certo; agora se sabe o
motivo mecânico, e não só o resultado empírico.

### 2.2 O cruzamento rasteiro é chute de longe com preço de chance clara

Medido no instante do evento, com a posição da **bola**:

| | valor |
|---|---:|
| distância média ao gol (bola) | **25,0 m** |
| distância média ao gol (atacante) | 28,0 m |
| separação atacante↔bola | 3,1 m |
| distribuição | 11% em 11–16 m · 19% em 16–22 m · **46% em 22–30 m · 24% além de 30 m** |
| `pGoal` aplicado | 0,19–0,22, **sem variação com a distância** |
| valor da tabela `CAL` nessas bandas | 0,032 (22–30 m) e 0,015 (≥30 m) |

O caminho cobra **~6× o valor posicional**. O sítio tem `atk.x`/`atk.y`
disponíveis e não os usa:

```js
const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);
```

**Verificação de que o instrumento não está medindo a coisa errada:** a primeira
versão media a distância pelo atacante e dava 28,0 m, o que é implausível para um
cruzamento rasteiro e cheirava ao erro do §6 do handoff. Passei a medir bola,
atacante e a separação entre eles. Separação de 3,1 m no rasteiro e **0,17 m** no
cabeceio: o atacante está na bola. A medição é do jogo, não do instrumento.

## 3. Existe um caminho de gol sem xG — e é um bug conhecido

Em `_gkResolveSave`:

```js
if(!gk||!_cv.ok){
  this._emit('visual_contact_failed',{kind:'save',gk,distance:gd,target:ctx.saveTarget});
  this._continueTravel({...},'shot',()=>this._goal(o,false),{outcome:'goal_after_failed_reach'},...);
  return;
}
```

Um chute que o `chance(pGoal)` **já decidiu como não-gol** é convertido em gol
quando `_physicalContactValid(gk, 1.95, z)` reprova — **sem somar xG nenhum**.

Medido pelo evento `visual_contact_failed{kind:'save'}`: **16,98% dos gols**. O
relatório da R18.40A media `CAU-03` em **17,75%** por um caminho completamente
diferente. Dois instrumentos independentes concordando é o tipo de confirmação
que o §6 do handoff pede.

Consolidando: **gols/xG = 1,265**. O modelo de xG do jogo não prevê os próprios
gols do jogo, e **não existe gate na matriz que force essa coerência** — é por
isso que um caminho de gol sem xG pôde atravessar várias rodadas promovidas sem
nenhum gate reprovar.

### 3.1 Correção de uma hipótese minha, medida e derrubada

Eu havia proposto que o excesso de gols vinha da **conversão calibrada alta**
(`conversionScale 2,25`), e sugeri atacar xG/chute como etapa própria. **Está
errado, e o próprio instrumento derrubou.** Descontando só os gols por falha de
contato do goleiro:

| | gols/xG | gols/xG **sem** os gols de falha de goleiro |
|---|---:|---:|
| R18.43 | 1,265 | **1,024** |

Ou seja: removida a falha do goleiro, o modelo **já era coerente** (1,02). A
incoerência inteira era o bug de raio, não a escala de conversão. Não existe
"motor que converte 26% acima do modelo" — existe um caminho de gol que não passa
pelo modelo.

Isso também corrige a comparação que eu fiz com futebol real. Eu comparei o
xG/chute do jogo (0,166) com o ~0,11 real e chamei de "conversão 1,54× alta".
Não é comparável: o `xg` do jogo é `pGoal`, uma taxa de conversão, enquanto o
xG do futebol real é posicional. A grandeza comparável é o `baseXg`, que dá
**0,103** contra ~0,11 real — isto é, **certo**. A conclusão honesta é mais
estreita e mais útil do que a minha hipótese original: o problema não é a
conversão do jogo aberto; é (a) o bug do goleiro e (b) o caminho do cruzamento
rasteiro, que não tem termo posicional nenhum.

## 4. Consequência para o plano

O excesso de gols **não é** primariamente "conversão calibrada alta". É, em boa
parte, o bug de raio do goleiro que a R18.40 já diagnosticou: o plano usa
`radius = 3.0` nos três sítios de chute e a checagem valida com `1.95`, então
`required = max(0, dist − radius)` declara o goleiro já no lugar, ele nunca
recebe ordem de andar, e a checagem reprova.

`tools/r1840/patch_gkraio.js` conserta exatamente isso e leva `CAU-03` de 21,34%
para 1,24%. **Ele nunca foi medido sozinho** — a R18.40B o mediu junto com
`patch_escalacao.js`, e o par reprovou por gols/xG inflados **pela escalação**.
Medido isolado, ele deve **baixar** gols, que é precisamente a folga que `OS-02`
precisa e que a R18.43 consumiu.

Por isso a R18.44 candidata é o raio isolado, e não um patch novo de conversão.

## 5. Dois gates que a matriz não tem e deveria ter

```
COE-01  gols/xG em [0,90; 1,15]
        O modelo de xG deve prever os proprios gols. Derivado de futebol real,
        onde xG e calibrado contra gols e a razao fica ~1,0. Este e o gate que
        teria pegado o caminho de gol sem xG na rodada em que ele nasceu.

CAU-03  % dos gols por falha de contato do goleiro < 8%
        Alvo que a matriz ja registra; passa a ter instrumento proprio e
        medicao em 3 bases via visual_contact_failed{kind:'save'}.
```

Implementados em `tools/r1844/multibase44.js`.

## 6. Fica documentado para a rodada seguinte, e não foi tocado aqui

O `low_cross_shot` (§2.2) é um defeito independente e maior em volume: 44% das
finalizações com preço 6× o posicional. Consertá-lo é dar-lhe termo posicional,
preservando um bônus situacional legítimo (a bola cruzada rasteira encontra
defesa e goleiro deslocados, então vale mais que um chute qualquer da mesma
distância — mas não 6× mais). Não entra na R18.44 porque a disciplina desta
linhagem é um mecanismo por etapa, e misturá-lo com o raio tornaria impossível
atribuir o efeito — que é exatamente o erro que fez a R18.40B reprovar sem saber
de qual das duas metades a reprovação vinha.
