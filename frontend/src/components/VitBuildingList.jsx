import React, { useState } from 'react';
import { Search, Building2, MapPin, CheckCircle2, ChevronRight } from 'lucide-react';

export default function VitBuildingList({
 buildings = [],
 selectedBuildingId = '',
 onSelectBuilding = () => {}
}) {
 const [searchTerm, setSearchTerm] = useState('');

 const filteredBuildings = buildings.filter(b => {
 const term = searchTerm.toLowerCase();
 const name = (b.name || '').toLowerCase();
 const id = (b.building_id || '').toLowerCase();
 return name.includes(term) || id.includes(term);
 });

 const getBadgeStyle = (c) => {
 if (c === 'OBSERVED') return { bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', color: '#34d399' };
 if (c === 'DERIVED') return { bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8', color: '#7dd3fc' };
 return { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', color: '#fbbf24' };
 };

 return (
 <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
 
 {/* HEADER */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>
 <Building2 size={16} />
 <span>VIT CAMPUS BUILDINGS</span>
 </div>
 <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '4px' }}>
 {buildings.length} MAPPED
</span>
 </div>

 {/* SEARCH INPUT */}
 <div style={{ position: 'relative', marginBottom: '14px' }}>
 <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
 <input
 type="text"
 placeholder="Search Building..."
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 style={{
 width: '100%',
 background: '#070b14',
 border: '1px solid #1e293b',
 borderRadius: '8px',
 padding: '8px 10px 8px 30px',
 color: '#fff',
 fontSize: '12px',
 boxSizing: 'border-box'
 }}
 />
 </div>

 {/* BUILDING LIST */}
 <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
 {filteredBuildings.map(b => {
 const isSelected = selectedBuildingId === b.building_id;
 const badge = getBadgeStyle(b.data_certainty || 'DERIVED');

 return (
 <div
 key={b.building_id}
 onClick={() => onSelectBuilding(b.building_id)}
 style={{
 background: isSelected ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(217, 119, 6, 0.12))' : '#070b14',
 border: `1.5px solid ${isSelected ? '#f59e0b' : '#1e293b'}`,
 boxShadow: isSelected ? '0 0 12px rgba(245, 158, 11, 0.25)' : 'none',
 borderRadius: '10px',
 padding: '10px 12px',
 cursor: 'pointer',
 transition: 'all 0.15s ease'
 }}
 >
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
 <span style={{ fontSize: '12.5px', fontWeight: '700', color: isSelected ? '#fbbf24' : '#fff' }}>
 {b.name}
</span>
 <span style={{
 background: badge.bg,
 border: `1px solid ${badge.border}`,
 color: badge.color,
 fontSize: '9px',
 fontWeight: '700',
 padding: '1px 5px',
 borderRadius: '4px'
 }}>
 {b.data_certainty || 'DERIVED'}
</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#94a3b8' }}>
 <span style={{ fontFamily: 'var(--font-mono)' }}>{b.building_id}</span>
 <span style={{ color: isSelected ? '#fff' : '#38bdf8', fontWeight: '600' }}>
 {b.area_m2 ? `${b.area_m2.toLocaleString()} m²` : '---'}
</span>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}
