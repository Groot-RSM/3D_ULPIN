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

  const handleToggle3D = () => {
    setIs3dModalOpen(true);
  };

  const handleSelectBuilding = (buildingId) => {
    setSelectedBuildingId(buildingId);
  };

  const handleToggleMap3D = () => {
    setIs3dView(prev => !prev);
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
            <span>3D Cadastral Volumetric Parcels (Vellore, Tamil Nadu, India)</span>
          </div>
        </div>

        {/* Right Capsules & Control Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="header-capsule-gold">
            <span>Lat: 12.96920° N | Lon: 79.15600° E</span>
          </div>

          <div className="header-capsule-cyan">
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
            3D CADASTRAL REGISTRY
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
          onSelectBuilding={(id) => handleSelectBuilding(id)}
          hoveredBuildingId={hoveredBuildingId}
          onHoverBuilding={setHoveredBuildingId}
          is3dView={is3dView}
        />

        {/* LEFT FLOATING PANEL: VIT BUILDING SEARCH & LIST */}
        <div className="left-floor-card">
          <VitBuildingList
            buildings={buildings}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={(id) => handleSelectBuilding(id)}
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


