import test from 'node:test';
import assert from 'node:assert/strict';
import {readStored} from '../src/services/storage.js';
test('invalid, missing or incompatible storage falls back safely',()=>{
  const previous=globalThis.localStorage;
  try {
    globalThis.localStorage={getItem:()=>'{broken'};
    assert.deepEqual(readStored('profile',{}),{});
    globalThis.localStorage={getItem:()=>'{"not":"an array"}'};
    assert.deepEqual(readStored('saved',[]),[]);
    globalThis.localStorage={getItem:()=>null};
    assert.equal(readStored('live',null),null);
  } finally {globalThis.localStorage=previous;}
});
