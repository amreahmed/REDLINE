"""Reproduce landing references; no coordinate is a current rover location.

Run with: uv run --offline --with spiceypy==8.4.0 python <this file>
Uses immutable generic and Mars 2020 kernels from the prior registration audit.
"""
import json
import math
from pathlib import Path

import spiceypy as spice

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PRIOR = ROOT / "docs/evidence/scientific-resolution-2026-11-14/registration"
KERNELS = [
    ("curiosity", HERE / "msl_ls_ops120808_iau2000_v1.bsp"),
    ("insight", HERE / "insight_ls_ops181206_iau2000_v1.bsp"),
    ("perseverance", PRIOR / "m2020_ls_ops210303_iau2000_v1.bsp"),
]

result = []
for name, path in KERNELS:
    spice.kclear()
    for generic in ("pck00010.tpc", "naif0012.tls"):
        spice.furnsh(str(PRIOR / generic))
    spice.furnsh(str(path))
    handle = spice.dafopr(str(path))
    count, comments, _ = spice.dafec(handle, 1000, 512)
    spice.dafcls(handle)
    (HERE / f"{name}-kernel-comments.txt").write_text(
        "\n".join(comments[:count]) + "\n", encoding="utf-8"
    )
    for target in spice.spkobj(str(path)):
        coverage = spice.spkcov(str(path), int(target))
        epoch = (coverage[0] + coverage[1]) / 2
        vector, _ = spice.spkpos(str(target), epoch, "IAU_MARS", "NONE", "499")
        radius, longitude, latitude = spice.reclat(vector)
        result.append({
            "id": name,
            "kernel": path.name,
            "targetId": int(target),
            "frame": "IAU_MARS",
            "genericOrientationKernel": "pck00010.tpc",
            "coordinateReference": "Planetocentric latitude; east-positive longitude, 0–360 degrees",
            "xyzKm": vector.tolist(),
            "longitude": math.degrees(longitude) % 360,
            "latitude": math.degrees(latitude),
            "radiusKm": radius,
            "coordinateAccuracy": "No positional uncertainty supplied; decimal precision is not accuracy",
            "qualification": "Fixed archived landing reference; not current rover position or independently registered imagery/DEM point",
        })
spice.kclear()
(HERE / "landing-kernel-inspection.json").write_text(
    json.dumps(result, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(result, indent=2))
