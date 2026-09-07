import unittest
import json
from shapely.geometry import shape, Polygon
from backend.services.cadastral_3d_service import cadastral_3d_service
from backend.services.document_service import document_service
from backend.vit_service import vit_service

class TestPhase6BCadastralModel(unittest.TestCase):
    def setUp(self):
        self.tt_building = vit_service.get_building_by_id("VIT-B001")
        self.doc_evidence = document_service.parse_permit_document("data/samples/sample_building_permit_order.pdf")
        self.model = cadastral_3d_service.create_canonical_cadastral_model(
            building=self.tt_building,
            document_evidence=self.doc_evidence
        )

    # 1. Building footprint reconstruction
    def test_01_building_footprint_reconstruction(self):
        envelope = self.model.get("envelope", {})
        self.assertIsNotNone(envelope.get("footprint_geometry"))
        self.assertGreater(envelope.get("footprint_area_m2", 0), 3000.0)
        s = shape(envelope["footprint_geometry"])
        self.assertTrue(s.is_valid)

    # 2. Floor reconstruction
    def test_02_floor_reconstruction(self):
        floors = self.model.get("floors", [])
        self.assertEqual(len(floors), 8, "Expected exactly 8 floors (Ground + 7 upper floors) reconstructed from document")
        self.assertEqual(floors[0]["physical_level"], 1)
        self.assertEqual(floors[-1]["physical_level"], 8)

    # 3. Unit reconstruction
    def test_03_unit_reconstruction(self):
        floors = self.model.get("floors", [])
        total_units = sum(len(f.get("units", [])) for f in floors)
        self.assertGreaterEqual(total_units, 14, "Expected at least 14 volumetric property units")
        for f in floors:
            for u in f.get("units", []):
                self.assertIn("unit_id", u)
                self.assertIn("internal_property_id", u)
                self.assertIn("unit_area_m2", u)
                self.assertIn("unit_volume_m3", u)

    # 4. Unit 2D/3D footprint consistency
    def test_04_unit_2d_3d_footprint_consistency(self):
        floors = self.model.get("floors", [])
        for f in floors:
            for u in f.get("units", []):
                geom = u.get("geometry")
                self.assertIsNotNone(geom)
                s = shape(geom)
                self.assertTrue(s.is_valid)
                self.assertGreater(s.area, 0)

    # 5. Floor Z consistency
    def test_05_floor_z_consistency(self):
        floors = self.model.get("floors", [])
        prev_top = 0.0
        for f in floors:
            base_z = f.get("base_height_m")
            top_z = f.get("top_height_m")
            self.assertLess(base_z, top_z, "base_z must be strictly less than top_z")
            self.assertAlmostEqual(base_z, prev_top, delta=0.01)
            prev_top = top_z

    # 6. Unit Z consistency
    def test_06_unit_z_consistency(self):
        floors = self.model.get("floors", [])
        for f in floors:
            fl_base = f["base_height_m"]
            fl_top = f["top_height_m"]
            for u in f.get("units", []):
                self.assertEqual(u["base_height_m"], fl_base)
                self.assertEqual(u["top_height_m"], fl_top)

    # 7. Unit containment
    def test_07_unit_containment(self):
        fp_shape = shape(self.model["envelope"]["footprint_geometry"]).buffer(1e-5)
        for f in self.model.get("floors", []):
            for u in f.get("units", []):
                u_shape = shape(u["geometry"])
                self.assertTrue(fp_shape.contains(u_shape), f"Unit {u['unit_id']} must be contained within building envelope")

    # 8. Unit non-overlap
    def test_08_unit_non_overlap(self):
        for f in self.model.get("floors", []):
            units = f.get("units", [])
            for i in range(len(units)):
                s1 = shape(units[i]["geometry"])
                for j in range(i + 1, len(units)):
                    s2 = shape(units[j]["geometry"])
                    inter_area = s1.intersection(s2).area
                    self.assertAlmostEqual(inter_area, 0.0, places=4, msg="Pairwise units must have zero overlap")

    # 9. Missing unit geometry safeguard
    def test_09_missing_unit_geometry_safeguard(self):
        empty_building = {"building_id": "TEST-NO-GEOM", "name": "No Geom Building"}
        res = cadastral_3d_service.create_canonical_cadastral_model(empty_building)
        self.assertEqual(res.get("status"), "ERROR")

    # 10. Missing floor height safeguard
    def test_10_missing_floor_height_safeguard(self):
        b_no_h = dict(self.tt_building)
        b_no_h["height_m"] = None
        model = cadastral_3d_service.create_canonical_cadastral_model(b_no_h, {"building_height_m": None})
        self.assertTrue(model["envelope"]["height_unavailable"])

    # 11. Unique floor IDs
    def test_11_unique_floor_ids(self):
        floors = self.model.get("floors", [])
        f_ids = [f["floor_id"] for f in floors]
        self.assertEqual(len(f_ids), len(set(f_ids)), "All floor IDs must be globally unique")

    # 12. Unique unit IDs
    def test_12_unique_unit_ids(self):
        all_u_ids = []
        for f in self.model.get("floors", []):
            for u in f.get("units", []):
                all_u_ids.append(u["internal_property_id"])
        self.assertEqual(len(all_u_ids), len(set(all_u_ids)), "All unit property IDs must be unique across building")

    # 13. Provenance preservation
    def test_13_provenance_preservation(self):
        prov = self.model.get("source_provenance", {})
        self.assertEqual(prov.get("document_id"), "DTCP/VLR/BP-2024/008492")
        self.assertEqual(prov.get("source_page"), 1)
        for f in self.model.get("floors", []):
            for u in f.get("units", []):
                self.assertEqual(u.get("source_document"), "DTCP/VLR/BP-2024/008492")

    # 14. Floor selection structure
    def test_14_floor_selection_structure(self):
        floors = self.model.get("floors", [])
        self.assertGreater(len(floors), 0)
        sample_floor = floors[0]
        self.assertIn("floor_id", sample_floor)
        self.assertIn("physical_level", sample_floor)
        self.assertIn("floor_type", sample_floor)
        self.assertIn("base_height_m", sample_floor)
        self.assertIn("top_height_m", sample_floor)

    # 15. Unit selection metadata
    def test_15_unit_selection_metadata(self):
        floors = self.model.get("floors", [])
        u = floors[0]["units"][0]
        self.assertIn("unit_id", u)
        self.assertIn("building_id", u)
        self.assertIn("floor_id", u)
        self.assertIn("physical_level", u)
        self.assertIn("unit_area_m2", u)
        self.assertIn("unit_volume_m3", u)
        self.assertIn("geometry_source", u)
        self.assertIn("authoritative", u)

    # 16. Floor isolation logic
    def test_16_floor_isolation_logic(self):
        floors = self.model.get("floors", [])
        self.assertEqual(len(floors), 8)
        # Floor levels can be isolated independently
        target_lvl = 3
        isolated = [f for f in floors if f["physical_level"] == target_lvl]
        self.assertEqual(len(isolated), 1)

    # 17. Explode visualization mode
    def test_17_explode_visualization_mode(self):
        # Ensure model coordinates are canonical and not shifted by explode
        floors = self.model.get("floors", [])
        self.assertEqual(floors[0]["base_height_m"], 0.0)
        self.assertAlmostEqual(floors[1]["base_height_m"], floors[0]["top_height_m"], delta=0.01)

    # 18. GLB hierarchy (Building -> Floor -> Unit)
    def test_18_glb_hierarchy(self):
        self.assertEqual(self.model["model_type"], "PHASE_6B_SIMPLIFIED_CADASTRAL_3D")
        self.assertIn("envelope", self.model)
        self.assertIn("floors", self.model)
        self.assertIn("units", self.model["floors"][0])

    # 19. GLB canonical consistency
    def test_19_glb_canonical_consistency(self):
        total_units = sum(len(f["units"]) for f in self.model["floors"])
        self.assertEqual(self.model["units_total_count"], total_units)

    # 20. No room geometry generated
    def test_20_no_room_geometry_generated(self):
        for f in self.model.get("floors", []):
            self.assertNotIn("rooms", f, "Phase 6B must NOT generate room nodes")
            self.assertNotIn("partition_walls", f, "Phase 6B must NOT generate interior walls")

    # 21. No balcony geometry generated
    def test_21_no_balcony_geometry_generated(self):
        for f in self.model.get("floors", []):
            for u in f.get("units", []):
                self.assertNotIn("balcony", u, "Phase 6B must NOT generate balcony nodes")

    # 22. No decorative architectural geometry generated
    def test_22_no_decorative_architectural_geometry(self):
        for f in self.model.get("floors", []):
            self.assertNotIn("columns", f)
            self.assertNotIn("hvac", f)
            self.assertNotIn("roof_tanks", f)
            self.assertNotIn("furniture", f)

    # 23. No fabricated dimensions
    def test_23_no_fabricated_dimensions(self):
        env = self.model["envelope"]
        self.assertEqual(env["total_height_m"], 36.0, "Building height must match sanctioned 36.0m")
        self.assertEqual(env["footprint_area_m2"], 3540.0, "Footprint must match verified 3,540.0m²")

if __name__ == "__main__":
    unittest.main()
