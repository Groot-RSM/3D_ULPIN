import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def inspect_database():
    print("=" * 60)
    print("3D ULPIN | SUPABASE DATABASE STATUS INSPECTOR")
    print("=" * 60)
    print(f"Supabase Project URL: {SUPABASE_URL}\n")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        return

    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[CONNECTED] Successfully connected to Supabase API.\n")
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        return

    # Check each table
    tables_to_check = ["buildings", "parcels", "building_evidence"]

    for table in tables_to_check:
        try:
            res = client.table(table).select("*", count="exact").execute()
            count = res.count if res.count is not None else len(res.data)
            print(f"Table: public.{table:<18} -> [EXISTS]  Rows: {count}")
            if res.data and len(res.data) > 0:
                print(f"   Sample ID/Code: {res.data[0].get('building_id') or res.data[0].get('building_code') or res.data[0].get('id')}")
        except Exception as e:
            print(f"Table: public.{table:<18} -> [NOT FOUND / PENDING] (Error: {e.args[0].get('message', str(e)) if isinstance(e.args[0], dict) else str(e)})")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    inspect_database()
