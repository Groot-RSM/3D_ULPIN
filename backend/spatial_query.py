from pathlib import Path
from typing import Dict, Any, Optional
import geopandas as gpd
import pyproj
from shapely.geometry import Point, box
from backend.registry import registry

PROJECTED_CRS = "EPSG:32644"
GEOGRAPHIC_CRS = "EPSG:4326"

FOOTPRINT_GEOJSON = Path("data/b01/b01_footprint.geojson")

class SpatialQueryEngine:
    def __init__(self):
        self.geo_to_proj = pyproj.Transformer.from_crs(GEOGRAPHIC_CRS, PROJECTED_CRS, always_xy=True).transform
        self.proj_to_geo = pyproj.Transformer.from_crs(PROJECTED_CRS, GEOGRAPHIC_CRS, always_xy=True).transform
        self.b01_poly = None
        self.quad_polys = {}
        self.init_geometries()

    def init_geometries(self):
        if FOOTPRINT_GEOJSON.exists():
            gdf = gpd.read_file(FOOTPRINT_GEOJSON).to_crs(PROJECTED_CRS)
            self.b01_poly = gdf.geometry.iloc[0]
            if not self.b01_poly.is_valid:
                self.b01_poly = self.b01_poly.buffer(0)

            minx, miny, maxx, maxy = self.b01_poly.bounds
            midx = (minx + maxx) / 2.0
            midy = (miny + maxy) / 2.0

            self.quad_polys = {
                "01": box(minx - 1.0, midy, midx, maxy + 1.0).intersection(self.b01_poly),
                "02": box(midx, midy, maxx + 1.0, maxy + 1.0).intersection(self.b01_poly),
                "03": box(minx - 1.0, miny - 1.0, midx, midy).intersection(self.b01_poly),
                "04": box(midx, miny - 1.0, maxx + 1.0, midy).intersection(self.b01_poly)
            }

    def query_point(self, x: float, y: float, z: float, crs: str = "EPSG:32644") -> Optional[Dict[str, Any]]:
        # Convert to UTM if input is Geographic
        if crs in ("EPSG:4326", "WGS84", "GEO"):
            x_utm, y_utm = self.geo_to_proj(x, y)
        else:
            x_utm, y_utm = x, y

        pt_utm = Point(x_utm, y_utm)
        entities = registry.get_all_entities()

        # 1. First test private apartment units (most granular)
        for ent in entities:
            if ent.get("entity_type") == "private_residential_unit":
                sp = ent["spatial"]
                if sp["z_min_m"] - 0.05 <= z <= sp["z_max_m"] + 0.05:
                    u_code = ent.get("unit_code", "")[-2:]
                    poly_2d = self.quad_polys.get(u_code)
                    if poly_2d and (poly_2d.contains(pt_utm) or poly_2d.distance(pt_utm) < 0.1):
                        return {
                            "match_found": True,
                            "query_coordinates": {
                                "utm_x": round(x_utm, 3),
                                "utm_y": round(y_utm, 3),
                                "elevation_z_m": round(z, 2),
                                "crs": PROJECTED_CRS
                            },
                            "matched_entity": ent,
                            "spatial_relationship": "CONTAINS"
                        }

        # 2. Test Underground & Airspace Non-Building entities
        for ent in entities:
            if ent.get("hierarchy_level") == "NON_BUILDING_ENTITY":
                sp = ent["spatial"]
                if sp["z_min_m"] - 0.05 <= z <= sp["z_max_m"] + 0.05:
                    if self.b01_poly and (self.b01_poly.contains(pt_utm) or self.b01_poly.distance(pt_utm) < 3.0):
                        return {
                            "match_found": True,
                            "query_coordinates": {
                                "utm_x": round(x_utm, 3),
                                "utm_y": round(y_utm, 3),
                                "elevation_z_m": round(z, 2),
                                "crs": PROJECTED_CRS
                            },
                            "matched_entity": ent,
                            "spatial_relationship": "CONTAINS"
                        }

        # 3. Test Floor / Building / Parcel containment
        for ent in entities:
            if ent.get("entity_type") == "floor_volume":
                sp = ent["spatial"]
                if sp["z_min_m"] - 0.05 <= z <= sp["z_max_m"] + 0.05:
                    if self.b01_poly and (self.b01_poly.contains(pt_utm) or self.b01_poly.distance(pt_utm) < 0.1):
                        return {
                            "match_found": True,
                            "query_coordinates": {
                                "utm_x": round(x_utm, 3),
                                "utm_y": round(y_utm, 3),
                                "elevation_z_m": round(z, 2),
                                "crs": PROJECTED_CRS
                            },
                            "matched_entity": ent,
                            "spatial_relationship": "CONTAINS"
                        }

        return {
            "match_found": False,
            "query_coordinates": {
                "utm_x": round(x_utm, 3),
                "utm_y": round(y_utm, 3),
                "elevation_z_m": round(z, 2),
                "crs": PROJECTED_CRS
            },
            "matched_entity": None,
            "message": "Point does not fall inside any registered 3D property volume."
        }

query_engine = SpatialQueryEngine()
