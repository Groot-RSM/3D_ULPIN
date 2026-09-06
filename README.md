# 🏛️ 3D ULPIN: Next-Generation 3D Cadastral & Volumetric Spatial Identity Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg?logo=three.js)](https://threejs.org/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-6.7+-blue.svg?logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-Spatial_AI-8E75B2.svg?logo=google&logoColor=white)](https://ai.google.dev/)
[![Status](https://img.shields.io/badge/3D_Topology-100%25_Validated-success.svg)]()

> A full-stack cadastral digital twin extending India's **Unique Land Parcel Identification Number (ULPIN)** from traditional 2D surface parcels into **watertight 3D volumetric property identifiers** with vertical floor-level stratification, subterranean utility easements, airspace development rights, and AI-driven cadastral intelligence.

---

## 🌟 The Problem: Why 2D Cadastres Fail for Multi-Level Properties

In traditional 2D land administration:
* **Vertical Collapse**: An entire multi-storey complex with hundreds of distinct unit owners collapses into a **single flat 2D parcel polygon**.
* **Subsurface & Airspace Blindness**: Underground utility conduits (metro, fiber optic, sewer mains) and vertical airspace rights share the exact same $(X, Y)$ ground footprint.
* **Lack of 3D Verification**: 2D registries cannot mathematically detect vertical encroachments, unauthorized floor expansions, or subterranean infrastructure collisions.

```
Traditional 2D Cadastre                    3D Volumetric ULPIN Cadastre
─────────────────────────                 ─────────────────────────────────────────
┌───────────────────────┐                 ┌─ Airspace Right (Z: 28m → 35m) ───────┐
│                       │                 ├─ Floor 4 / Units (Z: 21m → 28m) ──────┤
│  Single 2D Polygon    │       ───►      ├─ Floor 3 / Units (Z: 14m → 21m) ──────┤
│  (All levels merged)  │                 ├─ Floor 2 / Units (Z: 7m → 14m) ───────┤
│                       │                 ├─ Ground Level (Z: 0m → 7m) ───────────┤
└───────────────────────┘                 └─ Subsurface Utility (Z: -6m → 0m) ────┘
```

---

## 🏛️ The Solution: 3D ULPIN Spatial Hierarchy

Every spatial entity receives a deterministic, hierarchical **3D ULPIN Identifier** linked to:
1. **Vertical Bounds**: Exact $Z_{\min}$ and $Z_{\max}$ relative to the MSL elevation datum.
2. **Watertight 3D Geometry**: Exact metric volume ($V$) and floor area ($A$) in UTM Zone 44N (`EPSG:32644`).
3. **Cryptographic SHA-256 Title Hash**: Immutable deed and cadastral integrity.
4. **Topological Non-Overlap Certificate**: 100% volume conservation with zero pairwise unit collision.

```
Cadastral Parcel (ULPIN-IN-TN-VEL)
 ├── Subsurface Easements (UG-B01 Basement, UG-C01 Telecom, UG-W01 Sewer Main)
 ├── Building Envelope (e.g. Technology Tower, SJT, Periyar Central Library)
 │    ├── Floor Slabs (F01..F07 @ 4.0m/floor)
 │    │    └── Individual Volumetric Units & Internal Spaces
 └── Vertical Airspace Right (AS-B01: Height Clearance Envelope)
```

---

## 🚀 Key Features

* 🗺️ **Interactive 3D Campus Map Engine**: High-performance MapLibre GL canvas with realistic 3D building extrusions, 50° pitch camera fly-to animations, electric cyan selection highlights, and collision-aware labels.
* 📦 **Exploded 3D Architectural Floor Inspector**: Real-time 60FPS Three.js WebGL viewport with continuous vertical floor plate separation slider, courtyard cutouts, and dynamic auto-framing.
* 🤖 **AI Spatial Cadastral Intelligence**: Direct integration with Google Gemini Flash to generate automated spatial compliance audits, volumetric land usage insights, and cadastral analysis.
* ⚖️ **Multi-Source Floor Count Reconciliation**: Reconciles OpenStreetMap records, elevation DEM estimates, and verified survey records with an interactive officer override queue.
* 📍 **Precision Campus Digital Twin**: Fully mapped landmark structures across **VIT Vellore Campus** including:
  * **Technology Tower (TT)** (`VIT-B001` — 7 Floors / $36.0\text{ m}$)
  * **Silver Jubilee Tower (SJT)** (`VIT-B002` — 9 Floors / $45.0\text{ m}$)
  * **Dr. M.G.R. Block / Main Building** (`VIT-B003` — 5 Floors / $24.0\text{ m}$)
  * **Periyar EVR Central Library** (`VIT-B006` — 7 Floors / $28.0\text{ m}$)
  * **Gandhi Block (MGB)** (`VIT-B005` — 5 Floors / $22.0\text{ m}$)
  * **Anna Auditorium** (`VIT-B010` — 3 Floors / $15.0\text{ m}$)
  * ...and more campus academic blocks.

---

## 🏗️ Project Architecture

```
3D_ULPIN_Code2create/
├── backend/                       # FastAPI High-Performance Backend
│   ├── main.py                    # API routes, CORS & static file server
│   ├── config.py                  # Centralized configuration & .env resolver
│   ├── vit_service.py             # VIT campus spatial & reconciliation engine
│   ├── gemini_service.py          # Gemini AI Cadastre & Spatial Intelligence
│   ├── projects_service.py        # Project lifecycle & task management
│   ├── registry.py                # 3D ULPIN property identity registry
│   ├── spatial_query.py           # 3D point-in-mesh raycasting
│   ├── conflicts.py               # 3D topology & collision engine
│   └── db.py                      # SQLite / Spatial storage
│
├── frontend/                      # React 19 + Vite + Three.js Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── VitCampusMap.jsx         # MapLibre 3D campus map with fly-to
│   │   │   ├── Vit3DBuildingViewer.jsx  # Three.js 3D exploded floor inspector
│   │   │   ├── VitBuildingDetails.jsx   # Building cadastre & AI insight panel
│   │   │   └── VitBuildingList.jsx      # Campus building selector & search
│   │   ├── App.jsx                      # Main dashboard layout & state
│   │   ├── config.js                    # Frontend API credentials
│   │   └── index.css                    # Glassmorphic cyberpunk styling
│   └── vite.config.js
│
├── processing/                    # Python 3D GIS & Pipeline Scripts
│   ├── apply_official_verified_floors.py  # Verified institutional records
│   ├── ingest_vit_campus_buildings.py     # Campus building spatial ingestion
│   ├── reconcile_footprints.py            # Microsoft ML + OSM reconciliation
│   ├── reconstruct_b01_3d.py              # Watertight 3D mesh extrusion
│   ├── subdivide_b01_floors.py            # Vertical floor partitioning
│   ├── subdivide_b01_units.py             # 3D horizontal unit subdivision
│   ├── create_b01_underground.py          # Subsurface utilities & easements
│   └── validate_b01_3d_topology.py        # 3D topology & collision verification
│
└── data/                          # Geospatial Datasets
    ├── vit_vellore/
    │   ├── campus_footprints.geojson     # Verified VIT Vellore campus polygons
    │   └── campus_routes.geojson         # Campus road & pedestrian network
    └── aoi.geojson                       # Area of Interest boundary
```

---

## 🛠️ Quick Start

### 1. Prerequisites
* **Python 3.10+**
* **Node.js 18+** and **npm**
* Git

### 2. Clone the Repository
```bash
git clone https://github.com/satheesh067/3D_ULPIN_Code2create.git
cd 3D_ULPIN_Code2create
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
# 3D ULPIN Platform API Environment Variables
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_MAPTILER_KEY=your_maptiler_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Backend Service Keys
GEMINI_API_KEY=your_gemini_api_key_here
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
MAPTILER_API_KEY=your_maptiler_key_here
```

### 4. Backend Setup
```bash
# Install Python dependencies
pip install fastapi uvicorn pydantic shapely geopandas trimesh scipy requests python-dotenv

# Start the FastAPI Server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 5. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite Development Server
npm run dev -- --host
```

### 6. Access the Dashboard
Open your browser and navigate to:
* **Interactive Dashboard**: [http://localhost:5173/](http://localhost:5173/)
* **Backend API Docs (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 📡 Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, center coordinates & building counts |
| `GET` | `/api/vit/geojson` | Complete VIT Vellore GeoJSON FeatureCollection |
| `GET` | `/api/vit/buildings` | All campus building footprints with reconciliation data |
| `GET` | `/api/vit/buildings/{id}` | Single building detail with 3D floor geometry |
| `GET` | `/api/vit/routes` | Campus road and arterial route network |
| `GET` | `/api/vit/summary` | Campus summary metrics (total area, buildings, storeys) |
| `POST` | `/api/vit/ai-insight` | Gemini AI Cadastral & Spatial Intelligence query |
| `GET` | `/api/vit/buildings/{id}/reconcile-floors` | Multi-source floor reconciliation breakdown |
| `POST` | `/api/vit/buildings/{id}/override-floors` | Surveyor floor override with audit logging |
| `POST` | `/api/vit/buildings/{id}/generate-floors` | Dynamic 3D floor slice volumetric generation |

---

## 📜 License
MIT License. Built for spatial cadastral innovation, volumetric land administration, and 3D property identity transparency.
