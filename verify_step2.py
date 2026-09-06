from pathlib import Path
import geopandas as gpd

ms_path = Path("data/raw/microsoft/microsoft_buildings.geojson")
osm_path = Path("data/raw/osm/osm_buildings.geojson")

print("=== STEP 2 VERIFICATION REPORT ===")
print(f"Microsoft GeoJSON: exists={ms_path.exists()} ({ms_path.stat().st_size / 1024:.1f} KB)")
print(f"OSM GeoJSON:       exists={osm_path.exists()} ({osm_path.stat().st_size / 1024:.1f} KB)")

ms_gdf = gpd.read_file(ms_path)
osm_gdf = gpd.read_file(osm_path)

print(f"\n[Microsoft Dataset]")
print(f"  Total footprints: {len(ms_gdf)}")
print(f"  CRS:              {ms_gdf.crs}")
print(f"  Bounding Box:     W={ms_gdf.total_bounds[0]:.4f}, S={ms_gdf.total_bounds[1]:.4f}, E={ms_gdf.total_bounds[2]:.4f}, N={ms_gdf.total_bounds[3]:.4f}")

print(f"\n[OSM Dataset]")
print(f"  Total buildings:  {len(osm_gdf)}")
print(f"  CRS:              {osm_gdf.crs}")
print(f"  Bounding Box:     W={osm_gdf.total_bounds[0]:.4f}, S={osm_gdf.total_bounds[1]:.4f}, E={osm_gdf.total_bounds[2]:.4f}, N={osm_gdf.total_bounds[3]:.4f}")

osm_levels = osm_gdf[osm_gdf["levels"].notna()]
osm_height = osm_gdf[osm_gdf["height"].notna()]
osm_names = osm_gdf[osm_gdf["name"].notna()]

print(f"\n[OSM Metadata Coverage]")
print(f"  Features with 'levels': {len(osm_levels)}")
print(f"  Features with 'height': {len(osm_height)}")
print(f"  Features with 'name':   {len(osm_names)}")

if len(osm_levels) > 0:
    print("\nSample buildings with levels tagged:")
    for _, r in osm_levels.head(5).iterrows():
        print(f"  - ID: {r.get('osm_id')}, Name: {r.get('name')}, Levels: {r.get('levels')}, Height: {r.get('height')}")
