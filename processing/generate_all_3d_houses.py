import json
import math
from pathlib import Path
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.strtree import STRtree

def generate_all_3d_houses_and_buildings():
    campus_path = Path("data/vit_vellore/campus_footprints.geojson")
    osm_path = Path("data/raw/osm/osm_buildings.geojson")
    ms_path = Path("data/raw/microsoft/microsoft_buildings.geojson")
    output_path = Path("data/vit_vellore/all_houses_footprints.geojson")
    campus_updated_path = Path("data/vit_vellore/campus_footprints.geojson")

    # 1. Load Campus Landmarks
    campus_features = []
    if campus_path.exists():
        with open(campus_path, "r", encoding="utf-8") as f:
            campus_data = json.load(f)
            campus_features = campus_data.get("features", [])

    campus_shapes = [shape(f["geometry"]) for f in campus_features if f.get("geometry")]
    
    # 2. Load OSM Buildings/Houses
    osm_features = []
    if osm_path.exists():
        with open(osm_path, "r", encoding="utf-8") as f:
            osm_data = json.load(f)
            osm_features = osm_data.get("features", [])

    # 3. Load Microsoft Buildings
    ms_features = []
    if ms_path.exists():
        with open(ms_path, "r", encoding="utf-8") as f:
            ms_data = json.load(f)
            ms_features = ms_data.get("features", [])

    all_known_shapes = list(campus_shapes)
    osm_valid_features = []
    for f in osm_features:
        if not f.get("geometry"):
            continue
        try:
            s = shape(f["geometry"])
            if s.is_valid and s.area > 0:
                osm_valid_features.append((f, s))
                all_known_shapes.append(s)
        except Exception:
            pass

    tree = STRtree(all_known_shapes)

    # Filter non-overlapping Microsoft features
    ms_valid_features = []
    for f in ms_features:
        if not f.get("geometry"):
            continue
        try:
            s = shape(f["geometry"])
            if not s.is_valid or s.area <= 0:
                continue
            candidates = tree.query(s)
            has_overlap = False
            for idx in candidates:
                other = all_known_shapes[idx]
                if s.intersects(other):
                    inter = s.intersection(other).area
                    if inter / s.area > 0.35:
                        has_overlap = True
                        break
            if not has_overlap:
                ms_valid_features.append((f, s))
        except Exception:
            pass

    print(f"Loaded: {len(campus_features)} Campus Landmarks, {len(osm_valid_features)} OSM Houses, {len(ms_valid_features)} MS Houses")

    final_features = []
    house_idx = 1

    # Add Campus Landmarks first
    for f in campus_features:
        props = dict(f.get("properties", {}))
        geom = f.get("geometry")
        s = shape(geom)
        b_id = props.get("building_id", f"VIT-B{house_idx:03d}")
        height_m = float(props.get("height_m") or 24.0)
        floors = int(props.get("verified_floor_count") or props.get("final_floor_count") or max(1, round(height_m / 4.0)))
        bounds = s.bounds  # minx, miny, maxx, maxy
        area_m2 = float(props.get("area_m2") or (s.area * 111320 * 111320 * 0.95))
        
        enriched_props = {
            **props,
            "building_id": b_id,
            "ulpin": props.get("ulpin") or f"ULPIN-IN-TN-VEL-{b_id}",
            "name": props.get("name") or f"Campus Block {b_id}",
            "type": props.get("type") or "academic",
            "category": "Campus Landmark",
            "is_house": False,
            "height_m": round(height_m, 2),
            "verified_floor_count": floors,
            "final_floor_count": floors,
            "area_m2": round(area_m2, 2),
            "volume_m3": round(area_m2 * height_m, 2),
            "centroid_lon": round(s.centroid.x, 6),
            "centroid_lat": round(s.centroid.y, 6),
            "bbox_3d": [round(bounds[0], 6), round(bounds[1], 6), 0.0, round(bounds[2], 6), round(bounds[3], 6), round(height_m, 2)],
            "certainty": props.get("certainty", "VERIFIED")
        }
        final_features.append({
            "type": "Feature",
            "id": b_id,
            "properties": enriched_props,
            "geometry": geom
        })

    # Add OSM Houses
    for f, s in osm_valid_features:
        props = f.get("properties", {})
        b_id = f"HOUSE-OSM-{house_idx:04d}"
        bounds = s.bounds
        area_m2 = s.area * 111320 * 111320 * 0.95
        if area_m2 < 15.0:
            continue

        # Determine realistic residential floor count & height
        raw_levels = props.get("levels") or props.get("building:levels")
        if raw_levels and str(raw_levels).isdigit() and int(raw_levels) > 0:
            floors = int(raw_levels)
            height_m = floors * 3.5
        elif area_m2 > 500:
            floors = 3
            height_m = 10.5
        elif area_m2 > 180:
            floors = 2
            height_m = 7.2
        else:
            floors = 1 if area_m2 < 70 else 2
            height_m = 4.0 if floors == 1 else 6.8

        raw_height = props.get("height")
        if raw_height:
            try:
                h_val = float(str(raw_height).replace("m", "").strip())
                if 2.5 <= h_val <= 60.0:
                    height_m = h_val
                    floors = max(1, round(height_m / 3.5))
            except ValueError:
                pass

        name = props.get("name")
        if not name:
            if area_m2 > 400:
                name = f"Residential Complex #{house_idx}"
            elif area_m2 > 160:
                name = f"Independent House #{house_idx}"
            else:
                name = f"Residential Unit #{house_idx}"

        category = "Residential House"
        if "apartments" in str(props.get("type", "")).lower() or area_m2 > 500:
            category = "Apartment Block"
        elif "commercial" in str(props.get("type", "")).lower():
            category = "Commercial Property"

        ulpin = f"ULPIN-IN-TN-VEL-H{house_idx:04d}"
        enriched_props = {
            "building_id": b_id,
            "ulpin": ulpin,
            "name": name,
            "type": "house",
            "category": category,
            "is_house": True,
            "height_m": round(height_m, 2),
            "verified_floor_count": floors,
            "final_floor_count": floors,
            "area_m2": round(area_m2, 2),
            "volume_m3": round(area_m2 * height_m, 2),
            "centroid_lon": round(s.centroid.x, 6),
            "centroid_lat": round(s.centroid.y, 6),
            "bbox_3d": [round(bounds[0], 6), round(bounds[1], 6), 0.0, round(bounds[2], 6), round(bounds[3], 6), round(height_m, 2)],
            "osm_id": props.get("osm_id"),
            "certainty": "OSM_SATELLITE_VERIFIED"
        }

        final_features.append({
            "type": "Feature",
            "id": b_id,
            "properties": enriched_props,
            "geometry": f.get("geometry")
        })
        house_idx += 1

    # Add Microsoft ML Houses
    for f, s in ms_valid_features:
        props = f.get("properties", {})
        b_id = f"HOUSE-MS-{house_idx:04d}"
        bounds = s.bounds
        area_m2 = s.area * 111320 * 111320 * 0.95
        if area_m2 < 15.0:
            continue

        if area_m2 > 450:
            floors = 3
            height_m = 10.0
        elif area_m2 > 160:
            floors = 2
            height_m = 7.0
        else:
            floors = 1 if area_m2 < 75 else 2
            height_m = 4.0 if floors == 1 else 6.5

        name = f"Vellore House #{house_idx}"
        ulpin = f"ULPIN-IN-TN-VEL-H{house_idx:04d}"
        enriched_props = {
            "building_id": b_id,
            "ulpin": ulpin,
            "name": name,
            "type": "house",
            "category": "Residential House (ML Detected)",
            "is_house": True,
            "height_m": round(height_m, 2),
            "verified_floor_count": floors,
            "final_floor_count": floors,
            "area_m2": round(area_m2, 2),
            "volume_m3": round(area_m2 * height_m, 2),
            "centroid_lon": round(s.centroid.x, 6),
            "centroid_lat": round(s.centroid.y, 6),
            "bbox_3d": [round(bounds[0], 6), round(bounds[1], 6), 0.0, round(bounds[2], 6), round(bounds[3], 6), round(height_m, 2)],
            "certainty": "AI_ML_SATELLITE_EXTRACTED"
        }

        final_features.append({
            "type": "Feature",
            "id": b_id,
            "properties": enriched_props,
            "geometry": f.get("geometry")
        })
        house_idx += 1

    out_fc = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": final_features
    }

    # Save to both all_houses_footprints.geojson and campus_footprints.geojson
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_fc, f, indent=2)
    print(f"Saved {len(final_features)} 3D houses & buildings to {output_path}")

    with open(campus_updated_path, "w", encoding="utf-8") as f:
        json.dump(out_fc, f, indent=2)
    print(f"Updated {campus_updated_path} with all {len(final_features)} 3D entities!")

if __name__ == "__main__":
    generate_all_3d_houses_and_buildings()
