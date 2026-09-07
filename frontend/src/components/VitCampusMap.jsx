import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAPBOX_TOKEN, MAPTILER_KEY, VIT_CENTER } from '../config';
import { Move, RotateCw, RotateCcw, ZoomIn, ZoomOut, Save, RotateCcw as ResetIcon, Check, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, Sparkles } from 'lucide-react';

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

  // Move & Spatial Calibration Mode State
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [localBuildings, setLocalBuildings] = useState(buildings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(null);
  const [moveStep, setMoveStep] = useState(0.00003); // ~3.3 meters
  const dragMarkerRef = useRef(null);
  const originalGeomRef = useRef({});

  // Exact Coordinates for VIT Vellore Campus Center
  const VIT_CENTER_LON = 79.1560;
  const VIT_CENTER_LAT = 12.9692;

  // Sync with prop updates
  useEffect(() => {
    setLocalBuildings(buildings);
    const initialMap = {};
    buildings.forEach(b => {
      if (b.geometry) {
        initialMap[b.building_id] = JSON.parse(JSON.stringify(b.geometry));
      }
    });
    originalGeomRef.current = initialMap;
  }, [buildings]);

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
    buildings: localBuildings,
    routes,
    selectedBuildingId,
    is3dView
  });

  useEffect(() => {
    propsRef.current = {
      buildings: localBuildings,
      routes,
      selectedBuildingId,
      is3dView
    };
  }, [localBuildings, routes, selectedBuildingId, is3dView]);

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

  // Helper to compute centroid of a polygon
  const computeCentroid = (geom) => {
    if (!geom || !geom.coordinates || !geom.coordinates[0]) return [VIT_CENTER_LON, VIT_CENTER_LAT];
    const ring = geom.coordinates[0];
    const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  };

  // Geometry Transformation Function (Translate, Rotate, Scale)
  const transformBuilding = (bId, dLon, dLat, scaleRatio = 1.0, rotateDeg = 0) => {
    setLocalBuildings(prev => {
      const target = prev.find(b => b.building_id === bId);
      if (!target || !target.geometry) return prev;

      const [cLon, cLat] = computeCentroid(target.geometry);
      const rad = (rotateDeg * Math.PI) / 180;

      const transformCoords = (coords) => {
        if (!Array.isArray(coords)) return coords;
        if (typeof coords[0] === 'number') {
          let dx = coords[0] - cLon;
          let dy = coords[1] - cLat;

          // Scale
          dx *= scaleRatio;
          dy *= scaleRatio;

          // Rotate
          if (rotateDeg !== 0) {
            const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
            const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
            dx = rx;
            dy = ry;
          }

          return [cLon + dLon + dx, cLat + dLat + dy];
        }
        return coords.map(c => transformCoords(c));
      };

      const newGeometry = {
        ...target.geometry,
        coordinates: transformCoords(target.geometry.coordinates)
      };

      const updated = prev.map(b => b.building_id === bId ? { ...b, geometry: newGeometry } : b);

      // Update Map Live Source
      const map = mapRef.current;
      if (map && map.getSource('vit-buildings')) {
        map.getSource('vit-buildings').setData(getBuildingsGeoJson(updated));
      }

      // Update drag marker position if exists
      if (dragMarkerRef.current) {
        const [newCLon, newCLat] = computeCentroid(newGeometry);
        dragMarkerRef.current.setLngLat([newCLon, newCLat]);
      }

      return updated;
    });
  };

  // Reset to original footprint
  const handleResetPosition = (bId) => {
    const orig = originalGeomRef.current[bId];
    if (orig) {
      setLocalBuildings(prev => {
        const updated = prev.map(b => b.building_id === bId ? { ...b, geometry: JSON.parse(JSON.stringify(orig)) } : b);
        const map = mapRef.current;
        if (map && map.getSource('vit-buildings')) {
          map.getSource('vit-buildings').setData(getBuildingsGeoJson(updated));
        }
        if (dragMarkerRef.current) {
          const [cLon, cLat] = computeCentroid(orig);
          dragMarkerRef.current.setLngLat([cLon, cLat]);
        }
        return updated;
      });
      setSaveToast('Position reset to original.');
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  // Save new position to backend database/cadastre
  const handleSavePosition = async (bId) => {
    const target = localBuildings.find(b => b.building_id === bId);
    if (!target) return;
    setIsSaving(true);
    const [cLon, cLat] = computeCentroid(target.geometry);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/vit/buildings/${bId}/update-geometry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometry: target.geometry,
          centroid_lat: cLat,
          centroid_lon: cLon
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        originalGeomRef.current[bId] = JSON.parse(JSON.stringify(target.geometry));
        setSaveToast('✅ Position permanently saved to Cadastre!');
        setTimeout(() => setSaveToast(null), 4000);
      }
    } catch (err) {
      console.error("Save position error:", err);
      setSaveToast('❌ Failed to save position.');
      setTimeout(() => setSaveToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Manage Draggable Marker for Selected Building when Move Mode is Active
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (dragMarkerRef.current) {
      dragMarkerRef.current.remove();
      dragMarkerRef.current = null;
    }

    if (!isMoveMode || !selectedBuildingId) return;

    const target = localBuildings.find(b => b.building_id === selectedBuildingId);
    if (!target || !target.geometry) return;

    const [cLon, cLat] = computeCentroid(target.geometry);

    // Create glowing anchor pin element
    const el = document.createElement('div');
    el.className = 'custom-move-pin';
    el.innerHTML = `
      <div style="width: 38px; height: 38px; background: rgba(0, 240, 255, 0.4); border: 2.5px solid #00f0ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px #00f0ff; cursor: grab;">
        <div style="width: 12px; height: 12px; background: #ffffff; border-radius: 50%; box-shadow: 0 0 10px #ffffff;"></div>
      </div>
    `;

    let startLngLat = [cLon, cLat];

    const marker = new maplibregl.Marker({
      element: el,
      draggable: true
    })
      .setLngLat([cLon, cLat])
      .addTo(map);

    marker.on('dragstart', () => {
      startLngLat = marker.getLngLat();
    });

    marker.on('drag', () => {
      const cur = marker.getLngLat();
      const dLon = cur.lng - startLngLat.lng;
      const dLat = cur.lat - startLngLat.lat;
      startLngLat = cur;
      transformBuilding(selectedBuildingId, dLon, dLat);
    });

    dragMarkerRef.current = marker;

    return () => {
      if (dragMarkerRef.current) {
        dragMarkerRef.current.remove();
        dragMarkerRef.current = null;
      }
    };
  }, [isMoveMode, selectedBuildingId]);

  // Setup Map Layers
  const setupMapLayers = (map, bList, rData, activeSelId, active3d) => {
    if (!map || !map.isStyleLoaded()) return;

    const bData = getBuildingsGeoJson(bList);

    if (!map.getSource('vit-buildings')) {
      map.addSource('vit-buildings', {
        type: 'geojson',
        data: bData
      });
    } else {
      map.getSource('vit-buildings').setData(bData);
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

    try {
      map.setLight({
        anchor: 'viewport',
        color: '#ffffff',
        intensity: 0.8
      });
    } catch (e) {}

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

  // Initialize Map
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

  const handleStyleChange = (newStyle) => {
    if (newStyle === mapStyle) return;
    setMapStyle(newStyle);
    const map = mapRef.current;
    if (map) {
      map.setStyle(getStyleDefinition(newStyle));
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('vit-buildings');
    if (source) {
      source.setData(getBuildingsGeoJson(localBuildings));
    } else {
      setupMapLayers(map, localBuildings, routes, selectedBuildingId, is3dView);
    }
  }, [localBuildings, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateBuildingSelectionAndFlyTo(map, selectedBuildingId, is3dView, localBuildings);
  }, [selectedBuildingId, is3dView, localBuildings]);

  const selectedBuilding = localBuildings.find(b => b.building_id === selectedBuildingId);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Basemap Style Switcher & Move Mode Activator */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(10, 16, 32, 0.94)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '10px',
        padding: '4px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
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
          Dark Map
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
          Satellite 3D
        </button>

        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

        {/* Move / Calibrate Toggle Button */}
        <button
          onClick={() => setIsMoveMode(prev => !prev)}
          style={{
            background: isMoveMode ? 'linear-gradient(135deg, #ff0055, #f43f5e)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isMoveMode ? '#ff0055' : 'rgba(255,255,255,0.2)'}`,
            color: '#fff',
            padding: '5px 14px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: isMoveMode ? '0 0 15px rgba(255,0,85,0.5)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Move size={13} />
          <span>{isMoveMode ? 'Move Active (Drag / Nudge)' : 'Move & Calibrate'}</span>
        </button>
      </div>

      {/* Floating Move & Nudge Precision Control Panel HUD */}
      {isMoveMode && selectedBuilding && (
        <div style={{
          position: 'absolute',
          top: '68px',
          left: '16px',
          zIndex: 30,
          background: 'rgba(10, 16, 32, 0.95)',
          border: '1.5px solid #00f0ff',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '280px',
          boxShadow: '0 0 30px rgba(0, 240, 255, 0.35)',
          backdropFilter: 'blur(16px)',
          color: '#fff',
          fontSize: '11.5px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Crosshair size={15} color="#00f0ff" />
              <span style={{ fontWeight: '900', color: '#00f0ff', textTransform: 'uppercase', fontSize: '11px' }}>
                Position Calibrator
              </span>
            </div>
            <button
              onClick={() => setIsMoveMode(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ background: '#050813', padding: '8px 10px', borderRadius: '6px', border: '1px solid #1e293b' }}>
            <div style={{ fontWeight: '800', color: '#fff', fontSize: '12px' }}>{selectedBuilding.name}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{selectedBuilding.building_id} • Drag pin on map or nudge below</div>
          </div>

          {/* Precision 4-Way D-Pad Nudge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => transformBuilding(selectedBuildingId, 0, moveStep)}
              title="Nudge North"
              style={{
                background: '#1e293b',
                border: '1px solid #38bdf8',
                color: '#fff',
                width: '42px',
                height: '32px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowUp size={16} color="#38bdf8" />
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => transformBuilding(selectedBuildingId, -moveStep, 0)}
                title="Nudge West"
                style={{
                  background: '#1e293b',
                  border: '1px solid #38bdf8',
                  color: '#fff',
                  width: '42px',
                  height: '32px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ArrowLeft size={16} color="#38bdf8" />
              </button>

              <button
                onClick={() => handleResetPosition(selectedBuildingId)}
                title="Center / Reset"
                style={{
                  background: '#070b14',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#94a3b8',
                  width: '42px',
                  height: '32px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ResetIcon size={14} />
              </button>

              <button
                onClick={() => transformBuilding(selectedBuildingId, moveStep, 0)}
                title="Nudge East"
                style={{
                  background: '#1e293b',
                  border: '1px solid #38bdf8',
                  color: '#fff',
                  width: '42px',
                  height: '32px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ArrowRight size={16} color="#38bdf8" />
              </button>
            </div>

            <button
              onClick={() => transformBuilding(selectedBuildingId, 0, -moveStep)}
              title="Nudge South"
              style={{
                background: '#1e293b',
                border: '1px solid #38bdf8',
                color: '#fff',
                width: '42px',
                height: '32px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowDown size={16} color="#38bdf8" />
            </button>
          </div>

          {/* Scale & Rotate Tool Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => transformBuilding(selectedBuildingId, 0, 0, 1.03)}
                title="Scale Up (+3%)"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  color: '#34d399',
                  padding: '5px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: '700'
                }}
              >
                <ZoomIn size={12} /> +3%
              </button>
              <button
                onClick={() => transformBuilding(selectedBuildingId, 0, 0, 0.97)}
                title="Scale Down (-3%)"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  color: '#f87171',
                  padding: '5px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: '700'
                }}
              >
                <ZoomOut size={12} /> -3%
              </button>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => transformBuilding(selectedBuildingId, 0, 0, 1.0, -5)}
                title="Rotate Left (-5°)"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  color: '#fbbf24',
                  padding: '5px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: '700'
                }}
              >
                <RotateCcw size={12} /> -5°
              </button>
              <button
                onClick={() => transformBuilding(selectedBuildingId, 0, 0, 1.0, 5)}
                title="Rotate Right (+5°)"
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  color: '#fbbf24',
                  padding: '5px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: '700'
                }}
              >
                <RotateCw size={12} /> +5°
              </button>
            </div>
          </div>

          {/* Action Buttons: Save to Cadastre & Reset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <button
              onClick={() => handleSavePosition(selectedBuildingId)}
              disabled={isSaving}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#fff',
                padding: '9px',
                borderRadius: '7px',
                fontWeight: '900',
                fontSize: '11px',
                cursor: isSaving ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              <Save size={13} />
              <span>{isSaving ? 'Saving Position...' : 'Save Position to Cadastre'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Save Notification Toast */}
      {saveToast && (
        <div style={{
          position: 'absolute',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10, 16, 32, 0.98)',
          border: '1.5px solid #10b981',
          boxShadow: '0 0 30px rgba(16, 185, 129, 0.6)',
          padding: '8px 18px',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 800,
          zIndex: 60,
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{saveToast}</span>
        </div>
      )}

      {/* Hover Info Tooltip */}
      {hoveredInfo && !isMoveMode && (
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
