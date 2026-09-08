import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, MapPin, CheckCircle2, ChevronRight, Globe, Loader2, X } from 'lucide-react';
import { getCleanBuildingName } from '../utils/buildingNameResolver';

export default function VitBuildingList({
  buildings = [],
  selectedBuildingId = '',
  onSelectBuilding = () => {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Live search autocomplete API call
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

    searchTimeoutRef.current = setTimeout(() => {
      fetch(`/api/map/search?q=${encodeURIComponent(searchTerm.trim())}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(Array.isArray(data) ? data : []);
          setIsSearching(false);
        })
        .catch(err => {
          console.error("Search API error:", err);
          setSearchResults([]);
          setIsSearching(false);
        });
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  const handleSelectSearchResult = (item) => {
    setShowDropdown(false);
    
    // Check if building already exists in local list
    const existing = buildings.find(b => 
      b.building_id === item.building_id || 
      (b.name && b.name.toLowerCase() === item.name.toLowerCase())
    );

    if (existing) {
      onSelectBuilding(existing.building_id);
    } else {
      const lat = Number(item.centroid_lat || item.lat);
      const lon = Number(item.centroid_lon || item.lon);
      const bId = item.building_id || `PLACE-${Date.now()}`;
      
      let customGeom = null;
      if (item.boundingbox) {
        const sLat = Number(item.boundingbox[0]);
        const nLat = Number(item.boundingbox[1]);
        const wLon = Number(item.boundingbox[2]);
        const eLon = Number(item.boundingbox[3]);
        const dLat = Math.abs(nLat - sLat);
        const dLon = Math.abs(eLon - wLon);
        if (dLat > 0.00005 && dLat < 0.002 && dLon > 0.00005 && dLon < 0.002) {
          customGeom = {
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

      if (!customGeom) {
        const hw = 0.00035;
        const hh = 0.00035;
        customGeom = {
          type: 'Polygon',
          coordinates: [[
            [lon - hw, lat - hh],
            [lon + hw, lat - hh],
            [lon + hw, lat + hh],
            [lon - hw, lat + hh],
            [lon - hw, lat - hh]
          ]]
        };
      }

      const customBuildingObj = {
        building_id: bId,
        name: item.name || (item.display_name ? item.display_name.split(',')[0] : 'Global Place'),
        building_type: item.type === 'campus_building' ? 'Academic / Institutional' : 'Global Spatial Landmark',
        location: item.display_name || item.name,
        centroid_lat: lat,
        centroid_lon: lon,
        area_m2: item.area_m2 || 3500,
        height_m: item.height_m || 45,
        verified_floor_count: item.floors || 12,
        final_floor_count: item.floors || 12,
        certainty: item.type === 'campus_building' ? 'VERIFIED' : 'GLOBAL_GEOCODING',
        ulpin: item.ulpin || `ULPIN-3D-${lat.toFixed(2)}N-${lon.toFixed(2)}E-${bId}`,
        geometry: customGeom
      };

      onSelectBuilding(bId, customBuildingObj);
    }
  };

  const filteredBuildings = buildings.filter((b, idx) => {
    if (!searchTerm || showDropdown) return true;
    const term = searchTerm.toLowerCase();
    const displayName = getCleanBuildingName(b, idx).toLowerCase();
    const id = (b.building_id || '').toLowerCase();
    return displayName.includes(term) || id.includes(term);
  });

  const getBadgeStyle = (c) => {
    if (c === 'OBSERVED' || c === 'VERIFIED') return { bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', color: '#34d399' };
    if (c === 'DERIVED') return { bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8', color: '#7dd3fc' };
    return { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', color: '#fbbf24' };
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>
          <Building2 size={16} />
          <span>GLOBAL & CAMPUS BUILDINGS</span>
        </div>
        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '4px' }}>
          {buildings.length} MAPPED
        </span>
      </div>

      {/* SEARCH INPUT WITH DROPDOWN */}
      <div style={{ position: 'relative', marginBottom: '14px', zIndex: 50 }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          placeholder="Search any Building or Location (e.g. Chennai, TT, Bank of America)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (searchResults.length > 0) {
                handleSelectSearchResult(searchResults[0]);
              }
            }
          }}
          style={{
            width: '100%',
            background: '#070b14',
            border: `1px solid ${showDropdown ? '#38bdf8' : '#1e293b'}`,
            borderRadius: '8px',
            padding: '8px 30px 8px 30px',
            color: '#fff',
            fontSize: '11.5px',
            boxSizing: 'border-box',
            outline: 'none',
            boxShadow: showDropdown ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none'
          }}
        />
        {searchTerm && (
          <button
            onClick={() => { setSearchTerm(''); setShowDropdown(false); setSearchResults([]); }}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
          >
            <X size={13} />
          </button>
        )}

        {/* SEARCH AUTOCOMPLETE DROPDOWN */}
        {showDropdown && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'rgba(7, 11, 20, 0.98)',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(12px)',
            zIndex: 100
          }}>
            {isSearching ? (
              <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '11.5px' }}>
                <Loader2 size={14} className="animate-spin" />
                <span>Searching global locations & buildings...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((item, idx) => {
                const isCampus = item.type === 'campus_building';
                const lat = Number(item.centroid_lat || item.lat);
                const lon = Number(item.centroid_lon || item.lon);

                return (
                  <div
                    key={item.building_id || idx}
                    onClick={() => handleSelectSearchResult(item)}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {isCampus ? <Building2 size={16} color="#f59e0b" /> : <Globe size={16} color="#38bdf8" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name || item.display_name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.display_name || `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`}
                      </div>
                    </div>
                    <ChevronRight size={13} color="#64748b" />
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '12px', color: '#94a3b8', fontSize: '11.5px', textAlign: 'center' }}>
                No places found for "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* BUILDING LIST */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
        {filteredBuildings.map((b, idx) => {
          const isSelected = selectedBuildingId === b.building_id;
          const badge = getBadgeStyle(b.certainty || b.data_certainty || 'DERIVED');
          const displayName = getCleanBuildingName(b, idx);

          return (
            <div
              key={b.building_id}
              onClick={() => onSelectBuilding(b.building_id)}
              style={{
                background: isSelected ? 'rgba(245, 158, 11, 0.18)' : '#070b14',
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
                  {displayName}
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
                  {b.certainty || b.data_certainty || 'DERIVED'}
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
