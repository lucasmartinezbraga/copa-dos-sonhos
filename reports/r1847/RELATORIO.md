# R18.47 — PROGRESSÃO CENTRAL: mecanismo confirmado, e o volume de chutes era contabilidade

**Status: NÃO PROMOVIDA.** O mecanismo está certo e o ganho é grande (+56% de
oportunidades de chute), mas a rodada revela que a produção ofensiva honesta do
motor é muito menor do que os gates faziam parecer.

Baseline R18.44 (`8466fd7bf6b9`) · Patch `tools/r1847/patch_progressao.js`
Diagnóstico: `tools/r1847/diag_progressao.js`

---

## A. Duas hipóteses, e a medição escolheu

A R18.46 estabeleceu que o volume de finalização é limitado por **oportunidade**
(8,42 avaliações de chute por partida contra 14,75 cruzamentos), não por limiar de
decisão. Faltava saber por quê. Duas hipóteses concorrentes:

- **(a)** o ataque é **roteado** para o lado e nunca chega ao centro;
- **(b)** o ataque chega, mas o cruzamento tem saída barata e **aborta** a jogada.

Medido na R18.44, n=48, s1:

| | valor |
|---|---:|
| posse do portador no terço final — **central** | **87,8%** |
| posse do portador no terço final — lateral | 12,2% |
| `adv` médio do **chute** | 89,24 |
| chutes vindos do corredor lateral | 2,87% |
| `adv` médio do **cruzamento** | **76,46** |

**(a) está falsificada.** Quando o portador chega ao terço final, ele chega pelo
centro e chuta. O ataque não é roteado para o lado.

E o número que não fecha por si aponta (b): o cruzamento sai de `adv` **76,46** —
antes da linha de 78 que `_canCross` exige no bundle base.

## B. O mecanismo

O bloco `cds-r122` (~linha 16242) sobrescreve `_canCross` e **adiciona** um termo:

```js
const oldCanCross=P._canCross;
P._canCross=function(o){
  const adv=..., wide=o.y<27||o.y>FW-27;
  return oldCanCross.apply(this,arguments) || (adv>57 && wide);
};
```

O base pedia `adv>78 && (y<20||y>FW-20)`. O termo adicionado pede `adv>57` com
faixa de 27 m — e com `FW=68`, "central" passa a ser apenas `y` de 27 a 41.
Resultado: **cruzamento disponível a partir de 48 m do gol, em 79% da largura do
campo.** Um cruzamento de 48 m do gol não é cruzamento, é bola longa — e ele
encerra a posse antes que ela chegue ao centro do terço final, que é exatamente de
onde os chutes saem.

Há ainda um **segundo** sítio de cruzamento no override de `_decide` do mesmo bloco
(p entre 0,17 e 0,40, com espera de 1,65 s), também condicionado a `_canCross`.
Consertar `_canCross` fecha os dois de uma vez — razão de patchar ali e não em cada
sítio.

## C. O conserto funciona, e a cadeia causal se comprova

Restaurando `adv>80` e faixa de 20 m no termo adicionado (o termo do base fica
intacto):

| | R18.44 | R18.47 | Δ |
|---|---:|---:|---:|
| `cross` por partida | 14,75 | **3,75** | −75% |
| **situações de chute** | 8,42 | **13,12** | **+56%** |
| `shot_taken` | 5,81 | **8,62** | **+48%** |
| `shot_deferred` | 2,60 | 4,50 | +73% |
| posse no terço final | 8,01% | **12,43%** | +55% |
| `adv` médio do cruzamento | 76,46 | **86,43** | posição real |
| `low_cross_shot` | 6,75 | 1,48 | −78% |

Menos cruzamento de longe → mais posse sobrevive ao terço final → mais avaliações
de chute → mais chutes reais. A cadeia é exatamente a prevista no cabeçalho do
patch, escrita **antes** de medir.

## D. E reprova em 3 bases

| métrica | faixa | s1 | s2 | s3 | mediana | |
|---|---|---:|---:|---:|---:|---|
| gols | 2,4–3,2 | 1,813 | 1,917 | 2,104 | **1,917** | reprova 0/3 |
| xG | 1,8–2,7 | 1,551 | 1,574 | 1,565 | **1,565** | reprova 0/3 |
| chutes | 17–27 | 11,19 | 11,56 | 11,54 | **11,54** | reprova 0/3 |
| no alvo | 6–10 | 3,50 | 3,90 | 3,44 | **3,50** | reprova 0/3 |

Medi três bases porque o efeito em `ECO-01` (−27% em s1) cabe **dentro** da banda de
ruído declarada do gate (30%) — com uma base só eu não teria direito de concluir.

## E. O achado, e ele é desconfortável

**O volume de chutes do jogo era em boa parte contabilidade.** O rasteiro de 25 m
contava como finalização e valia `pGoal` 0,204. Removidos ~11 cruzamentos profundos
por partida, saem ~5,3 finalizações falsas (≈1,08 de xG) e entram ~2,8 reais
(≈0,35 de xG). Daí o total cair de 14,60 para 11,54 e o xG de 2,475 para 1,565.

Isso estava previsto e registrado no patch antes da medição. A consequência é a
parte nova:

**A produção ofensiva honesta do motor é ~1,57 de xG por partida — cerca de 58% do
futebol real (~2,7).** Os 2,475 da R18.44 dependiam do caminho de preço inflado. O
jogo está bem mais longe do futebol real do que qualquer gate mostrava, porque os
gates mediam o resultado do defeito.

Para chegar a 2,4–2,7 de xG honestamente são necessários ~22–25 chutes a 0,108. O
motor agora entrega 11,5, com oportunidades saturando em ~13,3. **As oportunidades
precisam praticamente dobrar de novo.**

## F. Combinar com os patches anteriores não fecha a conta

| stack | gols | xG | chutes | sit. chute | xG/chute |
|---|---:|---:|---:|---:|---:|
| R18.44 | 2,500 | 2,475 | 14,60 | 8,42 | 0,1695 |
| R18.47 progressão | 1,813 | 1,551 | 11,19 | 13,12 | 0,1386 |
| + volume 0,58/0,45 | 1,667 | 1,535 | 12,21 | **13,29** | 0,1257 |
| + volume + rasteiro 1,90 | 1,354 | 1,307 | 11,88 | 13,00 | **0,1101** |

O patch de volume da R18.46 **passou a funcionar** com mais oportunidades
disponíveis (`shot_taken` 8,62 → 9,25), confirmando que ele saturava por falta de
chutes adiados. Mas o ganho é marginal e as oportunidades saturam em ~13,3
independentemente do que se faça a jusante. O stack completo dá o xG/chute mais
honesto de toda a linhagem (**0,1101**, contra ~0,108 do futebol real) e o pior
placar (1,354 gols).

## G. O que limita agora, e é a próxima etapa

Oportunidades saturam em 13,3 porque a posse no terço final satura em ~12,4%. Subir
os chutes para a faixa 17–27 exige **mais entradas no terço final**, não mais
disposição para chutar nem melhor preço. Isso é volume de progressão: sucesso de
passe para o terço final, ocupação central, `OS-08` (condução em 1,0% das ações do
portador).

O instrumento está pronto e é o mesmo: `tools/r1847/diag_progressao.js` mede
`posse_do_portador_pct` por corredor e faixa de `adv`, e `situacoes_de_chute`. A
métrica a mover é `terco_final.pct_do_tempo_de_posse`, de 12,4% para ~22–25%.

## H. Recomendação

1. **Não promover.** A R18.44 segue promovida. Ela tem 2,542 gols apoiados num
   caminho de preço inflado, o que é um defeito — mas trocá-la por uma build com
   1,917 gols e 11,5 chutes piora quatro gates válidos.
2. **Próxima etapa: entradas no terço final.** Sem ela, nem progressão, nem preço,
   nem limiar resolvem — todos três já estão medidos e saturam.
3. **Quando a etapa de entradas vier**, o stack desta rodada
   (`patch_progressao` + `patch_volume` + `patch_rasteiro`) é a candidata natural
   a acompanhar: os três estão escritos, parametrizados e medidos, e juntos já
   entregam xG/chute de 0,1101 — o valor certo. Falta só o volume que os sustente.

## I. Arquivos

```
tools/r1847/diag_progressao.js     instrumento de roteamento e oportunidade
tools/r1847/patch_progressao.js    o patch, parametrizado
reports/r1847/prog_r1844_s1.json               diagnostico da baseline
reports/r1847/bat_a80_w20_s{1,2,3}.json        bateria 3 bases
reports/r1847/prog_a80_w20_s{1,2,3}.json       progressao 3 bases
reports/r1847/bat_{a74_w21,a70_w23}_s1.json    varredura do corte
reports/r1847/bat_comb{A,B,C}_s1.json          combinacoes com R18.45/R18.46
```
