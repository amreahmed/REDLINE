"""Reproduce searchable SIS evidence; extraction is not product-label validation.

Run: uv run --with pypdf python docs/evidence/scientific-resolution-2026-11-14/registration/extract-places-sis.py
"""
import hashlib
import json
from pathlib import Path

import pypdf

here = Path(__file__).resolve().parent
pdf = here / 'Mars2020_Rover_PLACES_PDS_SIS.pdf'
receipt = json.loads((here / 'places-sis-http-receipt.json').read_text())
assert receipt['status'] == 200
assert hashlib.sha256(pdf.read_bytes()).hexdigest() == receipt['sha256']
reader = pypdf.PdfReader(pdf)
assert len(reader.pages) == 65
text = '\n'.join('=== PDF page ' + str(i+1) + ' ===\n' + page.extract_text()
                 for i, page in enumerate(reader.pages))
normalized = ' '.join(text.split())
for phrase in ['2022-02-22', '18.4663', 'expected accuracy of 0.5m compared to the base map',
               'registration will only be as good as the coregistration of the two maps',
               'They are referenced to the MOLA areoid', 'map_pixel_line', 'map_pixel_sample']:
    assert phrase in normalized, phrase
output = text.encode('utf-8')
pdf.with_suffix('.txt').write_bytes(output)
metadata = dict(pypdfVersion=pypdf.__version__, pageCount=len(reader.pages),
                sourcePdfSha256=receipt['sha256'], textSha256=hashlib.sha256(output).hexdigest(),
                qualification='Text extraction only. PLACES documentation does not establish the datum or empirical registration of the preserved REDLINE TIFF.')
(here / 'places-sis-extraction.json').write_bytes((json.dumps(metadata, indent=2) + '\n').encode('utf-8'))
print(json.dumps(metadata, indent=2))
