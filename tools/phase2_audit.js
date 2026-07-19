#!/usr/bin/env node
const fs=require('fs');const path=require('path');const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
global.window=global;global.CanvasRenderingContext2D=undefined;
window.__cdsDebugWarn=()=>{};window.__cdsDebugLog=()=>{};
for(const rel of ['src/scripts/00-polyfills.js','src/scripts/10-data.js','src/scripts/20-core.js','src/scripts/25-data-integrity-v3.js']){
  vm.runInThisContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),{filename:rel});
}
const db=buildDB(window.DATA);
const report=window.CDSDataV3.validateDatabase(db,true);
report.enrichment=window.CDS_DATA_AUDIT.enrichment;
report.samples={
  corrected:report.enrichment.positionCorrections.slice(0,120),
  goalkeepers:db.squads.flatMap(s=>s.pl.filter(p=>p.slot==='GK').slice(0,1).map(p=>({team:s.c,year:s.y,name:p.n,r:p.r,attributes:p.attributesV3,profile:p.profileV3,traits:p.traits,behaviorTraits:p.behaviorTraits}))).slice(0,20),
  stars:db.squads.flatMap(s=>s.pl.filter(p=>p.r>=92).map(p=>({team:s.c,year:s.y,name:p.n,r:p.r,pos:p.slot,positions:p.positionsV3,profile:p.profileV3,traits:p.traits,behaviorTraits:p.behaviorTraits,naturalRoles:p.naturalRoles}))).slice(0,40)
};
const out=path.join(ROOT,'reports/phase2-audit.json');fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({out,ok:report.ok,players:report.players,errors:report.errors.length,warnings:report.warnings.length,lineups:report.lineups,enrichment:{corrections:report.enrichment.positionCorrections.length,traitCoverage:report.enrichment.traitCoveragePct,behaviorTraitCoverage:report.enrichment.behaviorTraitCoveragePct}},null,2));
if(!report.ok)process.exitCode=2;
