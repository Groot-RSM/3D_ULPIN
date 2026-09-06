import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Distinct curated color palette for property units & layers
const UNIT_COLORS = {
  'U101': { color: '#10b981', name: 'Unit 101 (2BHK East)', emissive: '#059669' },
  'U102': { color: '#06b6d4', name: 'Unit 102 (3BHK North)', emissive: '#0891b2' },
  'U103': { color: '#6366f1', name: 'Unit 103 (2BHK West)', emissive: '#4f46e5' },
  'U104': { color: '#f59e0b', name: 'Unit 104 (3BHK South)', emissive: '#d97706' },
  'U201': { color: '#10b981', name: 'Unit 201 (2BHK East)', emissive: '#059669' },
  'U202': { color: '#06b6d4', name: 'Unit 202 (3BHK North)', emissive: '#0891b2' },
  'U203': { color: '#6366f1', name: 'Unit 203 (2BHK West)', emissive: '#4f46e5' },
  'U204': { color: '#f59e0b', name: 'Unit 204 (3BHK South)', emissive: '#d97706' },
  'U301': { color: '#10b981', name: 'Unit 301 (2BHK East)', emissive: '#059669' },
  'U302': { color: '#06b6d4', name: 'Unit 302 (3BHK North)', emissive: '#0891b2' },
  'U303': { color: '#6366f1', name: 'Unit 303 (2BHK West)', emissive: '#4f46e5' },
  'U304': { color: '#f59e0b', name: 'Unit 304 (3BHK South)', emissive: '#d97706' },
  'U401': { color: '#10b981', name: 'Unit 401 (Penthouse A)', emissive: '#059669' },
  'U402': { color: '#06b6d4', name: 'Unit 402 (Penthouse B)', emissive: '#0891b2' },
  'U403': { color: '#6366f1', name: 'Unit 403 (Penthouse C)', emissive: '#4f46e5' },
  'U404': { color: '#f59e0b', name: 'Unit 404 (Penthouse D)', emissive: '#d97706' },
  'UG-B01': { color: '#475569', name: 'Basement Parking', emissive: '#334155' },
  'UG-C01': { color: '#ff7700', name: 'Telecom & Power Conduit', emissive: '#ea580c' },
  'UG-W01': { color: '#00d2ff', name: 'Sewer / Water Main', emissive: '#0284c7' },
  'AS-B01': { color: '#a855f7', name: 'Airspace Development Right', emissive: '#7e22ce' },
};

export default function CadastreViewer({
  selectedPropertyId,
  onSelectProperty,
  layers,
  zLevel,
  cameraPreset,
  conflictMode,
  activeConflictId,
  explodedView = 0,
  filterFloor = 'ALL',
  showLabels = true
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const meshesMapRef = useRef(new Map());
  const origPositionsRef = useRef(new Map());
  const zPlaneRef = useRef(null);
  const conflictGroupRef = useRef(null);
  const [hoveredEntity, setHoveredEntity] = useState(null);
  const [labelPositions, setLabelPositions] = useState([]);

  useEffect(() => {
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070b14');
    scene.fog = new THREE.FogExp2('#070b14', 0.007);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(42, 32, 46);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.38; // Allow viewing subsurface
    controls.target.set(0, 6, 0);
    controlsRef.current = controls;

    // 5. Rich Multi-Angle Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(40, 60, 40);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.0);
    dirLight2.position.set(-40, 30, -30);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xa855f7, 0.6);
    dirLight3.position.set(0, -30, 0); // Uplight for underground
    scene.add(dirLight3);

    // 6. Ground Datum Grid (Z = 15.0m AMSL)
    const gridHelper = new THREE.GridHelper(90, 45, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0; // Local Y=0 maps to Z=15.0m ground elevation
    scene.add(gridHelper);

    // Ground Surface Slab (Kolathur Plot P001 footprint)
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#0b1329',
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.05;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Parcel Boundary Outline (P001)
    const parcelBox = new THREE.BoxGeometry(24, 0.2, 30);
    const parcelEdges = new THREE.EdgesGeometry(parcelBox);
    const parcelLine = new THREE.LineSegments(parcelEdges, new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 }));
    parcelLine.position.y = 0;
    scene.add(parcelLine);

    // 7. Z-Level Indicator Plane
    const zPlaneGeo = new THREE.PlaneGeometry(36, 36);
    const zPlaneMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: 0x0284c7,
      emissiveIntensity: 0.2
    });
    const zPlane = new THREE.Mesh(zPlaneGeo, zPlaneMat);
    zPlane.rotation.x = Math.PI / 2;
    zPlane.position.y = 1.5;
    scene.add(zPlane);
    zPlaneRef.current = zPlane;

    // 8. Load 3D Models
    const loader = new GLTFLoader();
    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'CadastreScene';
    scene.add(buildingGroup);

    const CENTER_UTM_X = 414626.21;
    const CENTER_UTM_Y = 1450329.45;
    const BASE_ELEV_Z = 15.00;

    loader.load('/models/3d_ulpin_scene.glb', (gltf) => {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const geo = child.geometry.clone();
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) - CENTER_UTM_X;
            const y = pos.getY(i) - CENTER_UTM_Y;
            const z = pos.getZ(i) - BASE_ELEV_Z;
            pos.setXYZ(i, x, z, -y);
          }
          geo.computeVertexNormals();
          child.geometry = geo;

          const nodeName = child.name || child.parent?.name || '';
          child.userData.property_id = nodeName;

          // Determine layer & style
          let unitKey = '';
          Object.keys(UNIT_COLORS).forEach(k => {
            if (nodeName.includes(k)) unitKey = k;
          });

          const unitMeta = UNIT_COLORS[unitKey] || { color: '#64748b', emissive: '#334155' };
          let mat;

          if (nodeName.includes('AS-')) {
            // Airspace: Translucent glowing violet
            mat = new THREE.MeshStandardMaterial({
              color: '#c084fc',
              emissive: '#7e22ce',
              emissiveIntensity: 0.4,
              transparent: true,
              opacity: 0.3,
              roughness: 0.1,
              metalness: 0.5,
              depthWrite: false
            });
          } else if (nodeName.includes('UG-W01') || nodeName.includes('UG-C01')) {
            // Utility pipes: High-vibrancy metallic glow
            mat = new THREE.MeshStandardMaterial({
              color: unitMeta.color,
              emissive: unitMeta.emissive,
              emissiveIntensity: 0.9,
              roughness: 0.3,
              metalness: 0.8
            });
          } else if (nodeName.includes('UG-B01')) {
            // Basement parking: Tinted slate glass
            mat = new THREE.MeshStandardMaterial({
              color: '#334155',
              emissive: '#1e293b',
              emissiveIntensity: 0.2,
              transparent: true,
              opacity: 0.85,
              roughness: 0.4,
              metalness: 0.3
            });
          } else if (nodeName.includes('-U')) {
            // Apartment Unit: Rich glassmorphism with high saturation
            mat = new THREE.MeshStandardMaterial({
              color: unitMeta.color,
              emissive: unitMeta.emissive,
              emissiveIntensity: 0.25,
              transparent: true,
              opacity: 0.88,
              roughness: 0.25,
              metalness: 0.15
            });
          } else {
            // Floor slab
            mat = new THREE.MeshStandardMaterial({
              color: '#38bdf8',
              transparent: true,
              opacity: 0.3,
              roughness: 0.5
            });
          }

          child.material = mat;

          // Add crisp glowing bevel line outlines
          const edges = new THREE.EdgesGeometry(geo, 22);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({
              color: nodeName.includes('UG-') ? 0xffffff : 0xffffff,
              transparent: true,
              opacity: 0.65
            })
          );
          child.add(line);

          // Save original Y offset for exploded view calculations
          meshesMapRef.current.set(nodeName, child);
          origPositionsRef.current.set(nodeName, child.position.clone());
        }
      });
      buildingGroup.add(gltf.scene);
    });

    // Conflict group
    const conflictGroup = new THREE.Group();
    conflictGroup.name = 'ConflictGroup';
    scene.add(conflictGroup);
    conflictGroupRef.current = conflictGroup;

    // 9. Raycasting for Selection & Hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e) => {
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingGroup.children, true);
      const meshHit = intersects.find(i => i.object.isMesh && i.object.userData.property_id && i.object.visible);
      if (meshHit) {
        setHoveredEntity(meshHit.object.userData.property_id);
      } else {
        setHoveredEntity(null);
      }
    };

    const handleClick = (e) => {
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingGroup.children, true);
      const meshHit = intersects.find(i => i.object.isMesh && i.object.userData.property_id && i.object.visible);
      if (meshHit) {
        onSelectProperty(meshHit.object.userData.property_id);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousemove', handlePointerMove);
    domElement.addEventListener('click', handleClick);

    // 10. Animation Loop & 3D Projector for Labels
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();

      // Conflict pulse effect
      if (conflictGroupRef.current && conflictGroupRef.current.children.length > 0) {
        const time = Date.now() * 0.005;
        const pulse = 0.6 + 0.4 * Math.sin(time);
        conflictGroupRef.current.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.opacity = pulse;
          }
        });
      }

      // Compute 2D Screen Coordinates for Floating 3D Labels
      if (mountRef.current && cameraRef.current) {
        const labels = [
          { id: 'F04', name: '4th Floor (Penthouse)', pos: new THREE.Vector3(0, 11 + explodedView * 9, 0), badge: 'Z: 24-27m' },
          { id: 'F03', name: '3rd Floor (4 Flats)', pos: new THREE.Vector3(0, 8 + explodedView * 6, 0), badge: 'Z: 21-24m' },
          { id: 'F02', name: '2nd Floor (4 Flats)', pos: new THREE.Vector3(0, 5 + explodedView * 3, 0), badge: 'Z: 18-21m' },
          { id: 'F01', name: '1st Floor (4 Flats)', pos: new THREE.Vector3(0, 2, 0), badge: 'Z: 15-18m' },
          { id: 'UG-B01', name: 'Basement Parking', pos: new THREE.Vector3(0, -1.5 - explodedView * 3, 0), badge: 'Z: 12-15m' },
          { id: 'UG-W01', name: 'Sewer / Water Main', pos: new THREE.Vector3(12, -4.0 - explodedView * 5, 0), badge: 'Z: 10.5-11.5m' },
          { id: 'AS-B01', name: 'Airspace Right', pos: new THREE.Vector3(0, 15 + explodedView * 12, 0), badge: 'Z: 27-32m' }
        ];

        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        const screenPos = labels.map(lbl => {
          const v = lbl.pos.clone();
          v.project(camera);
          return {
            ...lbl,
            x: (v.x * 0.5 + 0.5) * w,
            y: (-v.y * 0.5 + 0.5) * h,
            visible: v.z < 1.0
          };
        });
        setLabelPositions(screenPos);
      }

      renderer.render(scene, camera);
    };
    animate();

    // 11. Window Resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      domElement.removeEventListener('mousemove', handlePointerMove);
      domElement.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Exploded View Displacements
  useEffect(() => {
    meshesMapRef.current.forEach((mesh, propId) => {
      const orig = origPositionsRef.current.get(propId) || new THREE.Vector3();
      let dy = 0;

      if (propId.includes('-F04') || propId.includes('-U4')) dy = explodedView * 9.0;
      else if (propId.includes('-F03') || propId.includes('-U3')) dy = explodedView * 6.0;
      else if (propId.includes('-F02') || propId.includes('-U2')) dy = explodedView * 3.0;
      else if (propId.includes('-F01') || propId.includes('-U1')) dy = 0.0;
      else if (propId.includes('AS-')) dy = explodedView * 12.0;
      else if (propId.includes('UG-B01') || propId.includes('UG-C01')) dy = -explodedView * 3.0;
      else if (propId.includes('UG-W01')) dy = -explodedView * 5.0;

      mesh.position.set(orig.x, orig.y + dy, orig.z);
    });
  }, [explodedView]);

  // Update Layer & Floor Filter Visibilities
  useEffect(() => {
    meshesMapRef.current.forEach((mesh, propId) => {
      let visible = true;
      if (propId.includes('UG-') && !layers.underground) visible = false;
      if (propId.includes('AS-') && !layers.airspace) visible = false;
      if (propId.includes('-U') && !layers.units) visible = false;
      if (propId.includes('-F') && !propId.includes('-U') && !layers.floors) visible = false;

      // Floor isolation filter
      if (filterFloor !== 'ALL') {
        if (filterFloor === 'F01' && !propId.includes('-F01') && !propId.includes('-U1')) visible = false;
        if (filterFloor === 'F02' && !propId.includes('-F02') && !propId.includes('-U2')) visible = false;
        if (filterFloor === 'F03' && !propId.includes('-F03') && !propId.includes('-U3')) visible = false;
        if (filterFloor === 'F04' && !propId.includes('-F04') && !propId.includes('-U4')) visible = false;
        if (filterFloor === 'UG' && !propId.includes('UG-')) visible = false;
        if (filterFloor === 'AS' && !propId.includes('AS-')) visible = false;
      }

      mesh.visible = visible;
    });
  }, [layers, filterFloor]);

  // Update Z-Plane Position
  useEffect(() => {
    if (zPlaneRef.current) {
      zPlaneRef.current.position.y = zLevel - 15.0;
    }
  }, [zLevel]);

  // Highlight Selected Property with Glowing Emissive
  useEffect(() => {
    meshesMapRef.current.forEach((mesh, propId) => {
      if (!mesh.material) return;
      if (propId === selectedPropertyId) {
        mesh.material.emissive = new THREE.Color('#38bdf8');
        mesh.material.emissiveIntensity = 0.9;
        mesh.material.opacity = 1.0;
      } else {
        let unitKey = '';
        Object.keys(UNIT_COLORS).forEach(k => {
          if (propId.includes(k)) unitKey = k;
        });
        const unitMeta = UNIT_COLORS[unitKey] || { emissive: '#1e293b' };
        mesh.material.emissive = new THREE.Color(unitMeta.emissive);
        mesh.material.emissiveIntensity = propId.includes('UG-') ? 0.7 : 0.25;
        mesh.material.opacity = propId.includes('AS-') ? 0.3 : 0.88;
      }
    });
  }, [selectedPropertyId]);

  // Camera Presets
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (cameraPreset === 'top') {
      cam.position.set(0, 65, 0.1);
      ctrl.target.set(0, 6, 0);
    } else if (cameraPreset === 'front') {
      cam.position.set(0, 8, 48);
      ctrl.target.set(0, 8, 0);
    } else if (cameraPreset === 'underground') {
      cam.position.set(24, -16, 28);
      ctrl.target.set(0, -3, 0);
    } else if (cameraPreset === 'isometric') {
      cam.position.set(40, 35, 45);
      ctrl.target.set(0, 6, 0);
    } else if (cameraPreset === 'reset') {
      cam.position.set(42, 32, 46);
      ctrl.target.set(0, 6, 0);
    }
    ctrl.update();
  }, [cameraPreset]);

  // Conflict Scenario Loading
  useEffect(() => {
    if (!conflictGroupRef.current) return;
    const group = conflictGroupRef.current;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (conflictMode && activeConflictId) {
      const loader = new GLTFLoader();
      let modelFile = '';
      if (activeConflictId === 'C01') modelFile = '/models/scenarios/apartment_overlap.glb';
      if (activeConflictId === 'C02') modelFile = '/models/scenarios/utility_intrusion.glb';
      if (activeConflictId === 'C03') modelFile = '/models/scenarios/airspace_intrusion.glb';

      const CENTER_UTM_X = 414626.21;
      const CENTER_UTM_Y = 1450329.45;
      const BASE_ELEV_Z = 15.00;

      if (modelFile) {
        loader.load(modelFile, (gltf) => {
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              const geo = child.geometry.clone();
              const pos = geo.attributes.position;
              for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i) - CENTER_UTM_X;
                const y = pos.getY(i) - CENTER_UTM_Y;
                const z = pos.getZ(i) - BASE_ELEV_Z;
                pos.setXYZ(i, x, z, -y);
              }
              geo.computeVertexNormals();
              child.geometry = geo;
              child.material = new THREE.MeshStandardMaterial({
                color: '#ef4444',
                emissive: '#dc2626',
                emissiveIntensity: 0.9,
                transparent: true,
                opacity: 0.85
              });
            }
          });
          group.add(gltf.scene);
        });
      }
    }
  }, [conflictMode, activeConflictId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating 3D Cadastral Level Badges */}
      {showLabels && labelPositions.map((lbl) => {
        if (!lbl.visible) return null;
        return (
          <div
            key={lbl.id}
            onClick={() => {
              if (lbl.id === 'F01') onSelectProperty('P001-B01-F01-U101');
              else if (lbl.id === 'F02') onSelectProperty('P001-B01-F02-U201');
              else if (lbl.id === 'F03') onSelectProperty('P001-B01-F03-U301');
              else if (lbl.id === 'F04') onSelectProperty('P001-B01-F04-U401');
              else onSelectProperty(lbl.id);
            }}
            style={{
              position: 'absolute',
              left: `${lbl.x}px`,
              top: `${lbl.y}px`,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              padding: '3px 8px',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'auto',
              backdropFilter: 'blur(4px)',
              transition: 'transform 0.1s ease',
              whiteSpace: 'nowrap',
              zIndex: 5
            }}
            title="Click to inspect this level"
          >
            <span style={{ color: '#38bdf8' }}>{lbl.name}</span>
            <span style={{ fontSize: '9.5px', background: 'rgba(56,189,248,0.2)', color: '#7dd3fc', padding: '1px 5px', borderRadius: '4px' }}>
              {lbl.badge}
            </span>
          </div>
        );
      })}

      {/* Floating 3D Tooltip */}
      {hoveredEntity && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #38bdf8',
          boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
          padding: '8px 18px',
          borderRadius: '9999px',
          color: '#fff',
          fontSize: '12.5px',
          fontWeight: 600,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10,
          backdropFilter: 'blur(8px)'
        }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
          <span>{hoveredEntity}</span>
          <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 400 }}>• Click to Inspect Cadastral Deed</span>
        </div>
      )}
    </div>
  );
}

