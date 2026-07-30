# ESP-01 — reespecificação proposta

**Estado atual na matriz:** campo vazio, baseline `67,5%`, alvo `<50%`, banda
"medir", evidência `auditoria_blob`, release R18.43.

## Problema 1 — a definição original não existe no repositório

A matriz cita `auditoria_blob` como evidência. Esse instrumento não está no
repositório: procurei por `auditoria_blob`, `campoVazio`, `campo_vazio`,
`emptyField`, `blockLength`, `grid` e `grade` em `tools/` (todas as rodadas r13,
r14, r15, r1821, r1825, r1831, r1835, r1840) e em `reports/`. Não existe. Os
quatro números de ESP-01..04 na matriz **não são reproduzíveis a partir do
fonte**, e a definição exata de "campo vazio" está perdida.

`tools/r1843/diag_espaco.js` reconstrói as métricas com definições escritas e
mede ESP-01 em várias definições ao mesmo tempo. Na R18.40A promovida:

| definição | valor | vs matriz (67,5%) |
|---|---:|---:|
| grade 21x14, raio 7,5 m | 70,84% | +3,3 |
| **grade 21x14, raio 8,0 m** | **68,60%** | **+1,1** |
| grade 21x14, raio 9,0 m | 64,41% | −3,1 |
| grade 7x4 (célula 15,0 x 17,0 m) | 62,42% | −5,1 |
| grade 8x5 (célula 13,1 x 13,6 m) | 70,91% | +3,4 |
| grade 10x6 (célula 10,5 x 11,3 m) | 77,67% | +10,2 |

A série `raio 8,0 m` é a mais próxima. Ela também é coerente com as outras três
métricas do mesmo instrumento, que caem todas a ~1,5 do valor da matriz com um
viés positivo uniforme (bloco 32,84 contra 31,3; zaga→ataque 25,67 contra 24,0;
<20 m da bola 41,64% contra 40,2%). Quatro reconstruções independentes errando
na mesma direção e na mesma magnitude é evidência de que as definições estão
certas e a matriz foi medida numa build ligeiramente anterior — não de que o
instrumento está torto.

Adoto `vazio_r8` como a série canônica de ESP-01, declarando que é uma
reconstrução e não a definição original.

## Problema 2 — o alvo `<50%` é geometricamente inatingível nessa definição

Isto não é opinião, é área.

- Campo: 105 x 68 = **7 140 m²**.
- Jogadores de linha em campo: **20** (10 por time, goleiros fora da série).
- Cada jogador "cobre" um disco de raio 8 m: π·8² = **201,06 m²**.
- Cobertura máxima, se os 20 discos não se sobrepusessem em nada e estivessem
  inteiramente dentro do campo: 20 · 201,06 = **4 021 m² = 56,3%**.
- Logo o **piso teórico de campo vazio é 43,7%**.

Para ficar abaixo de 50% de campo vazio é preciso atingir ≥ 88% da cobertura
máxima teórica — ou seja, sobreposição quase zero entre os 20 discos, em todos
os quadros, o tempo todo. E isso é ainda mais apertado do que parece, porque um
disco de raio 8 m centrado a menos de 8 m de uma linha perde área para fora do
campo: a faixa de 8 m junto a cada lateral é 23,5% da área do campo. Manter os
20 centros na região interna (89 x 52 = 4 628 m²) e ainda assim disjuntos exige
densidade de empacotamento de 86,9%, contra o limite teórico de 90,7% para
discos no plano.

Isto é um alvo de empacotamento de círculos, não um alvo de futebol. Nenhuma
formação real o cumpre, e num escanteio ou numa dividida na área a sobreposição
é obrigatória — os corpos *devem* se juntar onde a bola está.

## Consequência: ESP-01 não discrimina candidata

O mesmo padrão que a rodada R18.40 encontrou em `ECO-03` (ver
`tools/r1840/gate_eco03.md`): um gate que a **própria baseline** reprova não
separa candidata boa de ruim. Aqui é pior, porque a baseline não reprova por
calibração e sim por geometria — nenhuma build futura pode cumpri-lo.

Pela regra estabelecida na R18.40 ("enquanto o gate reprovar na baseline, ele não
bloqueia promoção; vira defeito rastreado"), ESP-01 **não bloqueia** a promoção
da R18.43. Registro explicitamente que estou aplicando uma regra que já existia
e não foi inventada para esta candidata — e que a candidata **melhora** ESP-01,
apenas muito pouco, o que é exatamente o esperado: alongar o bloco em ~5 m
redistribui cobertura, quase não acrescenta cobertura nova.

## Proposta

Separar o que ESP-01 queria medir em duas coisas, porque ele estava tentando
medir "cardume" com um instrumento de "cobertura":

```
ESP-01a  ocupacao de corredores   grade 7x4, % de celulas vazias
         alvo a derivar sobre a R18.43, aplicado a mediana de 3 bases
         classificacao: defeito rastreado, nao bloqueio

ESP-01b  APOSENTAR o alvo <50% sobre vazio_r8
         motivo: piso geometrico 43,7%; exige 88% da cobertura maxima
         teorica em todo quadro. Nao e alcancavel por nenhuma build.
```

O sinal que ESP-01 realmente perseguia — "o time não é um cardume" — já é
capturado com mecanismo por `ESP-02` (comprimento do bloco) e `ESP-03`
(zaga→ataque), que a R18.43 move de 32,84 → 37,07 m e de 25,67 → 31,18 m com
causa identificada no código. Esses dois gates devem ser o critério de OS-07.

## O que NÃO fiz de propósito

Não escolhi a definição de ESP-01 que fizesse a candidata passar. A grade 7x4 dá
62,4% na baseline e é a mais generosa das seis, e mesmo ela não chega a 50% —
então não existe escolha de definição que aprove esta candidata em ESP-01, e a
proposta acima não é auto-servente. ESP-01 fica **reprovado e rastreado**, com o
alvo marcado como inatingível para quem governa a matriz decidir.
