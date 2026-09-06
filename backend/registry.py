import json
from pathlib import Path
from typing import Dict, Any, List, Optional

REGISTRY_PATH = Path("data/b01/ulpin/property_registry.json")
SUMMARY_PATH = Path("data/b01/ulpin/identity_summary.json")

class PropertyRegistry:
    def __init__(self):
        self.registry_data: Dict[str, Any] = {}
        self.summary_data: Dict[str, Any] = {}
        self.entities_by_id: Dict[str, Any] = {}
        self.load_data()

    def load_data(self):
        if REGISTRY_PATH.exists():
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                self.registry_data = json.load(f)
                for ent in self.registry_data.get("entities", []):
                    self.entities_by_id[ent["property_id"]] = ent

        if SUMMARY_PATH.exists():
            with open(SUMMARY_PATH, "r", encoding="utf-8") as f:
                self.summary_data = json.load(f)

    def get_all_entities(self) -> List[Dict[str, Any]]:
        return self.registry_data.get("entities", [])

    def get_entity_by_id(self, property_id: str) -> Optional[Dict[str, Any]]:
        return self.entities_by_id.get(property_id)

    def get_summary(self) -> Dict[str, Any]:
        return self.summary_data

    def get_units(self) -> List[Dict[str, Any]]:
        return [e for e in self.get_all_entities() if e.get("entity_type") == "private_residential_unit"]

    def get_underground(self) -> List[Dict[str, Any]]:
        return [e for e in self.get_all_entities() if "UG-" in e.get("property_id", "")]

    def get_airspace(self) -> List[Dict[str, Any]]:
        return [e for e in self.get_all_entities() if "AS-" in e.get("property_id", "")]

registry = PropertyRegistry()
