import os
import json
import time
import urllib.request
from typing import Dict, Any
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def run_phase2_verification():
    print("=" * 60)
    print("3D ULPIN | PHASE 2 END-TO-END SUPABASE VERIFICATION")
    print("=" * 60)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        return

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Pre-check: Ensure building_evidence table exists
    try:
        test_check = client.table("building_evidence").select("*").limit(1).execute()
    except Exception as e:
        print(f"\n[ERROR] 'building_evidence' table not found in Supabase: {e}")
        print(">> Please run database/schema_evidence.sql in your Supabase SQL Editor first.\n")
        return

    # -------------------------------------------------------------
    # TEST 1 — Technology Tower
    # -------------------------------------------------------------
    print("\n--- TEST 1 — Technology Tower ---")
    req1 = urllib.request.Request(
        "http://127.0.0.1:8000/api/vit/ai-insight",
        data=json.dumps({"building_id": "VIT-B001"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req1) as resp:
        t1_res = json.loads(resp.read().decode("utf-8"))

    # Verify FastAPI returned real dynamic evidence
    assert t1_res.get("building_id") == "VIT-B001", "Invalid building_id"
    assert t1_res.get("match_status") in ["MATCH", "UNCERTAIN", "NO MATCH"], "Invalid match_status"
    assert len(t1_res.get("sources", [])) > 0, "Expected real sources returned from SerpApi"

    # Verify directly in Supabase
    db_rows1 = client.table("building_evidence").select("*").eq("building_id", "VIT-B001").order("searched_at", desc=True).execute()
    assert db_rows1.data and len(db_rows1.data) > 0, "No row found in Supabase for VIT-B001!"
    row1 = db_rows1.data[0]
    
    # Strict validation of stored Supabase columns
    assert row1["building_id"] == "VIT-B001"
    assert row1["match_status"] in ["MATCH", "UNCERTAIN", "NO MATCH"]
    assert row1["sources_count"] > 0
    assert isinstance(row1["sources"], list) and len(row1["sources"]) > 0
    assert row1["primary_title"] is not None and len(row1["primary_title"]) > 0
    assert row1["searched_at"] is not None

    print(f"Stored Record ID: {row1['id']}")
    print(f"Building: {row1['building_name']} ({row1['building_id']})")
    print(f"Match Status: {row1['status_symbol']} {row1['match_status']}")
    print(f"Primary Title: {row1['primary_title']}")
    print(f"Primary URL: {row1['primary_url']}")
    print(f"Sources Stored: {row1['sources_count']}")
    print(f"Images Stored: {len(row1['images'])}")
    print("PASS\nReal SerpApi evidence stored in Supabase")

    # -------------------------------------------------------------
    # TEST 2 — Cache (Zero-Unnecessary-Calls)
    # -------------------------------------------------------------
    print("\n--- TEST 2 — Cache ---")
    req_cached = urllib.request.Request("http://127.0.0.1:8000/api/vit/buildings/VIT-B001/evidence")
    with urllib.request.urlopen(req_cached) as resp:
        t2_res = json.loads(resp.read().decode("utf-8"))
        
    assert t2_res.get("cached") is True, "Expected cached: True from Supabase!"
    assert t2_res.get("evidence", {}).get("building_id") == "VIT-B001"
    assert t2_res["evidence"]["id"] == row1["id"]
    print(f"Cached Record ID: {t2_res['evidence']['id']}")
    print(f"Primary Title: {t2_res['evidence']['primary_title']}")
    print("PASS\nExisting evidence retrieved without a new SerpApi call")

    # -------------------------------------------------------------
    # TEST 3 — History (Multiple searches preserved)
    # -------------------------------------------------------------
    print("\n--- TEST 3 — History ---")
    time.sleep(1) # Ensure distinct timestamp
    req_research = urllib.request.Request(
        "http://127.0.0.1:8000/api/vit/ai-insight",
        data=json.dumps({"building_id": "VIT-B001"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_research) as resp:
        t3_res = json.loads(resp.read().decode("utf-8"))

    db_rows_history = client.table("building_evidence").select("*").eq("building_id", "VIT-B001").order("searched_at", desc=True).execute()
    assert len(db_rows_history.data) >= 2, "Expected at least 2 historical search records in Supabase!"
    row_new = db_rows_history.data[0]
    row_prev = db_rows_history.data[1]
    assert row_new["id"] != row_prev["id"], "Expected new database row ID on re-search"
    print(f"Search #1 (Earlier) ID: {row_prev['id']} at {row_prev['searched_at']}")
    print(f"Search #2 (Later)   ID: {row_new['id']} at {row_new['searched_at']}")
    print("PASS\nMultiple searches preserved")

    # -------------------------------------------------------------
    # TEST 4 — Building Independence (VIT-B002 Silver Jubilee Tower)
    # -------------------------------------------------------------
    print("\n--- TEST 4 — Building Independence ---")
    req_b2 = urllib.request.Request(
        "http://127.0.0.1:8000/api/vit/ai-insight",
        data=json.dumps({"building_id": "VIT-B002"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_b2) as resp:
        t4_res = json.loads(resp.read().decode("utf-8"))

    db_rows_b2 = client.table("building_evidence").select("*").eq("building_id", "VIT-B002").execute()
    assert db_rows_b2.data and len(db_rows_b2.data) > 0, "No row found in Supabase for VIT-B002!"
    row_b2 = db_rows_b2.data[0]
    assert row_b2["building_id"] == "VIT-B002", "Expected VIT-B002 building_id"
    assert "Silver Jubilee" in (row_b2["building_name"] or "") or "SJT" in (row_b2["building_name"] or "")
    print(f"Stored Record ID: {row_b2['id']}")
    print(f"Building: {row_b2['building_name']} ({row_b2['building_id']})")
    print(f"Primary Title: {row_b2['primary_title']}")
    print("PASS\nVIT-B002 evidence stored independently")

    print("\n" + "=" * 40)
    print("PHASE 2 VERIFICATION: PASS")
    print("=" * 40)

if __name__ == "__main__":
    run_phase2_verification()

