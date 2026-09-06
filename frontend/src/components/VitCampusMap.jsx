import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAPBOX_TOKEN, MAPTILER_KEY, VIT_CENTER } from '../config';

export default function VitCampusMap({
  buildings = [],
  routes = null,
  selectedBuildingId = 'VIT-B001',
  onSelectBuilding = () => {},
  hoveredBuildingId = null,
  onHoverBuilding = () => {},
  is3dView = true
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [mapStyle, setMapStyle] = useState('mapbox-dark'); // 'mapbox-dark' | 'mapbox-satellite' | 'maptiler-dark'

  // Exact Coordinates for VIT Vellore Campus Center
  const VIT_CENTER_LON = 79.1560;
  const VIT_CENTER_LAT = 12.9692;

  // Map Style Builder compatible with MapLibre GL
  const getStyleDefinition = (styleType) => {
    if (styleType === 'mapbox-satellite') {
      return {
        version: 8,
        sources: {
          'mapbox-satellite-source': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
        },
        layers: [
          {
            id: 'mapbox-satellite-layer',
            type: 'raster',
            source: 'mapbox-satellite-source',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      };
    }

    if (styleType === 'maptiler-dark') {
      return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
    }

    // Default Mapbox Dark v11 raster basemap
    return {
      version: 8,
      sources: {
        'mapbox-dark-source': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
      },
      layers: [
        {
          id: 'mapbox-dark-layer',
          type: 'raster',
          source: 'mapbox-dark-source',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    };
  };

  // Helper to create GeoJSON FeatureCollection
  const getBuildingsGeoJson = (bList) => ({
    type: 'FeatureCollection',
    features: (bList || []).map(b => ({
      type: 'Feature',
      properties: { ...b },
      geometry: b.geometry
    }))
  });

  // Setup 3D Buildings & Routes Layers on Map
  const setupMapLayers = (map) => {
    if (!map) return;

    // Set 3D Light Source for Realistic Facade Shading
    try {
      map.setLight({
        anchor: 'viewport',
        color: '#ffffff',
        intensity: 0.85,
        position: [1.5, 90, 80]
      });
    } catch (e) {
      console.warn("3D Light setup note:", e);
    }

    // 1. Buildings Source
    if (!map.getSource('vit-buildings')) {
      map.addSource('vit-buildings', {
        type: 'geojson',
        data: getBuildingsGeoJson(buildings)
      });
    } else {
      map.getSource('vit-buildings').setData(getBuildingsGeoJson(buildings));
    }

    // 2. Routes Source
    if (routes) {
      if (!map.getSource('vit-routes')) {
        map.addSource('vit-routes', {
          type: 'geojson',
          data: routes
        });
      } else {
        map.getSource('vit-routes').setData(routes);
      }

      if (!map.getLayer('vit-routes-layer')) {
        map.addLayer({
          id: 'vit-routes-layer',
          type: 'line',
          source: 'vit-routes',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#38bdf8',
            'line-width': 4,
            'line-opacity': 0.9,
            'line-dasharray': [2, 1]
          }
        });
      }
    }

    // 3. 2D Footprints Base Layer (All Campus Buildings)
    if (!map.getLayer('vit-footprints-2d')) {
      map.addLayer({
        id: 'vit-footprints-2d',
        type: 'fill',
        source: 'vit-buildings',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'building_id'], selectedBuildingId],
            '#00f0ff',
            '#0284c7'
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'building_id'], selectedBuildingId],
            0.95,
            0.45
          ]
        }
      });
    }

    // 4. Selected Building Electric Cyan Highlight Layer
    if (!map.getLayer('vit-footprints-selected')) {
      map.addLayer({
        id: 'vit-footprints-selected',
        type: 'line',
        source: 'vit-buildings',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'building_id'], selectedBuildingId],
            '#00f0ff',
            '#38bdf8'
          ],
          'line-width': [
            'case',
            ['==', ['get', 'building_id'], selectedBuildingId],
            4.0,
            1.5
          ]
        }
      });
    }

    // 5. 3D Building Extrusions Layer (Cyan Highlight for Selected, Neutral Blue for Campus)
    if (!map.getLayer('vit-buildings-3d')) {
      map.addLayer({
        id: 'vit-buildings-3d',
        type: 'fill-extrusion',
        source: 'vit-buildings',
        layout: {
          'visibility': is3dView ? 'visible' : 'none'
        },
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'building_id'], selectedBuildingId],
            '#00f0ff', // Electric Cyan Blue highlight for selected building!
            '#0284c7'  // Cool Neutral Blue for all other campus buildings
          ],
          'fill-extrusion-height': ['get', 'height_m'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85
        }
      });
    }

    // 6. Collision-Aware Building Text Labels Layer
    if (!map.getLayer('vit-building-labels')) {
      map.addLayer({
        id: 'vit-building-labels',
        type: 'symbol',
        source: 'vit-buildings',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11.5,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-radial-offset': 0.5,
          'text-justify': 'auto'
        },
        paint: {
          'text-color': [
            'case',
            ['==', ['get', 'building_id'], selectedBuildingId],
            '#00f0ff',
            '#ffffff'
          ],
          'text-halo-color': '#050812',
          'text-halo-width': 2.0
        }
      });
    }

    // Interaction Handlers
    const handleLayerClick = (e) => {
      if (e.features && e.features.length > 0) {
        const props = e.features[0].properties;
        if (props.building_id) {
          onSelectBuilding(props.building_id);
        }
      }
    };

    map.on('click', 'vit-buildings-3d', handleLayerClick);
    map.on('click', 'vit-footprints-2d', handleLayerClick);

    const handlePointerMove = (e) => {
      if (e.features && e.features.length > 0) {
        map.getCanvas().style.cursor = 'pointer';
        const props = e.features[0].properties;
        setHoveredInfo(props);
        onHoverBuilding(props.building_id);
      } else {
        map.getCanvas().style.cursor = '';
        setHoveredInfo(null);
        onHoverBuilding(null);
      }
    };

    map.on('mousemove', 'vit-buildings-3d', handlePointerMove);
    map.on('mouseleave', 'vit-buildings-3d', () => {
      map.getCanvas().style.cursor = '';
      setHoveredInfo(null);
      onHoverBuilding(null);
    });
    map.on('mousemove', 'vit-footprints-2d', handlePointerMove);
    map.on('mouseleave', 'vit-footprints-2d', () => {
      map.getCanvas().style.cursor = '';
      setHoveredInfo(null);
      onHoverBuilding(null);
    });
  };

  // Initialize Map with optimal 3D camera pitch & zoom
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getStyleDefinition(mapStyle),
      center: [VIT_CENTER_LON, VIT_CENTER_LAT],
      zoom: 15.8,
      pitch: is3dView ? 50 : 0,
      bearing: -25,
      antialias: true
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      setupMapLayers(map);
    });

    return () => {
      map.remove();
    };
  }, []);

  // Handle Basemap Style Switch
  const handleStyleChange = (newStyle) => {
    if (newStyle === mapStyle) return;
    setMapStyle(newStyle);
    const map = mapRef.current;
    if (map) {
      map.setStyle(getStyleDefinition(newStyle));
      map.once('style.load', () => {
        setupMapLayers(map);
      });
    }
  };

  // Update Data Sources dynamically whenever buildings or routes props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('vit-buildings');
    if (source) {
      source.setData(getBuildingsGeoJson(buildings));
    }

    if (routes) {
      const routesSource = map.getSource('vit-routes');
      if (routesSource) {
        routesSource.setData(routes);
      }
    }
  }, [buildings, routes]);

  // Update Selection, Cyan Highlighting & Geometry-Aware fitBounds Camera Fly-To
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('vit-buildings-3d')) {
      map.setLayoutProperty('vit-buildings-3d', 'visibility', is3dView ? 'visible' : 'none');
    }

    const selectedColor = ['case', ['==', ['get', 'building_id'], selectedBuildingId], '#00f0ff', '#0284c7'];
    const selectedOutlineColor = ['case', ['==', ['get', 'building_id'], selectedBuildingId], '#00f0ff', '#38bdf8'];

    if (map.getLayer('vit-buildings-3d')) {
      map.setPaintProperty('vit-buildings-3d', 'fill-extrusion-color', selectedColor);
    }
    if (map.getLayer('vit-footprints-2d')) {
      map.setPaintProperty('vit-footprints-2d', 'fill-color', selectedColor);
      map.setPaintProperty('vit-footprints-2d', 'fill-opacity', ['case', ['==', ['get', 'building_id'], selectedBuildingId], 0.95, 0.45]);
    }
    if (map.getLayer('vit-footprints-selected')) {
      map.setPaintProperty('vit-footprints-selected', 'line-color', selectedOutlineColor);
      map.setPaintProperty('vit-footprints-selected', 'line-width', ['case', ['==', ['get', 'building_id'], selectedBuildingId], 4.0, 1.5]);
    }
    if (map.getLayer('vit-building-labels')) {
      map.setPaintProperty('vit-building-labels', 'text-color', ['case', ['==', ['get', 'building_id'], selectedBuildingId], '#00f0ff', '#ffffff']);
    }

    const targetBuilding = buildings.find(b => b.building_id === selectedBuildingId);
    if (targetBuilding && targetBuilding.geometry && targetBuilding.geometry.coordinates) {
      const ring = targetBuilding.geometry.coordinates[0] || [];
      if (ring.length > 0) {
        let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
        ring.forEach(pt => {
          if (Array.isArray(pt)) {
            const [lon, lat] = pt;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        });

        const bounds = [
          [minLon, minLat],
          [maxLon, maxLat]
        ];

        map.fitBounds(bounds, {
          padding: { top: 90, bottom: 90, left: 320, right: 360 },
          pitch: is3dView ? 50 : 0,
          bearing: is3dView ? -25 : 0,
          duration: 1200,
          maxZoom: 17.5
        });
      }
    } else {
      map.easeTo({
        pitch: is3dView ? 50 : 0,
        bearing: is3dView ? -25 : 0,
        duration: 800
      });
    }
  }, [selectedBuildingId, is3dView, buildings]);


  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Mapbox / MapLibre Canvas Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Basemap Style Switcher */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '320px',
        zIndex: 50,
        display: 'flex',
        background: 'rgba(10, 16, 32, 0.92)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '8px',
        padding: '3px',
        backdropFilter: 'blur(8px)'
      }}>
        <button
          onClick={() => handleStyleChange('mapbox-dark')}
          style={{
            background: mapStyle === 'mapbox-dark' ? '#0284c7' : 'transparent',
            border: 'none',
            color: mapStyle === 'mapbox-dark' ? '#fff' : '#94a3b8',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          🗺️ Mapbox Dark v11
        </button>
        <button
          onClick={() => handleStyleChange('mapbox-satellite')}
          style={{
            background: mapStyle === 'mapbox-satellite' ? '#10b981' : 'transparent',
            border: 'none',
            color: mapStyle === 'mapbox-satellite' ? '#fff' : '#94a3b8',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          🛰️ Mapbox Satellite Streets
        </button>
        <button
          onClick={() => handleStyleChange('maptiler-dark')}
          style={{
            background: mapStyle === 'maptiler-dark' ? '#f59e0b' : 'transparent',
            border: 'none',
            color: mapStyle === 'maptiler-dark' ? '#000' : '#94a3b8',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          ⚡ MapTiler GIS
        </button>
      </div>

      {/* Hover Info Tooltip */}
      {hoveredInfo && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10, 16, 32, 0.95)',
          border: '1.5px solid #38bdf8',
          boxShadow: '0 0 25px rgba(56, 189, 248, 0.5)',
          padding: '8px 20px',
          borderRadius: '9999px',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 700,
          pointerEvents: 'none',
          zIndex: 50,
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ color: '#38bdf8' }}>🏢 {hoveredInfo.name}</span>
          <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>({hoveredInfo.building_id})</span>
          <span style={{ color: '#fbbf24', fontSize: '11.5px' }}>• {hoveredInfo.area_m2 ? `${hoveredInfo.area_m2.toLocaleString()} m²` : ''}</span>
          <span style={{ color: '#34d399', fontSize: '11.5px' }}>• Height: {hoveredInfo.height_m}m</span>
        </div>
      )}

      {/* Real Map GIS Attribution Footer */}
      <div style={{ position: 'absolute', bottom: '8px', left: '16px', fontSize: '10px', color: '#94a3b8', pointerEvents: 'none', zIndex: 10, background: 'rgba(5,8,18,0.85)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.2)' }}>
        📍 Mapbox & MapTiler Dual GIS Engine | VIT Vellore Campus (12.9692° N, 79.1560° E)
      </div>
    </div>
  );
}
