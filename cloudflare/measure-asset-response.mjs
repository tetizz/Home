// Completed response-body fixture; no HTTP, Cloudflare requests or deployment.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createWorker } from './worker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineRevision = 'f3e5aeae7f04da245105e2536aef15120d564985';
const oldSource = execFileSync('git', ['show', `${baselineRevision}:cloudflare/worker.mjs`], { cwd: root, encoding: 'utf8' });
const baseline = await import('data:text/javascript;base64,' + Buffer.from(oldSource.replace("'./sites.mjs'", JSON.stringify(pathToFileURL(path.join(root, 'cloudflare/sites.mjs')).href))).toString('base64'));
const manifest = JSON.parse(await fs.readFile(path.join(root, '.cloudflare-dist/assets-manifest.json'), 'utf8'));
const paths = Object.keys(manifest);
const assets = {};
for (const relative of paths) {
  const payload = await fs.readFile(path.join(root, relative.slice(1)));
  if (payload.length !== manifest[relative].bytes || createHash('sha256').update(payload).digest('hex') !== manifest[relative].sha256) throw Error('Stale fixture manifest');
  assets[relative] = { ...manifest[relative], base64: payload.toString('base64') };
}
const requests = paths.map(relative => new Request('https://example.test' + relative));
async function complete(worker) {
  const responses = [];
  const began = performance.now();
  for (const request of requests) {
    const response = worker.fetch(request);
    if (response.status !== 200) throw Error('Incomplete response');
    responses.push(new Uint8Array(await response.arrayBuffer()));
  }
  const elapsed = performance.now() - began;
  // Verify every response outside timing. Never omit body consumption from timing.
  for (let index = 0; index < paths.length; index++) {
    if (createHash('sha256').update(responses[index]).digest('hex') !== manifest[paths[index]].sha256) throw Error('Response bytes changed');
  }
  return elapsed;
}
const original = baseline.createWorker(assets), current = createWorker(assets);
const firstObservedBatchMs = { original: await complete(original), current: await complete(current) };
for (let index = 0; index < 3; index++) { await complete(original); await complete(current); }
const ownerColdSamplesMs = { original: [], current: [] };
for (let index = 0; index < 7; index++) {
  for (const mode of index % 2 ? ['current', 'original'] : ['original', 'current']) {
    ownerColdSamplesMs[mode].push(await complete(mode === 'original' ? baseline.createWorker(assets) : createWorker(assets)));
  }
}
const samples = { original: [], current: [] };
for (let index = 0; index < 15; index++) {
  for (const mode of index % 2 ? ['current', 'original'] : ['original', 'current']) {
    samples[mode].push(await complete(mode === 'original' ? original : current));
  }
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(JSON.stringify({ baselineRevision, currentWorkerSourceSha256: createHash('sha256').update(await fs.readFile(path.join(root, 'cloudflare/worker.mjs'))).digest('hex'), nodeVersion: process.version, assetCount: paths.length, bytes: Object.values(manifest).reduce((total, asset) => total + asset.bytes, 0), firstObservedBatchMs, ownerColdMedianMs: { original: median(ownerColdSamplesMs.original), current: median(ownerColdSamplesMs.current) }, ownerColdSamplesMs, warmMedianMs: { original: median(samples.original), current: median(samples.current) }, warmSamplesMs: samples, limits: 'Same-process sequential local response-body consumption. Owner cold means a new worker closure and empty decoded cache after process/code warmup. Excludes process startup, HTTP, browser rendering and Cloudflare runtime. First observed batches are single observations, not cold-process distributions.' }, null, 2));
