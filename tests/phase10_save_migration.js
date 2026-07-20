#!/usr/bin/env node
'use strict';
const assert=require('assert');
const S=require('../src/scripts/48-save-contract.js');
const base={modo:'classico',style:'balanced',axes:{},formKey:'4-3-3',varIdx:0,picks:Array.from({length:11},(_,i)=>({p:{id:i,n:'P'+i},from:{}})),benchPicks:[],cup:{phase:'groups',round:1,groups:[],results:{}}};
const v1=Object.assign({v:1},base),m1=S.migrateSave(v1);assert.equal(m1.v,3);assert.equal(m1.phase10Version,1);assert('phase10' in m1);
const p10={version:1,players:{x:{condition:72}},teams:{ME:{pendingPreparation:true}},history:[]};
const v2=Object.assign({v:2,engineVersion:'5.2.2',phase10:p10},base),m2=S.migrateSave(v2);assert.equal(m2.v,3);assert.deepEqual(m2.phase10,p10);
const v3=Object.assign({v:3,engineVersion:'5.3.0',phase10Version:1,phase10:p10,preparationSelection:'recovery'},base);
const enc=S.encodeSave(v3);assert(enc);const dec=S.decodeSave(enc);assert.equal(dec.v,3);assert.equal(dec.preparationSelection,'recovery');assert.equal(dec.phase10.players.x.condition,72);
assert.equal(S.decodeSave('{bad'),null);assert.equal(S.migrateSave(Object.assign({v:99},base)),null);assert.equal(S.decodeSave(JSON.stringify({v:3,cup:{},picks:[]})),null);
console.log(JSON.stringify({ok:true,saveVersion:S.SAVE_VERSION,v1To:m1.v,v2To:m2.v,roundtrip:dec.phase10.players.x.condition},null,2));
