"""Build a native HRSC numerical reference without changing production CTX.

uv run --with numpy==2.5.3 --with rasterio==1.5.2 --with pyproj==3.8.0 python <this file>
Append --verify-saved for offline verification, or --self-test for only tests.

Only this directory is written. Network extraction is bounded to exact native
row segments; no resampling, interpolation, or CTX height conversion occurs.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest
from urllib.request import Request, urlopen

import numpy as np
import pyproj
import rasterio
from rasterio.windows import Window
from rasterio.warp import transform as gdal_transform


DIRECTORY = Path(__file__).resolve().parent
ROOT = DIRECTORY.parents[3]
OLD = ROOT / "docs/evidence/scientific-resolution-2026-11-14/height"
RADIUS = 3396000
NODATA = -32768
CTX_BINARY_HASH = "4c0e428bb3cc4bcd8cbcebc0c2da2558a106fc19e55cfca352097b7eee32fae8"
VERTICAL = {
    "dt5": "Height above spheroid with radius 3396.0 km|",
    "da5": "Height above equipotential surface described by potential model GMM3 (PDS dataset MGS-M-MOLA-5-MEGDR-L3-V1.0)|",
}
CRS = "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396000 +units=m +no_defs +type=crs"
GEOGRAPHIC = "+proj=longlat +R=3396000 +no_defs +type=crs"
SAVED = "--verify-saved" in sys.argv


def sha(body):
    return hashlib.sha256(body).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_or_verify(file, value):
    body = (json.dumps(value, indent=2, allow_nan=False) + "\n").encode()
    output = DIRECTORY / file
    if SAVED:
        assert output.read_bytes() == body, f"Saved report changed: {file}"
    else:
        output.write_bytes(body)


def validate_response(status, content_range, body, start, length, total):
    assert status == 206, f"Expected bounded HTTP 206, received {status}"
    assert content_range == f"bytes {start}-{start + length - 1}/{total}", "Content-Range mismatch"
    assert len(body) == length, "Native byte length mismatch"


def validate_contract(contract, kind):
    key = {item["key"]: item["value"] for item in contract["geokeys"]}
    assert (contract["width"], contract["height"]) == (13336, 17782)
    assert contract["compression"] == 1 and contract["bitsPerSample"] == [16]
    assert contract["samplesPerPixel"] == 1 and contract["rowsPerStrip"] == 1
    assert contract["sampleFormat"] == [2] and contract["noData"] == str(NODATA)
    assert contract["pixelScale"] == [50, 50, 1]
    assert contract["tiepoint"] == [0, 0, 0, 4000775, 1778175.0000000002, 0]
    assert key[1025] == 1 and key[3075] == 17 and key[3076] == 9001
    assert key[2057] == [RADIUS] and key[2058] == [RADIUS]
    assert all(key[k] == [0] for k in (2061, 3078, 3082, 3083, 3088, 3089))
    assert key[4097] == VERTICAL[kind] and key[4099] == 9001
    assert len(contract["stripOffsets"]) == contract["height"]
    assert contract["stripByteCounts"] == [contract["width"] * 2] * contract["height"]
    # An absent GDAL SCALE/OFFSET item means identity conversion; independently
    # confirmed against Rasterio's .scales/.offsets below, not inferred from range.
    assert 'role="scale"' not in contract["gdalMetadata"]
    assert 'role="offset"' not in contract["gdalMetadata"]


def range_request(job):
    kind, row, column, columns, contract = job
    start = contract["stripOffsets"][row] + column * 2
    length = columns * 2
    total = contract["totalBytes"]
    assert 0 <= start < total and start + length <= total and length <= 100000
    file = f"ranges/hrsc-{kind}-row-{row}-cols-{column}-{column + columns - 1}.bin"
    path = DIRECTORY / file
    url = f"https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_{kind}.tif"
    old = RECEIPTS_BY_FILE.get(file)
    if old is not None:
        body = path.read_bytes()
        validate_response(old["status"], old["contentRange"], body, start, length, total)
        assert old["requestedUrl"] == url and old["sha256"] == sha(body)
        return body, old
    assert not SAVED, f"Missing saved native row: {file}"
    started = utc_now()
    request = Request(url, headers={"Range": f"bytes={start}-{start + length - 1}", "Accept-Encoding": "identity"})
    with urlopen(request, timeout=45) as response:
        # Check status and exact interval BEFORE reading. Read one excess byte
        # at most so a mislabelled response cannot cause a full-file download.
        assert response.status == 206, f"Range not honored: HTTP {response.status}"
        expected = f"bytes {start}-{start + length - 1}/{total}"
        assert response.headers.get("Content-Range") == expected
        body = response.read(length + 1)
        validate_response(response.status, expected, body, start, length, total)
        receipt = {"file": file, "product": kind, "globalRow": row,
                   "firstGlobalColumn": column, "columns": columns,
                   "requestedUrl": url, "finalUrl": response.url,
                   "requestedRange": f"bytes={start}-{start + length - 1}",
                   "startedAt": started, "retrievedAt": utc_now(),
                   "status": response.status, "contentRange": expected,
                   "contentType": response.headers.get("Content-Type"),
                   "etag": response.headers.get("ETag"),
                   "lastModified": response.headers.get("Last-Modified"),
                   "httpDate": response.headers.get("Date"),
                   "bytes": len(body), "sha256": sha(body)}
    path.write_bytes(body)
    return body, receipt


def original_metadata_ranges(kind):
    receipts = json.loads((OLD / "hrsc-header-receipts.json").read_text())
    receipts += json.loads((OLD / "hrsc-extra-range-receipts.json").read_text())
    result = []
    for receipt in receipts:
        if not receipt["file"].startswith(f"hrsc-{kind}-"):
            continue
        body = (OLD / receipt["file"]).read_bytes()
        assert sha(body) == receipt["sha256"] and len(body) == receipt["bytes"]
        match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", receipt["contentRange"])
        assert match and receipt["status"] == 206
        start, end, total = map(int, match.groups())
        validate_response(206, receipt["contentRange"], body, start, end - start + 1, total)
        assert total == CONTRACTS[kind]["totalBytes"]
        result.append((start, body, receipt))
    assert result and result[0][0] == 0 and result[0][1][:4] == b"II*\x00"
    return result


def make_sparse(file):
    """Only an ephemeral validation fixture; missing ranges are never queried."""
    if os.name == "nt":
        import ctypes
        import msvcrt
        count = ctypes.c_ulong()
        handle = msvcrt.get_osfhandle(file.fileno())
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.DeviceIoControl.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p,
                                          ctypes.c_ulong, ctypes.c_void_p, ctypes.c_ulong,
                                          ctypes.POINTER(ctypes.c_ulong), ctypes.c_void_p]
        assert kernel.DeviceIoControl(handle, 0x000900C4, None, 0, None, 0,
                                     ctypes.byref(count), None), "Sparse fixture unavailable"


def rasterio_verify(kind, native, segments, start_row, start_column, rows, columns):
    # Preserve original byte offsets and TIFF metadata, allowing GDAL to decode
    # the original contract independently. Sparse holes have no observational
    # meaning; the only read window is exactly the saved rectangle.
    metadata = original_metadata_ranges(kind)
    with tempfile.TemporaryDirectory(prefix="rasterio-fixture-", dir=DIRECTORY) as temp:
        path = Path(temp) / "original-offsets-sparse.tif"
        with path.open("w+b") as file:
            make_sparse(file)
            file.truncate(CONTRACTS[kind]["totalBytes"])
            for start, body, _ in metadata:
                file.seek(start)
                file.write(body)
            for body, receipt in segments:
                start = int(receipt["requestedRange"].split("=")[1].split("-")[0])
                file.seek(start)
                file.write(body)
        with rasterio.open(path) as dataset:
            assert (dataset.width, dataset.height, dataset.count) == (13336, 17782, 1)
            assert dataset.dtypes == ("int16",) and dataset.nodata == NODATA
            assert dataset.scales == (1.0,) and dataset.offsets == (0.0,)
            expected = [4000775, 50, 0, 1778175.0000000002, 0, -50]
            assert list(dataset.transform.to_gdal()) == expected
            native_crs = dataset.crs.to_dict()
            assert native_crs["proj"] == "eqc" and native_crs["R"] == RADIUS
            assert all(native_crs[k] == 0 for k in ("lat_ts", "lat_0", "lon_0", "x_0", "y_0"))
            read = dataset.read(1, window=Window(start_column, start_row, columns, rows), masked=True)
            assert np.array_equal(read.data, native), "Independent GDAL decode mismatch"
            assert np.array_equal(np.ma.getmaskarray(read), native == NODATA)
            assert dataset.tags().get("AREA_OR_POINT") == "Area"
            return {"reader": "Rasterio/GDAL on ephemeral original-offset sparse fixture",
                    "scope": "Only saved crop read; unsaved holes are not source data and fixture is removed",
                    "samplesCompared": int(native.size), "everyRawInt16Matched": True,
                    "everyMaskMatched": True, "scale": dataset.scales[0], "offset": dataset.offsets[0],
                    "nativeGeotransform": expected, "crsWkt": dataset.crs.to_wkt(),
                    "geotiffVerticalCitation": VERTICAL[kind],
                    "metadataRanges": [{"file": str((OLD / r["file"]).relative_to(ROOT)).replace("\\", "/"),
                                        "sha256": r["sha256"], "contentRange": r["contentRange"]} for _, _, r in metadata]}


def projection_validation(grid, contract):
    forward = pyproj.Transformer.from_crs(GEOGRAPHIC, CRS, always_xy=True)
    inverse = pyproj.Transformer.from_crs(CRS, GEOGRAPHIC, always_xy=True)
    controls = []
    # Synthetic geometric fixtures define axes, radius, and units independently
    # of the data footprint. They are NOT observed Mars landmarks.
    for lon, lat, expected in [(0, 0, [0, 0]), (90, 0, [math.pi * RADIUS / 2, 0]),
                               (0, 90, [0, math.pi * RADIUS / 2]),
                               (-90, 0, [-math.pi * RADIUS / 2, 0])]:
        actual = list(forward.transform(lon, lat))
        gdal_x, gdal_y = gdal_transform(GEOGRAPHIC, CRS, [lon], [lat])
        assert np.allclose(actual, expected, atol=1e-8, rtol=0)
        assert np.allclose(actual, [gdal_x[0], gdal_y[0]], atol=1e-8, rtol=0)
        controls.append({"kind": "synthetic geometric control, not Mars observation",
                         "coordinate": [lon, lat], "expectedProjectedM": expected,
                         "projProjectedM": actual, "rasterioProjectedM": [gdal_x[0], gdal_y[0]]})
    footprints = []
    for corner in grid["outerCorners"]:
        x, y = forward.transform(*corner["coordinate"])
        x_gdal, y_gdal = gdal_transform(GEOGRAPHIC, CRS, [corner["coordinate"][0]], [corner["coordinate"][1]])
        expected = [corner["projectedM"][0] * RADIUS / grid["projection"]["radiusM"],
                    corner["projectedM"][1] * RADIUS / grid["projection"]["radiusM"]]
        assert np.allclose([x, y], expected, atol=2e-9, rtol=0)
        assert np.allclose([x, y], [x_gdal[0], y_gdal[0]], atol=2e-9, rtol=0)
        assert np.allclose(inverse.transform(x, y), corner["coordinate"], atol=1e-12, rtol=0)
        footprints.append({"name": corner["name"], "coordinate": corner["coordinate"],
                           "hrscProjectedM": [x, y],
                           "nativePixelEdge": [(x - contract["tiepoint"][3]) / 50,
                                               (contract["tiepoint"][4] - y) / 50]})
    x_min = min(p["hrscProjectedM"][0] for p in footprints)
    x_max = max(p["hrscProjectedM"][0] for p in footprints)
    y_min = min(p["hrscProjectedM"][1] for p in footprints)
    y_max = max(p["hrscProjectedM"][1] for p in footprints)
    c0 = math.floor((x_min - contract["tiepoint"][3]) / 50)
    c1 = math.ceil((x_max - contract["tiepoint"][3]) / 50)
    r0 = math.floor((contract["tiepoint"][4] - y_max) / 50)
    r1 = math.ceil((contract["tiepoint"][4] - y_min) / 50)
    assert (r0, r1, c0, c1) == (13605, 13708, 11661, 11764)
    assert 0 <= r0 < r1 <= contract["height"] and 0 <= c0 < c1 <= contract["width"]
    fixtures = []
    for fixture in grid["fixtures"]:
        x, y = forward.transform(*fixture["coordinate"])
        row = math.floor((contract["tiepoint"][4] - y) / 50)
        col = math.floor((x - contract["tiepoint"][3]) / 50)
        wrong_x, wrong_y = fixture["pixelCenterM"]
        wrong_row = math.floor((contract["tiepoint"][4] - wrong_y) / 50)
        wrong_col = math.floor((wrong_x - contract["tiepoint"][3]) / 50)
        assert (row, col) != (wrong_row, wrong_col), "Wrong sphere must change fixture indices"
        fixtures.append({"ctxGlobalCell": [fixture["row"], fixture["column"]],
                         "coordinate": fixture["coordinate"], "hrscGlobalCell": [row, col],
                         "wrongRadiusGlobalCell": [wrong_row, wrong_col],
                         "wrongRadiusProjectedShiftM": [wrong_x - x, wrong_y - y]})
    return {"pyprojVersion": pyproj.__version__, "projVersion": pyproj.proj_version_str,
            "rasterioVersion": rasterio.__version__, "gdalVersion": rasterio.__gdal_version__,
            "axisPolicy": "always_xy: longitude, latitude; positive east, north; metres",
            "geographicCrs": GEOGRAPHIC, "projectedCrs": CRS,
            "geometricControls": controls, "originalFootprintCorners": footprints,
            "fixtureRadiusChecks": fixtures, "originalFootprintHrscBounds": [x_min, y_min, x_max, y_max],
            "nativeWindow": {"startRow": r0, "startColumn": c0, "rows": r1-r0, "columns": c1-c0},
            "registrationLimit": "Independent projection/reader checks establish coordinate and native-grid arithmetic, not empirical landmark registration or source co-registration accuracy"}


class ContractTests(unittest.TestCase):
    def test_range_ignored(self):
        with self.assertRaises(AssertionError):
            validate_response(200, "bytes 8-9/100", b"xx", 8, 2, 100)

    def test_truncated_response(self):
        with self.assertRaises(AssertionError):
            validate_response(206, "bytes 8-9/100", b"x", 8, 2, 100)

    def test_changed_total_size(self):
        with self.assertRaises(AssertionError):
            validate_response(206, "bytes 8-9/101", b"xx", 8, 2, 100)

    def test_wrong_interval(self):
        with self.assertRaises(AssertionError):
            validate_response(206, "bytes 9-10/100", b"xx", 8, 2, 100)

    def test_missing_is_not_zero_height(self):
        values = np.frombuffer(b"\x00\x80\x00\x00\xff\xff", dtype="<i2")
        self.assertEqual(values.tolist(), [NODATA, 0, -1])
        self.assertEqual((values != NODATA).astype("u1").tolist(), [0, 1, 1])

    def test_unchanged_native_signed_bytes(self):
        values = np.array([-32768, -4009, -1, 0, 32767], dtype="<i2")
        self.assertEqual(np.frombuffer(values.tobytes(), dtype="<i2").tolist(), values.tolist())


def main():
    global CONTRACTS, RECEIPTS_BY_FILE
    CONTRACTS = json.loads((OLD / "hrsc-tiff-contracts.json").read_text())
    for kind, contract in CONTRACTS.items():
        validate_contract(contract, kind)
    assert CONTRACTS["dt5"]["tiepoint"] == CONTRACTS["da5"]["tiepoint"]
    assert CONTRACTS["dt5"]["stripOffsets"] == CONTRACTS["da5"]["stripOffsets"]
    grid_file = ROOT / "public/data/jezero-terrain-grid.json"
    grid = json.loads(grid_file.read_text())
    ctx_bytes = (ROOT / "public/data/jezero-terrain-grid.f32").read_bytes()
    assert grid["encoding"]["sha256"] == CTX_BINARY_HASH == sha(ctx_bytes)
    assert len(ctx_bytes) == 65536 * 4 and grid["grid"] == {"startColumn": 522, "startRow": 586, "columns": 256, "rows": 256}
    projection = projection_validation(grid, CONTRACTS["dt5"])
    window = projection["nativeWindow"]
    r0, c0, rows, columns = (window[k] for k in ("startRow", "startColumn", "rows", "columns"))
    if not SAVED:
        (DIRECTORY / "ranges").mkdir(exist_ok=True)
    receipt_file = DIRECTORY / "http-range-receipts.json"
    old_receipts = json.loads(receipt_file.read_text()) if receipt_file.exists() else []
    RECEIPTS_BY_FILE = {receipt["file"]: receipt for receipt in old_receipts}
    products, arrays, readers, new_receipts = {}, {}, {}, []
    for kind in ("dt5", "da5"):
        jobs = [(kind, row, c0, columns, CONTRACTS[kind]) for row in range(r0, r0+rows)]
        segments = []
        # Independent, tiny rows fetched concurrently; no mutable receipt state
        # is shared by workers. Persist each completed batch for resumability.
        with ThreadPoolExecutor(max_workers=4) as workers:
            for body, receipt in workers.map(range_request, jobs):
                segments.append((body, receipt))
                new_receipts.append(receipt)
                if not SAVED and len(segments) % 16 == 0:
                    saved_by_file = {r["file"]: r for r in old_receipts + new_receipts}
                    write_or_verify("http-range-receipts.json", sorted(saved_by_file.values(), key=lambda r: (r["product"], r["globalRow"])))
        if not SAVED:
            saved_by_file = {r["file"]: r for r in old_receipts + new_receipts}
            write_or_verify("http-range-receipts.json", sorted(saved_by_file.values(), key=lambda r: (r["product"], r["globalRow"])))
        validators = {(r["etag"], r["lastModified"]) for _, r in segments}
        assert len(validators) == 1, "Source validator changed during extraction"
        raw = b"".join(body for body, _ in segments)
        native = np.frombuffer(raw, dtype="<i2").reshape(rows, columns)
        mask = (native != NODATA).astype("u1")
        arrays[kind] = native
        binary_file, mask_file = f"hrsc-{kind}-native.i16", f"hrsc-{kind}-validity.u8"
        if SAVED:
            assert (DIRECTORY / binary_file).read_bytes() == raw
            assert (DIRECTORY / mask_file).read_bytes() == mask.tobytes()
        else:
            (DIRECTORY / binary_file).write_bytes(raw)
            (DIRECTORY / mask_file).write_bytes(mask.tobytes())
        readers[kind] = rasterio_verify(kind, native, segments, r0, c0, rows, columns)
        valid = native[mask == 1]
        products[kind] = {"productId": f"HMC_13E10_{kind.upper()}",
                          "url": segments[0][1]["requestedUrl"], "resourceBytes": CONTRACTS[kind]["totalBytes"],
                          "scale": 1, "offset": 0, "noData": NODATA, "units": "m",
                          "verticalReference": VERTICAL[kind],
                          "positiveDirection": "height above named surface; positive outward/up",
                          "geotiffGeoKeys": CONTRACTS[kind]["geokeys"],
                          "encoding": {"file": binary_file, "sampleType": "int16", "byteOrder": "little-endian",
                                       "layout": "row-major", "bytes": len(raw), "sha256": sha(raw)},
                          "validity": {"file": mask_file, "encoding": "uint8", "validValue": 1,
                                       "noDataValue": 0, "bytes": mask.size, "sha256": sha(mask.tobytes())},
                          "summary": {"validCount": int(valid.size), "missingCount": int(native.size-valid.size),
                                      "minM": int(valid.min()) if valid.size else None,
                                      "maxM": int(valid.max()) if valid.size else None},
                          "downloadValidators": {"etag": segments[0][1]["etag"], "lastModified": segments[0][1]["lastModified"],
                                                 "meaning": "HTTP cache validator/last modification, not acquisition date or scientific version"}}
    assert len(new_receipts) == 206
    receipts_sorted = sorted(new_receipts, key=lambda r: (r["product"], r["globalRow"]))
    write_or_verify("http-range-receipts.json", receipts_sorted)
    paired = (arrays["dt5"] != NODATA) & (arrays["da5"] != NODATA)
    assert np.array_equal(arrays["dt5"] == NODATA, arrays["da5"] == NODATA), "Paired mask differs"
    delta = arrays["dt5"].astype("int32") - arrays["da5"].astype("int32")
    areoid_radius = RADIUS + delta
    dt_ctx_sphere = arrays["dt5"].astype("int32") - 190
    assert np.array_equal((RADIUS + arrays["dt5"].astype("int32"))[paired],
                          (areoid_radius + arrays["da5"].astype("int32"))[paired])
    assert np.array_equal((3396190 + dt_ctx_sphere)[paired],
                          (RADIUS + arrays["dt5"].astype("int32"))[paired])
    prior = json.loads((OLD / "hrsc-control-comparison.json").read_text())
    for probe in prior["probes"]:
        for kind in ("dt5", "da5"):
            cell = probe[kind]
            assert int(arrays[kind][cell["row"]-r0, cell["column"]-c0]) == cell["valueM"]
    bounds = projection["originalFootprintHrscBounds"]
    col_left = 4000775 + np.arange(c0, c0+columns)*50
    row_top = 1778175.0000000002 - np.arange(r0, r0+rows)*50
    whole_cols = (col_left >= bounds[0]) & (col_left+50 <= bounds[2])
    whole_rows = (row_top <= bounds[3]) & (row_top-50 >= bounds[1])
    whole = whole_rows[:, None] & whole_cols[None, :]
    coverage = {"entireAlignedCropPairedValid": bool(paired.all()), "pairedValidCount": int(paired.sum()),
                "pairedMissingCount": int(paired.size-paired.sum()), "nativeCellsWhollyInsideOriginalFootprint": int(whole.sum()),
                "boundaryOverhangCells": int(whole.size-whole.sum()),
                "whollyCoveredGlobalRowsInclusive": [int(r0+np.where(whole_rows)[0][0]), int(r0+np.where(whole_rows)[0][-1])],
                "whollyCoveredGlobalColumnsInclusive": [int(c0+np.where(whole_cols)[0][0]), int(c0+np.where(whole_cols)[0][-1])],
                "policy": "Native crop includes all cells intersecting original geographic footprint; retain border cells but reject them for whole-support CTX comparisons"}
    inverse = pyproj.Transformer.from_crs(CRS, GEOGRAPHIC, always_xy=True)
    crop_bounds = [4000775+c0*50, 1778175.0000000002-(r0+rows)*50,
                   4000775+(c0+columns)*50, 1778175.0000000002-r0*50]
    accepted_bounds = [float(col_left[whole_cols][0]), float(row_top[whole_rows][-1]-50),
                       float(col_left[whole_cols][-1]+50), float(row_top[whole_rows][0])]

    def extent(bounds_m):
        west, south = inverse.transform(bounds_m[0], bounds_m[1])
        east, north = inverse.transform(bounds_m[2], bounds_m[3])
        return {"projectedBoundsM": bounds_m, "geographicBoundsDeg": [west, south, east, north],
                "axisOrder": "west, south, east, north; positive-east longitude, latitude"}

    coverage["nativeAlignedCropExtent"] = extent(crop_bounds)
    coverage["whollyCoveredComparisonExtent"] = extent(accepted_bounds)
    coverage["originalFootprintExtent"] = extent(bounds)
    algebra = {"purpose": "Named vertical-reference arithmetic only; not an empirical CTX datum correction",
               "equations": ["radius = 3396000 + DT5", "GMM3_areoid_radius = 3396000 + DT5 - DA5",
                             "height_above_3396190_sphere = DT5 - 190"],
               "pairedValidCells": int(paired.sum()),
               "dt5MinusDa5M": {"min": int(delta[paired].min()), "max": int(delta[paired].max())},
               "impliedGmm3AreoidRadiusM": {"min": int(areoid_radius[paired].min()), "max": int(areoid_radius[paired].max())},
               "allPairedRadiusIdentitiesExactInteger": True, "earlierNativeControlPairsMatched": len(prior["probes"]),
               "limit": "This tests internally consistent paired definitions and retained samples; it is not an independent reconstruction of the GMM3 potential model or a local vertical-error bound"}
    input_files = ["public/data/jezero-terrain-grid.json", "public/data/jezero-terrain-grid.f32",
                   "public/data/jezero-terrain-windows.json", "scripts/prepare-terrain-grid.py",
                   "scripts/prepare-terrain-windows.py",
                   "docs/evidence/scientific-resolution-2026-11-14/height/hrsc-tiff-contracts.json",
                   "docs/evidence/scientific-resolution-2026-11-14/height/hrsc-readme.txt",
                   "docs/evidence/scientific-resolution-2026-11-14/height/hrsc-tiling-naming.pdf",
                   "docs/evidence/terrain-validation/source-audit/"+grid["source"]["productId"]+".tif"]
    preserved = [{"file": file, "sha256": sha((ROOT/file).read_bytes())} for file in input_files]
    assert preserved[-1]["sha256"] == grid["source"]["sha256"], "Original production TIFF changed"
    inherited = json.loads((OLD/"http-receipts.json").read_text())
    for name in ("hrsc-readme.txt", "hrsc-tiling-naming.pdf"):
        receipt = next(r for r in inherited if r.get("file") == name)
        assert receipt["status"] == 200 and receipt["sha256"] == sha((OLD/name).read_bytes())
    manifest = {"schemaVersion": 1, "purpose": "Separate native HRSC numerical reference around preserved original CTX crop; not production replacement or independent ground truth",
                "provider": "DLR HRSC Science Team Global Topography and Mosaics Task Group (GTMTG), Mars Express HRSC",
                "projection": {"proj": "eqc", "radiusM": RADIUS, "standardParallelDeg": 0,
                               "centralMeridianDeg": 0, "latitudeOfOriginDeg": 0, "falseEastingM": 0,
                               "falseNorthingM": 0, "latitudeConvention": "planetocentric on sphere",
                               "longitudeDirection": "east-positive", "longitudeRange": "0-360", "units": "m",
                               "projString": CRS}, "grid": window,
                "sourceGeotransform": [4000775, 50, 0, 1778175.0000000002, 0, -50],
                "cropGeotransform": [4000775+c0*50, 50, 0, 1778175.0000000002-r0*50, 0, -50],
                "geotransformConvention": "GDAL: [upper-left X edge, pixel width, row rotation, upper-left Y edge, column rotation, pixel height]; AREA pixels, centre uses index + 0.5",
                "nativePostingM": 50, "processing": "Native uncompressed TIFF strip-byte extraction only; signed int16 retained; no resampling/interpolation/CTX conversion",
                "products": products, "coverage": coverage, "originalFootprintHrscBounds": bounds,
                "originalCtx": {"productId": grid["source"]["productId"], "grid": grid["grid"],
                                "cells": 65536, "binarySha256": CTX_BINARY_HASH,
                                "manifestSha256": sha(grid_file.read_bytes()), "datumGate": "unresolved; no relabel or conversion"},
                "preservedInputs": preserved,
                "receiptFile": "http-range-receipts.json", "receiptSha256": sha((DIRECTORY/"http-range-receipts.json").read_bytes()),
                "sourceVersion": {"exactAcquisitionDates": None, "scientificReleaseVersion": None,
                                  "processingLevel": 5, "subTileIndex": "10",
                                  "namingDocumentDate": "2019-10-29",
                                  "filenameMeaning": "HMC_13E10: MC-13 eastern half, sub-tile 10; dt5/da5 identify spheroid/areoid Level-5 DTM. The 10 is not a version identifier.",
                                  "limit": "Multi-orbit mosaic; exact crop acquisition/orbit contributor list and scientific version not supplied in inspected original TIFF/readme"},
                "attribution": {"credit": "Terrain data: ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO",
                                "licence": "CC BY-SA 3.0 IGO",
                                "licenceUrl": "https://creativecommons.org/licenses/by-sa/3.0/igo/",
                                "providerTermsUrl": "https://hrscteam.dlr.de/imprint_hrsc_en.php",
                                "savedTermsEvidence": "hrsc-usage-imprint.html",
                                "changeNotice": "Native spatial subset and separately supplied validity mask; original integer height samples retained",
                                "productMethodologyCitation": "Gwinner et al. (2016), Planetary and Space Science 126, 93-138, doi:10.1016/j.pss.2016.02.014"},
                "resolutionLimit": "50 m grid spacing and 1 m quantization are verified; local effective terrain resolution, native stereo support, acquisition list, horizontal/vertical error and feature registration remain unverified",
                "lineageLimit": "HRSC is part of CTX control lineage; agreement is diagnostic and cannot validate CTX absolute datum or supply independent ground truth",
                "applicationIntegration": "none; app, CTX samples/manifests/transforms, routes remain unchanged"}
    write_or_verify("projection-validation.json", projection)
    write_or_verify("native-reader-validation.json", readers)
    write_or_verify("paired-vertical-validation.json", algebra)
    write_or_verify("hrsc-native-reference.json", manifest)
    print(json.dumps({"result": "PASS", "mode": "offline saved verification" if SAVED else "native reference build",
                      "nativeWindow": window, "coverage": coverage,
                      "nativeRawBytesFetched": sum(r["bytes"] for r in new_receipts),
                      "allRasterioNativeSamplesAndMasksMatched": True,
                      "pairedVerticalAlgebra": algebra, "productionCtxSha256": sha(ctx_bytes)}, indent=2))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ContractTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        sys.exit(1)
    if "--self-test" not in sys.argv:
        main()
