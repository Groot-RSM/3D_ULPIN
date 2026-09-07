# 🏛️ 3D ULPIN: Next-Generation 3D Cadastral & Volumetric Spatial Identity Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg?logo=three.js)](https://threejs.org/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-6.7+-blue.svg?logo=maplibre&logoColor=white)](https://maplibre.org/)
[![SerpApi](https://img.shields.io/badge/SerpApi-Live_Ground_Truth-4285F4.svg?logo=google&logoColor=white)](https://serpapi.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Evidence_Store-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com/)
[![Status](https://img.shields.io/badge/3D_Topology-100%25_Validated-success.svg)]()

> A full-scale **3D Cadastral Digital Twin & Volumetric Land Parcel Identification** platform extending India's **Unique Land Parcel Identification Number (ULPIN)** from flat 2D surface parcels into **stratified 3D volumetric property identifiers** with vertical room-level subdivisions, subterranean utility easements, airspace development rights, and **real-world ground-truth verification powered by SerpApi**.

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

## 🔍 SerpApi Integration: Real-World Public Ground-Truth & Evidence Engine

A core innovation in the **3D ULPIN Platform** is the integration of **[SerpApi](https://serpapi.com/)** for autonomous, real-world public evidence harvesting, multi-source corroboration, and spatial layout strategy generation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SerpApi Ground-Truth Pipeline                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
               1. User queries building or loads property record
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │       SerpApi Google Search Query Engine         │
             │   Query: "{Building Name} VIT Vellore floors"    │
             │   Location: Vellore, Tamil Nadu, India           │
             └──────────────────────────────────────────────────┘
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │      Evidence Extraction & Corroboration         │
             │   • Web snippets & Official VIT disclosures      │
             │   • Construction reports & sanctioned floors     │
             │   • Real-world photos, lab facilities & layout   │
             └──────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
   ┌─────────────────────────────────┐ ┌─────────────────────────────────┐
   │    Supabase Evidence Cache      │ │  Deterministic Layout Strategy  │
   │  Persists evidence, citations,  │ │  Guides Shapely CAD subdivision │
   │  and confidence score (0.95+)   │ │  (Auditorium / Classrooms / Lab)│
   └─────────────────────────────────┘ └─────────────────────────────────┘
```

### 🎯 Key Roles of SerpApi in 3D ULPIN:

1. **Autonomous Ground-Truth Discovery**:
   - Queries Google via SerpApi using localized geographic targeting (`Vellore, Tamil Nadu, India`).
   - Extracts structured facts including building usage, total storeys, construction phase, and department wings.

2. **Multi-Source Corroboration**:
   - Cross-checks cadastral survey records with live internet intelligence to flag discrepancies (e.g. newly added floors, rooftop solar installations).

3. **Functional Typology Classification**:
   - Analyzes web evidence to dynamically classify building functional zones:
     - **Auditorium Stilt**: Single large-volume ground auditorium + upper classrooms (e.g. *Technology Tower*).
     - **Multi-Courtyard Tower**: Bilateral academic wings flanking internal lightwells (e.g. *Silver Jubilee Tower*).
     - **Administrative Hex-Atrium**: Central open-air landscaped courtyard (e.g. *Dr. M.G.R. Block*).
     - **Biomedical Research Labs**: High-density laboratory units (e.g. *CBMR*).

4. **Persistent Evidence Caching in Supabase**:
   - Harvested evidence, source links, search query strings, and timestamped confidence scores are persisted into the `building_evidence` Supabase table. Subsequent queries retrieve cached evidence instantly without consuming redundant API quota.

---

## 🏛️ Authoritative ULPIN Standard & Volumetric Cadastre

Every spatial entity is assigned an authoritative, deterministic **3D ULPIN Identifier**:

* **Standard Format**: `ULPIN-IN-TN-VEL-{UnitCode}` (e.g., `ULPIN-IN-TN-VEL-TT-101`) — *strictly without arbitrary `-3D` suffixes*.
* **Common Infrastructure Exemption**: Shared elevator shafts and open circulation corridors are tagged `is_common_infrastructure: True` with `official_ulpin: None`.
* **Watertight Solid Geometry**: Metric volume ($V$) and surface footprint ($A$) computed in EPSG:32644 (UTM 44N).

### Verified Building Schedule:
| Building | Property ID | Levels | Sanctioned Units | Subdivided ULPIN Range |
| :--- | :---: | :---: | :---: | :--- |
| **Technology Tower (TT)** | `VIT-B001` | 8 | 306 | `ULPIN-IN-TN-VEL-TT-G01` → `ULPIN-IN-TN-VEL-TT-730` |
| **Silver Jubilee Tower (SJT)** | `VIT-B002` | 8 | 301 | `ULPIN-IN-TN-VEL-SJT-G01` → `ULPIN-IN-TN-VEL-SJT-738` |
| **Dr. M.G.R. Block (Main Building)** | `VIT-B003` | 5 | 126 | `ULPIN-IN-TN-VEL-MGR-B01` → `ULPIN-IN-TN-VEL-MGR-317` |
| **G.D. Naidu Block** | `VIT-B004` | 2 | 78 | `ULPIN-IN-TN-VEL-GDN-G01` → `ULPIN-IN-TN-VEL-GDN-153` |
| **CBMR - Center for Biomedical Research** | `VIT-B007` | 5 | 156 | `ULPIN-IN-TN-VEL-CBMR-G01` → `ULPIN-IN-TN-VEL-CBMR-443` |

---

## 🕹️ Interactive Features

1. **Interactive 3D Satellite Campus Map**:
   - MapLibre GL 3D vector canvas with Mapbox Satellite layer and 3D extruded building envelopes.
   - Smooth $50^\circ$ pitch camera fly-to transitions and instant parcel highlighting.

2. **Move & Calibrate Spatial Positioning Tool**:
   - **Interactive Pin Dragging**: Drag building footprints across satellite imagery in real time.
   - **4-Way Precision D-Pad**: Nudge buildings North, South, East, or West with sub-meter accuracy.
   - **Rotate & Scale Controls**: Micro-rotate ($\pm 5^\circ$) and scale ($\pm 3\%$) to match satellite features.
   - **Direct Persistence**: Click **Save Position** to write updated geometries directly to `campus_footprints.geojson`.

3. **3D Exploded Floor Inspector (Three.js WebGL)**:
   - High-contrast visual palette: Cadastral Blue structure, Vivid Golden Yellow active floor, and **Electric Radiant Ruby Crimson (`#ff0055`)** selected room highlight with glowing white edges.
   - Continuous vertical floor separation slider, room wireframes, and instant GLTF / GLB 3D export.

4. **Automated Sanction Permit PDF Generator & Verification**:
   - Generates official Tamil Nadu DTCP Building Permit & 3D Cadastral Sanction Orders.
   - Includes full volumetric parameters, floor subdivision tables, authoritative ULPIN identifier ranges, and cryptographic SHA-256 digital seals.

---

## 🏗️ Project Architecture

```
3D_ULPIN_Code2create/
├── backend/                       # FastAPI High-Performance Backend
│   ├── main.py                    # REST API endpoints & static server
│   ├── serpapi_service.py         # SerpApi Ground-Truth Evidence & Strategy Engine
│   ├── supabase_service.py        # Supabase Evidence & Cadastre persistence
│   ├── vit_service.py             # VIT spatial geometry & calibration manager
│   ├── generate_permit_pdf.py     # ReportLab DTCP Permit PDF generator
│   ├── floor_layout_engine.py     # Deterministic Shapely room layout generator
│   └── services/
│       ├── cadastral_3d_service.py # 3D volumetric room & lift core generator
│       └── document_service.py    # Document parser & ULPIN schedule reconciler
│
├── frontend/                      # React 19 + Vite + Three.js Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── VitCampusMap.jsx         # MapLibre 3D map + Move & Calibrate Tool
│   │   │   ├── Vit3DBuildingViewer.jsx  # Three.js 3D exploded floor inspector
│   │   │   ├── VitBuildingDetails.jsx   # Building details, SerpApi card & exports
│   │   │   └── DocumentVerificationPanel.jsx # Document upload & PDF verification
│   │   ├── config.js                    # API & Map credentials
│   │   └── index.css                    # Cyberpunk glassmorphic design system
│   └── vite.config.js
│
├── data/                          # Spatial & Cadastral Data
│   ├── vit_vellore/
│   │   └── campus_footprints.geojson # Authoritative campus building polygons
│   └── samples/                   # Generated DTCP Building Permit PDFs
│
└── tests/                         # Test Suite
    └── test_phase_6b_quality.py   # 23 automated quality & topology tests (100% pass)
```

---

## ⚡ Quick Start & Setup

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- SerpApi Key *(optional for live search; offline cache included)*

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/satheesh067/Explanation.git
cd Explanation

# Install Python dependencies
pip install fastapi uvicorn reportlab shapely pydantic requests

# Configure Environment Variables in .env
SERPAPI_API_KEY=your_serpapi_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Start the FastAPI Backend Server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite Development Server
npm run dev
```

Visit **`http://localhost:5173/`** to interact with the 3D ULPIN platform.

---

## 🧪 Running Automated Tests

Run the complete 23-test quality and topology verification suite:
```bash
python -m pytest tests/test_phase_6b_quality.py -v
```

---

## 📜 License & Acknowledgments
Built for next-generation spatial cadastre digital twins and smart governance. Special thanks to **DTCP Tamil Nadu**, **Survey of India**, and the **Vellore Institute of Technology (VIT)** spatial dataset.
