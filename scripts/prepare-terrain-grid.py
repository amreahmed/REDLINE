"""Extract a fixed native-cell prototype crop from the audited USGS CTX DEM.

Run: uv run --with rasterio --with numpy python scripts/prepare-terrain-grid.py
No resampling, interpolation, height conversion, or source-cell alteration occurs.
The crop is a display/prototype choice; it does not establish feature accuracy.
"""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window


ROOT = Path(__file__).resolve().parents[1]
PRODUCT = "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0"
SOURCE_HASH = "16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b"
SOURCE = ROOT / "docs/evidence/terrain-validation/source-audit" / (PRODUCT + ".tif")
SOURCE_URL = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/" + PRODUCT + ".tif"
RADIUS = 3396190
NODATA = -3.4028226550889045e38
TRANSFORM = (20.0, 0.0, 4573663.250853, 0.0, -20.0, 1109693.140188, 0.0, 0.0, 1.0)
START_COLUMN, START_ROW, COLUMNS, ROWS = 522, 586, 256, 256
PROCESSING = "native cell extraction only; no resampling, interpolation, datum change, or cell alteration"
BOUNDARY_POLICY = "fixed display-selected prototype crop; boundaries do not represent feature accuracy or a validated traverse area"


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8"))


def geographic(x, y):
    # Valid only for the audited spherical equirectangular lat_ts=lon_0=0 product.
    return [math.degrees(x / RADIUS), math.degrees(y / RADIUS)]


def main():
    source_bytes = SOURCE.read_bytes()
    assert hashlib.sha256(source_bytes).hexdigest() == SOURCE_HASH, "Changed source: re-audit before processing"
    with rasterio.open(SOURCE) as dataset:
        assert (dataset.width, dataset.height, dataset.count) == (1596, 1512, 1)
        assert dataset.dtypes == ("float32",) and tuple(dataset.transform) == TRANSFORM
        assert dataset.nodata == NODATA and dataset.scales == (1.0,) and dataset.offsets == (0.0,)
        assert dataset.tags().get("AREA_OR_POINT") == "Area"
        projection = dataset.crs.to_dict()
        assert projection["proj"] == "eqc" and projection["R"] == RADIUS and projection["units"] == "m"
        assert all(projection[key] == 0 for key in ["lat_ts", "lat_0", "lon_0", "x_0", "y_0"])
        native = dataset.read(1, window=Window(START_COLUMN, START_ROW, COLUMNS, ROWS), masked=True)
        assert native.shape == (ROWS, COLUMNS)
        mask = np.ma.getmaskarray(native)
        assert np.array_equal(mask, native.data == NODATA), "Mask needs a separately validated encoding"
        assert np.isfinite(native.compressed()).all()
        # Explicit little-endian IEEE 754 float32; row-major and native sentinel retained.
        binary = native.data.astype("<f4", copy=False).tobytes(order="C")
        assert len(binary) == ROWS * COLUMNS * 4
        binary_path = ROOT / "public/data/jezero-terrain-grid.f32"
        binary_path.parent.mkdir(parents=True, exist_ok=True)
        binary_path.write_bytes(binary)
        binary_hash = hashlib.sha256(binary).hexdigest()
        corners = []
        for name, row, column in [
            ("north-west", START_ROW, START_COLUMN),
            ("north-east", START_ROW, START_COLUMN + COLUMNS),
            ("south-east", START_ROW + ROWS, START_COLUMN + COLUMNS),
            ("south-west", START_ROW + ROWS, START_COLUMN),
        ]:
            x, y = dataset.transform * (column, row)
            corners.append({"name": name, "sourceRowEdge": row, "sourceColumnEdge": column,
                            "projectedM": [x, y], "coordinate": geographic(x, y)})
        fixtures = []
        for row, column in [
            (586, 522), (586, 777), (841, 777), (841, 522),
            (714, 650), (650, 580), (800, 730),
        ]:
            x, y = dataset.xy(row, column)
            # Separate one-cell Rasterio reads are reference fixtures for the browser decoder.
            value = dataset.read(1, window=Window(column, row, 1, 1), masked=True)[0, 0]
            local_value = native[row - START_ROW, column - START_COLUMN]
            assert np.ma.is_masked(value) == np.ma.is_masked(local_value)
            assert np.ma.is_masked(value) or value == local_value
            fixtures.append({"row": row, "column": column, "pixelCenterM": [x, y],
                             "coordinate": geographic(x, y),
                             "elevationM": None if np.ma.is_masked(value) else float(value)})
        source = {"productId": PRODUCT, "sha256": SOURCE_HASH, "url": SOURCE_URL,
                  "units": "m", "heightReference": "provider-declared-iau-sphere-unvalidated"}
        manifest = {
            "schemaVersion": 1, "source": source,
            "projection": {"kind": "equirectangular", "radiusM": RADIUS, "standardParallelDeg": 0,
                           "centralMeridianDeg": 0, "latitudeConvention": "planetocentric",
                           "longitudeDirection": "east-positive", "longitudeRange": "signed-180"},
            "sourceGrid": {"columns": 1596, "rows": 1512, "originX": dataset.transform.c,
                           "originY": dataset.transform.f, "pixelSizeM": 20, "noData": NODATA},
            "grid": {"startColumn": START_COLUMN, "startRow": START_ROW, "columns": COLUMNS, "rows": ROWS},
            "encoding": {"url": "/data/jezero-terrain-grid.f32", "sampleType": "float32", "byteOrder": "little-endian",
                         "layout": "row-major", "bytes": len(binary), "sha256": binary_hash},
            "processing": PROCESSING, "boundaryPolicy": BOUNDARY_POLICY,
            "summary": {"validCount": int(native.count()), "missingCount": int(native.size - native.count()),
                        "minM": None if native.count() == 0 else float(native.min()),
                        "maxM": None if native.count() == 0 else float(native.max())},
            "outerCorners": corners, "fixtures": fixtures,
        }
        manifest_path = ROOT / "public/data/jezero-terrain-grid.json"
        write_json(manifest_path, manifest)
        manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        inspection = {"source": source, "sourceBytes": len(source_bytes),
                      "rasterioVersion": rasterio.__version__, "gdalVersion": rasterio.__gdal_version__,
                      "crsWkt": dataset.crs.to_wkt(), "geotransform": [dataset.transform.c, dataset.transform.a, dataset.transform.b,
                                                                     dataset.transform.f, dataset.transform.d, dataset.transform.e],
                      "grid": manifest["grid"], "encoding": manifest["encoding"],
                      "manifestBytes": manifest_path.stat().st_size, "manifestSha256": manifest_hash,
                      "summary": manifest["summary"], "outerCorners": corners, "fixtures": fixtures,
                      "processing": PROCESSING, "boundaryPolicy": BOUNDARY_POLICY,
                      "heightReferenceLimit": "Provider declares Mars IAU sphere heights; no independently validated vertical conversion is applied.",
                      "registrationLimit": "Arithmetic source-grid agreement does not establish named-feature registration or empirical imagery accuracy."}
        write_json(ROOT / "docs/evidence/controlled-jezero-grid/raster-grid-inspection.json", inspection)
        print(json.dumps({"result": "PASS", "manifestBytes": manifest_path.stat().st_size,
                          "manifestSha256": manifest_hash, "binaryBytes": len(binary), "binarySha256": binary_hash,
                          "summary": manifest["summary"], "fixtures": fixtures}, indent=2))


if __name__ == "__main__":
    main()
