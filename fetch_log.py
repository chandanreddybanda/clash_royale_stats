import requests
import json
import os

# 1. Configuration
API_TOKEN = os.environ.get("CR_API_TOKEN") 
PLAYER_TAG = "#C92LJPYG"
BASE_URL = "https://api.clashroyale.com/v1"
MASTER_FILE = "battlelog_master.json"

def fetch_and_update():
    if not API_TOKEN:
        raise ValueError("API Token is missing! Set CR_API_TOKEN environment variable.")

    # --- Step 1: Load Existing Master Data ---
    if os.path.exists(MASTER_FILE):
        try:
            with open(MASTER_FILE, "r", encoding="utf-8") as f:
                master_data = json.load(f)
                print(f"Loaded {len(master_data)} existing battles from {MASTER_FILE}.")
        except json.JSONDecodeError:
            print("Master file corrupted. Starting fresh.")
            master_data = []
    else:
        print("No master file found. Creating new one.")
        master_data = []

    # Create a set of existing battle times for fast duplicate checking
    # (A player cannot finish two battles at the exact same second)
    existing_times = {battle.get("battleTime") for battle in master_data}

    # --- Step 2: Fetch New Data from API ---
    formatted_tag = PLAYER_TAG.replace("#", "%23")
    url = f"{BASE_URL}/players/{formatted_tag}/battlelog"
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Accept": "application/json"
    }

    print(f"Fetching latest battle log for {PLAYER_TAG}...")
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"Failed to fetch data: {response.status_code} - {response.text}")
        exit(1)

    new_battles = response.json()
    
    # --- Step 3: Filter Duplicates and Append ---
    added_count = 0
    # API returns newest first. We iterate through them.
    for battle in new_battles:
        b_time = battle.get("battleTime")
        
        if b_time not in existing_times:
            master_data.append(battle)
            existing_times.add(b_time) # Update set in case API has internal dupes
            added_count += 1
    
    # Sort data by battleTime descending (Newest first)
    master_data.sort(key=lambda x: x.get("battleTime", ""), reverse=True)

    # --- Step 4: Save Updated Master File ---
    if added_count > 0:
        with open(MASTER_FILE, "w", encoding="utf-8") as f:
            json.dump(master_data, f, indent=4)
        print(f"Success! Added {added_count} new unique battles.")
        print(f"Total battles in master: {len(master_data)}")
    else:
        print("No new battles found since last run.")

if __name__ == "__main__":
    fetch_and_update()