"""Independent degree-domain / Gauss-quadrature check of selected real cells.

Only this lane's review JSON is written. Root-owned JS and input data are read.
Run with uv --with numpy==2.5.3 --with pyproj==3.8.0; --verify-saved is offline.
"""

import csv
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import pyproj


DIRECTORY = Path(__file__).resolve().parent
ROOT = DIRECTORY.parents[3]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    reference = json.loads((DIRECTORY/"hrsc-native-reference.json").read_text())
    manifest = json.loads((ROOT/"public/data/jezero-terrain-grid.json").read_text())
    binary = ROOT/"public/data/jezero-terrain-grid.f32"
    assert digest(binary) == manifest["encoding"]["sha256"]
    native = np.frombuffer(binary.read_bytes(), dtype="<f4").reshape(256, 256)
    csv_path = DIRECTORY.parent/"comparison/native-support-comparisons.csv"
    with csv_path.open(newline="") as file:
        rows = list(csv.DictReader(file))
    centre = next(row for row in rows if row["hrsc_source_row"] == "13656" and row["hrsc_source_column"] == "11712")
    selected = [rows[0], rows[-1], centre]
    for column in ("ctx_minus_da5_m", "ctx_minus_dt5_above_3396190_sphere_m"):
        selected += [min(rows, key=lambda row: float(row[column])), max(rows, key=lambda row: float(row[column]))]
    selected = list({(row["hrsc_source_row"], row["hrsc_source_column"]): row for row in selected}.values())
    radius = manifest["projection"]["radiusM"]
    ctx_geo = pyproj.Transformer.from_crs(
        f"+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +type=crs",
        f"+proj=longlat +R={radius} +type=crs", always_xy=True)
    hrsc_geo = pyproj.Transformer.from_crs(reference["projection"]["projString"],
                                         "+proj=longlat +R=3396000 +type=crs", always_xy=True)
    ctx_x = manifest["sourceGrid"]["originX"] + (manifest["grid"]["startColumn"]+np.arange(257))*20
    ctx_y = manifest["sourceGrid"]["originY"] - (manifest["grid"]["startRow"]+np.arange(257))*20
    ctx_lon, _ = ctx_geo.transform(ctx_x, np.zeros(257))
    _, ctx_lat = ctx_geo.transform(np.zeros(257), ctx_y)
    nodes, coefficients = np.polynomial.legendre.leggauss(8)
    checks = []
    for row in selected:
        global_row, global_column = int(row["hrsc_source_row"]), int(row["hrsc_source_column"])
        source_x = reference["sourceGeotransform"][0]
        source_y = reference["sourceGeotransform"][3]
        west, south = hrsc_geo.transform(source_x+global_column*50, source_y-(global_row+1)*50)
        east, north = hrsc_geo.transform(source_x+(global_column+1)*50, source_y-global_row*50)
        # Work entirely in longitude/latitude domain. Integrate the spherical
        # cos(phi) Jacobian by independent eight-node quadrature, rather than
        # repeating the JS sine-difference implementation.
        west_edges = np.maximum(ctx_lon[:-1], west)
        east_edges = np.minimum(ctx_lon[1:], east)
        north_edges = np.minimum(ctx_lat[:-1], north)
        south_edges = np.maximum(ctx_lat[1:], south)
        supported_cols = np.where(east_edges > west_edges)[0]
        supported_rows = np.where(north_edges > south_edges)[0]
        assert supported_cols.size and supported_rows.size
        widths = np.deg2rad(east_edges[supported_cols]-west_edges[supported_cols])
        lower = np.deg2rad(south_edges[supported_rows])
        upper = np.deg2rad(north_edges[supported_rows])
        midpoint, half_width = (upper+lower)/2, (upper-lower)/2
        latitude_integrals = half_width*np.sum(np.cos(midpoint[:, None]+half_width[:, None]*nodes)*coefficients, axis=1)
        areas = radius**2*latitude_integrals[:, None]*widths[None, :]
        values = native[np.ix_(supported_rows, supported_cols)].astype("float64")
        assert np.isfinite(values).all() and not np.any(values == manifest["sourceGrid"]["noData"])
        scalar = float(np.sum(values*areas)/np.sum(areas))
        area = float(np.sum(areas))
        expected_scalar, expected_area = float(row["ctx_area_weighted_scalar_m"]), float(row["spherical_support_area_m2"])
        assert abs(scalar-expected_scalar) < 2e-7
        assert abs(area-expected_area) < 2e-6
        assert int(values.size) == int(row["ctx_support_cells"])
        checks.append({"hrscGlobalCell": [global_row, global_column],
                       "geographicFootprintDeg": [west, south, east, north],
                       "ctxSupportGlobalRowsInclusive": [int(supported_rows[0])+586, int(supported_rows[-1])+586],
                       "ctxSupportGlobalColumnsInclusive": [int(supported_cols[0])+522, int(supported_cols[-1])+522],
                       "ctxSupportCells": int(values.size), "pythonQuadratureScalarM": scalar,
                       "jsScalarM": expected_scalar, "scalarDifferenceM": scalar-expected_scalar,
                       "pythonQuadratureAreaM2": area, "jsAreaM2": expected_area,
                       "areaDifferenceM2": area-expected_area})
    report = {"purpose": "Independent numerical review of root-owned native-footprint comparison; no source correction or empirical accuracy claim",
              "pythonProjection": {"pyprojVersion": pyproj.__version__, "projVersion": pyproj.proj_version_str},
              "areaMethod": "Eight-point Gauss-Legendre quadrature of R^2*cos(latitude)*dlatitude*dlongitude over native-cell intersections",
              "model": "CTX scalar constant over native area; this is a comparison assumption, not a measured footprint mean",
              "reviewedScripts": [{"file": file, "sha256": digest(ROOT/file)} for file in ("scripts/native-support.mjs", "scripts/compare-ctx-hrsc-support.mjs")],
              "nativeManifestSha256": digest(DIRECTORY/"hrsc-native-reference.json"),
              "comparisonCsvSha256": digest(csv_path), "selectedChecks": checks,
              "assessment": "Radius-ratio geometric conversion is correct for both documented spherical EQC CRSs; surface-area overlap weighting and strict border/NoData rejection are consistent with declared comparison model",
              "limits": "PROJ/independent quadrature checks establish numerical implementation only; raster posts are not guaranteed areal means and shared HRSC/CTX lineage prevents ground-truth or datum identification claims"}
    output = (json.dumps(report, indent=2, allow_nan=False)+"\n").encode()
    output_path = DIRECTORY/"native-support-independent-review.json"
    if "--verify-saved" in sys.argv:
        assert output_path.read_bytes() == output
    else:
        output_path.write_bytes(output)
    print(json.dumps({"result": "PASS", "checkedRealCells": len(checks),
                      "maxAbsScalarDifferenceM": max(abs(check["scalarDifferenceM"]) for check in checks),
                      "maxAbsAreaDifferenceM2": max(abs(check["areaDifferenceM2"]) for check in checks)}, indent=2))


if __name__ == "__main__":
    main()
