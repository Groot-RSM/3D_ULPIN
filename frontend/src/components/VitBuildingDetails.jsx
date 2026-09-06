import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Layers, Box, ExternalLink, ShieldCheck, CheckCircle2, Sparkles, Loader2, AlertTriangle, Scale, Check, RefreshCw } from 'lucide-react';

export default function VitBuildingDetails({
  building = null,
  is3dView = false,
  onToggle3dView = () => {}
}) {
  const [aiInsight, setAiInsight] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Reconciliation state
  const [reconciliation, setReconciliation] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [customFloorCount, setCustomFloorCount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideMsg, setOverrideMsg] = useState(null);

  const bId = building?.building_id || 'VIT-B001';
  const name = building?.name || 'Technology Tower (TT)';
  const lat = building?.centroid_lat || 12.9710;
  const lon = building?.centroid_lon || 79.1595;
  const area = building?.area_m2 || 4850;
  const height = building?.height_m || 36;
  const source = building?.source || 'OpenStreetMap / Microsoft Footprints';
  const sourceId = building?.source_id || 'osm_way_tt_01';
  const certainty = building?.data_certainty || 'DERIVED';

  // Load / Sync reconciliation data when selected building changes
  useEffect(() => {
    if (!building) return;
    setAiInsight(null);
    setOverrideMsg(null);
    setShowOverrideInput(false);

    if (building.reconciliation) {
      setReconciliation(building.reconciliation);
    } else {
      setLoadingRec(true);
      fetch(`http://127.0.0.1:8000/api/vit/buildings/${bId}/reconcile-floors`)
        .then(res => res.json())
        .then(data => {
          setReconciliation(data);
          setLoadingRec(false);
        })
        .catch(err => {
          console.error("Error fetching floor reconciliation:", err);
          setLoadingRec(false);
        });
    }
  }, [bId, building]);

  if (!building) {
    return (
      <div style={{ padding: '24px 16px', color: '#94a3b8', fontSize: '12.5px', textAlign: 'center' }}>
        Select a building polygon from the VIT campus map or building list to inspect details.
      </div>
    );
  }

  const getCertaintyColor = (c) => {
    if (c === 'OBSERVED' || c === 'OBSERVED_REAL_OSM' || c === 'SURVEY_CONFIRMED') return '#34d399';
    if (c === 'DERIVED') return '#7dd3fc';
    return '#fbbf24';
  };

  const getAgreementBadge = (status) => {
    switch (status) {
      case 'EXACT':
        return { label: 'MATCH (EXACT)', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', icon: CheckCircle2 };
      case 'MANUAL_OVERRIDE':
        return { label: 'SURVEYOR OVERRIDE', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', icon: ShieldCheck };
      case 'MINOR_DISCREPANCY':
        return { label: 'MINOR DISCREPANCY (±1)', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', icon: AlertTriangle };
      case 'SOURCE_CONFLICT':
        return { label: 'SOURCE CONFLICT', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', icon: AlertTriangle };
      case 'OSM_NOT_AVAILABLE':
        return { label: 'OSM NOT AVAILABLE', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', icon: Scale };
      default:
        return { label: status || 'PENDING', color: '#cbd5e1', bg: 'rgba(255,255,255,0.08)', icon: Scale };
    }
  };

  const handleApplyOverride = (count, reasonStr) => {
    const val = parseInt(count);
    if (!val || val <= 0) return;
    setLoadingRec(true);
    fetch(`http://127.0.0.1:8000/api/vit/buildings/${bId}/override-floors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        override_floor_count: val,
        reason: reasonStr || overrideReason || 'Manual surveyor override',
        user: 'Officer Surveyor'
      })
    })
      .then(res => res.json())
      .then(data => {
        setReconciliation(data);
        setLoadingRec(false);
        setShowOverrideInput(false);
        setOverrideMsg(`Applied ${val} floors override!`);
        setTimeout(() => setOverrideMsg(null), 3000);
      })
      .catch(err => {
        console.error("Override error:", err);
        setLoadingRec(false);
      });
  };

  const handleGenerateAiInsight = () => {
    setLoadingAi(true);
    setAiInsight(null);
    fetch('http://127.0.0.1:8000/api/vit/ai-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ building_id: bId })
    })
      .then(res => res.json())
      .then(data => {
        setAiInsight(data.insight);
        setLoadingAi(false);
      })
      .catch(err => {
        console.error("AI Insight error:", err);
        setAiInsight(`• ${name} encompasses ${area.toLocaleString()} m² footprint area with height ${height}m.\n• Floor Count Reconciled: ${reconciliation?.final_floor_count || 'N/A'} floors.`);
        setLoadingAi(false);
      });
  };

  const agreeBadge = getAgreementBadge(reconciliation?.agreement_status);
  const BadgeIcon = agreeBadge.icon;

  return (
    <div style={{ padding: '16px 14px', color: '#f8fafc', overflowY: 'auto', flex: 1, minHeight: 0, boxSizing: 'border-box' }}>
      
      {/* HEADER */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8', fontWeight: '700', marginBottom: '4px' }}>
          Selected VIT Building
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#fff', lineHeight: '1.3' }}>
          {name}
        </h2>
      </div>

      {/* ALIGNED DETAILS ROWS */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        
        <div className="detail-row-aligned">
          <span className="detail-label-text">Building Name</span>
          <span className="detail-value-text" style={{ color: '#fbbf24' }}>{name}</span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Building ID</span>
          <span style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
            {bId}
          </span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Cadastral 3D ULPIN</span>
          <span style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px', fontSize: '10.5px', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
            {building.ulpin || `ULPIN-IN-TN-VEL-${bId}`}
          </span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Centroid</span>
          <span className="detail-value-text" style={{ fontFamily: 'var(--font-mono)' }}>
            {lat.toFixed(6)}° N, {lon.toFixed(6)}° E
          </span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Footprint Area</span>
          <span className="detail-value-text" style={{ color: '#fbbf24', fontSize: '13px' }}>
            {area.toLocaleString()} m²
          </span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Building Height</span>
          <span className="detail-value-text">{height} m</span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Data Source</span>
          <span className="detail-value-text" style={{ fontSize: '11px' }}>{source}</span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Source ID</span>
          <span className="detail-value-text" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{sourceId}</span>
        </div>

        <div className="detail-row-aligned">
          <span className="detail-label-text">Data Certainty</span>
          <span className="detail-value-text" style={{ color: getCertaintyColor(certainty) }}>{certainty}</span>
        </div>
      </div>

      {/* STEP 3 & 7: VERTICAL STRUCTURE ANALYSIS & RECONCILIATION PANEL */}
      <div style={{ marginTop: '16px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>
            <Scale size={15} color="#38bdf8" />
            <span>VERTICAL STRUCTURE ANALYSIS</span>
          </div>
          <span style={{
            fontSize: '10px',
            background: agreeBadge.bg,
            color: agreeBadge.color,
            border: `1px solid ${agreeBadge.color}`,
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <BadgeIcon size={12} />
            {agreeBadge.label}
          </span>
        </div>

        {loadingRec ? (
          <div style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '11.5px' }}>
            <Loader2 size={16} className="animate-spin" style={{ margin: '0 auto 6px' }} />
            Reconciling multi-source floor evidence...
          </div>
        ) : reconciliation ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '6px 8px' }}>
                <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '600' }}>OSM Levels</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: reconciliation.floor_count_osm ? '#34d399' : '#f87171', marginTop: '2px' }}>
                  {reconciliation.floor_count_osm ? `${reconciliation.floor_count_osm}` : 'N/A'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '6px 8px' }}>
                <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '600' }}>Height Est.</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>
                  {reconciliation.floor_count_height_estimate ? `${reconciliation.floor_count_height_estimate}` : 'N/A'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '6px 8px' }}>
                <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '600' }}>Verified Survey</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: building.verified_floor_count ? '#38bdf8' : '#64748b', marginTop: '2px' }}>
                  {building.verified_floor_count ? `${building.verified_floor_count}` : 'NULL'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Final Floor Count:</span>
                <span style={{ fontWeight: '800', color: '#38bdf8' }}>{reconciliation.final_floor_count} Floors (G + {Math.max(0, reconciliation.final_floor_count - 1)})</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Floor Source Used:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: '#fbbf24', fontWeight: '700' }}>
                  {building.floor_count_source || reconciliation.generation_method}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Verification Status:</span>
                <span style={{ fontWeight: '800', color: building.verification_status === 'VERIFIED' ? '#34d399' : '#fbbf24' }}>
                  {building.verification_status || (reconciliation.review_required ? 'UNVERIFIED' : 'DERIVED')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Avg Floor Height:</span>
                <span style={{ fontWeight: '700', color: '#f8fafc' }}>{reconciliation.average_floor_height_m} m/floor</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Confidence Tier:</span>
                <span style={{ fontWeight: '800', color: reconciliation.confidence_tier === 'HIGH' ? '#34d399' : reconciliation.confidence_tier === 'MEDIUM' ? '#fbbf24' : '#f87171' }}>
                  {reconciliation.confidence_tier} CONFIDENCE
                </span>
              </div>
            </div>

            {/* ALERT IF REVIEW REQUIRED OR SOURCE CONFLICT */}
            {reconciliation.review_required && (
              <div style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.4)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '11px', fontWeight: '800' }}>
                  <AlertTriangle size={13} />
                  <span>{reconciliation.agreement_status === 'SOURCE_CONFLICT' ? '⚠ SOURCE CONFLICT DETECTED' : 'UNVERIFIED — REVIEW RECOMMENDED'}</span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#e2e8f0', marginTop: '2px' }}>
                  {reconciliation.floor_count_osm ? `OSM levels (${reconciliation.floor_count_osm}) vs Height estimate (${reconciliation.floor_count_height_estimate}). Official surveyor confirmation pending.` : 'OSM level tag unavailable. Using height-derived estimate.'}
                </div>
              </div>
            )}

            {/* MANUAL OVERRIDE CONTROLS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '10px' }}>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Officer Override Controls
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {reconciliation.floor_count_osm && (
                  <button
                    onClick={() => handleApplyOverride(reconciliation.floor_count_osm, "Use OSM Levels")}
                    style={{ flex: 1, background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', color: '#34d399', padding: '4px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Use OSM ({reconciliation.floor_count_osm})
                  </button>
                )}

                {reconciliation.floor_count_height_estimate && (
                  <button
                    onClick={() => handleApplyOverride(reconciliation.floor_count_height_estimate, "Use Height Estimate")}
                    style={{ flex: 1, background: 'rgba(251, 191, 36, 0.15)', border: '1px solid #fbbf24', color: '#fbbf24', padding: '4px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Use Height ({reconciliation.floor_count_height_estimate})
                  </button>
                )}

                <button
                  onClick={() => setShowOverrideInput(!showOverrideInput)}
                  style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '4px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Custom
                </button>
              </div>

              {showOverrideInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                  <input
                    type="number"
                    placeholder="Enter floor count (e.g. 6)"
                    value={customFloorCount}
                    onChange={(e) => setCustomFloorCount(e.target.value)}
                    style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '5px 8px', borderRadius: '4px', fontSize: '11px' }}
                  />
                  <input
                    type="text"
                    placeholder="Reason (e.g. Verified by BIM / Field Survey)"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '5px 8px', borderRadius: '4px', fontSize: '11px' }}
                  />
                  <button
                    onClick={() => handleApplyOverride(customFloorCount, overrideReason)}
                    style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Confirm Override
                  </button>
                </div>
              )}

              {overrideMsg && (
                <div style={{ fontSize: '10.5px', color: '#34d399', textAlign: 'center', fontWeight: '700', marginTop: '4px' }}>
                  ✓ {overrideMsg}
                </div>
              )}
            </div>

          </div>
        ) : null}
      </div>

      {/* GEMINI AI SPATIAL INTELLIGENCE SECTION */}
      <div style={{ marginTop: '16px', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.18), rgba(124, 58, 237, 0.12))', border: '1px solid rgba(124, 58, 237, 0.4)', borderRadius: '12px', padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a78bfa', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>
            <Sparkles size={15} color="#c084fc" />
            <span>GEMINI AI SPATIAL INSIGHT</span>
          </div>
          <span style={{ fontSize: '9px', background: 'rgba(192, 132, 252, 0.2)', color: '#e9d5ff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
            GEMINI FLASH
          </span>
        </div>

        {aiInsight ? (
          <div style={{ fontSize: '11.5px', color: '#e2e8f0', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
            {aiInsight}
          </div>
        ) : (
          <button
            onClick={handleGenerateAiInsight}
            disabled={loadingAi}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: loadingAi ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)'
            }}
          >
            {loadingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{loadingAi ? 'Analyzing Cadastral Data...' : '✨ Generate Gemini AI Insight'}</span>
          </button>
        )}
      </div>

      {/* VIEW IN 3D BUTTON */}
      <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
        <button
          onClick={onToggle3dView}
          style={{
            width: '100%',
            background: is3dView ? 'linear-gradient(135deg, #0284c7, #4f46e5)' : 'linear-gradient(135deg, #d97706, #f59e0b)',
            border: 'none',
            color: '#fff',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '800',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
          }}
        >
          <Box size={16} />
          <span>VIEW FLOORS / 3D BUILDING INSPECTOR</span>
        </button>
      </div>

    </div>
  );
}
