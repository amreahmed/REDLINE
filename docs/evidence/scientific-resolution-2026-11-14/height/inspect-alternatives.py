"""Inspect new numeric candidate contracts without altering production terrain.

Run with uv run --with rasterio --with numpy python <this file>.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.io import MemoryFile

DIRECTORY = Path(__file__).resolve().parent
ROOT = DIRECTORY.parents[3]
grid = json.loads((ROOT / "public/data/jezero-terrain-grid.json").read_text())
probes = [fixture for fixture in grid["fixtures"]]

def inspect(dataset):
    return {"width": dataset.width, "height": dataset.height, "count": dataset.count,
            "dtypes": dataset.dtypes, "nodata": dataset.nodata, "scales": dataset.scales,
            "offsets": dataset.offsets, "transform": list(dataset.transform),
            "bounds": list(dataset.bounds), "crs": dataset.crs.to_wkt(),
            "tags": dataset.tags(), "band_tags": dataset.tags(1),
            "tag_namespaces": dataset.tag_namespaces(),
            "image_structure": dataset.tags(ns="IMAGE_STRUCTURE")}

results = {}
receipts = json.loads((DIRECTORY / "http-receipts.json").read_text())
for name in ["ctx-f05-native", "ctx-j03-native", "ctx-j21-j22-native"]:
    body_hash = hashlib.sha256((DIRECTORY / (name + ".tif")).read_bytes()).hexdigest()
    receipt = next(entry for entry in receipts if entry.get("file") == name + ".tif")
    assert body_hash == receipt["sha256"], "Candidate source body changed"
    with rasterio.open(DIRECTORY / (name + ".tif")) as dataset:
        result = inspect(dataset)
        transform = dataset.crs.to_dict()
        coordinates = [(transform["R"] * np.deg2rad(p["coordinate"][0]), transform["R"] * np.deg2rad(p["coordinate"][1])) for p in probes]
        samples = list(dataset.sample(coordinates, masked=True))
        result["current_grid_fixture_samples"] = [{"source_cell": [p["row"], p["column"]], "mosaic_value_m": p["elevationM"], "candidate_value_m": None if bool(s.mask[0]) else float(s[0]), "candidate_indices": list(dataset.index(*coordinate))} for p, s, coordinate in zip(probes, samples, coordinates)]
        result["sha256"] = body_hash
        results[name] = result
for kind in ["dt5", "da5"]:
    name = "hrsc-" + kind + "-header"
    candidate = DIRECTORY / (name + ".bin")
    if not candidate.exists():
        continue
    try:
        with MemoryFile(candidate.read_bytes()) as memory:
            with memory.open() as dataset:
                results[name] = inspect(dataset)
    except Exception as error:
        message = str(error)
        stable_error = message[message.index("TIFFReadDirectory:"):] if "TIFFReadDirectory:" in message else message
        results[name] = {"header_only_error": stable_error, "resolved_by": "Receipt-backed tail IFD and pointed metadata ranges in hrsc-tiff-contracts.json; initial 64KiB header alone does not contain the IFD."}
output = json.dumps(results, indent=2, allow_nan=False) + "\n"
output_path = DIRECTORY / "alternative-contracts.json"
if "--verify-saved" in sys.argv:
    assert output_path.read_text() == output, "Saved alternative contracts changed"
    print("Verified three archived CTX component contracts and seven native-fixture comparisons per component.")
else:
    output_path.write_text(output)
    print("Inspected three archived CTX component contracts; HRSC tail metadata is resolved separately.")
