# ConfusableNameRegistry

A permissionless name registry that gives two spellings with the same Unicode
confusable skeleton a single exclusive slot. For example, `modern`,
`rnodern`, and `mоdern` with Cyrillic U+043E all map to `rnodern`.
A caller can supply a fallback to reserve atomically when the first slot is
occupied.

For each reservation, the leader and validators independently retrieve the
Unicode 16.0 confusables file from a fixed publisher route. The Unicode Tools
mirror and the release URL must produce the same pinned SHA-256 to be usable.
Each execution reads the actual mapping rows, derives both candidate
skeletons using NFD and the Unicode mappings, and compares the entire canonical
report exactly. The agreed skeletons determine which slots the transaction
can claim. Unavailable or invalid data stops the reservation.

| Method | Behavior |
| --- | --- |
| `reserve(primary, fallback)` | Reserve the first free skeleton for the caller, or return `COLLISION`. Repeat the same name for a single candidate. |
| `release(name)` | The holder of the exact name clears both indexes. |
| `lookup_name(name)` | Look up the exact spelling. |
| `lookup_skeleton(key)` | Look up the held name by SHA-256 of its UTF-8 skeleton. |

The profile accepts 3–24 characters from ASCII lowercase letters and digits,
basic lowercase Greek and Cyrillic ranges, and interior ASCII hyphens.
It uses a fixed Unicode release and a restricted alphabet. Confusability
outside that profile and browser or font rendering differences remain outside
the registry's coverage. Reservations are first-come within this contract.
[Unicode security mechanisms](https://www.unicode.org/reports/tr39/) ·
[Pinned Unicode data](https://www.unicode.org/Public/security/16.0.0/confusables.txt)

```sh
python -m pip install -r requirements-dev.txt
python -m pytest tests -q
genvm-lint check contracts/ConfusableNameRegistry.py
```

For the full-file test, place the release data at
`.gltest_cache/confusables.txt`. The other tests use a small mock table.
`scripts/prove.mjs` verifies the StudioNet deployment, transaction receipts
and registry state. Its `--verify-only` mode checks the recorded receipts
and current final state without signing or broadcasting.
