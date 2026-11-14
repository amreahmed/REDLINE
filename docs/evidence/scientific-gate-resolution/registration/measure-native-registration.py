"""Bounded, reproducible relative imagery registration diagnostic.

This checks native image content, never named Gazetteer points or astronaut safety.
It leaves every native/app DEM value and all product coordinates unchanged.
"""
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path

import cv2
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from affine import Affine
from rasterio.warp import reproject, Resampling

here = Path(__file__).resolve().parent
root = here.parents[3]
cv2.setNumThreads(1)
def hash_bytes(v):
    return hashlib.sha256(v).hexdigest()

def tiff_tags(data):
    assert data[:4] == b'II*\x00'
    offset = struct.unpack_from('<I', data, 4)[0]
    count = struct.unpack_from('<H', data, offset)[0]
    tags = {}
    formats = {1: ('B', 1), 2: ('c', 1), 3: ('H', 2), 4: ('I', 4), 12: ('d', 8)}
    for i in range(count):
        start = offset+2+i*12
        tag, kind, n = struct.unpack_from('<HHI', data, start)
        if kind not in formats:
            continue
        fmt, width = formats[kind]
        p = start+8 if n*width <= 4 else struct.unpack_from('<I', data, start+8)[0]
        values = struct.unpack_from('<' + str(n) + fmt, data, p)
        tags[tag] = b''.join(values).decode('ascii') if kind == 2 else values
    return tags

def native_bytes(r):
    b = (here / r['file']).read_bytes()
    if r['file'].endswith('.gz'):
        b = gzip.decompress(b)
    if r.get('encoding') == 'horizontal-delta-u8-gzip':
        b = np.cumsum(np.frombuffer(b, dtype=np.uint8).reshape(-1, r['compressionRowWidth']), axis=1, dtype=np.uint8).tobytes()
    return b
if (here / 'native-patch-http-receipts.json.gz').exists():
    receipts = json.loads(gzip.decompress((here / 'native-patch-http-receipts.json.gz').read_bytes()))
else:
    receipts = json.loads((here / 'native-patch-http-receipts.json').read_text())
for r in receipts['ctx']:
    assert hash_bytes(native_bytes(r)) == r['sha256']
tags = tiff_tags(native_bytes(receipts['ctx'][0]))
assert tags[256] == (5322,) and tags[257] == (5040,)
assert tags[258] == (8,) and tags[259] == (1,)
assert tags[33550] == (6.0, 6.0, 0.0)
assert tags[33922] == (0.0, 0.0, 0.0, 4573663.250853, 1109693.140188, 0.0)
assert tags[273][0] == 30921
assert tags[278] == (1,)
assert tags[279] == (5322,)*5040
assert tags[273] == tuple(30921+i*5322 for i in range(5040))
ctx = np.frombuffer(native_bytes(receipts['ctx'][1]), dtype=np.uint8).reshape(951, 5322)
ctx_origin = [tags[33922][3], tags[33922][4]]
cos_parallel = math.cos(math.radians(18.4663))
places_origin = [4340890., 1097070.]
crs = '+proj=eqc +lat_ts=0 +lon_0=0 +R=3396190 +units=m +no_defs'

# Check the actual preserved manifest/binary from known integrity hashes; never alter it.
expected_manifest = 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9'
expected_binary = '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8'
preserved = []
for filename in ['jezero-terrain-grid.json', 'jezero-terrain-grid.f32']:
    path = root / 'public/data' / filename
    h = hash_bytes(path.read_bytes())
    if h in [expected_manifest, expected_binary]:
        preserved.append({'path': str(path.relative_to(root)).replace('\\', '/'), 'sha256': h})
assert {v['sha256'] for v in preserved} == {expected_manifest, expected_binary}
dem_path = root / 'docs/evidence/terrain-validation/source-audit/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
assert hash_bytes(dem_path.read_bytes()) == '16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b'
with rasterio.open(dem_path) as ds:
    assert ds.transform == Affine(20., 0., ctx_origin[0], 0., -20., ctx_origin[1])
    dem_grid = {'shape': list(ds.shape), 'transform': list(ds.transform)[:6], 'crsWkt': ds.crs.to_wkt()}

def subpixel_peak(surface, x, y):
    result = []
    for axis in [0, 1]:
        if (axis == 0 and not 0 < x < surface.shape[1]-1) or (axis == 1 and not 0 < y < surface.shape[0]-1):
            result.append(0.)
            continue
        a = float(surface[y, x-1] if axis == 0 else surface[y-1, x])
        b = float(surface[y, x])
        c = float(surface[y, x+1] if axis == 0 else surface[y+1, x])
        denominator = a-2*b+c
        value = .5*(a-c)/denominator if abs(denominator) > 1e-8 else 0.
        result.append(float(np.clip(value, -.5, .5)))
    return result

def correlate(first, second, valid, x, y, template_size):
    half = template_size//2
    search = 10  # search extent is an algorithm setting, not a geolocation acceptance bound
    a = first[y-half:y+half+1, x-half:x+half+1]
    b = second[y-half-search:y+half+search+1, x-half-search:x+half+search+1]
    m = valid[y-half-search:y+half+search+1, x-half-search:x+half+search+1]
    if a.shape != (template_size, template_size) or b.shape != (template_size+2*search, template_size+2*search) or not m.all():
        return {'valid': False, 'reason': 'masked or outside patch'}
    surface = cv2.matchTemplate(b, a, cv2.TM_CCOEFF_NORMED)
    _, peak, _, where = cv2.minMaxLoc(surface)
    px, py = where
    competing = surface.copy()
    competing[max(0, py-2):py+3, max(0, px-2):px+3] = -1
    competitor = float(competing.max())
    offsets = subpixel_peak(surface, px, py)
    return {'valid': True, 'displacementPixelXY': [px-search+offsets[0], py-search+offsets[1]], 'peakNcc': float(peak), 'competingPeakNccOutsideTwoPixels': competitor, 'peakOnSearchEdge': px in [0, 2*search] or py in [0, 2*search]}

patch_results = []
arrays = {}
all_points = []
for p_index, p in enumerate(receipts['patches']):
    raw = native_bytes(p)
    assert hash_bytes(raw) == p['rawSha256']
    image = np.frombuffer(raw, dtype=np.uint8).reshape(p['size'], p['size'])
    x, y = p['ctxProjectionCentreM']
    col0 = math.floor((x-ctx_origin[0])/6)-64
    row0 = math.floor((ctx_origin[1]-y)/6)-64
    ctx_patch = ctx[row0-1900:row0-1900+128, col0:col0+128].copy()
    assert ctx_patch.shape == (128, 128)
    src_transform = Affine(.25/cos_parallel, 0., (places_origin[0]+p['placesSampleStart']*.25)/cos_parallel, 0., -.25, places_origin[1]-p['placesLineStart']*.25)
    dst_transform = Affine(6., 0., ctx_origin[0]+col0*6, 0., -6., ctx_origin[1]-row0*6)
    projected = np.zeros((128, 128), dtype=np.float32)
    reproject(image, projected, src_transform=src_transform, src_crs=crs, dst_transform=dst_transform, dst_crs=crs, resampling=Resampling.average)
    # No PLACES DN NoData sentinel is declared in these labels: 0/255 are retained.
    # Mask geometric coverage and provider valid CTX range; never infer a hole from color.
    source_valid = np.ones(image.shape, dtype=np.float32)
    coverage = np.zeros((128, 128), dtype=np.float32)
    reproject(source_valid, coverage, src_transform=src_transform, src_crs=crs, dst_transform=dst_transform, dst_crs=crs, resampling=Resampling.average)
    valid = (coverage > .999999) & (ctx_patch > 2)
    detector_mask = valid.astype(np.uint8)*255
    detector_mask[:26] = 0
    detector_mask[-26:] = 0
    detector_mask[:, :26] = 0
    detector_mask[:, -26:] = 0
    points = cv2.goodFeaturesToTrack(ctx_patch, maxCorners=40, qualityLevel=.01, minDistance=12, mask=detector_mask, blockSize=5)
    candidates = []
    for point_index, point in enumerate([] if points is None else points[:, 0, :]):
        px, py = [int(round(v)) for v in point]
        variants = {str(size): correlate(ctx_patch.astype(np.float32), projected, valid, px, py, size) for size in [15, 21, 31]}
        nominal = variants['21']
        reason = None
        if not nominal['valid']:
            reason = nominal['reason']
        elif nominal['peakOnSearchEdge']:
            reason = 'peak on bounded search edge'
        elif nominal['peakNcc'] < .70:
            reason = 'NCC below matching quality setting'
        elif nominal['peakNcc'] - nominal['competingPeakNccOutsideTwoPixels'] < .05:
            reason = 'ambiguous competing correlation peak'
        centre = [ctx_origin[0]+(col0+px+.5)*6, ctx_origin[1]-(row0+py+.5)*6]
        candidate = {'id': f"{p['id']}-p{point_index}", 'patch': p['id'], 'ctxNativeLineSampleCentreIndex': [row0+py, col0+px], 'ctxPatchPixelXY': [px, py], 'ctxProjectionCentreM': centre, 'variants': variants, 'retainedForDiagnostic': reason is None, 'rejectionReason': reason}
        if reason is None:
            d = nominal['displacementPixelXY']
            candidate['placesMatchOffsetInCtxProjectionM'] = [d[0]*6, -d[1]*6]
            candidate['placesMatchedNativeCornerLineSample'] = [(places_origin[1]-(centre[1]-d[1]*6))/.25, ((centre[0]+d[0]*6)*cos_parallel-places_origin[0])/.25]
            usable = [v['displacementPixelXY'] for v in variants.values() if v['valid'] and not v['peakOnSearchEdge']]
            sensitivity = np.linalg.norm((np.asarray(usable)-d)*6, axis=1)
            candidate['templateSizeSensitivityMaximumM'] = float(sensitivity.max())
            all_points.append(candidate)
        candidates.append(candidate)
    retained = [c for c in candidates if c['retainedForDiagnostic']]
    displacement = np.median([c['placesMatchOffsetInCtxProjectionM'] for c in retained], axis=0).tolist() if retained else None
    patch_results.append({'id': p['id'], 'index': p_index, 'diagnosticSplit': 'fit' if p_index in [0, 2, 4, 6, 8] else 'held_out', 'nativeCtxTopLeftLineSample': [row0, col0], 'ctxTransform': list(dst_transform)[:6], 'nativePlacesTransformExpressedInCtxProjection': list(src_transform)[:6], 'validMatchingPixelFraction': float(valid.mean()), 'candidateCount': len(candidates), 'retainedCount': len(retained), 'medianPlacesMatchOffsetM': displacement, 'candidates': candidates})
    arrays[p['id']] = (ctx_patch, projected, valid)

fit_points = [c for p in patch_results if p['diagnosticSplit'] == 'fit' for c in p['candidates'] if c['retainedForDiagnostic']]
held_out_points = [c for p in patch_results if p['diagnosticSplit'] == 'held_out' for c in p['candidates'] if c['retainedForDiagnostic']]
if not fit_points or not held_out_points:
    (here / 'native-image-match-blocker.json').write_text(json.dumps({'patches': patch_results}, indent=2) + '\n', encoding='utf-8')
    fig, axes = plt.subplots(3, 2, figsize=(9, 14), constrained_layout=True)
    for i, p in enumerate(patch_results[:3]):
        for j, data in enumerate(arrays[p['id']][:2]):
            axes[i,j].imshow(data, cmap='gray')
            axes[i,j].set_title(p['id'] + (' native CTX' if j == 0 else ' PLACES averaged'))
    fig.savefig(here / 'native-image-match-blocker.png', dpi=150)
    plt.close(fig)
    print(json.dumps([{'id': p['id'], 'maskFraction': p['validMatchingPixelFraction'], 'candidates': p['candidateCount'], 'retained': p['retainedCount']} for p in patch_results]))
assert fit_points and held_out_points, 'Insufficient image matches; no residual statistic may be claimed.'
# Coordinate conversion fixes scale and rotation; translation is a descriptive diagnostic.
# Equal patch weight avoids giving a textured patch extra influence.
translation = np.median([p['medianPlacesMatchOffsetM'] for p in patch_results if p['diagnosticSplit'] == 'fit' and p['medianPlacesMatchOffsetM']], axis=0)
for p in patch_results:
    for c in p['candidates']:
        if c['retainedForDiagnostic']:
            residual = np.asarray(c['placesMatchOffsetInCtxProjectionM']) - translation
            c['translationResidualM'] = residual.tolist()
            c['translationResidualNormM'] = float(np.linalg.norm(residual))
def stats(points):
    a = np.array([p['translationResidualNormM'] for p in points])
    return {'count': len(points), 'rmsM': float(np.sqrt(np.mean(a*a))), 'medianM': float(np.median(a)), 'maximumM': float(a.max())}

# One inspectable tie per patch, ranked by image-match quality across all three
# template sizes, independently of coordinate residual or the translation fit.
selected = []
for p in patch_results:
    eligible = []
    for c in p['candidates']:
        if not c['retainedForDiagnostic']:
            continue
        v = list(c['variants'].values())
        if all(a['valid'] and not a['peakOnSearchEdge'] and a['peakNcc'] >= .70 and a['peakNcc']-a['competingPeakNccOutsideTwoPixels'] >= .05 for a in v):
            eligible.append(c)
    if eligible:
        chosen = max(eligible, key=lambda c: min(a['peakNcc'] for a in c['variants'].values()))
        chosen['selectedSpatialTie'] = True
        chosen['diagnosticSplit'] = p['diagnosticSplit']
        chosen['multiscaleMinimumNcc'] = min(a['peakNcc'] for a in chosen['variants'].values())
        selected.append(chosen)
assert selected and any(c['diagnosticSplit'] == 'fit' for c in selected) and any(c['diagnosticSplit'] == 'held_out' for c in selected), 'No selected fit/held-out image ties; statistics unavailable.'
selected_translation = np.median([c['placesMatchOffsetInCtxProjectionM'] for c in selected if c['diagnosticSplit'] == 'fit'], axis=0)
for c in selected:
    c['selectedTieTranslationResidualM'] = (np.asarray(c['placesMatchOffsetInCtxProjectionM'])-selected_translation).tolist()
def selected_stats(split):
    values = [np.linalg.norm(c['selectedTieTranslationResidualM']) for c in selected if c['diagnosticSplit'] == split]
    return {'count': len(values), 'rmsM': float(np.sqrt(np.mean(np.asarray(values)**2))), 'maximumM': float(max(values))}
result = {
    'purpose': 'Relative native PLACES/controlled-CTX image-content diagnostic only. No change to transform/DEM/app and no absolute MDIM named-feature validation.',
    'runtime': {'opencv': cv2.__version__, 'numpy': np.__version__, 'rasterio': rasterio.__version__},
    'nativeCtxTiffContract': {'shape': [5040, 5322], 'dtype': 'UnsignedByte', 'compression': 'None', 'firstImageByteOffsetZeroBased': 30921, 'rowsPerStrip': 1, 'pixelSpacingM': 6, 'originM': ctx_origin, 'gdalNoDataTag': tags.get(42113)},
    'nativeDemGridContract': dem_grid,
    'preservedApplicationFiles': preserved,
    'method': {'patchCount': 9, 'patchCentreSelection': 'Fixed 3x3 spatial grid in current crop, created before matching; no geographic landmark names assigned.', 'placesBandIndexZeroBased': 0, 'placesToCtxProjection': 'x_ctx=x_places/cos(18.4663deg); y_ctx=y_places. Both use R3396190, lon0/lat0=0, planetocentric/east; native pixel corner convention preserved.', 'imageryResampling': 'Rasterio/GDAL area average of native0.25m first-band imagery to exact nativeCTX6m cells; no DEM resampling.', 'featureSelection': 'OpenCV Shi-Tomasi goodFeaturesToTrack on nativeCTX patch; qualityLevel0.01, minDistance12px, blockSize5; mask and26px border.', 'matching': 'Normalized cross correlation,21x21CTX pixel template, ±10pixel search; quadratic3sample subpixel peak; repeated15/31templates for sensitivity.', 'matchingQualitySettings': 'NCC>=0.70, peak-competitor>=0.05 outside2pixels, off search edge. Settings reject ambiguous image matches and do not set a geolocation tolerance.', 'fit': 'Fixed-coordinate conversion with one equal-patch median translation diagnostic fitted to patches0,2,4,6,8. No fitted scale/rotation or data correction.', 'heldOut': 'Patches1,3,5,7 selected before matching; no points from them enter translation fit.', 'mask': 'PLACES cutout geometric coverage must be full. No PLACES DN NoData sentinel is declared, so all byte values are retained. CTX valid source metadata range3..255 is used. No numericalDEM mask is changed.'},
    'translationDiagnosticM': translation.tolist(),
    'fitResiduals': stats(fit_points),
    'heldOutResiduals': stats(held_out_points),
    'maximumTemplateSizeSensitivityM': max(c['templateSizeSensitivityMaximumM'] for c in all_points),
    'selectedSpatialTies': {'selection': 'One tie per patch maximizing minimum NCC across15/21/31templates among distinctive matches at all three sizes. No displacement, residual or sensitivity threshold is used to rank/select ties.', 'count': len(selected), 'translationDiagnosticM': selected_translation.tolist(), 'fitResiduals': selected_stats('fit'), 'heldOutResiduals': selected_stats('held_out'), 'maximumTemplateSizeSensitivityM': max(c['templateSizeSensitivityMaximumM'] for c in selected), 'ties': selected},
    'uncertaintyQualification': 'Template sensitivity is conditional algorithm sensitivity, not a confidence interval. Published expected0.5m localization accuracy is relative to PLACES map and has no stated statistical confidence. NativeCTX registration/selection accuracy and absolute map accuracy are not inferred from resolution or decimal precision. No numerical acceptance threshold is established.',
    'independenceQualification': 'Held-out image patches are independent of the diagnostic translation fit. The source maps share mission control lineage, so these are not independent absolute geodetic controls. Terrain texture is assumed unchanged between source acquisitions; retained tie chips require visual inspection.',
    'patches': patch_results,
}
(here / 'native-image-registration.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')

fig, axes = plt.subplots(9, 2, figsize=(8, 30), constrained_layout=True)
for i, p in enumerate(patch_results):
    first, second, mask = arrays[p['id']]
    for col, data in enumerate([first, second]):
        ax = axes[i, col]
        ax.imshow(data, cmap='gray', vmin=np.percentile(data[mask], 2), vmax=np.percentile(data[mask], 98), interpolation='nearest')
        ax.set_title(f"{p['id']} {p['diagnosticSplit']} | {'native CTX6m' if col==0 else 'PLACES band0 averaged to CTX6m'}", fontsize=8)
        for c in p['candidates']:
            if not c['retainedForDiagnostic']:
                continue
            x, y = c['ctxPatchPixelXY']
            if col:
                d = c['variants']['21']['displacementPixelXY']
                x, y = x+d[0], y+d[1]
            ax.plot(x, y, '+', color='red', markersize=5)
            ax.text(x+1, y-1, c['id'].split('-p')[-1], color='yellow', fontsize=5)
        ax.set_xlim(0, 128)
        ax.set_ylim(128, 0)
        ax.set_xlabel('nativeCTX pixel column relative to patch')
        ax.set_ylabel('nativeCTX pixel row relative to patch')
fig.savefig(here / 'native-image-tie-board.png', dpi=150)
plt.close(fig)
fig, axes = plt.subplots(3, 6, figsize=(18, 10), constrained_layout=True)
for i, p in enumerate(patch_results):
    chosen = next((c for c in selected if c['patch'] == p['id']), None)
    for j, data in enumerate(arrays[p['id']][:2]):
        ax = axes[i//3, (i%3)*2+j]
        ax.imshow(data, cmap='gray', interpolation='nearest')
        if chosen:
            x, y = chosen['ctxPatchPixelXY']
            if j:
                d = chosen['variants']['21']['displacementPixelXY']
                x, y = x+d[0], y+d[1]
            ax.plot(x, y, '+', color='red', markersize=12)
        ax.set_title(f"{chosen['id'] if chosen else p['id']+' no multiscale tie'}\n{'CTX native' if j==0 else 'PLACES averaged'} | {p['diagnosticSplit']}", fontsize=9)
        ax.set_xticks([0, 64, 128])
        ax.set_yticks([0, 64, 128])
fig.savefig(here / 'selected-spatial-ties.png', dpi=160)
plt.close(fig)
print(json.dumps({k: result[k] for k in ['translationDiagnosticM', 'fitResiduals', 'heldOutResiduals', 'maximumTemplateSizeSensitivityM']}))
print(json.dumps({k:v for k,v in result['selectedSpatialTies'].items() if k != 'ties'}))
