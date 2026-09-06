import React, { useState } from 'react';
import CadastreViewer from './components/CadastreViewer';
import LayerPanel from './components/LayerPanel';
import SpatialQueryPanel from './components/SpatialQueryPanel';
import PropertyInspector from './components/PropertyInspector';
import ConflictPanel from './components/ConflictPanel';
import { Building2, ShieldCheck, AlertTriangle, Database, Activity, Sparkles, Layers, Search } from 'lucide-react';

export default function App() {
  const [selectedPropertyId, setSelectedPropertyId] = useState('P001-B01-F01-U101');
  const [activeTab, setActiveTab] = useState('layers'); // 'layers' or 'query'
  const [conflictMode, setConflictMode] = useState(false);
  const [activeConflictId, setActiveConflictId] = useState('C02');
  const [zLevel, setZLevel] = useState(16.5);
  const [cameraPreset, setCameraPreset] = useState('isometric');
  const [explodedView, setExplodedView] = useState(0.25); // Default separated so it's instantly understandable
  const [filterFloor, setFilterFloor] = useState('ALL');
  const [showLabels, setShowLabels] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const [layers, setLayers] = useState({
    parcel: true,
    building: true,
    floors: true,
    units: true,
    underground: true,
    airspace: true
  });

  const toggleLayer = (layerId) => {
    setLayers(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  const handleSelectProperty = (propId) => {
    setSelectedPropertyId(propId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="glass-panel" style={{
        height: '54px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', padding: '6px', borderRadius: '7px', display: 'flex' }}>
              <Building2 size={18} color="#fff" />
            </div>
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>3D ULPIN</span>
              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, marginLeft: '6px' }}>CADASTRE</span>
            </div>
          </div>

          <div style={{ height: '20px', width: '1px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <span>AOI: <strong style={{ color: '#fff' }}>Kolathur, Chennai</strong></span>
            <span>•</span>
            <span>Datum: <strong style={{ color: '#fff' }}>15.00m AMSL</strong></span>
            <span>•</span>
            <span>Building: <strong style={{ color: '#38bdf8' }}>Soorya Apartments (4 Floors)</strong></span>
          </div>
        </div>

        {/* Center/Right Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="btn"
            style={{ fontSize: '11.5px', padding: '5px 12px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
          >
            <Sparkles size={14} />
            What Does This Solve?
          </button>

          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setConflictMode(false)}
              className={`btn ${!conflictMode ? 'primary' : ''}`}
              style={{ fontSize: '11.5px', padding: '5px 12px' }}
            >
              <ShieldCheck size={14} />
              Standard 3D Cadastre
            </button>
            <button
              onClick={() => {
                setConflictMode(true);
                if (!activeConflictId) setActiveConflictId('C02');
              }}
              className={`btn ${conflictMode ? 'danger' : ''}`}
              style={{ fontSize: '11.5px', padding: '5px 12px' }}
            >
              <AlertTriangle size={14} />
              ⚠ Conflict Mode
            </button>
          </div>

          <div className="status-pill success" style={{ fontSize: '11px', padding: '4px 9px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            <span>● 26 ENTITIES VALIDATED</span>
          </div>
        </div>
      </header>

      {/* Helper Guide Modal */}
      {showGuide && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '680px',
          maxWidth: '90vw',
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
          borderRadius: '12px',
          padding: '20px',
          zIndex: 50,
          backdropFilter: 'blur(12px)',
          color: '#e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="#38bdf8" />
              What Problem Does 3D ULPIN Solve?
            </h3>
            <button onClick={() => setShowGuide(false)} className="btn" style={{ padding: '2px 8px', fontSize: '12px' }}>✕</button>
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p>
              <strong>1. The 2D Limitation:</strong> In traditional land records (2D cadastres), an apartment building with 16 owners or underground pipelines all collapse into a single flat polygon. Multiple owners share the exact same 2D coordinates, causing legal overlaps and title ambiguity.
            </p>
            <p>
              <strong>2. The 3D Solution:</strong> This prototype assigns unique, spatially-linked vertical identities (3D ULPINs) to every individual apartment unit (U101–U404), basement parking spaces, subsurface sewer/telecom conduits, and airspace rights.
            </p>
            <p>
              <strong>3. How to interact:</strong>
              <br />• <strong>Exploded View Slider:</strong> Drag it to separate the 4 floors and underground conduits in space.
              <br />• <strong>Click Any Flat / Pipe:</strong> Inspect its exact elevation bounds (Zmin / Zmax), floor area, deed hash, and topological non-overlap certificate.
              <br />• <strong>Spatial Query:</strong> Enter GPS + Elevation coordinates to test which apartment or easement owns that point in space.
              <br />• <strong>Conflict Mode:</strong> Simulate encroachments (illegal basement pipes, extra penthouse floor) and watch the 3D topology engine flag collisions in real time!
            </p>
          </div>
        </div>
      )}

      {/* 2. MAIN 3-PANEL COMMAND CENTER LAYOUT */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* LEFT SIDEBAR: Layers & 3D Spatial Query Console */}
        <aside style={{
          width: '320px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10
        }}>
          {/* Left Tab Switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '8px 12px', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('layers')}
              className={`btn ${activeTab === 'layers' ? 'active' : ''}`}
              style={{ flex: 1, fontSize: '11.5px' }}
            >
              <Layers size={13} />
              3D Layers & Controls
            </button>
            <button
              onClick={() => setActiveTab('query')}
              className={`btn ${activeTab === 'query' ? 'active' : ''}`}
              style={{ flex: 1, fontSize: '11.5px' }}
            >
              <Search size={13} />
              Spatial Query
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {activeTab === 'layers' ? (
              <LayerPanel
                layers={layers}
                onToggleLayer={toggleLayer}
                zLevel={zLevel}
                onChangeZLevel={setZLevel}
                onCameraPreset={(preset) => {
                  setCameraPreset(preset);
                  setTimeout(() => setCameraPreset(''), 100);
                }}
                explodedView={explodedView}
                onChangeExplodedView={setExplodedView}
                filterFloor={filterFloor}
                onFilterFloor={setFilterFloor}
                showLabels={showLabels}
                onToggleShowLabels={() => setShowLabels(!showLabels)}
              />
            ) : (
              <SpatialQueryPanel
                onSelectProperty={handleSelectProperty}
                onChangeZLevel={setZLevel}
              />
            )}
          </div>
        </aside>

        {/* CENTER 3D VIEWPORT */}
        <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <CadastreViewer
            selectedPropertyId={selectedPropertyId}
            onSelectProperty={handleSelectProperty}
            layers={layers}
            zLevel={zLevel}
            cameraPreset={cameraPreset}
            conflictMode={conflictMode}
            activeConflictId={activeConflictId}
            explodedView={explodedView}
            filterFloor={filterFloor}
            showLabels={showLabels}
          />
        </main>

        {/* RIGHT SIDEBAR: Property Inspector & Provenance OR Conflict Telemetry */}
        <aside style={{
          width: '360px',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10
        }}>
          {conflictMode ? (
            <ConflictPanel
              activeConflictId={activeConflictId}
              onSelectConflict={setActiveConflictId}
            />
          ) : (
            <PropertyInspector
              selectedPropertyId={selectedPropertyId}
              onSelectProperty={handleSelectProperty}
            />
          )}
        </aside>
      </div>

      {/* 3. BOTTOM TELEMETRY STATUS BAR */}
      <footer className="glass-panel" style={{
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>TOTAL ENTITIES: <strong style={{ color: '#fff' }}>26</strong></span>
          <span>BUILDINGS: <strong style={{ color: '#fff' }}>1</strong></span>
          <span>FLOORS: <strong style={{ color: '#fff' }}>4</strong></span>
          <span>PROPERTIES: <strong style={{ color: '#38bdf8' }}>16</strong></span>
          <span>SUBSURFACE: <strong style={{ color: '#fbbf24' }}>3</strong></span>
          <span>AIRSPACE: <strong style={{ color: '#c084fc' }}>1</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>3D TOPOLOGY: <strong style={{ color: '#10b981' }}>100% VALIDATED</strong></span>
          <span>VOLUME CONSERVATION: <strong style={{ color: '#10b981' }}>100.00% (4259.43 m³)</strong></span>
          <span>PROVENANCE: <strong style={{ color: '#38bdf8' }}>TRACEABLE</strong></span>
        </div>
      </footer>
    </div>
  );
}
