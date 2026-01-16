import requests
import json
import os

# CONFIGURATION
API_TOKEN = os.environ.get("CR_API_TOKEN") 
PLAYER_TAG = "#C92LJPYG" 
BASE_URL = "https://proxy.royaleapi.dev/v1" # Using Proxy

def fetch_all_data():
    if not API_TOKEN:
        raise ValueError("API Token is missing! Check GitHub Secrets.")

    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Accept": "application/json"
    }
    
    # URL Safe Tag
    formatted_tag = PLAYER_TAG.replace("#", "%23")

    # --- TASK 1: Fetch Player Profile (New!) ---
    print(f"Fetching Profile for {PLAYER_TAG}...")
    try:
        url_profile = f"{BASE_URL}/players/{formatted_tag}"
        resp_profile = requests.get(url_profile, headers=headers)
        
        if resp_profile.status_code == 200:
            # Save as a separate file 'player.json'
            with open("player.json", "w", encoding="utf-8") as f:
                json.dump(resp_profile.json(), f, indent=4)
            print("✅ success: player.json updated")
        else:
            print(f"❌ profile failed: {resp_profile.status_code}")
    except Exception as e:
        print(f"❌ profile error: {e}")

    # --- TASK 2: Fetch Battle Log (Existing) ---
    print(f"Fetching Battle Log...")
    master_data = []
    
    # Load existing master file if it exists
    if os.path.exists("battlelog_master.json"):
        try:
            with open("battlelog_master.json", "r", encoding="utf-8") as f:
                master_data = json.load(f)
        except: pass

    # Fast lookup for existing games
    existing_times = {b.get("battleTime") for b in master_data}
    
    url_log = f"{BASE_URL}/players/{formatted_tag}/battlelog"
    resp_log = requests.get(url_log, headers=headers)
    
    if resp_log.status_code == 200:
        new_battles = resp_log.json()
        added_count = 0
        
        # Append only new unique games
        for battle in new_battles:
            if battle.get("battleTime") not in existing_times:
                master_data.append(battle)
                existing_times.add(battle.get("battleTime"))
                added_count += 1
        
        # Sort newest first
        master_data.sort(key=lambda x: x.get("battleTime", ""), reverse=True)
        
        # Save Master Log
        with open("battlelog_master.json", "w", encoding="utf-8") as f:
            json.dump(master_data, f, indent=4)
        print(f"✅ success: battlelog_master.json updated (+{added_count} games)")
    else:
        print(f"❌ log failed: {resp_log.status_code}")

if __name__ == "__main__":
    fetch_all_data()