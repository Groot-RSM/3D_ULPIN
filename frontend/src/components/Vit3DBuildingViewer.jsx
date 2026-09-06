import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { X, Box, CheckCircle2, Sliders, RotateCcw } from 'lucide-react';

export default function Vit3DBuildingViewer({
  building = null,
  onClose = () => {}
}) {
  const mountRef = useRef(null);
  const [explodeFactor, setExplodeFactor] = useState(0); // 0 = solid building, >0 = exploded floors
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);

  const explodeFactorRef = useRef(explodeFactor);
  explodeFactorRef.current = explodeFactor;

  const bId = building?.building_id || 'VIT-B001';

  // Load reconciliation evidence
  useEffect(() => {
    if (!building) return;
    if (building.reconciliation) {
      setReconciliation(building.reconciliation);
    } else {
      fetch(`http://127.0.0.1:8000/api/vit/buildings/${bId}/reconcile-floors`)
        .then(res => res.json())
        .then(data => setReconciliation(data))
        .catch(err => console.error("Error fetching reconciliation:", err));
    }
  }, [bId, building]);

  const floorGroupRef = useRef(null);
  const resetCameraRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !building) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050812');
    scene.fog = new THREE.FogExp2('#050812', 0.002);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 2000);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(80, 120, 80);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const cyanRimLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
    cyanRimLight.position.set(-80, 60, -80);
    scene.add(cyanRimLight);

    const warmFillLight = new THREE.DirectionalLight(0xf59e0b, 0.8);
    warmFillLight.position.set(0, -50, 0);
    scene.add(warmFillLight);

    // 6. Parse Polygon / MultiPolygon Geometry
    const polygons = [];
    if (building.geometry) {
      if (building.geometry.type === 'Polygon') {
        polygons.push(building.geometry.coordinates);
      } else if (building.geometry.type === 'MultiPolygon') {
        building.geometry.coordinates.forEach(polyCoords => polygons.push(polyCoords));
      }
    }

    // Collect all vertices to compute global centroid
    const allLons = [];
    const allLats = [];
    polygons.forEach(poly => {
      const outerRing = poly[0] || [];
      outerRing.forEach(pt => {
        if (Array.isArray(pt)) {
          allLons.push(pt[0]);
          allLats.push(pt[1]);
        }
      });
    });

    const minLon = allLons.length ? Math.min(...allLons) : 79.156;
    const maxLon = allLons.length ? Math.max(...allLons) : 79.156;
    const minLat = allLats.length ? Math.min(...allLats) : 12.969;
    const maxLat = allLats.length ? Math.max(...allLats) : 12.969;

    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const heightM = building.height_m || 24.0;
    const finalFloorsCount = reconciliation?.final_floor_count || Math.max(1, Math.round(heightM / 4.0));
    const flHeightM = heightM / finalFloorsCount;

    const floorGroup = new THREE.Group();
    floorGroupRef.current = floorGroup;
    scene.add(floorGroup);

    // Build 2D Shapes (with courtyard holes if present)
    const shapes = [];
    polygons.forEach(poly => {
      const outerRing = poly[0] || [];
      if (outerRing.length < 3) return;

      const shape = new THREE.Shape();
      outerRing.forEach((pt, idx) => {
        if (!Array.isArray(pt)) return;
        const x = (pt[0] - centerLon) * 108500.0;
        const y = (pt[1] - centerLat) * 110800.0;
        if (idx === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });

      // Handle inner rings (courtyards / holes)
      if (poly.length > 1) {
        for (let r = 1; r < poly.length; r++) {
          const holeRing = poly[r];
          if (holeRing.length >= 3) {
            const holePath = new THREE.Path();
            holeRing.forEach((pt, hIdx) => {
              if (!Array.isArray(pt)) return;
              const hx = (pt[0] - centerLon) * 108500.0;
              const hy = (pt[1] - centerLat) * 110800.0;
              if (hIdx === 0) holePath.moveTo(hx, hy);
              else holePath.lineTo(hx, hy);
            });
            shape.holes.push(holePath);
          }
        }
      }
      shapes.push(shape);
    });

    // 7. Extrude 3D Floor Slabs
    for (let i = 0; i < finalFloorsCount; i++) {
      const isGround = i === 0;
      const isTop = i === finalFloorsCount - 1;

      // Color scheme: Ground=Amber/Gold, Intermediate=Azure/Glass, Roof=Electric Cyan
      const colorHex = isGround ? 0xf59e0b : isTop ? 0x00f0ff : 0x0284c7;
      const emissiveHex = isGround ? 0x78350f : isTop ? 0x0891b2 : 0x075985;

      const floorSlabGroup = new THREE.Group();
      floorSlabGroup.userData = {
        floorLevel: i + 1,
        baseY: i * flHeightM,
        flHeight: flHeightM
      };

      const extrudeSettings = {
        steps: 1,
        depth: Math.max(0.6, flHeightM * 0.92),
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.12,
        bevelSegments: 2
      };

      shapes.forEach(shape => {
        const slabGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        slabGeo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: emissiveHex,
          emissiveIntensity: 0.28,
          roughness: 0.25,
          metalness: 0.45,
          transparent: true,
          opacity: 0.88
        });

        const mesh = new THREE.Mesh(slabGeo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { floorLevel: i + 1 };

        // Crisp outline edges
        const edges = new THREE.EdgesGeometry(slabGeo, 20);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: isTop ? 0x38bdf8 : isGround ? 0xfde68a : 0xe0f2fe,
            linewidth: 1.5,
            transparent: true,
            opacity: 0.95
          })
        );
        mesh.add(line);
        floorSlabGroup.add(mesh);
      });

      floorSlabGroup.position.y = i * flHeightM;
      floorGroup.add(floorSlabGroup);
    }

    // 8. Auto-calculate Bounding Box & Fit Camera Perfectly
    const box = new THREE.Box3().setFromObject(floorGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxHorizontal = Math.max(size.x, size.z, 20);
    const maxDim = Math.max(maxHorizontal, size.y, 25);

    // Dynamic ground grid
    const gridDim = Math.max(120, Math.ceil((maxHorizontal * 2.5) / 20) * 20);
    const grid = new THREE.GridHelper(gridDim, 20, 0x00f0ff, 0x1e293b);
    grid.position.set(center.x, 0, center.z);
    scene.add(grid);

    // Camera perspective distance calculation
    const fovRad = camera.fov * (Math.PI / 180);
    let cameraDist = (maxDim / 2) / Math.tan(fovRad / 2);
    cameraDist *= 1.45; // Generous framing padding

    const setupCamera = () => {
      camera.position.set(
        center.x + cameraDist * 0.85,
        center.y + cameraDist * 0.75,
        center.z + cameraDist * 0.85
      );
      camera.near = 0.5;
      camera.far = Math.max(2000, cameraDist * 10);
      camera.updateProjectionMatrix();

      controls.target.set(center.x, center.y, center.z);
      controls.minDistance = maxDim * 0.2;
      controls.maxDistance = cameraDist * 5;
      controls.update();
    };

    setupCamera();
    resetCameraRef.current = setupCamera;

    // 9. Raycasting for Floor Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(floorGroup.children, true);

      if (intersects.length > 0) {
        let parentMesh = intersects[0].object;
        while (parentMesh && !parentMesh.userData.floorLevel && parentMesh.parent) {
          parentMesh = parentMesh.parent;
        }
        if (parentMesh && parentMesh.userData.floorLevel) {
          const level = parentMesh.userData.floorLevel;
          const flData = reconciliation?.generated_floors?.find(f => f.level === level) || {
            floor_id: `${bId}-F${level.toString().padStart(2, '0')}`,
            level: level,
            label: level === 1 ? 'Ground Floor (G)' : `Floor ${level}`,
            z_min: (level - 1) * flHeightM,
            z_max: level * flHeightM,
            height_m: parseFloat(flHeightM.toFixed(1)),
            area_m2: building.area_m2 || 1000,
            volume_m3: Math.round((building.area_m2 || 1000) * flHeightM),
            generation_method: reconciliation?.generation_method || 'DYNAMIC',
            certainty_tier: reconciliation?.certainty_tier || 'DERIVED'
          };
          setSelectedFloor(flData);
        }
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 10. Smooth 60FPS Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Smooth vertical lerp when explode factor changes
      const currentFactor = explodeFactorRef.current;
      if (floorGroupRef.current) {
        floorGroupRef.current.children.forEach((child) => {
          if (child.userData && child.userData.floorLevel) {
            const level = child.userData.floorLevel;
            // Progressive gap expansion per level
            const displacement = (level - 1) * (currentFactor * (flHeightM * 0.9 + 3.0));
            const targetY = child.userData.baseY + displacement;
            child.position.y += (targetY - child.position.y) * 0.12;
          }
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 11. Handle Resizing
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('click', handleCanvasClick);
      }
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      
      // Deep resource disposal
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      controls.dispose();
      renderer.dispose();
      if (typeof renderer.forceContextLoss === 'function') {
        renderer.forceContextLoss();
      }
    };
  }, [building, reconciliation, bId]);

  if (!building) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 8, 18, 0.88)',
      backdropFilter: 'blur(12px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '980px',
        maxHeight: '92vh',
        background: 'rgba(10, 16, 32, 0.96)',
        border: '1.5px solid #f59e0b',
        boxShadow: '0 25px 50px rgba(245, 158, 11, 0.35)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* MODAL HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(7, 11, 20, 0.8)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Box size={22} color="#f59e0b" />
            <div>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, letterSpacing: '1px' }}>
                3D EXPLODED FLOOR INSPECTOR & RECONCILIATION
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#fff' }}>
                {building.name} ({building.building_id})
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* EXPLODE FLOORS SLIDER BAR */}
        <div style={{
          padding: '10px 24px',
          background: 'rgba(15, 23, 42, 0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={16} color="#f59e0b" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#fbbf24' }}>
              EXPLODE FLOORS DISPLACEMENT:
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {explodeFactor.toFixed(1)}x Gap
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={explodeFactor}
            onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
            style={{ width: '240px', accentColor: '#f59e0b', cursor: 'pointer' }}
          />

          <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
            💡 Drag slider to visually separate vertical floor plates in real-time.
          </div>
        </div>

        {/* 3D CANVAS & DETAILS SPLIT VIEW */}
        <div style={{ display: 'flex', flex: 1, height: '490px' }}>
          {/* 3D CANVAS VIEWPORT */}
          <div style={{ flex: 1, position: 'relative', height: '100%' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            
            {/* Control Badges Overlay */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '16px',
              fontSize: '11px',
              color: '#94a3b8',
              background: 'rgba(5,8,18,0.85)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              🖱️ Left-Click: Orbit | Right-Click: Pan | Scroll: Zoom | Click Slab: Select
            </div>

            {/* Reset Camera Button */}
            <button
              onClick={() => resetCameraRef.current && resetCameraRef.current()}
              style={{
                position: 'absolute',
                top: '12px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={13} />
              Reset View
            </button>
          </div>

          {/* RIGHT METRICS PANEL */}
          <div style={{
            width: '320px',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            padding: '16px',
            background: '#070b14',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto'
          }}>
            
            {/* SELECTED FLOOR DETAILS */}
            {selectedFloor ? (
              <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid #38bdf8', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8' }}>
                    {selectedFloor.label} ({selectedFloor.floor_id})
                  </span>
                  <button
                    onClick={() => setSelectedFloor(null)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Z Bounds:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
                      {selectedFloor.z_min}m → {selectedFloor.z_max}m
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Floor Height:</span>
                    <span style={{ color: '#fff' }}>{selectedFloor.height_m} m</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Floor Area:</span>
                    <span style={{ color: '#fff' }}>{selectedFloor.area_m2?.toLocaleString()} m²</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Slab Volume:</span>
                    <span style={{ color: '#34d399', fontWeight: '700' }}>{selectedFloor.volume_m3?.toLocaleString()} m³</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Floor 3D ULPIN:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#fbbf24', fontWeight: '700' }}>
                      {selectedFloor.ulpin || `ULPIN-IN-TN-VEL-${selectedFloor.floor_id}`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Method:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#cbd5e1' }}>{selectedFloor.generation_method}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                👈 Click any 3D floor slab in the viewer to view Z-bounds and volume data.
              </div>
            )}

            <div style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.5px', marginTop: '4px' }}>
              RECONCILIATION SUMMARY
            </div>

            <div className="detail-row-aligned">
              <span className="detail-label-text">Structure</span>
              <span className="detail-value-text" style={{ color: '#fbbf24' }}>{building.name}</span>
            </div>

            <div className="detail-row-aligned">
              <span className="detail-label-text">OSM Levels</span>
              <span className="detail-value-text" style={{ color: reconciliation?.floor_count_osm ? '#34d399' : '#f87171' }}>
                {reconciliation?.floor_count_osm ? `${reconciliation.floor_count_osm} Levels` : 'NOT AVAILABLE'}
              </span>
            </div>

            <div className="detail-row-aligned">
              <span className="detail-label-text">Height Estimate</span>
              <span className="detail-value-text" style={{ color: '#fbbf24' }}>
                {reconciliation?.floor_count_height_estimate ? `${reconciliation.floor_count_height_estimate} Levels` : 'N/A'}
              </span>
            </div>

            <div className="detail-row-aligned">
              <span className="detail-label-text">Final Reconciled</span>
              <span className="detail-value-text" style={{ color: '#38bdf8', fontWeight: '800' }}>
                {reconciliation?.final_floor_count || 'N/A'} Floors
              </span>
            </div>

            <div className="detail-row-aligned">
              <span className="detail-label-text">Agreement Status</span>
              <span className="detail-value-text" style={{ color: '#34d399', fontWeight: '700' }}>
                {reconciliation?.agreement_status || 'MATCH'}
              </span>
            </div>

            <div className="detail-row-aligned">
              <span className="detail-label-text">Confidence Tier</span>
              <span className="detail-value-text" style={{ color: '#38bdf8', fontWeight: '800' }}>
                {reconciliation?.confidence_tier || 'HIGH'}
              </span>
            </div>

            <div className="detail-row-aligned">
              <span className="detail-label-text">Internal Floor Plan</span>
              <span className="detail-value-text" style={{ color: building?.has_units ? '#34d399' : '#94a3b8', fontSize: '10.5px' }}>
                {building?.has_units ? 'MAPPED' : 'INTERNAL PLAN NOT AVAILABLE'}
              </span>
            </div>

            <div style={{ marginTop: 'auto', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>{reconciliation?.generated_floors?.length || 0} Dynamic Slices Rendered</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
