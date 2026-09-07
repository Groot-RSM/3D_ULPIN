-- ============================================================================
-- 3D ULPIN | VIT VELLORE CAMPUS
-- Phase 2: Real-World SerpApi Evidence Storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS building_evidence (
    id BIGSERIAL PRIMARY KEY,
    building_id TEXT NOT NULL,
    building_name TEXT,
    match_status TEXT NOT NULL CHECK (match_status IN ('MATCH', 'UNCERTAIN', 'NO MATCH')),
    status_symbol TEXT,
    primary_title TEXT,
    primary_url TEXT,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources_count INTEGER,
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning-fast lookups and historical sorting
CREATE INDEX IF NOT EXISTS idx_building_evidence_building_id ON building_evidence(building_id);
CREATE INDEX IF NOT EXISTS idx_building_evidence_searched_at ON building_evidence(searched_at DESC);
