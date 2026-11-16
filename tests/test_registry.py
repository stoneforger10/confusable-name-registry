import hashlib
import json
import re
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts/ConfusableNameRegistry.py"
DATA = ROOT / ".gltest_cache/confusables.txt"
ROWS = b"# Unicode mapping excerpt for tests\n006D ; 0072 006E ; MA\n043E ; 006F ; MA\n"
LOOKALIKE = "m\u043edern"


@pytest.fixture
def registry(direct_deploy, direct_vm, monkeypatch):
    contract = direct_deploy(str(SOURCE))
    module = sys.modules[type(contract._instance).__module__]
    monkeypatch.setattr(module, "UNICODE_SHA256", hashlib.sha256(ROWS).hexdigest())
    direct_vm.mock_web(re.escape(module.UNICODE_URL) + "$", {
        "method": "GET", "response": {"status": 200, "headers": {}, "body": ROWS},
    })
    return contract, module


def test_full_publisher_file_when_available(direct_deploy):
    if not DATA.is_file():
        pytest.skip("Place the pinned Unicode file at .gltest_cache/confusables.txt")
    contract = direct_deploy(str(SOURCE))
    module = sys.modules[type(contract._instance).__module__]
    contents = DATA.read_bytes()
    report = module.skeleton_report(contents, ["modern", "rnodern", LOOKALIKE, "modern-lab"])
    assert report["skeletons"] == ["rnodern", "rnodern", "rnodern", "rnodern-lab"]


def test_reservation_fallback_collision_and_release(registry, direct_vm, direct_alice, direct_bob):
    contract, _ = registry
    direct_vm.sender = direct_alice
    original = contract.reserve("modern", "alternate")
    key = original["record"]["skeleton_key"]
    assert original["record"]["skeleton"] == "rnodern"
    assert contract.lookup_name("alternate") == {}
    direct_vm.sender = direct_bob
    assert contract.reserve("rnodern", LOOKALIKE) == {
        "status": "COLLISION", "candidate_keys": [key, key],
    }
    fallback = contract.reserve(LOOKALIKE, "modern-lab")
    assert fallback["record"]["name"] == "modern-lab"
    assert fallback["candidate_keys"][0] == key
    assert contract.lookup_name(LOOKALIKE) == {}
    assert contract.lookup_skeleton(key) == original["record"]
    with direct_vm.expect_revert("Only the holder"):
        contract.release("modern")
    direct_vm.sender = direct_alice
    contract.release("modern")
    assert contract.lookup_skeleton(key) == contract.lookup_name("modern") == {}
    direct_vm.sender = direct_bob
    assert contract.reserve(LOOKALIKE, LOOKALIKE)["record"]["skeleton_key"] == key
    assert contract.lookup_name("modern-lab") == fallback["record"]


def test_validator_refetches_and_rejects_changed_mapping(registry, direct_vm, direct_alice):
    contract, module = registry
    direct_vm.sender = direct_alice
    result = contract.reserve("modern", "modern")
    assert direct_vm.run_validator()
    forged = {"data_sha256": module.UNICODE_SHA256, "names": ["modern"], "skeletons": ["modern"]}
    assert not direct_vm.run_validator(leader_result=json.dumps(forged, sort_keys=True, separators=(",", ":")))
    direct_vm.clear_mocks()
    direct_vm.mock_web(re.escape(module.UNICODE_URL) + "$", {
        "method": "GET", "response": {"status": 200, "headers": {}, "body": ROWS[:-3]},
    })
    assert not direct_vm.run_validator()
    with direct_vm.expect_revert("Unicode source failed integrity"):
        contract.reserve("garden", "garden")
    assert contract.lookup_name("garden") == {}
    assert contract.lookup_name("modern") == result["record"]


@pytest.mark.parametrize("name", ["ab", "-abc", "abc-", "ABC", "a\u200bbc", "a\u0301bc", "a" * 25])
def test_profile_rejects_unsupported_labels(registry, direct_vm, name):
    contract, _ = registry
    with direct_vm.expect_revert("outside the supported"):
        contract.reserve(name, "modern")
