# Ordem de serviço para a próxima IA

Leia `HANDOFF.md` primeiro — ele tem as armadilhas do código e o contrato de
método. Este documento é a **fila de trabalho**, vinda de observação de campo do
dono do projeto assistindo a uma partida da R18.83.

São seis itens. Para cada um: o que ele observou, o que eu já **medi**, a
**âncora exata**, e o que ainda não sei. Onde está escrito "medido", tem número.
Onde não está, não tem — e você não deve inventar um.

Regra que vale para todos: **previsão registrada antes de medir**, direção e não
porcentagem, e a bateria antes de promover.

---

## 1. Falta atrás não vira cobrança — o jogador sai andando com a bola

> "O jogador sofreu falta e não parou para bater, ele saiu andando com a bola.
> (Faltas atrás)"

### Onde

`_awardFoul`, no fim (`:6810` na R18.83):

```js
const dtg = D(victim.x, victim.y, vg.x, vg.y);   // vg = gol ADVERSÁRIO
...
if (dtg < 42 && chance(0.92)) { this._freeKick(victim.team, victim.x, victim.y); return; }
// falta comum: reinício com posse
this.dead = 0.82;
this.pendingRestart = () => { this._giveBall(this._nearestFieldMate(victim)); this.ball.owner.settle = 0.6; };
```

`dtg` é a distância até o gol **adversário**. Falta sofrida no próprio campo →
`dtg ≥ 42` → cai no ramo de baixo. Esse ramo **não põe a bola no chão nem no
local da falta**: ele entrega a posse ao companheiro mais próximo, onde quer que
ele esteja.

O comentário do OS-31 diz que isso foi deliberado ("perto do gol vira lance de
cobrança; longe, reinício rápido"). A observação de campo mostra que a
"cerimônia reduzida" virou "cerimônia nenhuma".

### Medido (4 partidas, `tools/r1851/diag_os73_foul_restart.js`)

```
faltas por distância até o gol adversário
  <20      0,3 por partida
  20-42   10,3
  42-60    2,8
  60-80    2,5
  >80      1,0
cobranças 22,0 | "reinício com posse" 6,3 por partida

DESLOCAMENTO entre o local da falta e onde a bola reaparece
  mediana 2,76 m | p90 6,13 m | máx 6,3 m

ADVERSÁRIO MAIS PRÓXIMO no reinício
  mediana 2,93 m | p10 0,06 m       (regra real: 9,15 m)
```

**6,3 faltas por partida** reiniciam assim. A bola reaparece a ~2,8 m de onde a
falta foi, e em 10% dos casos há um adversário a **6 cm**. Não é bola parada, é
o jogo seguindo.

### O que fazer

Não é aumentar o `dtg < 42`. Isso só transformaria falta lá atrás em cerimônia
completa de cobrança, que também não é o futebol. O certo é o ramo de baixo
virar um **reinício rápido de verdade**:

1. bola **no local da falta**, não no pé de quem estiver perto;
2. quem cobra **anda até a bola** (já existe `_setPieceRole` e `settle`);
3. **afastamento do adversário** — a OS-36 já tem a máquina pronta
   (`__os36Guard`, `_os36Wall`, clamp de entrada por quadro em `:24545`).
   Reaproveite, com raio menor que 9,15 m se quiser reinício rápido.

### Armadilha

`this.dead = 0.82` congela o jogo. Se você aumentar o afastamento sem aumentar o
`dead`, os adversários vão ser empurrados **durante** o jogo corrido e isso
aparece como salto por quadro. Meça o salto por quadro
(`tools/r1851/diag_os37_frame_jump.js`) antes de promover.

---

## 2. O lado do escanteio é cara ou coroa

> "Precisa validar o lado do escanteio, se sair pra um lado ou outro."

### Onde

`_setCorner`, `:5586` na R18.83 (a linha que escolhe o canto):

```js
const cy = chance(.5) ? 1.5 : FW-1.5, sign = cy < FW/2 ? -1 : 1;
```

**É literalmente um sorteio.** Pior: `_setCorner(team, forcedRoutine,
forcedDefStyle)` **não recebe a posição da bola**, então a informação de por
onde ela saiu nem chega lá.

Os oito sítios que chamam `_setCorner` (`:5371`, `:5502`, `:5591`, `:6223`,
`:6240`, `:7186`, e os do módulo de escanteio em `:22262+`) sabem onde a bola
estava. Basta passar.

### O que fazer

`this.ball.y` no instante do escanteio decide o canto. Sugestão de forma:

```js
const _by = Number.isFinite(this.ball && this.ball.y) ? this.ball.y : (chance(.5) ? 1.5 : FW-1.5);
const cy  = _by < FW/2 ? 1.5 : FW-1.5, sign = cy < FW/2 ? -1 : 1;
```

Cuidado com os casos em que a bola já foi recolocada quando `_setCorner` roda —
aí `this.ball.y` pode ser o centro. Nesses, passe a coordenada explicitamente do
sítio chamador.

### Como validar

Não confie em ler o código. **Instrumente**: gancho em `_setCorner`, registre
`ball.y` antes e `cy` depois, e conte a taxa de concordância de lado. Hoje ela
deve estar em ~50%; depois tem de ser ~100%.

### Não medi

A taxa de concordância atual. Eu inferi do sorteio, não medi. **Meça antes de
patchar** — pode existir uma camada posterior que já corrija o lado, e aí o
defeito é outro.

---

## 3. Tirar o anel dourado de craque do gramado

> "que o círculo de craque do Messi fosse tirado"

### Onde — achado, é uma linha

`:13787` na R18.83:

```js
// aura de LENDA: anel dourado pulsante (r>=92); brilho forte se em chamas
const isLegend = p.ref && p.ref.legend;
...
const pulse = 2 + Math.sin(performance.now()/300)*1.2;
ctx.strokeStyle = p._onFire ? '#ffd970' : 'rgba(255,203,69,.85)';
ctx.shadowColor = '#ffcb45'; ctx.shadowBlur = p._onFire ? 14 : 7;
ctx.beginPath(); ctx.arc(x, y, r + 3.5 + pulse*0.4, 0, Math.PI*2); ctx.stroke();
```

`p.ref.legend` é setado em `:3330`, `:3391` e `:3413` por `p.r >= 92`.

É patch de **apresentação pura**. O teste de que não vazou: os números do motor
têm de ficar **idênticos** na bateria.

### Decisão que não é sua

Tirar o anel remove o único marcador visual de quem é lenda no gramado. Se o
dono quiser manter *alguma* leitura, o caminho barato é o `_onFire` continuar
marcado e a lenda em estado normal ficar limpa. **Pergunte antes de inventar um
substituto.**

---

## 4. Craque não pode ser dourado quando o overall está escondido

> "Gostaria que o craque não fosse dourado no modo que não mostra o overall."

### Onde

O modo é `G.modo === 'classico'`, e a flag é `hideOvr`, calculada em três
lugares: `:10296`, `:10406`, `:10448`.

A estrela dourada do nome **já respeita o modo** (`:10464`):

```js
${G.modo !== 'classico' ? ((p.r >= 88 || p.legend) ? '<span class="gold">★</span>' : ...
```

**O que vaza é o CSS da linha**, `:439-440`, que não olha o modo nenhum:

```css
.row.legend-row { background: linear-gradient(90deg, rgba(255,215,0,.13), transparent);
                  box-shadow: inset 3px 0 0 var(--ouro); }
.row.legend-row .nm { color: #ffdf70; }
```

Quem monta a linha aplica `legend-row` por rating. No clássico o jogador não
deveria ter nota visível — e o fundo dourado entrega exatamente a nota.

### O que fazer

Não mexa no CSS. **Não aplique a classe `legend-row` quando `hideOvr`**, nos
três pontos onde a linha é montada. Procure por `legend-row` e cruze com o
`hideOvr` que já existe no escopo.

### Armadilha

Existem outros pontos dourados fora da linha (chip `.legend-chip` `:264-267`,
`.gold`, `--ouro`). **Confira no navegador em modo clássico**, com um elenco que
tenha lenda, antes de dizer que fechou. Um `grep` não basta — foi assim que a
listra de camisa passou.

---

## 5. Interceptações não parecem de jogo real

> "Tem algumas interceptações que a forma que acontece não é parecido com um
> jogo da vida real."

### Estado: **não diagnosticado.** Não tenho número aqui.

O que sei do contexto: `intercept` e `intercept_attempt_aborted` aparecem na
auditoria (`getR13Audit().events`) com ~30 e ~8 por partida. E o padrão que se
repete neste motor é o da seção 4 do `HANDOFF.md`: **o desfecho existe na
estatística e não tem consequência física** — já aconteceu com bloqueio,
barreira, duelo aéreo e drible.

### Como eu atacaria

Primeiro **descreva o defeito em números**, não em impressão. Censo por
interceptação:

- distância do interceptador à linha do passe no instante em que ele intercepta
  (se for grande, ele está "puxando" a bola de longe — teleporte de posse);
- ângulo entre o corpo dele e a bola (interceptar de costas é o que mais denuncia);
- velocidade dele no instante (interceptar parado, sem passo, é irreal);
- quanto tempo a bola já estava no ar (interceptação instantânea na saída do
  passe não existe no futebol);
- o que acontece com a bola depois — ela para no pé dele? Muda de direção? No
  futebol a maior parte das interceptações **desvia** a bola, não a captura.

Só depois disso escolha o mecanismo. E localize a camada viva com o gancho de
pilha antes de editar — `_intercept` quase certamente tem versões empilhadas.

---

## 6. O jogo pode ser mais rápido — qual é o tempo ideal

> "Acho que pode ser um pouco mais rápido o jogo, pense em um tempo ideal."

### O que se sabe, medido

`CAL.timing.clockRate = 0.13` (`:2723`) é **o botão mestre de volume**: quase
todo total por partida é proporcional a `1/clockRate`. Isso foi medido de forma
direta e brutal na OS-67:

| | clockRate 0,13 | 0,08125 (k=1,6) | 0,05417 (k=2,4) |
|---|---|---|---|
| passes | 451 | 758 | 1165 |
| gols | 1,81 | 4,38 | 8,38 |
| chutes | 21,8 | 39,1 | 57,4 |

Hoje: 90 minutos em ~692 s de simulação, e a partida leva **~14 min reais no
1x** (medido no navegador, com paradas).

### O conflito que você precisa entender antes de mexer

**Acelerar reduz tudo.** Subir `clockRate` de 0,13 para 0,16 encurta a partida
para ~11 min reais — e joga os gols de 2,63 para ~1,85, que é exatamente onde
eles estavam antes da OS-52 e por que a OS-52 existiu.

A R18.83 está em gols **2,63** com xG **2,67** (gate ≤ 2,7). É o melhor ponto
que o projeto já teve. **Não jogue isso fora por tempo de tela.**

### Os três caminhos, e o que cada um custa

1. **Subir `clockRate` e aceitar menos gols.** Barato, uma linha, e destrói a
   melhor calibração que existe. Não recomendo sem o dono decidir.

2. **Mudar a velocidade padrão de exibição.** O jogo já tem 1x/2x/4x/TURBO
   (`G.speed`). Se o padrão virar 2x, a partida cai para ~7 min **sem tocar em
   nenhum número do motor**. É a única opção com custo zero em realismo. Procure
   onde `G.speed` é inicializado.

3. **Cortar tempo morto em vez de tempo de jogo.** Medido: **11,1% dos quadros
   são bola morta**. Comemoração, reposição, cerimônia de bola parada. Encurtar
   isso tira ~1,5 min reais sem mexer em um único evento de futebol. É o caminho
   mais honesto e o menos explorado.

**Minha recomendação, e é só isso — uma recomendação:** (2) combinado com (3),
nessa ordem. Meça a duração real no navegador antes e depois; não estime.

### Não meça isso em Node

A duração real depende do laço de render, não da simulação. Use Playwright,
amostre `performance.now()` contra `S.minute` (há um script pronto em
`scratchpad/cad.py`, adapte). Em Node você mede segundos de simulação, que é
outra coisa.

---

## 7. E o item que ele não pediu mas é o maior

> "Gostaria que todas as animações fossem polidas."

Isto é aberto demais para virar uma rodada. Antes de "polir", saiba o que já foi
feito e o que já foi medido: OS-46 (ligação evento→estado, 5 categorias a 100%
de cobertura), OS-47 (giro 360), OS-49 (corpo em 360 graus), OS-58 (ciclo de
corrida com braços), OS-59 (pose de cabeceio), OS-60 (poses distintas de
drible). Está tudo em `reports/r1851/`.

E o defeito estrutural que nenhuma delas resolve, medido nesta rodada: **o jogo
passa ~55% do tempo com a bola no ar e o domínio individual é 0,37 s de
mediana**, invariante sob seis mecanismos diferentes. Nenhum polimento de pose
conserta a leitura de "não parece futebol" enquanto a bola quase nunca estiver
no pé de alguém. Se você tiver uma rodada só, gaste nisso, não em pose.

---

## Ordem que eu seguiria

1. **(2) lado do escanteio** — defeito objetivo, uma linha, validação clara.
2. **(1) falta atrás** — defeito objetivo, 6,3 por partida, máquina de
   afastamento já existe.
3. **(3) e (4)** — apresentação, baratos, e o teste é "motor idêntico".
4. **(6) tempo** — decisão do dono; leve a ele as três opções com o custo medido.
5. **(5) interceptações** — censo primeiro, patch depois.
6. **animações / a bola no ar** — a rodada grande.
