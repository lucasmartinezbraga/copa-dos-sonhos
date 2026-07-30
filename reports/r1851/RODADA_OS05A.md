# OS-05A — censo do corte aéreo efetivo

**Baseline:** R18.50 — PRESERVAR ENERGIA  
**Natureza:** somente observacional  
**Promoção:** não promovível  
**Medições:** ainda não executadas

**SHA-256 baseline:** `495a9d684104b55ec749e43462549667fddb66a93b5d0b0a4cb1ab9d95c0445a`  
**SHA-256 instrumentada:** `932222b6553470de8dde0807e6d0b49d05c139ccb2319680e2057a2ac0460648`

## MECANISMO

Na build promovida, `dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html:5450`
emite `header_clear` e chama `_turnover(def)` quando o defensor ganha o primeiro
contato no cruzamento aéreo.

Essa linha não determina sozinha o desfecho. A chamada atravessa as camadas
posteriores em `:21771–21783` e `:22073–22077`, que podem transformar o corte em
trajetória física por `deliberateClearance`, `boxDuelCorner`, `resolveBlock` ou
`emergencyHeaderClear`. Portanto, `_turnover(def)` no texto-base não prova posse
limpa no estado efetivo do motor.

O relatório R18.50 também contém um erro documental: as duas candidatas
rejeitadas não produziram zero eventos `corner`. Os artefatos
`fonte_canto_corte.json` e `fonte_canto_corteB.json` registram 8 eventos em 18
partidas, ou 0,44 por partida. A entrega caiu, mas não zerou.

## HIPÓTESE

O total de `header_clear` permanece igual. O diagnóstico de que todos os cortes
viram posse limpa deve **descer**, porque uma parte já é interceptada pelas
camadas efetivas. O potencial deste único sítio para elevar `ECO-05` também deve
**descer**.

Nenhum agregado de jogo deve subir ou descer: a rodada não altera comportamento.

## PATCH

O patch exato está em `tools/r1851/patch_os05a_header_census.js`.

Primeiro, ele marca apenas o sítio-alvo:

```js
edit(
  'os05a-tag-aerial-cross-first-contact',
  `this._emit('header_clear',{by:def});this._turnover(def);`,
  `this._emit('header_clear',{by:def,setPiece,os05Origin:'aerial_cross_first_contact'});this._turnover(def);`
);
```

Depois, injeta o observador com âncora única `</body></html>`, após todas as
sobrescritas funcionais. O censo separa:

- jogada corrida e bola parada;
- posse limpa;
- trajetória rumo à linha de fundo;
- trajetória rumo à lateral;
- bola ainda viva;
- outro desfecho.

Não há chamada a RNG, mutação de posse, trajetória ou estatística.

## PREVISÃO REGISTRADA ANTES DE MEDIR

Estas previsões foram registradas antes da bateria e não são resultados:

1. `header_clear` total: 0,9–1,4 por partida.
2. `open_clean`: 0,2–0,6 por partida.
3. `setpiece_seen`: 0,3–0,7 por partida.
4. Gols, xG, chutes, chutes no alvo e escanteios: idênticos à baseline pareada.

Se `open_clean` ficar nessa faixa, o sítio não tem volume para levar sozinho os
escanteios do patamar atual ao piso 4.

## MEDIÇÃO

Para cada base `4200000 / 8400000 / 1260000`, executar 48 partidas:

```bash
node tools/r1851/diag_os05a_header_census.js \
  --build="dist/COPA DOS SONHOS - R18.50 - OS05A CENSO.html" \
  --matches=48 --semente=4200000 \
  --out=reports/r1851/os05a_s4200000.json
```

Repetir com `8400000` e `1260000`.

Em paralelo, executar `tools/r1840/bateria.js` sobre a baseline e a build
instrumentada, nas mesmas três bases. A rodada é válida somente se os agregados
forem pareados e idênticos. Qualquer divergência comportamental reprova o
instrumento.

O gate de promoção de uma futura candidata comportamental continua sendo
`ECO-05: 4–10 escanteios/partida`, protegido por:

- `ECO-02 ≤ 2,7 xG/partida`;
- `corner === corner_delivery`;
- determinismo;
- comparação pareada nas três bases;
- diferença acima da banda de ruído de 31% para escanteios.

## ARMADILHA

Medir somente a linha 5450 confunde o texto-base com o motor efetivo. Inserir o
hook antes da última sobrescrita de `_turnover` também mede uma camada incompleta.

Outra armadilha é misturar o corte de jogada corrida com o primeiro contato
defensivo da cobrança de escanteio. Foi isso que contaminou a tentativa
rejeitada. O marcador `setPiece` e a origem específica evitam essa mistura.

## VALIDAÇÃO ESTÁTICA EXECUTADA

- As duas âncoras do patch casaram exatamente uma vez.
- Os 57 blocos `<script>` da candidata foram compilados sem erro de sintaxe.
- Removendo somente a tag observacional e o bloco de censo, o arquivo restaurado
  é byte-idêntico à baseline oficial, inclusive no SHA-256.
- Nenhuma partida foi simulada neste ambiente e nenhum número acima é resultado
  novo de bateria.
