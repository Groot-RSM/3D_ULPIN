import React from 'react';
import { Layers, Eye, Camera, Compass, Sliders, Box, Split, Tag } from 'lucide-react';

export default function LayerPanel({
  layers,
  onToggleLayer,
  zLevel,
  onChangeZLevel,
  onCameraPreset,
  explodedView,
  onChangeExplodedView,
  filterFloor,
  onFilterFloor,
  showLabels,
  onToggleShowLabels
}) {
  const getZFloorLabel = (z) => {
    if (z < 12.0) return 'Subsurface Hydraulic Zone (UG-W01: 10.5-11.5m)';
    if (z < 15.0) return 'Subsurface Basement / Utility (12-15m)';
    if (z < 18.0) return 'Floor 01 (Level 1: 15-18m) - 4 Flats (U101..U104)';
    if (z < 21.0) return 'Floor 02 (Level 2: 18-21m) - 4 Flats (U201..U204)';
    if (z < 24.0) return 'Floor 03 (Level 3: 21-24m) - 4 Flats (U301..U304)';
    if (z < 27.0) return 'Floor 04 (Level 4: 24-27m) - 4 Penthouses (U401..U404)';
    return 'Vertical Airspace Clearance Zone (27-32m)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Exploded 3D Architectural View Slider */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '12px 14px', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(99, 102, 241, 0.08))', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#38bdf8', fontWeight: 700, fontSize: '12.5px' }}>
            <Split size={16} />
            <span>EXPLODED 3D VIEW</span>
          </div>
          <span className="code-badge" style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
            {Math.round(explodedView * 100)}% SEPARATED
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.02"
          value={explodedView}
          onChange={(e) => onChangeExplodedView(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-dim)', marginTop: '3px' }}>
          <span>Collapsed Solid</span>
          <span style={{ color: '#38bdf8' }}>Drag to inspect all 4 floors vertically</span>
          <span>Full Stack Exploded</span>
        </div>
      </div>

      {/* 2. Quick Floor Isolation Pills */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>ISOLATE VERTICAL LEVEL</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={onToggleShowLabels}
              style={{ accentColor: 'var(--primary)' }}
            />
            <span>3D Tags</span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[
            { id: 'ALL', label: 'All Levels' },
            { id: 'F04', label: '4th Flr' },
            { id: 'F03', label: '3rd Flr' },
            { id: 'F02', label: '2nd Flr' },
            { id: 'F01', label: '1st Flr' },
            { id: 'UG', label: 'Basement' },
            { id: 'AS', label: 'Airspace' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => onFilterFloor(f.id)}
              className="btn"
              style={{
                fontSize: '11px',
                padding: '5px 4px',
                textAlign: 'center',
                justifyContent: 'center',
                background: filterFloor === f.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: filterFloor === f.id ? '#000' : '#e2e8f0',
                fontWeight: filterFloor === f.id ? 700 : 500,
                borderColor: filterFloor === f.id ? 'var(--primary)' : 'transparent'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 3D Cadastral Layer Checkboxes */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', color: 'var(--primary)', fontWeight: 600, fontSize: '12.5px' }}>
          <Layers size={15} />
          <span>3D CADASTRAL LAYERS</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { id: 'parcel', label: 'Ground Parcel P001', count: '1 parcel', color: '#38bdf8' },
            { id: 'building', label: 'Building Solid (B01)', count: '1 envelope', color: '#94a3b8' },
            { id: 'floors', label: 'Floor Plates (F01-F04)', count: '4 slabs', color: '#60a5fa' },
            { id: 'units', label: 'Apartment Flats (U101..U404)', count: '16 units', color: '#10b981' },
            { id: 'underground', label: 'Subsurface Assets (UG-*)', count: '3 conduits', color: '#f59e0b' },
            { id: 'airspace', label: 'Airspace Spatial Right (AS-B01)', count: '1 column', color: '#c084fc' }
          ].map((item) => (
            <label
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: layers[item.id] ? 'rgba(255,255,255,0.03)' : 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: layers[item.id] ? 'var(--border-strong)' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={layers[item.id]}
                  onChange={() => onToggleLayer(item.id)}
                  style={{ accentColor: item.color, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12px', color: layers[item.id] ? '#fff' : 'var(--text-muted)' }}>
                  {item.label}
                </span>
              </div>
              <span style={{ fontSize: '10.5px', color: item.color, fontWeight: 600 }}>
                {item.count}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 4. Vertical Z-Slicing Plane */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--primary)', fontWeight: 600, fontSize: '12.5px' }}>
            <Sliders size={15} />
            <span>Z-ELEVATION SLICER</span>
          </div>
          <span className="code-badge" style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>
            {zLevel.toFixed(1)} m AMSL
          </span>
        </div>

        <input
          type="range"
          min="10.0"
          max="32.0"
          step="0.5"
          value={zLevel}
          onChange={(e) => onChangeZLevel(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
        />

        <div style={{
          marginTop: '8px',
          padding: '7px 9px',
          background: 'rgba(0,0,0,0.35)',
          borderRadius: '6px',
          borderLeft: '3px solid var(--primary)',
          fontSize: '11px',
          color: '#e2e8f0'
        }}>
          <strong>Active Band:</strong> {getZFloorLabel(zLevel)}
        </div>
      </div>

      {/* 5. Camera Presets */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '12.5px' }}>
          <Camera size={15} />
          <span>VIEW ANGLES</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button className="btn" onClick={() => onCameraPreset('isometric')}>
            <Compass size={13} /> 3D Isometric
          </button>
          <button className="btn" onClick={() => onCameraPreset('top')}>
            <Box size={13} /> Top / Cadastre
          </button>
          <button className="btn" onClick={() => onCameraPreset('front')}>
            <Eye size={13} /> Front Façade
          </button>
          <button className="btn" onClick={() => onCameraPreset('underground')}>
            <Sliders size={13} /> Subsurface View
          </button>
        </div>
      </div>
    </div>
  );
}

