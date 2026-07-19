/* Copa dos Sonhos — Contrato de save versionado (Auditoria Fases 0-9).
   Saída da UI: o contrato vive fora do 60-ui-flow para ser testável em Node
   e reutilizável pelo motor/copa. Regras:
   - todo save carrega `v` (schema) e `engineVersion` (motor que o gravou);
   - saves antigos passam por migrações encadeadas (v1→v2→...);
   - versão futura/desconhecida ou estrutura inválida → null (o jogo segue
     sem crash e oferece Copa nova);
   - nenhuma migração inventa progresso: campos novos entram com defaults
     neutros e explícitos. */
(function (root) {
'use strict';
const SAVE_VERSION = 2;

/* Cada migração leva de v para v+1. Encadeadas até SAVE_VERSION. */
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
};

function migrateSave(s) {
  if (!s || typeof s.v !== 'number') return null;
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

/* JSON bruto → save migrado e validado, ou null. Nunca lança. */
function decodeSave(json) {
  let s;
  try { s = JSON.parse(json); } catch (_) { return null; }
  s = migrateSave(s);
  return validateSave(s) ? s : null;
}

const API = { SAVE_VERSION, migrateSave, validateSave, decodeSave };
root.CDS_SAVE_CONTRACT = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
