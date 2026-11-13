"""Independently verify audit probe values using Rasterio (never changes app data).

uv run --with rasterio python docs/evidence/scientific-validation/height-reference/verify-native-probes.py
"""
import hashlib
import json
from pathlib import Path

import rasterio

DIRECTORY = Path(__file__).resolve().parent
ROOT = DIRECTORY.parents[3]
PRODUCT = "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0"
SOURCE = ROOT / "docs/evidence/terrain-validation/source-audit" / (PRODUCT + ".tif")
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == "16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b"
comparison = json.loads((DIRECTORY / "mola-reference-comparison.json").read_text())
with rasterio.open(SOURCE) as dataset:
    for probe in comparison["probes"]:
        value = dataset.read(1, window=rasterio.windows.Window(probe["ctxSourceColumn"], probe["ctxSourceRow"], 1, 1), masked=True)
        assert not value.mask[0, 0]
        assert float(value[0, 0]) == probe["ctxValueM"]
print(f"Rasterio independently verified {len(comparison['probes'])} native source-cell height values.")
