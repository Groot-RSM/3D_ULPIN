import os
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_KEY", "")

supabase_client = None

def get_supabase_client():
    global supabase_client
    if supabase_client is not None:
        return supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        return None

    try:
        from supabase import create_client, Client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"Connected to Supabase at {SUPABASE_URL}")
        return supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None

def is_supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)

def fetch_buildings_from_supabase() -> Optional[List[Dict[str, Any]]]:
    """
    Fetch compact building records from Supabase and dynamically reconstruct
    the standard 3D ULPIN building object structure.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # Query buildings with parent parcel information
        res = client.table("buildings").select("*, parcels(*)").order("building_no").execute()
        if not res.data:
            return []

        buildings = []
        for row in res.data:
            parcel = row.get("parcels") or {}
            footprint_geom = row.get("footprint_geojson") or {}

            # Construct standardized building object
            b_obj = {
                "building_id": row["building_code"],
                "name": row["building_name"],
                "building_type": row.get("building_type", "EDUCATIONAL_ACADEMIC"),
                "centroid_lat": float(row["centroid_lat"]),
                "centroid_lon": float(row["centroid_lon"]),
                "area_m2": float(row["area_m2"]),
                "height_m": float(row["total_height_m"]),
                "verified_floor_count": int(row["total_floors"]),
                "final_floor_count": int(row["total_floors"]),
                "units_per_floor": int(row["units_per_floor"]),
                "floor_height": float(row["floor_height"]),
                "geometry": footprint_geom,
                "source": row.get("source", "OpenStreetMap / Survey"),
                "source_id": row.get("source_building_id", row["building_code"]),
                "verification_status": row.get("verification_status", "VERIFIED"),
                "certainty": row.get("confidence_tier", "HIGH"),
                "unit_configuration_source": row.get("unit_configuration_source", "DERIVED"),
                "ulpin": parcel.get("official_ulpin") or f"P-VIT-{row['building_code']}",
                "parcel_id": parcel.get("parcel_id", "P-VIT-001"),
                "reconciliation": {
                    "final_floor_count": int(row["total_floors"]),
                    "agreement_status": row.get("verification_status", "VERIFIED"),
                    "confidence_tier": row.get("confidence_tier", "HIGH"),
                    "floor_count_height_estimate": int(round(float(row["total_height_m"]) / float(row["floor_height"]))),
                    "review_required": False
                }
            }
            buildings.append(b_obj)

        return buildings
    except Exception as e:
        logger.error(f"Error querying Supabase buildings: {e}")
        return None

def update_building_floor_override(building_code: str, new_floors: int, reason: str = ""):
    """
    Update floor count on Supabase building record.
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        client.table("buildings").update({
            "total_floors": new_floors,
            "verification_status": "SURVEYOR_OVERRIDE",
            "unit_configuration_source": "SURVEYOR_OVERRIDE"
        }).eq("building_code", building_code).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to update building on Supabase: {e}")
        return False
