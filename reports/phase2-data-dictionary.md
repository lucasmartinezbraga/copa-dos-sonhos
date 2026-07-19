# Banco V3 — dicionário de dados

## `positionsV3`
- `primary`: posição principal canônica.
- `secondary`: posições naturais alternativas.
- `emergency`: improvisações controladas.
- `fit`: pontuação de adequação por posição.

## `attributesV3`
Ficha persistente de 45 atributos técnicos, mentais, físicos e de goleiro. O motor lê esta ficha por meio de `getAttr`.

## `profileV3`
- `dominantFoot`: `L`, `R` ou `B`.
- `weakFoot`: escala de 2 a 5.
- `heightCmSim`: altura usada somente pela simulação.
- `footSource` e `heightSource`: proveniência.
- `bodyType`: perfil corporal de simulação.

## `behaviorTraits`
Tendências de decisão como passe vertical, pressão, ataque à profundidade, cruzamento cedo e goleiro líbero.

## `naturalRoles`
Até três funções compatíveis, com pontuação de encaixe.

## `dataQuality`
Registra versão do schema, origem da posição, origem dos atributos e avisos. `historicallyVerified` permanece `false` quando a ficha não foi curada individualmente.
