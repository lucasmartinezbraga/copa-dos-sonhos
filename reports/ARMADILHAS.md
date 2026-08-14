# As armadilhas deste código

**Trinta e oito.** Cada uma custou pelo menos uma rodada de medição de 25
minutos; várias custaram mais. Estavam espalhadas por `CLAUDE.md`, pelo Volume
VIII‑A do relatório, pelos laudos e pelos comentários do código.

Se você só vai ler uma página antes de tocar neste código, leia esta.

Elas estão em quatro grupos, porque erram por motivos diferentes:

| grupo | o que engana | quantas |
|---|---|---|
| **A · a pilha de camadas** | o código que você lê não é o que executa | 7 |
| **B · a medição** | o número existe e mede outra coisa | 15 |
| **C · as ferramentas** | a ferramenta funciona e mente | 8 |
| **D · o processo** | você mesmo, com pressa | 6 |

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

## A6 · A camada reimplementa o método inteiro e repete a constante

`_integrate` existe no motor **e** na camada 16, cada um com a sua cópia de
`staminaF = 0.7 + stamina/100 * 0.3`. Editei a do motor, reconstruí, rodei o
funil de 32 partidas: **idêntico ao dígito.** 0,913 de velocidade, 0,613 em
alcance — os mesmos três dígitos de antes.

A `pilha.js` responde **VIVA** para `_integrate` e está certa: o método roda. A
linha não. **Sétima vez neste projeto.**

Existe detector agora:

```bash
python3 tools/auditor.py --forma 1
```

Ele aponta a constante duplicada e o método em que ela mora. Rodando hoje,
achou um segundo caso que ninguém conhecia: a velocidade de chute
`34 + shot/100*16` mora no core **e** na camada 14, e as duas precisam
concordar para o cálculo de interceptação bater com o chute real.

## A7 · Dezesseis arquivos de `src/` não entram no build

`src/styles/85-match-mobile-field-first.css` tem nome de código-fonte, mora ao
lado do código-fonte e **não está no manifesto**. Editei ele para consertar a
tela de celular, reconstruí, medi: **nada mudou.** A regra viva era uma cópia
dentro de `src/styles/layers/02-inline.css`.

São **dezesseis**: os quinze `src/styles/*.css` fora de `layers/`, mais
`src/scripts/00-head-bootstrap.js` — que o `CLAUDE.md` lista como **módulo nº 1
do motor**.

O `CLAUDE.md` diz *"editar `src/styles/` para CSS"*. Isso é verdade para
`src/styles/layers/` e mentira para os outros quinze.

`tools/verify.py` agora lista todos, a cada build. Não reprova — são
pré-existentes e removê-los é outra decisão — mas passou a ser impossível não
ver.

> É a A1 em CSS: a cópia que executa não é a que você abriu.

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

## B8 · Detector sem teste contra positivo conhecido é detector calado

Escrevi o `auditor.py` para achar a A6 automaticamente. Ele respondeu
**"nada"** — com o caso na frente dele. Três causas, todas minhas, todas no
mesmo dia:

1. o regex não aceitava vírgula, e a camada escreve `finite(p.stamina,75)`;
2. a forma 3 procurava `ritmoPorFaixa` na raiz do JSON, e ela mora sob `fisica`
   — devolvia lista vazia, indistinguível de "está tudo bem";
3. a forma 3 comparava **totais** por faixa, e a faixa 46‑60 recebe mais
   simulação: a série do D19 deixava de parecer monótona (a armadilha B3, de
   novo, contra mim).

O mesmo modo de falha do portão do D11: **uma verificação que nunca reprovou
nada não está testada, está calada.**

Por isso `tests/auditor_test.py` e `tests/regressao_design_test.py` existem, e
por isso os dois exigem as duas metades:

> aponta o caso conhecido **e** cala depois do conserto.

Detector que aponta sempre vira ruído, e ruído ninguém lê.

## B9 · Foto transversal lida como filme — o erro que criou o D20

`forma.js` mede, no mesmo instante, o bloco do time **que ataca** e o do time
**que defende**. São **dois times diferentes**. A diferença entre os dois
números (41,0 − 38,2 = 2,8 m) foi lida como *"quanto o time encurta ao perder a
bola"* — que é uma pergunta **longitudinal**: o mesmo time, antes e depois.

Medido do jeito certo (`ramo-transicao.js`, 32 partidas, ~20 mil amostras por
faixa, seguindo o **mesmo** time após a perda):

| desde a perda | 1º tempo | 2º tempo |
|---|---|---|
| 0–0,5 s | 42,6 m | 40,2 m |
| 2–3 s | 36,3 | 35,0 |
| 4–6 s | **33,6** | **33,2** |
| **encurtamento** | **9,0 m** | **7,0 m** |

**A recomposição existe e é de futebol de elite: ~9 m em ~4 s.** O D20 — "o
bloco não compacta, encurta 0,4 m" — descrevia um defeito que não existe, e
custou três tentativas de conserto e quatro baterias de 300 partidas.

> Antes de tratar uma diferença como *mudança*, pergunte: **é a mesma coisa
> medida duas vezes, ou duas coisas medidas uma vez?**

## B10 · As seis faixas de 15 minutos não têm 15 minutos

Medido em 96 partidas, lendo `sim.minute`:

| faixa | min de jogo por partida |
|---|---|
| 0–15 · 16–30 · 31–45 · 61–75 | **15,00** |
| **46–60** | **18,70** |
| **76+** | **21,14** |

O 76+ é aberto, então ser maior é esperado. O **46–60 é maior porque os
acréscimos do 1º tempo caem nele** — o minuto 45,0–48,7 tem índice de faixa 3.

O histograma de gols do projeto — o número que sustenta o D19 e aparece em todo
laudo — comparava percentuais **brutos** entre essas faixas. O erro anda nos dois
sentidos: **inventa** um pico no 46–60 (18,1% brutos → 15,7% por minuto) e
**disfarça** a queda do 76+ (14,7% → 11,3%). A razão início/fim vai de 1,36× para
**1,92×**: o D19 estava subestimado.

Corrigido: `bateria.js` mede `minutosDeJogoPorPartida` por faixa e
`futebol_real.py` publica as duas colunas.

> Irmã da **B3**. Lá era faixa aberta comparada por total; aqui é faixa fechada
> que não tem o tamanho que o nome diz. **Meça a largura do balde antes de
> comparar o que cabe dentro dele.**

## B11 · A métrica melhorou 4× e o jogo quebrou

O D24 media a tarja preta em 31,8% / 22,3% / 28,2% / 46,0% do quadro. Corrigi a
proporção do mundo lógico para a do campo real e a métrica caiu para
**8,2% / 11,5% / 7,6% / 27,3%**. Build, verify e smoke em Chromium: **todos
passaram.**

A captura mostrou o gramado virado num **trapézio torto**, com um gol só em
quadro e a perspectiva escapando pela direita.

A proporção 2,048 não era descuido de CSS: é **constante calibrada do palco
2.5D**. `R0 = 0,72` (largura distante/próxima), `topY = M+34` e `bottomY = CH−3`
foram afinados para a faixa de 451 px que `CH = 500` produz. Com 624 px a mesma
razão espalha a perspectiva por 38% mais altura e desmonta a cena.

E o instrumento estava cego **duas vezes**:

1. media só a tarja **vertical** — esticar o canvas na altura "consertaria" o
   defeito criando tarja **lateral** invisível para ela (depois da mudança,
   1920×1080 ficou 0% vertical e 8% lateral);
2. media dentro do **elemento canvas**, não do quadro que o jogador vê — daria
   para zerar sem melhorar nada.

> Nenhum portão automático deste projeto teria pegado isso. **Só a captura.**
> Quando a métrica melhora muito e a mudança é de render, a captura não é
> confirmação: é o teste.

## B12 · Há um terceiro placar, e ele também não é vigiado

`aceitar.sh` olha as **14 métricas agregadas** e, desde o D11, o **placar de
design** (13 métricas). Ninguém olha o **placar do futebol real** (21 métricas).

No D22 isso apareceu: a mudança passou nos dois portões e mesmo assim custou
uma métrica.

| | referência | com a mudança |
|---|---|---|
| acertoAoAlvo | 0,320 | 0,331 (alvo era ≥ 0,34) |
| **golPorChuteNoAlvo** | 0,379 ✅ | **0,382** ❌ (teto real 0,38) |
| **futebol real** | **15/21** | **14/21** |

O portão de design não reclamou porque `onTargetRate` **já estava fora** — e a
regra dele é "não deixar sair", não "não piorar".

> Cada portão novo fecha um buraco e revela o próximo. Antes de aceitar,
> **rode os três placares**, não os dois automáticos.

## B13 · O jogo pode estar apoiado no defeito — e aí consertar REPROVA

O **D35** era um bug indefensável: a camada 17 armava o cobrador de lateral com
`_breaking = {throwInDuty:true}`, sem `t`, e `undefined - dt = NaN` nunca
satisfaz `t <= 0`. A marca não saía mais. Seis dos vinte jogadores de linha
terminavam a partida assim, e **902.014** chamadas de `_integrate` recebiam alvo
NaN.

O conserto é trivialmente correto e as invariantes provam: **220.103 alvos NaN
→ 0**. Em 300 partidas pareadas ele **reprovou**:

| | antes | depois |
|---|---|---|
| **offsides** | 5,167 | **1,043** |
| shots | 23,710 | 19,990 |
| goals | 2,877 | 2,380 |
| zeroZeroRate | 0,080 | **0,167** (4,03 SE) |

Placar de design **12/13 → 9/13**.

**Por quê:** entre os oito efeitos permanentes do bug estava a **isenção do teto
de impedimento**. Os envenenados atacavam as costas da linha sem freio e ficavam
16 m à frente da bola — e era isso que produzia os chutes, os escanteios e os
gols. Removido o bug, **nada** manda ninguém para frente: os impedimentos caem
para 1,04 por partida, quando o futebol de elite tem 4–8.

O que fazer quando isto acontecer:

1. **Não force a entrada** e não invente uma variante só para passar no portão.
2. **Não deixe o bug catalogado como "feito"** — ele volta a `aberto`, com a
   medição da tentativa anexada, para o próximo não repetir a rodada.
3. Identifique o que estava **de pé em cima** do defeito e trate os dois como um
   **par obrigatório**. É a única exceção conhecida à **B5**: separados, o
   conserto reprova por construção.

> É a **A5** em escala grande — lá era um veto de 1,15 s, aqui é o volume
> ofensivo inteiro — e a **A2 do goleiro** invertida: lá aumentar um recurso
> piorou o jogo, aqui **remover um defeito** piorou. As três dizem a mesma
> coisa: o modelo está usando o recurso pelo motivo errado.

## B15 · "Morto" é uma afirmação sobre a amostra, não sobre o código

`pilha.js` conta chamadas. Zero chamadas em 4 partidas é zero chamadas **em 4
partidas** — não é código morto.

Medido na camada 07 (`physics-timeline-581`), em 2026-08-13:

| partidas | sobrescritas mortas |
|---|---|
| **4** | **12** |
| 12 | 11 |
| 24 | 11 |

O método que muda de lado tem nome: **`_continueTravel`** — morto com n=4, vivo
com n=24. Quem apagasse com a evidência de uma rodada curta removeria um método
vivo do caminho da bola em voo.

A regra do D34 (**300 partidas antes de apagar qualquer coisa**) não é excesso de
zelo: estabilizar em 24 não prova nada sobre o caminho que aparece uma vez a cada
20 partidas. É a **B7** aplicada à liveness — o erro-padrão não some porque o
número que você está olhando é um contador.

## B14 · A conversão está encostada no teto — e isso restringe tudo

`golPorChuteNoAlvo` mede **0,379** contra um teto real de **0,38**. Um
milésimo. Não é acaso: a A2 o trouxe de 0,428 para 0,378 ao consertar o
goleiro, e ele ficou colado no limite.

**Qualquer mudança que acrescente gols sem acrescentar chutes quebra o placar do
futebol real.** Foi assim que a fadiga achatada (D19) caiu: chutes parados
(23,71 → 23,52), xG parado (3,013 → 2,988), gols subindo (2,877 → 3,073). O
jogador cansado mais rápido não penetra mais — ele converte melhor, e conversão
é o único lugar sem espaço.

Antes de propor qualquer coisa que "faça o time marcar mais", pergunte de onde
vem o gol. Se não vier de chute a mais, ele vem de conversão, e a conversão está
cheia.

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

*Na mesma corrida eu “achei” que `isOver()` continuava falso aos ~102 minutos.
**Era a armadilha C1 me mordendo:** eu convertia `sim.t * clockRate` em vez de
ler `sim.minute`. Medido de novo — aos 195 s de parede, `minute` = **45,4**,
metade de 90 em metade do tempo. Não há anomalia; o teto de gravação é que era
curto. A retratação está em `reports/video/indice.json`.*

**Duas armadilhas na mesma corrida, e a segunda foi eu acreditando na primeira.**

## C4b · Esperar por processo corre contra a largada

`until ! pgrep -f 'bateria.js'; do sleep; done` saiu **imediatamente** — o
`aceitar.sh` ainda estava na fase de build e a bateria nem tinha subido. Eu li
o log vazio e quase reportei "a medição não produziu nada".

Espere pelo **resultado**, não pelo processo:

```bash
until grep -qE "APROVADO|REPROVADO" "$LOG"; do sleep 25; done
```

**E o remendo tem a sua própria armadilha, que eu pisei em 2026-08-13.** Tentei
`grep -qiE "guardada|FALHOU|erro"` e ele casou na linha **de sucesso** do smoke:

```
  ok    pagina carrega sem erro de script  ->  nenhum
```

O laço saiu com a bateria nos primeiros 30 segundos. Ancore o padrão: `-x` para
linha inteira, `^` para início, ou uma palavra que só exista no veredito. Um
`grep` de espera que casa cedo demais é indistinguível de um que funcionou.

## C4c · `pgrep -f` acha o próprio laço que está esperando

No mesmo dia, o erro oposto e pior:

```bash
until ! pgrep -f "aceitar.sh --antes" >/dev/null; do sleep 25; done
```

A linha de comando **deste shell** contém o texto `aceitar.sh --antes`. O
`pgrep -f` casa com ela, o laço nunca sai, e ele reportou **"RODANDO" por duas
horas e meia** depois de a bateria ter terminado. Três laços presos ao mesmo
tempo, todos mentindo a mesma coisa.

Não espere por `pgrep -f` de um padrão que você acabou de digitar. Espere pelo
**arquivo de saída**:

```bash
until [ -s reports/_aceitar-antes.json ]; do sleep 25; done
```

ou, se precisar do processo, exclua a si mesmo: `pgrep -f PADRAO | grep -v $$`.

> C4b e C4c juntas: **um laço de espera que não pode falhar de forma visível
> não é uma espera, é um travamento com narração otimista.**

## C5 · Não dê a um arquivo Python o nome de um módulo da biblioteca

`tools/dossie/csv.py` fez `import csv` importar a si mesmo:
`module 'csv' has no attribute 'writer'`. Hoje é `tabelas.py`.

## C6 · Playwright: pegue o caminho do vídeo pelo handle

Varrer o diretório atrás do `.webm` pega um arquivo ainda não liberado e grava
um clipe de **0 byte**. Use `page.video().path()`, e só depois de `ctx.close()`.

## C7 · `JSON.stringify` transforma `NaN` em `null`

A sonda do D08 imprimiu alvos assim:

```
ALVO ESTRANHO: [19.945751640673578,null]
```

e eu passei dez minutos procurando quem escrevia `null` num alvo. **Ninguém
escrevia.** `JSON.stringify(NaN)` produz `null` — e `Infinity` também. O valor
era NaN, vindo de `undefined * 9`.

Numa sonda, teste com `Number.isFinite` **antes** de serializar, e imprima o
diagnóstico com `String(v)`, não com `JSON.stringify`. A diferença entre `null`
e `NaN` é a diferença entre "alguém atribuiu" e "uma conta deu errado" — são
buscas opostas. Custou o diagnóstico do **D35**.

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

## D7 · Uma sonda que refaz a conta do alvo mede a si mesma

Em 2026-08-14, ao consertar a cadência da passada (D41), escrevi
`tools/fisica/tela/passada.js` para conferir o resultado — e dentro dela
**reimplementei a fórmula da cadência**:

```js
const cad = mv => Math.sqrt(Math.min(mv, r*1.2) / mult / Math.max(1.2, r*.16)) * .62;
```

Rodei antes da mudança: excesso de 1,98x. Troquei a fórmula na camada 21,
reconstruí, rodei de novo: **1,98x.** Idêntico ao segundo decimal, nos dois
bundles. Quase publiquei "a mudança não teve efeito".

A sonda nunca leu o bundle. Ela aplicava a fórmula VELHA, que morava nela
mesma, a valores de `mv` novos. O alvo tinha mudado e o instrumento não.

**A regra:** uma sonda só mede se o número sair de onde o defeito mora. Ou lê o
estado que o código produziu, ou observa o efeito — nunca recalcula a conta que
está sob teste. A versão que valeu põe um `Proxy` no `ctx` e lê os retângulos de
perna que o desenho de fato pinta; ela não sabe nenhuma fórmula.

**A base de comparação é parte do instrumento.** No dia seguinte, a sonda de
silhueta (`gestos.js`) reincidiu de outras duas formas:

- **ponto cego:** eu gravava `fillRect`/`arc`, mas o tronco e os dois braços são
  desenhados por `rr()`, que chama `ctx.roundRect`. Metade do corpo estava fora
  da assinatura, e a modulação de braço era invisível para a sonda que deveria
  medi-la.
- **base contaminada:** pus os cinco estados sob teste dentro da lista de
  "locomoção comum" que servia de referência. Passavam por construção — e ainda
  absorveram `protect`, que foi declarado "sem gesto próprio" por dividir o
  afastamento de pés com `strafe`. Era falso.

Parente próximo da **B8** (detector sem teste contra positivo conhecido): as
duas são o instrumento concordando consigo mesmo. E é o segundo caso desta
investigação em que a suíte respondeu com um número tranquilizador enquanto não
media nada — o primeiro foi o **D6**.

## D8 · "Rodei de novo e deu igual" com n=1 nao estabelece determinismo

Em 2026-08-14, ao medir a §D43 contra a bateria pareada, tudo bateu ao digito —
14 metricas agregadas, 73 contadores de evento — menos `ramos.defSomaP`:

```
antes:  91.31169766855994        depois: 91.31169766855996
```

Rodei o build NOVO uma segunda vez, deu bit-identico, e conclui que a diferenca
de 2·10⁻¹⁴ era da mudanca. **Errado.** Rodando o build ANTIGO uma segunda vez,
ele produziu os dois valores:

```
antes  run1: …855994      antes  run2: …855996
```

Era oscilacao de ultimo bit na ordem de soma entre partidas, presente no build
que eu nao tinha tocado.

**A regra:** para atribuir uma diferenca a uma mudanca, o **controle** tem que
ser repetido tambem. Repetir so o lado novo mede a estabilidade do lado novo, e
nao a origem da diferenca. Uma unica repeticao nao separa "deterministico" de
"deu na mesma daquela vez".

Parente da **B7** (n pequeno responde qualquer coisa), aplicada ao numero de
EXECUCOES em vez de ao numero de partidas.

## D6 · Um teste que sai com 0 sem imprimir nada passou por omissão

Em 2026-08-13 eu truquei `tools/defeitos.py` **a zero bytes** sem perceber:
um `open(p, "w")` esvazia o arquivo *antes* do `write()`, e o `write()` seguinte
falhou por um erro de tipo. O arquivo ficou vazio.

Em seguida a suíte respondeu **`8/8 passaram`** — porque
`python3 tools/defeitos.py --check` num arquivo vazio **sai com código 0 e não
imprime nada**. O portão que existe exatamente para o catálogo não virar ficção
aprovou um catálogo inexistente.

Duas lições, e a segunda vale para qualquer teste deste repositório:

1. **Nunca truncar antes de ter o conteúdo.** Escreva em temporário e
   `os.replace()`. Um `write()` que falha depois de um `open(...,"w")` destrói
   o original.
2. **Exit code não é resultado.** Um teste cujo sucesso é *imprimir* alguma
   coisa precisa que a suíte exija aquela linha. `tools/testes.sh` agora tem a
   variável `exige`, e o caso do catálogo está coberto — verificado contra o
   positivo conhecido (esvaziei o arquivo de novo, de propósito, e ele reprova).

> É a **B8** aplicada à própria suíte: detector sem teste contra positivo
> conhecido é detector calado — inclusive quando o detector é o `testes.sh`.

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
