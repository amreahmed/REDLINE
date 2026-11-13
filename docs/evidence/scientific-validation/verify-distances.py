"""Independent PROJ/pyproj spherical geodesic fixtures; no application imports.

Run: uv run --with pyproj==3.7.2 python docs/evidence/scientific-validation/verify-distances.py
This checks native grid geometry only. It does not validate DEM vertical data,
terrain between endpoints, feature accuracy, slopes, route length, or safety.
"""
import hashlib
import json
import math
from pathlib import Path

import pyproj

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
manifest_bytes = (ROOT / 'public/data/jezero-terrain-grid.json').read_bytes()
binary = (ROOT / 'public/data/jezero-terrain-grid.f32').read_bytes()
assert hashlib.sha256(manifest_bytes).hexdigest() == 'fa63f2181e603eb930d94fcf91444ee5e537b6c046e31537f65daeb0e1cffed9'
assert hashlib.sha256(binary).hexdigest() == '4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8'
manifest = json.loads(manifest_bytes)
assert manifest['projection']['radiusM'] == 3396190
geod = pyproj.Geod(a=3396190, b=3396190)

def center(row, column):
    source = manifest['sourceGrid']
    return [math.degrees((source['originX'] + (column + 0.5) * 20) / 3396190),
            math.degrees((source['originY'] - (row + 0.5) * 20) / 3396190)]

def distance(start, end):
    return geod.inv(start[0], start[1], end[0], end[1])[2]

analytic = [
    ('one-degree-meridian', [0, 0], [0, 1], 3396190 * math.pi / 180),
    ('quarter-circumference', [0, 0], [90, 0], 3396190 * math.pi / 2),
    ('antipodal', [0, 0], [180, 0], 3396190 * math.pi),
    ('high-latitude', [0, 60], [90, 60], 3396190 * math.acos(0.75)),
    ('longitude-wrap', [179, 0], [-179, 0], 3396190 * math.pi / 90),
    ('same-pole', [0, 90], [90, 90], 0),
]
fixtures = []
for name, start, end, expected in analytic:
    measured = distance(start, end)
    assert abs(measured - expected) < 1e-7, name
    fixtures.append(dict(name=name, start=start, end=end, distanceM=measured))

grid_pairs = [((714, 650), (714, 651)), ((714, 650), (715, 650)),
              ((714, 650), (715, 651)), ((586, 522), (841, 777)),
              ((650, 580), (800, 730))]
grid_fixtures = []
for start, end in grid_pairs:
    grid_fixtures.append(dict(start=list(start), end=list(end),
                             startCoordinate=center(*start), endCoordinate=center(*end),
                             distanceM=distance(center(*start), center(*end))))

# Check every horizontal/vertical adjacent edge in the preserved crop with
# independent geodesic inversion. The application tests consume selected pairs.
east_west = [distance(center(row, 522), center(row, 523)) for row in range(586, 842)]
north_south = [distance(center(row, 522), center(row + 1, 522)) for row in range(586, 841)]
assert all(18 < value < 20 for value in east_west)
assert all(abs(value - 20) < 1e-7 for value in north_south)
assert east_west[-1] > east_west[0]  # nearer the equator, greater E-W separation

result = dict(tool=f'pyproj {pyproj.__version__} / PROJ {pyproj.proj_version_str}',
              model='sphere geodesic inverse, a=b=3396190 m',
              limitations='Endpoint geometry only. No vertical or route validation.',
              manifestHash=hashlib.sha256(manifest_bytes).hexdigest(),
              binaryHash=hashlib.sha256(binary).hexdigest(),
              analyticFixtures=fixtures, gridFixtures=grid_fixtures,
              adjacentRowChecks=dict(eastWestRows=len(east_west), northSouthRows=len(north_south),
                                     eastWestMinM=min(east_west), eastWestMaxM=max(east_west)))
(HERE / 'distance-fixtures.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(f'PASS: {len(fixtures)} analytic / {len(grid_fixtures)} grid fixtures; 256 E-W and 255 N-S row checks; preserved source hashes.')
