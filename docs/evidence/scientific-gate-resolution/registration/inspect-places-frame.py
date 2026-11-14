"""Verify actual PLACES delivery, native pixel arithmetic and archived site matches.

No localization accuracy or image-registration claim is inferred from arithmetic.
"""
import csv
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

here = Path(__file__).resolve().parent
root = here.parents[3]
old = root / 'docs/evidence/scientific-resolution-2026-11-14/registration'
def digest(path, name='sha256'):
    return hashlib.new(name, path.read_bytes()).hexdigest()
def values(filename):
    return list(csv.DictReader((here / filename).open(newline='', encoding='utf-8')))
def tags(filename, name):
    return [v.text for v in ET.parse(here / filename).iter() if v.tag.split('}')[-1] == name]

receipts = json.loads((here / 'places-http-receipts.json').read_text())
for r in receipts:
    assert r['status'] == 200
    assert digest(here / r['file']) == r['sha256']
md5_rows = (here / 'places-product-md5.txt').read_text().splitlines()
verified = []
for r in receipts:
    if r['file'].endswith('.html') or r['file'] == 'places-product-md5.txt':
        continue
    basename = 'bundle.xml' if r['file'] == 'places-bundle.xml' else r['file']
    candidates = [line for line in md5_rows if line.strip().replace('\\', '/').endswith('/' + basename)]
    assert len(candidates) == 1, (basename, candidates)
    expected = candidates[0].split()[0].lower()
    assert digest(here / r['file'], 'md5') == expected, basename
    verified.append(basename)
for filename, basename in [('best_tactical-siteframe.xmlx', 'm20_best_tactical_siteframe.xmlx'), ('best_tactical-siteframe.xmlx.xml', 'm20_best_tactical_siteframe.xmlx.xml')]:
    candidates = [line for line in md5_rows if line.strip().replace('\\', '/').endswith('/' + basename)]
    assert len(candidates) == 1
    assert digest(here / filename, 'md5') == candidates[0].split()[0].lower()
    verified.append(basename)

versions = {name: tags(name, 'version_id')[0] for name in ['places-bundle.xml', 'best_tactical.csv.xml', 'm20_orbital_map.xml', 'm20_orbital_dem.xml', 'orbital_1_metadata.csv.xml', 'orbital_2_metadata.csv.xml', 'orbital_origin_global.csv.xml']}
assert set(versions.values()) == {'16.0'}, versions
map_meta_rows = values('orbital_1_metadata.csv')
map_meta = {v['key']: v['value'] for v in map_meta_rows if v['key'] != 'key'}
assert map_meta['standard_parallel'] == '18.4663'
assert map_meta['pixel_definitions'] == 'Line/samp of (0,0) is the upper-left corner of the upper-left pixel'
R = float(map_meta['ellipsoid_radius'])
parallel = math.radians(float(map_meta['standard_parallel']))
cos_parallel = math.cos(parallel)
native_origin = [4573663.250853, 1109693.140188]
map_origin = [float(tags('m20_orbital_map.xml', 'upperleft_corner_x')[0]), float(tags('m20_orbital_map.xml', 'upperleft_corner_y')[0])]
dem_origin = [float(tags('m20_orbital_dem.xml', 'upperleft_corner_x')[0]), float(tags('m20_orbital_dem.xml', 'upperleft_corner_y')[0])]
assert map_origin == dem_origin == [4340890.0, 1097070.0]
rows = values('best_tactical.csv')
old_sites = {v['site']: v for v in json.loads((old / 'spice-control-candidates.json').read_text())['sites']}
controls = []
for row in rows:
    if row['frame'] != 'SITE' or not 21 <= int(row['site']) <= 41:
        continue
    lon, lat = float(row['longitude']), float(row['planetocentric_latitude'])
    northing, easting = float(row['northing']), float(row['easting'])
    projected = [R * math.radians(lon), R * math.radians(lat)]
    native_pixel_corner = [(native_origin[1] - projected[1]) / 20, (projected[0] - native_origin[0]) / 20]
    arithmetic_errors = {
        'northing_serialization_m': northing - projected[1],
        'easting_serialization_m': easting - projected[0] * cos_parallel,
        'map_line_serialization_pixel': float(row['map_pixel_line']) - (map_origin[1] - northing) / 0.25,
        'map_sample_serialization_pixel': float(row['map_pixel_sample']) - (easting - map_origin[0]) / 0.25,
        'dem_line_serialization_pixel': float(row['dem_pixel_line']) - (dem_origin[1] - northing),
        'dem_sample_serialization_pixel': float(row['dem_pixel_sample']) - (easting - dem_origin[0]),
    }
    archived_lon, archived_lat = old_sites[int(row['site'])]['planetocentricLonLat']
    delta = [R * math.radians(lon-archived_lon) * math.cos(math.radians(lat)), R * math.radians(lat-archived_lat)]
    controls.append({'sourceCsvRecordOneBased': rows.index(row)+2, 'record': row, 'nativeDemPixelCornerLineSample': native_pixel_corner, 'nativeDemCell': [math.floor(v) for v in native_pixel_corner], 'arithmeticSerializationErrors': arithmetic_errors, 'archivedSpkHorizontalDifferenceM': math.hypot(*delta), 'qualification': 'Actual localized SITE record; pixel arithmetic and cross-delivery coordinate consistency, not an independent CTX image control or accuracy measurement. SITE sol=-1 and sclk=0 are not observation dates.'})
assert len(controls) == 21
for c in controls:
    assert 586 <= c['nativeDemCell'][0] <= 841 and 522 <= c['nativeDemCell'][1] <= 777
    e = c['arithmeticSerializationErrors']
    assert abs(e['northing_serialization_m']) < 0.0001
    assert abs(e['easting_serialization_m']) < 0.0006
    # These are serialization checks against the published decimal fields, not geolocation tolerances.
    assert max(abs(v) for k, v in e.items() if 'pixel' in k) <= 0.00700001

raw = ET.parse(here / 'best_tactical-siteframe.xmlx')
raw_control = {}
for s in raw.findall('solution'):
    rmc = s.find('rmc')
    if rmc is not None and 21 <= int(rmc.attrib.get('site', '-1')) <= 41:
        offset = s.find('offset')
        raw_control[int(rmc.attrib['site'])] = {'offset': offset.attrib, 'metadata': ET.tostring(offset.find('solution_metadata'), encoding='unicode')}
assert len(raw_control) == 21
for c in controls:
    c['rawSiteFrame'] = raw_control[int(c['record']['site'])]
    assert 'frame="ORBITAL"' in c['rawSiteFrame']['metadata']

rover_in_epoch = [r for r in rows if r['frame'] == 'ROVER' and 659 <= int(r['sol']) <= 779]
result = {
    'purpose': 'Actual PLACES frame/pixel check, distinct from relative imagery registration and absolute named-feature registration.',
    'versions': versions,
    'providerMd5VerifiedFiles': verified,
    'csvRecordCount': len(rows),
    'matchedSiteCount': len(controls),
    'localizedRoverRecordsInSols659To779': len(rover_in_epoch),
    'nativeDemOriginMetres': native_origin,
    'nativeDemPixelSpacingMetres': 20,
    'placesMapCutoutOriginMetres': map_origin,
    'placesProjection': {'type': 'Equirectangular', 'latitudeType': 'Planetocentric', 'longitudeDirection': 'Positive East', 'radiusM': R, 'standardParallelDeg': 18.4663, 'centralMeridianDeg': 0, 'projectionOriginLatitudeDeg': 0, 'falseEastingM': 0, 'falseNorthingM': 0},
    'placesPixelConvention': 'Actual metadata says upper-left corner of upper-left pixel is (0,0); all 21 SITE CSV map/DEM pixel fields agree with corner arithmetic within decimal serialization. Image-array element centre is therefore index+0.5 for georeferencing.',
    'metadataDuplicateRows': len(map_meta_rows) - len(map_meta),
    'currentVsArchivedSpkMaximumHorizontalDifferenceM': max(c['archivedSpkHorizontalDifferenceM'] for c in controls),
    'qualification': 'No fit, image tie, accuracy bound, named-feature control, or vertical-datum conversion is produced here. Published 0.5m best_tactical expected accuracy is relative to PLACES basemap only.',
    'controls': controls,
    'localizedRoverRecords': rover_in_epoch,
}
(here / 'places-frame-check.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')

# Deterministic, spatially distributed patch centres in the existing crop.
# They are image-sampling centres, not invented geographic landmarks or rover targets.
patches = []
for r in [660, 740, 820]:
    for c in [550, 650, 750]:
        x = native_origin[0] + (c + 0.5) * 20
        y = native_origin[1] - (r + 0.5) * 20
        places_corner_line = (map_origin[1] - y) / .25
        places_corner_sample = (x * cos_parallel - map_origin[0]) / .25
        size = 3072
        line_start = math.floor(places_corner_line - size/2)
        sample_start = math.floor(places_corner_sample - size/2)
        assert 0 <= line_start and line_start + size <= 21920
        assert 0 <= sample_start and sample_start + size <= 59200
        patches.append({'id': f'r{r}-c{c}', 'nativeDemCentreCell': [r, c], 'ctxProjectionCentreM': [x, y], 'placesLineStart': line_start, 'placesSampleStart': sample_start, 'size': size, 'placesBandIndexZeroBased': 0})
(here / 'native-patch-plan.json').write_text(json.dumps({'mapOffsetBytes': 118400, 'mapSamples': 59200, 'mapLines': 21920, 'mapBands': 3, 'storage': 'BSQ UnsignedByte verified from PDS4 and attached headers', 'patches': patches}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: result[k] for k in ['versions', 'csvRecordCount', 'matchedSiteCount', 'localizedRoverRecordsInSols659To779', 'currentVsArchivedSpkMaximumHorizontalDifferenceM']}))
