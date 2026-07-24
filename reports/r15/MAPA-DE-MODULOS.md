# Mapa de módulos — casca modular com paridade

Como o build funciona hoje, por que ele impede refatorar, e qual é o único
caminho de migração que preserva paridade determinística.

---

## 1. Como a build é montada hoje

`tools/build_ux.py` monta o HTML final em cinco etapas:

```
1. base R13.0        template + blocos de src/r13/scripts/*
                     → conferida contra manifests/r13-build-manifest.json
                       ABORTA se o SHA divergir de 363d9a91…9818a8
2. patches de MOTOR  src/r14/patches-engine.json  (23 ativos, 1 experimento)
                     find/replace de string; cada `from` DEVE ocorrer 1x
                     ABORTA se ocorrer 0x ou 2x
3. patches de APRES. src/ux/patches.json          (mesma regra)
4. camada de MOTOR   src/r14/*.js  → <script id="cds-r14-engine">
5. camada de UX      src/ux/*.css  → <style id="cds-ux-system">
                     src/ux/*.js   → <script id="cds-ux-boot">
```

Resultado: 16 `<script>` no HTML, dos quais o nº 2 (`script-2`, sem `id`) é o
bundle base com **1 130 707 bytes**.

## 2. O obstáculo real à modularização

> **Refatorar o bundle base quebra os 23 patches de motor de uma vez.**

Cada patch ancora numa string literal que precisa ocorrer **exatamente uma vez**.
Renomear uma variável, reindentar uma linha ou quebrar uma função em duas faz
`build_ux.py` abortar com `patch de MOTOR 'x' ocorre 0x na base (esperado 1)`.

Isso é uma **proteção**, não um defeito: é o que impede uma refatoração silenciosa
de mudar comportamento. Mas significa que "separar o monólito em módulos" **não
pode** ser feito movendo código para fora do bundle.

### 2.1 O padrão que o projeto já usa e funciona

As camadas R12/R13/R14 não editam o bundle: elas **substituem métodos do
protótipo** depois que ele existe.

```js
const oldDefend13 = P._defendTarget;      // guarda a referência
P._defendTarget = function (tm, p, b, presser) {
  … lógica nova …
  return oldDefend13.apply(this, arguments);   // cai para a antiga
};
```

É assim que `_assignDefRoles` (substituição total), `_defendTarget` e
`_attackTarget` (wrappers) já vivem fora do bundle, em
`src/r13/scripts/30-r13-football-observer.js`.

**A migração modular é a continuação desse padrão, não uma reescrita.**

### 2.2 A armadilha que já custou dois patches

Quem sobrescreve precisa ser o **último** a carregar, e quem captura a referência
antiga precisa capturá-la **depois** de todos os outros. Duas falhas reais:

- `r14-shadow-lane` ancorou no `_defendTarget` do bundle, que a camada R13 já
  havia substituído. Efeito medido: **49/294 placares idênticos, zero diferença**.
- `_setCorner` continuou teleportando porque a camada R12 (`29-…:138`) guardou
  `oldSetCorner` **no carregamento**, antes do wrapper da R15.4.

**Regra:** antes de ancorar qualquer coisa, confirme o dono vivo com
`tools/r15/patch_effect.py` (A/B pareado — detecta patch inerte).

---

## 3. Módulos-alvo

Os onze módulos pedidos, mapeados para onde o código está **hoje**:

| módulo | dono vivo hoje | como extrair |
|---|---|---|
| **estado** | `MatchSim` (bundle) + `29-r12-transactional-core.js` | já tem núcleo transacional; expor leitura tipada |
| **simulação** | `_step`/`_integrate` (R12 sobrescreve o do bundle) | wrapper |
| **tática** | `30-tactics.js` + `STYLE_FX` (bundle) | leitura; escrita fica no contrato §18 |
| **percepção** | **não existe** (§20 `NOT_EXECUTED`) | módulo novo — nada a preservar |
| **decisão** | `_decide` (bundle) + fases R13 | wrapper + logger §23 |
| **movimento** | `_attackTarget`/`_defendTarget` (R13) | **primeiro alvo** — já são wrappers |
| **física** | `_integrate` + `20-physics-timeline.js` | wrapper |
| **regras** | `_awardFoul`, `_penalty`, `_freeKick` (bundle, **não sobrescritos**) | wrapper novo |
| **apresentação** | `src/ux/50-field25d.js`, `60-anim-state-machine.js`, `61-anim-bridge.js` | já é camada separada |
| **câmera** | dentro de `50-field25d.js` | extrair para módulo próprio |
| **auditoria** | `30-r13-football-observer.js` + `tools/r15/*` | já separado |

### 3.1 Ordem de extração — do mais isolado ao mais acoplado

```
1. auditoria        já isolada — só formalizar interface
2. apresentação     já isolada — separar câmera de render
3. movimento        wrappers existem; §18 entra aqui
4. regras           sem sobrescrita hoje; wrapper novo é seguro
5. decisão + percepção   módulos novos; nada a quebrar
6. física / simulação / estado   por último — maior risco de paridade
```

---

## 4. Contrato de paridade — o portão de cada passo

Nenhum passo pode mudar uma partida. O teste é o mesmo do `patch_effect.py`:

```
matriz de 294 partidas, elencos reais, mesmas seeds
→ 294/294 placares idênticos
→ todas as métricas agregadas iguais até 1e-9
→ SHA da build muda (é outro arquivo), comportamento não
```

Se a matriz mudar, o módulo vazou comportamento. **Reverte, não ajusta.**

`tools/r15/patch_effect.py` já implementa exatamente esse A/B pareado.

### 4.1 O que "Node.js será infraestrutura" significa aqui

O laboratório **já** roda em Node: `tools/ux/probe_balllock.js` carrega o HTML,
extrai os `<script>` por `id`, e executa no `vm` com um shim de globais
(`window`, `navigator`, `localStorage`, …), pulando as camadas que exigem DOM.

Ou seja: a separação motor/apresentação **já existe de fato** — o runner headless
prova isso 294 vezes por matriz. O que falta é torná-la explícita no código-fonte
em vez de emergente da lista `SKIP_IDS`.

**Não é preciso reescrever nada em Node.** É preciso transformar
`SKIP_IDS` numa fronteira declarada.

---

## 5. Riscos registrados

| risco | mitigação |
|---|---|
| refatorar o bundle quebra 23 patches | não refatorar o bundle; sobrescrever protótipo |
| ancorar em dono morto | `patch_effect.py` antes de cada patch |
| ordem de carregamento | módulo novo entra por último; capturar `old*` no fim |
| paridade perdida sem perceber | matriz de 294 obrigatória por passo |
| dois passos na mesma regressão | um módulo por vez, sempre |
