import json
import math
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

FOOTPRINTS_PATH = Path("data/vit_vellore/campus_footprints.geojson")
ROUTES_PATH = Path("data/vit_vellore/campus_routes.geojson")

DEFAULT_TYPICAL_FLOOR_HEIGHT_M = 4.0
PLAUSIBLE_FLOOR_HEIGHT_MIN_M = 3.0
PLAUSIBLE_FLOOR_HEIGHT_MAX_M = 5.0

def sanitize_val(val: Any) -> Any:
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, dict):
        return {k: sanitize_val(v) for k, v in val.items()}
    if isinstance(val, list):
        return [sanitize_val(x) for x in val]
    return val

class FloorCountReconciliationService:
    @staticmethod
    def reconcile(
        building: Dict[str, Any],
        typical_floor_height_m: float = DEFAULT_TYPICAL_FLOOR_HEIGHT_M,
        override_floor_count: Optional[int] = None,
        override_reason: Optional[str] = None,
        override_user: Optional[str] = None
    ) -> Dict[str, Any]:
        b_id = building.get("building_id", "UNKNOWN")
        height_m = building.get("height_m")
        if height_m is not None:
            try:
                height_m = float(height_m)
            except (ValueError, TypeError):
                height_m = None

        # STEP 1: Read OSM Floor Metadata
        osm_levels = building.get("floors") or building.get("building:levels") or building.get("levels") or building.get("osm_levels")
        if osm_levels is not None:
            try:
                floor_count_osm = int(osm_levels)
                if floor_count_osm <= 0:
                    floor_count_osm = None
            except (ValueError, TypeError):
                floor_count_osm = None
        else:
            floor_count_osm = None

        # STEP 2: Derive Height Floor Count
        if height_m and height_m > 0:
            floor_count_height_estimate = int(round(height_m / typical_floor_height_m))
            floor_count_height_estimate = max(1, floor_count_height_estimate)
        else:
            floor_count_height_estimate = None

        verified_floor_count = building.get("verified_floor_count")
        if verified_floor_count is not None:
            try:
                verified_floor_count = int(verified_floor_count)
            except (ValueError, TypeError):
                verified_floor_count = None

        # STEP 3: Reconcile Sources
        if override_floor_count is not None and override_floor_count > 0:
            final_floor_count = override_floor_count
            agreement_status = "MANUAL_OVERRIDE"
            confidence_tier = "HIGH"
            review_required = False
            generation_method = "SURVEYOR_MANUAL_OVERRIDE"
            certainty_tier = "SURVEY_CONFIRMED"
            implied_avg_height = round(height_m / final_floor_count, 2) if height_m else typical_floor_height_m
        elif verified_floor_count is not None and verified_floor_count > 0:
            final_floor_count = verified_floor_count
            agreement_status = building.get("agreement_status", "VERIFIED_RECORD")
            confidence_tier = "HIGH"
            review_required = False
            generation_method = "OFFICIAL_VIT_RECORD"
            certainty_tier = "VERIFIED_OFFICIAL"
            implied_avg_height = round(height_m / final_floor_count, 2) if height_m else typical_floor_height_m
        elif floor_count_osm is not None and floor_count_height_estimate is not None:
            diff = abs(floor_count_osm - floor_count_height_estimate)
            implied_avg_height = round(height_m / floor_count_osm, 2) if height_m else typical_floor_height_m

            if diff == 0:
                # CASE A: Exact Match
                final_floor_count = floor_count_osm
                agreement_status = "EXACT"
                confidence_tier = "HIGH"
                review_required = False
                generation_method = "OSM_HEIGHT_RECONCILED"
                certainty_tier = "DERIVED"
            elif diff == 1:
                # CASE B: 1 Floor Difference
                if PLAUSIBLE_FLOOR_HEIGHT_MIN_M <= implied_avg_height <= PLAUSIBLE_FLOOR_HEIGHT_MAX_M:
                    final_floor_count = floor_count_osm
                    agreement_status = "MINOR_DISCREPANCY"
                    confidence_tier = "MEDIUM"
                    review_required = True
                    generation_method = "OSM_PREFERRED_PLAUSIBLE"
                    certainty_tier = "DERIVED"
                else:
                    final_floor_count = floor_count_height_estimate
                    agreement_status = "MINOR_DISCREPANCY"
                    confidence_tier = "LOW"
                    review_required = True
                    generation_method = "HEIGHT_ESTIMATE_PREFERRED"
                    certainty_tier = "ESTIMATED"
            else:
                # CASE C: Large Disagreement (>1 floor)
                final_floor_count = floor_count_osm
                agreement_status = "SOURCE_CONFLICT"
                confidence_tier = "LOW"
                review_required = True
                generation_method = "SOURCE_DISCREPANCY_PENDING_REVIEW"
                certainty_tier = "UNRESOLVED_CONFLICT"
        elif floor_count_osm is None and floor_count_height_estimate is not None:
            # CASE D: OSM Missing
            final_floor_count = floor_count_height_estimate
            agreement_status = "OSM_NOT_AVAILABLE"
            confidence_tier = "MEDIUM"
            review_required = True
            generation_method = "HEIGHT_BASED_INFERENCE"
            certainty_tier = "ESTIMATED"
            implied_avg_height = round(height_m / final_floor_count, 2) if height_m else typical_floor_height_m
        elif floor_count_osm is not None and floor_count_height_estimate is None:
            # CASE E: Height Missing
            final_floor_count = floor_count_osm
            agreement_status = "HEIGHT_NOT_AVAILABLE"
            confidence_tier = "MEDIUM"
            review_required = True
            generation_method = "OSM_LEVELS_ONLY"
            certainty_tier = "DERIVED_FROM_OSM"
            implied_avg_height = typical_floor_height_m
        else:
            final_floor_count = 1
            agreement_status = "INSUFFICIENT_DATA"
            confidence_tier = "LOW"
            review_required = True
            generation_method = "DEFAULT_SINGLE_STOREY"
            certainty_tier = "UNVERIFIED"
            implied_avg_height = typical_floor_height_m

        # STEP 4: Dynamic Floor Slices
        area_m2 = float(building.get("area_m2", 1000.0))
        ground_z = float(building.get("ground_z", 0.0))
        floors_list = []

        b_ulpin = building.get("ulpin") or f"ULPIN-IN-TN-VEL-{b_id}"

        for i in range(1, final_floor_count + 1):
            z_min = round(ground_z + (i - 1) * implied_avg_height, 2)
            z_max = round(ground_z + i * implied_avg_height, 2)
            fl_height = round(z_max - z_min, 2)
            vol = round(area_m2 * fl_height, 2)

            floors_list.append({
                "floor_id": f"{b_id}-F{i:02d}",
                "ulpin": f"{b_ulpin}-F{i:02d}",
                "level": i,
                "label": f"Floor {i}" if i > 1 else "Ground Floor (G)",
                "z_min": z_min,
                "z_max": z_max,
                "height_m": fl_height,
                "area_m2": area_m2,
                "volume_m3": vol,
                "generation_method": generation_method,
                "certainty_tier": certainty_tier
            })

        # STEP 5: Evidence Record Output
        return {
            "building_id": b_id,
            "ulpin": b_ulpin,
            "building_name": building.get("name", "Unknown Building"),
            "floor_count_osm": floor_count_osm,
            "floor_count_height_estimate": floor_count_height_estimate,
            "final_floor_count": final_floor_count,
            "building_height_m": height_m,
            "typical_floor_height_assumed_m": typical_floor_height_m,
            "average_floor_height_m": implied_avg_height,
            "agreement_status": agreement_status,
            "confidence_tier": confidence_tier,
            "generation_method": generation_method,
            "certainty_tier": certainty_tier,
            "review_required": review_required,
            "plausible_height_range_m": [PLAUSIBLE_FLOOR_HEIGHT_MIN_M, PLAUSIBLE_FLOOR_HEIGHT_MAX_M],
            "override_applied": override_floor_count is not None,
            "override_reason": override_reason,
            "override_user": override_user,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "generated_floors": floors_list
        }


class VitCampusService:
    def __init__(self):
        self.geojson_data: Dict[str, Any] = {}
        self.routes_data: Dict[str, Any] = {}
        self.buildings_by_id: Dict[str, Any] = {}
        self.overrides: Dict[str, Dict[str, Any]] = {}
        self.load_data()

    def load_data(self):
        if FOOTPRINTS_PATH.exists():
            with open(FOOTPRINTS_PATH, "r", encoding="utf-8") as f:
                self.geojson_data = json.load(f)
                for feat in self.geojson_data.get("features", []):
                    props = feat.get("properties", {})
                    b_id = props.get("building_id")
                    if b_id:
                        self.buildings_by_id[b_id] = {
                            **props,
                            "geometry": feat.get("geometry")
                        }

        if ROUTES_PATH.exists():
            with open(ROUTES_PATH, "r", encoding="utf-8") as f:
                self.routes_data = json.load(f)

    def get_all_buildings(self) -> List[Dict[str, Any]]:
        self.load_data()
        result = []
        for b in self.buildings_by_id.values():
            reconciliation = self.get_building_reconciliation(b.get("building_id"))
            result.append(sanitize_val({
                **b,
                "reconciliation": reconciliation
            }))
        return result

    def get_building_by_id(self, building_id: str) -> Optional[Dict[str, Any]]:
        self.load_data()
        b = self.buildings_by_id.get(building_id.upper()) or self.buildings_by_id.get(building_id)
        if not b:
            return None
        reconciliation = self.get_building_reconciliation(b.get("building_id"))
        return sanitize_val({
            **b,
            "reconciliation": reconciliation
        })

    def get_building_reconciliation(
        self,
        building_id: str,
        typical_floor_height_m: float = DEFAULT_TYPICAL_FLOOR_HEIGHT_M
    ) -> Optional[Dict[str, Any]]:
        b = self.buildings_by_id.get(building_id.upper()) or self.buildings_by_id.get(building_id)
        if not b:
            return None
        
        override = self.overrides.get(building_id.upper()) or self.overrides.get(building_id)
        override_val = override.get("override_floor_count") if override else None
        override_reason = override.get("reason") if override else None
        override_user = override.get("user") if override else None

        rec = FloorCountReconciliationService.reconcile(
            building=b,
            typical_floor_height_m=typical_floor_height_m,
            override_floor_count=override_val,
            override_reason=override_reason,
            override_user=override_user
        )
        return sanitize_val(rec)

    def set_building_floor_override(
        self,
        building_id: str,
        override_floor_count: int,
        reason: str = "Officer survey verification",
        user: str = "GIS Surveyor Officer"
    ) -> Optional[Dict[str, Any]]:
        b_key = building_id.upper()
        if b_key not in self.buildings_by_id and building_id not in self.buildings_by_id:
            return None
        
        actual_key = b_key if b_key in self.buildings_by_id else building_id
        self.overrides[actual_key] = {
            "override_floor_count": override_floor_count,
            "reason": reason,
            "user": user,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        return self.get_building_reconciliation(actual_key)

    def get_geojson(self) -> Dict[str, Any]:
        return sanitize_val(self.geojson_data)

    def get_routes(self) -> Dict[str, Any]:
        return sanitize_val(self.routes_data)

    def get_campus_summary(self) -> Dict[str, Any]:
        total_area = sum(b.get("area_m2", 0) for b in self.buildings_by_id.values())
        return sanitize_val({
            "campus_name": "Vellore Institute of Technology (VIT Vellore)",
            "location": "Vellore, Tamil Nadu, India",
            "center_coordinates": {
                "latitude": 12.9692,
                "longitude": 79.1560,
                "crs": "EPSG:4326"
            },
            "projected_crs": "EPSG:32644 (UTM Zone 44N)",
            "total_buildings_mapped": len(self.buildings_by_id),
            "total_footprint_area_m2": round(total_area, 2),
            "phase": "PHASE 1 — REAL 3D CAMPUS & ROUTES MAPPING"
        })

    def get_verification_queue(self) -> List[Dict[str, Any]]:
        queue = []
        for b in self.buildings_by_id.values():
            rec = self.get_building_reconciliation(b.get("building_id"))
            if rec:
                queue.append({
                    "building_id": rec["building_id"],
                    "name": rec["building_name"],
                    "osm_floor_count": rec["floor_count_osm"],
                    "height_derived_floor_count": rec["floor_count_height_estimate"],
                    "verified_floor_count": b.get("verified_floor_count"),
                    "final_floor_count": rec["final_floor_count"],
                    "agreement_status": rec["agreement_status"],
                    "verification_status": b.get("verification_status", "UNVERIFIED" if rec["review_required"] else "VERIFIED"),
                    "review_required": rec["review_required"],
                    "certainty": b.get("certainty", "OBSERVED_SOURCE")
                })
        return sanitize_val(queue)

vit_service = VitCampusService()


