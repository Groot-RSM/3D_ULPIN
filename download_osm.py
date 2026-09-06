import time
from pathlib import Path
import requests
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon

# -----------------------------
# AOI (Kolathur Central)
# -----------------------------
WEST, SOUTH = 80.2050, 13.1180
EAST, NORTH = 80.2180, 13.1300

query = f"""
[out:json][timeout:60];
(
  way["building"]({SOUTH},{WEST},{NORTH},{EAST});
  relation["building"]({SOUTH},{WEST},{NORTH},{EAST});
);
out body geom;
"""

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
]

data = None
for endpoint in OVERPASS_ENDPOINTS:
    try:
        print(f"Querying Overpass API at {endpoint}...")
        r = requests.post(endpoint, data=query, timeout=90)
        if r.status_code == 200:
            data = r.json()
            break
        else:
            print(f"Endpoint returned status {r.status_code}, trying next...")
    except Exception as e:
        print(f"Endpoint failed ({e}), trying next...")
        time.sleep(2)

if not data:
    raise RuntimeError("All Overpass API endpoints failed or timed out.")

features = []

for el in data.get("elements", []):
    tags = el.get("tags", {})
    el_type = el.get("type")

    # Parse Ways
    if el_type == "way":
        geom_points = el.get("geometry", [])
        if len(geom_points) < 4:
            continue
        coords = [(p["lon"], p["lat"]) for p in geom_points]
        try:
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty:
                continue

            features.append({
                "geometry": poly,
                "osm_id": f"way/{el.get('id')}",
                "levels": tags.get("building:levels"),
                "height": tags.get("height"),
                "name": tags.get("name"),
                "type": tags.get("building")
            })
        except Exception:
            continue

    # Parse Relations (e.g. Multipolygons)
    elif el_type == "relation":
        members = el.get("members", [])
        outer_coords = []
        for m in members:
            if m.get("role") == "outer" and "geometry" in m:
                pts = [(p["lon"], p["lat"]) for p in m["geometry"]]
                if len(pts) >= 4:
                    outer_coords.append(pts)
        if outer_coords:
            try:
                polys = [Polygon(ring) for ring in outer_coords if len(ring) >= 4]
                valid_polys = [p.buffer(0) if not p.is_valid else p for p in polys if not p.is_empty]
                if valid_polys:
                    geom = valid_polys[0] if len(valid_polys) == 1 else MultiPolygon(valid_polys)
                    features.append({
                        "geometry": geom,
                        "osm_id": f"relation/{el.get('id')}",
                        "levels": tags.get("building:levels"),
                        "height": tags.get("height"),
                        "name": tags.get("name"),
                        "type": tags.get("building")
                    })
            except Exception:
                continue

if features:
    gdf = gpd.GeoDataFrame(features, crs="EPSG:4326")
else:
    gdf = gpd.GeoDataFrame(columns=["geometry", "osm_id", "levels", "height", "name", "type"], crs="EPSG:4326")

out_dir = Path("data/raw/osm")
out_dir.mkdir(parents=True, exist_ok=True)

out = out_dir / "osm_buildings.geojson"
gdf.to_file(out, driver="GeoJSON")

print(f"Saved {len(gdf)} buildings")
print(out)
