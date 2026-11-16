import fs from 'node:fs';
import assert from 'node:assert/strict';

const p = JSON.parse(fs.readFileSync('PROOFS.json', 'utf8'));
const github = 'https://github.com/stoneforger10/confusable-name-registry';
const explorer = 'https://explorer-studio.genlayer.com';
assert(p.verified && p.source.source_match);
assert.equal(p.transactions.length, 5);
assert.equal(Object.keys(p.checkpoints).length, 4);
assert.deepEqual(p.transactions.slice(1, 4).map(t => t.return_value?.status),
  ['RESERVED', 'COLLISION', 'RESERVED']);
assert(p.transactions.every(({receipt}) => receipt.committed && receipt.status === 'FINALIZED' &&
  receipt.execution === 'SUCCESS' && receipt.consensus === 'MAJORITY_AGREE' &&
  receipt.leader_only === false && receipt.agree_votes >= 2));

const deployment = `[StudioNet contract](${explorer}/address/${p.address})`;
const source = `[Deployed source](${github}/blob/${p.source_commit}/contracts/ConfusableNameRegistry.py)`;
const link = t => `[${t.step}](${explorer}/tx/${t.hash})`;
const rows = [
  'Verified deployed source against the pinned commit.',
  '`modern` held the skeleton `rnodern`.',
  '`rnodern` and `mоdern` (Cyrillic U+043E) were absent. The first holder retained the shared slot.',
  'The new caller received only `modern-lab`. The original slot stayed with the first holder.',
  'The original holder cleared the exact name and skeleton lookup. The fallback stayed registered.',
];
const lines = p.transactions.map((t, i) =>
  `| ${link(t)} | ${rows[i]} | ${t.receipt.agree_votes} / ${t.receipt.initial_validators} |`);
const data = p.checkpoints['single slot claimed'][0].value.data_sha256;

fs.writeFileSync('LIVE_PROOFS.md', `# StudioNet proof matrix

${deployment} · ${source} · [Receipts and verified state](PROOFS.json)

Deployed source SHA-256 \`${p.source.sha256}\`.
Unicode input SHA-256 \`${data}\`.

Each receipt finalized with successful execution and majority agreement. The
proof runner checks the exact return values for all three reservation calls.
Recorded state checks ran after each step and the proof runner rechecked the
final state after the holder released the original slot. Local tests also
verify rejection of an unauthorized release and show the slot can be claimed
again after release.

| Transaction | Verified result | Agree votes / initial validators |
| --- | --- | --- |
${lines.join('\n')}
`);

const notes = `ConfusableNameRegistry reserves names in a shared namespace by Unicode confusable skeleton. A reservation can try a primary name and a fallback atomically. The first free skeleton is reserved and its holder can release it.

On each reservation, the leader and validators independently fetch the pinned Unicode 16.0 confusables file. They check its full SHA-256, parse the mapping rows, and derive both skeletons. Exact agreement on the normalized names, skeletons, and source digest is required. Those skeletons determine the slots the transaction can claim.

On StudioNet, modern occupied the same slot as rnodern and mоdern (Cyrillic U+043E). Both lookalikes were blocked, a distinct fallback was reserved, and the original holder released the shared slot. The contract uses a restricted lowercase alphabet and a fixed Unicode release.`;
assert(notes.length <= 1000);
fs.writeFileSync('SUBMISSION.md', `**Contribution type** Builder → Intelligent Contracts

**Title** ConfusableNameRegistry — Unicode Name Reservations

**Notes / Description**

${notes}

**Evidence**

- [Repository](${github})
- ${source}
- ${deployment}
- [Live proof matrix](${github}/blob/main/LIVE_PROOFS.md)
${p.transactions.map(x => '- ' + link(x)).join('\n')}
`);
