/* Copa dos Sonhos — Contrato de save versionado.
   Regras:
   - todo save carrega `v` (schema) e `engineVersion`;
   - saves antigos passam por migrações encadeadas;
   - versão futura/desconhecida ou estrutura inválida → null;
   - campos novos entram com defaults neutros, sem inventar progresso. */
(function (root) {
'use strict';
const SAVE_VERSION = 3;

const MIGRATIONS = {
  1: function (s) {
    return Object.assign({}, s, {
      v: 2,
      engineVersion: s.engineVersion || 'legacy-4.x',
      savedAt: s.savedAt || null,
      instructions: s.instructions || null,
      instructionPreset: s.instructionPreset || null,
      phaseRoles: s.phaseRoles || null,
      manager: s.manager || null,
    });
  },
  2: function (s) {
    const cup = s.cup && typeof s.cup === 'object' ? s.cup : null;
    return Object.assign({}, s, {
      v: 3,
      phase10Version: 1,
      phase10: s.phase10 || (cup && cup.persistence) || null,
      preparationSelection: s.preparationSelection || null,
    });
  },
};

function migrateSave(s) {
  if (!s || typeof s.v !== 'number') return null;
  s = Object.assign({}, s);
  let guard = 0;
  while (s.v < SAVE_VERSION && guard++ < 16) {
    const up = MIGRATIONS[s.v];
    if (!up) return null;
    s = up(s);
  }
  return s.v === SAVE_VERSION ? s : null;
}
function validateSave(s) {
  return !!(s && s.v === SAVE_VERSION && s.cup && typeof s.cup === 'object'
    && Array.isArray(s.picks) && s.picks.length >= 11);
}
function decodeSave(json) {
  let s;
  try { s = JSON.parse(json); } catch (_) { return null; }
  s = migrateSave(s);
  return validateSave(s) ? s : null;
}
function encodeSave(s) {
  const migrated = migrateSave(s);
  if (!validateSave(migrated)) return null;
  try { return JSON.stringify(migrated); } catch (_) { return null; }
}

const API = { SAVE_VERSION, MIGRATIONS, migrateSave, validateSave, decodeSave, encodeSave };
root.CDS_SAVE_CONTRACT = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
