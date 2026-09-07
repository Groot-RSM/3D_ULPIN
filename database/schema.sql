-- =====================================================================
-- 3D ULPIN CADASTRAL DIGITAL TWIN - COMPACT SUPABASE POSTGIS SCHEMA
-- Principle: Store Facts; Derive Repetitive Geometry Dynamically
-- =====================================================================

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Drop existing tables if re-initializing
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS parcels CASCADE;

-- 3. PARCELS TABLE
-- Stores parent land parcel boundaries with internal identifier & optional official ULPIN
CREATE TABLE parcels (
    id BIGSERIAL PRIMARY KEY,
    parcel_id TEXT NOT NULL UNIQUE,              -- e.g. "P-VIT-001"
    official_ulpin TEXT UNIQUE,                  -- NULL until official gov deed issued
    name TEXT NOT NULL,                          -- e.g. "VIT Vellore Main Campus"
    geometry GEOMETRY(Polygon, 4326),            -- Parent Cadastral Parcel Boundary
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BUILDINGS TABLE
-- Compact vertical configuration. Repetitive floor slices & units are dynamically derived by Python.
CREATE TABLE buildings (
    id BIGSERIAL PRIMARY KEY,
    parcel_id BIGINT NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    building_no INTEGER NOT NULL,                -- e.g. 1, 2, 3...
    building_code TEXT UNIQUE NOT NULL,          -- e.g. "VIT-B001", "VIT-B002"
    building_name TEXT NOT NULL,                 -- e.g. "Technology Tower (TT)"
    building_type TEXT DEFAULT 'EDUCATIONAL_ACADEMIC',
    centroid_lat DOUBLE PRECISION NOT NULL,
    centroid_lon DOUBLE PRECISION NOT NULL,
    area_m2 DOUBLE PRECISION NOT NULL,
    footprint GEOMETRY(Polygon, 4326) NOT NULL,  -- Real OSM/LiDAR/Survey footprint
    footprint_geojson JSONB NOT NULL,            -- GeoJSON representation for WebGL
    total_floors INTEGER NOT NULL DEFAULT 4,
    units_per_floor INTEGER NOT NULL DEFAULT 4,  -- 3D visualization subdivision config
    floor_height NUMERIC(6,2) NOT NULL DEFAULT 4.00,
    total_height_m NUMERIC(6,2) NOT NULL,
    source TEXT DEFAULT 'OpenStreetMap / Survey',
    source_building_id TEXT,
    verification_status TEXT DEFAULT 'VERIFIED', -- "VERIFIED", "SURVEYOR_OVERRIDE", "DERIVED"
    confidence_tier TEXT DEFAULT 'HIGH',         -- "HIGH", "MEDIUM", "LOW"
    unit_configuration_source TEXT DEFAULT 'DERIVED',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Spatial Indexes & Optimization
CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON parcels USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_buildings_footprint ON buildings USING GIST (footprint);
CREATE INDEX IF NOT EXISTS idx_buildings_code ON buildings (building_code);
CREATE INDEX IF NOT EXISTS idx_buildings_parcel ON buildings (parcel_id);

-- 6. Row Level Security (RLS) - Public Read Access for WebGL & Cadastral Queries
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public parcels read" ON parcels FOR SELECT USING (true);
CREATE POLICY "Public buildings read" ON buildings FOR SELECT USING (true);
CREATE POLICY "Service role full access parcels" ON parcels USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access buildings" ON buildings USING (true) WITH CHECK (true);
