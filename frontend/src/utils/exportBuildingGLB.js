import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Convert GeoJSON coordinates [lon, lat] to local metric Cartesian coordinates [x, y] in meters,
 * centered at the building centroid.
 */
function geoJsonToMetricPoints(coordsRing, centerLon, centerLat) {
  return coordsRing.map(pt => [
    (pt[0] - centerLon) * 108500.0,
    (pt[1] - centerLat) * 110800.0
  ]);
}

/**
 * Convert a GeoJSON Polygon (with optional holes) to a Three.js Shape.
 */
function createPolygonShape(coordinates, centerLon, centerLat) {
  const outerRing = coordinates[0];
  if (!outerRing || outerRing.length < 3) return null;

  const metricOuter = geoJsonToMetricPoints(outerRing, centerLon, centerLat);
  const shape = new THREE.Shape();

  metricOuter.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });

  // Handle interior courtyard/atrium holes if present
  if (coordinates.length > 1) {
    for (let r = 1; r < coordinates.length; r++) {
      const holeRing = coordinates[r];
      if (holeRing && holeRing.length >= 3) {
        const metricHole = geoJsonToMetricPoints(holeRing, centerLon, centerLat);
        const holePath = new THREE.Path();
        metricHole.forEach(([hx, hy], hIdx) => {
          if (hIdx === 0) holePath.moveTo(hx, hy);
          else holePath.lineTo(hx, hy);
        });
        shape.holes.push(holePath);
      }
    }
  }

  return shape;
}

/**
 * Build and export a full 3D Cadastral Building Model (.GLB) with all floor levels,
 * subdivided property units, partition walls, and volumetric deeds.
 */
export async function exportBuildingGLB(building) {
  if (!building) {
    throw new Error('No building selected for export.');
  }

  const buildingId = building.building_id || building.id || 'VIT-B001';
  const name = building.name || building.building_name || 'VIT Building';
  const heightM = Number(building.height_m) || 24.0;
  const totalFloors = Number(building.reconciliation?.final_floor_count || building.verified_floor_count || Math.max(1, Math.round(heightM / 4.0)));
  const flHeightM = heightM / totalFloors;

  // Extract center coordinates for projection
  const polygons = [];
  if (building.geometry) {
    if (building.geometry.type === 'Polygon') {
      polygons.push(building.geometry.coordinates);
    } else if (building.geometry.type === 'MultiPolygon') {
      building.geometry.coordinates.forEach(poly => polygons.push(poly));
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

  const centerLon = building.centroid_lon || (allLons.length ? (Math.min(...allLons) + Math.max(...allLons)) / 2 : 79.156);
  const centerLat = building.centroid_lat || (allLats.length ? (Math.min(...allLats) + Math.max(...allLats)) / 2 : 12.969);

  // Root Three.js Node
  const root = new THREE.Group();
  root.name = String(buildingId);
  root.userData = {
    building_id: buildingId,
    building_name: name,
    official_ulpin: building.ulpin || `ULPIN-IN-TN-VEL-${buildingId}`,
    centroid_lat: centerLat,
    centroid_lon: centerLon,
    area_m2: building.area_m2 || 1200,
    height_m: heightM,
    floors_count: totalFloors,
    source: '3D_ULPIN_Cadastral_Twin'
  };

  // Build floor shapes
  const shapes = [];
  polygons.forEach(poly => {
    const shape = createPolygonShape(poly, centerLon, centerLat);
    if (shape) shapes.push(shape);
  });

  if (shapes.length === 0) {
    throw new Error('Could not parse valid polygon footprint for export.');
  }

  // Fetch all floor plans asynchronously to include property units and partition walls
  const floorPlanPromises = [];
  for (let i = 1; i <= totalFloors; i++) {
    floorPlanPromises.push(
      fetch(`http://127.0.0.1:8000/api/vit/buildings/${buildingId}/floor-plan/${i}`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
    );
  }
  const floorPlans = await Promise.all(floorPlanPromises);

  // Standard Materials
  const slabMaterial = new THREE.MeshStandardMaterial({
    color: 0x14283f,
    roughness: 0.35,
    metalness: 0.25,
    name: 'Cadastral_Slab_Material'
  });

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.1,
    name: 'Partition_Wall_Material'
  });

  // Construct each floor in the 3D hierarchy
  for (let i = 0; i < totalFloors; i++) {
    const floorNumber = i + 1;
    const floorCode = `F${String(floorNumber).padStart(2, '0')}`;
    const baseHeight = i * flHeightM;
    const topHeight = baseHeight + flHeightM;

    const floorGroup = new THREE.Group();
    floorGroup.name = `${buildingId}-${floorCode}`;
    floorGroup.userData = {
      type: 'floor',
      building_id: buildingId,
      floor_number: floorNumber,
      floor_code: floorCode,
      base_height_m: baseHeight,
      top_height_m: topHeight
    };

    // 1. Extrude Floor Slab
    const slabExtrudeSettings = {
      steps: 1,
      depth: Math.max(0.4, flHeightM * 0.90),
      bevelEnabled: false
    };

    shapes.forEach(shape => {
      const slabGeo = new THREE.ExtrudeGeometry(shape, slabExtrudeSettings);
      const slabMesh = new THREE.Mesh(slabGeo, slabMaterial);
      slabMesh.rotation.x = -Math.PI / 2;
      slabMesh.position.y = baseHeight;
      slabMesh.name = `${buildingId}-${floorCode}-Slab`;
      slabMesh.userData = {
        type: 'floor_slab',
        building_id: buildingId,
        floor_code: floorCode,
        z_base: baseHeight,
        z_top: topHeight
      };
      floorGroup.add(slabMesh);
    });

    // 2. Extrude Property Sub-Parcel Units & Partition Walls (if plan exists)
    const planData = floorPlans[i];
    if (planData && Array.isArray(planData.rooms)) {
      planData.rooms.forEach(rm => {
        if (rm.local_coordinates && Array.isArray(rm.local_coordinates) && rm.local_coordinates.length >= 3) {
          const roomShape = new THREE.Shape();
          rm.local_coordinates.forEach((pt, pIdx) => {
            if (pIdx === 0) roomShape.moveTo(pt[0], pt[1]);
            else roomShape.lineTo(pt[0], pt[1]);
          });

          const unitHeight = Math.max(0.2, (rm.z_max - rm.z_min) || (flHeightM * 0.85));
          const roomGeo = new THREE.ExtrudeGeometry(roomShape, {
            steps: 1,
            depth: unitHeight,
            bevelEnabled: false
          });

          const unitHex = rm.color_hex ? parseInt(rm.color_hex.replace('#', '0x')) : 0x0284c7;
          const roomMat = new THREE.MeshStandardMaterial({
            color: unitHex,
            roughness: 0.3,
            metalness: 0.15,
            name: `Unit_Mat_${rm.unit_id}`
          });

          const roomMesh = new THREE.Mesh(roomGeo, roomMat);
          roomMesh.rotation.x = -Math.PI / 2;
          roomMesh.position.y = baseHeight + 0.05;
          const unitNodeName = String(rm.unit_ulpin || `${buildingId}-${floorCode}-${rm.unit_id || 'U01'}`);
          roomMesh.name = unitNodeName;
          roomMesh.userData = {
            type: 'property_unit',
            building_id: buildingId,
            floor_code: floorCode,
            unit_id: String(rm.unit_id),
            unit_ulpin: String(rm.unit_ulpin),
            label: rm.label,
            zone_type: rm.zone_type,
            area_m2: rm.area_m2,
            volume_m3: rm.volume_m3,
            z_min: baseHeight,
            z_max: baseHeight + unitHeight,
            authoritative: true,
            source: '3D_ULPIN_Cadastral_Registry'
          };
          floorGroup.add(roomMesh);
        }
      });
    }

    // 3. Extrude 3D Partition Walls
    if (planData && planData.partition_walls && Array.isArray(planData.partition_walls.line_segments)) {
      const wallHeight = planData.elevation?.partition_wall_height_m || 2.8;
      planData.partition_walls.line_segments.forEach((seg, wIdx) => {
        let pt1 = null, pt2 = null;
        if (Array.isArray(seg) && seg.length >= 2) {
          pt1 = seg[0];
          pt2 = seg[1];
        }
        if (pt1 && pt2 && Array.isArray(pt1) && Array.isArray(pt2)) {
          const p1 = new THREE.Vector3(pt1[0], 0, -pt1[1]);
          const p2 = new THREE.Vector3(pt2[0], 0, -pt2[1]);
          const dist = p1.distanceTo(p2);
          if (dist > 0.1) {
            const wallGeo = new THREE.BoxGeometry(0.22, wallHeight, dist);
            const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
            const mid = p1.clone().add(p2).multiplyScalar(0.5);
            wallMesh.position.set(mid.x, baseHeight + wallHeight / 2, mid.z);
            wallMesh.lookAt(p2.x, baseHeight + wallHeight / 2, p2.z);
            wallMesh.name = `${buildingId}-${floorCode}-Wall_${wIdx + 1}`;
            wallMesh.userData = {
              type: 'partition_wall',
              building_id: buildingId,
              floor_code: floorCode,
              wall_index: wIdx + 1
            };
            floorGroup.add(wallMesh);
          }
        }
      });
    }

    root.add(floorGroup);
  }

  // Assemble Three.js Export Scene
  const scene = new THREE.Scene();
  scene.add(root);

  // GLTFExporter export as binary .glb
  const exporter = new GLTFExporter();
  const glb = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result),
      (error) => reject(error),
      { binary: true, includeCustomExtensions: false }
    );
  });

  if (!(glb instanceof ArrayBuffer)) {
    throw new Error('GLB export did not return a valid binary ArrayBuffer.');
  }

  // Trigger browser download
  const blob = new Blob([glb], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const safeBuildingId = String(buildingId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeBuildingId}_3D_Cadastre.glb`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return {
    buildingId,
    filename,
    totalFloors,
    sizeBytes: glb.byteLength
  };
}
