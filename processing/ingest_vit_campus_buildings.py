import json
import math
from pathlib import Path
import geopandas as gpd
import pandas as pd
from shapely.geometry import shape, mapping
from datetime import datetime

# -------------------------------------------------------------
# Configuration & Coordinate Systems
# -------------------------------------------------------------
INPUT_GEOJSON = Path("data/vit_vellore/campus_footprints.geojson")
OUTPUT_GEOJSON = Path("data/vit_vellore/campus_footprints.geojson")
PROJECTED_CRS = "EPSG:32644"  # UTM Zone 44N (Vellore/Chennai metric CRS)
GEOGRAPHIC_CRS = "EPSG:4326"

# Floor evidence priority hierarchy map (lower number = higher priority)
FLOOR_PRIORITY = {
    "OFFICIAL_VIT_RECORD": 1,
    "VERIFIED_FIELD_SURVEY": 2,
    "BIM": 3,
    "VERIFIED_FLOOR_PLAN": 4,
    "FACADE_LIDAR": 5,
    "OSM_BUILDING_LEVELS": 6,
    "HEIGHT_BASED_ESTIMATE": 7
}

def reconcile_building_floors(props, height_m):
    """
    Apply floor evidence priority hierarchy without discarding OSM raw evidence.
    """
    osm_floors = props.get("osm_floor_count")
    verified_floors = props.get("verified_floor_count")
    
    # Calculate height-based estimate (assuming 4.0m typical floor height for academic blocks)
    typical_floor_h = 4.0
    height_derived_floors = max(1, int(round(height_m / typical_floor_h))) if height_m > 0 else None
    
    final_count = None
    source_used = "HEIGHT_BASED_ESTIMATE"
    verification_status = "UNVERIFIED"
    agreement_status = "UNVERIFIED"
    review_required = False
    
    if verified_floors is not None and verified_floors > 0:
        final_count = verified_floors
        source_used = "VERIFIED_FIELD_SURVEY"
        verification_status = "VERIFIED"
        agreement_status = "VERIFIED_RECORD"
        review_required = False
    elif osm_floors is not None and osm_floors > 0:
        final_count = osm_floors
        source_used = "OSM_BUILDING_LEVELS"
        verification_status = "UNVERIFIED"
        
        if height_derived_floors:
            diff = abs(osm_floors - height_derived_floors)
            if diff == 0:
                agreement_status = "EXACT"
                review_required = False
            elif diff <= 1:
                agreement_status = "MINOR_DISCREPANCY"
                review_required = True
            else:
                agreement_status = "SOURCE_CONFLICT"
                review_required = True
        else:
            agreement_status = "OSM_ONLY"
            review_required = True
    elif height_derived_floors:
        final_count = height_derived_floors
        source_used = "HEIGHT_BASED_ESTIMATE"
        verification_status = "UNVERIFIED"
        agreement_status = "HEIGHT_ESTIMATE_ONLY"
        review_required = True
    else:
        final_count = 1
        source_used = "DEFAULT_SINGLE_FLOOR"
        verification_status = "UNVERIFIED"
        agreement_status = "UNKNOWN"
        review_required = True
        
    return {
        "osm_floor_count": osm_floors,
        "height_derived_floor_count": height_derived_floors,
        "verified_floor_count": verified_floors,
        "final_floor_count": final_count,
        "floor_count_source": source_used,
        "agreement_status": agreement_status,
        "review_required": review_required,
        "verification_status": verification_status
    }

def run_ingestion():
    print("=== Processing VIT Vellore Campus Building Footprints ===")
    if not INPUT_GEOJSON.exists():
        print(f"Error: {INPUT_GEOJSON} does not exist.")
        return

    print(f"Loading raw footprints from {INPUT_GEOJSON}...")
    gdf = gpd.read_file(INPUT_GEOJSON)
    print(f"Loaded {len(gdf)} building features.")

    # 1. Reproject to metric projected CRS (EPSG:32644) for precise area calculation
    print(f"Reprojecting geometries to projected CRS ({PROJECTED_CRS})...")
    gdf_proj = gdf.to_crs(PROJECTED_CRS)

    # 2. Audit geometries, compute metric area & geographic centroid
    updated_features = []
    seen_ids = set()

    for i, row in gdf.iterrows():
        b_id = row.get("building_id") or f"VIT-B{i+1:03d}"
        if b_id in seen_ids:
            b_id = f"VIT-B{i+1:03d}"
        seen_ids.add(b_id)

        geom_geo = row.geometry
        geom_proj = gdf_proj.iloc[i].geometry

        # Calculate exact metric area in projected CRS
        metric_area = round(float(geom_proj.area), 1)

        # Calculate exact centroid in geographic CRS
        centroid_lon = round(float(geom_geo.centroid.x), 6)
        centroid_lat = round(float(geom_geo.centroid.y), 6)

        height_m = float(row.get("height_m", 15.0))
        
        # Run floor reconciliation logic
        floor_eval = reconcile_building_floors(row, height_m)

        b_ulpin = f"ULPIN-IN-TN-VEL-{b_id}"

        props = {
            "building_id": str(b_id),
            "ulpin": b_ulpin,
            "name": str(row.get("name", f"Building {b_id}")),
            "name_confirmed": bool(row.get("name_confirmed", True)),
            "centroid_lat": centroid_lat,
            "centroid_lon": centroid_lon,
            "area_m2": metric_area,
            "height_m": height_m,
            "height_source": str(row.get("height_source", "ESTIMATED_SURVEY")),
            "osm_id": str(row.get("osm_id", row.get("source_id", f"osm_{b_id.lower()}"))),
            "osm_floor_count": floor_eval["osm_floor_count"],
            "height_derived_floor_count": floor_eval["height_derived_floor_count"],
            "verified_floor_count": floor_eval["verified_floor_count"],
            "final_floor_count": floor_eval["final_floor_count"],
            "floor_count_source": floor_eval["floor_count_source"],
            "agreement_status": floor_eval["agreement_status"],
            "review_required": floor_eval["review_required"],
            "verification_status": floor_eval["verification_status"],
            "certainty": str(row.get("certainty", "OBSERVED_SOURCE")),
            "source": str(row.get("source", "OpenStreetMap / Field Survey")),
            "source_id": str(row.get("source_id", f"osm_{b_id.lower()}")),
            "status": "READY FOR EXTRUSION",
            "last_updated": datetime.utcnow().isoformat() + "Z"
        }

        updated_features.append({
            "type": "Feature",
            "properties": props,
            "geometry": mapping(geom_geo)
        })

    output_geojson_data = {
        "type": "FeatureCollection",
        "name": "VIT_Vellore_Audited_Building_Footprints",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
            }
        },
        "features": updated_features
    }

    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(output_geojson_data, f, indent=2)

    print(f"Successfully processed & saved {len(updated_features)} audited building footprints to {OUTPUT_GEOJSON}")

if __name__ == "__main__":
    run_ingestion()
