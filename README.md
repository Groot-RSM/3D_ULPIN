# 3D ULPIN: Next-Generation 3D Cadastral Property Identity System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg?logo=three.js)](https://threejs.org/)
[![Status](https://img.shields.io/badge/Topology-100%25%20Validated-success.svg)]()

A full-stack prototype extending India's **Unique Land Parcel Identification Number (ULPIN)** from traditional 2D land polygons into a **watertight 3D volumetric cadastre**.

This system solves multi-level vertical property rights, apartment unit title deeds, subsurface utility easements (water/sewer & power/telecom conduits), and airspace development clearances with real-time 3D spatial queries and topological collision detection.

---

## 🌟 The Problem: Why 2D Cadastres Fail for Multi-Level Properties

In traditional 2D land administration:
- An entire multi-storey apartment complex with 16+ distinct flat owners collapses into a **single 2D polygon footprint**.
- Subsurface utility conduits (telecom, sewer, metro tunnels) and airspace rights share the exact same $(X, Y)$ ground coordinates as the surface parcel.
- 2D registries cannot mathematically detect vertical encroachments, unauthorized floor construction, or underground infrastructure collisions.

---

## 🏛️ The Solution: 3D ULPIN Spatial Registry

This project establishes a standardized, deterministic 3D cadastral hierarchy:

```
Cadastral Parcel (P001)
 ├── Subsurface Easements (UG-B01 Basement, UG-C01 Telecom, UG-W01 Sewer Main)
 ├── Building Envelope (B01 - Soorya Apartments, Kolathur, Chennai)
 │    ├── Floor Slabs (F01..F04 @ 3.0m/floor)
 │    │    └── 16 Apartment Units (U101..U404 with independent 3D bounds)
 └── Vertical Airspace Right (AS-B01: 27m - 32m AMSL)
```

Each 3D spatial unit receives a deterministic **3D ULPIN Identifier** linked to:
1. **Vertical Bounds**: Exact $Z_{\min}$ and $Z_{\max}$ relative to the MSL elevation datum (Copernicus DEM $15.00\text{ m}$).
2. **Watertight 3D Geometry**: Exact metric volume ($V$) and floor area ($A$) in UTM Zone 44N (`EPSG:32644`).
3. **Cryptographic SHA-256 Title Hash**: Immutable deed integrity.
4. **Topological Non-Overlap Certificate**: 100% volume conservation with zero pairwise unit collision.

---

## 🚀 Key Features

* **Interactive 3D Cadastral Command Center**: Real-time WebGL/Three.js rendering with glassmorphic shaders, smooth orbit controls, and multi-angle camera presets.
* **Exploded 3D Architectural View**: Live vertical separation slider to inspect stacked floor plates, internal flat partitions, and subsurface pipes floating in space.
* **Point-in-Volume 3D Spatial Query**: Query any GPS coordinate + elevation ($X, Y, Z$) to identify the exact property owner, deed hash, or easement.
* **Real-Time 3D Conflict Detection Engine**: Evaluates topological validity, flagging illegal floor construction, volumetric overlaps, and subterranean conduit intrusions.
* **Full Data Lineage & Provenance**: Reconciled from **Microsoft AI Global Building Footprints** + **OpenStreetMap** + **Copernicus Global DEM 30m**.

---

## 📂 Project Architecture

```
Code2Create/
├── backend/                  # FastAPI 3D Cadastral Backend
│   ├── main.py               # API routes & static file server
│   ├── registry.py           # 3D ULPIN property identity registry
│   ├── spatial_query.py      # 3D Point-in-Mesh raycasting & bounds search
│   └── conflicts.py          # 3D topology & collision engine
│
├── frontend/                 # React + Vite + Three.js Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── CadastreViewer.jsx     # 3D WebGL viewport with exploded view & labels
│   │   │   ├── LayerPanel.jsx         # 3D layer controls & elevation slicer
│   │   │   ├── PropertyInspector.jsx  # Cadastral deed & SHA-256 inspector
│   │   │   ├── SpatialQueryPanel.jsx  # Interactive 3D point lookup
│   │   │   └── ConflictPanel.jsx      # Conflict simulator & telemetry
│   │   ├── App.jsx
│   │   └── index.css
│   └── dist/                 # Production web bundle
│
├── processing/               # Python 3D GIS & Reconcilliation Pipeline
│   ├── reconcile_footprints.py        # Microsoft ML + OSM spatial reconciliation
│   ├── resolve_b01_height.py          # DEM ground datum + storey height resolution
│   ├── reconstruct_b01_3d.py          # Watertight 3D extrusion to OBJ/GLB
│   ├── subdivide_b01_floors.py        # Vertical floor slab partitioning
│   ├── subdivide_b01_units.py         # 16-unit flat horizontal division
│   ├── create_b01_underground.py      # Subsurface utility & airspace modeling
│   ├── validate_b01_3d_topology.py    # 3D topology & conflict validation
│   └── generate_3d_ulpin.py           # 3D ULPIN identity registry generation
│
└── data/                     # GeoJSON, OBJ, and GLB datasets
    ├── aoi.geojson           # Kolathur, Chennai Area of Interest
    └── b01/                  # Hero building 3D assets & ULPIN registry
```

---

## 🛠️ Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Install Python dependencies
pip install fastapi uvicorn shapely geopandas trimesh scipy mapbox-earcut

# Start the FastAPI Server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 3. Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies and build
npm install
npm run build
```

### 4. Access the Dashboard
Open your browser and navigate to:
```
http://127.0.0.1:8000/
```

---

## 📊 Study Area Details (AOI)
* **Location**: Kolathur Central, Chennai, Tamil Nadu, India
* **Bounding Box**: $80.2050^\circ\text{E} \to 80.2180^\circ\text{E}$, $13.1180^\circ\text{N} \to 13.1300^\circ\text{N}$ (~1.88 km²)
* **Hero Building (B01)**: Soorya Apartments (`MS_00804` / `way/354496166`)
* **Datum**: $15.00\text{ m}$ AMSL (Copernicus DEM 30m)
* **Building Height**: $12.00\text{ m}$ ($4\text{ floors} \times 3.0\text{ m}$) $\to Z_{\max} = 27.00\text{ m}$

---

## 📜 License
MIT License. Built for spatial cadastral innovation and property identity transparency.
