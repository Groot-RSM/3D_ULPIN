export const OSM_BUILDING_NAME_MAP = {
  '1302836372': 'CBMR - Center for Biomedical Research',
  '775240857': 'Technology Tower (TT)',
  '775240861': 'Silver Jubilee Tower (SJT)',
  '775240862': 'Dr. M.G.R. Block',
  '775240863': 'Periyar EVR Central Library',
  '775240864': 'Main Building / Administrative Block',
  '775240865': 'Technology Tower Annex',
  'VIT-B001': 'Technology Tower (TT)',
  'VIT-B002': 'Silver Jubilee Tower (SJT)',
  'VIT-B003': 'Dr. M.G.R. Block',
  'VIT-B004': 'Periyar EVR Central Library',
  'VIT-B005': 'Main Building / Administrative Block',
  'VIT-B006': 'Technology Tower Annex',
  'VIT-B007': 'CBMR - Center for Biomedical Research',
  'VIT-B008': 'Research Park Complex',
};

export function getCleanBuildingName(building, index = 0) {
  if (!building) return `Building #${index + 1}`;

  const idStr = String(building.building_id || '').replace(/^Building\s*/i, '').trim();
  const nameStr = String(building.name || '').trim();

  // If explicit landmark mapped name exists
  if (OSM_BUILDING_NAME_MAP[idStr]) return OSM_BUILDING_NAME_MAP[idStr];
  if (OSM_BUILDING_NAME_MAP[building.building_id]) return OSM_BUILDING_NAME_MAP[building.building_id];

  // If name is clean (not raw OSM number like "Building 775240857")
  if (nameStr && !/^Building\s*\d+$/i.test(nameStr) && !/^\d+$/.test(nameStr)) {
    return nameStr;
  }

  // Fallbacks for known IDs or generic display
  if (idStr === '775240857' || idStr === 'VIT-B001') return 'Technology Tower (TT)';
  if (idStr === '775240861' || idStr === 'VIT-B002') return 'Silver Jubilee Tower (SJT)';
  if (idStr === '775240862' || idStr === 'VIT-B003') return 'Dr. M.G.R. Block';
  if (idStr === '775240863' || idStr === 'VIT-B004') return 'Periyar EVR Central Library';

  if (building.building_type === 'Global Spatial Landmark' || building.certainty === 'GLOBAL_GEOCODING') {
    return nameStr || building.location || 'Global Spatial Landmark';
  }

  return nameStr || `VIT Structure (${building.building_id || index + 1})`;
}
