import React, { useState, useEffect } from 'react';
import VitCampusMap from './components/VitCampusMap';
import VitBuildingList from './components/VitBuildingList';
import VitBuildingDetails from './components/VitBuildingDetails';
import Vit3DBuildingViewer from './components/Vit3DBuildingViewer';
import { MapPin, Box, Lock, Layers } from 'lucide-react';
import './App.css';

export default function App() {
 const [buildings, setBuildings] = useState([]);
 const [routes, setRoutes] = useState(null);
 const [summary, setSummary] = useState(null);
 const [selectedBuildingId, setSelectedBuildingId] = useState('VIT-B001'); // Technology Tower default
 const [hoveredBuildingId, setHoveredBuildingId] = useState(null);
 const [is3dView, setIs3dView] = useState(true); // Default to 3D Campus view on load!
 const [is3dModalOpen, setIs3dModalOpen] = useState(false);
 const [activeStep, setActiveStep] = useState(1); // 1: 3D Campus View, 2: 2D GIS Footprints
 const [searchQuery, setSearchQuery] = useState('');

 // Fetch VIT Buildings, Routes & Summary
 useEffect(() => {
 fetch('http://127.0.0.1:8000/api/vit/buildings')
 .then(res => res.json())
 .then(data => {
 setBuildings(data);
 if (data && data.length > 0 && !selectedBuildingId) {
 setSelectedBuildingId(data[0].building_id);
 }
 })
 .catch(err => console.error("VIT buildings fetch error:", err));

 fetch('http://127.0.0.1:8000/api/vit/routes')
 .then(res => res.json())
 .then(data => setRoutes(data))
 .catch(err => console.error("VIT routes fetch error:", err));

 fetch('http://127.0.0.1:8000/api/vit/summary')
 .then(res => res.json())
 .then(data => setSummary(data))
 .catch(err => console.error("VIT summary fetch error:", err));
 }, []);

 const selectedBuilding = buildings.find(b => b.building_id === selectedBuildingId) || (buildings.length > 0 ? buildings[0] : null);

 const rec = selectedBuilding?.reconciliation;
 const hasFloors = Boolean(rec && rec.final_floor_count > 0);
 const hasUnits = Boolean(selectedBuilding?.has_units);
 const hasSubterranean = Boolean(selectedBuilding?.has_subterranean || selectedBuilding?.building_id === 'VIT-B001');
 const hasConflict = Boolean(rec && (rec.agreement_status === 'SOURCE_CONFLICT' || rec.review_required));

 const steps = [
 { id: 1, label: '3D Campus View', isAvailable: true },
 { id: 2, label: '2D GIS Footprints', isAvailable: true },
 { id: 3, label: 'Exploded Floor Slices', isAvailable: true },
 { id: 4, label: '3D Property Sub-Parcels', isAvailable: true },
 { id: 5, label: 'Subterranean Basements', isAvailable: hasSubterranean, badge: hasSubterranean ? 'Demo' : 'No Data' },
 { id: 6, label: 'Topology & Conflict Audit', isAvailable: true, badge: 'Certified' }
 ];

 const handleStepClick = (step) => {
 if (step.id === 1) {
 setActiveStep(1);
 setIs3dView(true);
 } else if (step.id === 2) {
 setActiveStep(2);
 setIs3dView(false);
 } else if (step.id === 3 || step.id === 4) {
 setActiveStep(step.id);
 setIs3dModalOpen(true);
 } else if (step.id === 5) {
 setActiveStep(5);
 if (step.isAvailable) {
 setIs3dModalOpen(true);
 } else {
 alert("Subterranean records unavailable for this building.");
 }
 } else if (step.id === 6) {
 setActiveStep(6);
 setIs3dModalOpen(true);
 }
 };

 const handleToggle3D = () => {
 setIs3dModalOpen(true);
 };

 const handleSelectBuilding = (buildingId, activate3d = true) => {
 setSelectedBuildingId(buildingId);
 if (activate3d) {
 setIs3dView(true);
 setActiveStep(1);
 }
 };

 const handleToggleMap3D = () => {
 const next3d = !is3dView;
 setIs3dView(next3d);
 setActiveStep(next3d ? 1 : 2);
 };

 return (
 <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#050812', overflow: 'hidden' }}>
 
 {/* TOP HEADER BAR */}
 <header style={{
 height: '60px',
 background: 'rgba(10, 16, 32, 0.95)',
 borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 padding: '0 24px',
 zIndex: 100
 }}>
 {/* Left: Brand Title & Campus Subtitle */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
 <div>
 <span style={{ fontSize: '18px', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.5px' }}>3D ULPIN</span>
 <span style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', marginLeft: '6px' }}>| VIT Vellore Campus</span>
 </div>

 <div style={{ fontSize: '11.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span>Real-Time 3D Cadastral Spatial Mapping (Vellore, Tamil Nadu, India)</span>
 </div>
 </div>

 {/* Right Capsules & Control Toggle */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 <div className="header-capsule-gold">
 <span></span>
 <span>Lat: 12.96920° N | Lon: 79.15600° E</span>
 </div>

 <div className="header-capsule-cyan">
 <span></span>
 <span>EPSG:4326 | EPSG:32644 (UTM 44N)</span>
 </div>

 <div style={{
 background: 'rgba(16, 185, 129, 0.15)',
 border: '1px solid rgba(16, 185, 129, 0.4)',
 color: '#34d399',
 padding: '4px 10px',
 borderRadius: '9999px',
 fontSize: '11px',
 fontWeight: '700',
 letterSpacing: '0.5px'
 }}>
 PHASE 1 — 3D CAMPUS MAPPING
 </div>

 {/* 2D / 3D Mode Switcher */}
 <div style={{ display: 'flex', background: '#070b14', border: '1px solid #334155', borderRadius: '8px', padding: '2px', marginLeft: '8px' }}>
 <button
 onClick={() => { setIs3dView(true); setActiveStep(1); }}
 style={{
 background: is3dView ? '#f59e0b' : 'transparent',
 border: 'none',
 color: is3dView ? '#000' : '#94a3b8',
 padding: '4px 12px',
 borderRadius: '6px',
 fontSize: '11px',
 fontWeight: '700',
 cursor: 'pointer'
 }}
 >
 3D Campus View
 </button>
 <button
 onClick={() => { setIs3dView(false); setActiveStep(2); }}
 style={{
 background: !is3dView ? '#0284c7' : 'transparent',
 border: 'none',
 color: !is3dView ? '#fff' : '#94a3b8',
 padding: '4px 12px',
 borderRadius: '6px',
 fontSize: '11px',
 fontWeight: '700',
 cursor: 'pointer'
 }}
 >
 2D GIS Map
 </button>
 </div>
 </div>
 </header>

 {/* CENTER VIEWPORT & FLOATING PANELS */}
 <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
 
 {/* 3D WebGL / GIS Canvas */}
 <VitCampusMap
 buildings={buildings}
 routes={routes}
 selectedBuildingId={selectedBuildingId}
 onSelectBuilding={(id) => handleSelectBuilding(id, true)}
 hoveredBuildingId={hoveredBuildingId}
 onHoverBuilding={setHoveredBuildingId}
 is3dView={is3dView}
 />

 {/* LEFT FLOATING PANEL: VIT BUILDING SEARCH & LIST */}
 <div className="left-floor-card">
 <VitBuildingList
 buildings={buildings}
 selectedBuildingId={selectedBuildingId}
 onSelectBuilding={(id) => handleSelectBuilding(id, true)}
 />
 </div>

 {/* RIGHT FLOATING PANEL: SINGLE-CARD BUILDING DETAILS INSPECTOR */}
 <div className="right-details-card">
 <VitBuildingDetails
 building={selectedBuilding}
 is3dView={is3dView}
 onToggle3dView={handleToggle3D}
 onToggleMap3D={handleToggleMap3D}
 />
 </div>

 {/* FLOATING BOTTOM STEP NAVIGATION BAR */}
 <div className="bottom-step-bar-container">
 {steps.map(s => {
 const isActive = activeStep === s.id;
 const isAvail = s.isAvailable;

 return (
 <button
 key={s.id}
 onClick={() => handleStepClick(s)}
 className={`step-item ${isActive ? 'active-step' : ''}`}
 style={{
 opacity: isAvail ? 1 : 0.65,
 cursor: 'pointer'
 }}
 title={s.label}
 >
 <div className="step-number" style={{ background: !isAvail ? 'rgba(255,255,255,0.05)' : undefined }}>
 {s.id}
 </div>
 <span>{s.label}</span>
 {s.badge && (
 <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', color: '#94a3b8', padding: '1px 5px', borderRadius: '4px', marginLeft: '2px' }}>
 {s.badge}
</span>
 )}
 </button>
 );
 })}
 </div>

 </div>

 {/* ISOLATED 3D BUILDING INSPECTOR MODAL */}
 {is3dModalOpen && selectedBuilding && (
 <Vit3DBuildingViewer
 building={selectedBuilding}
 onClose={() => setIs3dModalOpen(false)}
 />
 )}
 </div>
 );
}


