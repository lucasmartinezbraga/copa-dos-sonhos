#!/usr/bin/env node
/* Auditoria · contrato de save versionado: migração v1→v2, rejeição segura
   de saves corrompidos e de versões futuras, roundtrip do schema atual. */
'use strict';
const SC = require('../src/scripts/48-save-contract.js');

const picks = Array.from({ length: 11 }, (_, i) => ({ p: { id: i }, from: 'BRA', x: i, y: i, pos: 'CM' }));

// 1) save v1 legado migra para v2 com defaults neutros
const v1 = JSON.stringify({ v: 1, modo: 'classic', style: 'tiki', cup: { phase: 'groups', round: 1 }, picks, benchPicks: [] });
const m = SC.decodeSave(v1);
if (!m) throw new Error('save v1 legítimo foi rejeitado');
if (m.v !== SC.SAVE_VERSION) throw new Error('migração não elevou a versão');
if (m.engineVersion !== 'legacy-4.x') throw new Error('engineVersion default ausente');
if (m.instructions !== null || m.manager !== null) throw new Error('migração inventou dados');
if (m.style !== 'tiki' || m.cup.round !== 1) throw new Error('migração perdeu dados originais');

// 2) corrompidos e inválidos → null, sem lançar
for (const bad of ['{{{', 'null', '42', JSON.stringify({ v: 2 }),
  JSON.stringify({ v: 2, cup: {}, picks: picks.slice(0, 5) }),
  JSON.stringify({ modo: 'x', cup: {}, picks })]) {
  if (SC.decodeSave(bad) !== null) throw new Error('aceitou save inválido: ' + bad.slice(0, 30));
}

// 3) versão futura → rejeita com segurança (não tenta "migrar para baixo")
if (SC.decodeSave(JSON.stringify({ v: 99, cup: {}, picks })) !== null)
  throw new Error('aceitou save de versão futura');

// 4) roundtrip do schema atual preserva tudo
const v2 = { v: 2, engineVersion: '5.2.2', savedAt: { phase: 'ko', round: 2 }, instructions: { a: 1 },
  instructionPreset: 'possession', phaseRoles: null, manager: { rival: 'ITA' },
  modo: 'classic', style: 'press', axes: {}, formKey: '4-3-3', varIdx: 0, picks, benchPicks: [], cup: { phase: 'ko' } };
const r = SC.decodeSave(JSON.stringify(v2));
if (!r || JSON.stringify(r) !== JSON.stringify(v2)) throw new Error('roundtrip v2 alterou o save');

console.log(JSON.stringify({ ok: true, saveVersion: SC.SAVE_VERSION,
  cases: ['migracao-v1', 'corrompidos-rejeitados', 'versao-futura-rejeitada', 'roundtrip-v2'] }, null, 2));
