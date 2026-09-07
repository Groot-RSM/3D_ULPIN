import os
from pathlib import Path
from typing import Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

BUILDINGS_METADATA = {
    "VIT-B001": {
        "name": "Technology Tower (TT)",
        "survey_no": "SF-112/1A, Katpadi Village",
        "floors": 8,
        "height_m": 36.0,
        "footprint_m2": 3540.0,
        "builtup_m2": 28320.0,
        "volume_m3": 127440.0,
        "order_no": "DTCP/VLR/BP-2024/008492",
        "category": "High Rise Academic Tower",
        "lat": 12.970654,
        "lon": 79.159749,
        "stilt_type": "ACADEMIC_AUDITORIUM_STILT",
        "description": "8 Levels (Ground + 7 upper floors, 306 total sanctioned units). Houses Dr. B.R. Ambedkar Auditorium, Smart Classrooms & Computing Labs.",
        "floor_rooms": [
            {"level": 1, "name": "Ground Floor", "rooms_count": 5, "prefix": "TT-G"},
            {"level": 2, "name": "1st Floor", "rooms_count": 45, "prefix": "TT-1"},
            {"level": 3, "name": "2nd Floor", "rooms_count": 47, "prefix": "TT-2"},
            {"level": 4, "name": "3rd Floor", "rooms_count": 44, "prefix": "TT-3"},
            {"level": 5, "name": "4th Floor", "rooms_count": 45, "prefix": "TT-4"},
            {"level": 6, "name": "5th Floor", "rooms_count": 45, "prefix": "TT-5"},
            {"level": 7, "name": "6th Floor", "rooms_count": 45, "prefix": "TT-6"},
            {"level": 8, "name": "7th Floor", "rooms_count": 30, "prefix": "TT-7"}
        ]
    },
    "VIT-B002": {
        "name": "Silver Jubilee Tower (SJT)",
        "survey_no": "SF-115/2B, Katpadi Village",
        "floors": 8,
        "height_m": 40.0,
        "footprint_m2": 4210.0,
        "builtup_m2": 33680.0,
        "volume_m3": 168400.0,
        "order_no": "DTCP/VLR/BP-2024/009104",
        "category": "High Rise Academic & Research Tower",
        "lat": 12.970950,
        "lon": 79.163624,
        "stilt_type": "MULTI_STOREY_ACADEMIC_STILT",
        "description": "8 Levels (Ground + 7 upper floors, 301 total sanctioned units). Largest multi-disciplinary academic tower at VIT Vellore.",
        "floor_rooms": [
            {"level": 1, "name": "Ground Floor", "rooms_count": 28, "prefix": "SJT-G"},
            {"level": 2, "name": "1st Floor", "rooms_count": 40, "prefix": "SJT-1"},
            {"level": 3, "name": "2nd Floor", "rooms_count": 40, "prefix": "SJT-2"},
            {"level": 4, "name": "3rd Floor", "rooms_count": 40, "prefix": "SJT-3"},
            {"level": 5, "name": "4th Floor", "rooms_count": 35, "prefix": "SJT-4"},
            {"level": 6, "name": "5th Floor", "rooms_count": 40, "prefix": "SJT-5"},
            {"level": 7, "name": "6th Floor", "rooms_count": 40, "prefix": "SJT-6"},
            {"level": 8, "name": "7th Floor", "rooms_count": 38, "prefix": "SJT-7"}
        ]
    },
    "VIT-B003": {
        "name": "Dr. M.G.R. Block (Main Building)",
        "survey_no": "SF-108/3A, Katpadi Village",
        "floors": 5,
        "height_m": 24.0,
        "footprint_m2": 3850.0,
        "builtup_m2": 19250.0,
        "volume_m3": 92400.0,
        "order_no": "DTCP/VLR/BP-2024/007321",
        "category": "Administrative & Academic Headquarters",
        "lat": 12.96910,
        "lon": 79.15645,
        "stilt_type": "ADMINISTRATIVE_ATRIUM_STILT",
        "description": "5 Levels (Basement + Ground + 3 upper floors, 126 total sanctioned units) with inner landscaped courtyard atrium.",
        "floor_rooms": [
            {"level": 1, "name": "Basement Floor", "rooms_count": 13, "prefix": "MGR-B"},
            {"level": 2, "name": "Ground Floor", "rooms_count": 28, "prefix": "MGR-G"},
            {"level": 3, "name": "1st Floor", "rooms_count": 29, "prefix": "MGR-1"},
            {"level": 4, "name": "2nd Floor", "rooms_count": 39, "prefix": "MGR-2"},
            {"level": 5, "name": "3rd Floor", "rooms_count": 17, "prefix": "MGR-3"}
        ]
    },
    "VIT-B004": {
        "name": "G.D. Naidu Block",
        "survey_no": "SF-104/1C, Katpadi Village",
        "floors": 2,
        "height_m": 12.0,
        "footprint_m2": 1850.0,
        "builtup_m2": 3700.0,
        "volume_m3": 22200.0,
        "order_no": "DTCP/VLR/BP-2024/004512",
        "category": "Academic Workshop Block",
        "lat": 12.970250,
        "lon": 79.154100,
        "stilt_type": "WORKSHOP_GROUND_SLAB",
        "description": "2 Floors (Ground + 1st Floor, 78 total sanctioned units). North-West academic block.",
        "floor_rooms": [
            {"level": 1, "name": "Ground Floor", "rooms_count": 25, "prefix": "GDN-G"},
            {"level": 2, "name": "1st Floor", "rooms_count": 53, "prefix": "GDN-1"}
        ]
    },
    "VIT-B005": {
        "name": "Gandhi Block (MGB)",
        "survey_no": "SF-120/4D, Katpadi Village",
        "floors": 5,
        "height_m": 22.0,
        "footprint_m2": 3820.0,
        "builtup_m2": 19100.0,
        "volume_m3": 84040.0,
        "order_no": "DTCP/VLR/BP-2024/008834",
        "category": "Residential & Academic Complex",
        "lat": 12.972075,
        "lon": 79.167931,
        "stilt_type": "RESIDENTIAL_STILT",
        "description": "5 Floors (Ground + 4 upper floors). IGBC Platinum rated.",
        "floor_rooms": [
            {"level": 1, "name": "Ground Floor", "rooms_count": 20, "prefix": "MGB-G"},
            {"level": 2, "name": "1st Floor", "rooms_count": 35, "prefix": "MGB-1"},
            {"level": 3, "name": "2nd Floor", "rooms_count": 35, "prefix": "MGB-2"},
            {"level": 4, "name": "3rd Floor", "rooms_count": 35, "prefix": "MGB-3"},
            {"level": 5, "name": "4th Floor", "rooms_count": 35, "prefix": "MGB-4"}
        ]
    },
    "VIT-B006": {
        "name": "Periyar EVR Central Library",
        "survey_no": "SF-110/2A, Katpadi Village",
        "floors": 7,
        "height_m": 28.0,
        "footprint_m2": 1880.0,
        "builtup_m2": 13160.0,
        "volume_m3": 52640.0,
        "order_no": "DTCP/VLR/BP-2024/006742",
        "category": "Central Knowledge Hub",
        "lat": 12.97010,
        "lon": 79.15625,
        "stilt_type": "LIBRARY_ATRIUM_STILT",
        "description": "7 Floors (Ground + 6 upper floors, Periyar EVR Central Library, VIT Vellore campus)."
    },
    "VIT-B007": {
        "name": "CBMR - Center for Biomedical Research",
        "survey_no": "SF-114/1B, Katpadi Village",
        "floors": 5,
        "height_m": 20.0,
        "footprint_m2": 1248.0,
        "builtup_m2": 6240.0,
        "volume_m3": 24960.0,
        "order_no": "DTCP/VLR/BP-2024/005691",
        "category": "Advanced Biomedical Research Institute",
        "lat": 12.971800,
        "lon": 79.158200,
        "stilt_type": "BIOMED_LAB_STILT",
        "description": "5 Floors (Ground + 4 upper floors, 156 total sanctioned units). Advanced biomedical research center.",
        "floor_rooms": [
            {"level": 1, "name": "Ground Floor", "rooms_count": 18, "prefix": "CBMR-G"},
            {"level": 2, "name": "1st Floor", "rooms_count": 46, "prefix": "CBMR-1"},
            {"level": 3, "name": "2nd Floor", "rooms_count": 37, "prefix": "CBMR-2"},
            {"level": 4, "name": "3rd Floor", "rooms_count": 12, "prefix": "CBMR-3"},
            {"level": 5, "name": "4th Floor", "rooms_count": 43, "prefix": "CBMR-4"}
        ]
    },
    "VIT-B008": {
        "name": "CDMM - Centre for Disaster Mitigation and Management",
        "survey_no": "SF-106/3B, Katpadi Village",
        "floors": 4,
        "height_m": 16.0,
        "footprint_m2": 1512.0,
        "builtup_m2": 6048.0,
        "volume_m3": 24192.0,
        "order_no": "DTCP/VLR/BP-2024/005829",
        "category": "Disaster Management & Spatial Research Center",
        "lat": 12.969350,
        "lon": 79.154650,
        "stilt_type": "RESEARCH_GROUND_SLAB",
        "description": "4 Floors (Ground + 3 upper floors)."
    },
    "VIT-B010": {
        "name": "Anna Auditorium",
        "survey_no": "SF-109/1A, Katpadi Village",
        "floors": 1,
        "height_m": 15.0,
        "footprint_m2": 1435.0,
        "builtup_m2": 1435.0,
        "volume_m3": 21525.0,
        "order_no": "DTCP/VLR/BP-2024/003419",
        "category": "Grand Auditorium & Convention Center",
        "lat": 12.969946,
        "lon": 79.155675,
        "stilt_type": "AUDITORIUM_GRAND_HALL",
        "description": "1 Floor (Single large grand auditorium hall, 1,800 seating capacity, 15,436 sq ft)."
    }
}

def generate_building_permit_pdf(building_id: str = "VIT-B001", output_path: Optional[str] = None) -> str:
    b_id = building_id.upper()
    info = BUILDINGS_METADATA.get(b_id, BUILDINGS_METADATA["VIT-B001"])
    
    if not output_path:
        output_path = f"data/samples/{b_id}_building_permit_order.pdf"
    
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

    title_style = ParagraphStyle(
        'GovTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        alignment=1,
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

    # 1. Header
    story.append(Paragraph("GOVERNMENT OF TAMIL NADU", title_style))
    story.append(Paragraph("DIRECTORATE OF TOWN AND COUNTRY PLANNING (DTCP)", ParagraphStyle('Sub1', parent=title_style, fontSize=11, leading=14)))
    story.append(Paragraph("VELLORE LOCAL PLANNING AUTHORITY &amp; VELLORE MUNICIPAL CORPORATION", sub_title_style))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=8, spaceBefore=4))

    story.append(Paragraph("BUILDING PERMIT &amp; 3D CADASTRAL SANCTION ORDER", order_badge_style))
    story.append(Paragraph(f"<b>Order No:</b> {info['order_no']} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Sanction Date:</b> 15-OCT-2024 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Validity:</b> 14-OCT-2029", sub_title_style))
    story.append(Spacer(1, 8))

    # 2. Key Identification Table
    meta_data = [
        [
            Paragraph("<b>Applicant / Owner:</b>", body_style),
            Paragraph("Vellore Institute of Technology (VIT)", body_bold),
            Paragraph("<b>Structure Name:</b>", body_style),
            Paragraph(info["name"], body_bold)
        ],
        [
            Paragraph("<b>Property ID:</b>", body_style),
            Paragraph(b_id, body_bold),
            Paragraph("<b>Survey / Parcel No:</b>", body_style),
            Paragraph(info["survey_no"], body_bold)
        ],
        [
            Paragraph("<b>Internal 3D Property ID:</b>", body_style),
            Paragraph(f"{b_id}-VOL-2024", body_bold),
            Paragraph("<b>Authoritative ULPIN:</b>", body_style),
            Paragraph(f"ULPIN-IN-TN-VEL-{b_id}", body_bold)
        ],
        [
            Paragraph("<b>Geographic Coordinates:</b>", body_style),
            Paragraph(f"Lat: {info['lat']:.6f}° N, Lon: {info['lon']:.6f}° E", body_style),
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

    # 3. Sanctioned Parameters
    story.append(Paragraph("1. SANCTIONED 3D VOLUMETRIC PARAMETERS", sec_header_style))
    param_data = [
        [
            Paragraph("<b>Metric Parameter</b>", body_bold),
            Paragraph("<b>Approved Sanction Value</b>", body_bold),
            Paragraph("<b>Compliance Reference</b>", body_bold)
        ],
        [
            Paragraph("Approved Floor Count", body_style),
            Paragraph(f"<b>{info['floors']} Floors</b>", body_style),
            Paragraph(f"TNCDBR 2019 — {info['category']}", body_style)
        ],
        [
            Paragraph("Maximum Building Height", body_style),
            Paragraph(f"<b>{info['height_m']:.2f} meters</b> (Z: 0.0m to {info['height_m']:.2f}m)", body_style),
            Paragraph("Vellore Urban Height Clearance Envelope", body_style)
        ],
        [
            Paragraph("Plot / Footprint Area", body_style),
            Paragraph(f"<b>{info['footprint_m2']:,.2f} m²</b>", body_style),
            Paragraph("Survey Polygon EPSG:32644 (UTM 44N)", body_style)
        ],
        [
            Paragraph("Total Sanctioned Built-Up Area", body_style),
            Paragraph(f"<b>{info['builtup_m2']:,.2f} m²</b>", body_style),
            Paragraph("FSI / FAR Permissible", body_style)
        ],
        [
            Paragraph("3D Volumetric Spatial Envelope", body_style),
            Paragraph(f"<b>{info['volume_m3']:,.2f} m³</b> (Watertight Solid)", body_style),
            Paragraph("Volumetric Cadastre Rule 14-B", body_style)
        ],
        [
            Paragraph("Ground Level Floor Type", body_style),
            Paragraph(f"<b>{info['stilt_type']}</b>", body_style),
            Paragraph(info["description"][:60] + "...", body_style)
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

    # 4. Floor Schedule
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
        ]
    ]

    fl_count = info["floors"]
    fl_h = info["height_m"] / fl_count
    current_z = 0.0
    floor_rooms_meta = {fr["level"]: fr for fr in info.get("floor_rooms", [])}

    for i in range(1, fl_count + 1):
        fl_id = f"{b_id}-F{i:02d}"
        top_z = current_z + fl_h
        fr_meta = floor_rooms_meta.get(i)
        if fr_meta:
            units_label = f"{fr_meta['rooms_count']} Units ({fr_meta['prefix']}01..{fr_meta['rooms_count']:02d})"
            fl_name_label = fr_meta['name']
        else:
            units_label = f"Unit {i}01, Unit {i}02"
            fl_name_label = f"Level {i} {'(G)' if i==1 else ''}"

        floor_schedule.append([
            Paragraph(fl_id, body_style),
            Paragraph(fl_name_label, body_style),
            Paragraph(info["stilt_type"] if i==1 else "ACADEMIC", body_style),
            Paragraph(f"{current_z:.2f}", body_style),
            Paragraph(f"{top_z:.2f}", body_style),
            Paragraph(f"{fl_h:.2f}", body_style),
            Paragraph(units_label, body_style),
            Paragraph(f"{info['footprint_m2']:,.1f}", body_style)
        ])
        current_z = top_z

    t_fl = Table(floor_schedule, colWidths=[65, 75, 65, 50, 50, 50, 115, 50])
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

    # 5. Academic Block Architectural Subdivision & ULPIN Structure
    story.append(Paragraph("3. ACADEMIC BLOCK INTERNAL SUBDIVISION &amp; 3D CADASTRAL REGISTRY", sec_header_style))
    story.append(Paragraph(
        "• <b>Academic Orthogonal Layout:</b> Standardized bilateral rectangular classrooms configured along a double-loaded central circulation corridor to optimize natural ventilation and emergency egress.<br/>"
        "• <b>Common Core Infrastructure (No ULPIN):</b> Central vertical elevator shafts and open circulation atrium are certified as shared common utility spaces. <b>No individual property ULPIN is assigned to lift cores.</b><br/>"
        "• <b>Authoritative ULPIN Standard (No '-3D' Suffix):</b> Each sanctioned unit is assigned a deterministic cadastral identifier in the authoritative format <b>ULPIN-IN-TN-VEL-{UnitCode}</b> (e.g., <i>ULPIN-IN-TN-VEL-TT-101</i> to <i>ULPIN-IN-TN-VEL-TT-145</i>).",
        body_style
    ))
    story.append(Spacer(1, 6))

    if info.get("floor_rooms"):
        ulpin_schedule = [
            [
                Paragraph("<b>Floor / Level</b>", body_bold),
                Paragraph("<b>Sanctioned Units</b>", body_bold),
                Paragraph("<b>Unit Prefix</b>", body_bold),
                Paragraph("<b>Cadastral ULPIN Identifier Range (Authoritative)</b>", body_bold),
                Paragraph("<b>Core Utilities</b>", body_bold)
            ]
        ]
        for fr in info["floor_rooms"]:
            pfx = fr["prefix"]
            cnt = fr["rooms_count"]
            if pfx == "TT-G":
                start_u = "TT-G01"
                end_u = f"TT-G{cnt:02d}"
            else:
                start_u = f"{pfx}01"
                end_u = f"{pfx}{cnt:02d}"
            
            ulpin_range_str = f"ULPIN-IN-TN-VEL-{start_u} → ULPIN-IN-TN-VEL-{end_u}"
            ulpin_schedule.append([
                Paragraph(fr["name"], body_style),
                Paragraph(f"<b>{cnt} Rooms</b>", body_style),
                Paragraph(f"{pfx}", body_style),
                Paragraph(f"<font face='Courier' size='7.5'><b>{ulpin_range_str}</b></font>", body_style),
                Paragraph("<font color='#7c3aed'>Elevator Shaft (Exempt)</font>", body_style)
            ])
        
        t_ulp = Table(ulpin_schedule, colWidths=[80, 85, 60, 205, 90])
        t_ulp.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0369a1')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#0369a1')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0,0), (-1,-1), 2.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#ffffff'), colors.HexColor('#f0f9ff')])
        ]))
        story.append(t_ulp)
        story.append(Spacer(1, 10))

    # 6. Easements
    story.append(Paragraph("4. SUBSURFACE EASEMENTS &amp; AIRSPACE RIGHTS", sec_header_style))
    story.append(Paragraph("• <b>Subterranean Conduits (Z: -4.50m to 0.00m):</b> Dedicated optical fiber, high-voltage campus feeder, and stormwater drainage easements.", body_style))
    story.append(Paragraph(f"• <b>Airspace Rights (Z: {info['height_m']:.2f}m to {info['height_m']+10:.2f}m):</b> Vertical clearance zone reserved for meteorological telemetry and solar shading compliance.", body_style))
    story.append(Spacer(1, 10))

    # 7. Certification
    story.append(Paragraph("5. AUTHORITATIVE CADASTRAL VERIFICATION &amp; DIGITAL SEAL", sec_header_style))
    cert_data = [
        [
            Paragraph(f"<b>Title Deed SHA-256 Hash:</b><br/><font face='Courier' size='7'>{hash(b_id) & 0xffffffffffffffff:016x}9e4f2b1a8c7e0d3f6b9a2c5e8d1f4a7b</font>", body_style),
            Paragraph(f"<b>Digital Signature Verification:</b><br/>DTCP Certified Electronic Seal<br/>Officer ID: VLR-TNO-{b_id[-3:]}1<br/>Status: <b>AUTHENTICATED</b>", body_style)
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
    return str(out_file)

def get_building_permit_filename(building_id_or_info) -> str:
    import re
    if isinstance(building_id_or_info, str):
        info = BUILDINGS_METADATA.get(building_id_or_info.upper())
        if not info:
            for k, v in BUILDINGS_METADATA.items():
                if k.lower() == building_id_or_info.lower() or v["name"].lower() == building_id_or_info.lower():
                    info = v
                    break
        name = info["name"] if info else building_id_or_info
    elif isinstance(building_id_or_info, dict):
        name = building_id_or_info.get("name", "Building")
    else:
        name = "Building"
    
    clean_name = re.sub(r'[^\w\s-]', '', name).strip()
    clean_name = re.sub(r'[-\s]+', '_', clean_name)
    return f"{clean_name}_Building_Permit_Order.pdf"

def generate_all_campus_permit_pdfs():
    for b_id, info in BUILDINGS_METADATA.items():
        named_filename = get_building_permit_filename(b_id)
        # Primary file: named based on building name
        generate_building_permit_pdf(b_id, f"data/samples/{named_filename}")
        # Secondary alias for backwards compatibility
        generate_building_permit_pdf(b_id, f"data/samples/{b_id}_building_permit_order.pdf")
        
    # Also generate sample_building_permit_order.pdf as TT
    generate_building_permit_pdf("VIT-B001", "data/samples/sample_building_permit_order.pdf")
    print(f"Generated all {len(BUILDINGS_METADATA)} building permit PDFs in data/samples/ named after buildings.")

if __name__ == "__main__":
    generate_all_campus_permit_pdfs()

