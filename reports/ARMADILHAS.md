# As armadilhas deste código

**Vinte e três.** Cada uma custou pelo menos uma rodada de medição de 25
minutos; várias custaram mais. Estavam espalhadas por `CLAUDE.md`, pelo Volume
VIII‑A do relatório, pelos laudos e pelos comentários do código.

Se você só vai ler uma página antes de tocar neste código, leia esta.

Elas estão em quatro grupos, porque erram por motivos diferentes:

| grupo | o que engana | quantas |
|---|---|---|
| **A · a pilha de camadas** | o código que você lê não é o que executa | 5 |
| **B · a medição** | o número existe e mede outra coisa | 7 |
| **C · as ferramentas** | a ferramenta funciona e mente | 6 |
| **D · o processo** | você mesmo, com pressa | 5 |

---

# A · A pilha de camadas

## A1 · Editar o motor e não acontecer nada

**362 sobrescritas em 60 camadas** sobre `MatchSim.prototype`. Uma camada pode
substituir um método e **não chamar a de baixo** — nesse caso o código do motor
que você editou nunca roda.

```bash
node tools/fisica/pilha.js dist/index.html 14
```

Já aconteceu **seis vezes**: arrasto da R13, `if (p === presser)` em
`_defendTarget`, o `b.z = 0.12` decorativo, `_looseBall`, `decideT` e
`_planPhysicalSegment`.

## A2 · `pilha.js` responde VIVA e você ainda erra

**VIVA é propriedade do método, não de cada linha dele.** Na sexta vez a
ferramenta acertou — o método rodava — mas o *ramo* editado não era alcançado.

Se o alvo é um `if` específico, meça **aquele ramo**:

```bash
node tools/fisica/ramos.js dist/index.html 12
```

Ou copie uma sonda de ~40 linhas: `ramo-d02.js`, `ramo-d19.js`, `ramo-d25.js`,
`ramo-g20.js`, `ramo-rolagem.js`. **Custa 2 minutos.** Sete premissas deste
catálogo caíram por pular isso — D01, D02, D25, D12, D16, D24 e D08 estavam
errados **em substância**, não em detalhe.

## A3 · A camada intercepta e o conserto precisa ser feito nos dois lugares

`_looseBall`: a camada 08 o converte em desvio e **não chama o core**. Consertar
só no motor não muda nada; consertar só na camada deixa o outro caminho torto.

Antes de editar, saiba **quantos** donos o método tem. `_decide` tem oito.

## A4 · `CAL` não existe dentro de uma camada

O core é uma IIFE. São globais: `facet`, `chance`, `R`, `clamp`, `FL`, `FW`,
`getAttr`, `lerp`, `D`, `srand`. **`CAL` não é.** Numa camada ele é `undefined`,
e o `||` do lado direito engole o erro em silêncio — foi assim que a calibração
de escanteios da camada 66 ficou desligada sem ninguém notar (D32).

Leia por `ENGINE_CALIBRATION`. O lint do `verify.py` reprova o build se
esquecer.

## A5 · Efeito colateral pode ser o mecanismo

No D11 o veto carimbava `__r122LastContextShot`, um campo que serve para outra
coisa. Parecia abuso de variável, e era. Mas o carimbo **suprimia a roleta por
1,15 s**, e essa persistência era o comportamento.

Removi o abuso, mantive o predicado, perdi a janela — e o `drawRate` andou
**3,53 SE**. Ao limpar um efeito colateral, pergunte primeiro **quem está de pé
em cima dele**.

---

# B · A medição

## B1 · Passar em 2 SE é necessário, não suficiente

`comparar.py` olha **14 métricas agregadas**. `drawRate`, `zeroZeroRate`,
`blowoutRate` e `averageEndingStamina` **não estão entre elas** — saem da
distribuição de placares, não de médias por partida.

No D11 o portão imprimiu `APROVADO: nenhuma metrica se moveu 2 SE` para uma
mudança que levou o placar de design de **12/13 para 10/13**:

```
drawRate      0,270 -> 0,190   (3,53 SE)  SAIU da faixa 0,20-0,33
blowoutRate   0,153 -> 0,197   (1,89 SE)  SAIU da faixa 0,09-0,19
```

Por isso existe `tools/regressao_design.py`, hoje dentro do `aceitar.sh`. **Um
jogo em que ninguém empata e todo mundo goleia está quebrado de um jeito que
nenhuma média por partida denuncia.**

## B2 · Correlação não é mecanismo

O documento explicava o D19 (a partida murcha) por “fadiga uniforme demais”,
citando **r = 0,814** entre stamina e taxa de chutes.

Stamina cai monotonicamente durante a partida. **Qualquer coisa que caia junto
correlaciona alto com ela sem ser a causa.** Aquele 0,814 era compatível com
quatro histórias que pedem consertos opostos. A sonda `ramo-d19.js` separou:
caem **duas** coisas ao mesmo tempo (chutes por minuto **e** acerto por chute),
não uma.

## B3 · Faixa aberta não se compara por total

A faixa `76+` é aberta: acumula mais minutos de jogo que as de 15 min. Comparar
**totais** por faixa mede o tamanho da faixa, não o ritmo do jogo.

Sempre por **minuto de jogo**. E `minuto` aqui tem definição própria — veja C1.

## B4 · A referência já esteve errada

`reports/REFERENCIA.json` **tem** de ser uma medição do build atual. Uma vez foi
copiada de `a2-goleiro-n300.json`, medida com `XG_ESCALA = 0,70`, e commitada
junto com a mudança para `0,651` — e passou a reprovar mudanças inocentes.

Só promova com `bash tools/aceitar.sh --fixar`, e só **depois** do aceite.

## B5 · Não meça duas coisas que se tocam na mesma rodada

**D19** (a partida murcha) e **D20** (o bloco não compacta) mexem os dois em
espaçamento e se contaminam. Um de cada vez, 300 partidas entre eles. Se
entrarem juntos e o resultado piorar, você não saberá de quem foi.

## B6 · A bateria é pareada por semente — tirar um `chance()` desalinha tudo

Remover ou acrescentar um sorteio muda a sequência do RNG para **todas** as
partidas seguintes. As partidas deixam de ser comparáveis uma a uma.

Compare **distribuições**, nunca partidas individuais, quando a mudança mexe no
número de sorteios.

## B7 · n pequeno responde qualquer coisa

Com 8 partidas há ~27 gols no total: a distribuição por faixa oscila 10 pontos
percentuais só de ruído. Sonda exploratória pode usar 8–12; **conclusão, não.**

Erro-padrão de uma proporção: `SE = raiz(p(1−p)/n)`. Com n = 300 e p ≈ 0,2 dá
**0,023** — diferença menor que 0,046 **não é sinal**.

---

# C · As ferramentas

## C1 · `sim.t` não é o relógio do jogo

`sim.minute` só avança quando `this.dead <= 0` — **bola parada não conta como
minuto de jogo**. Convertendo `sim.t * clockRate` eu medi “115 minutos por
partida” e a sonda acusou um defeito de relógio que era erro meu.

A bateria usa `sim.minute`. Usar outra coisa produz número incomparável.

## C2 · A bateria não vê a tela

`bateria.js` roda com `vm.runInThisContext` e **não desenha nada**. A bola
pingando 54 vezes por minuto atravessou uma versão inteira sem aparecer em
métrica alguma.

Mexeu em trajetória ou movimentação? `tools/fisica/tela/pinga.js` e `forma.js`,
em Chromium de verdade. E `tests/browser_smoke.js` é o único que prova que o
jogo **sobe**.

## C3 · `__quickMatch(iA, iB)` recebe índices de elenco

Não `(segundo, velocidade)`. As seis fotos do dossiê foram capturadas passando
segundos ali — não quebrou porque 25 e 55 também são índices válidos, então
**todas saíram ~2 s após o apito**, e não no minuto que a legenda dizia.

O número estava errado e a imagem não tinha como denunciar.

## C4 · Chromium headless não mede ritmo

Com o laço preso ao `requestAnimationFrame`, o headless limita a cadência: os
botões **3X e TURBO avançaram na mesma taxa** (~6,2 s de simulação por segundo
de parede). Não conclua nada sobre velocidade do jogo a partir daí.

*(Na mesma corrida, `isOver()` continuou falso até o equivalente a ~102 minutos.
Isso não tem explicação benigna e está anotado em `reports/video/indice.json` —
uma corrida só, não confirmado, não é diagnóstico.)*

## C5 · Não dê a um arquivo Python o nome de um módulo da biblioteca

`tools/dossie/csv.py` fez `import csv` importar a si mesmo:
`module 'csv' has no attribute 'writer'`. Hoje é `tabelas.py`.

## C6 · Playwright: pegue o caminho do vídeo pelo handle

Varrer o diretório atrás do `.webm` pega um arquivo ainda não liberado e grava
um clipe de **0 byte**. Use `page.video().path()`, e só depois de `ctx.close()`.

---

# D · O processo

## D1 · Não declare o veredito antes de a bateria responder

Já escrevi “métricas idênticas” em `ESTADO.md` com a medição ainda rodando, e já
marquei o D11 como **✅ feito** no catálogo e no documento **antes** do veredito
— que veio dividido: aprovado no portão, reprovado no placar de design.

Estado enquanto mede é `medindo`, não `feito`.

## D2 · Não rode `verify.py` com uma bateria medindo

`verify.py` **reconstrói o `dist/`**. Uma linha de base inteira foi contaminada
assim e teve de ser descartada.

## D3 · Não commite uma ferramenta que você não rodou

Commitei um `pdf.py` com um parêntese sobrando. A seção 2.4 do meu próprio
documento proíbe exatamente isso.

## D4 · Renderize e olhe

Quatro defeitos de layout — gráficos colidindo com o rodapé, rótulo saindo do
canvas, capa cobrindo o índice, índice capturando comentários de dentro de
blocos de código — só apareceram **abrindo o arquivo**.

E eu escrevi que a tarja preta do D24 era nas laterais. **É em cima e embaixo.**
A porcentagem estava certa, o eixo errado. Descobri olhando a foto que eu mesmo
gerei. O validador confere cor, não geometria.

## D5 · Um patch que inclui arquivo gerado mente sobre o tamanho da mudança

O patch do D11 saiu com **+5314 linhas** porque o commit levou junto as fichas e
o PDF. Filtrado para `src/` e `tools/`: **+61 −24**. Uma mudança aceita aqui tem
60 a 200 linhas — e é isso que o exemplo precisa mostrar.

---

## O denominador comum

Vinte das vinte e três são a mesma coisa dita de ângulos diferentes:

> **O que o código sugere não é o que o programa faz.**

Com 362 sobrescritas, o comportamento observável é o topo da pilha, não o texto
que você está lendo. Daí a regra que vale mais que todas:

> Marque toda afirmação com `[LIDO]`, `[MEDIDO]` ou `[HIPÓTESE]` — e nunca deixe
> uma `[HIPÓTESE]` virar `[MEDIDO]` sem passar pela bateria.

**Resultado negativo é resultado.** Sete premissas caíram e estão documentadas
com o mesmo cuidado das que deram certo. Se a sua medição contrariar este
documento, **escreva isso** — não ajuste a conclusão para caber na hipótese.
