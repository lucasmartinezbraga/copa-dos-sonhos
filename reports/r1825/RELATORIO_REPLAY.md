# R18.21-RC2 — REPLAY DE GOL

**Status: `CORRIGIDO E MEDIDO NO NAVEGADOR`**

| | |
|---|---|
| Base | `COPA DOS SONHOS - R18.21-RC1 - DEFESA PRESSAO E ECOLOGIA.html` · `ef461809b98e…` |
| Entrega | `COPA DOS SONHOS - R18.21-RC2 - REPLAY DE GOL.html` · `3b2fece8ac4a9d9cbd93d01959bc53f4bbc230a98dcb41e46650a52691b8ddb4` |
| Identidade em runtime | `CDS_BUILD_ID = 'R18.21-RC2'`, `CDS_VERSION = '5.15.1-R18.21-RC2'` |
| Motor | **inalterado** — provado, seção D |

---

## A. O que estava errado

O relatório da RC1 deixou o replay como "não corrigido", com o diagnóstico de que *"quando
existe timeline física o replay de buffer é desligado e o de timeline só é instalado se a
validação da ponte passar; se falhar, não sobra replay"*. Esse diagnóstico foi feito por
leitura, sem navegador. **Medido, o mecanismo é outro, e é pior.**

A ponte instalava o replay corretamente — cobertura de 100% dos gols, `faults: 0`,
`cueMismatches: 0`. O que nunca funcionou foi o **desenho**.

### D1 · Espaço de coordenadas (a falha fatal)

`getState()` entrega a posição **normalizada** — `x: p.x/FL, y: p.y/FW` (linha 8001) — e a
interface inteira desenha em 0..1:

```js
const cx = x => M + x*(CW-M*2);      // linha 13324
```

Mas `captureTimelineFrame` grava **metro cru** (`x: finite(p.x)`, linha ~14295). O replay
mandava os 22 jogadores para `cx(53) ≈ 53 000` — mil vezes fora da tela. O primeiro cuja
escala de perspectiva ficava negativa estourava:

```
Failed to execute 'ellipse' on 'CanvasRenderingContext2D':
The major-axis radius provided (-4.73894) is negative.
```

O `catch` do laço engolia (`__cdsDebugWarn('frame recuperada:')`) e sobrava **o gramado
vazio**: sem bola, sem jogadores, sem as barras de cinema e sem o selo `REPLAY · TIMELINE`
— que é desenhado na linha 13766, *depois* do ponto do estouro, e por isso nunca aparecia.

Acontecia em **100% dos gols de jogo aberto, uma vez por frame**. Não era intermitente: o
replay de gol por timeline física nunca funcionou desde que a ponte 5.8.2 entrou.

O replay legado por buffer não tinha o defeito — `recordSnapshot()` lê `sim.getState()`,
já normalizado. Ele só estava desligado.

### D2 · O clipe não rebobinava

```js
let i = replay.idx || 0;                                              // parte do índice ATUAL
while (i+1 < frames.length && frames[i+1].time <= elapsed) i++;       // só anda pra frente
if (i >= frames.length-1 && elapsed < frames[i].time) i = 0;          // reinício inalcançável
```

Ao dar a volta (`elapsed` zerado) o índice não voltava. A guarda de reinício exige
`i >= frames.length-1`, mas `elapsed` é zerado no instante em que passa de `duration` — que
é justamente o tempo do **último** quadro. O índice parava no penúltimo e ficava lá.

Medido na base: o clipe animava ~770 ms e congelava os ~1430 ms restantes da janela de
2200 ms. **Zero voltas em 19 gols.**

### D3 · Sem rede

Havendo timeline física, o replay de buffer era desligado *antes* de se saber se o de
timeline instalaria. Era o defeito descrito no relatório anterior — real, mas não era o
que estava quebrando na prática.

---

## B. Os três reparos

Construtor reproduzível: `auditoria/patch_replay.js`. Aborta se o SHA-256 da base não
bater e exige que cada âncora apareça exatamente uma vez.

| patch | o que faz |
|---|---|
| `d1-normaliza-quadros` | `timelineReplayFrames` divide x por `FL` e y por `FW`, pondo o clipe no mesmo espaço do resto da interface. `z` fica em metro, igual a `getState()`. |
| `d2-rebobina` | A busca do quadro parte sempre de zero (são no máximo ~26) e a volta guarda o resto em vez de descartá-lo. |
| `d3-rede` | O buffer legado é armado como rede; quando a timeline finaliza, ela o **substitui**. A cena de bola parada segue sendo o próprio replay. |
| `id-runtime`, `id-title-head` | Identidade em runtime para R18.21-RC2, e a `<title>` estática do `<head>` — parada em R18.17 — enfim corrigida. |

```bash
node auditoria/patch_replay.js --in="<RC1>" --out="<RC2>"
```

---

## C. Medição no navegador

O painel de navegador **não travava por causa das bandeiras**. Ele renderiza a página com
`document.visibilityState === 'hidden'`, e nesse estado o Chrome nunca dispara
`requestAnimationFrame` — o boot usa duplo rAF de propósito e parava em "Carregando Copa
dos Sonhos…" sem erro nenhum. `setTimeout` não é estrangulado. Com um shim de rAF sobre
`setTimeout` a build sobe inteira e joga. O harness está em `auditoria/`
(`mkdebug.js`, `lab.js`, `audit.js`).

| | RC1 (base) | RC2 (corrigida) |
|---|---:|---:|
| gols medidos | 19 | 6 |
| gols com replay instalado | 100% | 100% |
| **exceções de desenho** | **2330** (uma por frame) | **0** |
| **% da janela de replay animada** | **35%** | **98,7%** |
| voltas do clipe | **0** | 3,2 |
| **quadros distintos no canvas** | **1 de 16** | **16 de 16** |
| quadros do clipe | 14,7 | 12–15 |
| duração do clipe | 0,6 s | 0,5 s |

Os 35% da base são o índice avançando — **nada disso chegava à tela**. Prova direta: os 16
quadros capturados ao longo de um replay da base são byte a byte idênticos, e têm o **mesmo
sha256 em partidas e gols diferentes**, porque é sempre o mesmo gramado vazio.

Imagens: `auditoria/ANTES-replay-campo-vazio.jpg` e `auditoria/DEPOIS-replay-funcionando.jpg`.

---

## D. O motor está intacto — provado

Bateria pareada de 24 partidas (17 formações × 7 estilos, semente 4200000, incremento 7919),
mesma semente nas duas builds, 49 scripts carregados e 0 erros em ambas:

**0 métricas agregadas divergentes. 0 contagens de evento divergentes.**

chutes 12,208 · no alvo 4,000 · gols 2,708 · escanteios 0,917 · faltas 5,917 ·
passes 242,375 · desarmes 7,583 · laterais 4,500 — idênticos nas duas.

Bruto em `auditoria/bateria24_rc1.json` e `auditoria/bateria24_rc2.json`. O diff das duas
builds tem 54 linhas em 6 blocos ancorados, todos na camada de apresentação (linha 57,
10890–10917, 10970, 12176–12177, 23563–23564).

---

## E. O que NÃO foi feito, e é decisão sua

**O clipe cobre só o voo do chute.** `visualFrames` só é capturado enquanto a bola viaja,
então o replay começa no instante em que a bola sai do pé: 0,3–0,9 s, 8 a 26 quadros
(comprimidos a no máximo 25 pela camada R10). Não há jogada de construção — o replay agora
funciona, mas é um clipe curto em laço.

Se quiser um replay com a construção, a fonte já existe e já está correta: `replayBuf`
guarda 150 instantâneos dos 22 jogadores (~2,5 s de jogo), em 0..1, alimentado a cada frame
por `recordSnapshot()`. Dá para emendar o trecho de buffer anterior ao chute com o clipe
físico da finalização. Não fiz: muda a natureza da apresentação e o contrato P0-3 diz que a
timeline física é a fonte única. É uma escolha sua, não minha.

**Não executado:** boot mobile, matriz 17×7 completa, e os quatro gates de ecologia que já
reprovavam na RC1 — este reparo não os toca (o motor é idêntico).
