import os
import sys
import textwrap
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display

# Register Arial fonts from Windows
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf'))

def ar(text, width=65):
    """Reshapes and applies BiDi algorithm per wrapped line to avoid ReportLab RTL inversion."""
    if not text:
        return ""
    paragraphs = text.split("\n")
    processed_pars = []
    for p in paragraphs:
        if not p.strip():
            processed_pars.append("")
            continue
        lines = textwrap.wrap(p, width=width)
        if not lines:
            continue
        shaped_lines = [get_display(arabic_reshaper.reshape(l)) for l in lines]
        processed_pars.append("<br/>".join(shaped_lines))
    return "<br/>".join(processed_pars)

class ArabicNumberedCanvas(canvas.Canvas):
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
        self.setFont("Arial", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            header_right = get_display(arabic_reshaper.reshape("مشروع REDLINE — دليل فيديو العرض (Pitch Video)"))
            header_left = "NASA Space Apps Challenge 2026"
            self.drawString(42, A4[1] - 30, header_left)
            self.drawRightString(A4[0] - 42, A4[1] - 30, header_right)
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(42, A4[1] - 34, A4[0] - 42, A4[1] - 34)
            
        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(42, 38, A4[0] - 42, 38)
        footer_right = get_display(arabic_reshaper.reshape("اسكربت وتوجيهات تصوير فيديو العرض (3 دقائق)"))
        self.drawString(42, 26, f"Page {self._pageNumber} of {page_count}")
        self.drawRightString(A4[0] - 42, 26, footer_right)
        self.restoreState()

def build_pdf(filename="REDLINE_Pitch_Video_Arabic_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=38,
        rightMargin=38,
        topMargin=44,
        bottomMargin=44
    )

    brand_red = colors.HexColor("#DC2626")
    dark_slate = colors.HexColor("#0F172A")
    muted_slate = colors.HexColor("#475569")
    card_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#CBD5E1")
    cyan_line = colors.HexColor("#0284C7")
    orange_line = colors.HexColor("#EA580C")

    # Arabic styles (alignment=2 is right-aligned)
    title_style = ParagraphStyle(
        'DocTitleAr',
        fontName='Arial-Bold',
        fontSize=20,
        leading=25,
        textColor=dark_slate,
        alignment=2,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitleAr',
        fontName='Arial-Bold',
        fontSize=12,
        leading=16,
        textColor=brand_red,
        alignment=2,
        spaceAfter=8
    )

    meta_style = ParagraphStyle(
        'DocMetaAr',
        fontName='Arial',
        fontSize=8.5,
        leading=13,
        textColor=muted_slate,
        alignment=2,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'Heading1Ar',
        fontName='Arial-Bold',
        fontSize=13,
        leading=17,
        textColor=dark_slate,
        alignment=2,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2Ar',
        fontName='Arial-Bold',
        fontSize=10,
        leading=14,
        textColor=brand_red,
        alignment=2,
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyAr',
        fontName='Arial',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E293B"),
        alignment=2,
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'BulletAr',
        fontName='Arial',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E293B"),
        alignment=2,
        spaceAfter=3
    )

    box_style = ParagraphStyle(
        'BoxAr',
        fontName='Arial',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#0F172A"),
        alignment=2
    )

    tbl_header = ParagraphStyle(
        'TblHdr',
        fontName='Arial-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=1
    )

    tbl_cell = ParagraphStyle(
        'TblCell',
        fontName='Arial',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
        alignment=2
    )

    tbl_cell_action = ParagraphStyle(
        'TblCellAction',
        fontName='Arial',
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#0369A1"),
        alignment=2
    )

    tbl_cell_time = ParagraphStyle(
        'TblCellTime',
        fontName='Arial-Bold',
        fontSize=8,
        leading=11,
        textColor=brand_red,
        alignment=1
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph(ar("مشروع REDLINE — الاسكربت الكامل لفيديو العرض (Pitch Video)"), title_style))
    story.append(Paragraph(ar("تحدي ناسا الدولي لتطبيقات الفضاء 2026 | خريطة المريخ ودليل النجاة بين الكواكب"), subtitle_style))
    story.append(Paragraph(ar("المدة الإجمالية: 3 دقائق (180 ثانية) • دليل عملي خطوة بخطوة لما تقوله وما تفعله على الشاشة"), meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_red, spaceBefore=0, spaceAfter=8))

    # Intro Note Box
    intro_box = ar(
        "نصيحة ذهبية للفيديو: الحكام في تحدي ناسا مش بيبحثوا عن مجرد موقع شكله جميل، هما عايزين يشوفوا: "
        "(1) تكامل بيانات حقيقية من مهمات متعددة، (2) حل مشكلة واقعية تواجه رواد المريخ، و(3) أمانة علمية شفافة في عرض حدود البيانات. "
        "الاسكربت ده مصمم يبرز الثلاث نقاط دول بأعلى درجات الاحترافية مع توجيه حركة الماوس بالتزامن مع كلامك."
    , width=78)
    intro_table = Table([[Paragraph(intro_box, box_style)]], colWidths=[519])
    intro_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#FCA5A5")),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(intro_table)
    story.append(Spacer(1, 8))

    # SECTION: Pre-recording checklist
    story.append(Paragraph(ar("أولاً: تجهيزات سريعة قبل بدء تصوير الشاشة"), h1_style))
    checklist = [
        "دقة الشاشة والتسجيل: افتح المتصفح واضغط F11 ليكون ملء الشاشة الكامل لإخفاء شريط العناوين، وسجل بدقة 1080p.",
        "التحضير السريع: المتصفح يفتح على كوكب المريخ (Viking Color Globe). تأكد أن الصوت واضح بدون ضوضاء، وضع موسيقى خافتة جداً في الخلفية (Ambient Synth).",
        "الاعتماد على الاختصارات (Presets): استخدم زر 'Belva Rim to Floor' في تبويب Plan لحساب المسارات بنقرة واحدة وتجنب كتابة الأرقام يدوياً أثناء التصوير.",
        "الهدوء في الحركة: لا تحرك الماوس بعشوائية؛ حركه بنعومة وسلاسة نحو الأزرار المستهدفة ليكون الفيديو مريحاً للحكام."
    ]
    for item in checklist:
        story.append(Paragraph(ar(f"• {item}", width=75), bullet_style))
    story.append(Spacer(1, 8))

    # SECTION: Script & Visual Actions Table
    story.append(Paragraph(ar("ثانياً: الاسكربت الكامل وتوجيهات الشاشة (3 دقائق - ثانية بثانية)"), h1_style))
    
    script_data = [
        [
            Paragraph(ar("الزمن"), tbl_header),
            Paragraph(ar("ماذا تفعل على الشاشة خطوة بخطوة"), tbl_header),
            Paragraph(ar("ماذا تقول في الفويس أوفر (الكلام)"), tbl_header)
        ],
        [
            Paragraph("<b>0:00 - 0:25</b><br/>(25 ثانية)", tbl_cell_time),
            Paragraph(ar(
                "1. التطبيق يفتح على الكرة ثلاثية الأبعاد (Viking Globe).\n"
                "2. اسحب الماوس ببطء لتدوير الكوكب لليمين ثم لليسار.\n"
                "3. أظهر توهج الغلاف الجوي والنجوم في الخلفية ونعومة الإضاءة الشمسية.",
                width=32
            ), tbl_cell_action),
            Paragraph(ar(
                "\"لما البشر يوصلوا للمريخ، التحرك على السطح مش هيكون مجرد جولة سياحية.. ده هيكون مسألة حياة أو موت. "
                "الخرائط المتوفرة حالياً إما صور ثابتة أو أدوات بتبص للصور وكأنها سطح مستوي بدون بيانات ارتفاع حقيقية. "
                "أهلاً بكم في REDLINE — مساحة العمل الذكية لتخطيط المهام واستكشاف تضاريس المريخ، المبنية لتحدي ناسا لتطبيقات الفضاء.\"",
                width=42
            ), tbl_cell)
        ],
        [
            Paragraph("<b>0:25 - 0:55</b><br/>(30 ثانية)", tbl_cell_time),
            Paragraph(ar(
                "1. اضغط على أيقونة Explore في الشريط الجانبي.\n"
                "2. استعرض بطاقات المواقع (15 موقعاً).\n"
                "3. اضغط على فلتر Landers ثم Geology.\n"
                "4. اختر فوهة Jezero Crater واضغط زر 'Fly to Jezero'.\n"
                "5. اترك الكاميرا تهبط في مسار سينمائي سلس حتى تتحول إلى الخريطة ثنائية الأبعاد.",
                width=32
            ), tbl_cell_action),
            Paragraph(ar(
                "\"ريدلاين بيربط بين الرؤية الشاملة للكوكب ودقة الخرائط الجغرافية الإقليمية. "
                "بنقدم 15 موقعاً استرشادياً موثقاً من ناسا — بتشمل مواقع هبوط الروفرات التاريخية زي Perseverance وCuriosity، وأكبر معالم المريخ زي أوليمبوس مونس. "
                "وبضغطة واحدة، نقدر نطير برحلة سينمائية مباشرة من المدار لقلب فوهة جيزيرو، مع انتقال فائق السلاسة لخريطة إقليمية دقيقة.\"",
                width=42
            ), tbl_cell)
        ],
        [
            Paragraph("<b>0:55 - 1:25</b><br/>(30 ثانية)", tbl_cell_time),
            Paragraph(ar(
                "1. اضغط على زر Layers العائم على الخريطة.\n"
                "2. فعّل طبقة Viking العالمية، ثم بدّل لطبقة MOLA الملونة للارتفاعات.\n"
                "3. فعّل طبقة Controlled CTX بدقة 6 متر التابعة لـ USGS.\n"
                "4. حرّك الخريطة قليلاً لحدود التغطية لتظهر رسالة حدود البيانات.",
                width=32
            ), tbl_cell_action),
            Paragraph(ar(
                "\"الميزة الأولى في REDLINE هي تكامل البيانات متعددة المهمات؛ بندمج 6 طبقات فضائية موثقة من مسبارات ناسا ووكالة الفضاء الأوروبية، من الفايكنج ومولا لحد صور هاي رايز فائقة الدقة. "
                "والأهم من كده: النزاهة العلمية.. نظامنا مش بيخترع صور وهمية للأماكن اللي متصورتش، بل بيحدد حدود التغطية بدقة ومصداقية كاملة.\"",
                width=42
            ), tbl_cell)
        ],
        [
            Paragraph("<b>1:25 - 2:00</b><br/>(35 ثانية)", tbl_cell_time),
            Paragraph(ar(
                "1. افتح تبويب Plan في الشريط الجانبي.\n"
                "2. اضغط على الزر الجاهز: 'Belva Rim to Floor'.\n"
                "3. اضغط زر 'Calculate All'.\n"
                "4. انتظر ثانية واحدة حتى تظهر مسارات A* على الخريطة.\n"
                "5. أشر بالماوس على الخط السماوي (Cyan) ثم الخط البرتقالي (Orange).",
                width=32
            ), tbl_cell_action),
            Paragraph(ar(
                "\"في بيئة التخطيط، مش بنرسم خطوط على صور! إحنا بنحمّل نموذج ارتفاعات رقمي حقيقي (HRSC DEM) من مسبار Mars Express فيه 10,609 نقطة قياس فيزيائية. "
                "محرك A* المزدوج بيحسب في الخلفية مسارين في نفس اللحظة: "
                "الخط السماوي ده أقصر مسافة هندسية.. لكنه بيعدي من فوق حافة جرف منحدر قاتل! "
                "بينما الخط البرتقالي بيحسب تكلفة التضاريس ويلتف بذكاء حول المنحدرات الوعرة ليضمن سلامة المركبة.\"",
                width=42
            ), tbl_cell)
        ],
        [
            Paragraph("<b>2:00 - 2:35</b><br/>(35 ثانية)", tbl_cell_time),
            Paragraph(ar(
                "1. من قائمة الطبقات، غيّر الـ Terrain Overlay إلى Slope ثم إلى Traversability.\n"
                "2. انتقل لتبويب Rover Profile وبدّل بين Perseverance و Rugged Explorer.\n"
                "3. انزل لأسفل وافتح قسم Travel Time.\n"
                "4. اضغط على أزرار التقليب في جدول الـ Timeline لاستعراض أجزاء المسار.",
                width=32
            ), tbl_cell_action),
            Paragraph(ar(
                "\"المخطط يقدر يشوف طبقات تحليلية فورية: زوايا الانحدار، ودرجة خشونة السطح، والمناطق الآمنة باللون الأخضر مقابل المحظورة بالأحمر. "
                "كمان بنوفر بروفايل فيزيائي للروفر بيحدد أقصى زاوية صعود وهبوط. "
                "والأحدث في REDLINE: حساب وقت الرحلة التقديري (ETA) مقسماً لكل 50 متراً بناءً على مقاومة التضاريس، مع إمكانية إضافة وقت التوقف لجمع العينات وحفر الصخور لحساب زمن المهمة الإجمالي بدقة.\"",
                width=42
            ), tbl_cell)
        ],
        [
            Paragraph("<b>2:35 - 3:00</b><br/>(25 ثانية)", tbl_cell_time),
            Paragraph(ar(
                "1. اضغط زر 'Export DEM model report' (يتحمل ملف JSON).\n"
                "2. أشر بالماوس على شارة 'Scientific Validation: Partial' لشرحها.\n"
                "3. اضغط 'Return to overview' لتعود الكرة الأرضية المريخية تدور في الفضاء.\n"
                "4. قف عند شاشة كوكب المريخ مع اسم الفريق وشعار REDLINE.",
                width=32
            ), tbl_cell_action),
            Paragraph(ar(
                "\"كل تفصيلة، ومسار، وتأخير زمني، وبيانات التوثيق بتتصدر في تقرير JSON رسمي للمهمة. "
                "ريدلاين بيقدم رسالة واضحة: استكشف التضاريس.. افهم الفروقات والتكلفة.. وخطط بالدليل العلمي. "
                "مع REDLINE، خريطة المريخ مش مجرد شاشة عرض.. دي بوصلة نجاة. شكراً لكم.\"",
                width=42
            ), tbl_cell)
        ]
    ]

    script_table = Table(script_data, colWidths=[65, 185, 269])
    script_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), dark_slate),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, card_bg]),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(script_table)
    story.append(Spacer(1, 10))

    story.append(PageBreak())

    # SECTION: Key Points for Judges
    story.append(Paragraph(ar("ثالثاً: الكلمات المفتاحية التي يجب التركيز عليها لإبهار الحكام"), h1_style))
    key_points = [
        "1. النزاهة العلمية (Scientific Integrity): وضّح أن REDLINE مش تطبيق تجاري أو مجرد لعبة، بل هو أداة مبنية على بيانات علمية حقيقية وتحترم حدود الدقة العلمية (العلامة الجزئية Partial Validation).",
        "2. نموذج الارتفاعات الحقيقي وليس الصور (True DEM vs RGB): أكد للحكام أن حساب المسارات مش من ألوان الصورة بل من مصفوفة ارتفاعات رقمية حقيقية (10,609 نقطة لـ HRSC و65,536 نقطة لـ CTX).",
        "3. المقارنة المزدوجة (Dual Route Strategy): الفارق البصري بين الخط السماوي (أقصر طريق) والخط البرتقالي (طريق الأمان التضاريسي) هو جوهر المشروع ومفتاح الفوز.",
        "4. تجربة المستخدم الفضائية (Aerospace UX): الانتقال السلس من كرة المريخ ثلاثية الأبعاد لخريطة السطح ثنائية الأبعاد بدون إعادة تحميل يبرهن على جودة التصميم والبرمجة."
    ]
    for kp in key_points:
        story.append(Paragraph(ar(kp, width=76), bullet_style))
    story.append(Spacer(1, 8))

    # SECTION: Quick Reference Table for Data
    story.append(Paragraph(ar("رابعاً: جدول بيانات المهمات الفضائية المستخدمة في REDLINE"), h1_style))
    data_rows = [
        [
            Paragraph(ar("المصدر والجهة"), tbl_header),
            Paragraph(ar("الدقة ونوع البيانات"), tbl_header),
            Paragraph(ar("المهمة والمستشعر"), tbl_header),
            Paragraph(ar("اسم الطبقة / المنتج"), tbl_header)
        ],
        [
            Paragraph(ar("NASA / USGS"), tbl_cell),
            Paragraph(ar("232 م / فسيفساء كوكبية ملونة"), tbl_cell),
            Paragraph(ar("Viking Orbiter 1 & 2"), tbl_cell),
            Paragraph(ar("Viking MDIM 2.1"), tbl_cell)
        ],
        [
            Paragraph(ar("NASA / GSFC"), tbl_cell),
            Paragraph(ar("463 م / تضاريس وظلال ملونة"), tbl_cell),
            Paragraph(ar("MOLA (Mars Global Surveyor)"), tbl_cell),
            Paragraph(ar("MOLA Shaded Relief"), tbl_cell)
        ],
        [
            Paragraph(ar("USGS Astrogeology"), tbl_cell),
            Paragraph(ar("6 م / تصحيح مساحي دقيق"), tbl_cell),
            Paragraph(ar("CTX (Mars Reconnaissance Orbiter)"), tbl_cell),
            Paragraph(ar("Controlled Jezero CTX"), tbl_cell)
        ],
        [
            Paragraph(ar("ESA / DLR"), tbl_cell),
            Paragraph(ar("50 م / نموذج ارتفاعات رقمي DEM"), tbl_cell),
            Paragraph(ar("HRSC (Mars Express)"), tbl_cell),
            Paragraph(ar("HRSC DT5 (HMC_13E10)"), tbl_cell)
        ],
        [
            Paragraph(ar("NASA / JPL / UA"), tbl_cell),
            Paragraph(ar("25 سم / صور فائقة الدقة لدلتا جيزيرو"), tbl_cell),
            Paragraph(ar("HiRISE (MRO)"), tbl_cell),
            Paragraph(ar("HiRISE Orthomosaic"), tbl_cell)
        ]
    ]
    data_table = Table(data_rows, colWidths=[110, 140, 130, 139])
    data_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), dark_slate),
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, card_bg]),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(data_table)
    story.append(Spacer(1, 10))

    # Closing Callout Box
    final_note = ar(
        "شعار المشروع الختامي: استكشف التضاريس.. افهم الفروقات والتكلفة.. وخطط بالدليل العلمي.\n"
        "Explore the terrain. Understand the trade-offs. Plan with evidence.\n"
        "بالتوفيق لفريق العمل في مسابقة NASA Space Apps Challenge 2026!"
    , width=78)
    final_table = Table([[Paragraph(final_note, box_style)]], colWidths=[519])
    final_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#93C5FD")),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(final_table)

    doc.build(story, canvasmaker=ArabicNumberedCanvas)
    print(f"Arabic PDF successfully built: {filename}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "REDLINE_Pitch_Video_Arabic_Guide.pdf"
    build_pdf(out_file)
