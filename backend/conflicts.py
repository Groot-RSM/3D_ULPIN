import json
from pathlib import Path
from typing import Dict, Any, List, Optional

CONFLICT_REPORT_PATH = Path("data/b01/validation/conflict_report.json")

class ConflictService:
    def __init__(self):
        self.conflict_data: Dict[str, Any] = {}
        self.scenarios_by_id: Dict[str, Any] = {}
        self.load_data()

    def load_data(self):
        if CONFLICT_REPORT_PATH.exists():
            with open(CONFLICT_REPORT_PATH, "r", encoding="utf-8") as f:
                self.conflict_data = json.load(f)
                for sc in self.conflict_data.get("scenarios", []):
                    self.scenarios_by_id[sc["scenario_id"]] = sc

    def get_all_scenarios(self) -> List[Dict[str, Any]]:
        return self.conflict_data.get("scenarios", [])

    def get_scenario_by_id(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        return self.scenarios_by_id.get(scenario_id.upper())

    def get_conflict_summary(self) -> Dict[str, Any]:
        return {
            "total_scenarios": self.conflict_data.get("scenarios_evaluated", 3),
            "detection_rate_pct": self.conflict_data.get("conflict_detection_rate_pct", 100.0),
            "scenarios": self.get_all_scenarios()
        }

conflict_service = ConflictService()
