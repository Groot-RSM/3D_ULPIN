import os
from pathlib import Path

# Load from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v

# Centralized API Keys for 3D ULPIN Platform
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "") or os.getenv("VITE_SERPAPI_KEY", "") or os.getenv("SERP_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "") or os.getenv("VITE_GEMINI_API_KEY", "")
MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "") or os.getenv("VITE_MAPBOX_TOKEN", "")
MAPTILER_API_KEY = os.getenv("MAPTILER_API_KEY", "") or os.getenv("VITE_MAPTILER_KEY", "")

CAMPUS_CENTER_LAT = 12.9692
CAMPUS_CENTER_LON = 79.1560
CAMPUS_NAME = "Vellore Institute of Technology (VIT Vellore)"
CAMPUS_LOCATION = "Vellore, Tamil Nadu, India"

