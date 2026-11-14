"""Losslessly compact only this audit's own native byte evidence.

Horizontal byte differences are a reversible compression prefilter, not a
scientific conversion. Every decoded byte is verified against its original hash.
"""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np

here = Path(__file__).resolve().parent
receipt_path = here / 'native-patch-http-receipts.json'
if not receipt_path.exists():
    receipt_path = here / 'native-patch-http-receipts.json.gz'
    receipts = json.loads(gzip.decompress(receipt_path.read_bytes()))
else:
    receipts = json.loads(receipt_path.read_text())
assert here.is_relative_to(Path('D:/Projects/REDLINE/docs/evidence/scientific-gate-resolution').resolve())
saved_before = 0
saved_after = 0
for r in receipts['patches'] + receipts['ctx']:
    old_path = here / r['file']
    old_file = old_path.read_bytes()
    old_payload = gzip.decompress(old_file) if old_path.suffix == '.gz' else old_file
    if r.get('encoding') == 'horizontal-delta-u8-gzip':
        continue
    raw = old_payload
    expected = r.get('rawSha256', r.get('sha256'))
    assert hashlib.sha256(raw).hexdigest() == expected
    width = r['size'] if 'size' in r else (5322 if r['file'].startswith('ctx-crop') else None)
    if width:
        matrix = np.frombuffer(raw, dtype=np.uint8).reshape(-1, width)
        delta = matrix.copy()
        delta[:,1:] = matrix[:,1:] - matrix[:,:-1]
        restored = np.cumsum(delta, axis=1, dtype=np.uint8).tobytes()
        assert restored == raw
        compressed = gzip.compress(delta.tobytes(), compresslevel=9, mtime=0)
        filename = old_path.name.removesuffix('.gz') + '.delta.gz'
        encoding = 'horizontal-delta-u8-gzip'
    else:
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        filename = old_path.name.removesuffix('.gz') + '.gz'
        encoding = 'gzip'
    new_path = here / filename
    assert new_path.parent == here
    new_path.write_bytes(compressed)
    r['file'] = filename
    r['encoding'] = encoding
    r['compressionRowWidth'] = width
    r['compressedBytes'] = len(compressed)
    saved_before += len(old_file)
    saved_after += len(compressed)
    if old_path != new_path:
        old_path.unlink()
receipts['compression'] = 'Standard gzip with reversible horizontal modulo256 byte-difference prefilter. Decoder restores native octets and verifies original SHA256. No resampling or scientific values are changed.'
out = here / 'native-patch-http-receipts.json.gz'
out.write_bytes(gzip.compress((json.dumps(receipts, indent=2)+'\n').encode(), compresslevel=9, mtime=0))
if receipt_path != out:
    receipt_path.unlink()
print(json.dumps({'originalStoredBytes': saved_before, 'compactedStoredBytes': saved_after, 'bytesSaved': saved_before-saved_after, 'receiptGzipBytes': out.stat().st_size}))
