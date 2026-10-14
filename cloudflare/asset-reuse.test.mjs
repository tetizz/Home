import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from './worker.mjs';

test('repeated public responses reuse decoded bytes and keep consumer bodies independent', async () => {
  const originalDecode = globalThis.atob;
  let decodes = 0;
  globalThis.atob = value => { decodes++; return originalDecode(value); };
  try {
    const asset = { base64: Buffer.from([0, 127, 128, 255]).toString('base64'), type: 'image/png', sha256: 'a'.repeat(64) };
    const worker = createWorker({ '/image.png': asset });
    const read = () => worker.fetch(new Request('https://example.test/image.png'));
    const first = new Uint8Array(await read().arrayBuffer());
    first.fill(42);
    for (let index = 0; index < 12; index++) {
      assert.deepEqual([...new Uint8Array(await read().arrayBuffer())], [0, 127, 128, 255]);
    }
    assert.equal(decodes, 1);
    asset.base64 = Buffer.from([255, 128, 127, 0]).toString('base64');
    assert.deepEqual([...new Uint8Array(await read().arrayBuffer())], [255, 128, 127, 0]);
    assert.equal(decodes, 2);
  } finally { globalThis.atob = originalDecode; }
});

test('failed decoding never poisons a later valid asset response', async () => {
  const asset = { base64: '!', type: 'text/plain', sha256: 'b'.repeat(64) };
  const worker = createWorker({ '/sample.txt': asset });
  const read = () => worker.fetch(new Request('https://example.test/sample.txt'));
  assert.throws(read);
  asset.base64 = Buffer.from('recovered').toString('base64');
  assert.equal(await read().text(), 'recovered');
  assert.equal(await read().text(), 'recovered');
});
