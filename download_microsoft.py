import gzip
import json
from pathlib import Path
import math
import requests
import pandas as pd
import geopandas as gpd
from shapely.geometry import box, shape
from tqdm import tqdm

# -----------------------------
# AOI (Kolathur Central)
# -----------------------------
WEST, SOUTH = 80.2050, 13.1180
EAST, NORTH = 80.2180, 13.1300

aoi_polygon = box(WEST, SOUTH, EAST, NORTH)
aoi_gdf = gpd.GeoDataFrame(
    geometry=[aoi_polygon],
    crs="EPSG:4326"
)

# -----------------------------
# Project folders
# -----------------------------
ROOT = Path("data/raw/microsoft")
ROOT.mkdir(parents=True, exist_ok=True)

# -----------------------------
# Microsoft tile index
# -----------------------------
INDEX_URL = "https://bfppub.blob.core.windows.net/$web/2026-08-13/dataset-links.csv"
FALLBACK_URL = "https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv"

index_path = ROOT / "dataset-links.csv"

if not index_path.exists():
    print("Downloading Microsoft tile index...")
    try:
        r = requests.get(INDEX_URL, timeout=30)
        r.raise_for_status()
        index_path.write_bytes(r.content)
    except Exception as e:
        print(f"Primary index URL failed ({e}), trying fallback...")
        r = requests.get(FALLBACK_URL, timeout=30)
        r.raise_for_status()
        index_path.write_bytes(r.content)

tiles = pd.read_csv(index_path)

# -----------------------------
# QuadKey Calculation for AOI (Zoom Level 9)
# -----------------------------
def lat_lon_to_quadkey(lat, lon, zoom=9):
    sin_lat = math.sin(lat * math.pi / 180.0)
    sin_lat = min(max(sin_lat, -0.9999), 0.9999)
    x = int(math.floor((lon + 180.0) / 360.0 * (1 << zoom)))
    y = int(math.floor((0.5 - math.log((1.0 + sin_lat) / (1.0 - sin_lat)) / (4.0 * math.pi)) * (1 << zoom)))
    quadkey = []
    for i in range(zoom, 0, -1):
        digit = 0
        mask = 1 << (i - 1)
        if (x & mask) != 0:
            digit += 1
        if (y & mask) != 0:
            digit += 2
        quadkey.append(str(digit))
    return "".join(quadkey)

# Get quadkeys for AOI corners
aoi_corners = [
    (SOUTH, WEST),
    (SOUTH, EAST),
    (NORTH, WEST),
    (NORTH, EAST),
    ((SOUTH + NORTH) / 2, (WEST + EAST) / 2)
]
target_quadkeys = {lat_lon_to_quadkey(lat, lon, 9) for lat, lon in aoi_corners}

# Filter index for India and matching QuadKeys
india_tiles = tiles[tiles["Location"].astype(str).str.lower() == "india"].copy()
india_tiles["QuadKey"] = india_tiles["QuadKey"].astype(str)

selected = india_tiles[india_tiles["QuadKey"].isin(target_quadkeys)]
if selected.empty:
    selected = tiles[tiles["QuadKey"].astype(str).isin(target_quadkeys)]

print(f"Tiles selected: {len(selected)} (QuadKey(s): {', '.join(target_quadkeys)})")

all_features = []

for _, row in tqdm(selected.iterrows(), total=len(selected), desc="Processing tiles"):
    tile_url = row["Url"]
    print(f"Fetching tile: {tile_url}")

    # Stream download tile
    resp = requests.get(tile_url, stream=True, timeout=60)
    resp.raise_for_status()

    # The current Microsoft dataset provides gzipped GeoJSONL (.csv.gz)
    if tile_url.endswith(".gz"):
        with gzip.GzipFile(fileobj=resp.raw) as gz:
            for line in gz:
                if not line.strip():
                    continue
                feat = json.loads(line.decode("utf-8"))
                geom = shape(feat["geometry"])
                
                # Fast bounding box intersection test before full clip
                minx, miny, maxx, maxy = geom.bounds
                if not (maxx < WEST or minx > EAST or maxy < SOUTH or miny > NORTH):
                    # Intersects bounding box
                    if geom.intersects(aoi_polygon):
                        clipped_geom = geom.intersection(aoi_polygon)
                        props = feat.get("properties", {})
                        all_features.append({
                            "geometry": clipped_geom,
                            "height": props.get("height", -1.0),
                            "confidence": props.get("confidence", -1.0)
                        })
    elif tile_url.endswith(".parquet"):
        gdf = gpd.read_parquet(tile_url)
        gdf = gdf.clip(aoi_gdf)
        for _, r in gdf.iterrows():
            all_features.append({
                "geometry": r.geometry,
                "height": r.get("height", -1.0),
                "confidence": r.get("confidence", -1.0)
            })

if all_features:
    buildings = gpd.GeoDataFrame(all_features, crs="EPSG:4326")
else:
    buildings = gpd.GeoDataFrame(columns=["geometry", "height", "confidence"], crs="EPSG:4326")

out = ROOT / "microsoft_buildings.geojson"
buildings.to_file(out, driver="GeoJSON")

print(f"Saved {len(buildings)} buildings")
print(out)
