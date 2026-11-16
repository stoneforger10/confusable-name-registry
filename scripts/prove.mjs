import fs from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {rpc, receipt, source, read, sha} from './check.mjs';

const code = 'contracts/ConfusableNameRegistry.py';
const publisher = {name: 'studio-proof-deployer', address: '0x7a413BB4AB62E31d62d4cD9efC8C8a8Dae37FB42'};
const peer = {name: 'fairresolve-demo', address: '0x34346773a22564cbcc5f1d67d1c1f9f196daea35'};
const journal = 'PROOFS.json';
const commit = process.argv[2];
const verifyOnly = process.argv.includes('--verify-only');
assert(/^[a-f0-9]{40}$/.test(commit ?? ''));
const proof = fs.existsSync(journal)
  ? JSON.parse(fs.readFileSync(journal, 'utf8'))
  : {network: 'StudioNet', source_commit: commit, transactions: []};
assert.equal(proof.source_commit, commit);
const save = () => fs.writeFileSync(journal, JSON.stringify(proof, null, 2) + '\n');

function send(args, signer, entry) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/run-cli.cjs', ...args], {
      windowsHide: true,
      env: {...process.env, CNR_TEST_ACCOUNT: signer.name},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let pending = '';
    child.stderr.resume();
    child.stdout.on('data', chunk => {
      const lines = (pending + chunk.toString()).split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) {
        const matched = /^BROADCAST_HASH (0x[0-9a-f]{64})$/i.exec(line);
        if (matched) {
          entry.hash = matched[1];
          save();
          console.log(entry.step, entry.hash);
        }
      }
    });
    child.on('error', reject);
    child.on('close', resolve);
  });
}

async function transaction(step, args, signer, expected = 'SUCCESS', message) {
  let entry = proof.transactions.find(item => item.step === step);
  if (!entry) {
    assert(!verifyOnly, 'Verification requires an original broadcast journal');
    const nonce = await rpc('eth_getTransactionCount', [signer.address, 'latest']);
    assert.equal(await rpc('eth_getTransactionCount', [signer.address, 'pending']), nonce);
    entry = {step, args, signer: signer.address, nonce};
    proof.transactions.push(entry);
    save();
    await send(args, signer, entry);
  }
  assert.deepEqual(entry.args, args);
  assert.equal(entry.signer, signer.address);
  assert(entry.hash, 'Broadcast status unknown. Inspect account history before any retry.');
  entry.receipt = await receipt(entry.hash, expected, message);
  save();
  assert.equal(entry.receipt.committed, expected === 'SUCCESS');
  const native = await rpc('eth_getTransactionByHash', [entry.hash]);
  assert.equal(native.from_address.toLowerCase(), signer.address.toLowerCase());
  assert.equal(BigInt(native.nonce), BigInt(entry.nonce));
  assert.equal(BigInt(native.value), 0n);
  console.log(step, entry.receipt.status, entry.receipt.execution);
  return entry.receipt.address;
}

const pinnedData = '95bd0aad6dced5ebc63436f459c06ab21a8d107cd842fb57f5c3a1e91bca8611';
const original = 'modern';
const asciiAlias = 'rnodern';
const mixedAlias = 'm\u043edern';
const fallback = 'modern-lab';
const originalKey = sha('rnodern');
const fallbackKey = sha('rnodern-lab');
const record = (name, owner, skeleton, key) => ({
  name, owner: owner.address.toLowerCase(), skeleton, skeleton_key: key, data_sha256: pinnedData,
});
const holder = record(original, publisher, 'rnodern', originalKey);
const alternative = record(fallback, peer, 'rnodern-lab', fallbackKey);

assert.equal(await rpc('eth_chainId', []), '0xf22f');
proof.address = await transaction('deploy', ['deploy', '--contract', code], publisher);
proof.source = await source(proof.address);
proof.checkpoints ??= {};
save();

async function write(step, method, args, signer) {
  const to = await transaction(step, ['write', proof.address, method, '--args', ...args], signer);
  assert.equal(to.toLowerCase(), proof.address.toLowerCase());
}

async function checkpoint(name, queries) {
  const saved = proof.checkpoints[name];
  if (saved) {
    assert.deepEqual(saved, queries);
    return;
  }
  assert(!verifyOnly, 'Verification requires the original state checkpoints');
  for (const {method, arg, value} of queries) {
    assert.deepEqual(await read(proof.address, method, [arg]), value, name);
  }
  proof.checkpoints[name] = queries;
  console.log(name, 'verified');
  save();
}

const byName = (arg, value) => ({method: 'lookup_name', arg, value});
const byKey = (arg, value) => ({method: 'lookup_skeleton', arg, value});
await write('reserve-original', 'reserve', [original, original], publisher);
await checkpoint('single slot claimed', [byName(original, holder), byKey(originalKey, holder)]);

await write('reject-both-lookalikes', 'reserve', [asciiAlias, mixedAlias], peer);
await checkpoint('both lookalikes blocked', [
  byName(asciiAlias, {}), byName(mixedAlias, {}), byKey(originalKey, holder),
]);

await write('reserve-fallback', 'reserve', [mixedAlias, fallback], peer);
await checkpoint('fallback selected', [
  byName(mixedAlias, {}), byName(fallback, alternative), byKey(originalKey, holder),
  byKey(fallbackKey, alternative),
]);

await write('release-original', 'release', [original], publisher);
const final = [byName(original, {}), byKey(originalKey, {}), byKey(fallbackKey, alternative)];
await checkpoint('release clears both indexes', final);
for (const {method, arg, value} of final) {
  assert.deepEqual(await read(proof.address, method, [arg]), value);
}
const history = await rpc('sim_getTransactionsForAddress', [proof.address]);
assert.deepEqual(history.map(t => t.hash).sort(), proof.transactions.map(t => t.hash).sort());
proof.verified = true;
save();
