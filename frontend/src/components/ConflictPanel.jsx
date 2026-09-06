import React from 'react';
import { AlertTriangle, ShieldAlert, Zap, Layers, AlertCircle, ArrowRight } from 'lucide-react';

export default function ConflictPanel({ activeConflictId, onSelectConflict }) {
  const scenarios = [
    {
      id: 'C01',
      name: 'C01 — Apartment Volume Overlap',
      type: 'PROPERTY_VOLUME_OVERLAP',
      severity: 'HIGH',
      vol: '200.14 m³',
      affected: 'U101 ↔ U102 (Floor 01)',
      desc: 'Synthetic dual-claim horizontal boundary shift on Level 1.'
    },
    {
      id: 'C02',
      name: 'C02 — Utility Infrastructure Intrusion',
      type: 'UNDERGROUND_INFRASTRUCTURE_INTRUSION',
      severity: 'CRITICAL',
      vol: '19.00 m³',
      affected: 'UG-W01 (Sewer) ↔ U103, U104 (Floor 01)',
      desc: 'Municipal hydraulic asset penetrates private habitable 3D property volume.'
    },
    {
      id: 'C03',
      name: 'C03 — Airspace Vertical Encroachment',
      type: 'AIRSPACE_VOLUME_INTRUSION',
      severity: 'HIGH',
      vol: '709.91 m³',
      affected: 'AS-B01 ↔ Floor 04 (Level 4: Z=25..27m)',
      desc: 'Overlying airspace spatial right encroaches 2.0m into top-floor units.'
    }
  ];

  const active = scenarios.find(s => s.id === activeConflictId) || scenarios[1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '100%', overflowY: 'auto' }}>
      {/* Hazard Banner */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '14px', borderLeft: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
          <ShieldAlert size={17} />
          <span>⚠ 3D CADASTRAL CONFLICT MODE ACTIVE</span>
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          Demonstrating automated 3D spatial conflict detection on volumetric property boundaries.
        </div>
      </div>

      {/* Scenario Selection Cards */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '14px' }}>
        <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>
          Select Conflict Scenario:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {scenarios.map((sc) => (
            <div
              key={sc.id}
              onClick={() => onSelectConflict(sc.id)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: activeConflictId === sc.id ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0,0,0,0.25)',
                border: '1px solid',
                borderColor: activeConflictId === sc.id ? 'var(--danger)' : 'var(--border-subtle)',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#fff', fontSize: '12.5px' }}>{sc.name}</span>
                <span className={`status-pill ${sc.severity === 'CRITICAL' ? 'danger' : 'warning'}`} style={{ fontSize: '9.5px', padding: '2px 6px' }}>
                  {sc.severity}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sc.affected}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Conflict Telemetry Card */}
      <div className="glass-panel" style={{ borderRadius: '10px', padding: '14px', border: '1px solid var(--danger)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--danger)', fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>
          <AlertCircle size={16} />
          <span>CONFLICT TELEMETRY: {active.id}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>ENCROACHMENT VOLUME</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
              {active.vol}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>SPATIAL PREDICATE</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
              OVERLAPS (Interior ≠ ∅)
            </div>
          </div>
        </div>

        <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', fontSize: '11.5px', color: '#fecaca', marginBottom: '10px' }}>
          <strong>Cadastral Violation:</strong> {active.desc}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div><strong>Affected Cadastral Units:</strong> <code className="code-badge">{active.affected}</code></div>
          <div><strong>Cadastral Action:</strong> Automated title registration lock triggered. Resolution required before conveyance.</div>
        </div>
      </div>
    </div>
  );
}
