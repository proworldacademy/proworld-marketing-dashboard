#!/usr/bin/env python3
"""pwdata.py — read and write the PROWORLD site's encrypted memory from a checkout of the repository.

The site's memory is the set of documents under data/<collection>/<id>.json, each encrypted with the team
passcode (AES-256-GCM, key from PBKDF2-SHA256), plus data/index.json (plaintext: kdf parameters, a passcode
check and a {collection/id: {rev, at}} listing) and assets/fonts.css.enc (the brand fonts, same encryption).
The browser (shared/store.js) and this tool read and write the same format.

Typical engine run (a clone of the repository in REPO):
    python3 tools/pwdata.py decrypt --repo REPO --out WORK            # WORK/<col>/<id>.json, plaintext bodies
    ... edit the JSON files in WORK (bodies are {v, at, ...}) ...
    python3 tools/pwdata.py encrypt --repo REPO --src WORK            # re-encrypts only what changed, updates index.json
    git -C REPO add -A data && git -C REPO commit -m "engine: ..." && git -C REPO push

The passcode comes from --passcode, the PW_PASSCODE environment variable, or a file named by --passcode-file.
Never print it, never commit it.

Other commands:
    init    --repo REPO --src WORK --fonts fonts.css        build data/ and assets/fonts.css.enc from scratch
    rekey   --repo REPO --new-passcode-file F               re-encrypt everything with a new passcode
    check   --repo REPO                                      verify the passcode and list the documents
"""
import argparse, base64, hashlib, json, os, sys, unicodedata
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ITER = 250000
b64 = lambda b: base64.b64encode(b).decode()
unb64 = lambda s: base64.b64decode(s)


def derive(passcode, salt_b64, iters):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=unb64(salt_b64), iterations=iters)
    return kdf.derive(unicodedata.normalize("NFKC", passcode).encode("utf-8"))


def enc(key, text, salt_b64, iters):
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, text.encode("utf-8"), None)
    return {"alg": "A256GCM", "kdf": "PBKDF2-SHA256", "iter": iters, "salt": salt_b64, "iv": b64(iv), "ct": b64(ct)}


def dec(key, obj):
    return AESGCM(key).decrypt(unb64(obj["iv"]), unb64(obj["ct"]), None).decode("utf-8")


def dumps(obj):
    # the exact text written to the repository; rev = sha256 of this text (matches store.js)
    return json.dumps(obj, separators=(",", ":"))


def rev_of(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_index(repo):
    p = os.path.join(repo, "data", "index.json")
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save_index(repo, idx):
    p = os.path.join(repo, "data", "index.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(idx, f, indent=1, ensure_ascii=False)
        f.write("\n")


def get_passcode(a, attr="passcode", fattr="passcode_file", env="PW_PASSCODE"):
    v = getattr(a, attr, None)
    if v:
        return v
    fp = getattr(a, fattr, None)
    if fp:
        with open(fp, encoding="utf-8") as f:
            return f.read().strip()
    if os.environ.get(env):
        return os.environ[env]
    sys.exit("passcode missing: use --passcode, --passcode-file or PW_PASSCODE")


def open_key(repo, passcode):
    idx = load_index(repo)
    key = derive(passcode, idx["kdf"]["salt"], idx["kdf"]["iter"])
    try:
        if dec(key, idx["check"]) != "PROWORLD":
            raise ValueError
    except Exception:
        sys.exit("wrong passcode")
    return idx, key


def walk_docs(repo):
    base = os.path.join(repo, "data")
    for col in sorted(os.listdir(base)):
        cp = os.path.join(base, col)
        if not os.path.isdir(cp):
            continue
        for fn in sorted(os.listdir(cp)):
            if fn.endswith(".json"):
                yield col, fn[:-5], os.path.join(cp, fn)


def cmd_check(a):
    idx, key = open_key(a.repo, get_passcode(a))
    n = 0
    for col, did, path in walk_docs(a.repo):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        body = json.loads(dec(key, json.loads(text)))
        listed = (idx.get("docs") or {}).get(col + "/" + did)
        flag = "" if listed and listed.get("rev") == rev_of(text) else "  (not in index / rev differs)"
        print(f"{col}/{did}  at={body.get('at','?')}{flag}")
        n += 1
    print(f"{n} documents · passcode OK")


def cmd_decrypt(a):
    idx, key = open_key(a.repo, get_passcode(a))
    os.makedirs(a.out, exist_ok=True)
    n = 0
    for col, did, path in walk_docs(a.repo):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        body = json.loads(dec(key, json.loads(text)))
        od = os.path.join(a.out, col)
        os.makedirs(od, exist_ok=True)
        with open(os.path.join(od, did + ".json"), "w", encoding="utf-8") as f:
            json.dump(body, f, indent=1, ensure_ascii=False)
        n += 1
    # remember what was decrypted so `encrypt` only rewrites real changes
    snap = {}
    for col in os.listdir(a.out):
        cp = os.path.join(a.out, col)
        if os.path.isdir(cp):
            for fn in os.listdir(cp):
                if fn.endswith(".json"):
                    with open(os.path.join(cp, fn), encoding="utf-8") as f:
                        snap[col + "/" + fn[:-5]] = hashlib.sha256(f.read().encode()).hexdigest()
    with open(os.path.join(a.out, ".pwdata-snapshot.json"), "w") as f:
        json.dump(snap, f)
    print(f"{n} documents decrypted to {a.out}")


def cmd_encrypt(a):
    idx, key = open_key(a.repo, get_passcode(a))
    salt, iters = idx["kdf"]["salt"], idx["kdf"]["iter"]
    docs = idx.setdefault("docs", {})
    snap = {}
    sp = os.path.join(a.src, ".pwdata-snapshot.json")
    if os.path.exists(sp):
        with open(sp) as f:
            snap = json.load(f)
    written, removed, unchanged = [], [], 0
    present = set()
    for col in sorted(os.listdir(a.src)):
        cp = os.path.join(a.src, col)
        if not os.path.isdir(cp):
            continue
        for fn in sorted(os.listdir(cp)):
            if not fn.endswith(".json"):
                continue
            did = fn[:-5]
            k = col + "/" + did
            present.add(k)
            with open(os.path.join(cp, fn), encoding="utf-8") as f:
                raw = f.read()
            if snap.get(k) == hashlib.sha256(raw.encode()).hexdigest() and k in docs:
                unchanged += 1
                continue
            body = json.loads(raw)
            if not isinstance(body, dict) or "v" not in body:
                sys.exit(f"{k}: a document body must be an object with a 'v' key")
            text = dumps(enc(key, json.dumps(body, ensure_ascii=False, separators=(",", ":")), salt, iters))
            od = os.path.join(a.repo, "data", col)
            os.makedirs(od, exist_ok=True)
            with open(os.path.join(od, did + ".json"), "w", encoding="utf-8") as f:
                f.write(text)
            docs[k] = {"rev": rev_of(text), "at": body.get("at") or ""}
            written.append(k)
    if a.prune:
        for k in list(docs):
            if k not in present and k in snap:
                col, did = k.split("/", 1)
                p = os.path.join(a.repo, "data", col, did + ".json")
                if os.path.exists(p):
                    os.remove(p)
                del docs[k]
                removed.append(k)
    if written or removed:
        import datetime
        idx["updatedAt"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        save_index(a.repo, idx)
    print(f"written {len(written)}: {', '.join(written) or '-'}")
    if removed:
        print(f"removed {len(removed)}: {', '.join(removed)}")
    print(f"unchanged {unchanged}")


def build_all(repo, src, passcode, fonts_path=None, old_key=None, old_idx=None):
    import datetime
    salt = b64(os.urandom(16))
    key = derive(passcode, salt, ITER)
    docs = {}
    base = os.path.join(repo, "data")
    os.makedirs(base, exist_ok=True)
    if src:
        for col in sorted(os.listdir(src)):
            cp = os.path.join(src, col)
            if not os.path.isdir(cp):
                continue
            for fn in sorted(os.listdir(cp)):
                if not fn.endswith(".json"):
                    continue
                with open(os.path.join(cp, fn), encoding="utf-8") as f:
                    body = json.load(f)
                if not isinstance(body, dict) or "v" not in body:
                    sys.exit(f"{col}/{fn}: a document body must be an object with a 'v' key")
                text = dumps(enc(key, json.dumps(body, ensure_ascii=False, separators=(",", ":")), salt, ITER))
                od = os.path.join(base, col)
                os.makedirs(od, exist_ok=True)
                with open(os.path.join(od, fn), "w", encoding="utf-8") as f:
                    f.write(text)
                docs[col + "/" + fn[:-5]] = {"rev": rev_of(text), "at": body.get("at") or ""}
    fonts_css = None
    if fonts_path:
        with open(fonts_path, encoding="utf-8") as f:
            fonts_css = f.read()
    elif old_key is not None and os.path.exists(os.path.join(repo, "assets", "fonts.css.enc")):
        with open(os.path.join(repo, "assets", "fonts.css.enc"), encoding="utf-8") as f:
            fonts_css = dec(old_key, json.load(f))
    if fonts_css is not None:
        os.makedirs(os.path.join(repo, "assets"), exist_ok=True)
        with open(os.path.join(repo, "assets", "fonts.css.enc"), "w", encoding="utf-8") as f:
            f.write(dumps(enc(key, fonts_css, salt, ITER)))
    check = enc(key, "PROWORLD", salt, ITER)
    idx = {"kdf": {"salt": salt, "iter": ITER}, "check": {"iv": check["iv"], "ct": check["ct"]}, "docs": docs,
           "updatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")}
    save_index(repo, idx)
    return len(docs)


def cmd_init(a):
    n = build_all(a.repo, a.src, get_passcode(a), fonts_path=a.fonts)
    print(f"initialised data/ with {n} documents" + (" and the fonts bundle" if a.fonts else ""))


def cmd_rekey(a):
    import shutil, tempfile
    idx, key = open_key(a.repo, get_passcode(a))
    newp = get_passcode(a, "new_passcode", "new_passcode_file", "PW_NEW_PASSCODE")
    work = tempfile.mkdtemp()
    class A: pass
    d = A(); d.repo = a.repo; d.out = work; d.passcode = get_passcode(a)
    cmd_decrypt(d)
    # wipe the old ciphertext and rebuild
    base = os.path.join(a.repo, "data")
    for col in os.listdir(base):
        cp = os.path.join(base, col)
        if os.path.isdir(cp):
            shutil.rmtree(cp)
    n = build_all(a.repo, work, newp, old_key=key, old_idx=idx)
    shutil.rmtree(work)
    print(f"re-encrypted {n} documents and the fonts bundle with the new passcode")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    def common(sp):
        sp.add_argument("--repo", required=True, help="path to the repository checkout")
        sp.add_argument("--passcode"); sp.add_argument("--passcode-file")
    s = sub.add_parser("check"); common(s); s.set_defaults(fn=cmd_check)
    s = sub.add_parser("decrypt"); common(s); s.add_argument("--out", required=True); s.set_defaults(fn=cmd_decrypt)
    s = sub.add_parser("encrypt"); common(s); s.add_argument("--src", required=True); s.add_argument("--prune", action="store_true", help="also delete documents removed from --src (never used by the engine)"); s.set_defaults(fn=cmd_encrypt)
    s = sub.add_parser("init"); common(s); s.add_argument("--src"); s.add_argument("--fonts"); s.set_defaults(fn=cmd_init)
    s = sub.add_parser("rekey"); common(s); s.add_argument("--new-passcode"); s.add_argument("--new-passcode-file"); s.set_defaults(fn=cmd_rekey)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
