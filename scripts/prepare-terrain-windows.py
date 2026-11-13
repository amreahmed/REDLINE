"""Verify the pinned USGS GeoTIFF and extract native cells without resampling.

Run from the repository: uv run --with rasterio --with numpy python scripts/prepare-terrain-windows.py
The downloaded source remains evidence; only bounded JSON windows go into the app.
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
HALF_WIDTH = 0.005
EXPECTED_TRANSFORM = (20.0, 0.0, 4573663.250853, 0.0, -20.0, 1109693.140188, 0.0, 0.0, 1.0)
NODATA = -3.4028226550889045e38


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Canonical UTF-8/LF bytes keep the browser integrity hash portable across hosts.
    path.write_bytes((json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8"))


def main():
    source_bytes = SOURCE.read_bytes()
    assert hashlib.sha256(source_bytes).hexdigest() == SOURCE_HASH, "Source hash changed; re-audit before processing"
    records = json.loads((ROOT / "docs/evidence/phase-3-targets/target-records.json").read_text(encoding="utf-8"))
    with rasterio.open(SOURCE) as dataset:
        assert (dataset.width, dataset.height, dataset.count) == (1596, 1512, 1)
        assert dataset.dtypes == ("float32",)
        assert tuple(dataset.transform) == EXPECTED_TRANSFORM
        assert dataset.nodata == NODATA
        assert dataset.scales == (1.0,) and dataset.offsets == (0.0,)
        assert dataset.tags().get("AREA_OR_POINT") == "Area"
        projection = dataset.crs.to_dict()
        assert projection["proj"] == "eqc" and projection["lat_ts"] == 0
        assert projection["lon_0"] == 0 and projection["x_0"] == 0 and projection["y_0"] == 0
        assert projection["R"] == RADIUS and projection["units"] == "m"
        full = dataset.read(1, masked=True)
        assert np.isfinite(full.compressed()).all()
        windows = []
        fixtures = []
        for record in records:
            lon, lat = record["coordinate"]["lon"], record["coordinate"]["lat"]
            # Include cells intersecting the decimal-quantization neighborhood.
            # This is a display neighborhood, not a positional error/accuracy bound.
            west_x = RADIUS * math.radians(lon - HALF_WIDTH)
            east_x = RADIUS * math.radians(lon + HALF_WIDTH)
            north_y = RADIUS * math.radians(lat + HALF_WIDTH)
            south_y = RADIUS * math.radians(lat - HALF_WIDTH)
            c0 = math.floor((west_x - dataset.transform.c) / 20)
            c1 = math.ceil((east_x - dataset.transform.c) / 20)
            r0 = math.floor((dataset.transform.f - north_y) / 20)
            r1 = math.ceil((dataset.transform.f - south_y) / 20)
            assert 0 <= c0 < c1 <= dataset.width and 0 <= r0 < r1 <= dataset.height
            native = dataset.read(1, window=Window(c0, r0, c1 - c0, r1 - r0), masked=True)
            mask = np.ma.getmaskarray(native)
            values = [None if missing else float(value) for value, missing in zip(native.data.flat, mask.flat)]
            windows.append({"id": record["id"], "center": [lon, lat], "halfWidthDeg": HALF_WIDTH,
                            "startColumn": c0, "startRow": r0, "columns": c1 - c0,
                            "rows": r1 - r0, "values": values})
            x, y = RADIUS * math.radians(lon), RADIUS * math.radians(lat)
            row, column = dataset.index(x, y)
            value = full[row, column]
            fixtures.append({"id": record["id"], "coordinate": [lon, lat], "row": row, "column": column,
                             "value": None if np.ma.is_masked(value) else float(value),
                             "pixelCenter": list(dataset.xy(row, column)),
                             "interpretation": "native containing cell at published coordinates, not a named-site observation"})
        source = {"productId": PRODUCT, "sha256": SOURCE_HASH, "url": SOURCE_URL, "units": "m",
                  "heightReference": "provider-declared-iau-sphere-unvalidated"}
        contract = {"schemaVersion": 1, "source": source,
                    "projection": {"kind": "equirectangular", "radiusM": RADIUS, "standardParallelDeg": 0,
                                   "centralMeridianDeg": 0, "latitudeConvention": "planetocentric",
                                   "longitudeDirection": "east-positive"},
                    "grid": {"columns": dataset.width, "rows": dataset.height, "originX": dataset.transform.c,
                             "originY": dataset.transform.f, "pixelSizeM": 20, "noData": NODATA},
                    "windows": windows}
        output = ROOT / "public/data/jezero-terrain-windows.json"
        write_json(output, contract)
        inspection = {"source": source, "sourceBytes": len(source_bytes), "rasterioVersion": rasterio.__version__,
                      "gdalVersion": rasterio.__gdal_version__, "crsWkt": dataset.crs.to_wkt(),
                      "geotransform": [dataset.transform.c, dataset.transform.a, dataset.transform.b,
                                       dataset.transform.f, dataset.transform.d, dataset.transform.e],
                      "validCount": int(full.count()), "missingCount": int(full.size - full.count()),
                      "actualRangeM": [float(full.min()), float(full.max())],
                      "providerMetadataRangeM": [-2710.414794921875, -1522.2337646484375],
                      "fixtures": fixtures,
                      "windowSummary": [{"id": item["id"], "startRow": item["startRow"], "startColumn": item["startColumn"],
                                         "rows": item["rows"], "columns": item["columns"],
                                         "rangeM": [min(v for v in item["values"] if v is not None), max(v for v in item["values"] if v is not None)],
                                         "missingCount": item["values"].count(None)} for item in windows],
                      "derivedBytes": output.stat().st_size,
                      "derivedSha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                      "processing": "native cell-window extraction only; no resampling, rounding, datum change, or interpolation",
                      "neighborhoodPolicy": "+/-0.005 degree decimal-display neighborhood, not a positional accuracy bound"}
        write_json(ROOT / "docs/evidence/terrain-validation/raster-inspection.json", inspection)
        print(json.dumps({"result": "PASS", "sourceValidCells": int(full.count()), "fixtures": fixtures,
                          "derivedBytes": output.stat().st_size, "derivedSha256": inspection["derivedSha256"]}, indent=2))


if __name__ == "__main__":
    main()
