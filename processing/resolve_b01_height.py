import json
import math
from pathlib import Path
import geopandas as gpd
import requests
import pandas as pd

# -------------------------------------------------------------
# File Paths
# -------------------------------------------------------------
MATCHED_PATH = Path("data/reconciliation/matched_buildings.geojson")
RAW_MS_PATH = Path("data/raw/microsoft/microsoft_buildings.geojson")
RAW_OSM_PATH = Path("data/raw/osm/osm_buildings.geojson")

OUT_DIR = Path("data/b01")
OUT_DIR.mkdir(parents=True, exist_ok=True)

FLOOR_HEIGHT_STANDARD_M = 3.0  # Indian NBC / CMDA standard for residential apartments

def fetch_ground_elevation(lat, lon):
    """
    Queries open digital elevation model (DEM) service for ground elevation (AMSL).
    Falls back gracefully to Kolathur regional baseline (~9.0m) if offline/timed out.
    """
    # 1. Try Open-Meteo Elevation API (Copernicus 30m / SRTM)
    try:
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat:.6f}&longitude={lon:.6f}"
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            elev = res.json().get("elevation", [None])[0]
            if elev is not None:
                return float(elev), "Open-Meteo DEM (Copernicus/SRTM 30m)"
    except Exception as e:
        print(f"Open-Meteo DEM query notice: {e}")

    # 2. Try Open-Elevation API
    try:
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat:.6f},{lon:.6f}"
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            results = res.json().get("results", [])
            if results and "elevation" in results[0]:
                return float(results[0]["elevation"]), "Open-Elevation API (SRTM 90m)"
    except Exception as e:
        print(f"Open-Elevation query notice: {e}")

    # 3. Regional fallback for Kolathur / North Chennai coastal plain
    return 9.0, "Regional DEM Baseline (Kolathur Coastal Plain ~9.0m AMSL)"

def resolve_b01():
    print("=== Step 4: Height + Ground Elevation Resolution for B01 ===")
    
    # 1. Find B01 in matched dataset
    matched_gdf = gpd.read_file(MATCHED_PATH)
    b01_matches = matched_gdf[(matched_gdf["ms_id"] == "MS_00804") | (matched_gdf["osm_id"] == "way/354496166")]

    if b01_matches.empty:
        raise ValueError("Could not find B01 (MS_00804 / way/354496166) in matched_buildings.geojson")

    b01 = b01_matches.iloc[0]
    
    # Extract attributes
    ms_id = b01.get("ms_id", "MS_00804")
    osm_id = b01.get("osm_id", "way/354496166")
    osm_name = b01.get("osm_name", "Soorya Apartments")
    osm_levels_raw = b01.get("osm_levels", "4")
    osm_height_raw = b01.get("osm_height")
    osm_type = b01.get("osm_type", "apartments")
    ms_conf = b01.get("ms_confidence", -1.0)
    match_iou = b01.get("match_iou", 0.575)
    match_class = b01.get("match_class", "POSSIBLE")
    footprint_area_m2 = b01.get("area_m2", 354.95)

    # 2. Check Raw MS dataset for MS height
    raw_ms = gpd.read_file(RAW_MS_PATH)
    # Check by geometry intersection or ID index
    ms_height_val = None
    if "height" in raw_ms.columns:
        ms_idx = int(ms_id.replace("MS_", "")) - 1 if "MS_" in str(ms_id) else None
        if ms_idx is not None and 0 <= ms_idx < len(raw_ms):
            h_raw = raw_ms.iloc[ms_idx].get("height")
            if pd.notna(h_raw) and float(h_raw) > 0:
                ms_height_val = float(h_raw)

    # 3. Resolve Building Height
    resolved_height = None
    height_source = None

    # Priority A: Explicit OSM height tag
    if pd.notna(osm_height_raw) and osm_height_raw not in (None, "", "null", "nan"):
        try:
            # Handle possible 'm' unit suffix
            val_clean = str(osm_height_raw).lower().replace("m", "").strip()
            resolved_height = float(val_clean)
            height_source = "OSM Tag (explicit height)"
        except ValueError:
            pass

    # Priority B: Microsoft ML height estimate
    if resolved_height is None and ms_height_val is not None and ms_height_val > 0:
        resolved_height = float(ms_height_val)
        height_source = "Microsoft ML Height Estimate"

    # Priority C: OSM levels multiplied by National Building Code (NBC) floor height
    if resolved_height is None:
        try:
            levels_num = int(float(osm_levels_raw))
        except (ValueError, TypeError):
            levels_num = 4
        
        resolved_height = levels_num * FLOOR_HEIGHT_STANDARD_M
        height_source = f"OSM levels ({levels_num}) × NBC Residential Standard ({FLOOR_HEIGHT_STANDARD_M}m/floor)"

    # 4. Resolve Ground Elevation (Z-min)
    centroid = b01.geometry.centroid
    lon, lat = centroid.x, centroid.y
    ground_elevation, dem_source = fetch_ground_elevation(lat, lon)

    # Calculate Z-min and Z-max
    z_min = round(ground_elevation, 2)
    building_h = round(resolved_height, 2)
    z_max = round(z_min + building_h, 2)

    # Floor by floor height distribution
    num_floors = int(float(osm_levels_raw)) if osm_levels_raw else 4
    floor_breakdown = []
    for f in range(1, num_floors + 1):
        f_zmin = round(z_min + (f - 1) * FLOOR_HEIGHT_STANDARD_M, 2)
        f_zmax = round(z_min + f * FLOOR_HEIGHT_STANDARD_M, 2)
        floor_breakdown.append({
            "floor_number": f,
            "floor_label": f"Floor {f:02d} (Level {f})",
            "z_min_m": f_zmin,
            "z_max_m": f_zmax,
            "height_m": FLOOR_HEIGHT_STANDARD_M,
            "sample_units": [f"U{f}01", f"U{f}02", f"U{f}03", f"U{f}04"]
        })

    # 5. Build Resolved B01 Data Structure
    b01_resolved = {
        "building_id": "B01",
        "name": str(osm_name) if pd.notna(osm_name) else "Soorya Apartments",
        "type": str(osm_type),
        "identifiers": {
            "osm_id": str(osm_id),
            "microsoft_id": str(ms_id)
        },
        "reconciliation": {
            "iou": float(match_iou),
            "match_classification": str(match_class),
            "note": "POSSIBLE cross-source spatial alignment; 4 levels derived from OSM attribute"
        },
        "spatial": {
            "centroid": {
                "longitude": round(lon, 7),
                "latitude": round(lat, 7)
            },
            "footprint_area_m2": float(footprint_area_m2),
            "crs_geographic": "EPSG:4326",
            "crs_projected": "EPSG:32644"
        },
        "vertical_datum": {
            "ground_elevation_zmin_m": z_min,
            "building_height_m": building_h,
            "roof_elevation_zmax_m": z_max,
            "dem_source": dem_source,
            "height_source": height_source,
            "floor_height_m": FLOOR_HEIGHT_STANDARD_M,
            "total_levels": num_floors
        },
        "floors": floor_breakdown
    }

    # Save resolved JSON metadata
    resolved_json_path = OUT_DIR / "b01_resolved.json"
    with open(resolved_json_path, "w", encoding="utf-8") as f:
        json.dump(b01_resolved, f, indent=2)
    print(f"Saved: {resolved_json_path}")

    # Save 2D footprint with 3D attributes in GeoJSON
    b01_feature = {
        "type": "Feature",
        "properties": {
            "id": "B01",
            "name": b01_resolved["name"],
            "osm_id": str(osm_id),
            "ms_id": str(ms_id),
            "levels": num_floors,
            "z_min": z_min,
            "z_max": z_max,
            "height": building_h,
            "footprint_area_m2": float(footprint_area_m2),
            "iou": float(match_iou),
            "match_class": str(match_class)
        },
        "geometry": b01.geometry.__geo_interface__
    }

    b01_fc = {
        "type": "FeatureCollection",
        "name": "B01_Footprint_3D_Attributed",
        "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
        "features": [b01_feature]
    }

    b01_geojson_path = OUT_DIR / "b01_footprint.geojson"
    with open(b01_geojson_path, "w", encoding="utf-8") as f:
        json.dump(b01_fc, f, indent=2)
    print(f"Saved: {b01_geojson_path}")

    # 6. Print Formatted B01 Height Report
    print("\n" + "=" * 50)
    print("B01 HEIGHT & ELEVATION RESOLUTION REPORT")
    print("=" * 50)
    print(f"Building:                 {b01_resolved['name']}")
    print(f"OSM ID:                   {osm_id}")
    print(f"Microsoft ID:             {ms_id}")
    print(f"Match Classification:     {match_class} (IoU = {match_iou:.3f})")
    print(f"Footprint Area:           {footprint_area_m2:.2f} m²")
    print(f"OSM levels:               {num_floors}")
    print(f"OSM height:               {osm_height_raw if pd.notna(osm_height_raw) else 'null'}")
    print(f"Microsoft height:         {ms_height_val if ms_height_val is not None else 'null (ML detection only)'}")
    print("-" * 50)
    print(f"Ground elevation (Z-min): {z_min:.2f} m AMSL")
    print(f"Resolved building height: {building_h:.2f} m")
    print(f"Roof elevation (Z-max):   {z_max:.2f} m AMSL")
    print(f"Elevation Source:         {dem_source}")
    print(f"Height Source:            {height_source}")
    print("=" * 50)

if __name__ == "__main__":
    resolve_b01()
