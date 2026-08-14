# D45–D48 · O goleiro, a inclinação, o disco de lama e as variantes

**Data:** 2026-08-14 · **Camadas 21, 69 e o núcleo 70** ·
**Instrumentos novos:** `tools/fisica/tela/goleiro.js`,
`tools/fisica/tela/posesheet.js`, `tools/fisica/sonda-eventos.js`

---

## §D45 · O piso do goleiro era uma constante

`Controller.update` resolvia o goleiro com `ctx.isGK ? 'gk_ready'` — **sempre**,
em qualquer velocidade, com ou sem bola. Ele está em cena 100% do tempo e tinha
um estado só fora dos instantes de defesa.

Medido em 10.586 amostras (`goleiro.js`):

| | |
|---|---|
| parado (v < 0,3 m/s) | **18,2%** |
| velocidade mediana | 1,26 m/s (p90 3,01 · p99 6,81) |
| bola a menos de 18 m | 12,2% |
| com a bola na mão | 0,9% |

**Em quatro de cada cinco quadros o goleiro estava andando e sendo desenhado
parado em prontidão.**

Consertos:

- piso passa a ser `goleiroFor(ctx)`: `gk_shift` quando desloca, `gk_set`
  quando a bola está a menos de 20 m, `gk_ready` no resto.
- **`gk_throw` / `gk_kick`**: a distribuição não tinha gesto nenhum. Não faltava
  evento — a bola parte por `_startTravel` com o goleiro na origem; o alcance
  decide qual dos dois é.
- **`gk_ground_recover`** vira o desfecho encadeado de todo voo. Quem mergulha
  cai; o goleiro não levantava.
- **o mergulho não era desenhado como mergulho**: `o.divePose` vem do caminho
  legado de poses. Quando a máquina da R14 entra em `gk_low_dive`/`gk_high_dive`
  sem que o caminho antigo tenha agendado um `dive`, o goleiro voava **de pé**.
- **braços ao alto** só respondiam a `o.pose`. Encaixe, soco e mergulho alto são
  estados da R14 há muito tempo e nenhum levantava o braço.

### O limiar que eu ia errar

`gk_set` na primeira versão exigia `v < 0,6` **e** bola perto — e não disparou
nenhuma vez. Quando a bola se aproxima o goleiro está justamente se **movendo**:
as duas condições são quase disjuntas. "Set" não quer dizer imóvel, quer dizer
plantado esperando o chute — o que exclui o sprint, não o passo.

---

## A folha de poses, e o que ela mostrou

`gestos.js` diz se um estado tem silhueta **própria**. Não diz se ele está
**bom**. `posesheet.js` desenha os 62 estados fora da partida, em três fases,
forçando `__CDS_ANIM_BY_KEY` e chamando `CDS_F25D.body` direto.

Duas armadilhas do desenho que a sonda teve de contornar: a passada depende de
histórico (`d.vms`/`d.gait` no `dirCache`), então cada célula recebe 48 quadros
de aquecimento; e como o `x` avança, o `ctx` é transladado de volta — `body` vê
um atleta correndo e a célula vê um atleta centrado.

**O que a folha mostrou de cara:** `gk_ready`, `gk_shift` e `gk_set` eram
praticamente o mesmo desenho. O tronco do goleiro é grande e os braços ficavam
sempre em T, então `esc`/`spr`/`agacha` mexiam só no que estava escondido atrás
dele. Cada estado ganhou altura de braço esquerdo, direito e abertura própria
(`gl`/`gr`/`gx`) — e a luva, que ficava num ponto fixo, passou a acompanhar.

---

## §D46 · A inclinação girava a cabeça para fora do corpo

A rotação gira o boneco **inteiro** em torno do ponto de chão. A cabeça fica a
0,82·r de altura, então a 0,60 rad ela desloca 0,46·r — **mais que a
meia-largura do tronco (0,56·r)**. O atleta lia como "caindo", não como
"inclinado".

Visto na folha em `accelerate` e `press`, que juntos são dois dos estados mais
frequentes do jogo (7.177 e 1.348 quadros numa amostra de 60 s).

Teto de ±0,34 rad na rotação total, e a cabeça desfaz **62%** do arco —
compensar tudo deixaria o pescoço rígido e mataria a leitura do gesto.

---

## §D47 · A aura do portador era um disco de lama

```js
if (p.hasBall) { ctx.globalAlpha=.28; ctx.arc(x,y,r+9); ctx.fillStyle=pc; ctx.fill(); }
```

Um círculo **cheio** de raio `r+9` — quase o dobro do atleta — na cor do time, a
28% de alfa, na altura do **corpo**. Cor de time a 28% sobre grama não lê como a
cor do time: lê como marrom sujo, e o disco cobre o jogador que deveria
destacar. Ampliando um quadro, o boneco sumia dentro da própria marca.

Trocado por uma **seta acima da cabeça**. A primeira tentativa foi um anel no
chão — que ficou debaixo da placa de nome, desenhada justamente em quem está
perto da bola, ou seja, sempre no portador. Marca invisível não é marca.

> ### O que eu quase "consertei" sem estar quebrado
> No mesmo quadro ampliado havia uma seta marrom e um quadrado amarelo-esverdeado
> que pareciam artefato de render. **São emoji.** O jogo usa `❌ 🧤 💥 🛡️` nos
> efeitos, e o Chromium headless não tem fonte de emoji: os quatro medem
> exatamente **27,0 px**, a assinatura de um único glifo de fallback. No
> navegador do jogador eles renderizam normalmente. Ia mexer no que só está
> quebrado dentro da minha própria sonda.

---

## §D48 · As variantes de chute e passe

`power_shot`, `placed_shot`, `volley` e `long_pass` estavam declarados e
desenhados, e nenhum evento mapeava para eles — **todo chute virava
`shot_prepare`**. O motor não classifica a ação, e não precisa:

- altura da bola na batida > 0,55 m → **voleio**
- distância até o alvo > 20 m → **chute de força**; menos → **colocado**
- passe com `passKind === 'launch'` ou alcance > 28 m → **lançamento**

Dois detalhes sem os quais a fiação não teria adiantado nada:

1. `animWave` não conhecia os nomes novos e devolvia **0** — as variantes
   chegariam ao desenho com onda zero, sem perna de chute. É exatamente o
   defeito que a §D39 achou na interceptação, um nível abaixo.
2. O `kicking` do desenho é um regex fechado; sem incluí-las, elas cairiam na
   modulação de corrida e o atleta "bateria" correndo.

O voleio bate com a perna 0,46·r mais alta; o chute de força projeta 35% mais a
perna que o colocado.

---

## A medição

| | antes da §D42 | §D42 | §D43 | agora |
|---|---|---|---|---|
| estados **nunca desenhados** | 35/62 | 27/62 | 15/62 | ver abaixo |
| estados que desenham a corrida idêntica | 4 | 0 | 0 | **0** |

### E uma coluna que faltava na sonda

`gestos.js` chamava de "nunca desenhado" tudo que não caiu na amostra. Mas a
defesa acontece ~4,8 vezes por partida: numa amostra curta o sorteador de
quadros simplesmente não pega o gesto. A sonda passou a separar, usando o
auditor de pedidos:

- **nunca PEDIDOS por ninguém** → defeito de estrutura
- **pedidos e fora da amostra** → raridade

Foi assim que `gk_smother` e `gk_kick` saíram da lista de defeitos. E
`gk_foot_save`, que eu tinha classificado como estruturalmente morto, é **raro**:
o alvo da defesa está abaixo de 0,50 m em **25,4%** dos casos, mas 71,6% das
defesas têm afastamento lateral > 0,55 m e viram voo antes de chegar ao teste de
altura. A interseção é pequena, não vazia.

> Sem essa coluna eu estava a um passo de relatar raridade como defeito — pela
> segunda vez no mesmo dia.


---

## O portão que a §D42 nunca teve

Eu havia escrito, na §D42, que a ponte de animação não instala no runner
headless e que por isso as 14 métricas não podiam se mover *por construção*.
**Está errado.** `tools/fisica/bateria.js` faz `define('window', global)`
**antes** de carregar o bundle, então `(typeof window !== 'undefined' ? window
: null)` devolve o global e a ponte instala — envolvendo `step` e `_emit`.
Conferido rodando, não relido.

Portanto §D42 + §D43 + §D45–§D48 passaram por um portão pareado de verdade,
**300 partidas**, semente 4200000, contra o commit imediatamente anterior à
§D42:

| seção | chaves | diferenças |
|---|---|---|
| `agregado` (as 14 métricas) | 14 | **0** |
| `eventosPorPartida` | 76 | **0** |
| `fisica` | 15 | 3, todas de último bit |

As três: `ramos.defSomaDistLinha`, `defSomaTempoBola` e `somaForca`, com desvio
relativo de **0,00000%** — a mesma oscilação de ordem de soma da armadilha
**D8**, presente também entre duas execuções do build não modificado.

`bash tools/testes.sh` → **8/8**.
