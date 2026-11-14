"""Inspect exact stored product relationships without transferring accuracy."""
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
HEIGHT = HERE.parent / 'provenance-height'
receipts = json.loads((HEIGHT / 'http-receipts.json').read_bytes())
for receipt in receipts:
    data = (HEIGHT / receipt['file']).read_bytes()
    assert len(data) == receipt['bytes']
    assert hashlib.sha256(data).hexdigest() == receipt['sha256']
    assert receipt['status'] in [200, 206]
label_bytes = (HEIGHT / 'hirise-dtm-complete.lbl').read_bytes()
assert hashlib.sha256(label_bytes).hexdigest() == '220e7ff937b18d6eaf5e2eb712c452980053daf6ca9f468bf21219577173d5cd'
assert (HEIGHT / 'hirise-dtm-label-range.bin').read_bytes().startswith(label_bytes)
label = label_bytes.decode('latin1')
page = (HEIGHT / 'hirise-product.html').read_text(encoding='utf-8')


def number(name):
    found = re.search(r'^\s*' + name + r'\s*=\s*"?([-+\d.eE]+)', label, re.M)
    assert found, name
    return float(found[1])


product = re.search(r'^PRODUCT_ID\s*=\s*"([^"]+)"', label, re.M).group(1)
assert product == 'DTEEC_023524_1985_023379_1985_U01'
source_pair = re.search(r'^SOURCE_PRODUCT_ID\s*=\s*\(([^)]+)\)', label, re.M).group(1).split(', ')
assert source_pair == ['ESP_023524_1985', 'ESP_023379_1985']
orthophotos = sorted(set(re.findall(r'(ESP_023(?:524|379)_1985_RED_[AC]_01_ORTHO\.JP2)', page)))
assert len(orthophotos) == 4
hirise_bounds = [number('WESTERNMOST_LONGITUDE'), number('MINIMUM_LATITUDE'), number('EASTERNMOST_LONGITUDE'), number('MAXIMUM_LATITUDE')]
manifest = json.loads((ROOT / 'public/data/jezero-terrain-grid.json').read_bytes())
coordinates = [c['coordinate'] for c in manifest['outerCorners']]
crop_bounds = [min(c[0] for c in coordinates), min(c[1] for c in coordinates), max(c[0] for c in coordinates), max(c[1] for c in coordinates)]
overlap = max(hirise_bounds[0], crop_bounds[0]) <= min(hirise_bounds[2], crop_bounds[2]) and max(hirise_bounds[1], crop_bounds[1]) <= min(hirise_bounds[3], crop_bounds[3])
assert not overlap
ctx_xml = ROOT / 'docs/evidence/scientific-gate-resolution/registration/controlled-ctx-native.xml'
tree = ET.parse(ctx_xml)
assert float(tree.findtext('.//horizpav')) == 9.6
assert float(tree.findtext('.//vertaccv')) == 3.8
lineage = tree.findtext('.//procdesc')
assert 'High Resolution Stereo Camera (HRSC) Level 5 DTM' in lineage
assert 'allowing only a translation adjustment' in lineage
vertical_description = tree.findtext('.//vertacce')
assert '183.3 meters' in vertical_description
result = {
    'status': 'PASS: exact saved HiRISE identifiers, official linked orthophotos, non-overlap and controlled-CTX provider lineage checked.',
    'hirise': {
        'productId': product, 'version': number('PRODUCT_VERSION_ID'), 'sourcePair': source_pair,
        'associatedOrthophotos': orthophotos, 'boundsDegWestSouthEastNorth': hirise_bounds,
        'horizontalProjectionRadiusM': number('A_AXIS_RADIUS') * 1000,
        'standardParallelDeg': number('CENTER_LATITUDE'), 'centralMeridianDeg': number('CENTER_LONGITUDE'),
        'projectedPixelSpacingM': number('MAP_SCALE'),
        'heightContract': 'metres above Mars 2000 Datum equipotential surface; not the horizontal projection sphere',
        'completeLabelSha256': hashlib.sha256(label_bytes).hexdigest(),
        'orthoAssociationStatus': 'VERIFIED: exact official page associations; numerical internal-registration accuracy PARTIALLY VERIFIED by generic processing documentation only.',
        'exactProductIndependentControlOrResiduals': 'UNVERIFIED: no such records provided by the saved product page or complete DTM label.',
    },
    'currentCropBoundsDegWestSouthEastNorth': crop_bounds,
    'requestedHiriseOverlapsLiveCrop': overlap,
    'eastWestAngularSeparationDeg': hirise_bounds[0] - crop_bounds[2],
    'directRequestedHiriseToLiveCropRegistration': 'NOT APPLICABLE: no common geographic coverage; requested DTM cannot validate live-crop feature/elevation samples.',
    'requestedHiriseToFullCtxRegistration': 'UNVERIFIED: native product envelopes can overlap outside live crop, but no exact paired controls were measured here.',
    'controlledCtxProviderLineage': {
        'sourceXml': ctx_xml.relative_to(ROOT).as_posix(),
        'averageRelativeImageDisplacementM': 9.6,
        'relativeDtmVerticalRegistrationM': 3.8,
        'documentedVerticalAdjustmentToHrscM': 183.3,
        'reference': 'DLR/HRSC Mars 2020 Level 5 DTM',
        'qualification': 'Provider relative-processing metrics, not REDLINE absolute residuals, MDIM alignment, native-cell uncertainty or a correction to apply.'
    },
    'registrationGaps': [
        'Exact HiRISE DTM/ortho control-point identities, distributions, covariance and held-out residuals.',
        'Independent controlled-CTX/DEM ground controls and justified positional acceptance criterion over the live crop.',
        'A compatible MDIM2.1-to-local control-network transform or precise landmark definitions and uncertainty.',
        'Exact preliminary CTX native latitude/projection and measured cross-product residuals.',
        'A source quality mask locating individual stereo/fill provenance, including the northwest HRSC-backed imagery fill.',
        'Product-specific MOLA vertical tie information and source-datum model needed for absolute height conversion; owned by provenance-height lane.'
    ]
}
(HERE / 'dataset-relationships.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
