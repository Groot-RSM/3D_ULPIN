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
  const [mapStyle, setMapStyle] = useState('mapbox-satellite'); // Default to Satellite 3D

  // Exact Coordinates for VIT Vellore Campus Center
  const VIT_CENTER_LON = 79.1560;
  const VIT_CENTER_LAT = 12.9692;

  // Map Style Builder compatible with MapLibre GL
  const getStyleDefinition = (styleType) => {
    if (styleType === 'mapbox-satellite' || styleType === 'satellite') {
      return {
        version: 8,
        sources: {
          'satellite-tiles': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
            ],
            tileSize: 256,
            attribution: '&copy; Mapbox &copy; OpenStreetMap'
          }
        },
        layers: [
          {
            id: 'satellite-tiles-layer',
            type: 'raster',
            source: 'satellite-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      };
    }
    
    // Reliable Dark Vector Basemap
    if (MAPTILER_KEY) {
      return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
    }
    return {
      version: 8,
      sources: {
        'carto-dark-source': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
          ],
          tileSize: 256,
          attribution: '&copy; CartoDB &copy; OpenStreetMap'
        }
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark-source',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    };
  };

  // Build GeoJSON FeatureCollection safely with numeric floats for 3D extrusion
  const getBuildingsGeoJson = (bList) => {
    return {
      type: 'FeatureCollection',
      features: bList.map(b => {
        const heightNum = Number(b.height_m) || 24.0;
        const areaNum = Number(b.area_m2) || 1000.0;
        const floorsNum = Number(b.verified_floor_count || b.final_floor_count || 4);
        return {
          type: 'Feature',
          id: b.building_id,
          properties: {
            building_id: b.building_id,
            name: b.name || 'VIT Building',
            height_m: heightNum,
            area_m2: areaNum,
            verified_floor_count: floorsNum,
            ulpin: b.ulpin || `ULPIN-IN-TN-VEL-${b.building_id}`,
            certainty: b.certainty || 'VERIFIED'
          },
          geometry: b.geometry
        };
      })
    };
  };



  const propsRef = useRef({
    buildings,
    routes,
    selectedBuildingId,
    is3dView
  });

  useEffect(() => {
    propsRef.current = {
      buildings,
      routes,
      selectedBuildingId,
      is3dView
    };
  }, [buildings, routes, selectedBuildingId, is3dView]);

  // Universal Selection & Camera Fly-To Function
  const updateBuildingSelectionAndFlyTo = (map, selId, is3d, bList) => {
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('vit-buildings-3d')) {
      map.setLayoutProperty('vit-buildings-3d', 'visibility', is3d ? 'visible' : 'none');
    }

    const selectedColor = ['case', ['==', ['get', 'building_id'], selId || ''], '#00f0ff', '#0284c7'];
    const selectedOutlineColor = ['case', ['==', ['get', 'building_id'], selId || ''], '#00f0ff', '#38bdf8'];
    const selectedFillOpacity = [
      'case',
      ['==', ['get', 'building_id'], selId || ''],
      is3d ? 0.20 : 0.35,
      is3d ? 0.04 : 0.18
    ];
    const selectedLineWidth = ['case', ['==', ['get', 'building_id'], selId || ''], 4.0, 2.2];

    if (map.getLayer('vit-buildings-3d')) {
      map.setPaintProperty('vit-buildings-3d', 'fill-extrusion-color', selectedColor);
    }
    if (map.getLayer('vit-footprints-2d')) {
      map.setPaintProperty('vit-footprints-2d', 'fill-color', selectedColor);
      map.setPaintProperty('vit-footprints-2d', 'fill-opacity', selectedFillOpacity);
    }
    if (map.getLayer('vit-footprints-selected')) {
      map.setPaintProperty('vit-footprints-selected', 'line-color', selectedOutlineColor);
      map.setPaintProperty('vit-footprints-selected', 'line-width', selectedLineWidth);
    }
    if (map.getLayer('vit-building-labels')) {
      map.setPaintProperty('vit-building-labels', 'text-color', ['case', ['==', ['get', 'building_id'], selId || ''], '#00f0ff', '#ffffff']);
    }

    map.easeTo({
      pitch: is3d ? 50 : 0,
      duration: 600
    });

    if (!selId) return;

    const targetBuilding = (bList || []).find(b => b.building_id === selId);
    if (!targetBuilding) return;

    // Extract all [lon, lat] points recursively for Polygon or MultiPolygon
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    let pointCount = 0;

    const extractPoints = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return;
      if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
        const [lon, lat] = arr;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        pointCount++;
      } else {
        arr.forEach(item => extractPoints(item));
      }
    };

    if (targetBuilding.geometry && targetBuilding.geometry.coordinates) {
      extractPoints(targetBuilding.geometry.coordinates);
    }

    if (pointCount > 0 && minLon <= maxLon && minLat <= maxLat) {
      const dLon = Math.abs(maxLon - minLon);
      const dLat = Math.abs(maxLat - minLat);

      if (dLon > 0.0001 && dLat > 0.0001) {
        map.fitBounds([
          [minLon, minLat],
          [maxLon, maxLat]
        ], {
          padding: { top: 90, bottom: 90, left: 320, right: 360 },
          pitch: is3d ? 50 : 0,
          bearing: is3d ? -25 : 0,
          duration: 1000,
          maxZoom: 17.6
        });
      } else {
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;
        map.flyTo({
          center: [centerLon, centerLat],
          zoom: 17.2,
          pitch: is3d ? 50 : 0,
          bearing: is3d ? -25 : 0,
          duration: 1000,
          essential: true
        });
      }
    } else if (targetBuilding.centroid_lat && targetBuilding.centroid_lon) {
      map.flyTo({
        center: [targetBuilding.centroid_lon, targetBuilding.centroid_lat],
        zoom: 17.2,
        pitch: is3d ? 50 : 0,
        bearing: is3d ? -25 : 0,
        duration: 1000,
        essential: true
      });
    }
  };

  // Add Interactive Vector & Extrusion Layers
  const setupMapLayers = (map, currentBuildings, currentRoutes, selId, is3d) => {
    if (!map) return;
    const bList = currentBuildings || propsRef.current.buildings || [];
    const rData = currentRoutes || propsRef.current.routes;
    const activeSelId = selId !== undefined ? selId : propsRef.current.selectedBuildingId;
    const active3d = is3d !== undefined ? is3d : propsRef.current.is3dView;

    if (!map.getSource('vit-buildings')) {
      map.addSource('vit-buildings', {
        type: 'geojson',
        data: getBuildingsGeoJson(bList)
      });
    } else {
      map.getSource('vit-buildings').setData(getBuildingsGeoJson(bList));
    }

    if (rData) {
      if (!map.getSource('vit-routes')) {
        map.addSource('vit-routes', {
          type: 'geojson',
          data: rData
        });
      } else {
        map.getSource('vit-routes').setData(rData);
      }

      // 1. Campus Roadway Casing
      if (!map.getLayer('vit-routes-casing')) {
        map.addLayer({
          id: 'vit-routes-casing',
          type: 'line',
          source: 'vit-routes',
          paint: {
            'line-color': '#0284c7',
            'line-width': 4.5,
            'line-opacity': 0.4
          }
        });
      }

      // 2. Campus Roadway Core
      if (!map.getLayer('vit-routes-core')) {
        map.addLayer({
          id: 'vit-routes-core',
          type: 'line',
          source: 'vit-routes',
          paint: {
            'line-color': '#38bdf8',
            'line-width': 2.0,
            'line-opacity': 0.8
          }
        });
      }
    }

    // 3. 2D Footprints Base Layer
    if (!map.getLayer('vit-footprints-2d')) {
      map.addLayer({
        id: 'vit-footprints-2d',
        type: 'fill',
        source: 'vit-buildings',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'building_id'], activeSelId],
            '#00f0ff',
            '#0284c7'
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'building_id'], activeSelId],
            active3d ? 0.20 : 0.35,
            active3d ? 0.04 : 0.18
          ]
        }
      });
    }

    // 4. Cadastral Boundary Line Outlines
    if (!map.getLayer('vit-footprints-selected')) {
      map.addLayer({
        id: 'vit-footprints-selected',
        type: 'line',
        source: 'vit-buildings',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'building_id'], activeSelId],
            '#00f0ff',
            '#38bdf8'
          ],
          'line-width': [
            'case',
            ['==', ['get', 'building_id'], activeSelId],
            4.0,
            2.2
          ],
          'line-opacity': 0.95
        }
      });
    }

    // Configure 3D Extrusion Lighting
    try {
      map.setLight({
        anchor: 'viewport',
        color: '#ffffff',
        intensity: 0.8
      });
    } catch (e) {}

    // 5. 3D Building Extrusions Layer
    if (!map.getLayer('vit-buildings-3d')) {
      map.addLayer({
        id: 'vit-buildings-3d',
        type: 'fill-extrusion',
        source: 'vit-buildings',
        layout: {
          'visibility': active3d ? 'visible' : 'none'
        },
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'building_id'], activeSelId],
            '#00f0ff',
            '#0284c7'
          ],
          'fill-extrusion-height': ['get', 'height_m'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.88
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
            ['==', ['get', 'building_id'], activeSelId],
            '#00f0ff',
            '#ffffff'
          ],
          'text-halo-color': '#050812',
          'text-halo-width': 2.5
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

    map.off('click', 'vit-buildings-3d', handleLayerClick);
    map.off('click', 'vit-footprints-2d', handleLayerClick);
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

    const handleStyleLoad = () => {
      const { buildings: currentBuildings, routes: currentRoutes, selectedBuildingId: currentSelId, is3dView: currentIs3d } = propsRef.current;
      setupMapLayers(map, currentBuildings, currentRoutes, currentSelId, currentIs3d);
      updateBuildingSelectionAndFlyTo(map, currentSelId, currentIs3d, currentBuildings);
    };

    map.on('style.load', handleStyleLoad);
    map.on('load', handleStyleLoad);

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
    }
  };

  // Update Data Sources dynamically whenever buildings or routes props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('vit-buildings');
    if (source) {
      source.setData(getBuildingsGeoJson(buildings));
    } else {
      setupMapLayers(map, buildings, routes, selectedBuildingId, is3dView);
    }

    if (routes) {
      const routesSource = map.getSource('vit-routes');
      if (routesSource) {
        routesSource.setData(routes);
      }
    }
  }, [buildings, routes]);

  // Update Selection, Highlighting & Camera Fly-To on prop change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateBuildingSelectionAndFlyTo(map, selectedBuildingId, is3dView, buildings);
  }, [selectedBuildingId, is3dView, buildings]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Mapbox / MapLibre Canvas Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Basemap Style Switcher */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
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
            padding: '5px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          Dark Map
        </button>
        <button
          onClick={() => handleStyleChange('mapbox-satellite')}
          style={{
            background: mapStyle === 'mapbox-satellite' ? '#10b981' : 'transparent',
            border: 'none',
            color: mapStyle === 'mapbox-satellite' ? '#fff' : '#94a3b8',
            padding: '5px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          Satellite 3D
        </button>
      </div>

      {/* Hover Info Tooltip */}
      {hoveredInfo && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
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
          <span style={{ color: '#38bdf8' }}>{hoveredInfo.name}</span>
          <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>({hoveredInfo.building_id})</span>
          <span style={{ color: '#fbbf24', fontSize: '11.5px' }}>• {hoveredInfo.area_m2 ? `${hoveredInfo.area_m2.toLocaleString()} m²` : ''}</span>
          <span style={{ color: '#34d399', fontSize: '11.5px' }}>• Height: {hoveredInfo.height_m}m</span>
        </div>
      )}
    </div>
  );
}
