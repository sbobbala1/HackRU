import test from 'node:test';
import assert from 'node:assert/strict';
import {matchBottlenecks, updateWorkflow} from '../src/services/demoWorkflow.js';
import {criteriaText} from '../src/services/demoMode.js';
import {getClinicalTrial, searchClinicalTrials} from '../src/services/clinicalTrials.js';

test('bottlenecks use actual rule states and cohort denominator',()=>{
  const rows=matchBottlenecks([{criteria:[{criterion_id:'C1',original_text:'Age',status:'MET'}]},
    {criteria:[{criterion_id:'C1',original_text:'Age',status:'NOT_MET'}]},
    {criteria:[{criterion_id:'C1',original_text:'Age',status:'UNKNOWN'}]}]);
  assert.deepEqual([rows[0].MET,rows[0].NOT_MET,rows[0].UNKNOWN,rows[0].denominator],[1,1,1,3]);
});
test('workflow is isolated by study and patient and rejects invalid stages',()=>{
  const state=updateWorkflow({},'NCT1','SYN1','Screening in Progress','2026-10-10');
  assert.equal(state['NCT1:SYN1'].stage,'Screening in Progress');
  assert.equal(state['NCT2:SYN1'],undefined);
  assert.throws(()=>updateWorkflow(state,'NCT1','SYN1','Eligible'));
});
test('age metadata in months cannot be treated as years',()=>{
  const text=criteriaText({eligibility:'Original rule',minAge:'6 Months',maxAge:'N/A'});
  assert.equal(text,'Original rule');
  assert.match(criteriaText({eligibility:'Original rule',minAge:'18 Years',maxAge:'75 Years'}),/Age 18 years or older/);
});
test('external outage returns labeled original snapshots',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw new TypeError('Offline');};
  try {
    const trial=await getClinicalTrial('NCT05564039');
    assert.equal(trial.cached,true);
    assert.match(trial.source,/Cached/);
    assert.ok(trial.eligibility);
    const result=await searchClinicalTrials({query:'diabetes'});
    assert.ok(result.studies.length);
    assert.ok(result.studies.every(s=>s.cached));
    await assert.rejects(getClinicalTrial('NCT99999999'));
  } finally {globalThis.fetch=original;}
});

test('wrong official record cannot replace the selected trial',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({protocolSection:{identificationModule:{nctId:'NCT00000001'}}})});
  try {await assert.rejects(getClinicalTrial('NCT00000002'),/does not match/);}
  finally {globalThis.fetch=original;}
});
