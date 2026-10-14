import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from './worker.mjs';
const etag='"'+'a'.repeat(64)+'"';
const worker=createWorker({'/styles.css':{base64:Buffer.from('sample').toString('base64'),type:'text/css',sha256:'a'.repeat(64)}});
test('conditional GET and HEAD avoid body decoding and preserve validators',async()=>{
  for(const tag of [etag,'W/'+etag,'"another", '+etag,'*'])for(const method of ['GET','HEAD']){
    const response=worker.fetch(new Request('https://example.test/styles.css',{method,headers:{'If-None-Match':tag}}));
    assert.equal(response.status,304);assert.equal(response.headers.get('ETag'),etag);assert.equal(await response.text(),'');
  }
  const response=worker.fetch(new Request('https://example.test/styles.css',{headers:{'If-None-Match':'"different"'}}));
  assert.equal(response.status,200);assert.equal(await response.text(),'sample');
});
test('HEAD returns headers without decoding asset bytes',async()=>{
  const broken=createWorker({'/bad.css':{base64:'!',type:'text/css',sha256:'b'.repeat(64)}});
  const response=broken.fetch(new Request('https://example.test/bad.css',{method:'HEAD'}));
  assert.equal(response.status,200);assert.equal(await response.text(),'');
});
