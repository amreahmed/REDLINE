import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(42, A4[1] - 30, "REDLINE — Mars Mission Intelligence System")
            self.drawRightString(A4[0] - 42, A4[1] - 30, "NASA Space Apps Challenge 2026")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(42, A4[1] - 34, A4[0] - 42, A4[1] - 34)
            
        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(42, 38, A4[0] - 42, 38)
        self.drawString(42, 26, "REDLINE Pitch Video Guide & Technical Feature Specification")
        self.drawRightString(A4[0] - 42, 26, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def build_pdf(filename="REDLINE_Pitch_Video_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    brand_red = colors.HexColor("#DC2626")
    dark_slate = colors.HexColor("#0F172A")
    muted_slate = colors.HexColor("#475569")
    card_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#E2E8F0")
    cyan_accent = colors.HexColor("#0284C7")
    amber_accent = colors.HexColor("#D97706")
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=dark_slate,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=brand_red,
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=muted_slate,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=dark_slate,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=brand_red,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E293B"),
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    box_text_style = ParagraphStyle(
        'BoxText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#0F172A")
    )

    box_bold_style = ParagraphStyle(
        'BoxBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=brand_red
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1E293B")
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A")
    )

    table_cell_code = ParagraphStyle(
        'TableCellCode',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=brand_red
    )

    story = []

    # Title & Header
    story.append(Paragraph("REDLINE — Mars Mission Intelligence", title_style))
    story.append(Paragraph("NASA Space Apps Challenge 2026 • Interplanetary Survival Guide: Martian Map", subtitle_style))
    story.append(Paragraph("<b>Project Type:</b> Planetary Mapping & Surface-Traverse Decision Support Prototype<br/><b>Document:</b> Comprehensive Technical Feature Specification & Pitch Video Production Script", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_red, spaceBefore=0, spaceAfter=10))

    # Executive Summary / Pitch Hook Box
    hook_html = (
        "<b>THE 30-SECOND ELEVATOR PITCH FOR JUDGES:</b><br/>"
        "<i>\"Planning a traverse on Mars isn't just drawing lines on an image—it's navigating harsh elevation gradients, rover mobility limits, and scientific uncertainty. "
        "<b>REDLINE</b> is an interactive Mars mission-planning workspace built for the NASA Space Apps Challenge. "
        "It combines real multi-mission planetary datasets—from global Viking and MOLA mosaics down to 20-meter CTX imagery and 50-meter native HRSC digital elevation models—"
        "empowering planners to compare shortest paths against terrain-cost-optimized routes, simulate rover travel times down to individual 50-meter segments, "
        "and inspect the real scientific evidence behind every decision.\"</i>"
    )
    hook_table = Table([[Paragraph(hook_html, box_text_style)]], colWidths=[511])
    hook_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#FCA5A5")),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(hook_table)
    story.append(Spacer(1, 10))

    # SECTION 1: Problem & Mission
    story.append(Paragraph("1. Mission Context & Problem Statement", h1_style))
    story.append(Paragraph(
        "NASA has explored Mars robotically for decades, accumulating petabytes of observational data across dozens of orbiters and surface missions. "
        "However, future human and robotic exploration faces critical data silos: elevation models, visual mosaics, and science observations live in disconnected archives. "
        "Most public prototypes are purely aesthetic image viewers with arbitrary map pins, lacking physical ground context or treating image RGB brightness as elevation. "
        "<b>REDLINE</b> solves this by delivering an evidence-first, decision-support mission workspace that transparently models terrain difficulty, rover mobility constraints, and scientific trade-offs.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # SECTION 2: Core Features Breakdown
    story.append(Paragraph("2. Full Technical Feature Breakdown (The 9 Pillars)", h1_style))
    
    features = [
        ("Pillar 1: Unified Planetary Explorer (3D Globe ⇄ 2D Regional Map)",
         "Seamless single-viewport explorer blending a Three.js 3D planetary globe with an OpenLayers 2D regional map. "
         "Preserves camera coordinates across zoom handoffs; features atmospheric rim scattering, procedural starfield, directional solar lighting, "
         "and an alternative official NASA visual 3D model mode. All coordinates strictly respect true Mars angular geometry (no Earth Web Mercator distortion)."),
        
        ("Pillar 2: Multi-Mission Layer Stack (6 Sourced Datasets)",
         "Directly streams and manages 6 authoritative planetary datasets with live loading states and honest coverage boundaries:<br/>"
         "• <b>Viking MDIM 2.1 Color Mosaic (232 m):</b> Global planetary color basemap.<br/>"
         "• <b>Global CTX Mosaic:</b> Preliminary Caltech uncontrolled 5 m planetary imagery.<br/>"
         "• <b>MOLA Color Hillshade (463 m):</b> Mars Global Surveyor global topographic relief.<br/>"
         "• <b>Regional Preliminary CTX:</b> Regional context mosaic over Jezero Crater.<br/>"
         "• <b>USGS Controlled Jezero CTX Orthomosaic (6 m):</b> Precision photogrammetric mosaic.<br/>"
         "• <b>HiRISE Orthomosaic (25 cm):</b> Sub-meter ultra-high-resolution footprint over Jezero delta deposits."),
        
        ("Pillar 3: Sourced Planetary Science POIs & 1-Click Cinematic Flight",
         "Interactive catalog of <b>15 planetary locations</b> with cited scientific significance and mission provenance:<br/>"
         "• <b>7 Historic Landers/Rovers:</b> Perseverance, Curiosity, Opportunity, Spirit, Viking 1, Viking 2, InSight.<br/>"
         "• <b>6 Major Geological Landmarks:</b> Olympus Mons, Valles Marineris, Elysium Mons, Gale, Hellas, Jezero.<br/>"
         "• <b>2 Local Science Targets:</b> Belva Crater rim and Neretva Vallis delta.<br/>"
         "Includes single-click <b>'Fly to'</b> smooth camera animation from global orbit down into local crater terrain."),
        
        ("Pillar 4: High-Resolution Jezero Terrain Planning Workspace",
         "Integrates verified numerical raster elevation models—never fabricating elevation from imagery:<br/>"
         "• <b>Preserved CTX Numerical Crop:</b> 65,536 native cells (256 × 256, 20 m posts) extracted directly from USGS GeoTIFF bytes.<br/>"
         "• <b>ESA/DLR Mars Express HRSC DEM:</b> 10,609 native cells (103 × 103, 50 m posts) from product <code>HMC_13E10_DT5</code>.<br/>"
         "Features interactive map-picking, keyboard coordinate entry, native cell display, and 1-click mission presets (<i>Belva Rim to Floor</i>, <i>Neretva Delta Traverse</i>)."),
        
        ("Pillar 5: Dual-Engine A* Route Planning & Objective Comparison",
         "Concurrent calculation of two contrasting traverse strategies via dedicated Web Workers:<br/>"
         "• <b>Shortest Grid Path (Solid Cyan):</b> Direct shortest arc across the Mars reference sphere.<br/>"
         "• <b>Terrain-Cost Path (Warm Orange):</b> A* cost-minimizing traverse using HRSC heights, penalizing steep grades, slopes, and roughness.<br/>"
         "Supports intermediate science waypoints (<b>W</b>), computing leg-by-leg metrics and detour penalties."),
        
        ("Pillar 6: Six Real-Time Terrain Diagnostic Overlays",
         "Inspect the physical terrain characteristics affecting rover mobility directly on the map:<br/>"
         "• <b>Elevation:</b> Height above reference sphere.<br/>"
         "• <b>Slope / Gradient:</b> Surface tilt in degrees.<br/>"
         "• <b>Roughness:</b> Standard deviation of height in physical circular neighborhoods.<br/>"
         "• <b>Coarse Shape:</b> Center-minus-mean relief.<br/>"
         "• <b>Model Traversability:</b> Green (safe) vs Red (exceeds slope/roughness thresholds).<br/>"
         "• <b>A* Explored Nodes:</b> Live visualization of graph search frontier and explored node count."),
        
        ("Pillar 7: Rover Mobility Profiles & Provisional Travel Time (ETA)",
         "Configurable vehicle mobility constraints with instant duration recalculation:<br/>"
         "• <b>Vehicle Presets:</b> <i>Perseverance Standard</i> (15° slope limit) vs <i>Rugged Explorer</i> (25° slope limit) or custom wheel limits.<br/>"
         "• <b>Segment-by-Segment Timeline:</b> Full paginated breakdown of every 50 m segment with distance, speed, elapsed time, grade, and roughness.<br/>"
         "• <b>Departure UTC & Planned Holds:</b> Enter departure time and planned drill/sample holds (e.g., 120 min) for total mission duration."),
        
        ("Pillar 8: Scientific Integrity & Transparent Uncertainty (The Space Apps Differentiator)",
         "No fabricated survival probabilities or false safety claims. Contextual <b>'Scientific Validation: Partial'</b> badge explains limitations. "
         "Rigorously documents the known datum conflict between IAU-sphere reference and HRSC/MOLA heights. Explicitly separates rendered imagery from numerical DEMs."),
        
        ("Pillar 9: Auditable Mission Package Export (JSON)",
         "One-click <b>Export DEM model report</b> generates a complete, auditable JSON file containing all origin/destination coordinates, "
         "every computed segment metric, A* expanded nodes, rover mobility profile, and authoritative dataset checksums.")
    ]

    for title, desc in features:
        story.append(Paragraph(title, h2_style))
        story.append(Paragraph(desc, body_style))

    story.append(PageBreak())

    # SECTION 3: Pitch Video Script & Storyboard
    story.append(Paragraph("3. Recommended Pitch Video Storyboard & Script (90–120 Seconds)", h1_style))
    story.append(Paragraph(
        "This script is optimized for the NASA Space Apps Challenge video submission (typically 1 to 2 minutes). "
        "It matches the exact UI flow and highlights technical rigor, multi-mission integration, and scientific integrity.",
        body_style
    ))
    story.append(Spacer(1, 6))

    script_data = [
        [
            Paragraph("<b>Time</b>", table_header_style),
            Paragraph("<b>Visual / On-Screen Action</b>", table_header_style),
            Paragraph("<b>Voiceover Script (What to Say)</b>", table_header_style)
        ],
        [
            Paragraph("<b>0:00 – 0:15</b>", table_cell_code),
            Paragraph("<b>Open on 3D Mars Globe:</b><br/>Rotate globe smoothly. Show atmospheric rim glow, solar shading, and procedural starfield.", table_cell_style),
            Paragraph("<i>\"When humanity establishes a permanent presence on Mars, surface navigation will be a matter of survival. But current tools either show static photos or oversimplified maps. Welcome to <b>REDLINE</b>—an open-science mission workspace for Martian exploration.\"</i>", table_cell_style)
        ],
        [
            Paragraph("<b>0:15 – 0:35</b>", table_cell_code),
            Paragraph("<b>Explore POIs & Fly-To:</b><br/>Open Explore drawer. Filter 'Landers' and 'Geology'. Click <b>Jezero Crater</b> → Click <b>Fly to Jezero</b>. Watch smooth orbital dive into regional map.", table_cell_style),
            Paragraph("<i>\"REDLINE bridges planetary-scale context with regional GIS precision. Planners can inspect 15 curated landing sites and geological landmarks, or trigger a cinematic flight straight into Jezero Crater—transitioning seamlessly from global orbit to surface detail.\"</i>", table_cell_style)
        ],
        [
            Paragraph("<b>0:35 – 0:55</b>", table_cell_code),
            Paragraph("<b>Multi-Mission Layer Manager:</b><br/>Open Floating Layers menu. Toggle Viking mosaic, MOLA elevation, and 6 m USGS CTX imagery. Pan slightly to show coverage bounds.", table_cell_style),
            Paragraph("<i>\"We integrate six authoritative datasets from NASA and ESA—from Viking and MOLA to sub-meter HiRISE footprints. And REDLINE never fakes data: if an instrument hasn't imaged an area, we clearly flag coverage boundaries instead of generating synthetic filler.\"</i>", table_cell_style)
        ],
        [
            Paragraph("<b>0:55 – 1:20</b>", table_cell_code),
            Paragraph("<b>DEM Planning & Dual A* Routes:</b><br/>Open Plan tab. Click <b>Quick Preset: Belva Rim to Floor</b>. Click <b>Calculate All</b>. Point out the <b>Cyan (Distance)</b> vs <b>Orange (Terrain)</b> lines.", table_cell_style),
            Paragraph("<i>\"In the Planning Workspace, we load 10,609 cells from an authentic Mars Express HRSC digital elevation model. With one click, our dual A* pathfinding engine compares the shortest direct path against a terrain-cost-optimized traverse that steers around hazardous crater slopes.\"</i>", table_cell_style)
        ],
        [
            Paragraph("<b>1:20 – 1:40</b>", table_cell_code),
            Paragraph("<b>Overlays, Profiles & Travel Time:</b><br/>Switch overlays: <b>Slope</b>, <b>Roughness</b>, <b>Traversability</b>. Change Rover Profile to <i>Perseverance Standard</i>. Expand <b>Travel Time</b> timeline.", table_cell_style),
            Paragraph("<i>\"Planners can inspect slope and roughness overlays, select rover mobility profiles, and calculate segment-by-segment travel times down to individual 50-meter posts, factoring in slope drag and planned science stopovers.\"</i>", table_cell_style)
        ],
        [
            Paragraph("<b>1:40 – 2:00</b>", table_cell_code),
            Paragraph("<b>Report Export & Closing Logo:</b><br/>Click <b>Export DEM model report</b> (download JSON). Show <b>Scientific Validation: Partial</b> badge. Zoom out to Mars globe with REDLINE title.", table_cell_style),
            Paragraph("<i>\"Every metric, segment, and dataset hash exports as an auditable mission package. Built on uncompromised scientific integrity: <b>Explore the terrain. Understand the trade-offs. Plan with evidence.</b> This is REDLINE.\"</i>", table_cell_style)
        ]
    ]

    script_table = Table(script_data, colWidths=[65, 175, 271])
    script_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), dark_slate),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, card_bg]),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(script_table)
    story.append(Spacer(1, 10))

    # SECTION 4: Video Filming & Recording Tips
    story.append(Paragraph("4. Practical Video Recording & Demo Tips", h1_style))
    tips = [
        "<b>Screen Resolution & Browser:</b> Record in 1080p (1920 × 1080) in full screen (press F11 in Chrome/Edge). Ensure the URL bar is hidden.",
        "<b>Use Built-in Presets:</b> Click <b>'Belva Rim to Floor'</b> preset under Plan → Endpoints. It instantly inputs rows/cols and loads terrain without clumsy typing on camera.",
        "<b>Smooth Cinematic Transitions:</b> Let the <b>'Fly to Jezero'</b> animation play out for 4-5 seconds. It visually showcases the Three.js to OpenLayers handoff.",
        "<b>Highlight Colors on Screen:</b> Point out the contrast: <b>Solid Cyan</b> = shortest distance line; <b>Warm Orange</b> = safe slope-avoiding traverse.",
        "<b>Emphasize Open Science:</b> In your narration, highlight that REDLINE uses genuine USGS GeoTIFFs and ESA Mars Express HRSC DEMs, verified by automated checksums."
    ]
    for tip in tips:
        story.append(Paragraph(f"• {tip}", bullet_style))
    story.append(Spacer(1, 8))

    # SECTION 5: Data Attribution & Integrity Matrix
    story.append(Paragraph("5. Authoritative Data Sources & Technical Attribution", h1_style))
    
    attr_data = [
        [
            Paragraph("<b>Dataset / Product</b>", table_header_style),
            Paragraph("<b>Instrument & Mission</b>", table_header_style),
            Paragraph("<b>Resolution & Scope</b>", table_header_style),
            Paragraph("<b>Credit & Citation</b>", table_header_style)
        ],
        [
            Paragraph("<b>Viking MDIM 2.1</b>", table_cell_bold),
            Paragraph("Viking Orbiter 1 & 2", table_cell_style),
            Paragraph("232 m / global mosaic", table_cell_style),
            Paragraph("NASA / USGS Astrogeology", table_cell_style)
        ],
        [
            Paragraph("<b>MOLA Shaded Relief</b>", table_cell_bold),
            Paragraph("Mars Orbiter Laser Altimeter (MGS)", table_cell_style),
            Paragraph("463 m / global DEM mosaic", table_cell_style),
            Paragraph("NASA / GSFC / MGS MOLA Team", table_cell_style)
        ],
        [
            Paragraph("<b>Controlled Jezero CTX</b>", table_cell_bold),
            Paragraph("Context Camera (MRO)", table_cell_style),
            Paragraph("6 m / local orthomosaic", table_cell_style),
            Paragraph("Fergason et al. 2020 / USGS (DOI 10.5066/P9GV1ND3)", table_cell_style)
        ],
        [
            Paragraph("<b>HRSC DEM (HMC_13E10)</b>", table_cell_bold),
            Paragraph("High Resolution Stereo Camera (MEX)", table_cell_style),
            Paragraph("50 m / 103 × 103 numerical grid", table_cell_style),
            Paragraph("ESA / DLR / FU Berlin (CC BY-SA 3.0 IGO)", table_cell_style)
        ],
        [
            Paragraph("<b>HiRISE Orthomosaic</b>", table_cell_bold),
            Paragraph("HiRISE Camera (MRO)", table_cell_style),
            Paragraph("25 cm / Jezero delta deposits", table_cell_style),
            Paragraph("NASA / JPL / University of Arizona", table_cell_style)
        ]
    ]

    attr_table = Table(attr_data, colWidths=[120, 110, 110, 171])
    attr_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), dark_slate),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, card_bg]),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(attr_table)
    story.append(Spacer(1, 12))

    # Disclaimer Callout Box
    disclaimer_html = (
        "<b>SCIENTIFIC & CHALLENGE DISCLAIMER:</b><br/>"
        "REDLINE is an independent research and mission-planning prototype created for the NASA Space Apps Challenge 2026. "
        "It is not an official NASA product, is not endorsed by NASA, and is not a certified human-safety system. "
        "All computed route costs, traversal classifications, and provisional travel times are mathematical model outputs intended for research and educational exploration."
    )
    disclaimer_table = Table([[Paragraph(disclaimer_html, box_text_style)]], colWidths=[511])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ('PADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(disclaimer_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built: {filename}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "REDLINE_Pitch_Video_Guide.pdf"
    build_pdf(out_file)
