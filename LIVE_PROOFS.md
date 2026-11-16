# StudioNet proof matrix

[StudioNet contract](https://explorer-studio.genlayer.com/address/0xD6000384F4F8cD4008bba17D9353b7406af811B5) · [Deployed source](https://github.com/stoneforger10/confusable-name-registry/blob/750464031479bfbc78d3519b5b5f4a6e9d28309d/contracts/ConfusableNameRegistry.py) · [Receipts and verified state](PROOFS.json)

Deployed source SHA-256 `1178b9bbe0a70aa653ef1ae68010f66a2f17a63675792581395fadd5c6467b18`.
Unicode input SHA-256 `95bd0aad6dced5ebc63436f459c06ab21a8d107cd842fb57f5c3a1e91bca8611`.

Each receipt finalized with successful execution and majority agreement. The
proof runner checks the exact return values for all three reservation calls.
Recorded state checks ran after each step and the proof runner rechecked the
final state after the holder released the original slot. Local tests also
verify rejection of an unauthorized release and show the slot can be claimed
again after release.

| Transaction | Verified result | Agree votes / initial validators |
| --- | --- | --- |
| [deploy](https://explorer-studio.genlayer.com/tx/0x85ec173119042b18d7bdb58c504391a4bb9f47c303a5e9aeab4b9b3e4a7bdc8a) | Verified deployed source against the pinned commit. | 4 / 5 |
| [reserve-original](https://explorer-studio.genlayer.com/tx/0xeefeba85709059c3915b906182f0e3c9f9ef7d86c257a50cd9ed3a84e5019bcf) | `modern` held the skeleton `rnodern`. | 3 / 5 |
| [reject-both-lookalikes](https://explorer-studio.genlayer.com/tx/0xe0416b56f3e0b4ecd406a0df1ce5ca6654064b1e65247ec81fb3b20b1fe35788) | `rnodern` and `mоdern` (Cyrillic U+043E) were absent. The first holder retained the shared slot. | 3 / 5 |
| [reserve-fallback](https://explorer-studio.genlayer.com/tx/0x34c9c92e27f685cfe0b3edb8579a214fbe08feb9f3b0616bf9ccfce7d0e09b11) | The new caller received only `modern-lab`. The original slot stayed with the first holder. | 3 / 5 |
| [release-original](https://explorer-studio.genlayer.com/tx/0xf1c71e0363da5f7f0f4d4f16086341b1c99d73ac2352b9377a5dac495c220158) | The original holder cleared the exact name and skeleton lookup. The fallback stayed registered. | 3 / 5 |
