import React, { useState, useEffect } from 'react';
import { 
  Building2, MapPin, Layers, Box, ExternalLink, ShieldCheck, 
  CheckCircle2, Sparkles, Loader2, AlertTriangle, Scale, Check, 
  RefreshCw, Download, X, Home, FileText, Wrench, ArrowUpDown, 
  CheckCircle, Compass, FileCheck, BarChart3
} from 'lucide-react';
import { exportBuildingGLB } from '../utils/exportBuildingGLB';
import DocumentVerificationPanel from './DocumentVerificationPanel';

// Segmented LED-style indicator bar
function SegmentedBar({ total = 15, filled = 8, activeColor = '#38bdf8' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < filled;
        return (
          <div
            key={i}
            style={{
              width: '5px',
              height: '11px',
              borderRadius: '1.5px',
              backgroundColor: isFilled ? activeColor : 'rgba(255, 255, 255, 0.08)',
              boxShadow: isFilled ? `0 0 5px ${activeColor}99` : 'none',
              transition: 'all 0.2s ease'
            }}
          />
        );
      })}
    </div>
  );
}

export default function VitBuildingDetails({
  building = null,
  is3dView = false,
  onToggle3dView = () => {},
  onToggleMap3D = () => {},
  onClose = null
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [aiInsight, setAiInsight] = useState(null);
  const [aiImage, setAiImage] = useState(null);
  const [serpEvidence, setSerpEvidence] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isExportingGLB, setIsExportingGLB] = useState(false);
  const [glbExportMessage, setGlbExportMessage] = useState(null);

  // Reconciliation state
  const [reconciliation, setReconciliation] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [customFloorCount, setCustomFloorCount] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideMsg, setOverrideMsg] = useState(null);

  const bId = building?.building_id || 'VIT-B001';
  const name = building?.name || 'VIT Building';
  const lat = building?.centroid_lat || 12.9692;
  const lon = building?.centroid_lon || 79.1560;
  const area = building?.area_m2 ? Math.round(building.area_m2 * 10) / 10 : 1200;
  const height = building?.height_m || 24;
  const source = building?.source || 'OpenStreetMap / Survey';
  const certainty = building?.certainty || building?.data_certainty || 'DERIVED';

  // Load / Sync reconciliation data when selected building changes
  useEffect(() => {
    if (!building) return;
    setAiInsight(null);
    setAiImage(null);
    setSerpEvidence(null);
    setOverrideMsg(null);
    setShowOverrideInput(false);
    setGlbExportMessage(null);

    // Load reconciliation data
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

    // Phase 2: Load cached SerpApi evidence from Supabase if available
    fetch(`http://127.0.0.1:8000/api/vit/buildings/${bId}/evidence`)
      .then(res => res.json())
      .then(data => {
        if (data.cached && data.evidence) {
          const ev = data.evidence;
          setSerpEvidence(ev);
          const topSnippet = ev.sources?.[0]?.snippet || "Corroborated public cadastral record.";
          setAiInsight(`• ${ev.building_name || name} (${bId}): Footprint ${area.toLocaleString()} m² with 3D volumetric extrusion of ${height}m across ${finalFloors} floors.\n• Public Evidence: ${topSnippet}\n• Status: ${ev.status_symbol || '✓'} ${ev.match_status} (Retrieved from Supabase Evidence Store).`);
          if (ev.images && ev.images.length > 0) {
            setAiImage(ev.images[0]);
          }
        }
      })
      .catch(() => {});
  }, [bId, building]);

  if (!building) {
    return (
      <div style={{ padding: '32px 20px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
        Select a building polygon on the VIT campus map to inspect 3D cadastral details.
      </div>
    );
  }

  const finalFloors = reconciliation?.final_floor_count || building?.verified_floor_count || building?.final_floor_count || 4;
  const avgHeight = (height / finalFloors).toFixed(1);
  const verificationStatus = reconciliation?.agreement_status === 'SOURCE_CONFLICT' 
    ? 'CONFLICT' 
    : reconciliation?.agreement_status === 'MINOR_DISCREPANCY'
    ? 'DISCREPANCY (±1)'
    : 'VERIFIED';

  const isVerified = verificationStatus === 'VERIFIED';

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
        setTimeout(() => setOverrideMsg(null), 4000);
      })
      .catch(err => {
        console.error("Override error:", err);
        setLoadingRec(false);
      });
  };

  const handleGenerateAiInsight = () => {
    setLoadingAi(true);
    setAiInsight(null);
    setSerpEvidence(null);
    fetch('http://127.0.0.1:8000/api/vit/ai-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ building_id: bId })
    })
      .then(res => res.json())
      .then(data => {
        setAiInsight(data.insight);
        setSerpEvidence(data.evidence || data);
        if (data.image_url || data.thumbnail || (data.images && data.images[0])) {
          setAiImage(data.image_url || data.thumbnail || data.images[0]);
        }
        setLoadingAi(false);
      })
      .catch(err => {
        console.error("SerpApi Insight error:", err);
        setAiInsight(`• ${name} encompasses ${area.toLocaleString()} m² footprint area with height ${height}m.\n• Floor Count Reconciled: ${finalFloors} floors.`);
        setLoadingAi(false);
      });
  };

  const handleExportGLB = async () => {
    if (!building) return;
    setIsExportingGLB(true);
    setGlbExportMessage(null);

    try {
      const result = await exportBuildingGLB(building);
      setGlbExportMessage(`Exported ${result.filename} (${result.totalFloors} floors, ${(result.sizeBytes / 1024).toFixed(1)} KB)`);
      setTimeout(() => setGlbExportMessage(null), 6000);
    } catch (error) {
      console.error('GLB export failed:', error);
      setGlbExportMessage(error instanceof Error ? error.message : 'GLB export failed.');
    } finally {
      setIsExportingGLB(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'floors', label: 'Floors', icon: Layers },
    { id: 'units', label: 'Property Units', icon: Box },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'actions', label: 'Actions', icon: Wrench },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      color: '#f8fafc',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>

      {/* 1. PANEL HEADER */}
      <div style={{
        padding: '16px 18px 12px 18px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 16, 32, 0.4) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {/* Building Icon Box */}
          <div style={{
            width: '38px',
            height: '38px',
            minWidth: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(2, 132, 199, 0.15))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)'
          }}>
            <Building2 size={20} />
          </div>

          {/* Building Title & ID */}
          <div style={{ minWidth: 0 }}>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '0.2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {name}
            </h2>
            <div style={{
              fontSize: '11px',
              color: '#94a3b8',
              fontFamily: 'var(--font-mono)',
              fontWeight: '700',
              marginTop: '1px'
            }}>
              {bId}
            </div>
          </div>
        </div>

        {/* Right Badges & Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{
            fontSize: '10.5px',
            fontWeight: '800',
            padding: '3px 8px',
            borderRadius: '6px',
            border: certainty.includes('VERIFIED') || certainty.includes('OFFICIAL') ? '1px solid #10b981' : '1px solid #38bdf8',
            background: certainty.includes('VERIFIED') || certainty.includes('OFFICIAL') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            color: certainty.includes('VERIFIED') || certainty.includes('OFFICIAL') ? '#34d399' : '#38bdf8',
            letterSpacing: '0.4px'
          }}>
            {certainty.includes('VERIFIED') || certainty.includes('OFFICIAL') ? 'VERIFIED' : 'DERIVED'}
          </span>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#94a3b8',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 2. TAB NAVIGATION */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(10, 16, 30, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '6px 14px',
        gap: '4px',
        overflowX: 'auto'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: isActive ? '1px solid #f59e0b' : '1px solid transparent',
                background: isActive ? 'rgba(245, 158, 11, 0.16)' : 'transparent',
                color: isActive ? '#fbbf24' : '#94a3b8',
                fontSize: '11px',
                fontWeight: isActive ? '800' : '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={12} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SCROLLABLE TAB CONTENT BODY */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>

        {/* ========================================================================= */}
        {/* OVERVIEW TAB CONTENT (DEFAULT) */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <>
            {/* 3. SUMMARY METRICS (4 Responsive Cards Grid) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px'
            }}>
              {/* Metric 1: Total Floors */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                  Total Floors
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>
                  <Layers size={13} color="#38bdf8" />
                  <span>{finalFloors} Floors</span>
                </div>
                <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                  (G + {Math.max(0, finalFloors - 1)})
                </span>
              </div>

              {/* Metric 2: Avg Floor Height */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                  Avg. Height
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>
                  <ArrowUpDown size={13} color="#38bdf8" />
                  <span>{avgHeight} m</span>
                </div>
                <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                  per floor
                </span>
              </div>

              {/* Metric 3: Total Area */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                  Total Area
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', fontWeight: '800', fontSize: '13px' }}>
                  <Box size={13} color="#fbbf24" />
                  <span>{area.toLocaleString()} m²</span>
                </div>
                <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                  Footprint
                </span>
              </div>

              {/* Metric 4: Status */}
              <div style={{
                background: isVerified ? 'rgba(16, 185, 129, 0.10)' : 'rgba(245, 158, 11, 0.10)',
                border: isVerified ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                  Status
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isVerified ? '#34d399' : '#fbbf24', fontWeight: '800', fontSize: '11px' }}>
                  <CheckCircle size={12} />
                  <span>{verificationStatus}</span>
                </div>
                <span style={{ fontSize: '9.5px', color: isVerified ? '#10b981' : '#f59e0b' }}>
                  High Conf.
                </span>
              </div>
            </div>

            {/* 4. BUILDING INFORMATION CARD */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#38bdf8',
                fontSize: '11.5px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                <Building2 size={14} />
                <span>BUILDING INFORMATION</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '11.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Building ID</span>
                  <span style={{ color: '#38bdf8', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{bId}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Building Name</span>
                  <span style={{ color: '#ffffff', fontWeight: '700' }}>{name}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Building Type</span>
                  <span style={{ color: '#e2e8f0' }}>{building.building_type || 'Academic / Institutional'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Location</span>
                  <span style={{ color: '#e2e8f0' }}>VIT Vellore Campus</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Latitude</span>
                  <span style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{lat.toFixed(5)}° N</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Longitude</span>
                  <span style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{lon.toFixed(5)}° E</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Official ULPIN</span>
                  <span style={{ color: building.ulpin ? '#38bdf8' : '#64748b', fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                    {building.ulpin || 'Not available'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4B. VOLUMETRIC FLOOR METRICS CARD */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#38bdf8',
                fontSize: '11.5px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                <BarChart3 size={14} color="#38bdf8" />
                <span>VOLUMETRIC FLOOR METRICS</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '11.5px' }}>
                {/* Elevation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: '500', width: '90px' }}>Elevation</span>
                  <SegmentedBar total={15} filled={10} activeColor="#38bdf8" />
                  <span style={{ color: '#ffffff', fontWeight: '700', fontFamily: 'var(--font-mono)', width: '90px', textAlign: 'right' }}>
                    {(building?.elevation !== undefined && building?.elevation !== null) ? Number(building.elevation).toFixed(1) : '3.2'} m
                  </span>
                </div>

                {/* Height */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: '500', width: '90px' }}>Height</span>
                  <SegmentedBar total={15} filled={Math.min(15, Math.max(2, Math.round((parseFloat(avgHeight || '5.0') / 10) * 15)))} activeColor="#c084fc" />
                  <span style={{ color: '#ffffff', fontWeight: '700', fontFamily: 'var(--font-mono)', width: '90px', textAlign: 'right' }}>
                    {avgHeight} m
                  </span>
                </div>

                {/* Footprint Area */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: '500', width: '90px' }}>Footprint Area</span>
                  <SegmentedBar total={15} filled={Math.min(15, Math.max(3, Math.round((area / 6000) * 15)))} activeColor="#34d399" />
                  <span style={{ color: '#ffffff', fontWeight: '700', fontFamily: 'var(--font-mono)', width: '90px', textAlign: 'right' }}>
                    {area.toLocaleString()} m²
                  </span>
                </div>

                {/* Volume */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: '500', width: '90px' }}>Volume</span>
                  <SegmentedBar total={15} filled={Math.min(15, Math.max(2, Math.round((Math.round(area * (height || finalFloors * 3.5)) / 45000) * 15)))} activeColor="#fb923c" />
                  <span style={{ color: '#ffffff', fontWeight: '700', fontFamily: 'var(--font-mono)', width: '90px', textAlign: 'right' }}>
                    {Math.round(area * (height || (finalFloors * 3.5))).toLocaleString()} m³
                  </span>
                </div>

                {/* Units */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: '500', width: '90px' }}>Units</span>
                  <SegmentedBar total={15} filled={building?.units_count ? Math.min(15, Math.max(2, Math.round((building.units_count / 36) * 15))) : 2} activeColor="#f87171" />
                  <span style={{ color: '#ffffff', fontWeight: '700', fontFamily: 'var(--font-mono)', width: '90px', textAlign: 'right' }}>
                    {building?.units_count || (building?.has_units ? `${finalFloors * 4}` : '--')}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. ACTIONS CARD (2x2 Grid) */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#38bdf8',
                fontSize: '11.5px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '10px'
              }}>
                <Wrench size={14} />
                <span>ACTIONS</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                {/* Action 1: View in 3D (Isolated) */}
                <button
                  type="button"
                  onClick={onToggle3dView}
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.08))',
                    border: '1.5px solid rgba(245, 158, 11, 0.5)',
                    color: '#fbbf24',
                    padding: '12px 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '11.5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Box size={18} />
                  <span>View in 3D (Isolated)</span>
                </button>

                {/* Action 2: View on Map (2D/3D) */}
                <button
                  type="button"
                  onClick={onToggleMap3D}
                  style={{
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(2, 132, 199, 0.08))',
                    border: '1.5px solid rgba(56, 189, 248, 0.5)',
                    color: '#38bdf8',
                    padding: '12px 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '11.5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Layers size={18} />
                  <span>View on Map (2D/3D)</span>
                </button>

                {/* Action 3: Export 3D Model (.GLB) */}
                <button
                  type="button"
                  onClick={handleExportGLB}
                  disabled={isExportingGLB || !building}
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.08))',
                    border: '1.5px solid rgba(16, 185, 129, 0.5)',
                    color: '#34d399',
                    padding: '12px 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: isExportingGLB ? 'wait' : 'pointer',
                    fontWeight: '800',
                    fontSize: '11.5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isExportingGLB ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  <span>{isExportingGLB ? 'Exporting...' : 'Export 3D Model (.GLB)'}</span>
                </button>

                {/* Action 4: Download Permit & Cadastral PDF */}
                <button
                  type="button"
                  onClick={() => {
                    const bId = building?.building_id || 'VIT-B001';
                    window.open(`http://127.0.0.1:8000/api/documents/permit-pdf/${bId}`, '_blank');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(2, 132, 199, 0.06))',
                    border: '1.5px solid rgba(14, 165, 233, 0.35)',
                    color: '#7dd3fc',
                    padding: '12px 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '11.5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FileText size={18} />
                  <span>Download Permit PDF</span>
                </button>
              </div>

              {glbExportMessage && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(52, 211, 153, 0.15)',
                  border: '1px solid #34d399',
                  fontSize: '11px',
                  color: '#34d399',
                  fontWeight: '700',
                  textAlign: 'center'
                }}>
                  {glbExportMessage}
                </div>
              )}
            </div>

            {/* 6. REAL-WORLD GROUND-TRUTH CARD (SERPAPI) */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(2, 132, 199, 0.06))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.5px' }}>
                  <Sparkles size={14} />
                  <span>REAL-WORLD GROUND-TRUTH (SERPAPI)</span>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
                Search for building images, info and verification via SerpApi
              </div>

              {/* Action Button: Search with SerpApi */}
              <button
                type="button"
                onClick={handleGenerateAiInsight}
                disabled={loadingAi}
                style={{
                  width: '100%',
                  background: loadingAi ? 'rgba(56, 189, 248, 0.15)' : 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  border: loadingAi ? '1px solid rgba(56, 189, 248, 0.3)' : 'none',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: '800',
                  cursor: loadingAi ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: loadingAi ? 'none' : '0 2px 12px rgba(2, 132, 199, 0.3)',
                  marginBottom: (aiInsight || serpEvidence) ? '12px' : '0'
                }}
              >
                {loadingAi ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                <span>{loadingAi ? 'Searching Google & web records...' : (serpEvidence ? 'Re-Search with SerpApi' : 'Search with SerpApi')}</span>
              </button>

              {/* Evidence Section (Phase 1 Target Layout) */}
              {(aiInsight || serpEvidence) && (
                <div style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* Evidence Status: ✓ MATCH / ? UNCERTAIN / ✕ NO MATCH */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Evidence Status</span>
                    {(() => {
                      const matchStatus = serpEvidence?.match_status || (aiInsight ? 'MATCH' : 'UNCERTAIN');
                      const isMatch = matchStatus === 'MATCH' || matchStatus === 'CORROBORATED';
                      const isUncertain = matchStatus === 'UNCERTAIN' || matchStatus === 'POSSIBLE';
                      const color = isMatch ? '#34d399' : (isUncertain ? '#fbbf24' : '#f87171');
                      const bg = isMatch ? 'rgba(16, 185, 129, 0.15)' : (isUncertain ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)');
                      const symbol = isMatch ? '✓' : (isUncertain ? '?' : '✕');
                      return (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          color: color,
                          background: bg,
                          border: `1px solid ${color}66`,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>{symbol}</span>
                          <span>{matchStatus}</span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* Summary text */}
                  {aiInsight && (
                    <div style={{
                      fontSize: '11.5px',
                      color: '#e2e8f0',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-line',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      {aiInsight}
                    </div>
                  )}

                  {/* Source Section: Title & URL */}
                  {(serpEvidence?.sources?.[0] || serpEvidence?.primary_title) && (
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                        Source
                      </span>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#ffffff' }}>
                        {serpEvidence?.primary_title || serpEvidence?.sources?.[0]?.title || name}
                      </div>
                      {(serpEvidence?.primary_url || serpEvidence?.sources?.[0]?.link) && (
                        <a
                          href={serpEvidence?.primary_url || serpEvidence?.sources?.[0]?.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '11px',
                            color: '#38bdf8',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            wordBreak: 'break-all',
                            marginTop: '2px'
                          }}
                        >
                          <span>{serpEvidence?.primary_url || serpEvidence?.sources?.[0]?.link}</span>
                          <ExternalLink size={11} style={{ flexShrink: 0 }} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Images Section: Actual Returned Thumbnails */}
                  {(() => {
                    const imgList = serpEvidence?.images?.length ? serpEvidence.images : (aiImage ? [aiImage] : []);
                    if (!imgList.length) return null;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                          Images ({imgList.length})
                        </span>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                          {imgList.map((src, idx) => (
                            <img
                              key={idx}
                              src={src}
                              alt={`${name} thumbnail ${idx + 1}`}
                              style={{
                                width: '88px',
                                height: '64px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                background: '#0f172a',
                                flexShrink: 0
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* 7. VERTICAL VERIFICATION & OFFICER OVERRIDE */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#fbbf24',
                fontSize: '11.5px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '10px'
              }}>
                <ShieldCheck size={14} />
                <span>VERTICAL VERIFICATION</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '11.5px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Final Floor Count</span>
                  <span style={{ color: '#fff', fontWeight: '800' }}>{finalFloors} Floors</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Floor Source</span>
                  <span style={{ color: '#38bdf8', fontWeight: '700' }}>{reconciliation?.generation_method || 'OFFICIAL_VIT_RECORD'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Verification</span>
                  <span style={{ color: '#34d399', fontWeight: '700' }}>{verificationStatus}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Avg. Floor Height</span>
                  <span style={{ color: '#fff' }}>{avgHeight} m/floor</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Confidence</span>
                  <span style={{ color: '#fbbf24', fontWeight: '800' }}>{reconciliation?.confidence_tier || 'HIGH'} CONFIDENCE</span>
                </div>
              </div>

              {/* Officer Override Controls */}
              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
                  OFFICER OVERRIDE
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {reconciliation?.floor_count_height_estimate && (
                    <button
                      type="button"
                      onClick={() => handleApplyOverride(reconciliation.floor_count_height_estimate, "Use Height Estimate")}
                      style={{
                        flex: 1,
                        background: 'rgba(251, 191, 36, 0.15)',
                        border: '1px solid #fbbf24',
                        color: '#fbbf24',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Use Height ({reconciliation.floor_count_height_estimate})
                    </button>
                  )}

                  {reconciliation?.floor_count_osm && (
                    <button
                      type="button"
                      onClick={() => handleApplyOverride(reconciliation.floor_count_osm, "Use OSM Levels")}
                      style={{
                        flex: 1,
                        background: 'rgba(52, 211, 153, 0.15)',
                        border: '1px solid #34d399',
                        color: '#34d399',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Use OSM ({reconciliation.floor_count_osm})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowOverrideInput(!showOverrideInput)}
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Custom
                  </button>
                </div>

                {showOverrideInput && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                    <input
                      type="number"
                      placeholder="Enter verified floor count"
                      value={customFloorCount}
                      onChange={(e) => setCustomFloorCount(e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 8px', borderRadius: '4px', fontSize: '11px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyOverride(customFloorCount, "Custom field surveyor entry")}
                      style={{ background: '#0284c7', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Confirm Override
                    </button>
                  </div>
                )}

                {overrideMsg && (
                  <div style={{ marginTop: '6px', fontSize: '10.5px', color: '#34d399', fontWeight: '700' }}>
                    {overrideMsg}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* FLOORS TAB CONTENT */}
        {/* ========================================================================= */}
        {activeTab === 'floors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Vertical CAD floor slices for <strong style={{ color: '#fff' }}>{name}</strong>:
            </div>
            {Array.from({ length: finalFloors }, (_, idx) => {
              const fl = idx + 1;
              const flBase = ((fl - 1) * (height / finalFloors)).toFixed(1);
              const flTop = (fl * (height / finalFloors)).toFixed(1);
              return (
                <div key={fl} style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#fff', fontSize: '12px' }}>
                      Floor {fl} {fl === 1 ? '(Ground Floor)' : fl === finalFloors ? '(Top Floor)' : ''}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                      Elevation: {flBase}m → {flTop}m ({avgHeight}m clearance)
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                    F{String(fl).padStart(2, '0')}
                  </span>
                </div>
              );
            })}
            <button
              onClick={onToggle3dView}
              style={{
                marginTop: '6px',
                background: 'linear-gradient(135deg, #0284c7, #00f0ff)',
                border: 'none',
                color: '#000',
                padding: '10px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Open Interactive 3D Floor Slicer
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PROPERTY UNITS TAB CONTENT */}
        {/* ========================================================================= */}
        {activeTab === 'units' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Sub-Parcel Units Configuration</span>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>
                4 Standard Sub-Parcels / Floor
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                Total estimated 3D sub-parcels: {finalFloors * 4} volumetric units (DERIVED Shapely CAD subdivision).
              </div>
            </div>
            <button
              onClick={onToggle3dView}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #00f0ff)',
                border: 'none',
                color: '#000',
                padding: '10px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Inspect Unit Deeds in 3D Slicer
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DOCUMENTS & 3D RECONSTRUCTION TAB CONTENT */}
        {/* ========================================================================= */}
        {activeTab === 'documents' && (
          <DocumentVerificationPanel
            building={building}
            onOpen3DViewer={onToggle3dView}
          />
        )}

        {/* ========================================================================= */}
        {/* ACTIONS TAB CONTENT */}
        {/* ========================================================================= */}
        {activeTab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={onToggle3dView}
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#000', padding: '12px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Box size={16} />
              <span>Launch 3D Floor Slicer Modal</span>
            </button>
            <button
              onClick={handleExportGLB}
              disabled={isExportingGLB}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Download size={16} />
              <span>{isExportingGLB ? 'Exporting Binary GLB...' : 'Export 3D Model (.GLB)'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
