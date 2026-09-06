import json
import math
from pathlib import Path
import geopandas as gpd
import pandas as pd
from shapely.geometry import mapping
import numpy as np

# -------------------------------------------------------------
# Configuration & Paths
# -------------------------------------------------------------
MS_INPUT_PATH = Path("data/raw/microsoft/microsoft_buildings.geojson")
OSM_INPUT_PATH = Path("data/raw/osm/osm_buildings.geojson")

OUT_DIR = Path("data/reconciliation")
OUT_DIR.mkdir(parents=True, exist_ok=True)

REPORT_DIR = Path("reports")
REPORT_DIR.mkdir(parents=True, exist_ok=True)

PROJECTED_CRS = "EPSG:32644"  # UTM Zone 44N (Chennai metric)
GEOGRAPHIC_CRS = "EPSG:4326"

STRONG_IOU_THRESHOLD = 0.70
POSSIBLE_IOU_THRESHOLD = 0.40

def run_reconciliation():
    print("=== Step 3: Footprint Reconciliation & IoU Matching ===")
    
    # 1. Load Datasets
    print(f"Loading Microsoft footprints from {MS_INPUT_PATH}...")
    ms_gdf = gpd.read_file(MS_INPUT_PATH)
    print(f"Loading OSM buildings from {OSM_INPUT_PATH}...")
    osm_gdf = gpd.read_file(OSM_INPUT_PATH)

    # Assign stable unique IDs
    ms_gdf["ms_id"] = [f"MS_{i+1:05d}" for i in range(len(ms_gdf))]
    if "osm_id" not in osm_gdf.columns:
        osm_gdf["osm_id"] = [f"OSM_{i+1:05d}" for i in range(len(osm_gdf))]

    total_ms = len(ms_gdf)
    total_osm = len(osm_gdf)
    print(f"Loaded {total_ms} Microsoft footprints and {total_osm} OSM buildings.")

    # 2. Reproject to metric projected CRS (EPSG:32644)
    print(f"Reprojecting geometries to metric CRS ({PROJECTED_CRS})...")
    ms_proj = ms_gdf.to_crs(PROJECTED_CRS).copy()
    osm_proj = osm_gdf.to_crs(PROJECTED_CRS).copy()

    # Calculate metric areas
    ms_proj["area_m2"] = ms_proj.geometry.area
    osm_proj["area_m2"] = osm_proj.geometry.area

    # Fix any invalid geometries
    ms_proj["geometry"] = ms_proj.geometry.buffer(0)
    osm_proj["geometry"] = osm_proj.geometry.buffer(0)

    # 3. Spatial Index & Candidate Query
    print("Building spatial index and finding candidate intersections...")
    spatial_index = osm_proj.sindex

    candidate_pairs = []

    for ms_idx, ms_geom in enumerate(ms_proj.geometry):
        if ms_geom.is_empty or not ms_geom.is_valid:
            continue
        
        # Query spatial index using bounding box
        possible_osm_indices = list(spatial_index.intersection(ms_geom.bounds))
        
        for osm_idx in possible_osm_indices:
            osm_geom = osm_proj.geometry.iloc[osm_idx]
            if osm_geom.is_empty or not osm_geom.is_valid:
                continue

            # Fast bounding box check
            if not ms_geom.intersects(osm_geom):
                continue

            intersection_geom = ms_geom.intersection(osm_geom)
            intersection_area = intersection_geom.area
            
            if intersection_area <= 0:
                continue

            union_geom = ms_geom.union(osm_geom)
            union_area = union_geom.area

            iou = intersection_area / union_area if union_area > 0 else 0.0

            if iou >= POSSIBLE_IOU_THRESHOLD:
                candidate_pairs.append({
                    "ms_idx": ms_idx,
                    "osm_idx": osm_idx,
                    "iou": float(iou),
                    "intersection_area": float(intersection_area)
                })

    print(f"Identified {len(candidate_pairs)} candidate overlapping pairs with IoU >= {POSSIBLE_IOU_THRESHOLD:.2f}.")

    # 4. One-to-One Greedy Matching (Ordered by IoU descending)
    candidate_pairs.sort(key=lambda x: x["iou"], reverse=True)

    matched_ms_set = set()
    matched_osm_set = set()
    matches = []

    for pair in candidate_pairs:
        m_idx = pair["ms_idx"]
        o_idx = pair["osm_idx"]

        if m_idx in matched_ms_set or o_idx in matched_osm_set:
            continue

        iou_val = pair["iou"]
        match_class = "STRONG" if iou_val >= STRONG_IOU_THRESHOLD else "POSSIBLE"

        matched_ms_set.add(m_idx)
        matched_osm_set.add(o_idx)

        matches.append({
            "ms_idx": m_idx,
            "osm_idx": o_idx,
            "iou": round(iou_val, 4),
            "match_class": match_class,
            "intersection_area_m2": round(pair["intersection_area"], 2)
        })

    print(f"Enforced 1-to-1 matching: {len(matches)} pairs successfully reconciled.")

    # 5. Build Matched Features GeoDataFrame
    matched_features = []
    b01_candidates = []

    for match in matches:
        m_idx = match["ms_idx"]
        o_idx = match["osm_idx"]
        iou_val = match["iou"]
        m_class = match["match_class"]

        ms_row = ms_gdf.iloc[m_idx]
        osm_row = osm_gdf.iloc[o_idx]
        metric_area = ms_proj.iloc[m_idx]["area_m2"]

        # Parse tags
        osm_levels = osm_row.get("levels")
        osm_height = osm_row.get("height")
        osm_name = osm_row.get("name")
        osm_type = osm_row.get("type")

        # Convert nan to None for JSON/GeoJSON cleanliness
        osm_levels = None if pd.isna(osm_levels) else str(osm_levels)
        osm_height = None if pd.isna(osm_height) else str(osm_height)
        osm_name = None if pd.isna(osm_name) else str(osm_name)
        osm_type = None if pd.isna(osm_type) else str(osm_type)

        props = {
            "reconciliation_status": "MATCHED",
            "match_class": m_class,
            "match_iou": iou_val,
            "ms_id": str(ms_row["ms_id"]),
            "osm_id": str(osm_row["osm_id"]),
            "osm_name": osm_name,
            "osm_levels": osm_levels,
            "osm_height": osm_height,
            "osm_type": osm_type,
            "ms_confidence": float(ms_row.get("confidence", -1.0)),
            "area_m2": round(float(metric_area), 2)
        }

        # We keep the Microsoft ML footprint as the primary geometric boundary (or can provide both)
        matched_features.append({
            "geometry": ms_row.geometry,
            **props
        })

        # Rank potential B01 candidates:
        # Score based on: levels known (+50), name known (+20), strong IoU (+30 * IoU), residential size (100 - 1500 m2)
        score = iou_val * 35.0
        levels_num = None
        if osm_levels is not None:
            try:
                levels_num = float(osm_levels)
                score += 50.0 + min(levels_num * 5.0, 30.0)
            except ValueError:
                score += 30.0

        if osm_name is not None and osm_name != "":
            score += 15.0

        if 150 <= metric_area <= 2000:
            score += 15.0
        elif 80 <= metric_area < 150:
            score += 8.0

        b01_candidates.append({
            "ms_id": str(ms_row["ms_id"]),
            "osm_id": str(osm_row["osm_id"]),
            "osm_name": osm_name,
            "osm_levels": osm_levels,
            "osm_height": osm_height,
            "osm_type": osm_type,
            "iou": iou_val,
            "match_class": m_class,
            "area_m2": round(float(metric_area), 2),
            "score": round(score, 2),
            "centroid": [float(ms_row.geometry.centroid.x), float(ms_row.geometry.centroid.y)]
        })

    matched_gdf = gpd.GeoDataFrame(matched_features, crs=GEOGRAPHIC_CRS)

    # 6. Build Unmatched Datasets
    ms_only_features = []
    for idx in range(total_ms):
        if idx not in matched_ms_set:
            ms_row = ms_gdf.iloc[idx]
            ms_only_features.append({
                "geometry": ms_row.geometry,
                "reconciliation_status": "MICROSOFT_ONLY",
                "ms_id": str(ms_row["ms_id"]),
                "ms_confidence": float(ms_row.get("confidence", -1.0)),
                "area_m2": round(float(ms_proj.iloc[idx]["area_m2"]), 2)
            })
    ms_only_gdf = gpd.GeoDataFrame(ms_only_features, crs=GEOGRAPHIC_CRS)

    osm_only_features = []
    for idx in range(total_osm):
        if idx not in matched_osm_set:
            osm_row = osm_gdf.iloc[idx]
            osm_only_features.append({
                "geometry": osm_row.geometry,
                "reconciliation_status": "OSM_ONLY",
                "osm_id": str(osm_row["osm_id"]),
                "osm_name": None if pd.isna(osm_row.get("name")) else str(osm_row.get("name")),
                "osm_levels": None if pd.isna(osm_row.get("levels")) else str(osm_row.get("levels")),
                "osm_height": None if pd.isna(osm_row.get("height")) else str(osm_row.get("height")),
                "osm_type": None if pd.isna(osm_row.get("type")) else str(osm_row.get("type")),
                "area_m2": round(float(osm_proj.iloc[idx]["area_m2"]), 2)
            })
    osm_only_gdf = gpd.GeoDataFrame(osm_only_features, crs=GEOGRAPHIC_CRS)

    # 7. Save Output GeoJSON files
    matched_path = OUT_DIR / "matched_buildings.geojson"
    ms_only_path = OUT_DIR / "microsoft_only.geojson"
    osm_only_path = OUT_DIR / "osm_only.geojson"

    matched_gdf.to_file(matched_path, driver="GeoJSON")
    ms_only_gdf.to_file(ms_only_path, driver="GeoJSON")
    osm_only_gdf.to_file(osm_only_path, driver="GeoJSON")

    print(f"Saved: {matched_path} ({len(matched_gdf)} features)")
    print(f"Saved: {ms_only_path} ({len(ms_only_gdf)} features)")
    print(f"Saved: {osm_only_path} ({len(osm_only_gdf)} features)")

    # 8. Compute Summary Metrics
    ious = [m["iou"] for m in matches]
    strong_count = sum(1 for m in matches if m["match_class"] == "STRONG")
    possible_count = sum(1 for m in matches if m["match_class"] == "POSSIBLE")

    mean_iou = float(np.mean(ious)) if ious else 0.0
    median_iou = float(np.median(ious)) if ious else 0.0

    b01_candidates.sort(key=lambda x: x["score"], reverse=True)

    report_data = {
        "aoi": {
            "name": "Kolathur Central, Chennai",
            "west": 80.2050,
            "south": 13.1180,
            "east": 80.2180,
            "north": 13.1300,
            "projected_crs": PROJECTED_CRS
        },
        "totals": {
            "microsoft_footprints": total_ms,
            "osm_buildings": total_osm,
            "combined_input_features": total_ms + total_osm
        },
        "reconciliation_summary": {
            "total_matched": len(matches),
            "strong_matches": strong_count,
            "possible_matches": possible_count,
            "microsoft_only": len(ms_only_gdf),
            "osm_only": len(osm_only_gdf),
            "mean_iou": round(mean_iou, 4),
            "median_iou": round(median_iou, 4)
        },
        "top_b01_candidates": b01_candidates[:10]
    }

    report_json_path = OUT_DIR / "reconciliation_report.json"
    with open(report_json_path, "w") as f:
        json.dump(report_data, f, indent=2)
    print(f"Saved JSON Report: {report_json_path}")

    # 9. Generate HTML Reconciliation Report
    generate_html_report(report_data, REPORT_DIR / "footprint_reconciliation.html")

    return report_data


def generate_html_report(report_data, html_path):
    summary = report_data["reconciliation_summary"]
    totals = report_data["totals"]
    top_candidates = report_data["top_b01_candidates"]

    rows_html = ""
    for idx, c in enumerate(top_candidates, 1):
        name_badge = f"<span class='badge name'>{c['osm_name']}</span>" if c['osm_name'] else "<span class='badge muted'>Unnamed</span>"
        levels_badge = f"<span class='badge highlight'>{c['osm_levels']}</span>" if c['osm_levels'] else "<span class='badge muted'>N/A</span>"
        class_badge = f"<span class='badge strong'>{c['match_class']}</span>" if c['match_class'] == 'STRONG' else f"<span class='badge possible'>{c['match_class']}</span>"
        
        rows_html += f"""
        <tr>
            <td><strong>#{idx}</strong></td>
            <td><code>{c['ms_id']}</code></td>
            <td><code>{c['osm_id']}</code></td>
            <td>{name_badge}</td>
            <td>{levels_badge}</td>
            <td><strong>{c['iou']:.2f}</strong></td>
            <td>{class_badge}</td>
            <td>{c['area_m2']} m²</td>
            <td><span class='score'>{c['score']}</span></td>
        </tr>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kolathur Cadastre — Footprint Reconciliation Report</title>
    <style>
        :root {{
            --bg: #0b0f19;
            --surface: #141c2e;
            --surface-hover: #1b263f;
            --border: #233252;
            --primary: #38bdf8;
            --primary-glow: rgba(56, 189, 248, 0.2);
            --success: #10b981;
            --warning: #f59e0b;
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        body {{ background: var(--bg); color: var(--text-main); line-height: 1.6; padding: 2.5rem 1.5rem; }}
        .container {{ max-width: 1100px; margin: 0 auto; }}
        header {{ margin-bottom: 2.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }}
        .badge-bar {{ display: inline-flex; gap: 0.5rem; margin-bottom: 0.75rem; }}
        .badge {{ padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }}
        .badge.primary {{ background: rgba(56, 189, 248, 0.15); color: var(--primary); border: 1px solid var(--primary); }}
        .badge.strong {{ background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success); }}
        .badge.possible {{ background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid var(--warning); }}
        .badge.name {{ background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid #c084fc; }}
        .badge.highlight {{ background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 0.85rem; border: 1px solid #3b82f6; }}
        .badge.muted {{ background: rgba(148, 163, 184, 0.1); color: var(--text-muted); }}
        h1 {{ font-size: 2.2rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }}
        p.subtitle {{ color: var(--text-muted); font-size: 1.05rem; margin-top: 0.4rem; }}
        .grid-stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem; }}
        .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }}
        .card .label {{ font-size: 0.82rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 0.35rem; }}
        .card .value {{ font-size: 1.85rem; font-weight: 700; color: #fff; }}
        .card .delta {{ font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }}
        .card.highlight {{ border-color: var(--primary); box-shadow: 0 0 20px var(--primary-glow); }}
        .card.highlight .value {{ color: var(--primary); }}
        h2 {{ font-size: 1.4rem; margin: 2rem 0 1rem; color: #fff; display: flex; align-items: center; gap: 0.6rem; }}
        .table-wrap {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 0.92rem; text-align: left; }}
        th {{ background: rgba(255,255,255,0.03); padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }}
        td {{ padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; }}
        tr:last-child td {{ border-bottom: none; }}
        tr:hover td {{ background: var(--surface-hover); }}
        code {{ background: rgba(0,0,0,0.3); padding: 0.2rem 0.45rem; border-radius: 4px; font-family: monospace; font-size: 0.85rem; color: #38bdf8; }}
        .score {{ font-weight: 700; color: #f59e0b; font-size: 1rem; }}
        .disclaimer {{ margin-top: 2.5rem; background: rgba(35, 50, 82, 0.4); border-left: 4px solid var(--primary); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0; color: var(--text-muted); font-size: 0.88rem; }}
    </style>
</head>
<body>
<div class="container">
    <header>
        <div class="badge-bar">
            <span class="badge primary">Step 3 Report</span>
            <span class="badge strong">EPSG:32644 Metric</span>
            <span class="badge muted">Greedy 1:1 Matching</span>
        </div>
        <h1>Footprint Reconciliation & IoU Analysis</h1>
        <p class="subtitle">Spatial cross-source alignment between Microsoft ML footprints and OpenStreetMap in Kolathur AOI, Chennai</p>
    </header>

    <div class="grid-stats">
        <div class="card">
            <div class="label">Microsoft ML Total</div>
            <div class="value">{totals['microsoft_footprints']}</div>
            <div class="delta">Raw ML Footprints</div>
        </div>
        <div class="card">
            <div class="label">OSM Buildings Total</div>
            <div class="value">{totals['osm_buildings']}</div>
            <div class="delta">Crowdsourced Features</div>
        </div>
        <div class="card highlight">
            <div class="label">Reconciled Matches</div>
            <div class="value">{summary['total_matched']}</div>
            <div class="delta">{summary['strong_matches']} Strong (IoU ≥ 0.70)</div>
        </div>
        <div class="card">
            <div class="label">Possible Matches</div>
            <div class="value">{summary['possible_matches']}</div>
            <div class="delta">0.40 ≤ IoU &lt; 0.70</div>
        </div>
        <div class="card">
            <div class="label">Mean / Median IoU</div>
            <div class="value">{summary['mean_iou']:.2f} / {summary['median_iou']:.2f}</div>
            <div class="delta">Across matched pairs</div>
        </div>
        <div class="card">
            <div class="label">Microsoft Only</div>
            <div class="value">{summary['microsoft_only']}</div>
            <div class="delta">No matching OSM building</div>
        </div>
        <div class="card">
            <div class="label">OSM Only</div>
            <div class="value">{summary['osm_only']}</div>
            <div class="delta">No matching MS footprint</div>
        </div>
    </div>

    <h2>Top B01 Hero Building Candidates</h2>
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Microsoft ID</th>
                    <th>OSM ID</th>
                    <th>Building Name</th>
                    <th>Levels</th>
                    <th>IoU</th>
                    <th>Class</th>
                    <th>Footprint Area</th>
                    <th>Candidate Score</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
    </div>

    <div class="disclaimer">
        <strong>Technical Note for 3D Cadastral Property Engine:</strong> In our cadastral data lineage, these matches represent <em>"Cross-source spatially reconciled building footprints"</em> rather than legally surveyed title boundaries. High IoU validates geometric agreement between satellite ML detection and community ground-truth.
    </div>
</div>
</body>
</html>
"""
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Generated Interactive HTML Report: {html_path}")

if __name__ == "__main__":
    run_reconciliation()
