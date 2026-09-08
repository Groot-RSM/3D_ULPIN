import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { X, Box, CheckCircle2, Sliders, RotateCcw, Layers, ShieldCheck, Download, Eye, EyeOff, Info, ArrowUpDown, Compass } from 'lucide-react';

export default function Vit3DBuildingViewer({
  building = null,
  onClose = () => { }
}) {
  const mountRef = useRef(null);
  const [canonicalModel, setCanonicalModel] = useState(null);
  const [explodeFactor, setExplodeFactor] = useState(0); // 0 = solid, >0 = exploded
  const [selectedFloorLevel, setSelectedFloorLevel] = useState(1);
  const [isolateFloor, setIsolateFloor] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  const bId = building?.building_id || 'VIT-B001';
  const name = building?.name || canonicalModel?.building_name || 'Campus Building';

  const explodeFactorRef = useRef(explodeFactor);
  explodeFactorRef.current = explodeFactor;

  const isolateFloorRef = useRef(isolateFloor);
  isolateFloorRef.current = isolateFloor;

  const selectedFloorLevelRef = useRef(selectedFloorLevel);
  selectedFloorLevelRef.current = selectedFloorLevel;

  const selectedUnitRef = useRef(selectedUnit);
  selectedUnitRef.current = selectedUnit;

  // 1. Fetch Canonical Phase 6B Model
  useEffect(() => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/documents/building-reconstruction/${bId}`)
      .then(res => res.json())
      .then(data => {
        setCanonicalModel(data);
        if (data.floors && data.floors.length > 0) {
          const fl0 = data.floors[0];
          if (fl0.units && fl0.units.length > 0) {
            const firstClassroom = fl0.units.find(u => !u.is_common_infrastructure && u.official_ulpin) || fl0.units[0];
            setSelectedUnit(firstClassroom);
            setSelectedFloorLevel(fl0.physical_level);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching canonical 3D model:", err);
        setLoading(false);
      });
  }, [bId]);

  // 2. Three.js Phase 6B Viewer (Building -> Floors -> Units ONLY)
  const sceneRef = useRef(null);
  const floorMeshesRef = useRef([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !canonicalModel) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 500;

    // A. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#050812');
    scene.fog = new THREE.FogExp2('#050812', 0.0015);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // B. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight1.position.set(100, 150, 100);
    scene.add(dirLight1);

    const cyanLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    cyanLight.position.set(-100, 80, -100);
    scene.add(cyanLight);

    // C. Parse Polygon Geometries
    const rawGeom = canonicalModel.envelope?.footprint_geometry;
    if (!rawGeom) return;

    let coordinatesList = [];
    if (rawGeom.type === 'Polygon') {
      coordinatesList = rawGeom.coordinates;
    } else if (rawGeom.type === 'MultiPolygon') {
      coordinatesList = rawGeom.coordinates[0];
    }

    // Extract outer ring points
    const outerRing = coordinatesList[0] || [];
    const allLons = outerRing.map(p => p[0]);
    const allLats = outerRing.map(p => p[1]);

    const centerLon = (Math.min(...allLons) + Math.max(...allLons)) / 2.0;
    const centerLat = (Math.min(...allLats) + Math.max(...allLats)) / 2.0;

    // Convert geographic coordinates to local metric XY centered at (0, 0)
    const toLocalXY = (lon, lat) => {
      const x = (lon - centerLon) * 111320 * Math.cos(centerLat * Math.PI / 180);
      const y = (lat - centerLat) * 110574;
      return [x, y];
    };

    // Build Footprint Shape
    const outerShape = new THREE.Shape();
    outerRing.forEach((pt, idx) => {
      const [x, y] = toLocalXY(pt[0], pt[1]);
      if (idx === 0) outerShape.moveTo(x, y);
      else outerShape.lineTo(x, y);
    });

    // Holes
    for (let h = 1; h < coordinatesList.length; h++) {
      const holeRing = coordinatesList[h];
      const holePath = new THREE.Path();
      holeRing.forEach((pt, idx) => {
        const [x, y] = toLocalXY(pt[0], pt[1]);
        if (idx === 0) holePath.moveTo(x, y);
        else holePath.lineTo(x, y);
      });
      outerShape.holes.push(holePath);
    }

    // D. Scene Hierarchy: Building -> Floor -> Units
    const buildingNode = new THREE.Group();
    buildingNode.name = `Building_${canonicalModel.building_id}`;
    scene.add(buildingNode);

    const floorNodes = [];
    floorMeshesRef.current = floorNodes;

    // Color Palette for Units (Purely UI visualization colors)
    const unitColorPalette = ['#0284c7', '#38bdf8', '#0ea5e9', '#06b6d4', '#6366f1', '#8b5cf6'];

    canonicalModel.floors.forEach((fl) => {
      const floorNode = new THREE.Group();
      floorNode.name = `Floor_${fl.floor_id}`;
      floorNode.userData = {
        floor_id: fl.floor_id,
        level: fl.physical_level,
        base_z: fl.base_height_m,
        top_z: fl.top_height_m,
        floor_type: fl.floor_type,
        floor_h: fl.top_height_m - fl.base_height_m
      };

      const flH = fl.top_height_m - fl.base_height_m;

      // 1. Floor Slab / Boundary Geometry
      const slabGeom = new THREE.ExtrudeGeometry(outerShape, {
        depth: 0.25,
        bevelEnabled: false
      });
      slabGeom.rotateX(Math.PI / 2);

      const slabMat = new THREE.MeshStandardMaterial({
        color: fl.physical_level === 1 ? 0x0284c7 : 0x1e293b,
        metalness: 0.2,
        roughness: 0.5,
        transparent: true,
        opacity: 0.95
      });
      const slabMesh = new THREE.Mesh(slabGeom, slabMat);
      slabMesh.position.y = fl.base_height_m;
      floorNode.add(slabMesh);

      // 2. Units Group (Phase 6B hierarchy: Floor -> Units -> Unit_A, Unit_B)
      const unitsNode = new THREE.Group();
      unitsNode.name = `Units_L${fl.physical_level}`;

      fl.units.forEach((u, uIdx) => {
        const uGeomRaw = u.geometry;
        if (!uGeomRaw) return;

        let uCoords = [];
        if (uGeomRaw.type === 'Polygon') uCoords = uGeomRaw.coordinates;
        else if (uGeomRaw.type === 'MultiPolygon') uCoords = uGeomRaw.coordinates[0];

        const uOuter = uCoords[0] || [];
        const uShape = new THREE.Shape();
        uOuter.forEach((pt, pIdx) => {
          const [ux, uy] = toLocalXY(pt[0], pt[1]);
          if (pIdx === 0) uShape.moveTo(ux, uy);
          else uShape.lineTo(ux, uy);
        });

        for (let uh = 1; uh < uCoords.length; uh++) {
          const uhRing = uCoords[uh];
          const uhPath = new THREE.Path();
          uhRing.forEach((pt, pIdx) => {
            const [ux, uy] = toLocalXY(pt[0], pt[1]);
            if (pIdx === 0) uhPath.moveTo(ux, uy);
            else uhPath.lineTo(ux, uy);
          });
          uShape.holes.push(uhPath);
        }

        const isLift = !!u.is_lift;
        const isCorridor = !!u.is_corridor;
        const isUnitSelected = selectedUnitRef.current?.unit_id === u.unit_id && selectedUnitRef.current?.floor_id === fl.floor_id;

        let uColor = unitColorPalette[uIdx % unitColorPalette.length];
        let meshOpacity = 0.75;
        let meshDepth = Math.max(0.5, flH - 0.25);

        if (isLift) {
          uColor = '#a855f7'; // Distinct Purple/Violet Elevator Shaft
          meshOpacity = 0.92;
        } else if (isCorridor) {
          uColor = '#0f172a'; // Subtle Dark Slate Central Free Walking Space
          meshOpacity = 0.25;
          meshDepth = 0.1; // Thin walking corridor slab
        } else if (isUnitSelected) {
          uColor = '#ff0055'; // Vivid Ruby Crimson
          meshOpacity = 1.0;
        }

        const unitVolGeom = new THREE.ExtrudeGeometry(uShape, {
          depth: meshDepth,
          bevelEnabled: false
        });
        unitVolGeom.rotateX(Math.PI / 2);

        const unitMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(uColor),
          metalness: isLift ? 0.6 : 0.3,
          roughness: isLift ? 0.2 : 0.4,
          transparent: true,
          opacity: meshOpacity
        });

        const unitMesh = new THREE.Mesh(unitVolGeom, unitMat);
        unitMesh.name = `Unit_${u.unit_id.replace(/\s+/g, '_')}`;
        unitMesh.position.y = fl.base_height_m + (isCorridor ? 0.05 : 0.25);
        unitMesh.userData = {
          isUnit: true,
          unitData: u,
          floorData: fl
        };

        // Unit Wireframe Edges
        const edgesGeom = new THREE.EdgesGeometry(unitVolGeom);
        const edgesMat = new THREE.LineBasicMaterial({
          color: isLift ? 0xc084fc : isUnitSelected ? 0xffffff : (isCorridor ? 0x334155 : 0x38bdf8),
          linewidth: isLift ? 2 : (isUnitSelected ? 2.5 : 1.5),
          transparent: true,
          opacity: isCorridor ? 0.3 : (isUnitSelected ? 1.0 : 0.85)
        });
        const edges = new THREE.LineSegments(edgesGeom, edgesMat);
        unitMesh.add(edges);

        unitsNode.add(unitMesh);
      });

      floorNode.add(unitsNode);
      buildingNode.add(floorNode);
      floorNodes.push(floorNode);
    });

    // Raycasting for Unit Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingNode.children, true);

      for (let hit of intersects) {
        let obj = hit.object;
        while (obj && !obj.userData?.isUnit && obj !== buildingNode && obj.parent) {
          obj = obj.parent;
        }
        if (obj && obj.userData?.isUnit) {
          const uData = obj.userData.unitData;
          const flData = obj.userData.floorData;
          setSelectedUnit(uData);
          setSelectedFloorLevel(flData.physical_level);
          break;
        }
      }
    };

    const handlePointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingNode.children, true);
      const isHovering = intersects.some(hit => {
        let obj = hit.object;
        while (obj && !obj.userData?.isUnit && obj !== buildingNode && obj.parent) {
          obj = obj.parent;
        }
        return obj && obj.userData?.isUnit;
      });
      renderer.domElement.style.cursor = isHovering ? 'pointer' : 'default';
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.addEventListener('mousemove', handlePointerMove);

    // Camera Positioning
    camera.position.set(90, 80, 110);
    camera.lookAt(0, 18, 0);
    controls.target.set(0, 18, 0);

    // Animation Loop with Distinct High-Contrast Room Selection Highlighting
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const exp = explodeFactorRef.current;
      const iso = isolateFloorRef.current;
      const selLevel = selectedFloorLevelRef.current;
      const selUnit = selectedUnitRef.current;

      floorNodes.forEach((fn) => {
        const lvl = fn.userData.level;
        const isFloorSelected = (lvl === selLevel);

        // Explode offset
        fn.position.y = (lvl - 1) * exp * 12.0;

        // Floor isolation
        if (iso) {
          fn.visible = isFloorSelected;
        } else {
          fn.visible = true;
        }

        // 1. Floor Slab Material (Vivid Yellow when floor is selected / exploding)
        if (fn.children[0] && fn.children[0].isMesh) {
          const slabMesh = fn.children[0];
          if (isFloorSelected) {
            slabMesh.material.color.setHex(0xfacc15); // Vivid Golden Yellow Exploded Floor Slab
            slabMesh.material.opacity = 0.98;
          } else {
            slabMesh.material.color.setHex(lvl === 1 ? 0x0284c7 : 0x1e293b); // Cadastral Blue / Dark Slate
            slabMesh.material.opacity = 0.85;
          }
        }

        // 2. Units Highlighting (Golden Amber on selected floor; Selected room pops in Stark Electric Neon Cyan)
        const unitsGroup = fn.children[1];
        if (unitsGroup && unitsGroup.children) {
          unitsGroup.children.forEach((unitMesh, uIdx) => {
            if (unitMesh.isMesh && unitMesh.userData?.unitData) {
              const uData = unitMesh.userData.unitData;
              const isUnitDirectlySelected = (selUnit?.unit_id === uData.unit_id && selUnit?.floor_id === fn.userData.floor_id);
              const isLift = !!uData.is_lift;
              const isCorridor = !!uData.is_corridor;

              if (isUnitDirectlySelected) {
                // STARK CONTRAST: The selected room illuminates in Vivid Electric Crimson/Ruby Red (high contrast on yellow and blue)
                unitMesh.material.color.setHex(0xff0055); // Vivid Electric Crimson
                unitMesh.material.emissive.setHex(0x660022); // Radiant Emissive Glow
                unitMesh.material.opacity = 1.0;
              } else if (isLift) {
                // Central Elevator Shaft in Purple Glass
                unitMesh.material.color.setHex(0xa855f7);
                unitMesh.material.emissive.setHex(0x000000);
                unitMesh.material.opacity = 0.90;
              } else if (isCorridor) {
                // Central Walking Corridor (Dark Slate floor tile)
                unitMesh.material.color.setHex(0x0f172a);
                unitMesh.material.emissive.setHex(0x000000);
                unitMesh.material.opacity = 0.25;
              } else if (isFloorSelected) {
                // All other classrooms on the selected floor remain in vibrant Golden Yellow / Amber
                unitMesh.material.color.setHex(uIdx % 2 === 0 ? 0xfbbf24 : 0xf59e0b);
                unitMesh.material.emissive.setHex(0x000000);
                unitMesh.material.opacity = 0.90;
              } else {
                // Inactive floors remain in standard cadastral blue / cyan
                unitMesh.material.color.setHex(uIdx % 2 === 0 ? 0x0284c7 : 0x0ea5e9);
                unitMesh.material.emissive.setHex(0x000000);
                unitMesh.material.opacity = 0.65;
              }

              // Update Unit Wireframe Edges
              if (unitMesh.children[0] && unitMesh.children[0].isLineSegments) {
                const edge = unitMesh.children[0];
                if (isUnitDirectlySelected) {
                  // Pure White Glowing Border for selected room
                  edge.material.color.setHex(0xffffff); // Pure White Glowing Border
                  edge.material.opacity = 1.0;
                } else if (isLift) {
                  edge.material.color.setHex(0xc084fc); // Purple Lift Outline
                  edge.material.opacity = 0.90;
                } else if (isCorridor) {
                  edge.material.color.setHex(0x334155);
                  edge.material.opacity = 0.25;
                } else if (isFloorSelected) {
                  edge.material.color.setHex(0xfef08a); // Bright Yellow Outline on selected floor
                  edge.material.opacity = 0.95;
                } else {
                  edge.material.color.setHex(0x38bdf8); // Sky blue outline on inactive floors
                  edge.material.opacity = 0.60;
                }
              }
            }
          });
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.dispose();
    };
  }, [canonicalModel]);

  // Export Clean Phase 6B GLB
  const handleExportGLB = () => {
    if (!sceneRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      sceneRef.current,
      (gltf) => {
        const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bId}_Phase6B_Cadastral_Model.gltf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      (error) => console.error("GLTF Export Error:", error),
      { binary: false }
    );
  };

  const selectedFloor = canonicalModel?.floors?.find(f => f.physical_level === selectedFloorLevel);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 8, 18, 0.96)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header */}
      <div style={{
        height: '56px',
        background: 'rgba(10, 16, 32, 0.98)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Box size={20} color="#f59e0b" />
          <span style={{ fontSize: '15px', fontWeight: '900', color: '#fff' }}>
            Phase 6B Cadastral 3D Model: <span style={{ color: '#38bdf8' }}>{name}</span>
          </span>
          <span style={{
            fontSize: '10.5px',
            color: '#34d399',
            background: 'rgba(16,185,129,0.15)',
            border: '1px solid #10b981',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontWeight: '700'
          }}>
            3D RECONSTRUCTION READY
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleExportGLB}
            style={{
              background: '#0284c7',
              border: 'none',
              color: '#fff',
              padding: '7px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={13} />
            <span>Export GLB / GLTF</span>
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Viewport & Floating Cadastral Panels */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {/* LEFT PANEL: Floor Hierarchy & Explode Slider */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          width: '320px',
          maxHeight: 'calc(100% - 32px)',
          background: 'rgba(10, 16, 32, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontSize: '11.5px',
          color: '#fff',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase' }}>
              Floor Subdivision Schedule
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              {canonicalModel?.floors_count || 7} Floors
            </span>
          </div>

          {/* Explode Mode Slider */}
          <div style={{ background: '#070b14', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Sliders size={12} /> Explode Floors</span>
              <span style={{ color: '#38bdf8', fontWeight: '700' }}>{(explodeFactor * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={explodeFactor}
              onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
            />
          </div>

          {/* Floor Selection List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {canonicalModel?.floors?.map((fl) => {
              const isSelected = fl.physical_level === selectedFloorLevel;
              const floorTitle = fl.display_name || (fl.physical_level === 1 ? 'Ground Floor' : `Level ${fl.physical_level} (${fl.physical_level - 1}${['st', 'nd', 'rd'][fl.physical_level - 2] || 'th'} Floor)`);
              return (
                <div
                  key={fl.floor_id}
                  onClick={() => {
                    setSelectedFloorLevel(fl.physical_level);
                    if (fl.units?.length > 0) setSelectedUnit(fl.units[0]);
                  }}
                  style={{
                    background: isSelected ? 'rgba(250, 204, 21, 0.20)' : '#070b14',
                    border: `1.8px solid ${isSelected ? '#facc15' : '#1e293b'}`,
                    boxShadow: isSelected ? '0 0 14px rgba(250, 204, 21, 0.35)' : 'none',
                    padding: '9px 11px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '800', color: isSelected ? '#facc15' : '#fff', fontSize: '12px' }}>
                      {floorTitle}
                    </span>
                    <span style={{
                      fontSize: '9.5px',
                      color: isSelected ? '#000' : '#fbbf24',
                      background: isSelected ? '#facc15' : 'rgba(245,158,11,0.15)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: '800'
                    }}>
                      {fl.units_count} Rooms
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: isSelected ? '#fef08a' : '#94a3b8', fontSize: '10px', marginTop: '3px' }}>
                    <span>Elevation: {fl.base_height_m}m → {fl.top_height_m}m</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{fl.floor_id}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floor Isolation Toggle */}
          <button
            onClick={() => setIsolateFloor(prev => !prev)}
            style={{
              background: isolateFloor ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isolateFloor ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
              color: isolateFloor ? '#fca5a5' : '#fff',
              padding: '8px',
              borderRadius: '6px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isolateFloor ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{isolateFloor ? 'Disable Floor Isolation' : 'Isolate Selected Floor'}</span>
          </button>
        </div>

        {/* RIGHT PANEL: Phase 6B Property Unit Inspector & Unit Directory */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '360px',
          maxHeight: 'calc(100% - 32px)',
          background: 'rgba(10, 16, 32, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontSize: '11.5px',
          color: '#fff',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={14} color="#f59e0b" />
              3D Cadastral Unit Inspector
            </span>
            <span style={{ fontSize: '10px', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
              {selectedUnit ? selectedUnit.internal_property_id : "No Unit Selected"}
            </span>
          </div>

          {/* Prominent Highlighted 3D ULPIN or Lift Infrastructure Banner */}
          {selectedUnit && (
            <div style={{
              background: selectedUnit.is_lift
                ? 'rgba(168, 85, 247, 0.2)'
                : selectedUnit.is_corridor
                  ? 'rgba(30, 41, 59, 0.8)'
                  : 'rgba(239, 68, 68, 0.2)',
              border: `1.5px solid ${selectedUnit.is_lift ? '#a855f7' : selectedUnit.is_corridor ? '#475569' : '#ff0055'}`,
              borderRadius: '8px',
              padding: '10px 12px',
              boxShadow: selectedUnit.is_lift ? '0 0 15px rgba(168, 85, 247, 0.3)' : '0 0 16px rgba(255, 0, 85, 0.35)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9.5px', color: selectedUnit.is_lift ? '#e9d5ff' : selectedUnit.is_corridor ? '#94a3b8' : '#fda4af', fontWeight: '800', textTransform: 'uppercase' }}>
                  {selectedUnit.is_lift ? "Vertical Elevator Core" : selectedUnit.is_corridor ? "Circulation Atrium / Free Space" : "Authoritative 3D ULPIN"}
                </span>
                <span style={{
                  fontSize: '9px',
                  background: selectedUnit.is_lift ? '#a855f7' : selectedUnit.is_corridor ? '#334155' : '#ff0055',
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontWeight: '900'
                }}>
                  {selectedUnit.is_lift ? "NO ULPIN (COMMON UTILITY)" : selectedUnit.is_corridor ? "COMMON SPACE" : "SELECTED ROOM"}
                </span>
              </div>
              <div style={{
                fontSize: selectedUnit.official_ulpin ? '13px' : '11px',
                fontWeight: '900',
                color: selectedUnit.official_ulpin ? '#ff2a5f' : selectedUnit.is_lift ? '#d8b4fe' : '#94a3b8',
                fontFamily: selectedUnit.official_ulpin ? 'var(--font-mono)' : 'inherit',
                marginTop: '4px',
                letterSpacing: '0.3px',
                wordBreak: 'break-all'
              }}>
                {selectedUnit.official_ulpin || (selectedUnit.is_lift ? "Shared Vertical Lift Shaft — No ULPIN Assigned" : "Central Free Space / Corridor Atrium")}
              </div>
            </div>
          )}

          {selectedUnit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '900', color: selectedUnit.is_lift ? '#c084fc' : '#38bdf8' }}>
                  {selectedUnit.unit_id}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Building: <b>{name}</b> ({selectedUnit.building_id})
                </div>
              </div>

              {/* Property Attributes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: '#070b14', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ color: '#94a3b8', fontSize: '9.5px' }}>Floor Level</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff', marginTop: '2px' }}>
                    {selectedFloor?.display_name || `Level ${selectedUnit.physical_level}`}
                  </div>
                </div>

                <div style={{ background: '#070b14', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ color: '#94a3b8', fontSize: '9.5px' }}>Elevation (Z)</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                    {selectedUnit.base_height_m}m → {selectedUnit.top_height_m}m
                  </div>
                </div>

                <div style={{ background: '#070b14', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ color: '#94a3b8', fontSize: '9.5px' }}>Unit Area</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#fbbf24', marginTop: '2px' }}>
                    {selectedUnit.unit_area_m2?.toLocaleString()} m²
                  </div>
                </div>

                <div style={{ background: '#070b14', padding: '8px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ color: '#94a3b8', fontSize: '9.5px' }}>3D Unit Volume</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>
                    {selectedUnit.unit_volume_m3?.toLocaleString()} m³
                  </div>
                </div>
              </div>

              {/* Cadastral Traceability & Provenance */}
              <div style={{ background: '#070b14', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '10.5px' }}>
                <div style={{ color: '#38bdf8', fontWeight: '700', marginBottom: '2px' }}>
                  2D → 3D CADASTRE TRACEABILITY
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Geometry Source:</span>
                  <span style={{ color: '#fff' }}>{selectedUnit.geometry_source}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Classification:</span>
                  <span style={{ color: selectedUnit.is_lift ? '#c084fc' : '#34d399', fontWeight: '700' }}>
                    {selectedUnit.is_lift ? "Vertical Service Lift (Common Infrastructure)" : selectedUnit.is_corridor ? "Circulation Atrium" : "Sanctioned Classroom / Unit"}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>3D ULPIN Status:</span>
                  <span style={{ color: selectedUnit.official_ulpin ? '#fbbf24' : '#94a3b8', fontWeight: '700' }}>
                    {selectedUnit.official_ulpin ? "Assigned & Active" : "Exempt (No ULPIN for Shared Core)"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
              Click any 3D volumetric unit in the viewport to inspect property details.
            </div>
          )}

          {/* Interactive Unit / Room Directory for Active Floor */}
          {selectedFloor && selectedFloor.units && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {/* Central Core Elements (Lifts & Corridor) */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Central Core Infrastructure (No ULPIN)
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {selectedFloor.units.filter(u => u.is_common_infrastructure).map((u) => {
                    const isUnitActive = selectedUnit?.unit_id === u.unit_id && selectedUnit?.floor_id === selectedFloor.floor_id;
                    return (
                      <button
                        key={u.internal_property_id || u.unit_id}
                        onClick={() => setSelectedUnit(u)}
                        style={{
                          background: isUnitActive ? '#a855f7' : 'rgba(168, 85, 247, 0.12)',
                          border: `1px solid ${isUnitActive ? '#c084fc' : 'rgba(168, 85, 247, 0.3)'}`,
                          color: '#fff',
                          borderRadius: '5px',
                          padding: '4px 8px',
                          fontSize: '9.5px',
                          fontWeight: isUnitActive ? '900' : '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{u.is_lift ? <ArrowUpDown size={12} /> : <Compass size={12} />}</span>
                        <span>{u.unit_id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Side Classroom Units */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#fbbf24', textTransform: 'uppercase' }}>
                    Side Classrooms ({selectedFloor.units.filter(u => !u.is_common_infrastructure).length} Rooms with 3D ULPIN)
                  </span>
                  <span style={{ fontSize: '9px', color: '#94a3b8' }}>Click to Highlight</span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '4px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  background: '#040711',
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #1e293b'
                }}>
                  {selectedFloor.units.filter(u => !u.is_common_infrastructure).map((u) => {
                    const isUnitActive = selectedUnit?.unit_id === u.unit_id && selectedUnit?.floor_id === selectedFloor.floor_id;
                    return (
                      <button
                        key={u.internal_property_id || u.unit_id}
                        onClick={() => setSelectedUnit(u)}
                        style={{
                          background: isUnitActive ? '#ef4444' : 'rgba(255,255,255,0.05)',
                          border: `1.2px solid ${isUnitActive ? '#ff0055' : 'rgba(255,255,255,0.1)'}`,
                          color: '#fff',
                          boxShadow: isUnitActive ? '0 0 10px rgba(255, 0, 85, 0.6)' : 'none',
                          borderRadius: '5px',
                          padding: '4px 2px',
                          fontSize: '10px',
                          fontWeight: isUnitActive ? '900' : '600',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        title={`${u.unit_id}: ${u.official_ulpin} (${u.unit_area_m2} m²)`}
                      >
                        {u.unit_id}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
