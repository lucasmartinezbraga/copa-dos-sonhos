# Briefing para quem continuar

Escrito para ser colado inteiro num modelo novo. Não presume nada da sessão
anterior.

---

## 1. O que é o projeto

Simulador de futebol num único HTML autocontido. `dist/index.html` é **gerado**,
nunca editado à mão: `tools/build.py` remonta o bundle a partir de `src/`
guiado por `manifests/build-manifest.json`.

O bundle é uma pilha de ~80 blocos `<script>`. O primeiro grande é o **core**
(9 módulos em `src/scripts/`); os outros são **camadas** em
`src/scripts/layers/`, cada uma envolvendo métodos de `MatchSim.prototype` com
o padrão `const old = P.metodo; P.metodo = function(){...}`.

**A ordem do documento decide quem roda por fora de quem.** Isso não é detalhe
de estilo — é a causa-raiz de mais de um defeito real. A camada mais nova é a
mais externa.

Antes de qualquer commit:

```bash
python3 tools/build.py     # regenera dist/index.html
python3 tools/verify.py    # sintaxe e reprodutibilidade de todos os blocos
node tests/browser_smoke.js  # prova que o jogo SOBE num Chromium de verdade
```

---

## 2. A regra que vale mais que qualquer outra

**Mudança sem número não é entrega, é dívida.** Este código já foi calibrado
contra alvos de design, e mexer no motor "porque faz sentido" quebra coisa que
ninguém estava olhando.

```bash
node tools/fisica/bateria.js --build=dist/index.html --matches=96 --workers=8 \
  --out=reports/minha-medicao.json
python3 tools/fisica/placar.py reports/minha-medicao.json
```

O placar pontua 13 métricas contra `calibration/targets.json`. **A linha de
base é 12/13 com 96 partidas.** Se sua mudança derruba isso, ela não está
pronta — não importa quão certo esteja o diagnóstico.

E: **sempre meça o controle no MESMO tamanho de amostra.** Comparar 48 contra
96 partidas produz conclusão errada. Aconteceu comigo: uma dose parecia
11/13 com 48 partidas e era 9/13 com 96.

### O que a bateria NÃO vê

Ela pula o bloco `cds-ux-boot` (`bateria.js:65`), que é onde moram a ponte de
animação e o desenhista. **Nada de apresentação aparece na bateria.** Para isso
existem as sondas de tela, que sobem o jogo de verdade com
`window.__quickMatch(40, 120)`:

| ferramenta | o que mede |
|---|---|
| `tools/fisica/tela/gestos.js` | quais estados de animação chegam a ser desenhados |
| `tools/fisica/tela/gesto-perdido.js` | **onde** um gesto morre: pedido / recusado no tier / entrou e foi sobrescrito |
| `tools/fisica/tela/passada-parada.js` | salto e tremor da posição **desenhada** |
| `tools/fisica/tela/cerimonia.js` | pose contra movimento na bola parada |
| `tools/fisica/tela/validar-lances.js` | 16 invariantes de falta, roubada, lateral e pontapé |

---

## 3. Armadilhas de medição que já custaram caro

Todas me pegaram nesta sessão. Cada uma produziu um número convincente e
errado, e nenhuma dá erro — falham em silêncio.

1. **`CDS_F25D` é `Object.freeze`.** Trocar um método dentro dele falha sem
   avisar; a sonda reporta zero com o jogo desenhando normalmente. Troque o
   objeto inteiro: `window.CDS_F25D = Object.assign({}, window.CDS_F25D)`.

2. **O botão de velocidade entra na conta.** Entre dois quadros desenhados
   passa `parede × G.speed` de tempo de jogo. Medir salto com tempo de parede
   cru a 6× acusou 38% de teleporte que era só avanço rápido.

3. **Geometria não pega a saída de bola.** O motor detecta e resolve no mesmo
   passo. Observar `ball.y` na borda contou 1 lateral em 61 min; a bateria mede
   16 por partida. Use o evento (`throw_in`) e o envelope (`_ballOut`).

4. **A marca do batedor morre antes da cobrança.** As camadas de espera limpam
   `__cdsTakerWait` assim que ele chega, e só depois `dead` expira. Medir por
   ela devolve **zero amostra** — não "tudo certo", zero. Lembre o último.

5. **`_setPieceRole` não identifica a barreira.** Marca zona e marcação
   também. A barreira está em `__os36Guard.wall`. E meça **na cobrança**: desde
   a R18.99 ela caminha até os 9,15 m. Medindo na criação, acusei "barreira a
   0,29 m" que não existe — o valor real é 9,54 m.

6. **Confirme a forma do objeto antes de filtrar por ela.** `_bestPass`
   devolve `{m, score, proj, dist, progressM, risk, intoBox, ...}` — **não tem
   `target`**. Testei `best.target`, rejeitei 100% em silêncio, e a bateria deu
   números idênticos à base. Parecia "sem efeito colateral"; era "sem efeito
   nenhum".

7. **Número idêntico à linha de base geralmente significa que sua camada não
   rodou.** Desconfie antes de comemorar.

---

## 4. Padrão de defeito que se repete neste código

Vale procurar ativamente, porque já apareceu em três andares diferentes:

> **Um conceito é escrito, é lido, e não pode acontecer.**

- 8 estados de animação declarados e desenhados que nunca viravam quadro —
  três deles eram *pedidos* e atropelados no mesmo tier (OS-210).
- `firstTime` em `_evaluateShotDecision:954` só é calculado dentro de
  `_decide`, que só roda com `settle <= 0` — logo é **sempre falso** (OS-212).
- A correção de velocidade da R18.99/T7 é aplicada quatro níveis por fora da
  ponte de animação, então a animação nunca a vê (OS-207).

Quando encontrar um, **instrumente os três pontos** (pedido → entrada →
efeito) antes de propor conserto. Foi assim que descobri que minha hipótese de
"barrado pelo tier" estava errada: nenhum dos oito era.

---

## 5. Estado atual

Branch `claude/falta-escanteio-animation-bug-97xwj4`. Bateria **11/13** com a
OS-212 ligada; **12/13** sem ela.

Entregue e medido:

- **OS-207** — animação amostrada depois de todos os escritores de posição.
  "Desenhado parado e deslizando" 316 → 0; "correndo e parado" 10.617 → 0.
  Física idêntica campo a campo.
- **OS-208** — o corpo não teletransporta no desenho. Salto na bola morta
  58,2% → 34,5%.
- **OS-209** — chave de desenho qualificada por time (homônimos dividiam
  passada e balanço).
- **OS-210** — gestos que entravam e não viravam quadro: `gk_kick`,
  `gk_throw`, `first_touch_pass`, `placed_shot`.
- **OS-212** — toque de primeira, **ligado por decisão do dono**. Custa
  `onTargetRate` (0,344 → 0,324) e vermelhos (0,25 → 0,34); devolve `drawRate`
  e `zeroZeroRate` à faixa.

Validação por invariante (não por média — média esconde lance quebrado):

```
FALTA     F1 22/22 · F2 22/22 · F4 3/3 (9,54 m) · F5 22/22 · F3 21/22 · F6 19/22
ROUBADA   R1 52/52 · R2 14/14 · R4 10/10 · R3 36/46 (78,3%)
LATERAL   L1..L5 todos 22/22   <- íntegro
```

---

## 6. Fila aberta, por ordem de evidência

1. **Time espalhado no pontapé após o gol** — relatado pelo dono e confirmado:
   `G1 0/5` (nenhum pontapé com os dois times na própria metade, 4,2 jogadores
   do lado errado), `G2 0/5` (19,27 m médios do posto de formação).
   **Tentei e falhei**: alongar a janela de caminhada (OS-211) derrubou a
   bateria para 10/13 **e não corrigiu** — G1 seguiu 0/4. Revertida.
   *Causa provável*: o sistema tático roda a 100% durante a bola morta e desfaz
   a volta para casa. É o **mesmo cabo-de-guerra** da OS-207: `freeze` é um
   degrau em `dead = 0.4` e as camadas de espera o mantêm desligado segurando
   `dead = 0.12`. A bugadinha da falta e o time espalhado são o mesmo defeito
   visto de dois lugares. Exige rodada de calibração própria — já reprovou uma
   vez.

2. **R3: 24% de quem é desarmado não ganha gesto de perda** (36/46).

3. **`gk_smother` entra 3–5× e nunca vira quadro**, em três rodadas seguidas.
   É o único dos oito gestos que sobrou.

4. **F6: 3 batedores em 22 saltam na cobrança** — o snap de
   `snapTakerBeforeRestart` escapa do orçamento da R18.99 por duas exceções (o
   quadro do reinício termina com `dead <= 0`, e saltos acima de 2,5 m são
   tratados como recolocação administrativa).

5. **Afinar a OS-212** se o dono quiser mais fluidez. O eixo que mais morde é
   `NOTA_MIN` (hoje 2,80); depois `HABILIDADE` (82) e `PRESSAO` (3,8). A
   varredura inteira está no cabeçalho da camada.

---

## 7. Como o dono trabalha

Ele reporta por sensação — "bugadinha", "espalhado", "quero sentir fluidez" —
e **está certo todas as vezes**. Traduza a sensação em invariante medível antes
de escrever código; a sonda quase sempre acha mais do que ele descreveu.

Ele aceita "não consegui" com o número do lado. Não aceita — e não deve —
número que você não conferiu.
