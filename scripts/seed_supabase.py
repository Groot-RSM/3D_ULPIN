#!/usr/bin/env python3
"""
Seed script to migrate VIT Vellore campus footprints into Supabase compact schema.
Usage:
  python scripts/seed_supabase.py
"""

import os
import json
import math
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("\n[ERROR] SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set in your .env file.")
    print("Example in .env:")
    print("  SUPABASE_URL=https://your-project.supabase.co")
    print("  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n")
    exit(1)

try:
    from supabase import create_client
except ImportError:
    print("[ERROR] 'supabase' package is not installed. Run: pip install supabase")
    exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)
GEOJSON_PATH = Path(__file__).resolve().parent.parent / "data" / "vit_vellore" / "campus_footprints.geojson"

def seed():
    print(f"[*] Connecting to Supabase at {SUPABASE_URL}...")

    # 1. Seed or retrieve Parent Parcel (P-VIT-001)
    parcel_payload = {
        "parcel_id": "P-VIT-001",
        "official_ulpin": None,  # Keep NULL until official gov deed is assigned
        "name": "VIT Vellore Main Campus Land Parcel"
    }

    print("[*] Checking / Inserting parent parcel 'P-VIT-001'...")
    existing_parcel = client.table("parcels").select("id").eq("parcel_id", "P-VIT-001").execute()
    
    if existing_parcel.data:
        parcel_db_id = existing_parcel.data[0]["id"]
        print(f"[+] Found existing parcel ID: {parcel_db_id}")
    else:
        inserted = client.table("parcels").insert(parcel_payload).execute()
        parcel_db_id = inserted.data[0]["id"]
        print(f"[+] Created parent parcel ID: {parcel_db_id}")

    # 2. Read and parse campus footprints GeoJSON
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    print(f"[*] Processing {len(features)} audited building footprints...")

    building_rows = []
    for idx, feat in enumerate(features, start=1):
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        
        b_code = props.get("building_id", f"VIT-B{idx:03d}")
        b_name = props.get("name", f"VIT Building {idx}")
        area_m2 = float(props.get("area_m2", 1200.0))
        height_m = float(props.get("height_m", 24.0))
        total_floors = int(props.get("verified_floor_count") or props.get("final_floor_count") or max(1, round(height_m / 4.0)))
        
        fl_height = round(height_m / total_floors, 2)
        c_lat = float(props.get("centroid_lat", 12.9692))
        c_lon = float(props.get("centroid_lon", 79.1560))

        # WKT Polygon for PostGIS
        poly_coords = geom.get("coordinates", [])
        outer_ring = poly_coords[0] if poly_coords else []
        wkt_points = ", ".join(f"{pt[0]} {pt[1]}" for pt in outer_ring)
        wkt_polygon = f"POLYGON(({wkt_points}))" if outer_ring else None

        row = {
            "parcel_id": parcel_db_id,
            "building_no": idx,
            "building_code": b_code,
            "building_name": b_name,
            "building_type": "EDUCATIONAL_ACADEMIC",
            "centroid_lat": c_lat,
            "centroid_lon": c_lon,
            "area_m2": area_m2,
            "total_height_m": height_m,
            "total_floors": total_floors,
            "units_per_floor": 4,  # Standard 4 sub-parcels per floor config
            "floor_height": fl_height,
            "footprint_geojson": geom,
            "source": props.get("source", "OpenStreetMap / Survey"),
            "source_building_id": props.get("source_id", b_code),
            "verification_status": props.get("verification_status", "VERIFIED"),
            "confidence_tier": props.get("certainty", "HIGH"),
            "unit_configuration_source": "DERIVED",
            "notes": props.get("notes", "")
        }

        # Check if building exists
        existing_b = client.table("buildings").select("id").eq("building_code", b_code).execute()
        if existing_b.data:
            client.table("buildings").update(row).eq("building_code", b_code).execute()
            print(f"    [Updated] {b_code}: {b_name} ({total_floors} floors, {area_m2} m²)")
        else:
            client.table("buildings").insert(row).execute()
            print(f"    [Inserted] {b_code}: {b_name} ({total_floors} floors, {area_m2} m²)")

    print(f"\n[SUCCESS] Successfully migrated {len(features)} buildings to Supabase compact schema!\n")

if __name__ == "__main__":
    seed()
