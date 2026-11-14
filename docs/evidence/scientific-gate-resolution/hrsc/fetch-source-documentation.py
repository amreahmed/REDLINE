"""Bounded HTTPS evidence downloads; --verify-saved performs no network calls."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from urllib.request import urlopen


DIRECTORY = Path(__file__).resolve().parent
SOURCES = [
    ("hrsc-usage-imprint.html", "https://hrscteam.dlr.de/imprint_hrsc_en.php"),
    ("hrsc-methodology-2016.html", "https://elib.dlr.de/109617/"),
    ("hrsc-methodology-2010.html", "https://elib.dlr.de/68116/"),
]


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main():
    receipt_path = DIRECTORY / "source-documentation-receipts.json"
    saved = "--verify-saved" in sys.argv
    receipts = json.loads(receipt_path.read_text()) if receipt_path.exists() else []
    by_file = {receipt["file"]: receipt for receipt in receipts}
    results = []
    for file, url in SOURCES:
        output = DIRECTORY / file
        if file in by_file:
            receipt = by_file[file]
            body = output.read_bytes()
            assert receipt["requestedUrl"] == url and receipt["status"] == 200
            assert len(body) == receipt["bytes"] and hashlib.sha256(body).hexdigest() == receipt["sha256"]
        else:
            assert not saved, f"Missing source documentation: {file}"
            started = now()
            with urlopen(url, timeout=45) as response:
                assert response.status == 200
                body = response.read(1_000_001)
                assert len(body) <= 1_000_000, "Source documentation exceeds download cap"
                receipt = {"file": file, "requestedUrl": url, "finalUrl": response.url,
                           "startedAt": started, "retrievedAt": now(), "status": response.status,
                           "contentType": response.headers.get("Content-Type"),
                           "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}
            output.write_bytes(body)
            receipts.append(receipt)
            receipt_path.write_bytes((json.dumps(receipts, indent=2) + "\n").encode())
        results.append({"file": file, "status": receipt["status"], "bytes": receipt["bytes"], "sha256": receipt["sha256"]})
    print(json.dumps({"result": "PASS", "mode": "offline verification" if saved else "bounded source documentation", "sources": results}, indent=2))


if __name__ == "__main__":
    main()
