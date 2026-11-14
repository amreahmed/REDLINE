"""Stdlib recomputation of retained image-texture residuals in explicit units.

This is a relative image diagnostic. Expected locations are coordinate-contract
predictions, not independent surveyed truth. Nothing is corrected or resampled.
"""
import csv
import gzip
import hashlib
import json
import math
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OLD = ROOT / 'docs/evidence/scientific-gate-resolution/registration'
R = 3396190.0
CTX_PIXEL_M = 6.0
CTX_ORIGIN = [4573663.250853, 1109693.140188]
PLACES_ORIGIN = [4340890.0, 1097070.0]
COS_PARALLEL = math.cos(math.radians(18.4663))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def lonlat(point):
    return [math.degrees(point[0] / R), math.degrees(point[1] / R)]


def spherical_distance(a, b):
    """Stable unit-vector central angle on the declared Mars sphere."""
    lon1, lat1 = [v / R for v in a]
    lon2, lat2 = [v / R for v in b]
    u = [math.cos(lat1) * math.cos(lon1), math.cos(lat1) * math.sin(lon1), math.sin(lat1)]
    v = [math.cos(lat2) * math.cos(lon2), math.cos(lat2) * math.sin(lon2), math.sin(lat2)]
    cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    return R * math.atan2(math.sqrt(sum(c * c for c in cross)), sum(x * y for x, y in zip(u, v)))


def stats(values):
    return {'count': len(values), 'rms': math.sqrt(statistics.mean(v * v for v in values)), 'median': statistics.median(values), 'maximum': max(values)}


def pair_median(values):
    return [statistics.median(v[i] for v in values) for i in range(2)]


source_bytes = (OLD / 'native-image-registration.json').read_bytes()
source = json.loads(source_bytes)
reproduced = gzip.decompress((HERE / 'reproduced-native-image-registration.json.gz').read_bytes())
assert reproduced == source_bytes
manifest_bytes = (ROOT / 'public/data/jezero-terrain-grid.json').read_bytes()
binary_bytes = (ROOT / 'public/data/jezero-terrain-grid.f32').read_bytes()
assert digest(manifest_bytes) == 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9'
assert digest(binary_bytes) == '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8'
manifest = json.loads(manifest_bytes)
patches = source['patches']
assert len(patches) == 9
translation = pair_median([pair_median([c['placesMatchOffsetInCtxProjectionM'] for c in p['candidates'] if c['retainedForDiagnostic']]) for p in patches if p['diagnosticSplit'] == 'fit'])
assert translation == source['translationDiagnosticM']
selected = source['selectedSpatialTies']['ties']
selected_translation = pair_median([c['placesMatchOffsetInCtxProjectionM'] for c in selected if c['diagnosticSplit'] == 'fit'])
assert selected_translation == source['selectedSpatialTies']['translationDiagnosticM']
rows = []
sampled_coordinates = []
maximum_native_roundtrip_error_pixel = 0.0
for set_name, ties, offset in [
    ('broad', [(c, p['diagnosticSplit']) for p in patches for c in p['candidates'] if c['retainedForDiagnostic']], translation),
    ('multiscale_subset', [(c, c['diagnosticSplit']) for c in selected], selected_translation),
]:
    for tie, split in ties:
        line, sample = tie['ctxNativeLineSampleCentreIndex']
        centre = [CTX_ORIGIN[0] + (sample + .5) * CTX_PIXEL_M, CTX_ORIGIN[1] - (line + .5) * CTX_PIXEL_M]
        assert centre == tie['ctxProjectionCentreM']
        dx, dy = tie['placesMatchOffsetInCtxProjectionM']
        assert dx == tie['variants']['21']['displacementPixelXY'][0] * 6
        assert dy == -tie['variants']['21']['displacementPixelXY'][1] * 6
        matched = [centre[0] + dx, centre[1] + dy]
        expected = [centre[0] + offset[0], centre[1] + offset[1]]
        residual = [dx - offset[0], dy - offset[1]]
        reference_residual = tie['translationResidualM'] if set_name == 'broad' else tie['selectedTieTranslationResidualM']
        assert residual == reference_residual
        computed_places = [(PLACES_ORIGIN[1] - matched[1]) / .25, (matched[0] * COS_PARALLEL - PLACES_ORIGIN[0]) / .25]
        error = max(abs(a - b) for a, b in zip(computed_places, tie['placesMatchedNativeCornerLineSample']))
        maximum_native_roundtrip_error_pixel = max(maximum_native_roundtrip_error_pixel, error)
        assert error < 1e-8, 'Native pixel roundtrip differs beyond floating-point arithmetic.'
        coordinates = lonlat(centre)
        if set_name == 'broad':
            sampled_coordinates.append(coordinates)
        row = {
            'set': set_name, 'tie': tie['id'], 'patch': tie['patch'], 'split': split,
            'ctx_native_line_center_index': line, 'ctx_native_sample_center_index': sample,
            'ctx_longitude_deg': coordinates[0], 'ctx_planetocentric_latitude_deg': coordinates[1],
            'places_matched_corner_line': computed_places[0], 'places_matched_corner_sample': computed_places[1],
            'raw_offset_easting_projected_m': dx, 'raw_offset_northing_projected_m': dy,
            'raw_offset_projected_norm_m': math.hypot(dx, dy),
            'raw_offset_surface_m': spherical_distance(centre, matched),
            'residual_easting_projected_m': residual[0], 'residual_northing_projected_m': residual[1],
            'residual_longitude_deg': math.degrees(residual[0] / R),
            'residual_latitude_deg': math.degrees(residual[1] / R),
            'residual_angular_plane_norm_deg': math.degrees(math.hypot(*residual) / R),
            'residual_projected_norm_m': math.hypot(*residual),
            'residual_surface_m': spherical_distance(expected, matched),
            'residual_ctx_column_pixels': residual[0] / 6,
            'residual_ctx_row_pixels': -residual[1] / 6,
            'residual_ctx_pixel_norm': math.hypot(*residual) / 6,
            'maximum_template_sensitivity_projected_m': tie['templateSizeSensitivityMaximumM'],
            'nominal_ncc': tie['variants']['21']['peakNcc'],
        }
        rows.append(row)

with (HERE / 'relative-image-residuals.csv').open('w', newline='', encoding='utf-8') as stream:
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

groups = {}
for set_name in ['broad', 'multiscale_subset']:
    groups[set_name] = {}
    for split in ['fit', 'held_out']:
        selected_rows = [r for r in rows if r['set'] == set_name and r['split'] == split]
        fields = ['raw_offset_projected_norm_m', 'raw_offset_surface_m', 'residual_projected_norm_m', 'residual_surface_m', 'residual_angular_plane_norm_deg', 'residual_ctx_pixel_norm']
        groups[set_name][split] = {field: stats([r[field] for r in selected_rows]) for field in fields}
        reference = source[('fitResiduals' if split == 'fit' else 'heldOutResiduals')] if set_name == 'broad' else source['selectedSpatialTies'][('fitResiduals' if split == 'fit' else 'heldOutResiduals')]
        computed = groups[set_name][split]['residual_projected_norm_m']
        assert computed['count'] == reference['count']
        assert math.isclose(computed['rms'], reference['rmsM'], rel_tol=1e-13, abs_tol=1e-13)
        assert math.isclose(computed['maximum'], reference['maximumM'], rel_tol=1e-13, abs_tol=1e-13)

summary = {
    'status': 'PASS: saved native matching, coordinate contracts, retained residuals and pixel roundtrips reproduced; no absolute registration claim.',
    'inputMeasurementSha256': digest(source_bytes),
    'referenceSurface': {'radiusM': R, 'latitude': 'planetocentric', 'longitude': 'positive east', 'projection': 'equirectangular lat_ts=lon0=0'},
    'placesToCtxCoordinateTransform': {'matrix': [[1 / COS_PARALLEL, 0, 0], [0, 1, 0], [0, 0, 1]], 'equations': 'x_CTX=x_PLACES/cos(18.4663 degrees); y_CTX=y_PLACES', 'meaning': 'Source projection change with the same sphere and coordinate convention, not a fitted image scale/rotation or correction.'},
    'units': {
        'angular': 'Residual dx/R and dy/R expressed in degrees. Angular-plane norm is a coordinate-space diagnostic, not a ground distance.',
        'surface': 'Exact central angle atan2(norm(cross(u,v)),dot(u,v)) times R between translated prediction and matched coordinate; no datum or geodetic-control accuracy implied.',
        'pixels': 'Native controlled-CTX pixels: column=dx/6; row=-dy/6. PLACES native matched coordinates use its own 0.25m projected spacing. No HiRISE pixel accuracy inferred.',
    },
    'translationDiagnosticProjectedM': translation,
    'multiscaleTranslationDiagnosticProjectedM': selected_translation,
    'residualGroups': groups,
    'patches': [{'id': p['id'], 'split': p['diagnosticSplit'], 'candidateCount': p['candidateCount'], 'retainedCount': p['retainedCount'], 'validMatchingFraction': p['validMatchingPixelFraction']} for p in patches],
    'broadSampleBoundsDeg': {'west': min(c[0] for c in sampled_coordinates), 'east': max(c[0] for c in sampled_coordinates), 'south': min(c[1] for c in sampled_coordinates), 'north': max(c[1] for c in sampled_coordinates)},
    'unsampledNorthernCropStripM': manifest['outerCorners'][0]['projectedM'][1] - PLACES_ORIGIN[1],
    'maximumNativePixelRoundtripArithmeticDifference': maximum_native_roundtrip_error_pixel,
    'tableRows': len(rows),
    'preservedGridCells': len(binary_bytes) // 4,
    'limitations': [
        '159 nominal ties and 8 selected ties are image-texture correspondences, not geographically named independent survey controls.',
        'Five fit patches and four held-out patches were fixed before matching. Held-out ties are independent of fitting, not of shared provider photogrammetric control.',
        'Translation is descriptive and unapplied. Rotation and scale are fixed by coordinate contracts; neither is independently estimated.',
        'No acceptance threshold, absolute uncertainty bound or unsampled-area accuracy is established.',
        'Template-size sensitivity is not a statistical confidence interval. A broad tie varies by 47.792m; strong subset maximum is 2.392m.',
        'The requested HiRISE DTM is geographically separate; its source reference cannot be transferred to the live CTX grid.'
    ],
}
(HERE / 'independent-residual-summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': summary['status'], 'groups': groups, 'tableRows': len(rows), 'sampleBounds': summary['broadSampleBoundsDeg'], 'maximumNativePixelRoundtripArithmeticDifference': maximum_native_roundtrip_error_pixel}, indent=2))
