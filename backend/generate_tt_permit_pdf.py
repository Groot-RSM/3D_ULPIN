import os
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.barcode import qr, code128

def generate_tt_building_permit_pdf(output_path: str = "data/samples/sample_building_permit_order.pdf"):
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out_file),
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'GovTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        alignment=1, # Center
        textColor=colors.HexColor('#0f172a')
    )

    sub_title_style = ParagraphStyle(
        'GovSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=12,
        alignment=1,
        textColor=colors.HexColor('#334155')
    )

    order_badge_style = ParagraphStyle(
        'OrderBadge',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=1,
        textColor=colors.HexColor('#0369a1')
    )

    sec_header_style = ParagraphStyle(
        'SecHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0f172a')
    )

    story = []

    # 1. Official Header
    story.append(Paragraph("GOVERNMENT OF TAMIL NADU", title_style))
    story.append(Paragraph("DIRECTORATE OF TOWN AND COUNTRY PLANNING (DTCP)", ParagraphStyle('Sub1', parent=title_style, fontSize=11, leading=14)))
    story.append(Paragraph("VELLORE LOCAL PLANNING AUTHORITY &amp; VELLORE MUNICIPAL CORPORATION", sub_title_style))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=8, spaceBefore=4))

    story.append(Paragraph("BUILDING PERMIT &amp; 3D CADASTRAL SANCTION ORDER", order_badge_style))
    story.append(Paragraph("<b>Order No:</b> DTCP/VLR/BP-2024/008492 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Sanction Date:</b> 15-OCT-2024 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Validity:</b> 14-OCT-2029", sub_title_style))
    story.append(Spacer(1, 8))

    # 2. Key Identification Table
    meta_data = [
        [
            Paragraph("<b>Applicant / Owner:</b>", body_style),
            Paragraph("Vellore Institute of Technology (VIT)", body_bold),
            Paragraph("<b>Structure Name:</b>", body_style),
            Paragraph("Technology Tower (TT)", body_bold)
        ],
        [
            Paragraph("<b>Property ID:</b>", body_style),
            Paragraph("VIT-B001", body_bold),
            Paragraph("<b>Survey / Parcel No:</b>", body_style),
            Paragraph("SF-112/1A, Katpadi Village", body_bold)
        ],
        [
            Paragraph("<b>Internal 3D Property ID:</b>", body_style),
            Paragraph("VIT-B001-VOL-2024", body_bold),
            Paragraph("<b>Authoritative ULPIN:</b>", body_style),
            Paragraph("ULPIN-IN-TN-VEL-VIT-B001", body_bold)
        ],
        [
            Paragraph("<b>Geographic Coordinates:</b>", body_style),
            Paragraph("Lat: 12.970654° N, Lon: 79.159749° E", body_style),
            Paragraph("<b>Elevation Datum:</b>", body_style),
            Paragraph("MSL + 215.00 m", body_style)
        ]
    ]

    t_meta = Table(meta_data, colWidths=[120, 145, 120, 135])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # 3. Volumetric Building Envelope & Sanction Parameters
    story.append(Paragraph("1. SANCTIONED 3D VOLUMETRIC PARAMETERS", sec_header_style))
    param_data = [
        [
            Paragraph("<b>Metric Parameter</b>", body_bold),
            Paragraph("<b>Approved Sanction Value</b>", body_bold),
            Paragraph("<b>Compliance Reference</b>", body_bold)
        ],
        [
            Paragraph("Approved Floor Count", body_style),
            Paragraph("<b>7 Floors</b> (Ground + 6 Upper Floors)", body_style),
            Paragraph("TNCDBR 2019 Rule 35(b) — High Rise Academic", body_style)
        ],
        [
            Paragraph("Maximum Building Height", body_style),
            Paragraph("<b>36.00 meters</b> (Z: 0.0m to 36.0m)", body_style),
            Paragraph("Vellore Urban Height Clearance Envelope", body_style)
        ],
        [
            Paragraph("Plot / Footprint Area", body_style),
            Paragraph("<b>3,540.00 m²</b>", body_style),
            Paragraph("Survey Polygon EPSG:32644 (UTM 44N)", body_style)
        ],
        [
            Paragraph("Total Sanctioned Built-Up Area", body_style),
            Paragraph("<b>24,780.00 m²</b>", body_style),
            Paragraph("FSI / FAR: 1.75 Permissible", body_style)
        ],
        [
            Paragraph("3D Volumetric Spatial Envelope", body_style),
            Paragraph("<b>127,440.00 m³</b> (Watertight Solid)", body_style),
            Paragraph("Volumetric Cadastre Rule 14-B", body_style)
        ],
        [
            Paragraph("Ground Level Floor Type", body_style),
            Paragraph("<b>ACADEMIC_AUDITORIUM_STILT</b>", body_style),
            Paragraph("Clear height: 5.50m (Dr. B.R. Ambedkar Hall)", body_style)
        ]
    ]

    t_param = Table(param_data, colWidths=[160, 180, 180])
    t_param.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0284c7')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#0284c7')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_param)
    story.append(Spacer(1, 10))

    # 4. Detailed Floor & Unit Schedule
    story.append(Paragraph("2. VALIDATED FLOOR &amp; VERTICAL PROPERTY SUBDIVISION SCHEDULE", sec_header_style))
    
    floor_schedule = [
        [
            Paragraph("<b>Floor ID</b>", body_bold),
            Paragraph("<b>Level</b>", body_bold),
            Paragraph("<b>Type</b>", body_bold),
            Paragraph("<b>Base Z (m)</b>", body_bold),
            Paragraph("<b>Top Z (m)</b>", body_bold),
            Paragraph("<b>Height (m)</b>", body_bold),
            Paragraph("<b>Units on Floor</b>", body_bold),
            Paragraph("<b>Area (m²)</b>", body_bold)
        ],
        [
            Paragraph("VIT-B001-F01", body_style),
            Paragraph("Level 1 (G)", body_style),
            Paragraph("ACADEMIC", body_style),
            Paragraph("0.00", body_style),
            Paragraph("5.50", body_style),
            Paragraph("5.50", body_style),
            Paragraph("Unit 101, Unit 102", body_style),
            Paragraph("3,540.0", body_style)
        ],
        [
            Paragraph("VIT-B001-F02", body_style),
            Paragraph("Level 2", body_style),
            Paragraph("ACADEMIC", body_style),
            Paragraph("5.50", body_style),
            Paragraph("10.50", body_style),
            Paragraph("5.00", body_style),
            Paragraph("Unit 201, Unit 202", body_style),
            Paragraph("3,540.0", body_style)
        ],
        [
            Paragraph("VIT-B001-F03", body_style),
            Paragraph("Level 3", body_style),
            Paragraph("ACADEMIC", body_style),
            Paragraph("10.50", body_style),
            Paragraph("15.50", body_style),
            Paragraph("5.00", body_style),
            Paragraph("Unit 301, Unit 302", body_style),
            Paragraph("3,540.0", body_style)
        ],
        [
            Paragraph("VIT-B001-F04", body_style),
            Paragraph("Level 4", body_style),
            Paragraph("ACADEMIC", body_style),
            Paragraph("15.50", body_style),
            Paragraph("20.50", body_style),
            Paragraph("5.00", body_style),
            Paragraph("Unit 401, Unit 402", body_style),
            Paragraph("3,540.0", body_style)
        ],
        [
            Paragraph("VIT-B001-F05", body_style),
            Paragraph("Level 5", body_style),
            Paragraph("ACADEMIC", body_style),
            Paragraph("20.50", body_style),
            Paragraph("25.50", body_style),
            Paragraph("5.00", body_style),
            Paragraph("Unit 501, Unit 502", body_style),
            Paragraph("3,540.0", body_style)
        ],
        [
            Paragraph("VIT-B001-F06", body_style),
            Paragraph("Level 6", body_style),
            Paragraph("ACADEMIC", body_style),
            Paragraph("25.50", body_style),
            Paragraph("30.50", body_style),
            Paragraph("5.00", body_style),
            Paragraph("Unit 601, Unit 602", body_style),
            Paragraph("3,540.0", body_style)
        ],
        [
            Paragraph("VIT-B001-F07", body_style),
            Paragraph("Level 7", body_style),
            Paragraph("ACADEMIC", body_style),
            Paragraph("30.50", body_style),
            Paragraph("36.00", body_style),
            Paragraph("5.50", body_style),
            Paragraph("Unit 701, Unit 702", body_style),
            Paragraph("3,540.0", body_style)
        ],
    ]

    t_fl = Table(floor_schedule, colWidths=[75, 60, 65, 55, 55, 55, 100, 55])
    t_fl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#0f172a')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')])
    ]))
    story.append(t_fl)
    story.append(Spacer(1, 10))

    # 5. Easements & Airspace Rights
    story.append(Paragraph("3. SUBSURFACE EASEMENTS &amp; AIRSPACE RIGHTS", sec_header_style))
    story.append(Paragraph("• <b>Subterranean Conduits (Z: -4.50m to 0.00m):</b> Dedicated optical fiber, high-voltage campus feeder, and stormwater drainage easements.", body_style))
    story.append(Paragraph("• <b>Airspace Rights (Z: 36.00m to 45.00m):</b> Vertical clearance zone reserved for meteorological telemetry and solar shading compliance.", body_style))
    story.append(Spacer(1, 10))

    # 6. Cryptographic Certification & Signatures
    story.append(Paragraph("4. AUTHORITATIVE CADASTRAL VERIFICATION &amp; DIGITAL SEAL", sec_header_style))
    cert_data = [
        [
            Paragraph("<b>Title Deed SHA-256 Hash:</b><br/><font face='Courier' size='7'>9e4f2b1a8c7e0d3f6b9a2c5e8d1f4a7b0c3e6d9a2f5b8c1e4d7a0b3c6e9f2a5b</font>", body_style),
            Paragraph("<b>Digital Signature Verification:</b><br/>DTCP Certified Electronic Seal<br/>Officer ID: VLR-TNO-4491<br/>Status: <b>AUTHENTICATED</b>", body_style)
        ]
    ]
    t_cert = Table(cert_data, colWidths=[310, 210])
    t_cert.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#94a3b8')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_cert)

    doc.build(story)
    print(f"Successfully generated Technology Tower Building Permit PDF at: {output_path}")
    return str(out_file)

if __name__ == "__main__":
    generate_tt_building_permit_pdf("data/samples/sample_building_permit_order.pdf")
    generate_tt_building_permit_pdf("data/samples/Technology_Tower_VIT_B001_Building_Permit_Order.pdf")
