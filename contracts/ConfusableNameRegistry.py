# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import hashlib
import json
import re
from unicodedata import normalize

from genlayer import TreeMap, gl

UNICODE_URL = (
    "https://raw.githubusercontent.com/unicode-org/unicodetools/main/"
    "unicodetools/data/security/16.0.0/confusables.txt"
)
RELEASE_URL = "https://www.unicode.org/Public/security/16.0.0/confusables.txt"
UNICODE_SHA256 = "95bd0aad6dced5ebc63436f459c06ab21a8d107cd842fb57f5c3a1e91bca8611"
ALNUM = "a-z0-9\u03b1-\u03c9\u0430-\u044f"
NAME = re.compile("[" + ALNUM + "][" + ALNUM + "-]{1,22}[" + ALNUM + "]")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def validate_name(name):
    if not isinstance(name, str) or not NAME.fullmatch(name):
        raise gl.vm.UserError("Name is outside the supported 3-24 character profile")


def skeleton_report(body, names):
    if not isinstance(body, bytes) or not 0 < len(body) <= 800000:
        raise ValueError("Invalid Unicode data size")
    if sha256(body) != UNICODE_SHA256:
        raise ValueError("Unicode release digest mismatch")
    decomposed = [normalize("NFD", name) for name in names]
    needed = set("".join(decomposed))
    mappings = {}
    for line in body.splitlines():
        if not line or line.startswith(b"#"):
            continue
        fields = line.split(b"#", 1)[0].split(b";")
        if len(fields) != 3 or fields[2].strip() != b"MA":
            raise ValueError("Malformed Unicode mapping")
        source = chr(int(fields[0], 16))
        if source not in needed:
            continue
        if source in mappings:
            raise ValueError("Duplicated Unicode mapping")
        mappings[source] = "".join(chr(int(code, 16)) for code in fields[1].split())
    skeletons = [
        normalize("NFD", "".join(mappings.get(char, char) for char in name))
        for name in decomposed
    ]
    return {"data_sha256": UNICODE_SHA256, "names": names, "skeletons": skeletons}


def acquire(names):
    def evaluate():
        for url in (UNICODE_URL, RELEASE_URL):
            try:
                response = gl.nondet.web.get(url)
                if response.status == 200:
                    return canonical(skeleton_report(response.body, names))
            except Exception:
                continue
        raise gl.vm.UserError("Unicode source failed integrity or acquisition checks")

    def validate(leader):
        if not isinstance(leader, gl.vm.Return):
            return False
        try:
            return evaluate() == leader.calldata
        except Exception:
            return False

    return json.loads(gl.vm.run_nondet_unsafe(evaluate, validate))


class ConfusableNameRegistry(gl.Contract):
    slots: TreeMap[str, str]
    names: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def reserve(self, primary: str, fallback: str) -> dict:
        validate_name(primary)
        validate_name(fallback)
        candidates = [primary] if primary == fallback else [primary, fallback]
        evidence = acquire(candidates)
        key_list = [sha256(text.encode("utf-8")) for text in evidence["skeletons"]]
        for name, skeleton, key in zip(candidates, evidence["skeletons"], key_list):
            if key in self.slots:
                continue
            record = {"name": name, "owner": str(gl.message.sender_address).lower(),
                      "skeleton": skeleton, "skeleton_key": key,
                      "data_sha256": evidence["data_sha256"]}
            self.slots[key] = canonical(record)
            self.names[name] = key
            return {"status": "RESERVED", "record": record, "candidate_keys": key_list}
        return {"status": "COLLISION", "candidate_keys": key_list}

    @gl.public.write
    def release(self, name: str) -> None:
        validate_name(name)
        record = self.lookup_name(name)
        if not record or record["owner"] != str(gl.message.sender_address).lower():
            raise gl.vm.UserError("Only the holder can release the exact name")
        del self.slots[record["skeleton_key"]]
        del self.names[name]

    @gl.public.view
    def lookup_name(self, name: str) -> dict:
        key = self.names.get(name, "")
        return self.lookup_skeleton(key) if key else {}

    @gl.public.view
    def lookup_skeleton(self, skeleton_key: str) -> dict:
        return json.loads(self.slots[skeleton_key]) if skeleton_key in self.slots else {}
