"""Re-execute preserved registration calculations without rewriting old evidence.

Only the output/plot section is omitted. Source bytes, native inputs, matching
parameters and all calculations through result construction remain unchanged.
"""
import gzip
import hashlib
import importlib.metadata
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ORIGINAL = ROOT / 'docs/evidence/scientific-gate-resolution/registration/measure-native-registration.py'
EXPECTED_SOURCE_SHA256 = 'b56d65cd491b9d3f380f97479f14fb675d3b8205d8a85337b52a0ab028ec166b'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


raw_source = ORIGINAL.read_bytes()
assert sha256(raw_source) == EXPECTED_SOURCE_SHA256, 'Preserved measurement source changed.'
source = raw_source.decode('utf-8')
write_marker = "(here / 'native-image-registration.json').write_text"
assert source.count(write_marker) == 1
calculations = source.split(write_marker)[0]
for filename in ['native-image-match-blocker.json', 'native-image-match-blocker.png']:
    calculations = calculations.replace("here / '" + filename + "'", "output_dir / '" + filename + "'")
namespace = {'__file__': str(ORIGINAL), '__name__': '__registration_reproduction__', 'output_dir': HERE}
exec(compile(calculations, str(ORIGINAL), 'exec'), namespace)
result = namespace['result']
canonical_text = json.dumps(result, indent=2) + '\n'
saved = (ORIGINAL.parent / 'native-image-registration.json').read_bytes()
assert result == json.loads(saved), 'Recomputed measurement object differs from preserved evidence.'
assert canonical_text == saved.decode('utf-8').replace('\r\n', '\n'), 'Recomputed canonical serialized measurements differ.'
saved_newline = '\r\n' if b'\r\n' in saved else '\n'
serialized = canonical_text.replace('\n', saved_newline).encode('utf-8')
assert serialized == saved, 'Recomputed serialized measurements differ from preserved bytes.'
(HERE / 'reproduced-native-image-registration.json.gz').write_bytes(gzip.compress(serialized, mtime=0))
summary = {
    'sourceScript': ORIGINAL.relative_to(ROOT).as_posix(),
    'sourceScriptSha256': sha256(raw_source),
    'executionScope': 'Original calculation source through result construction; output/plot section omitted; any blocker output redirected to this directory.',
    'savedMeasurementSha256': sha256(saved),
    'reproducedMeasurementSha256': sha256(serialized),
    'byteIdentical': serialized == saved,
    'savedNewline': 'CRLF' if saved_newline == '\r\n' else 'LF',
    'packages': {name: importlib.metadata.version(name) for name in ['rasterio', 'opencv-python-headless', 'matplotlib', 'numpy']},
    'preservedApplicationFiles': result['preservedApplicationFiles'],
    'translationDiagnosticM': result['translationDiagnosticM'],
    'fitResiduals': result['fitResiduals'],
    'heldOutResiduals': result['heldOutResiduals'],
    'maximumTemplateSizeSensitivityM': result['maximumTemplateSizeSensitivityM'],
    'selectedSpatialTies': {key: value for key, value in result['selectedSpatialTies'].items() if key != 'ties'},
    'qualification': 'Reproducibility of relative image matching is verified; independent absolute geodetic registration and named-feature accuracy are not established.'
}
(HERE / 'native-matching-reproduction-summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, indent=2))
