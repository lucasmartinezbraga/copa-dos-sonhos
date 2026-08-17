# OS-232 · O time volta para casa antes do pontapé

**Relato do dono:** *"depois que rola o gol o jogo começa do nada com os
jogadores espalhados no campo"*.

Reportado há muitas rodadas, tratado duas vezes, **nunca fechado**: a sonda
seguia medindo `G1 0/4` e `G2 0/4`, com atleta a 46–77 m do posto. Acontece a
cada gol, ~3 vezes por partida.

---

## 1. As duas tentativas anteriores, e o que cada uma acertou

**OS-211** supôs que faltava tempo e abriu a janela. Reprovada duas vezes: a
bateria caiu e — decisivo — **não corrigiu**. `G1` seguiu 0 de 4.

**OS-214** concluiu, corretamente, que o problema era **cabo-de-guerra**: o
sistema tático puxa cada jogador de volta para a bola enquanto a máquina de bola
parada o puxa para o posto. Virou o **escritor final** e dissolveu a disputa.

A OS-214 estava certa e mesmo assim o dono continuou vendo o defeito. Faltavam
duas coisas — e as duas são a mesma que a OS-231 acabou de achar no escanteio.

---

## 2. Gargalo 1 — a janela nunca pagou a volta

`tools/fisica/tela/volta-para-casa.js`:

```
precisava     média 19,7 m   pior 59,7 m
ficou         média 13,3 m   pior 37,0 m
fora de casa  11 de 22 no instante do pontapé
janela        2,85 s
```

A 6,44 m/s, 2,8 s pagam **18 m**. Voltar da área adversária são **60**. Nenhuma
dissolução de disputa faz um corpo andar 60 m num orçamento de 18.

**E o motivo de a janela nunca ter crescido é uma medição errada.** A própria
OS-214 registra que 4,0 s foi reprovada por `blowoutRate 0,198` contra teto de
0,19 — medido a 96 partidas. Só que o **controle**, sem alteração nenhuma, mede
`blowoutRate` 0,156 a 96 partidas e **0,198 a 288**. O número que barrou a
correção era o número da linha de base (briefing, armadilha 9).

Correção, igual à do escanteio: quem volta **corre** (1,38 × `maxSpd`, contra
0,92 da caminhada — teto de sanidade é 1,6×) e a janela é dimensionada pela
volta mais longa, com teto de 7 s.

## 3. Gargalo 2 — a volta era para o lugar errado

Com a janela dimensionada, o resultado ficou **inconsistente**: alguns pontapés
saíam com 2 de 22 fora de posição, outros com 11. A sonda passou a registrar a
janela **pedida** ao lado da usada:

```
precisava(máx)   ficou(máx)   fora   janela  PEDIDA
    63,8           37,4       11/22   3,68s   3,59s   <- pediu pouco
    61,2           34,3        2/22   7,00s   6,86s   <- pediu certo
```

Mesmo pontapé, dois comportamentos. A diferença é **de que alvo se estava
falando**: `posto()` prefere `p.__spTarget`, e no pontapé depois do gol esse
alvo é **lixo do lance anterior** — a barreira da falta, o poste do escanteio,
o apoio do lateral. Quem carregava alvo velho era levado até ele em vez de para
casa, e a janela era dimensionada pela distância ao alvo **errado** (que era
perto), fechando cedo.

Preferir `__spTarget` está certo na bola parada, onde ele é o posto do lance.
No pontapé, **a casa ganha**.

---

## 4. Estado medido

### Tela — `volta-para-casa.js`, 8 pontapés

| | antes | OS-232 |
|---|---|---|
| distância média ao posto no pontapé | 13,3 m | **2,2 m** |
| fora de casa (> 6 m) | 11 de 22 | **1,6 de 22** |
| janela de bola morta | 2,85 s | 6,24 s |

O 1 que resta é o **batedor**, parado no círculo central — que é exatamente
onde ele deve estar. A sonda mede distância à casa da formação, então ele
sempre aparece "fora".

### Bateria pareada, 288 partidas

| métrica | controle | OS-232 |
|---|---|---|
| `goalsPerMatch` | 2,979 | 3,07 |
| `foulsPerMatch` | 22,07 | 22,27 |
| `yellowsPerMatch` | 4,41 | 4,39 |
| `redsPerMatch` | 0,243 | **0,306** (teto 0,30) |
| `blowoutRate` | **0,198** (teto 0,19) | 0,184 |
| `averageEndingStamina` | 64,59 | 64,16 |
| **placar** | **10/13** | **10/13** |

Paridade com o controle: troca `blowoutRate` (que entrou na faixa) por
`redsPerMatch` (que saiu por 0,006).

**Esse cruzamento é ruído, e a confirmação a 576 partidas fecha o assunto:**

| métrica | controle 576 | OS-232 576 |
|---|---|---|
| `redsPerMatch` | 0,269 | **0,267** |
| `goalsPerMatch` | 3,04 | 3,08 |
| `foulsPerMatch` | 22,35 | 22,16 |
| `yellowsPerMatch` | 4,53 | 4,39 |
| `zeroZeroRate` | 0,083 | 0,073 |
| `blowoutRate` | 0,193 | 0,198 |
| **placar** | **10/13** | **10/13** |

Vermelho fica **idêntico** (0,269 contra 0,267). O 0,306 de 288 era amostra: o
próprio controle vai de 0,243 (288) para 0,269 (576) sem que nada mude no
código. Faltas e amarelos seguem parados nos dois. Medições em
`reports/controle-576.json` e `reports/os232-576.json`.

O fôlego continua **congelado** durante a janela, então a pausa maior não vira
descanso de graça — foi assim que a OS-211 mexeu no placar sem mexer no futebol.
E `dead` não avança `sim.minute`: a pausa não tira nenhum futebol da partida.

---

## 5. O padrão, pela sexta vez

As três ordens seguidas — OS-229, OS-231, OS-232 — são o mesmo defeito em três
lugares:

> **Alguém precisa estar num lugar, o orçamento não paga a ida, e o motor o
> teleporta.**

E o conserto tem sempre a mesma forma: descobrir *qual* orçamento está apertado
(medindo a aproximação quadro a quadro, não supondo), e então dar **velocidade**
antes de dar tempo — porque tempo de bola morta muda futebol e velocidade não.

---

## 6. Itens abertos

* `redsPerMatch` na borda (0,306 / teto 0,30) — ver §4, confirmação a 576.
* `cornersPerMatch` 13,3 contra teto 11,5 — anterior a estas ordens.
* `onTargetRate` 0,31 contra piso 0,34 — custo declarado da OS-212.
* `atleta_congelado_20s` aparece de forma intermitente na varredura de sanidade
  (9–13 ocorrências em algumas partidas, zero em outras, no controle também).
  Próximo alvo.
