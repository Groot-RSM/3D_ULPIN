import sqlite3
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

DB_PATH = Path("data/ulpin.db")

def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Projects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        district TEXT,
        taluk TEXT,
        village TEXT,
        survey_number TEXT,
        ulpin TEXT,
        aoi_coords TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT
    );
    """)

    # 2. Parcels table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS parcels (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        survey_number TEXT,
        area_m2 REAL,
        geometry_json TEXT,
        data_certainty TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 3. Buildings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS buildings (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        parcel_id TEXT,
        name TEXT,
        height_m REAL,
        floors_count INTEGER,
        ground_elev_m REAL,
        footprint_json TEXT,
        data_certainty TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 4. Entities table (3D Volumetric Spatial Units)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS entities (
        property_id TEXT PRIMARY KEY,
        project_id TEXT,
        building_id TEXT,
        entity_type TEXT,
        hierarchy_level TEXT,
        name TEXT,
        level INTEGER,
        spatial_json TEXT,
        provenance_json TEXT,
        data_certainty TEXT,
        topology_status TEXT,
        verification_status TEXT,
        legal_disclaimer TEXT,
        geometry_hash TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 5. Regulatory Records (TNRERA)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS regulatory_records (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        building_id TEXT,
        rera_number TEXT,
        project_name TEXT,
        promoter TEXT,
        registered_location TEXT,
        project_type TEXT,
        registration_status TEXT,
        declared_floors INTEGER,
        declared_units INTEGER,
        declared_area_m2 REAL,
        retrieval_timestamp TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 6. Conflicts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        building_id TEXT,
        conflict_category TEXT,
        title TEXT,
        description TEXT,
        severity TEXT,
        status TEXT,
        affected_entity_ids TEXT,
        bounding_box_json TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 7. Documents table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        target_type TEXT,
        target_id TEXT,
        doc_type TEXT,
        file_name TEXT,
        file_path TEXT,
        verification_state TEXT,
        uploaded_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 8. Verifications table (Officer Audit Trail)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS verifications (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        property_id TEXT,
        action TEXT,
        verified_by TEXT,
        verified_at TEXT,
        notes TEXT,
        previous_hash TEXT,
        current_hash TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 9. Processing Jobs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS processing_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        stage TEXT,
        progress_pct INTEGER,
        status_message TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    # 10. Data Sources / Lineage table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS data_sources (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        source_name TEXT,
        resolution TEXT,
        provenance_class TEXT,
        affected_entities TEXT,
        is_authoritative INTEGER,
        authoritative_missing_note TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    """)

    conn.commit()
    conn.close()

    # Seed Project P001 if empty
    seed_p001_if_needed()

def seed_p001_if_needed():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM projects WHERE id = 'P001'")
    count = cursor.fetchone()[0]

    if count == 0:
        now = datetime.utcnow().isoformat()
        # Seed P001 Project
        cursor.execute("""
        INSERT INTO projects (id, name, district, taluk, village, survey_number, ulpin, aoi_coords, status, created_at)
        VALUES ('P001', 'Soorya Apartments - Kolathur', 'Chennai', 'Ayanavaram', 'Kolathur', '124/2A', 'TN-CHN-00804', ?, 'ACTIVE', ?)
        """, (json.dumps({"bbox": [80.2050, 13.1180, 80.2180, 13.1300]}), now))

        # Seed Parcel P001
        cursor.execute("""
        INSERT INTO parcels (id, project_id, survey_number, area_m2, geometry_json, data_certainty)
        VALUES ('P001', 'P001', '124/2A', 720.0, ?, 'DERIVED')
        """, (json.dumps({"type": "Polygon", "coordinates": [[[414614.2, 1450314.4], [414638.2, 1450314.4], [414638.2, 1450344.4], [414614.2, 1450344.4], [414614.2, 1450314.4]]]}),))

        # Seed Building B01
        cursor.execute("""
        INSERT INTO buildings (id, project_id, parcel_id, name, height_m, floors_count, ground_elev_m, footprint_json, data_certainty)
        VALUES ('P001-B01', 'P001', 'P001', 'Soorya Apartments', 12.0, 4, 15.0, ?, 'DERIVED')
        """, (json.dumps({"type": "Polygon", "coordinates": [[[414617.98, 1450329.44], [414634.43, 1450329.44], [414634.43, 1450351.68], [414617.98, 1450351.68], [414617.98, 1450329.44]]]}),))

        # Seed Property Registry Entities from data/b01/ulpin/property_registry.json
        reg_file = Path("data/b01/ulpin/property_registry.json")
        if reg_file.exists():
            with open(reg_file, "r", encoding="utf-8") as f:
                reg_data = json.load(f)
                for ent in reg_data.get("entities", []):
                    pid = ent["property_id"]
                    etype = ent.get("entity_type", "")
                    hlevel = ent.get("hierarchy_level", "")
                    name = ent.get("name", pid)
                    lvl = ent.get("level", 0)
                    sp = ent.get("spatial", {})
                    prov = ent.get("provenance", {})

                    # Determine data certainty
                    if etype == "private_residential_unit":
                        certainty = "ESTIMATED"
                        disclaimer = "ESTIMATED AND NOT LEGALLY VERIFIED (PROCEDURAL 2x2 QUADRANT)"
                    elif "UG-" in pid:
                        certainty = "CONTROLLED_DEMO"
                        disclaimer = "SYNTHETIC DEMO UTILITY - NOT AUTHORITATIVE"
                    else:
                        certainty = "DERIVED"
                        disclaimer = "DERIVED FROM MICROSOFT ML + OSM + COPERNICUS DEM"

                    cursor.execute("""
                    INSERT OR REPLACE INTO entities (
                        property_id, project_id, building_id, entity_type, hierarchy_level, name, level,
                        spatial_json, provenance_json, data_certainty, topology_status, verification_status,
                        legal_disclaimer, geometry_hash
                    ) VALUES (?, 'P001', 'P001-B01', ?, ?, ?, ?, ?, ?, ?, 'VALIDATED', 'REQUIRES_REVIEW', ?, ?)
                    """, (
                        pid, etype, hlevel, name, lvl,
                        json.dumps(sp), json.dumps(prov), certainty, disclaimer, ent.get("geometry_hash", "hash_p001")
                    ))

        # Seed TNRERA Regulatory Record for P001
        cursor.execute("""
        INSERT INTO regulatory_records (
            id, project_id, building_id, rera_number, project_name, promoter,
            registered_location, project_type, registration_status, declared_floors, declared_units, declared_area_m2, retrieval_timestamp
        ) VALUES (
            'RERA-P001', 'P001', 'P001-B01', 'TN/01/Building/0124/2022', 'Soorya Residential Complex',
            'Soorya Builders Pvt Ltd', 'Plot 124/2A, Kolathur Main Rd, Chennai 600099',
            'Residential Apartment', 'REGISTERED', 4, 16, 711.2, ?
        )
        """, (now,))

        # Seed 4 Conflict Categories for P001
        cursor.execute("""
        INSERT INTO conflicts (id, project_id, building_id, conflict_category, title, description, severity, status, affected_entity_ids, bounding_box_json)
        VALUES 
        ('C01', 'P001', 'P001-B01', 'TOPOLOGICAL', 'Volumetric Overlap in Penthouse Unit U401', '3D volumetric overlap detected between Penthouse Unit U401 and unauthorized upper stairwell structure.', 'CRITICAL', 'POSSIBLE DISCREPANCY', ?, ?),
        ('C02', 'P001', 'P001-B01', 'SUBSURFACE', 'Basement Subsurface Conduit Intrusion', 'Underground sewer main (UG-W01) intersects protected basement volume UG-B01 at elevation 14.2m.', 'WARNING', 'REQUIRES FIELD VERIFICATION', ?, ?),
        ('C03', 'P001', 'P001-B01', 'PARCEL_CADASTRAL', 'Airspace Height Clearance Discrepancy', 'Building parapet structures encroach 0.8m into reserved airspace easement AS-B01 above 27.0m MSL.', 'WARNING', 'POSSIBLE DISCREPANCY', ?, ?),
        ('C04', 'P001', 'P001-B01', 'REGULATORY_DISCREPANCY', 'RERA Declared Area vs 3D Cadastral Volume Discrepancy', 'Registered TNRERA floor area declared (711.2 m²) differs by 4.2% from derived 3D WebGL volumetric floor sum (742.0 m²).', 'INFO', 'REQUIRES FIELD VERIFICATION', ?, ?)
        """, (
            json.dumps(["P001-B01-F04-U401", "P001-B01-F04"]), json.dumps({"min": [414617.9, 1450329.4, 24.0], "max": [414626.2, 1450340.5, 27.0]}),
            json.dumps(["UG-B01", "UG-W01"]), json.dumps({"min": [414617.9, 1450329.4, 12.0], "max": [414634.4, 1450351.6, 15.0]}),
            json.dumps(["AS-B01", "P001-B01-F04"]), json.dumps({"min": [414617.9, 1450329.4, 27.0], "max": [414634.4, 1450351.6, 32.0]}),
            json.dumps(["P001-B01", "RERA-P001"]), json.dumps({"min": [414617.9, 1450329.4, 15.0], "max": [414634.4, 1450351.6, 27.0]})
        ))

        # Seed Data Sources / Lineage for P001
        sources = [
            ("DS01", "Microsoft Global Building Footprints", "Sub-meter ML extraction", "DERIVED", "Building B01 Footprint", 0, "REQUIRES AUTHORITATIVE FIELD BOUNDARY SURVEY"),
            ("DS02", "OpenStreetMap (OSM way/354496166)", "Crowdsourced vector", "DERIVED", "Building B01 Metadata", 0, "REQUIRES MUNICIPAL REGISTRY CONFIRMATION"),
            ("DS03", "Copernicus Global DEM 30m", "30m Spatial Resolution", "DERIVED", "Ground Surface Elevation (15.0m AMSL)", 0, "REQUIRES DGPS / DTM ELEVATION SURVEY"),
            ("DS04", "Procedural NBC 3.0m Slicer", "Assumed 3.0m/floor height", "ESTIMATED", "Floor Slabs & 16 Apartment Units", 0, "NOT LEGALLY VERIFIED — ESTIMATED FROM NBC STANDARDS"),
            ("DS05", "Synthetic Demo Utility Engine", "Procedural pipe modeling", "CONTROLLED_DEMO", "Basement, Sewer Main & Telecom Conduit", 0, "CONTROLLED DEMO — REQUIRES UTILITY BOARD GIS DATA")
        ]
        for s in sources:
            cursor.execute("""
            INSERT INTO data_sources (id, project_id, source_name, resolution, provenance_class, affected_entities, is_authoritative, authoritative_missing_note)
            VALUES (?, 'P001', ?, ?, ?, ?, ?, ?)
            """, s)

        conn.commit()

    conn.close()

# Initialize DB when module loaded
init_db()
