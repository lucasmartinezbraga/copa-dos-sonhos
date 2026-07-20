#!/usr/bin/env node
/* Auditoria · contrato de save versionado: migrações v1→v2→v3,
   rejeição segura e roundtrip com persistência da Copa. */
'use strict';
const SC = require('../src/scripts/48-save-contract.js');
const picks = Array.from({ length: 11 }, (_, i) => ({ p: { id: i }, from: 'BRA', x: i, y: i, pos: 'CM' }));
const base={modo:'classic',style:'tiki',cup:{phase:'groups',round:1},picks,benchPicks:[]};
const m=SC.decodeSave(JSON.stringify(Object.assign({v:1},base)));
if(!m||m.v!==3)throw new Error('v1 não migrou para v3');
if(m.engineVersion!=='legacy-4.x'||m.phase10Version!==1||m.phase10!==null)throw new Error('defaults de migração inválidos');
const p10={version:1,players:{},teams:{ME:{pendingPreparation:true}},history:[]};
const m2=SC.decodeSave(JSON.stringify(Object.assign({v:2,engineVersion:'5.2.2',phase10:p10},base)));
if(!m2||m2.v!==3||m2.phase10!==p10&&JSON.stringify(m2.phase10)!==JSON.stringify(p10))throw new Error('v2 não preservou Fase 10');
for(const bad of ['{{{','null','42',JSON.stringify({v:3}),JSON.stringify({v:3,cup:{},picks:picks.slice(0,5)}),JSON.stringify({modo:'x',cup:{},picks})])if(SC.decodeSave(bad)!==null)throw new Error('aceitou save inválido');
if(SC.decodeSave(JSON.stringify({v:99,cup:{},picks}))!==null)throw new Error('aceitou versão futura');
const v3=Object.assign({v:3,engineVersion:'5.3.0',phase10Version:1,phase10:p10,preparationSelection:'recovery'},base);
const encoded=SC.encodeSave(v3),r=SC.decodeSave(encoded);
if(!r||JSON.stringify(r)!==JSON.stringify(v3))throw new Error('roundtrip v3 alterou o save');
console.log(JSON.stringify({ok:true,saveVersion:SC.SAVE_VERSION,cases:['v1-v3','v2-v3','invalidos','futuro','roundtrip-v3']},null,2));
