import unittest
import json
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from shapely.geometry import shape

from backend.vit_service import vit_service
from backend.services.cadastral_3d_service import cadastral_3d_service
from backend.services.document_service import document_service
from backend import supabase_service

class TestULPINExportAndStorage(unittest.TestCase):
    """
    Test suite to verify ULPIN generation, export formats (JSON, GeoJSON, CSV, GLB, PDF),
    and Supabase/filesystem storage persistence.
    """

    def setUp(self):
        self.ulpin_data_dir = Path("data/b01/ulpin")
        self.building_id = "VIT-B001"
        self.building = vit_service.get_building_by_id(self.building_id)
        self.doc_evidence = document_service.parse_permit_document("data/samples/sample_building_permit_order.pdf")
        self.canonical_model = cadastral_3d_service.create_canonical_cadastral_model(
            building=self.building,
            document_evidence=self.doc_evidence
        )

    # -------------------------------------------------------------------------
    # TEST 1: ULPIN Format & Naming Convention Verification
    # -------------------------------------------------------------------------
    def test_01_ulpin_naming_convention(self):
        """
        Verify that ULPIN identifiers strictly follow the authoritative standard
        'ULPIN-IN-TN-VEL-{Code}' without arbitrary '-3D' suffixes.
        """
        building_ulpin = self.canonical_model.get("official_ulpin")
        self.assertIsNotNone(building_ulpin, "Building official ULPIN must not be None")
        self.assertTrue(building_ulpin.startswith("ULPIN-IN-TN-VEL-"), 
                        f"Building ULPIN '{building_ulpin}' must start with standard prefix ULPIN-IN-TN-VEL-")
        self.assertNotIn("-3D", building_ulpin, "ULPIN identifier must not contain arbitrary '-3D' suffix")

        # Verify Unit Level ULPINs
        for floor in self.canonical_model.get("floors", []):
            for unit in floor.get("units", []):
                if unit.get("is_common_infrastructure"):
                    # Shared core infrastructure (Lifts, Corridors) must have official_ulpin set to None
                    self.assertIsNone(unit.get("official_ulpin"), 
                                      f"Common infrastructure {unit['unit_id']} must have official_ulpin = None")
                else:
                    u_ulpin = unit.get("official_ulpin")
                    self.assertIsNotNone(u_ulpin, f"Property unit {unit['unit_id']} must have an authoritative ULPIN")
                    self.assertTrue(u_ulpin.startswith("ULPIN-IN-TN-VEL-"), 
                                    f"Unit ULPIN '{u_ulpin}' must follow standard prefix ULPIN-IN-TN-VEL-")
                    self.assertNotIn("-3D", u_ulpin, "Unit ULPIN must not contain arbitrary '-3D' suffix")

    # -------------------------------------------------------------------------
    # TEST 2: Pipeline Export Files Verification (JSON, GeoJSON, CSV, GLB)
    # -------------------------------------------------------------------------
    def test_02_filesystem_export_files_exist(self):
        """
        Verify that generation pipeline produces all required exported registry deliverables.
        """
        json_path = self.ulpin_data_dir / "property_registry.json"
        geojson_path = self.ulpin_data_dir / "property_registry.geojson"
        csv_path = self.ulpin_data_dir / "property_registry.csv"
        glb_path = self.ulpin_data_dir / "3d_ulpin_scene.glb"

        self.assertTrue(json_path.exists(), f"Registry JSON missing at {json_path}")
        self.assertTrue(geojson_path.exists(), f"Registry GeoJSON missing at {geojson_path}")
        self.assertTrue(csv_path.exists(), f"Registry CSV missing at {csv_path}")
        self.assertTrue(glb_path.exists(), f"Combined 3D GLB scene missing at {glb_path}")

    def test_03_export_json_structure(self):
        """
        Verify property_registry.json contains valid entities and schema fields.
        """
        json_path = self.ulpin_data_dir / "property_registry.json"
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("schema_version", data)
        self.assertIn("identifier_system", data)
        self.assertIn("parcel_context", data)
        self.assertIn("entities", data)

        entities = data["entities"]
        self.assertGreater(len(entities), 0, "Registry JSON must contain registered property entities")

        # Check hash and spatial fields
        for ent in entities:
            self.assertIn("property_id", ent)
            self.assertIn("entity_type", ent)
            self.assertIn("hierarchy_level", ent)
            self.assertIn("spatial", ent)
            self.assertIn("geometry_hash", ent, "Each entity must have a deterministic geometry_hash")
            self.assertEqual(len(ent["geometry_hash"]), 16, "Geometry hash must be a 16-character hex string")

    def test_04_export_csv_validity(self):
        """
        Verify property_registry.csv can be parsed and contains required columns.
        """
        csv_path = self.ulpin_data_dir / "property_registry.csv"
        df = pd.read_csv(csv_path)

        expected_columns = ["Property_ID", "Entity_Type", "Parcel_ID", "Building_ID", 
                            "Z_Min_m", "Z_Max_m", "Area_m2", "Volume_m3", "Geometry_Hash"]
        for col in expected_columns:
            self.assertIn(col, df.columns, f"CSV export missing required column '{col}'")

        self.assertGreater(len(df), 0, "CSV export must not be empty")

    # -------------------------------------------------------------------------
    # TEST 3: Supabase Database Storage Schema & Discrepancies
    # -------------------------------------------------------------------------
    def test_05_compact_schema_storage_behavior(self):
        """
        Check database storage behavior in compact schema vs dynamic runtime generation.
        Compact schema stores parent parcels and building footprints, while 3D floor slices
        and unit ULPINs are derived dynamically.
        """
        # Test Supabase client initialization check
        enabled = supabase_service.is_supabase_enabled()
        if not enabled:
            self.skipTest("Supabase credentials not configured in environment (.env). Skipping live DB query test.")

        client = supabase_service.get_supabase_client()
        self.assertIsNotNone(client, "Supabase client initialization failed")

        # Test querying buildings table
        res = client.table("buildings").select("*, parcels(*)").eq("building_code", self.building_id).execute()
        self.assertTrue(res.data and len(res.data) > 0, f"Building {self.building_id} not found in Supabase database")

        row = res.data[0]
        self.assertIn("building_code", row)
        self.assertIn("footprint_geojson", row)
        self.assertIn("total_floors", row)

        # Check parcel reference
        parcel = row.get("parcels")
        self.assertIsNotNone(parcel, "Building row must reference parent parcel record")
        
        # Verify official_ulpin behavior: In compact database, official_ulpin is NULL until official deed is assigned
        official_ulpin = parcel.get("official_ulpin")
        print(f"\n[INFO] DB Parcel official_ulpin: {official_ulpin} (NULL is expected for initial survey status)")

    # -------------------------------------------------------------------------
    # TEST 4: Key Inconsistencies & Property Mapping Audit
    # -------------------------------------------------------------------------
    def test_06_ulpin_property_key_alignment(self):
        """
        Audit alignment between 'ulpin', 'official_ulpin', and 'authoritative_ulpin'
        across API response payloads.
        """
        doc_parsed = document_service.parse_permit_document("data/samples/sample_building_permit_order.pdf", building_id="VIT-B001")
        
        self.assertIn("official_ulpin", doc_parsed)
        self.assertIn("authoritative_ulpin", doc_parsed)
        self.assertIn("extracted_ulpin", doc_parsed)

        self.assertEqual(doc_parsed["official_ulpin"], doc_parsed["authoritative_ulpin"])
        self.assertEqual(doc_parsed["official_ulpin"], doc_parsed["extracted_ulpin"])

if __name__ == "__main__":
    unittest.main()
