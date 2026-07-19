'use strict';
const assert=require('assert');
const path=require('path');
const {createRuntime}=require('../tools/lab_runtime.js');
const ROOT=path.resolve(__dirname,'..');
const rt=createRuntime(ROOT);
const job={id:'determinism',suite:'test',group:'test',seed:424242,dt:1/60,
  a:{squadIndex:0,style:'balanced',form:'4-3-3',variation:0},
  b:{squadIndex:1,style:'counter',form:'4-2-3-1',variation:0}};
const a=rt.runJob(job),b=rt.runJob(job);
for(const key of ['score','goals','shots','onTarget','xg','passes','passOk','fouls','yellow','red','corners','goalMinutes','eventCounts']){
  assert.deepStrictEqual(a[key],b[key],`Não determinístico em ${key}`);
}
console.log(JSON.stringify({ok:true,score:a.score,shots:a.shots,xg:a.xg,steps:a.steps},null,2));
