"""Audit archived control candidates; no application changes or registered targets.

Run: uv run --with spiceypy==8.4.0 --with rasterio python docs/evidence/scientific-resolution-2026-11-14/registration/inspect-spice-controls.py
"""
import hashlib
import json
import math
from pathlib import Path
import re

import rasterio
import spiceypy as spice

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
manifest_bytes = (ROOT / 'public/data/jezero-terrain-grid.json').read_bytes()
binary = (ROOT / 'public/data/jezero-terrain-grid.f32').read_bytes()
assert hashlib.sha256(manifest_bytes).hexdigest() == 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9'
assert hashlib.sha256(binary).hexdigest() == '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8'
manifest = json.loads(manifest_bytes)
receipts = json.loads((HERE / 'http-receipts.json').read_text())
required = ['pck00010.tpc', 'naif0012.tls', 'm2020_v04.tf',
            'm2020_ls_ops210303_iau2000_v1.bsp', 'm2020_surf_rover_loc_0659_0779_v1.bsp']
for name in required:
    receipt = next(row for row in receipts if row['file'] == name)
    value = (HERE / name).read_bytes()
    assert receipt['status'] == 200
    assert hashlib.sha256(value).hexdigest() == receipt['sha256']
    if name.endswith('.bsp'):
        label = (HERE / name.replace('.bsp', '.xml')).read_text()
        provider_md5 = re.search(r'<md5_checksum>([a-f0-9]+)</md5_checksum>', label)[1]
        assert hashlib.md5(value).hexdigest() == provider_md5
    spice.furnsh(str(HERE / name))

def comments(name):
    handle = spice.dafopr(str(HERE / name))
    lines = []
    while True:
        count, buffer, done = spice.dafec(handle, 1000, 512)
        lines.extend(buffer[:count])
        if done:
            break
    spice.dafcls(handle)
    text = '\n'.join(lines).rstrip() + '\n'
    (HERE / name.replace('.bsp', '-comments.txt')).write_bytes(text.encode('utf-8'))
    return text

landing_name = 'm2020_ls_ops210303_iau2000_v1.bsp'
localized_name = 'm2020_surf_rover_loc_0659_0779_v1.bsp'
landing_comments = comments(landing_name)
localized_comments = comments(localized_name)
assert 'Gaussian coordinates' in landing_comments
assert "'IAU_MARS'" in landing_comments
assert 'localized_interp' in localized_comments
assert 'Planetocentric Lon' in localized_comments
equatorial, _, polar = spice.bodvrd('MARS', 'RADII', 3)[1].tolist()
assert [equatorial, polar] == [3396.19, 3376.2]
epoch = spice.str2et('2023-01-01T12:00:00')

def vector_and_coordinate(code):
    vector, _ = spice.spkpos(str(code), epoch, 'IAU_MARS', 'NONE', '499')
    radius, lon, lat = spice.reclat(vector)
    return vector.tolist(), [math.degrees(lon), math.degrees(lat)], radius * 1000

landing_vector, landing_lon_lat, landing_radius = vector_and_coordinate(-168900)
gaussian_lon = float(re.search(r'Lon =\s*([-\d.]+) degrees East', landing_comments)[1])
gaussian_lat = float(re.search(r'Lat =\s*([-\d.]+) degrees North', landing_comments)[1])
gaussian_alt = float(re.search(r'Alt =\s*([-\d.]+) km', landing_comments)[1])
reconstructed = spice.georec(math.radians(gaussian_lon), math.radians(gaussian_lat), gaussian_alt, equatorial, (equatorial-polar)/equatorial)
assert max(abs(a-b) for a, b in zip(landing_vector, reconstructed)) < 1e-9

source = ROOT / 'docs/evidence/terrain-validation/source-audit' / (manifest['source']['productId'] + '.tif')
assert hashlib.sha256(source.read_bytes()).hexdigest() == manifest['source']['sha256']

def mapping(coordinate, dataset):
    lon, lat = coordinate
    x, y = 3396190 * math.radians(lon), 3396190 * math.radians(lat)
    source_row, source_column = dataset.index(x, y)
    crop = manifest['grid']
    inside_native = 0 <= source_row < dataset.height and 0 <= source_column < dataset.width
    inside_crop = (crop['startRow'] <= source_row < crop['startRow'] + crop['rows'] and
                   crop['startColumn'] <= source_column < crop['startColumn'] + crop['columns'])
    value = None
    if inside_native:
        sample = dataset.read(1, window=rasterio.windows.Window(source_column, source_row, 1, 1), masked=True)
        if not sample.mask[0, 0] and math.isfinite(float(sample[0, 0])):
            value = float(sample[0, 0])
    return dict(projectedM=[x, y], nativeRow=source_row, nativeColumn=source_column,
                insideNativeDem=inside_native, insidePreservedCrop=inside_crop,
                nativeProviderValueM=value,
                qualification='Coordinate-to-cell mapping only. No image landmark residual, source datum conversion, or target registration established.')

with rasterio.open(source) as dataset:
    assert dataset.width == manifest['sourceGrid']['columns']
    assert dataset.height == manifest['sourceGrid']['rows']
    assert list(dataset.transform)[:6] == [20.0, 0.0, 4573663.250853, 0.0, -20.0, 1109693.140188]
    landing = dict(id=-168900, name='M2020_LANDING_SITE', solutionDate='2021-03-03',
                   frame='IAU_MARS, IAU 2000 rotation constants', xyzKm=landing_vector,
                   planetocentricLonLat=landing_lon_lat, radiusM=landing_radius,
                   gaussianInput=dict(lon=gaussian_lon, lat=gaussian_lat, ellipsoidNormalAltitudeKm=gaussian_alt),
                   referenceRadiiKm=[equatorial, equatorial, polar],
                   reconstructedGaussianVectorMatches=True,
                   coordinateAccuracy='not supplied by this kernel; decimal precision is not uncertainty',
                   nativeMapping=mapping(landing_lon_lat, dataset))
    sites = []
    for code in spice.spkobj(str(HERE / localized_name)):
        if code == -168:
            continue
        vector, coordinate, radius = vector_and_coordinate(code)
        site = -int(code) - 168500
        assert f'site {site:05d}' in localized_comments
        sites.append(dict(id=int(code), site=site, frame='IAU_MARS',
                          planetocentricLonLat=coordinate, xyzKm=vector, radiusM=radius,
                          provenance='NAIF/JPL archived PLACES localized_interp; site definition, not a fabricated waypoint',
                          observationTime='not inferred from fixed site kernel coverage',
                          coordinateAccuracy='no per-site uncertainty supplied',
                          nativeMapping=mapping(coordinate, dataset)))

window = spice.spkcov(str(HERE / localized_name), -168)
coverage = [[spice.et2utc(start, 'ISOC', 3), spice.et2utc(end, 'ISOC', 3)] for start, end in [spice.wnfetd(window, i) for i in range(spice.wncard(window))]]
assert len(sites) == 41
assert sorted(row['site'] for row in sites if row['nativeMapping']['insidePreservedCrop']) == list(range(21, 42))
assert landing['nativeMapping']['insideNativeDem'] and not landing['nativeMapping']['insidePreservedCrop']
result = dict(tool=f'SpiceyPy {spice.__version__}, {spice.tkvrsn("TOOLKIT")}; Rasterio {rasterio.__version__}',
              purpose='Authoritative control candidates and reproducible frame conversion. No empirical CTX/DEM registration or named-feature validation.',
              landing=landing, localizedKernel=localized_name, roverCoverageUtc=coverage,
              interpolationLimit='Rover data during motion are interpolated according to archive documentation. Fixed site coverage is not a site observation date.',
              sourceTiffSha256=manifest['source']['sha256'],
              providerKernelMd5Verified=True,
              manifestSha256=hashlib.sha256(manifest_bytes).hexdigest(),
              binarySha256=hashlib.sha256(binary).hexdigest(),
              sites=sites, sitesInPreservedCrop=[row['site'] for row in sites if row['nativeMapping']['insidePreservedCrop']],
              scientificStatus='Precise coordinates and frame pedigree found. Absolute/image landmark acceptance remains pending; no uncertainty or fitted transformation is invented.')
output = json.dumps(result, indent=2) + '\n'
(HERE / 'spice-control-candidates.json').write_bytes(output.encode('utf-8'))
spice.kclear()
print(json.dumps(dict(landing=landing, siteCount=len(sites), sitesInPreservedCrop=result['sitesInPreservedCrop'], roverCoverageUtc=coverage), indent=2))
