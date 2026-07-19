#!/usr/bin/env node
'use strict';
const {performance}=require('perf_hooks');
const path=require('path');
const {createRuntime}=require('./lab_runtime.js');
const ROOT=path.resolve(__dirname,'..');
const runtime=createRuntime(ROOT);
process.on('message',message=>{
  if(!message||message.type!=='run')return;
  const results=[],errors=[],timings=[];const started=performance.now();
  for(const job of message.jobs){const t=performance.now();try{results.push(runtime.runJob(job));}catch(error){errors.push({id:job.id,error:String(error&&error.stack||error)});}timings.push(performance.now()-t);}
  if(process.send)process.send({type:'done',batchId:message.batchId,results,errors,timings,ms:performance.now()-started},()=>process.exit(0));
  else process.exit(1);
});
