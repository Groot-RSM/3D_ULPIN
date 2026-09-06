import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.registry import registry
from backend.spatial_query import query_engine
from backend.conflicts import conflict_service

app = FastAPI(
    title="3D ULPIN Spatial Cadastre API",
    description="Backend API for 3D Property Identity, Volumetric Query, and Topology Conflict Engine",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mounts for 3D models and data assets
data_dir = Path("data")
if data_dir.exists():
    app.mount("/static/data", StaticFiles(directory=str(data_dir)), name="static_data")

frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="frontend_assets")
    app.mount("/models", StaticFiles(directory=str(frontend_dist / "models")), name="frontend_models")
    app.mount("/data", StaticFiles(directory=str(frontend_dist / "data")), name="frontend_data")
    
    from fastapi.responses import FileResponse
    @app.get("/")
    def serve_frontend_root():
        return FileResponse(frontend_dist / "index.html")

class PointQueryRequest(BaseModel):
    x: float
    y: float
    z: float
    crs: Optional[str] = "EPSG:32644"

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "3D_ULPIN_Cadastre_API",
        "study_area": "Kolathur, Chennai",
        "entities_count": len(registry.get_all_entities()),
        "version": "1.0.0"
    }

@app.get("/api/summary")
def get_system_summary():
    return registry.get_summary()

@app.get("/api/entities")
def get_entities(entity_type: Optional[str] = None):
    entities = registry.get_all_entities()
    if entity_type:
        return [e for e in entities if e.get("entity_type") == entity_type]
    return entities

@app.get("/api/entities/{property_id}")
def get_entity_by_id(property_id: str):
    entity = registry.get_entity_by_id(property_id)
    if not entity:
        raise HTTPException(status_code=404, detail=f"Property entity '{property_id}' not found in registry.")
    return entity

@app.post("/api/query/point")
def query_point(req: PointQueryRequest):
    result = query_engine.query_point(req.x, req.y, req.z, req.crs)
    return result

@app.get("/api/conflicts")
def get_conflicts():
    return conflict_service.get_conflict_summary()

@app.get("/api/conflicts/{scenario_id}")
def get_conflict_by_id(scenario_id: str):
    sc = conflict_service.get_scenario_by_id(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail=f"Conflict scenario '{scenario_id}' not found.")
    return sc

@app.get("/api/topology/report")
def get_topology_report():
    report_p = Path("data/b01/validation/validation_report.json")
    if report_p.exists():
        import json
        with open(report_p, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"message": "Validation report not found."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
