"""Reproduce the preserved PLACES frame audit with outputs isolated here."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ORIGINAL = ROOT / 'docs/evidence/scientific-gate-resolution/registration/inspect-places-frame.py'
raw = ORIGINAL.read_bytes()
source_hash = hashlib.sha256(raw).hexdigest()
assert source_hash == '86f7e0c52abc9a9d4411f60521dfc5bddf7cc0174d55e0727a385fb3fba1b148'
source = raw.decode('utf-8')
outputs = ['places-frame-check.json', 'native-patch-plan.json']
for filename in outputs:
    original = "(here / '" + filename + "').write_text"
    assert source.count(original) == 1
    source = source.replace(original, "(output_dir / '" + filename + "').write_text")
namespace = {'__file__': str(ORIGINAL), '__name__': '__frame_reproduction__', 'output_dir': HERE}
exec(compile(source, str(ORIGINAL), 'exec'), namespace)
for filename in outputs:
    assert (HERE / filename).read_bytes() == (ORIGINAL.parent / filename).read_bytes(), filename
result = namespace['result']
summary = {
    'sourceScript': ORIGINAL.relative_to(ROOT).as_posix(),
    'sourceScriptSha256': source_hash,
    'outputsByteIdentical': outputs,
    'csvRecordCount': result['csvRecordCount'],
    'matchedSiteCount': result['matchedSiteCount'],
    'localizedRoverRecordsInSols659To779': result['localizedRoverRecordsInSols659To779'],
    'currentVsArchivedSpkMaximumHorizontalDifferenceM': result['currentVsArchivedSpkMaximumHorizontalDifferenceM'],
    'qualification': 'Verified frame/pixel arithmetic and archive serialization agreement; no independent CTX control, observation date for SITE placeholders, or absolute geolocation accuracy is established.'
}
(HERE / 'frame-reproduction-summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, indent=2))
