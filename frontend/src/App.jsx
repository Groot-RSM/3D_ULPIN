import React, { useState, useEffect, useRef } from 'react';
import VitCampusMap from './components/VitCampusMap';
import VitBuildingList from './components/VitBuildingList';
import VitBuildingDetails from './components/VitBuildingDetails';
import Vit3DBuildingViewer from './components/Vit3DBuildingViewer';
import { Search, Building2, Globe, Loader2, X, MapPin } from 'lucide-react';
import './App.css';

export default function App() {
  const [buildings, setBuildings] = useState([]);
  const [routes, setRoutes] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState('VIT-B001'); // Technology Tower default
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [hoveredBuildingId, setHoveredBuildingId] = useState(null);
  const [is3dView, setIs3dView] = useState(true); // Default to 3D Campus view on load!
  const [is3dModalOpen, setIs3dModalOpen] = useState(false);

  // Top Header Search Bar State
  const [headerSearchTerm, setHeaderSearchTerm] = useState('');
  const [headerSearchResults, setHeaderSearchResults] = useState([]);
  const [isHeaderSearching, setIsHeaderSearching] = useState(false);
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const headerSearchTimeoutRef = useRef(null);

  // Fetch VIT Buildings, Routes & Summary
  useEffect(() => {
    fetch('/api/vit/buildings')
      .then(res => res.json())
      .then(data => {
        setBuildings(data);
        if (data && data.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(data[0].building_id);
        }
      })
      .catch(err => console.error("VIT buildings fetch error:", err));

    fetch('/api/vit/routes')
      .then(res => res.json())
      .then(data => setRoutes(data))
      .catch(err => console.error("VIT routes fetch error:", err));

    fetch('/api/vit/summary')
      .then(res => res.json())
      .then(data => setSummary(data))
      .catch(err => console.error("VIT summary fetch error:", err));
  }, []);

  // Header Search Autocomplete API Call
  useEffect(() => {
    if (headerSearchTimeoutRef.current) {
      clearTimeout(headerSearchTimeoutRef.current);
    }

    if (!headerSearchTerm || headerSearchTerm.trim().length < 2) {
      setHeaderSearchResults([]);
      setIsHeaderSearching(false);
      setShowHeaderDropdown(false);
      return;
    }

    setIsHeaderSearching(true);
    setShowHeaderDropdown(true);

    headerSearchTimeoutRef.current = setTimeout(() => {
      fetch(`/api/map/search?q=${encodeURIComponent(headerSearchTerm.trim())}`)
        .then(res => res.json())
        .then(data => {
          setHeaderSearchResults(Array.isArray(data) ? data : []);
          setIsHeaderSearching(false);
        })
        .catch(err => {
          console.error("Header Search API error:", err);
          setHeaderSearchResults([]);
          setIsHeaderSearching(false);
        });
    }, 250);

    return () => {
      if (headerSearchTimeoutRef.current) clearTimeout(headerSearchTimeoutRef.current);
    };
  }, [headerSearchTerm]);

  // Helper to generate localized street-scale 3D footprints
  const createLocalizedFootprint = (cLon, cLat, widthLon = 0.0006, heightLat = 0.0005) => {
    const halfW = widthLon / 2;
    const halfH = heightLat / 2;
    return {
      type: 'Polygon',
      coordinates: [[
        [cLon - halfW, cLat - halfH],
        [cLon + halfW, cLat - halfH],
        [cLon + halfW, cLat + halfH],
        [cLon - halfW, cLat + halfH],
        [cLon - halfW, cLat - halfH]
      ]]
    };
  };

  // Helper to generate 3D Building Cluster Overlays for any Global Searched Location
  const generateGlobalClusterOverlay = (item) => {
    const lat = Number(item.centroid_lat || item.lat);
    const lon = Number(item.centroid_lon || item.lon);
    const mainId = item.building_id || `PLACE-${Date.now()}`;
    const mainName = item.name || (item.display_name ? item.display_name.split(',')[0] : 'Global Landmark');

    // Use small boundingbox only if <0.002° span, otherwise create localized street footprint
    let mainGeom = null;
    if (item.boundingbox) {
      const sLat = Number(item.boundingbox[0]);
      const nLat = Number(item.boundingbox[1]);
      const wLon = Number(item.boundingbox[2]);
      const eLon = Number(item.boundingbox[3]);
      const dLat = Math.abs(nLat - sLat);
      const dLon = Math.abs(eLon - wLon);
      if (dLat > 0.00005 && dLat < 0.002 && dLon > 0.00005 && dLon < 0.002) {
        mainGeom = {
          type: 'Polygon',
          coordinates: [[
            [wLon, sLat],
            [eLon, sLat],
            [eLon, nLat],
            [wLon, nLat],
            [wLon, sLat]
          ]]
        };
      }
    }

    if (!mainGeom) {
      mainGeom = createLocalizedFootprint(lon, lat, 0.0007, 0.0006);
    }

    // Main 3D Landmark Building (Central Tower)
    const mainBuildingObj = {
      building_id: mainId,
      name: `${mainName} (Main Tower)`,
      building_type: 'Global Spatial Landmark',
      location: item.display_name || item.name,
      centroid_lat: lat,
      centroid_lon: lon,
      area_m2: 5400,
      height_m: 68,
      verified_floor_count: 20,
      final_floor_count: 20,
      certainty: 'GLOBAL_GEOCODING',
      ulpin: item.ulpin || `ULPIN-3D-${lat.toFixed(4)}N-${lon.toFixed(4)}E-${mainId}`,
      geometry: mainGeom
    };

    // Generate 4 surrounding 3D cadastral parcel overlays
    const offsets = [
      { dLat: 0.0009, dLon: 0.0010, name: `${mainName} - North Wing`, height: 48, floors: 14, w: 0.0005, h: 0.0005 },
      { dLat: -0.0008, dLon: 0.0011, name: `${mainName} - East Complex`, height: 38, floors: 11, w: 0.0006, h: 0.0004 },
      { dLat: 0.0008, dLon: -0.0010, name: `${mainName} - West Tower`, height: 55, floors: 16, w: 0.0005, h: 0.0005 },
      { dLat: -0.0009, dLon: -0.0008, name: `${mainName} - South Block`, height: 42, floors: 12, w: 0.0004, h: 0.0005 }
    ];

    const clusterBuildings = offsets.map((off, idx) => {
      const cLat = lat + off.dLat;
      const cLon = lon + off.dLon;
      const bId = `${mainId}-SUB-${idx + 1}`;
      return {
        building_id: bId,
        name: off.name,
        building_type: 'Cadastral Volumetric Parcel',
        location: item.display_name || item.name,
        centroid_lat: cLat,
        centroid_lon: cLon,
        area_m2: 3600,
        height_m: off.height,
        verified_floor_count: off.floors,
        final_floor_count: off.floors,
        certainty: 'GLOBAL_GEOCODING',
        ulpin: `ULPIN-3D-${cLat.toFixed(4)}N-${cLon.toFixed(4)}E-${bId}`,
        geometry: createLocalizedFootprint(cLon, cLat, off.w, off.h)
      };
    });

    return [mainBuildingObj, ...clusterBuildings];
  };

  const handleSelectBuilding = (buildingId, customBuildingObj = null) => {
    let targetObj = customBuildingObj;

    if (customBuildingObj) {
      setBuildings(prev => {
        const exists = prev.find(b => b.building_id === buildingId);
        if (exists) return [customBuildingObj, ...prev.filter(b => b.building_id !== buildingId)];
        return [customBuildingObj, ...prev];
      });
    } else {
      targetObj = buildings.find(b => b.building_id === buildingId);
    }

    if (targetObj) {
      const lat = Number(targetObj.centroid_lat || targetObj.lat);
      const lon = Number(targetObj.centroid_lon || targetObj.lon);
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        const isFar = Math.abs(lat - 12.9692) > 0.15 || Math.abs(lon - 79.1560) > 0.15;
        setFlyToTarget({
          lat,
          lon,
          zoom: isFar ? 13 : 16.8,
          buildingId,
          timestamp: Date.now()
        });
      }
    }

    setSelectedBuildingId(buildingId);
  };

  const handleSelectHeaderSearchResult = (item) => {
    setShowHeaderDropdown(false);
    setHeaderSearchTerm(item.name || item.display_name || '');

    if (item.type === 'campus_building') {
      handleSelectBuilding(item.building_id);
    } else {
      const clusterObjs = generateGlobalClusterOverlay(item);
      const mainObj = clusterObjs[0];

      setBuildings(prev => {
        const filtered = prev.filter(b => !b.building_id.startsWith(mainObj.building_id));
        return [...clusterObjs, ...filtered];
      });

      handleSelectBuilding(mainObj.building_id, mainObj);
    }
  };

  const selectedBuilding = buildings.find(b => b.building_id === selectedBuildingId) || (buildings.length > 0 ? buildings[0] : null);

  const handleToggle3D = () => {
    setIs3dModalOpen(true);
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
        {/* Left: Brand Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#f59e0b', letterSpacing: '0.5px' }}>3D ULPIN</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', marginLeft: '6px' }}>| Global & Campus Cadastre</span>
          </div>
        </div>

        {/* Center: TOP NAVIGATION SEARCH BAR WITH 3D OVERLAYS */}
        <div style={{ position: 'relative', width: '380px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#38bdf8' }} />
          <input
            type="text"
            placeholder="Search any location or 3D building (e.g. Chennai, London, TT)..."
            value={headerSearchTerm}
            onChange={e => setHeaderSearchTerm(e.target.value)}
            onFocus={() => { if (headerSearchResults.length > 0) setShowHeaderDropdown(true); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && headerSearchResults.length > 0) {
                e.preventDefault();
                handleSelectHeaderSearchResult(headerSearchResults[0]);
              }
            }}
            style={{
              width: '100%',
              background: '#070b14',
              border: `1px solid ${showHeaderDropdown ? '#00f0ff' : 'rgba(56, 189, 248, 0.35)'}`,
              borderRadius: '20px',
              padding: '7px 32px 7px 32px',
              color: '#fff',
              fontSize: '11.5px',
              boxSizing: 'border-box',
              outline: 'none',
              boxShadow: showHeaderDropdown ? '0 0 15px rgba(0, 240, 255, 0.35)' : 'none'
            }}
          />
          {headerSearchTerm && (
            <button
              onClick={() => { setHeaderSearchTerm(''); setShowHeaderDropdown(false); setHeaderSearchResults([]); }}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={13} />
            </button>
          )}

          {/* HEADER AUTOCOMPLETE DROPDOWN */}
          {showHeaderDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '6px',
              background: 'rgba(7, 11, 20, 0.98)',
              border: '1px solid #00f0ff',
              borderRadius: '10px',
              maxHeight: '280px',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(12px)',
              zIndex: 200
            }}>
              {isHeaderSearching ? (
                <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '11.5px' }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Searching location & generating 3D building overlays...</span>
                </div>
              ) : headerSearchResults.length > 0 ? (
                headerSearchResults.map((item, idx) => {
                  const isCampus = item.type === 'campus_building';
                  return (
                    <div
                      key={item.building_id || idx}
                      onClick={() => handleSelectHeaderSearchResult(item)}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 240, 255, 0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {isCampus ? <Building2 size={15} color="#f59e0b" /> : <Globe size={15} color="#00f0ff" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name || item.display_name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.display_name || 'Global Spatial Landmark'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '12px', color: '#94a3b8', fontSize: '11.5px', textAlign: 'center' }}>
                  No locations found for "{headerSearchTerm}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Capsules & Control Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="header-capsule-gold">
            <span>
              Lat: {selectedBuilding?.centroid_lat ? selectedBuilding.centroid_lat.toFixed(5) : '12.96920'}° N | Lon: {selectedBuilding?.centroid_lon ? selectedBuilding.centroid_lon.toFixed(5) : '79.15600'}° E
            </span>
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
          flyToTarget={flyToTarget}
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
            onSelectBuilding={(id, customObj) => {
              if (customObj && customObj.certainty === 'GLOBAL_GEOCODING') {
                const cluster = generateGlobalClusterOverlay(customObj);
                setBuildings(prev => [...cluster, ...prev]);
                handleSelectBuilding(cluster[0].building_id, cluster[0]);
              } else {
                handleSelectBuilding(id, customObj);
              }
            }}
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
