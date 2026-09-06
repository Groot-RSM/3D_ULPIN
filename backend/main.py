import os
import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.vit_service import vit_service
from backend.gemini_service import gemini_service


app = FastAPI(
    title="3D ULPIN | VIT Vellore Campus Mapping Platform API",
    description="Phase 1: AI-Assisted Campus Building Footprint Mapping & 3D Extrusion Engine",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mounts
data_dir = Path("data")
if data_dir.exists():
    app.mount("/static/data", StaticFiles(directory=str(data_dir)), name="static_data")

frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="frontend_assets")
    
    @app.get("/")
    def serve_frontend_root():
        return FileResponse(frontend_dist / "index.html")

    @app.get("/favicon.svg")
    def serve_favicon():
        if (frontend_dist / "favicon.svg").exists():
            return FileResponse(frontend_dist / "favicon.svg")
        raise HTTPException(status_code=404, detail="Favicon not found")

    @app.get("/icons.svg")
    def serve_icons():
        if (frontend_dist / "icons.svg").exists():
            return FileResponse(frontend_dist / "icons.svg")
        raise HTTPException(status_code=404, detail="Icons not found")

# Health Check
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "3D_ULPIN_VIT_Vellore_API",
        "campus": "VIT Vellore, Tamil Nadu, India",
        "center_coordinates": {"lat": 12.9692, "lon": 79.1560},
        "phase": "PHASE 1 — BUILDING FOOTPRINT MAPPING",
        "buildings_count": len(vit_service.get_all_buildings())
    }

# Phase 1 VIT Vellore Endpoints
@app.get("/api/vit/geojson")
def get_vit_geojson():
    return vit_service.get_geojson()

@app.get("/api/vit/buildings")
def get_vit_buildings():
    return vit_service.get_all_buildings()

@app.get("/api/vit/buildings/{building_id}")
def get_vit_building(building_id: str):
    b = vit_service.get_building_by_id(building_id)
    if not b:
        raise HTTPException(status_code=404, detail=f"VIT building '{building_id}' not found.")
    return b

@app.get("/api/vit/summary")
def get_vit_summary():
    return vit_service.get_campus_summary()

@app.get("/api/vit/routes")
def get_vit_routes():
    return vit_service.get_routes()

class AIInsightRequest(BaseModel):
    building_id: str
    query: Optional[str] = None

@app.post("/api/vit/ai-insight")
def generate_ai_insight(req: AIInsightRequest):
    b = vit_service.get_building_by_id(req.building_id)
    if not b:
        raise HTTPException(status_code=404, detail=f"Building '{req.building_id}' not found.")
    return gemini_service.generate_building_insight(b, req.query)


# FLOOR RECONCILIATION & MULTI-SOURCE EVIDENCE ENDPOINTS
class FloorOverrideRequest(BaseModel):
    override_floor_count: int
    reason: Optional[str] = "Officer survey verification"
    user: Optional[str] = "GIS Surveyor Officer"

@app.get("/api/vit/buildings/{building_id}/reconcile-floors")
def reconcile_building_floors(building_id: str, typical_floor_height: Optional[float] = 4.0):
    rec = vit_service.get_building_reconciliation(building_id, typical_floor_height_m=typical_floor_height or 4.0)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found.")
    return rec

@app.post("/api/vit/buildings/{building_id}/override-floors")
def override_building_floors(building_id: str, req: FloorOverrideRequest):
    if req.override_floor_count <= 0:
        raise HTTPException(status_code=400, detail="Override floor count must be greater than 0.")
    rec = vit_service.set_building_floor_override(
        building_id=building_id,
        override_floor_count=req.override_floor_count,
        reason=req.reason or "Officer survey verification",
        user=req.user or "GIS Surveyor Officer"
    )
    if not rec:
        raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found.")
    return rec

@app.get("/api/vit/verification-queue")
def get_verification_queue():
    return vit_service.get_verification_queue()

@app.post("/api/vit/buildings/{building_id}/generate-floors")
def generate_building_floors(building_id: str):
    rec = vit_service.get_building_reconciliation(building_id)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found.")
    return {
        "status": "SUCCESS",
        "message": f"Successfully generated {rec['final_floor_count']} floor volumes for building {building_id}",
        "reconciliation": rec,
        "floors_count": len(rec["generated_floors"]),
        "floors": rec["generated_floors"]
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
