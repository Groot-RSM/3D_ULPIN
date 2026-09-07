import sys
from pathlib import Path
from backend.services.document_service import document_service

sys.stdout.reconfigure(encoding='utf-8')

sample_dir = Path("data/samples")
pdf_files = list(sample_dir.glob("*_Building_Permit_Order.pdf"))
print(f"Total Permit PDFs: {len(pdf_files)}\n")

for p in sorted(pdf_files):
    parsed = document_service.parse_permit_document(str(p))
    b_id = parsed.get("building_id")
    name = parsed.get("building_name")
    ulpin = parsed.get("authoritative_ulpin") or parsed.get("extracted_ulpin")
    floors = parsed.get("approved_floors")
    units = parsed.get("total_units")
    schedules = parsed.get("floor_schedules", [])
    
    print(f"File: {p.name}")
    print(f"  • Building: {b_id} — {name}")
    print(f"  • Building-Level ULPIN: {ulpin}")
    print(f"  • Approved Floors: {floors} | Total Sanctioned Units: {units}")
    print(f"  • Floor-wise ULPIN Ranges:")
    for fs in schedules:
        fl_num = fs.get("floor")
        cnt = fs.get("rooms_count")
        ulpin_rng = fs.get("ulpin_range")
        print(f"     - Level {fl_num:02d}: {cnt:2d} units  ->  {ulpin_rng}")
    print("=" * 70)
