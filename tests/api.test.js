import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../src/services/api.js';

test('AI questions pass caller cancellation and selected trial', async()=>{
  const original=globalThis.fetch;
  const controller=new AbortController();
  try {
    globalThis.fetch=async(url,options)=>{
      assert.ok(url.endsWith('/trials/explain'));
      assert.deepEqual(JSON.parse(options.body),{nct_id:'NCT00000001',question:'What happens?',language:'en'});
      controller.abort(); assert.ok(options.signal.aborted);
      throw new DOMException('Cancelled','AbortError');
    };
    await assert.rejects(api.explainTrial('NCT00000001','What happens?','en',controller.signal),{name:'AbortError'});
  } finally {globalThis.fetch=original;}
});
test('offline backend and validation failures are readable',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>{throw new TypeError('fetch failed');};
    await assert.rejects(api.health(),/Cannot reach the Vitra API/);
    globalThis.fetch=async()=>({ok:false,json:async()=>({detail:[{msg:'invalid'}]})});
    await assert.rejects(api.health(),/could not be processed/);
    globalThis.fetch=async()=>({ok:false,status:502,json:async()=>{throw new SyntaxError('Not JSON');}});
    await assert.rejects(api.health(),/Restart npm.cmd run dev/);
    globalThis.fetch=async()=>({ok:false,json:async()=>({detail:'OpenAI quota reached'})});
    await assert.rejects(api.health(),/OpenAI quota reached/);
  } finally {globalThis.fetch=original;}
});
