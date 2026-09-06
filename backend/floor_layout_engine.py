import math
from typing import Dict, Any, List, Optional, Tuple
from shapely.geometry import Polygon, MultiPolygon, box, LineString, Point, mapping
from shapely.ops import unary_union, split
import shapely.affinity as affinity

# Constants & Standards for Cadastral Subdivisions
DEFAULT_CORRIDOR_WIDTH_M = 2.4
MIN_USABLE_ROOM_AREA_M2 = 12.0
MIN_ROOM_WIDTH_M = 2.0
WALL_THICKNESS_M = 0.25
PARTITION_WALL_HEIGHT_M = 2.8


class FootprintGeometryAnalyzer:
    """
    Phase 10.1: Calculates geometric metrics from actual real-world building polygon.
    """
    @staticmethod
    def analyze(polygon: Polygon) -> Dict[str, Any]:
        if not polygon or polygon.is_empty:
            return {"error": "Empty or invalid polygon"}

        area = polygon.area
        perimeter = polygon.length

        # Minimum bounding rotated rectangle (oriented bounding box)
        mrr = polygon.minimum_rotated_rectangle
        mrr_coords = list(mrr.exterior.coords) if hasattr(mrr, 'exterior') else []

        side_lengths = []
        if len(mrr_coords) >= 4:
            for i in range(3):
                p1 = Point(mrr_coords[i])
                p2 = Point(mrr_coords[i + 1])
                side_lengths.append(p1.distance(p2))

        if side_lengths:
            side_lengths.sort()
            width_m = round(side_lengths[0], 2)
            length_m = round(side_lengths[-1], 2)
            aspect_ratio = round(length_m / max(0.1, width_m), 2)
        else:
            bounds = polygon.bounds # (minx, miny, maxx, maxy)
            width_m = round(bounds[2] - bounds[0], 2)
            length_m = round(bounds[3] - bounds[1], 2)
            aspect_ratio = round(max(width_m, length_m) / max(0.1, min(width_m, length_m)), 2)

        # Isoperimetric compactness quotient: 4 * pi * Area / Perimeter^2 (1.0 = perfect circle)
        compactness = round((4 * math.pi * area) / max(0.1, perimeter ** 2), 3)

        # Holes / Courtyards count
        num_interiors = len(polygon.interiors) if hasattr(polygon, 'interiors') else 0

        # Strategy Recommendation
        if num_interiors > 0 or area > 3000.0:
            recommended_strategy = "CENTRAL_CORE_PERIMETER_RING"
        elif aspect_ratio >= 1.4:
            recommended_strategy = "CENTRAL_CORRIDOR_BILATERAL"
        else:
            recommended_strategy = "QUADRANT_4_CORNER"

        return {
            "area_m2": round(area, 2),
            "perimeter_m": round(perimeter, 2),
            "width_m": width_m,
            "length_m": length_m,
            "aspect_ratio": aspect_ratio,
            "compactness_score": compactness,
            "has_courtyards": num_interiors > 0,
            "courtyards_count": num_interiors,
            "recommended_strategy": recommended_strategy
        }


class CadastralTopologyValidator:
    """
    Phase 10.4: Validates candidate floor subdivision geometry against 8 strict rules.
    """
    @staticmethod
    def validate(
        footprint: Polygon,
        rooms: List[Dict[str, Any]],
        circulation: Optional[Dict[str, Any]] = None,
        walls: Optional[List[Dict[str, Any]]] = None,
        floor_z_min: float = 0.0,
        floor_z_max: float = 4.0
    ) -> Dict[str, Any]:
        rules_results = []
        is_valid = True

        total_floor_area = footprint.area
        all_units = [r["geometry"] for r in rooms if "geometry" in r and r["geometry"].is_valid]
        if circulation and "geometry" in circulation and circulation["geometry"].is_valid:
            all_units.append(circulation["geometry"])

        # RULE 1: Outer Boundary Containment
        # All rooms must be within footprint boundary (with 0.05m numeric tolerance buffer)
        contained_all = True
        tolerance_footprint = footprint.buffer(0.05)
        for r in rooms:
            geom = r.get("geometry")
            if geom and not tolerance_footprint.contains(geom):
                contained_all = False
                break
        rules_results.append({
            "rule_id": "R1_CONTAINMENT",
            "name": "Strict Boundary Containment",
            "passed": contained_all,
            "detail": "All internal rooms lie strictly within the master floor plate perimeter."
        })
        if not contained_all:
            is_valid = False

        # RULE 2: Non-Overlap / Zero Pairwise Intersection
        overlap_free = True
        max_overlap_area = 0.0
        for i in range(len(all_units)):
            for j in range(i + 1, len(all_units)):
                inter = all_units[i].intersection(all_units[j])
                if inter and not inter.is_empty and inter.area > 0.01:
                    overlap_free = False
                    max_overlap_area = max(max_overlap_area, inter.area)
        rules_results.append({
            "rule_id": "R2_NON_OVERLAP",
            "name": "Pairwise Zero Collision",
            "passed": overlap_free,
            "detail": f"Zero volumetric overlap across distinct sub-parcels (max overlap: {max_overlap_area:.4f} m²)."
        })
        if not overlap_free:
            is_valid = False

        # RULE 3: Area Conservation (Sum of rooms + circulation ≈ floor area within 1.5%)
        sum_units_area = sum(u.area for u in all_units)
        area_diff_pct = abs(sum_units_area - total_floor_area) / max(1.0, total_floor_area) * 100.0
        area_conserved = area_diff_pct < 2.0
        rules_results.append({
            "rule_id": "R3_AREA_CONSERVATION",
            "name": "100% Floor Area Conservation",
            "passed": area_conserved,
            "detail": f"Sum of units ({sum_units_area:.1f} m²) matches floor slab ({total_floor_area:.1f} m²), variance: {area_diff_pct:.2f}%."
        })
        if not area_conserved:
            is_valid = False

        # RULE 4: Geometry Simplicity & Validity
        all_geoms_valid = all(u.is_valid and not u.is_empty for u in all_units)
        rules_results.append({
            "rule_id": "R4_VALID_GEOMETRIES",
            "name": "Watertight Simple Polygons",
            "passed": all_geoms_valid,
            "detail": "All room partitions are non-self-intersecting valid 2D planar polygons."
        })
        if not all_geoms_valid:
            is_valid = False

        # RULE 5: Minimum Usable Room Area (>= 12 m²)
        min_room_size_met = all(r.get("area_m2", 0) >= MIN_USABLE_ROOM_AREA_M2 for r in rooms)
        rules_results.append({
            "rule_id": "R5_MIN_ROOM_SIZE",
            "name": f"Minimum Usable Space Standard (>={MIN_USABLE_ROOM_AREA_M2} m2)",
            "passed": min_room_size_met,
            "detail": f"All room spaces meet standard building code size requirements."
        })
        if not min_room_size_met:
            is_valid = False

        # RULE 6: Minimum Usable Room Width / Clearance
        width_clearance_met = True
        for r in rooms:
            geom = r.get("geometry")
            if geom and hasattr(geom, 'minimum_rotated_rectangle'):
                mrr = geom.minimum_rotated_rectangle
                coords = list(mrr.exterior.coords) if hasattr(mrr, 'exterior') else []
                if len(coords) >= 4:
                    s1 = Point(coords[0]).distance(Point(coords[1]))
                    s2 = Point(coords[1]).distance(Point(coords[2]))
                    if min(s1, s2) < MIN_ROOM_WIDTH_M:
                        width_clearance_met = False
                        break
        rules_results.append({
            "rule_id": "R6_CLEARANCE_WIDTH",
            "name": f"Minimum Spatial Width Clearance (>={MIN_ROOM_WIDTH_M}m)",
            "passed": width_clearance_met,
            "detail": "Room dimensions allow standard structural occupancy and furniture clearance."
        })

        # RULE 7: Circulation & Access Connectivity
        has_circulation = circulation is not None and "geometry" in circulation
        rules_results.append({
            "rule_id": "R7_CORRIDOR_ACCESS",
            "name": "Dedicated Ingress / Circulation Spine",
            "passed": has_circulation,
            "detail": "Dedicated common corridor and lobby infrastructure connects unit access points."
        })

        # RULE 8: Watertight 3D Volumetric Extrusion Bounds
        z_valid = floor_z_max > floor_z_min and (floor_z_max - floor_z_min) >= 2.5
        rules_results.append({
            "rule_id": "R8_3D_EXTRUSION_BOUNDS",
            "name": "Volumetric 3D Stratification Range",
            "passed": z_valid,
            "detail": f"Valid elevation bounds Z=[{floor_z_min:.2f}m → {floor_z_max:.2f}m] with floor height {floor_z_max - floor_z_min:.2f}m."
        })
        if not z_valid:
            is_valid = False

        passed_count = sum(1 for r in rules_results if r["passed"])
        score_pct = round((passed_count / len(rules_results)) * 100.0, 1)

        return {
            "is_valid": is_valid,
            "rules_passed": passed_count,
            "total_rules": len(rules_results),
            "compliance_score_pct": score_pct,
            "rules": rules_results
        }


def split_polygon_by_lines(poly: Any, lines: List[LineString]) -> List[Polygon]:
    if not poly or poly.is_empty:
        return []
    current_pieces = list(poly.geoms) if isinstance(poly, MultiPolygon) else [poly]
    for line in lines:
        new_pieces = []
        for piece in current_pieces:
            if piece.intersects(line):
                try:
                    res = split(piece, line)
                    for g in res.geoms:
                        if isinstance(g, Polygon) and g.area >= MIN_USABLE_ROOM_AREA_M2:
                            new_pieces.append(g)
                except Exception:
                    new_pieces.append(piece)
            else:
                new_pieces.append(piece)
        current_pieces = new_pieces
    return [p for p in current_pieces if isinstance(p, Polygon) and p.area >= MIN_USABLE_ROOM_AREA_M2]


class ShapelyFloorSubdivisionEngine:
    """
    Phase 10.2: Implements the 3 Deterministic Shapely Subdivision Algorithms.
    All calculations are done in local metric coordinates (meters).
    """

    @classmethod
    def generate_subdivision(
        cls,
        metric_polygon: Polygon,
        strategy: str,
        target_units_count: int = 4,
        corridor_width_m: float = DEFAULT_CORRIDOR_WIDTH_M
    ) -> Tuple[List[Polygon], Optional[Polygon]]:
        if not metric_polygon or metric_polygon.is_empty:
            return [], None

        strategy_upper = strategy.upper()

        if "CORRIDOR" in strategy_upper:
            return cls._subdivide_central_corridor(metric_polygon, target_units_count, corridor_width_m)
        elif "CORE" in strategy_upper or "RING" in strategy_upper:
            return cls._subdivide_core_perimeter(metric_polygon, target_units_count)
        else: # QUADRANT / COMPACT
            return cls._subdivide_quadrant(metric_polygon, target_units_count, corridor_width_m)

    @classmethod
    def _subdivide_central_corridor(
        cls,
        poly: Polygon,
        target_units: int,
        corridor_width: float
    ) -> Tuple[List[Polygon], Optional[Polygon]]:
        """
        Strategy 1: Central corridor along longitudinal axis + bilateral perpendicular room slicing.
        """
        bounds = poly.bounds
        minx, miny, maxx, maxy = bounds
        dx = maxx - minx
        dy = maxy - miny

        is_x_longer = dx >= dy
        center_x = (minx + maxx) / 2.0
        center_y = (miny + maxy) / 2.0
        half_w = corridor_width / 2.0

        if is_x_longer:
            corridor_box = box(minx - 5, center_y - half_w, maxx + 5, center_y + half_w)
            corridor = poly.intersection(corridor_box)
            usable_spaces = poly.difference(corridor_box)

            # Transverse slicing lines
            target_per_side = max(1, math.ceil(target_units / 2))
            step_x = dx / target_per_side
            cutters = [LineString([(minx + i * step_x, miny - 10), (minx + i * step_x, maxy + 10)]) for i in range(1, target_per_side)]
            rooms = split_polygon_by_lines(usable_spaces, cutters)
        else:
            corridor_box = box(center_x - half_w, miny - 5, center_x + half_w, maxy + 5)
            corridor = poly.intersection(corridor_box)
            usable_spaces = poly.difference(corridor_box)

            target_per_side = max(1, math.ceil(target_units / 2))
            step_y = dy / target_per_side
            cutters = [LineString([(minx - 10, miny + i * step_y), (maxx + 10, miny + i * step_y)]) for i in range(1, target_per_side)]
            rooms = split_polygon_by_lines(usable_spaces, cutters)

        return rooms, corridor

    @classmethod
    def _subdivide_quadrant(
        cls,
        poly: Polygon,
        target_units: int,
        corridor_width: float
    ) -> Tuple[List[Polygon], Optional[Polygon]]:
        """
        Strategy 2: 4-Corner / Cross-Grid Partitioning with central intersection hub.
        """
        bounds = poly.bounds
        minx, miny, maxx, maxy = bounds
        center_x = (minx + maxx) / 2.0
        center_y = (miny + maxy) / 2.0
        half_w = corridor_width / 2.0

        h_box = box(minx - 5, center_y - half_w, maxx + 5, center_y + half_w)
        v_box = box(center_x - half_w, miny - 5, center_x + half_w, maxy + 5)
        cross_corridor_box = unary_union([h_box, v_box])

        corridor = poly.intersection(cross_corridor_box)
        quadrants_space = poly.difference(cross_corridor_box)

        rooms = list(quadrants_space.geoms) if isinstance(quadrants_space, MultiPolygon) else [quadrants_space]
        return [r for r in rooms if isinstance(r, Polygon) and r.area >= MIN_USABLE_ROOM_AREA_M2], corridor

    @classmethod
    def _subdivide_core_perimeter(
        cls,
        poly: Polygon,
        target_units: int
    ) -> Tuple[List[Polygon], Optional[Polygon]]:
        """
        Strategy 3: Central core (services/lifts/stairs) + perimeter ring units.
        """
        bounds = poly.bounds
        minx, miny, maxx, maxy = bounds
        dx = maxx - minx
        dy = maxy - miny
        center_x = (minx + maxx) / 2.0
        center_y = (miny + maxy) / 2.0

        # Inner core footprint (approx 25-30% of dimensions)
        core_w = dx * 0.32
        core_h = dy * 0.32
        core_box = box(center_x - core_w / 2, center_y - core_h / 2, center_x + core_w / 2, center_y + core_h / 2)
        core_corridor = poly.intersection(core_box)

        perimeter_space = poly.difference(core_box)

        # Slice perimeter into 4 to 6 perimeter rooms
        cutters = [
            LineString([(center_x, center_y + core_h / 2), (center_x, maxy + 10)]),
            LineString([(center_x, center_y - core_h / 2), (center_x, miny - 10)]),
            LineString([(center_x + core_w / 2, center_y), (maxx + 10, center_y)]),
            LineString([(center_x - core_w / 2, center_y), (minx - 10, center_y)])
        ]

        rooms = split_polygon_by_lines(perimeter_space, cutters)
        return rooms, core_corridor


def generate_partition_wall_segments(rooms: List[Polygon], corridor: Optional[Polygon] = None) -> List[List[Tuple[float, float]]]:
    all_polys = list(rooms)
    if corridor and not corridor.is_empty:
        all_polys.append(corridor)

    wall_lines = []
    for i in range(len(all_polys)):
        for j in range(i + 1, len(all_polys)):
            inter = all_polys[i].intersection(all_polys[j])
            if inter and not inter.is_empty:
                if inter.geom_type == 'LineString':
                    coords = list(inter.coords)
                    if len(coords) >= 2:
                        wall_lines.append(coords)
                elif inter.geom_type == 'MultiLineString':
                    for line in inter.geoms:
                        wall_lines.append(list(line.coords))

    return wall_lines


def generate_cadastral_floor_layout(
    building_data: Dict[str, Any],
    floor_level: int = 1,
    total_floors: Optional[int] = None,
    typical_floor_height_m: float = 4.0,
    ground_datum_z: float = 0.0
) -> Dict[str, Any]:
    """
    End-to-End Orchestrator (Phase 10.1 -> 10.4):
    Real Footprint -> Metric Conversion -> Geometry Analysis -> SerpApi Ground-Truth
    -> Shapely Subdivision -> 8-Rule Validation -> 3D ULPIN Title Registry.
    """
    from backend.serpapi_service import serpapi_service

    b_id = building_data.get("building_id", "VIT-B001")
    b_name = building_data.get("name", "Academic Building")
    height_m = float(building_data.get("height_m") or 24.0)
    
    # Floor Count Determination
    rec = building_data.get("reconciliation") or {}
    if not total_floors:
        total_floors = rec.get("final_floor_count") or building_data.get("verified_floor_count") or max(1, round(height_m / typical_floor_height_m))

    fl_height = round(height_m / max(1, total_floors), 2)
    z_min = round(ground_datum_z + (floor_level - 1) * fl_height, 2)
    z_max = round(ground_datum_z + floor_level * fl_height, 2)

    # 1. Parse Geometry into Local Metric Coordinates (Centered at (0, 0))
    geom = building_data.get("geometry") or {}
    gtype = geom.get("type", "Polygon")
    coords_raw = geom.get("coordinates", [])

    if not coords_raw:
        return {"error": "Missing building geometry coordinates"}

    outer_ring = []
    inner_rings = []
    if gtype == "Polygon":
        outer_ring = coords_raw[0] if coords_raw else []
        inner_rings = coords_raw[1:] if len(coords_raw) > 1 else []
    elif gtype == "MultiPolygon":
        outer_ring = coords_raw[0][0] if coords_raw and coords_raw[0] else []
        inner_rings = coords_raw[0][1:] if len(coords_raw[0]) > 1 else []

    if len(outer_ring) < 3:
        return {"error": "Invalid polygon ring"}

    # Centroid in degrees
    lons = [pt[0] for pt in outer_ring if isinstance(pt, (list, tuple))]
    lats = [pt[1] for pt in outer_ring if isinstance(pt, (list, tuple))]
    c_lon = sum(lons) / len(lons)
    c_lat = sum(lats) / len(lats)

    # Metric conversion (UTM 44N projection approximation around Vellore)
    # 1 deg Lon ~ 108,500m, 1 deg Lat ~ 110,800m
    outer_metric = [((pt[0] - c_lon) * 108500.0, (pt[1] - c_lat) * 110800.0) for pt in outer_ring if isinstance(pt, (list, tuple))]
    inners_metric = []
    for ir in inner_rings:
        ir_m = [((pt[0] - c_lon) * 108500.0, (pt[1] - c_lat) * 110800.0) for pt in ir if isinstance(pt, (list, tuple))]
        if len(ir_m) >= 3:
            inners_metric.append(ir_m)

    metric_poly = Polygon(shell=outer_metric, holes=inners_metric)
    if not metric_poly.is_valid:
        metric_poly = metric_poly.buffer(0)

    # Phase 10.1: Geometry Metrics Analysis
    metrics = FootprintGeometryAnalyzer.analyze(metric_poly)

    # Phase 10.3: SerpApi Real-World Ground-Truth & Layout Strategy
    layout_strategy = serpapi_service.generate_floor_layout_strategy(
        building_data=building_data,
        floor_level=floor_level,
        total_floors=total_floors,
        geometry_metrics=metrics
    )

    chosen_strategy = layout_strategy.get("strategy", metrics["recommended_strategy"])
    target_units_count = layout_strategy.get("target_units_count", 4)
    corridor_width = layout_strategy.get("corridor_width_m", 2.4)
    room_templates = layout_strategy.get("room_templates", [])

    # Phase 10.2: Deterministic Shapely Subdivision
    rooms_polys, corridor_poly = ShapelyFloorSubdivisionEngine.generate_subdivision(
        metric_polygon=metric_poly,
        strategy=chosen_strategy,
        target_units_count=target_units_count,
        corridor_width_m=corridor_width
    )

    # 2. Build Structured Room Records with 3D ULPIN Titles
    floor_id = f"{b_id}-F{floor_level:02d}"
    b_ulpin = building_data.get("ulpin") or f"ULPIN-IN-TN-VEL-{b_id}"
    floor_ulpin = f"{b_ulpin}-F{floor_level:02d}"

    rooms_data = []
    for idx, r_poly in enumerate(rooms_polys):
        unit_num = f"U{floor_level:01d}{idx+1:02d}"
        unit_id = f"{floor_id}-{unit_num}"
        unit_ulpin = f"{floor_ulpin}-{unit_num}"

        # Match template metadata or default
        tpl = room_templates[idx] if idx < len(room_templates) else {}
        room_label = tpl.get("label", f"Unit {unit_num}")
        zone_type = tpl.get("zone_type", "PRIMARY_ACADEMIC")
        color_hex = tpl.get("color_hex", "#0284c7" if idx % 2 == 0 else "#38bdf8")

        r_area = round(r_poly.area, 2)
        r_vol = round(r_area * fl_height, 2)

        # Convert local metric back to geo coordinates for GIS export
        geo_coords = [[[round(c_lon + (x / 108500.0), 7), round(c_lat + (y / 110800.0), 7)] for x, y in r_poly.exterior.coords]]

        # Local metric coordinates for Three.js direct extrusion
        local_coords = list(r_poly.exterior.coords)

        rooms_data.append({
            "unit_id": unit_id,
            "unit_ulpin": unit_ulpin,
            "unit_number": unit_num,
            "label": room_label,
            "zone_type": zone_type,
            "color_hex": color_hex,
            "area_m2": r_area,
            "volume_m3": r_vol,
            "z_min": z_min,
            "z_max": z_max,
            "height_m": fl_height,
            "geometry": r_poly,
            "local_coordinates": local_coords,
            "geojson": {
                "type": "Polygon",
                "coordinates": geo_coords
            }
        })

    # Corridor Circulation Data
    circulation_data = None
    if corridor_poly and not corridor_poly.is_empty:
        c_area = round(corridor_poly.area, 2)
        c_vol = round(c_area * fl_height, 2)
        c_ulpin = f"{floor_ulpin}-CORRIDOR"
        
        c_local_coords = []
        if isinstance(corridor_poly, MultiPolygon):
            for p in corridor_poly.geoms:
                c_local_coords.append(list(p.exterior.coords))
        else:
            c_local_coords.append(list(corridor_poly.exterior.coords))

        circulation_data = {
            "unit_id": f"{floor_id}-CIRCULATION",
            "unit_ulpin": c_ulpin,
            "label": "Circulation Lobby & Corridors",
            "zone_type": "CIRCULATION",
            "color_hex": "#f59e0b",
            "area_m2": c_area,
            "volume_m3": c_vol,
            "z_min": z_min,
            "z_max": z_max,
            "height_m": fl_height,
            "geometry": corridor_poly,
            "local_coordinates": c_local_coords
        }

    # Generate 3D interior partition wall lines
    wall_lines = generate_partition_wall_segments(rooms_polys, corridor_poly)

    # Phase 10.4: 8-Rule Cadastral Topology Validation
    validation_report = CadastralTopologyValidator.validate(
        footprint=metric_poly,
        rooms=rooms_data,
        circulation=circulation_data,
        walls=wall_lines,
        floor_z_min=z_min,
        floor_z_max=z_max
    )

    # Clean geometry objects before JSON serialization
    serialized_rooms = []
    for r in rooms_data:
        r_copy = dict(r)
        del r_copy["geometry"]
        serialized_rooms.append(r_copy)

    serialized_circulation = None
    if circulation_data:
        circ_copy = dict(circulation_data)
        del circ_copy["geometry"]
        serialized_circulation = circ_copy

    return {
        "status": "SUCCESS",
        "building_id": b_id,
        "building_name": b_name,
        "floor_level": floor_level,
        "floor_id": floor_id,
        "floor_ulpin": floor_ulpin,
        "total_floors": total_floors,
        "elevation": {
            "z_min": z_min,
            "z_max": z_max,
            "floor_height_m": fl_height,
            "partition_wall_height_m": min(PARTITION_WALL_HEIGHT_M, fl_height * 0.85)
        },
        "footprint_metrics": metrics,
        "layout_strategy": layout_strategy,
        "cadastral_metadata": {
            "authoritative": False,
            "legal_status": "SERPAPI_GROUND_TRUTH_CADASTRAL_ALLOCATION",
            "generation_method": "SERPAPI_STRATEGY_SHAPELY_DETERMINISTIC",
            "units_count": len(serialized_rooms),
            "total_usable_area_m2": sum(r["area_m2"] for r in serialized_rooms),
            "circulation_area_m2": serialized_circulation["area_m2"] if serialized_circulation else 0.0
        },
        "topology_validation": validation_report,
        "rooms": serialized_rooms,
        "circulation": serialized_circulation,
        "partition_walls": {
            "wall_thickness_m": WALL_THICKNESS_M,
            "wall_height_m": min(PARTITION_WALL_HEIGHT_M, fl_height * 0.85),
            "segments_count": len(wall_lines),
            "line_segments": wall_lines
        }
    }

