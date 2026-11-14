"""Independent PROJ validation of actual application output, not a copied distance kernel.

Run capture-app.mjs first, then use the cached pinned pyproj/numpy runtime.
No source DEM, manifest, app coordinate module or distance algorithm is modified.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import pyproj

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
metadata = json.loads((HERE / 'app-capture.json').read_text())
manifest_bytes = (ROOT / 'public/data/jezero-terrain-grid.json').read_bytes()
grid_bytes = (ROOT / 'public/data/jezero-terrain-grid.f32').read_bytes()
capture = (HERE / 'app-horizontal.bin').read_bytes()
assert hashlib.sha256(manifest_bytes).hexdigest() == metadata['manifestHash']
assert hashlib.sha256(grid_bytes).hexdigest() == metadata['gridHash']
assert hashlib.sha256(capture).hexdigest() == metadata['captureSha256']
for file, expected in metadata['sourceModuleHashes'].items():
    assert hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == expected
manifest = json.loads(manifest_bytes)
radius = manifest['projection']['radiusM']
assert radius == 3396190
geod = pyproj.Geod(a=radius,b=radius)
eqc = pyproj.CRS.from_proj4(f'+proj=eqc +lat_ts=0 +lon_0=0 +lat_0=0 +a={radius} +b={radius} +units=m +no_defs')
geographic = pyproj.CRS.from_proj4(f'+proj=longlat +a={radius} +b={radius} +no_defs')
inverse = pyproj.Transformer.from_crs(eqc,geographic,always_xy=True)
g = manifest['grid']
s = manifest['sourceGrid']
row_indices, column_indices = np.indices((g['rows'],g['columns']))
x = s['originX'] + (column_indices+g['startColumn']+0.5)*s['pixelSizeM']
y = s['originY'] - (row_indices+g['startRow']+0.5)*s['pixelSizeM']
lon,lat = inverse.transform(x,y)
values = np.frombuffer(capture,dtype='<f8')
app = values[:metadata['cellCount']*2].reshape(g['rows'],g['columns'],2)
edges = values[metadata['cellCount']*2:]
coordinate_angular_error = np.max(np.abs(app - np.stack([lon,lat],axis=-1)))
coordinate_distance_error = geod.inv(app[:,:,0].ravel(),app[:,:,1].ravel(),lon.ravel(),lat.ravel())[2]
assert coordinate_angular_error < 1e-11
assert np.max(np.abs(coordinate_distance_error)) < 1e-6
first_indices=[]
second_indices=[]
directions=[]
for row in range(g['rows']):
    for column in range(g['columns']):
        for direction,(dr,dc) in enumerate(metadata['directionSteps']):
            if row+dr >= g['rows'] or column+dc < 0 or column+dc >= g['columns']:
                continue
            first_indices.append(row*g['columns']+column)
            second_indices.append((row+dr)*g['columns']+column+dc)
            directions.append(direction)
first_indices=np.array(first_indices)
second_indices=np.array(second_indices)
directions=np.array(directions)
flattened=app.reshape(-1,2)
# Compare the metric kernel on identical input positions, separately from the
# independently established native-coordinate transform above.
reference=np.array(geod.inv(flattened[first_indices,0],flattened[first_indices,1],flattened[second_indices,0],flattened[second_indices,1])[2])
errors=np.abs(edges-reference)
assert len(errors)==260610
assert np.max(errors)<1e-6
direction_results=[]
for direction,name in enumerate(['east-west','north-south','south-east','south-west']):
    selected=directions==direction
    direction_results.append(dict(direction=name,count=int(selected.sum()),minimumDistanceM=float(reference[selected].min()),maximumDistanceM=float(reference[selected].max()),maximumAbsoluteErrorM=float(errors[selected].max()),maximumRelativeErrorPercent=float((100*errors[selected]/reference[selected]).max())))
fixtures=[]
for fixture in metadata['fixtures']:
    first=fixture['from'];second=fixture['to']
    reference_distance=geod.inv(first['lon'],first['lat'],second['lon'],second['lat'])[2]
    error=abs(reference_distance-fixture['applicationDistanceM'])
    assert error<1e-6, fixture['name']
    fixtures.append(dict(**fixture,projDistanceM=reference_distance,absoluteErrorM=error,relativeErrorPercent=100*error/reference_distance if reference_distance else None))
ew=direction_results[0]
distortion=dict(projectedEastWestSpacingM=20,minimumSurfaceEastWestSpacingM=ew['minimumDistanceM'],maximumSurfaceEastWestSpacingM=ew['maximumDistanceM'],projectedOverstatementPercentRange=[100*(20/ew['maximumDistanceM']-1),100*(20/ew['minimumDistanceM']-1)],qualification='Distortion of Eqc lat_ts=0 within this actual crop; map pixels are not physical surface metres.')
result=dict(status='PASS',scope='Reference-sphere geometry only, not vertical datum, absolute feature accuracy or traversability',tools=dict(pyproj=pyproj.__version__,PROJ=pyproj.proj_version_str,numpy=np.__version__,node=metadata['node']),sourceModuleHashes=metadata['sourceModuleHashes'],manifestHash=metadata['manifestHash'],gridHash=metadata['gridHash'],cellCenters=dict(count=metadata['cellCount'],maximumAngularErrorDeg=float(coordinate_angular_error),maximumPositionErrorM=float(np.max(np.abs(coordinate_distance_error)))),neighborEdges=dict(count=len(errors),maximumAbsoluteErrorM=float(errors.max()),maximumRelativeErrorPercent=float((100*errors/reference).max()),byDirection=direction_results),projectionDistortion=distortion,fixtures=fixtures,invalidCoordinateRejections=metadata['invalidCoordinateCases'])
(HERE/'results.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"PASS independent PROJ: {metadata['cellCount']} centers and {len(errors)} edges; max coordinate error {result['cellCenters']['maximumPositionErrorM']:.3g} m; max edge error {errors.max():.3g} m / {(100*errors/reference).max():.3g}%; {len(fixtures)} global/native fixtures.")
