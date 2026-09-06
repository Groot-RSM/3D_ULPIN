import json
from pathlib import Path
import geopandas as gpd
import numpy as np
import trimesh
from shapely.geometry import Polygon

# -------------------------------------------------------------
# Configuration & Paths
# -------------------------------------------------------------
FOOTPRINT_GEOJSON = Path("data/b01/b01_footprint.geojson")
RESOLVED_JSON = Path("data/b01/b01_resolved.json")
OUT_DIR = Path("data/b01")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROJECTED_CRS = "EPSG:32644"  # WGS 84 / UTM Zone 44N (Chennai metric)

def reconstruct_b01_3d():
    print("=== Step 5: 3D Reconstruction of B01 ===")

    # 1. Load 2D Footprint & Metadata
    if not FOOTPRINT_GEOJSON.exists() or not RESOLVED_JSON.exists():
        raise FileNotFoundError("Prerequisite files from Step 4 not found.")

    with open(RESOLVED_JSON, "r", encoding="utf-8") as f:
        resolved_meta = json.load(f)

    gdf_4326 = gpd.read_file(FOOTPRINT_GEOJSON)
    if gdf_4326.empty:
        raise ValueError("Footprint GeoJSON is empty.")

    # 2. Reproject Footprint to EPSG:32644 (UTM 44N)
    print(f"Reprojecting B01 footprint from EPSG:4326 to {PROJECTED_CRS}...")
    gdf_proj = gdf_4326.to_crs(PROJECTED_CRS)
    poly_proj = gdf_proj.geometry.iloc[0]

    if not poly_proj.is_valid:
        poly_proj = poly_proj.buffer(0)

    footprint_area = float(poly_proj.area)
    print(f"Projected Footprint Area: {footprint_area:.2f} m²")

    # 3. Read Vertical Parameters
    v_datum = resolved_meta.get("vertical_datum", {})
    z_min = float(v_datum.get("ground_elevation_zmin_m", 15.0))
    z_max = float(v_datum.get("roof_elevation_zmax_m", 27.0))
    height_m = float(v_datum.get("building_height_m", 12.0))
    levels = int(v_datum.get("total_levels", 4))
    floor_height_m = float(v_datum.get("floor_height_m", 3.0))

    expected_volume = footprint_area * height_m

    # 4. Construct 3D Mesh using Extrusion
    print(f"Extruding polygon vertically from Z={z_min:.2f}m to Z={z_max:.2f}m (Height={height_m:.2f}m)...")
    
    # trimesh.creation.extrude_polygon creates a solid mesh from z=0 to z=height
    mesh = trimesh.creation.extrude_polygon(poly_proj, height=height_m)
    
    # Translate mesh along Z axis to ground elevation
    mesh.apply_translation([0, 0, z_min])
    
    # Fix normals to ensure outward orientation
    mesh.fix_normals()

    # 5. Validate 3D Geometry
    is_watertight = bool(mesh.is_watertight)
    is_valid = bool(mesh.is_volume and is_watertight)
    computed_volume = float(mesh.volume)
    surface_area = float(mesh.area)
    num_vertices = len(mesh.vertices)
    num_faces = len(mesh.faces)
    bounds = mesh.bounds  # [[minx, miny, minz], [maxx, maxy, maxz]]

    vol_diff = abs(computed_volume - expected_volume)
    vol_accuracy_pct = (1.0 - (vol_diff / expected_volume)) * 100.0

    # 6. Export Deliverables
    obj_path = OUT_DIR / "b01_building.obj"
    glb_path = OUT_DIR / "b01_building.glb"
    meta_path = OUT_DIR / "b01_3d_metadata.json"

    # Export Wavefront OBJ
    mesh.export(obj_path, file_type="obj")
    print(f"Exported OBJ: {obj_path} ({obj_path.stat().st_size / 1024:.1f} KB)")

    # Export GLB (binary glTF)
    mesh.export(glb_path, file_type="glb")
    print(f"Exported GLB: {glb_path} ({glb_path.stat().st_size / 1024:.1f} KB)")

    # Build 3D Metadata JSON
    b01_3d_metadata = {
        "building_id": "B01",
        "name": resolved_meta.get("name", "Soorya Apartments"),
        "osm_id": resolved_meta.get("identifiers", {}).get("osm_id", "way/354496166"),
        "microsoft_id": resolved_meta.get("identifiers", {}).get("microsoft_id", "MS_00804"),
        "crs": PROJECTED_CRS,
        "crs_geographic": "EPSG:4326",
        "footprint_area_m2": round(footprint_area, 2),
        "z_min_m": z_min,
        "z_max_m": z_max,
        "height_m": height_m,
        "levels": levels,
        "floor_height_m": floor_height_m,
        "expected_volume_m3": round(expected_volume, 2),
        "computed_volume_m3": round(computed_volume, 2),
        "surface_area_m2": round(surface_area, 2),
        "volume_accuracy_percentage": round(vol_accuracy_pct, 4),
        "mesh_stats": {
            "vertices_count": num_vertices,
            "faces_count": num_faces,
            "is_watertight": is_watertight,
            "is_valid_volume": is_valid,
            "bounding_box_utm44n": {
                "min": [round(float(b), 3) for b in bounds[0]],
                "max": [round(float(b), 3) for b in bounds[1]]
            }
        },
        "geometry_type": "vertical_extrusion",
        "height_source": v_datum.get("height_source", "OSM levels × 3.0 m/floor"),
        "elevation_source": v_datum.get("dem_source", "Open-Meteo DEM"),
        "status": "3d_reconstruction_complete"
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(b01_3d_metadata, f, indent=2)
    print(f"Exported Metadata: {meta_path}")

    # 7. Print Success Report
    print("\n" + "=" * 60)
    print("STEP 5 -- B01 3D RECONSTRUCTION")
    print("=" * 60)
    print(f"Building:             {b01_3d_metadata['name']}")
    print(f"Building ID:          {b01_3d_metadata['building_id']}")
    print(f"\nFootprint area:       {footprint_area:.2f} m2")
    print(f"\nZ-min:                {z_min:.2f} m AMSL")
    print(f"Z-max:                {z_max:.2f} m AMSL")
    print(f"Height:               {height_m:.2f} m")
    print(f"\nLevels:               {levels}")
    print(f"Floor height:         {floor_height_m:.2f} m")
    print(f"\nExpected volume:      {expected_volume:.2f} m3")
    print(f"Computed volume:      {computed_volume:.2f} m3")
    print(f"\nMesh vertices:        {num_vertices}")
    print(f"Mesh faces:           {num_faces}")
    print(f"\nWatertight:           {'YES' if is_watertight else 'NO'}")
    print(f"Valid:                {'YES' if is_valid else 'NO'}")
    print(f"\nOBJ:                  [OK] ({obj_path})")
    print(f"GLB:                  [OK] ({glb_path})")
    print(f"Metadata:             [OK] ({meta_path})")
    print(f"\nSTATUS:               3D RECONSTRUCTION COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    reconstruct_b01_3d()
