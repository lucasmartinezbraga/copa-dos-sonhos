# Critério de aceite da R16.0 — PRÉ-REGISTRADO

**Escrito ANTES de ler a matriz de 294 partidas.** O objetivo é impedir que o
sucesso seja reinterpretado depois que os números aparecerem. Qualquer alteração
neste arquivo após a leitura dos resultados invalida a certificação.

| | |
|---|---|
| candidata | R16.0 `b9a2096797920e523745a7e789af1ae274659db30e4cc8d34a2aac6e49cd1f97` |
| controle | R15.9 `b3e105327e08296ba6c1d896dd5f6e2c1405bbf66b26ea54b8ae3f9c74c7a0a1` |
| variável única | `r15-angular-rate-limit` |
| amostra | 294 partidas, elencos reais, mesmas seeds |

---

## Condições de APROVAÇÃO — todas obrigatórias

### A. O ganho tem de permanecer
- `fracao_giros_bruscos_25g` ≤ **0,004** (era 0,0119 na R15.9)
- `fracao_giros_bruscos_perto_da_bola` ≤ **0,012** (era 0,0281)
- `giroMedio_graus_por_quadro` não pode CAIR abaixo de **1,9** — giro médio muito
  baixo significaria jogador engessado, não fluido

### B. Marcação não pode piorar materialmente
- `threatCoverage` ≥ **0,530** (R15.9 = 0,5430 medido na série real; tolerância
  de 0,013 absoluto para ruído)
- `markerMeanDistance` ≤ **8,90 m** (R15.9 = 8,8716; tolerância 0,03)
- sub-gate `marking` não pode cair abaixo de **1/294** (já é o piso)
- `spatialOverloadCoverage` ≥ **0,520**

### C. Criação e finalização dentro de faixa
- gols/jogo entre **2,80 e 3,45** (R15.9/R15.8 = 3,109)
- chutes/jogo entre **18,0 e 23,0**
- passes/jogo entre **172 e 190**
- impedimentos/jogo entre **2,8 e 4,6**

### D. Integridade e determinismo
- consistência transacional = **294/294 CONSISTENT**
- R13.0 byte-idêntica, build reproduzível, smoke 13/13, cenários 25/25
- teleportes/partida não pode subir acima de **25** (R15.9 ≈ 17–20)

### E. Sem regressão estrutural por formação ou estilo
- `noDominantStyle` continua verdadeiro
- `ppgRange` ≤ **0,75**
- nenhum estilo pode perder mais de **0,45 ppg** em relação à R15.9

---

## Regra de decisão

- **APROVA** somente se A, B, C, D e E forem todas satisfeitas.
- **AJUSTA A CURVA** se A passar mas B falhar — o conceito está certo, a taxa em
  baixa velocidade é que está apertada. Ajuste físico e geral: taxa permitida,
  relação entre `turn`, velocidade e aceleração. **Proibido** criar exceção
  contextual ("marcador pode girar mais", "perto da bola libera", "sob pressão
  ignora"), porque isso recria o problema por outro caminho.
- **REPROVA** se A falhar (o patch não entregou o que prometeu) ou se D falhar.
- "A média geral ficou parecida" **não** é aprovação se um estilo ou formação
  específico regredir além do limite de E.

## Fora de escopo nesta etapa

`_resolveOverlaps` — resíduo de 3,36% de giro brusco dentro do raio de 1,7 m,
ocorrendo em 0,26% dos quadros. Registrado como problema separado: a correção de
sobreposição escreve posição direto, fora do integrador. A solução provável é
trocar deslocamento instantâneo por correção progressiva integrada ao steering.
**Não alterar agora** — misturar as duas mudanças impediria atribuir qualquer
regressão à correta.
