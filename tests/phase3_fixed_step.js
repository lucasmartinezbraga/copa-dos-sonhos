'use strict';
const assert=require('assert');
const path=require('path');
const {createRuntime}=require('../tools/lab_runtime.js');
const rt=createRuntime(path.resolve(__dirname,'..'));
const base={id:'step',suite:'test',group:'test',seed:10101,
 a:{squadIndex:10,style:'press',form:'4-3-3',variation:0},
 b:{squadIndex:20,style:'park',form:'5-4-1',variation:0}};
const result=rt.runJob({...base,dt:1/60});
assert(Math.abs(result.dt-1/60)<1e-12);
assert(result.steps>20000 && result.steps<50000);
console.log(JSON.stringify({ok:true,dt:result.dt,steps:result.steps,score:result.score},null,2));
