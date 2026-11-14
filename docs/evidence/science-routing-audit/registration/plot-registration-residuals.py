"""Plot measured sample distribution and relative residuals; no accuracy claim."""
import csv
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
rows = list(csv.DictReader((HERE / 'relative-image-residuals.csv').open(newline='', encoding='utf-8')))
broad = [r for r in rows if r['set'] == 'broad']
selected = [r for r in rows if r['set'] == 'multiscale_subset']
assert len(broad) == 159 and len(selected) == 8
manifest = json.loads((ROOT / 'public/data/jezero-terrain-grid.json').read_bytes())
summary = json.loads((HERE / 'independent-residual-summary.json').read_bytes())
coords = [v['coordinate'] for v in manifest['outerCorners']]
west, east = min(v[0] for v in coords), max(v[0] for v in coords)
south, north = min(v[1] for v in coords), max(v[1] for v in coords)
places_north = 1097070 / 3396190 * 180 / 3.141592653589793
fig, axes = plt.subplots(1, 2, figsize=(12, 5.5), constrained_layout=True)
axes[0].add_patch(Rectangle((west, places_north), east - west, north - places_north, facecolor='#ececec', edgecolor='#999999', hatch='///', linewidth=.5))
axes[0].text((west + east) / 2, (places_north + north) / 2, 'No PLACES cutout coverage', ha='center', va='center', fontsize=9)
for split, marker, label in [('fit', 'o', 'Fit: 97 ties / 5 patches'), ('held_out', '^', 'Held out: 62 ties / 4 patches')]:
    part = [r for r in broad if r['split'] == split]
    scatter = axes[0].scatter([float(r['ctx_longitude_deg']) for r in part], [float(r['ctx_planetocentric_latitude_deg']) for r in part], c=[float(r['residual_surface_m']) for r in part], vmin=0, vmax=6.2, cmap='viridis', marker=marker, s=22, label=label)
axes[0].scatter([float(r['ctx_longitude_deg']) for r in selected], [float(r['ctx_planetocentric_latitude_deg']) for r in selected], facecolors='none', edgecolors='black', s=80, linewidths=.7, label='Eight multiscale-selected ties')
axes[0].set(xlim=(west, east), ylim=(south, north), xlabel='Positive-east longitude (degrees)', ylabel='Planetocentric latitude (degrees)', title='Sampled overlap of the preserved live crop')
axes[0].ticklabel_format(useOffset=False)
axes[0].legend(loc='lower center', fontsize=8, framealpha=.9)
fig.colorbar(scatter, ax=axes[0], label='Broad-set relative residual on R=3,396,190 m sphere (m)', shrink=.8)
for split, color in [('fit', '#346e9c'), ('held_out', '#c26735')]:
    values = [float(r['residual_surface_m']) for r in broad if r['split'] == split]
    axes[1].hist(values, bins=[i / 2 for i in range(14)], histtype='step', linewidth=2, color=color, label=split.replace('_', ' '))
axes[1].set(xlabel='Relative image residual on declared Mars sphere (m)', ylabel='Image-texture tie count', title='Residual distribution after unapplied diagnostic fit')
axes[1].legend()
axes[1].text(.98, .96, 'Held-out projected RMS: 2.01962 m\nHeld-out sphere RMS: 1.94512 m\nMaximum template sensitivity: 47.792 m', transform=axes[1].transAxes, ha='right', va='top', fontsize=9)
fig.suptitle('Relative PLACES / controlled-CTX diagnostic — shared mission-map lineage', fontsize=12)
fig.supxlabel('Texture ties are independent of this fit, not independent absolute geodetic controls. No accuracy threshold or map correction is applied.', fontsize=9)
fig.savefig(HERE / 'relative-registration-diagnostic.png', dpi=160)
plt.close(fig)
print('Saved relative-registration-diagnostic.png from 159 retained ties and 8 selected ties.')
