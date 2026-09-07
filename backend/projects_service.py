import json
import uuid
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from backend.db import get_db

class ProjectService:
    def get_all_projects(self) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects ORDER BY created_at DESC")
        rows = cursor.fetchall()
        projects = []
        for r in rows:
            p = dict(r)
            if p.get("aoi_coords"):
                try:
                    p["aoi_coords"] = json.loads(p["aoi_coords"])
                except Exception:
                    pass
            projects.append(p)
        conn.close()
        return projects

    def get_project_by_id(self, project_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        p = dict(row)
        if p.get("aoi_coords"):
            try:
                p["aoi_coords"] = json.loads(p["aoi_coords"])
            except Exception:
                pass
        return p

    def create_project(self, data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        
        project_id = data.get("id") or f"P{uuid.uuid4().hex[:6].upper()}"
        name = data.get("name", "Untitled 3D Cadastre Project")
        district = data.get("district", "Chennai")
        taluk = data.get("taluk", "Urban")
        village = data.get("village", "Central")
        survey_number = data.get("survey_number", "100/1")
        ulpin = data.get("ulpin", f"TN-VEL-{project_id}")
        aoi = data.get("aoi_coords") or {"bbox": [80.200, 13.110, 80.210, 13.120]}

        cursor.execute("""
        INSERT INTO projects (id, name, district, taluk, village, survey_number, ulpin, aoi_coords, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PROCESSING', ?)
        """, (project_id, name, district, taluk, village, survey_number, ulpin, json.dumps(aoi), now))

        # Create initial Parcel record
        parcel_id = f"PARCEL-{project_id}"
        cursor.execute("""
        INSERT INTO parcels (id, project_id, survey_number, area_m2, geometry_json, data_certainty)
        VALUES (?, ?, ?, 850.0, ?, 'DERIVED')
        """, (parcel_id, project_id, survey_number, json.dumps({"type": "Polygon", "coordinates": [[[414610, 1450310], [414640, 1450310], [414640, 1450350], [414610, 1450350], [414610, 1450310]]]})))

        # Create initial Building record
        bldg_id = f"{project_id}-B01"
        cursor.execute("""
        INSERT INTO buildings (id, project_id, parcel_id, name, height_m, floors_count, ground_elev_m, footprint_json, data_certainty)
        VALUES (?, ?, ?, ?, 12.0, 4, 15.0, ?, 'DERIVED')
        """, (bldg_id, project_id, parcel_id, name, json.dumps({"type": "Polygon", "coordinates": [[[414618, 1450329], [414634, 1450329], [414634, 1450351], [414618, 1450351], [414618, 1450329]]]})))

        # Create Processing Job
        job_id = f"JOB-{project_id}"
        cursor.execute("""
        INSERT INTO processing_jobs (id, project_id, stage, progress_pct, status_message, created_at, updated_at)
        VALUES (?, ?, 'QUEUED', 5, 'Processing job queued in pipeline', ?, ?)
        """, (job_id, project_id, now, now))

        # Add Data Sources for the new project
        data_sources = [
            (f"DS-{project_id}-1", project_id, "User Uploaded Vector / AOI", "Sub-meter User Input", "OBSERVED", "Parcel Boundary & Site AOI", 1, "AUTHORITATIVE BOUNDARY DATA PROVIDED"),
            (f"DS-{project_id}-2", project_id, "Copernicus Global DEM 30m", "30m Ground Elevation", "DERIVED", "Ground Surface Datum", 0, "REQUIRES DGPS ELEVATION SURVEY"),
            (f"DS-{project_id}-3", project_id, "Procedural Architectural Extrusion Engine", "Derived Extrusion", "ESTIMATED", "3D Building Volume & Floor Slabs", 0, "NOT LEGALLY VERIFIED — ESTIMATED ARCHITECTURAL VOLUME"),
            (f"DS-{project_id}-4", project_id, "Procedural NBC Floor Subdivider", "Assumed 3m Floor Slices", "ESTIMATED", "Apartment Unit Volumes (U101..U404)", 0, "NOT LEGALLY VERIFIED — ESTIMATED FROM NBC STANDARDS")
        ]
        for ds in data_sources:
            cursor.execute("""
            INSERT INTO data_sources (id, project_id, source_name, resolution, provenance_class, affected_entities, is_authoritative, authoritative_missing_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, ds)

        conn.commit()
        conn.close()

        return {
            "project_id": project_id,
            "job_id": job_id,
            "name": name,
            "status": "PROCESSING",
            "created_at": now
        }

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM processing_jobs WHERE id = ?", (job_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def update_job_status(self, job_id: str, stage: str, progress_pct: int, message: str):
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        cursor.execute("""
        UPDATE processing_jobs SET stage = ?, progress_pct = ?, status_message = ?, updated_at = ? WHERE id = ?
        """, (stage, progress_pct, message, now, job_id))
        
        if stage == "COMPLETED":
            # Update project status
            cursor.execute("SELECT project_id FROM processing_jobs WHERE id = ?", (job_id,))
            r = cursor.fetchone()
            if r:
                cursor.execute("UPDATE projects SET status = 'ACTIVE' WHERE id = ?", (r["project_id"],))

        conn.commit()
        conn.close()

    def get_project_entities(self, project_id: str, entity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        if entity_type:
            cursor.execute("SELECT * FROM entities WHERE project_id = ? AND entity_type = ?", (project_id, entity_type))
        else:
            cursor.execute("SELECT * FROM entities WHERE project_id = ?", (project_id,))
        rows = cursor.fetchall()
        conn.close()
        
        entities = []
        for r in rows:
            e = dict(r)
            if e.get("spatial_json"):
                try: e["spatial"] = json.loads(e["spatial_json"])
                except Exception: pass
            if e.get("provenance_json"):
                try: e["provenance"] = json.loads(e["provenance_json"])
                except Exception: pass
            entities.append(e)
        return entities

    def get_data_sources(self, project_id: str) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM data_sources WHERE project_id = ?", (project_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_regulatory_record(self, project_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM regulatory_records WHERE project_id = ?", (project_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        rec = dict(row)
        
        # Calculate Data Reconciliation Confidence
        obs_floors = 4
        obs_units = 16
        obs_area = 742.0
        
        decl_floors = rec.get("declared_floors", 4)
        decl_units = rec.get("declared_units", 16)
        decl_area = rec.get("declared_area_m2", 711.2)
        
        diff_floors = abs(obs_floors - decl_floors)
        diff_units = abs(obs_units - decl_units)
        area_diff_pct = abs(obs_area - decl_area) / decl_area * 100.0 if decl_area > 0 else 0
        
        discrepancies = []
        if diff_floors > 0:
            discrepancies.append(f"Floor Count Discrepancy: Observed {obs_floors} vs Registered {decl_floors}")
        if diff_units > 0:
            discrepancies.append(f"Unit Count Discrepancy: Observed {obs_units} vs Registered {decl_units}")
        if area_diff_pct > 3.0:
            discrepancies.append(f"Floor Area Variance: Observed {obs_area} m² vs Registered {decl_area} m² ({area_diff_pct:.1f}% variance)")

        if len(discrepancies) == 0 and area_diff_pct <= 2.0:
            confidence = "HIGH CONSISTENCY"
        elif area_diff_pct <= 5.0 and len(discrepancies) <= 1:
            confidence = "PARTIAL CONSISTENCY"
        else:
            confidence = "REQUIRES VERIFICATION"

        rec["reconciliation_analysis"] = {
            "confidence_rating": confidence,
            "observed_metrics": {"floors": obs_floors, "units": obs_units, "area_m2": obs_area},
            "registered_metrics": {"floors": decl_floors, "units": decl_units, "area_m2": decl_area},
            "area_variance_pct": round(area_diff_pct, 2),
            "discrepancies": discrepancies,
            "status_summary": f"Spatial model evaluated against TNRERA #{rec.get('rera_number')} with rating: {confidence}"
        }

        return rec

    def get_verification_queue(self, project_id: str) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT e.*, v.verified_by, v.verified_at, v.notes as verification_notes
        FROM entities e
        LEFT JOIN verifications v ON e.property_id = v.property_id
        WHERE e.project_id = ?
        ORDER BY e.level ASC, e.property_id ASC
        """, (project_id,))
        rows = cursor.fetchall()
        conn.close()

        queue = []
        for r in rows:
            item = dict(r)
            if item.get("spatial_json"):
                try: item["spatial"] = json.loads(item["spatial_json"])
                except Exception: pass
            if item.get("provenance_json"):
                try: item["provenance"] = json.loads(item["provenance_json"])
                except Exception: pass
            queue.append(item)
        return queue

    def submit_verification(self, project_id: str, property_id: str, action: str, verified_by: str, notes: str) -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        vid = f"VERIF-{uuid.uuid4().hex[:8].upper()}"

        # Fetch entity details
        cursor.execute("SELECT geometry_hash, verification_status FROM entities WHERE property_id = ?", (property_id,))
        row = cursor.fetchone()
        prev_hash = row["geometry_hash"] if row else "hash_0"
        
        # Calculate new geometry hash for audit versioning
        hash_input = f"{property_id}:{action}:{verified_by}:{now}:{notes}"
        new_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:16]

        new_status = "REQUIRES_REVIEW"
        if action == "APPROVE": new_status = "OFFICER_VERIFIED"
        elif action == "REJECT": new_status = "REJECTED"
        elif action == "REQUEST CORRECTION": new_status = "CORRECTION_REQUESTED"

        # Update entity status & hash
        cursor.execute("""
        UPDATE entities SET verification_status = ?, geometry_hash = ? WHERE property_id = ?
        """, (new_status, new_hash, property_id))

        # Record immutable audit entry
        cursor.execute("""
        INSERT INTO verifications (id, project_id, property_id, action, verified_by, verified_at, notes, previous_hash, current_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (vid, project_id, property_id, action, verified_by, now, notes, prev_hash, new_hash))

        conn.commit()
        conn.close()

        return {
            "verification_id": vid,
            "property_id": property_id,
            "action": action,
            "new_status": new_status,
            "verified_by": verified_by,
            "verified_at": now,
            "previous_hash": prev_hash,
            "current_hash": new_hash
        }

    def get_audit_trail(self, property_id: str) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM verifications WHERE property_id = ? ORDER BY verified_at DESC", (property_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

project_service = ProjectService()
