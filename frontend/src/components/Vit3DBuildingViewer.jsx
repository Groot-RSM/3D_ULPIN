import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { X, Box, Layers, ShieldCheck, CheckCircle2, Sliders, Info, Sparkles } from 'lucide-react';

export default function Vit3DBuildingViewer({
  building = null,
  onClose = () => {}
}) {
  const mountRef = useRef(null);
  const [explodeFactor, setExplodeFactor] = useState(0); // 0 = solid building, >0 = exploded floors
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);

  const bId = building?.building_id || 'VIT-B001';
  const name = building?.name || 'Building';

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

  useEffect(() => {
    if (!mountRef.current || !building) return;

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 450;

    // 1. Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050812');
    scene.fog = new THREE.FogExp2('#050812', 0.005);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(45, 45, 45);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(50, 80, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const cyanLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    cyanLight.position.set(-50, 40, -50);
    scene.add(cyanLight);

    // Ground Grid
    const grid = new THREE.GridHelper(100, 20, 0x38bdf8, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // 6. Extrude Building Slices into 3D Floors
    const coords = building.geometry ? (building.geometry.coordinates[0] || building.geometry.coordinates[0][0]) : [];
    const heightM = building.height_m || 30.0;
    const finalFloorsCount = reconciliation?.final_floor_count || Math.max(1, Math.round(heightM / 4.0));
    const flHeightM = heightM / finalFloorsCount;

    const floorGroup = new THREE.Group();
    floorGroupRef.current = floorGroup;
    scene.add(floorGroup);

    if (coords && coords.length > 0) {
      // Calculate Centroid in degrees
      const lats = coords.map(c => Array.isArray(c) ? c[1] : 0);
      const lons = coords.map(c => Array.isArray(c) ? c[0] : 0);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;

      // Shape definition
      const shape = new THREE.Shape();
      coords.forEach((pt, idx) => {
        if (!Array.isArray(pt)) return;
        const x = (pt[0] - centerLon) * 108500.0;
        const y = (pt[1] - centerLat) * 110800.0;
        if (idx === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });

      // Build each floor slab mesh
      for (let i = 0; i < finalFloorsCount; i++) {
        const extrudeSettings = {
          steps: 1,
          depth: flHeightM * 0.95,
          bevelEnabled: true,
          bevelThickness: 0.15,
          bevelSize: 0.15,
          bevelSegments: 2
        };

        const slabGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        slabGeo.computeVertexNormals();

        // Alternating Gold & Glass styling
        const isGround = i === 0;
        const isTop = i === finalFloorsCount - 1;
        const colorHex = isGround ? 0xf59e0b : isTop ? 0x38bdf8 : 0x0284c7;

        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.35,
          roughness: 0.3,
          metalness: 0.4,
          transparent: true,
          opacity: 0.9
        });

        const mesh = new THREE.Mesh(slabGeo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = i * flHeightM;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          floorLevel: i + 1,
          baseY: i * flHeightM,
          flHeight: flHeightM
        };

        // Slab Outline Wireframe
        const edges = new THREE.EdgesGeometry(slabGeo, 15);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.5 }));
        mesh.add(line);

        floorGroup.add(mesh);
      }

      // Position Camera centered at 3D building top
      camera.position.set(35, heightM * 1.3 + 15, 35);
      controls.target.set(0, heightM / 2, 0);
      controls.update();
    }

    // 7. Raycaster for Floor Selection Click
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
            height_m: flHeightM,
            area_m2: building.area_m2 || 1000,
            volume_m3: (building.area_m2 || 1000) * flHeightM,
            generation_method: reconciliation?.generation_method || 'DYNAMIC',
            certainty_tier: reconciliation?.certainty_tier || 'DERIVED'
          };
          setSelectedFloor(flData);
        }
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 8. Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Animate exploded floor displacement
      if (floorGroupRef.current) {
        floorGroupRef.current.children.forEach((child) => {
          if (child.userData && child.userData.floorLevel) {
            const level = child.userData.floorLevel;
            const targetY = child.userData.baseY + (level - 1) * (explodeFactor * 1.8);
            child.position.y += (targetY - child.position.y) * 0.1;
          }
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('click', handleCanvasClick);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [building, reconciliation, explodeFactor]);

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
        width: '940px',
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

        {/* STEP 9: EXPLODE FLOORS SLIDER BAR */}
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
            step="0.1"
            value={explodeFactor}
            onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
            style={{ width: '240px', accentColor: '#f59e0b', cursor: 'pointer' }}
          />

          <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
            💡 Displays vertical visual separation without modifying true stored Z coordinates.
          </div>
        </div>

        {/* 3D CANVAS & DETAILS SPLIT VIEW */}
        <div style={{ display: 'flex', flex: 1, height: '480px' }}>
          {/* 3D CANVAS VIEWPORT */}
          <div style={{ flex: 1, position: 'relative', height: '100%' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            <div style={{ position: 'absolute', bottom: '12px', left: '16px', fontSize: '11px', color: '#94a3b8', background: 'rgba(5,8,18,0.75)', padding: '4px 10px', borderRadius: '6px' }}>
              🖱️ Click any 3D floor slab to inspect metadata | Drag to rotate
            </div>
          </div>

          {/* RIGHT METRICS PANEL */}
          <div style={{ width: '310px', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '16px', background: '#070b14', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            
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
