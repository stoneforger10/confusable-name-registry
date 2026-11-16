**Contribution type** Builder → Intelligent Contracts

**Title** ConfusableNameRegistry — Unicode Name Reservations

**Notes / Description**

ConfusableNameRegistry reserves names in a shared namespace by Unicode confusable skeleton. A reservation can try a primary name and a fallback atomically. The first free skeleton is reserved and its holder can release it.

On each reservation, the leader and validators independently fetch the pinned Unicode 16.0 confusables file. They check its full SHA-256, parse the mapping rows, and derive both skeletons. Exact agreement on the normalized names, skeletons, and source digest is required. Those skeletons determine the slots the transaction can claim.

On StudioNet, modern occupied the same slot as rnodern and mоdern (Cyrillic U+043E). Both lookalikes were blocked, a distinct fallback was reserved, and the original holder released the shared slot. The contract uses a restricted lowercase alphabet and a fixed Unicode release.

**Evidence**

- [Repository](https://github.com/stoneforger10/confusable-name-registry)
- [Deployed source](https://github.com/stoneforger10/confusable-name-registry/blob/750464031479bfbc78d3519b5b5f4a6e9d28309d/contracts/ConfusableNameRegistry.py)
- [StudioNet contract](https://explorer-studio.genlayer.com/address/0xD6000384F4F8cD4008bba17D9353b7406af811B5)
- [Live proof matrix](https://github.com/stoneforger10/confusable-name-registry/blob/main/LIVE_PROOFS.md)
- [deploy](https://explorer-studio.genlayer.com/tx/0x85ec173119042b18d7bdb58c504391a4bb9f47c303a5e9aeab4b9b3e4a7bdc8a)
- [reserve-original](https://explorer-studio.genlayer.com/tx/0xeefeba85709059c3915b906182f0e3c9f9ef7d86c257a50cd9ed3a84e5019bcf)
- [reject-both-lookalikes](https://explorer-studio.genlayer.com/tx/0xe0416b56f3e0b4ecd406a0df1ce5ca6654064b1e65247ec81fb3b20b1fe35788)
- [reserve-fallback](https://explorer-studio.genlayer.com/tx/0x34c9c92e27f685cfe0b3edb8579a214fbe08feb9f3b0616bf9ccfce7d0e09b11)
- [release-original](https://explorer-studio.genlayer.com/tx/0xf1c71e0363da5f7f0f4d4f16086341b1c99d73ac2352b9377a5dac495c220158)
