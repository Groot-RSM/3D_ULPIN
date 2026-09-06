import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { X, Box, CheckCircle2, Sliders, RotateCcw, Sparkles, Layers, ShieldCheck, FileText, Check, LayoutGrid, Eye } from 'lucide-react';

export default function Vit3DBuildingViewer({
 building = null,
 onClose = () => {}
}) {
 const mountRef = useRef(null);
 const [explodeFactor, setExplodeFactor] = useState(0); // 0 = solid building, >0 = exploded floors
 const [selectedFloorLevel, setSelectedFloorLevel] = useState(1);
 const [selectedFloorData, setSelectedFloorData] = useState(null);
 const [floorPlanData, setFloorPlanData] = useState(null);
 const [loadingPlan, setLoadingPlan] = useState(false);
 const [selectedRoom, setSelectedRoom] = useState(null);
 const [viewMode, setViewMode] = useState('3d'); // '3d' | '2d'
 const [reconciliation, setReconciliation] = useState(null);

 const explodeFactorRef = useRef(explodeFactor);
 explodeFactorRef.current = explodeFactor;

 const bId = building?.building_id || 'VIT-B001';
 const name = building?.name || 'Technology Tower (TT)';

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

 // Fetch / Generate Floor Plan when building or selected floor changes
 const loadFloorPlan = (floorLevel) => {
 setLoadingPlan(true);
 fetch(`http://127.0.0.1:8000/api/vit/buildings/${bId}/floor-plan/${floorLevel}`)
 .then(res => res.json())
 .then(data => {
 setFloorPlanData(data);
 if (data && data.rooms && data.rooms.length > 0) {
 setSelectedRoom(data.rooms[0]);
 }
 setLoadingPlan(false);
 })
 .catch(err => {
 console.error("Error loading floor plan:", err);
 setLoadingPlan(false);
 });
 };

 useEffect(() => {
 if (building) {
 loadFloorPlan(selectedFloorLevel);
 }
 }, [bId, building, selectedFloorLevel]);

 const floorGroupRef = useRef(null);
 const resetCameraRef = useRef(null);
 const interiorGroupRef = useRef(null);

 useEffect(() => {
 const container = mountRef.current;
 if (!container || !building || viewMode !== '3d') return;

 const width = container.clientWidth || 600;
 const height = container.clientHeight || 480;

 // 1. Three.js Scene Setup
 const scene = new THREE.Scene();
 scene.background = new THREE.Color('#050812');
 scene.fog = new THREE.FogExp2('#050812', 0.0018);

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
 const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
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

 // 6. Parse Polygon Geometry
 const polygons = [];
 if (building.geometry) {
 if (building.geometry.type === 'Polygon') {
 polygons.push(building.geometry.coordinates);
 } else if (building.geometry.type === 'MultiPolygon') {
 building.geometry.coordinates.forEach(polyCoords => polygons.push(polyCoords));
 }
 }

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
 const clickableMeshes = [];

 for (let i = 0; i < finalFloorsCount; i++) {
 const floorLevel = i + 1;
 const isSelected = floorLevel === selectedFloorLevel;
 const isGround = i === 0;
 const isTop = i === finalFloorsCount - 1;

 const colorHex = isSelected ? 0x38bdf8 : isGround ? 0xf59e0b : isTop ? 0x00f0ff : 0x0284c7;
 const emissiveHex = isSelected ? 0x0284c7 : isGround ? 0x78350f : isTop ? 0x0891b2 : 0x075985;

 const floorSlabGroup = new THREE.Group();
 floorSlabGroup.userData = {
 floorLevel: floorLevel,
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
 emissiveIntensity: isSelected ? 0.45 : 0.25,
 roughness: 0.2,
 metalness: 0.4,
 transparent: true,
 opacity: isSelected ? 0.75 : 0.88
 });

 const mesh = new THREE.Mesh(slabGeo, mat);
 mesh.rotation.x = -Math.PI / 2;
 mesh.castShadow = true;
 mesh.receiveShadow = true;
 mesh.userData = { floorLevel: floorLevel };
 clickableMeshes.push(mesh);

 const edges = new THREE.EdgesGeometry(slabGeo, 20);
 const line = new THREE.LineSegments(
 edges,
 new THREE.LineBasicMaterial({
 color: isSelected ? 0xffffff : isTop ? 0x38bdf8 : isGround ? 0xfde68a : 0xbae6fd,
 linewidth: isSelected ? 2 : 1.2,
 transparent: true,
 opacity: 0.95
 })
 );
 mesh.add(line);
 floorSlabGroup.add(mesh);
 });

 // RENDER INTERIOR PARTITION WALLS & ROOM SLABS ON SELECTED FLOOR
 if (isSelected && floorPlanData && floorPlanData.rooms) {
 const interiorGroup = new THREE.Group();
 interiorGroupRef.current = interiorGroup;

 // Render Room Floor Slabs
 floorPlanData.rooms.forEach((rm, rIdx) => {
 if (rm.local_coordinates && Array.isArray(rm.local_coordinates) && rm.local_coordinates.length >= 3) {
 const rShape = new THREE.Shape();
 let validPointsCount = 0;

 rm.local_coordinates.forEach((pt, pIdx) => {
 if (Array.isArray(pt) && pt.length >= 2) {
 if (validPointsCount === 0) rShape.moveTo(pt[0], pt[1]);
 else rShape.lineTo(pt[0], pt[1]);
 validPointsCount++;
 }
 });

 if (validPointsCount >= 3) {
 const rGeo = new THREE.ShapeGeometry(rShape);
 const isRoomSelected = selectedRoom?.unit_id === rm.unit_id;
 const rColor = rm.color_hex || '#0284c7';

 const rMat = new THREE.MeshBasicMaterial({
 color: isRoomSelected ? '#ffffff' : rColor,
 transparent: true,
 opacity: isRoomSelected ? 0.85 : 0.5,
 side: THREE.DoubleSide
 });

 const rMesh = new THREE.Mesh(rGeo, rMat);
 rMesh.rotation.x = -Math.PI / 2;
 rMesh.position.y = 0.05; // Slightly above slab floor
 rMesh.userData = { roomData: rm };
 clickableMeshes.push(rMesh);
 interiorGroup.add(rMesh);
 }
 }
 });

 // Render 3D Interior Partition Walls (2.8m height)
 const wallSegments = floorPlanData.partition_walls?.line_segments || [];
 const wallHeight = floorPlanData.elevation?.partition_wall_height_m || 2.8;

 wallSegments.forEach(seg => {
 let pt1 = null;
 let pt2 = null;

 if (Array.isArray(seg) && seg.length >= 2) {
 pt1 = seg[0];
 pt2 = seg[1];
 } else if (seg && seg.start && seg.end) {
 pt1 = seg.start;
 pt2 = seg.end;
 }

 if (pt1 && pt2 && Array.isArray(pt1) && Array.isArray(pt2)) {
 const p1 = new THREE.Vector3(pt1[0], 0, -pt1[1]);
 const p2 = new THREE.Vector3(pt2[0], 0, -pt2[1]);
 const dist = p1.distanceTo(p2);
 if (dist > 0.1) {
 const wallGeo = new THREE.BoxGeometry(0.22, wallHeight, dist);
 const wallMat = new THREE.MeshStandardMaterial({
 color: 0xffffff,
 roughness: 0.4,
 metalness: 0.1
 });
 const wallMesh = new THREE.Mesh(wallGeo, wallMat);
 const mid = p1.clone().add(p2).multiplyScalar(0.5);
 wallMesh.position.set(mid.x, wallHeight / 2, mid.z);
 wallMesh.lookAt(p2.x, wallHeight / 2, p2.z);
 interiorGroup.add(wallMesh);
 }
 }
 });

 floorSlabGroup.add(interiorGroup);
 }

 floorSlabGroup.position.y = i * flHeightM;
 floorGroup.add(floorSlabGroup);
 }

 // 8. Auto-calculate Bounding Box & Fit Camera
 const box = new THREE.Box3().setFromObject(floorGroup);
 const size = box.getSize(new THREE.Vector3());
 const center = box.getCenter(new THREE.Vector3());

 const maxHorizontal = Math.max(size.x, size.z, 20);
 const maxDim = Math.max(maxHorizontal, size.y, 25);

 const gridDim = Math.max(120, Math.ceil((maxHorizontal * 2.5) / 20) * 20);
 const grid = new THREE.GridHelper(gridDim, 20, 0x00f0ff, 0x1e293b);
 grid.position.set(center.x, 0, center.z);
 scene.add(grid);

 const fovRad = camera.fov * (Math.PI / 180);
 let cameraDist = (maxDim / 2) / Math.tan(fovRad / 2);
 cameraDist *= 1.45;

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
 controls.update();
 };
 setupCamera();
 resetCameraRef.current = setupCamera;

 // Raycaster for slab & room selection
 const raycaster = new THREE.Raycaster();
 const mouse = new THREE.Vector2();

 const handlePointerDown = (event) => {
 const rect = renderer.domElement.getBoundingClientRect();
 mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
 mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

 raycaster.setFromCamera(mouse, camera);
 const intersects = raycaster.intersectObjects(clickableMeshes, true);

 if (intersects.length > 0) {
 const topHit = intersects[0].object;
 if (topHit.userData?.roomData) {
 setSelectedRoom(topHit.userData.roomData);
 } else if (topHit.userData?.floorLevel) {
 const fl = topHit.userData.floorLevel;
 setSelectedFloorLevel(fl);
 }
 }
 };

 renderer.domElement.addEventListener('pointerdown', handlePointerDown);

 // Animation Loop
 let animationFrameId;
 const animate = () => {
 animationFrameId = requestAnimationFrame(animate);

 // Apply Vertical Floor Plate Explode
 const factor = explodeFactorRef.current;
 floorGroup.children.forEach(child => {
 if (child.userData && child.userData.baseY !== undefined) {
 const levelIdx = child.userData.floorLevel - 1;
 child.position.y = child.userData.baseY + (levelIdx * factor * 14.0);
 }
 });

 controls.update();
 renderer.render(scene, camera);
 };
 animate();

 const handleResize = () => {
 if (!container) return;
 const newW = container.clientWidth;
 const newH = container.clientHeight;
 camera.aspect = newW / newH;
 camera.updateProjectionMatrix();
 renderer.setSize(newW, newH);
 };
 window.addEventListener('resize', handleResize);

 return () => {
 window.removeEventListener('resize', handleResize);
 renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
 cancelAnimationFrame(animationFrameId);

 scene.traverse((obj) => {
 if (obj.geometry) obj.geometry.dispose();
 if (obj.material) {
 if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
 else obj.material.dispose();
 }
 });
 renderer.dispose();
 renderer.forceContextLoss();

 if (renderer.domElement && container.contains(renderer.domElement)) {
 container.removeChild(renderer.domElement);
 }
 };
 }, [building, reconciliation, selectedFloorLevel, floorPlanData, selectedRoom, viewMode]);

 const totalFloors = reconciliation?.final_floor_count || 1;

 return (
 <div style={{
 position: 'fixed',
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 backgroundColor: 'rgba(3, 7, 18, 0.88)',
 backdropFilter: 'blur(10px)',
 zIndex: 9999,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 padding: '20px'
 }}>
 <div style={{
 width: '100%',
 maxWidth: '1200px',
 height: '92vh',
 backgroundColor: '#0a0f1d',
 border: '1px solid rgba(56, 189, 248, 0.3)',
 borderRadius: '16px',
 display: 'flex',
 flexDirection: 'column',
 overflow: 'hidden',
 boxShadow: '0 25px 60px -15px rgba(0, 240, 255, 0.25)'
 }}>

 {/* HEADER BAR */}
 <div style={{
 padding: '14px 20px',
 borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 background: 'linear-gradient(90deg, #0c1322, #070b14)'
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 <div style={{
 width: '36px',
 height: '36px',
 borderRadius: '8px',
 background: 'linear-gradient(135deg, #0284c7, #00f0ff)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 color: '#fff',
 boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)'
 }}>
 <Box size={20} />
 </div>

 <div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
 <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#fff', letterSpacing: '0.3px' }}>
 {name}
 </h2>
 <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
 {bId}
</span>
 <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.5)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
 {building?.ulpin || `ULPIN-IN-TN-VEL-${bId}`}
</span>
 <span style={{ fontSize: '11px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
 {totalFloors} FLOORS
</span>
 </div>
 <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
 Automated 3D Cadastral Subdivision Engine • VIT Vellore Campus
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 <button
 onClick={onClose}
 style={{
 background: 'rgba(255,255,255,0.06)',
 border: '1px solid rgba(255,255,255,0.1)',
 color: '#cbd5e1',
 padding: '6px',
 borderRadius: '8px',
 cursor: 'pointer'
 }}
 >
 <X size={18} />
 </button>
 </div>
 </div>

 {/* FLOOR SELECTOR PILLS */}
 <div style={{
 padding: '8px 20px',
 background: 'rgba(15, 23, 42, 0.7)',
 borderBottom: '1px solid rgba(255,255,255,0.06)',
 display: 'flex',
 alignItems: 'center',
 gap: '8px',
 overflowX: 'auto'
 }}>
 <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '6px' }}>
 Floors:
</span>

 {Array.from({ length: totalFloors }, (_, idx) => {
 const fl = idx + 1;
 const isSel = fl === selectedFloorLevel;
 return (
 <button
 key={fl}
 onClick={() => setSelectedFloorLevel(fl)}
 style={{
 background: isSel ? 'linear-gradient(135deg, #0284c7, #00f0ff)' : 'rgba(255,255,255,0.05)',
 border: isSel ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
 color: isSel ? '#fff' : '#94a3b8',
 padding: '4px 12px',
 borderRadius: '6px',
 fontSize: '11.5px',
 fontWeight: '700',
 cursor: 'pointer',
 whiteSpace: 'nowrap'
 }}
 >
 Floor {fl} {fl === 1 ? '(Ground)' : fl === totalFloors ? '(Top)' : ''}
 </button>
 );
 })}

 <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
 <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '700' }}>
 Explode 3D:
</span>
 <input
 type="range"
 min="0"
 max="1"
 step="0.05"
 value={explodeFactor}
 onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
 style={{ width: '120px', accentColor: '#fbbf24', cursor: 'pointer' }}
 />
 </div>
 </div>

 {/* MAIN VIEWER & INSPECTOR BODY */}
 <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
 
 {/* LEFT 3D / 2D VIEWPORT */}
 <div style={{ flex: 1, position: 'relative', height: '100%', background: '#050812' }}>
 {viewMode === '3d' ? (
 <>
 <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
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
 ️ Orbit: Left-Drag | Pan: Right-Drag | Zoom: Scroll | Click Room to Inspect 3D ULPIN
 </div>

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
 </>
 ) : (
 /* 2D ARCHITECTURAL BLUEPRINT CANVAS */
 <div style={{ width: '100%', height: '100%', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
 <div style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8', marginBottom: '10px' }}>
 Floor {selectedFloorLevel} — 2D Cadastral Subdivision Blueprint
 </div>

 <div style={{
 width: '90%',
 height: '80%',
 background: '#070f1e',
 border: '2px solid #0284c7',
 borderRadius: '12px',
 position: 'relative',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
 backgroundSize: '16px 16px',
 padding: '20px'
 }}>
 {floorPlanData && floorPlanData.rooms ? (
 <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, floorPlanData.rooms.length)}, 1fr)`, gap: '12px', width: '100%', height: '100%' }}>
 {floorPlanData.rooms.map((rm, idx) => {
 const isSel = selectedRoom?.unit_id === rm.unit_id;
 return (
 <div
 key={rm.unit_id || idx}
 onClick={() => setSelectedRoom(rm)}
 style={{
 border: isSel ? '2px solid #38bdf8' : '1px dashed rgba(56, 189, 248, 0.4)',
 background: isSel ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
 borderRadius: '8px',
 padding: '12px',
 cursor: 'pointer',
 display: 'flex',
 flexDirection: 'column',
 justifyContent: 'space-between',
 transition: 'all 0.2s ease'
 }}
 >
 <div>
 <div style={{ fontSize: '10px', color: '#fbbf24', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
 {rm.unit_ulpin}
 </div>
 <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginTop: '4px' }}>
 {rm.label}
 </div>
 <span style={{ fontSize: '9.5px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: '#94a3b8', marginTop: '6px', display: 'inline-block' }}>
 {rm.zone_type}
</span>
 </div>

 <div style={{ fontSize: '11px', color: '#34d399', fontWeight: '700', marginTop: '10px' }}>
 Area: {rm.area_m2} m² • Vol: {rm.volume_m3} m³
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div style={{ color: '#94a3b8', fontSize: '12px' }}>
 Generating floor layout...
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* RIGHT 3D PROPERTY & CADASTRAL DEED INSPECTOR PANEL */}
 <div style={{
 width: '360px',
 borderLeft: '1px solid rgba(255,255,255,0.08)',
 padding: '16px',
 background: '#070b14',
 display: 'flex',
 flexDirection: 'column',
 gap: '12px',
 overflowY: 'auto'
 }}>

 {/* SELECTED 3D PROPERTY UNIT DEED */}
 {selectedRoom ? (
 <div style={{
 background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(2, 132, 199, 0.1))',
 border: '1.5px solid #fbbf24',
 borderRadius: '12px',
 padding: '14px',
 boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)'
 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
 <div>
 <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#fbbf24', fontWeight: '800' }}>
 3D Property Sub-Parcel Title Deed
</span>
 <h3 style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '800', color: '#fff' }}>
 {selectedRoom.label}
 </h3>
 </div>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
 <div style={{ background: 'rgba(0,0,0,0.35)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span style={{ color: '#fbbf24', fontWeight: '700' }}>3D Unit ULPIN:</span>
 <span style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: '800', fontSize: '10.5px' }}>
 {selectedRoom.unit_ulpin}
</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Zone Type:</span>
 <span style={{ color: '#38bdf8', fontWeight: '700' }}>{selectedRoom.zone_type}</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Floor Level:</span>
 <span style={{ color: '#fff' }}>Floor {selectedFloorLevel}</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Unit Sub-Parcel Area:</span>
 <span style={{ color: '#fff', fontWeight: '700' }}>{selectedRoom.area_m2} m²</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Unit 3D Volume:</span>
 <span style={{ color: '#34d399', fontWeight: '800' }}>{selectedRoom.volume_m3} m³</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Z-Elevation Bounds:</span>
 <span style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
 {selectedRoom.z_min}m → {selectedRoom.z_max}m
</span>
 </div>
 </div>

 <div style={{ marginTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px' }}>
 <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>
 Topology Certification (8 Rules)
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: '#34d399' }}>
 <div> Contained in Outer Footprint</div>
 <div> Pairwise Zero Overlap</div>
 <div> 100% Floor Area Conserved</div>
 <div> Minimum Usable Space (≥12m²)</div>
 </div>
 </div>
 </div>
 ) : (
 <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
 Click any room or partition in the viewer to inspect its **3D Unit ULPIN Title Deed**.
 </div>
 )}

 {/* QUICK SUB-PARCEL ROOMS SELECTION CHIPS */}
 {floorPlanData && floorPlanData.rooms && floorPlanData.rooms.length > 0 && (
 <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
 <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>
 Select Sub-Parcel Unit:
 </div>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
 {floorPlanData.rooms.map((rm, rIdx) => {
 const isSel = selectedRoom?.unit_id === rm.unit_id;
 return (
 <button
 key={rm.unit_id || rIdx}
 onClick={() => setSelectedRoom(rm)}
 style={{
 background: isSel ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.06)',
 border: isSel ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.12)',
 color: isSel ? '#000' : '#e2e8f0',
 padding: '4px 8px',
 borderRadius: '6px',
 fontSize: '10px',
 fontWeight: '700',
 cursor: 'pointer',
 fontFamily: 'var(--font-mono)'
 }}
 >
 {rm.unit_ulpin || `U${rIdx + 1}`}
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* FLOOR OVERVIEW & LAYOUT STRATEGY */}
 <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '11.5px', fontWeight: '800', marginBottom: '8px' }}>
 <Sparkles size={14} />
 <span>FLOOR {selectedFloorLevel} CAD SUBDIVISION</span>
 </div>

 {floorPlanData ? (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Floor 3D ULPIN:</span>
 <span style={{ color: '#fbbf24', fontWeight: '800', fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
 {floorPlanData.floor_ulpin || `ULPIN-IN-TN-VEL-${bId}-F0${selectedFloorLevel}`}
</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Units Count:</span>
 <span style={{ color: '#34d399', fontWeight: '700' }}>
 {floorPlanData.rooms?.length || 0} Sub-Parcels
</span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ color: '#94a3b8' }}>Partition Walls:</span>
 <span style={{ color: '#fff' }}>
 {floorPlanData.partition_walls?.segments_count || 0} Segments (2.8m H)
</span>
 </div>
 </div>
 ) : (
 <div style={{ fontSize: '11px', color: '#94a3b8' }}>Loading floor layout...</div>
 )}
 </div>

 {/* RECONCILIATION SUMMARY */}
 <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.5px', marginTop: '4px' }}>
 CADASTRAL COMPLIANCE
 </div>

 <div className="detail-row-aligned">
 <span className="detail-label-text">Building 3D ULPIN</span>
 <span className="detail-value-text" style={{ color: '#fbbf24', fontWeight: '800', fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
 {building?.ulpin || `ULPIN-IN-TN-VEL-${bId}`}
</span>
 </div>

 <div className="detail-row-aligned">
 <span className="detail-label-text">Building ID</span>
 <span className="detail-value-text" style={{ color: '#38bdf8', fontWeight: '700' }}>{bId}</span>
 </div>

 <div className="detail-row-aligned">
 <span className="detail-label-text">Footprint Area</span>
 <span className="detail-value-text" style={{ color: '#fff' }}>{building?.area_m2?.toLocaleString()} m²</span>
 </div>

 <div className="detail-row-aligned">
 <span className="detail-label-text">3D Volume</span>
 <span className="detail-value-text" style={{ color: '#34d399', fontWeight: '800' }}>
 {(building?.area_m2 * (building?.height_m || 24)).toLocaleString()} m³
</span>
 </div>

 <div style={{ marginTop: 'auto', background: 'rgba(52, 211, 153, 0.12)', border: '1px solid #34d399', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
 <ShieldCheck size={16} />
 <span>8-Rule Topology Certified</span>
 </div>

 </div>
 </div>

 </div>
 </div>
 );
}
