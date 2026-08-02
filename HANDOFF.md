# Para quem pegar este código depois

Isto não é um guia de estilo. É a lista das coisas que me custaram horas e que
você vai repetir se ninguém te contar. Cada afirmação aqui foi **medida**, e
quando não foi, está dito.

---

## 1. Antes de qualquer coisa: como se constrói

O jogo é **um HTML único de ~24 mil linhas**, e ele **não tem código-fonte no
sentido normal**. Ele é produzido por uma cadeia de scripts de patch:

```
tools/r1851/build_r1851.sh
  BASE = dist/… R18.50 …
  → patch_01 → patch_02 → … → patch_70 → OUT
```

Cada patch é um script Node com um helper:

```js
function edit(id, from, to) {
  const count = src.split(from).length - 1;
  if (count !== 1) { console.error('ABORTA [' + id + ']: ancora ' + count + 'x'); process.exit(1); }
  src = src.replace(from, to);
}
```

**A âncora tem de casar exatamente uma vez.** Isso é uma defesa, não um
incômodo: quando um patch anterior muda o texto que você ancorou, o build morre
com `ABORTA: ancora 0x` em vez de aplicar silenciosamente no lugar errado.

Regras práticas:

- **Nunca edite `dist/` à mão.** É saída, e será sobrescrito.
- Um patch que foi medido e falhou **não some**: ele fica no repositório, fora
  da cadeia, comentado em `build_r1851.sh` com o número que o derrubou no
  cabeçalho. Cinco patches desta rodada estão assim (OS-67, 68, 69, 71, 72), e
  eles valem mais como registro do que valeriam como código.
- Crase dentro de template literal em script de patch quebra o script. Me pegou
  duas vezes (`` `save` ``, `` `block` ``). Escreva sem crase.

---

## 2. A armadilha que mais custa: **o código que você achou provavelmente está morto**

O HTML é uma pilha de camadas que se sobrescrevem: núcleo → R12 → R13 → R14 →
R18.x → P47 → OS-xx. Muitas delas substituem métodos do protótipo **sem
encadear**.

Casos confirmados nesta linhagem:

| método | onde parece estar | onde realmente está |
|---|---|---|
| `_integrate` | `:7713` (núcleo) | `:16395` (transacional R12) |
| `_assignDefRoles` | núcleo | `:16736` (R13) |
| `_defendTarget` | núcleo | `:20218` (R18.5) |
| `_dribble` | núcleo | `:16382` (R12.2) |
| decisão de passe | núcleo `_decide` | `cds-r13-football-observer-cadence` |

E existe uma variante mais traiçoeira: código **vivo mas sombreado**. O
`_decide` do núcleo é uma cascata de `return` antecipados. As linhas `:5189` e
`:5209` são alcançáveis — e são alcançadas em ~1% das ações, porque camadas a
montante decidem antes. Editei as duas e o resultado foi **idêntico byte a
byte**. Duas rodadas inteiras (OS-69, OS-71) morreram nisso.

### O que fazer em vez de deduzir

**Instrumente.** Nunca conclua qual camada está viva lendo código. Duas técnicas
que funcionaram todas as vezes, em minutos, depois de horas de dedução errada:

**A) Setter na propriedade**, para descobrir quem escreve:

```js
let _x = alvo.x;
Object.defineProperty(alvo, 'x', {
  get(){ return _x; },
  set(v){ if (v !== _x) registraPilha(new Error().stack); _x = v; },
  configurable: true
});
```

Isso me disse que **97,2% das escritas de posição vêm de `commitMovement`
dentro de `_resolveOverlaps`** — o `_integrate` nunca escreve `p.x`, ele planeja
em `ctx.planned`. Eu tinha medido "física 0,000 m/quadro" e quase publicado a
conclusão de que o movimento inteiro era correção.

**B) Gancho na função, capturando a pilha de quem chama:**

```js
for (const fn of ['_pass','_carry','_dribble','_shoot','_cross']) {
  const f = P[fn];
  P[fn] = function(){ conta(fn + ' ' + new Error().stack.split('\n').slice(2,5)); return f.apply(this, arguments); };
}
```

Isso me deu, de uma vez, o mapa de decisão inteiro:

```
40,5%  _pass    <- P.step (r14-engine:169)      execução diferida
11,9%  _pass    <- P._decide (r13-observer-cadence:710)
11,0%  _pass    <- P._decide (r13-observer-cadence:691)
 4,2%  _carry   <- MatchSim._decide (núcleo)
```

Faça isso **antes** de escrever o patch, não depois de ele não funcionar.

---

## 3. A segunda armadilha: **parâmetros que existem e não fazem nada**

`CAL.timing.decisionInterval = 0.28` parece ser o botão da cadência de decisão.
**Não é.** O contador `decideT` corre livre (`this.decideT -= dt` todo quadro)
mas só é consumido quando há dono, a bola não está viajando e o `settle` acabou.
Durante os 0,92 s de voo da bola ele chega fundo no negativo — quando a bola
pousa, já está vencido, e o receptor decide no mesmo quadro. **O intervalo nunca
vincula.**

Levei de 0,28 a 1,60 — 5,7 vezes — e o domínio da bola ficou em 0,45 s, mediana
0,37, nos três pontos.

O mesmo vale para os cinco tetos de `decideT` (`:6726`, `:5076`, `:17289-91`):
multipliquei por 2,6 e nada se moveu.

**Teste barato que evita isso:** antes de calibrar uma constante, mude-a por 5x e
meça. Se nada andar, você achou configuração morta, não um efeito fraco. Não
gaste uma rodada procurando o valor ótimo de um número que não é lido.

---

## 4. A terceira armadilha: **o desfecho existe na estatística e não tem consequência física**

Padrão recorrente, encontrado quatro vezes:

- bloqueios eram contados e a bola seguia igual;
- a barreira de falta era desenhada e **não existia** (mediana do adversário mais
  próximo: 0,50 m da bola);
- duelo aéreo em cruzamento tinha vencedor e nenhum efeito na trajetória;
- drible vencido não separava ninguém: em 27,8% dos casos o marcador continuava
  colado.

**Sempre verifique que o evento estatístico muda posição, velocidade ou posse.**
Se só incrementa um contador, ele não existe para quem está assistindo.

---

## 5. O contrato de método que o dono do projeto exige

Não é preferência de estilo. É o que separa trabalho de teatro aqui.

1. **Uma rodada por vez.** Não um plano de cinco.
2. **Mecanismo com `arquivo:linha`.** Onde exatamente, não "na lógica de X".
3. **Hipótese como DIREÇÃO**, nunca como porcentagem. "Sobe" / "desce". Você não
   sabe o quanto antes de medir; dizer um número é inventar.
4. **O edit exato, com a âncora.**
5. **Previsão registrada ANTES de medir.** Escrita no cabeçalho do patch, no
   repositório, antes de rodar a bateria. É isso que torna a falsificação
   possível — e cinco patches desta rodada foram derrubados pela própria
   previsão que eu tinha registrado.
6. **Qual gate decide.**
7. **Qual armadilha pode te pegar.** Escreva-a. Numa das rodadas a armadilha que
   registrei ("se `_carry` for só um toque curto que devolve a decisão, mais
   conduções não aumentam o domínio") foi exatamente o que aconteceu.

E duas regras absolutas:

> **Não dê número que você não mediu.**
> **Não diga que um patch está pronto para promover sem a bateria.**

Isso vale inclusive para números que "obviamente" seguem do mecanismo. Eu previ
que escalar `decisionInterval` e `clockRate` juntos manteria os totais
constantes — passes foram de 451 para 758 e gols de 1,81 para 4,38.

---

## 6. Como medir

### Bateria em Node

O harness avalia os blocos `<script>` do HTML com `vm.runInThisContext` e expõe
`MatchSim`, `buildDB`, `autoLineup`, `FORMATIONS`, `srand`, `FL`, `FW`.
Convenção usada em todos os diagnósticos:

```js
const novoSim = (seed, form) => { srand(seed); return new MatchSim(a, b, {neutral:true, labMode:true}); };
// sementes: 4200000 + i*7919 ; formações em round-robin
```

8 partidas para triagem, 16 a 24 para promover.

**Cuidado com o harness:** ele pula um conjunto de blocos (SKIP). Isso me fez
concluir que a máquina de estados de animação estava morta — no navegador ela
está viva. **Antes de declarar uma camada de render morta, confira no
navegador.**

### Gates

```js
getR18173Audit().marking.threatCoverage      >= 0.65
getR18173Audit().marking.markerMeanDistance  <= 8.5
getR18173Audit().rates.swarm3Within6
getR18173Audit().rates.severe4Within9
getR18173Audit().lines.{meanRange, disconnected}
ECO-05: escanteios entre 4 e 10
ECO-02: xG <= 2,7
```

### Navegador

Playwright com `executable_path='/opt/pw-browsers/chromium'`. Handles úteis:

```js
window.__quickMatch(i, j)     // inicia partida instantânea, pula o sorteio
window.__CDS_ACTIVE_SIM       // a simulação viva
window.__CDS_SCREEN           // { m:[a,b,c,d,e,f], p:{ chave:{x,y,r,s} } }
document.getElementById('fieldcv')
```

Para patch **só de apresentação**, o teste é que os números do motor fiquem
**idênticos**. Se mudarem, vazou para a simulação.

### Amostragem

Não selecione quadros por uma condição correlacionada com o que você quer medir.
Eu classifiquei "quadro limpo" por igualdade exata de posição, sobrou 0,77% dos
quadros — e esses 0,77% eram justamente os jogadores parados. A média de
velocidade deu 0,86 m/s num jogo cuja média real é 3,92.

---

## 7. O que é verdade sobre esta simulação (medido)

- **`clockRate` é o botão mestre de volume.** Quase todo total por partida é
  proporcional a `1/clockRate`. Com ele em 0,13, os 90 minutos cabem em ~692 s
  de ação e a partida leva ~14 min reais no 1x.
- **O ciclo de posse é `settle + prep + voo`** ≈ 0,37 s + 0,90 s. O domínio
  (0,37 s de mediana) é **invariante** sob seis mecanismos diferentes que testei.
  Toda posse é: recebe → domina → solta.
- **504 passes em ~750 s de bola rolando = 0,67 passes por segundo**, contra
  ~0,27 do futebol. Daí a bola ficar ~55% do tempo no ar contra ~28% reais.
  Quem quiser que o jogo *pareça* futebol tem de atacar passes-por-segundo, e
  ninguém achou a alavanca ainda. **É o problema aberto mais importante.**
- **O render trabalha em coordenadas normalizadas 0..1**, que entram em
  `cx()/cy()` e depois em `CDS_F25D.project()`. Escrever metros ali joga o objeto
  para fora do quadro — desenhei um árbitro invisível assim.
- **`_integrate` planeja, `commitMovement` escreve.** Uma vez por quadro, com
  clamp de passo e limitador de taxa angular (§33). A arquitetura de movimento
  está certa; não a reescreva sem instrumentar antes.

---

## 8. Coisas que parecem bug e são decisão

Não "conserte" sem perguntar:

- **A escala dos bonecos.** Eles ocupam ~2,4 m de largura contra ~0,6 m reais. É
  troca deliberada por legibilidade — com o campo inteiro e escala correta, o
  atleta fica com ~20 px e nenhuma animação é visível.
- **A câmera de TV corta o campo no desktop** (OS-57). Ela segue a bola de
  propósito. As tarjas pretas em cima e embaixo vêm do canvas ser 1024×500 dentro
  de uma caixa mais alta — é aspecto de layout, não erro de desenho.
- **`threatCoverage` está em 0,616 contra o gate de 0,65.** É anterior às
  rodadas recentes. Não atribua a mudança sua sem medir a base antes.

---

## 9. Uma lição sobre padrão gráfico em sprite pequeno

Desenhei padrões de camisa (listras, argolas, faixa) com a cor escura do time a
55% sobre metade da área do tronco. Em canvas isolado a `r=46` ficava bom. **No
tamanho real de jogo — tronco de ~20 px — não lê como listra, lê como sujeira**,
e a cor da seleção fica encardida. O dono do projeto reclamou na hora.

Se for mexer em desenho de jogador: **renderize a boneca isolada E no tamanho
real, lado a lado com a build anterior.** O truque é criar um canvas próprio e
chamar `CDS_F25D.body()` direto, nos dois builds, com a mesma chave de animação.

---

## 10. O que o dono do projeto quer

Ele disse isso de forma direta e vale mais que qualquer gate:

> "isso é pra deixar o jogo mais realista ou só pra bater gate?"

Gate é rede de segurança, não objetivo. Um patch que passa em todos os gates e
deixa o jogo com cara de peça deslizando num tabuleiro não serve.

E:

> "VOCÊ NÃO TEM QUE PERGUNTAR, TEM QUE RESOLVER."

Resolva. Mas resolver inclui dizer com todas as letras o que **não** foi
resolvido, com o número medido do lado. Ele lê os números.

---

## 11. Estado aberto, com número

| item | medido | referência real |
|---|---|---|
| domínio da bola | 0,37 s (mediana) | 1,1–1,4 s |
| bola no ar | ~55% | ~28% |
| passes por segundo de ação | 0,67 | ~0,27 |
| passes por partida | 461 | ~900 |
| faltas por partida | 14,9 | ~22 |
| distância por jogador | 18,8 km | ~10,5 km |
| `threatCoverage` | 0,616 | gate 0,65 |
| duração real no 1x | ~14 min | — |

A build promovida é a **R18.83**. Gols 2,63 com xG 2,67 — o melhor ponto que o
projeto já teve com o xG dentro do gate.

O relatório completo de cada rodada está em `reports/r1851/`. Leia
`RODADA_OS65_OS66.md` antes de encostar em decisão ou movimento: ele tem as seis
falsificações com os números que as derrubaram, e vai te poupar de repeti-las.

---

## 12. A fila de trabalho

`PROXIMA_RODADA.md` na raiz. Seis observações de campo do dono do projeto
assistindo a uma partida da R18.83, cada uma com o que eu já medi, a âncora
exata no código, e o que ainda não sei. Duas delas (lado do escanteio e falta
atrás) são defeito objetivo com número medido e correção localizada.
