'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');
const ROOT=path.resolve(__dirname,'..');
const jobs=JSON.parse(fs.readFileSync(path.join(ROOT,'reports/phase3/validation-matrix-214-jobs.json'),'utf8'));
assert.strictEqual(jobs.length,214);
const counts={};for(const j of jobs){counts[j.suite]=(counts[j.suite]||0)+1;assert(Math.abs(j.dt-1/60)<1e-12);assert(Number.isInteger(j.seed));assert(j.a&&j.b);}
assert.deepStrictEqual(counts,{parity:30,random:40,strongWeak:40,styles:70,formations:34});
for(const style of ['tiki','counter','press','direct','wings','balanced','park'])assert.strictEqual(jobs.filter(j=>j.meta.testedStyle===style).length,10);
console.log(JSON.stringify({ok:true,jobs:jobs.length,counts},null,2));
