import requests

BASE_URL = "http://localhost:8000"

def test_popup_as_user():
    # 1. Login as standard user
    login_data = {
        "username": "010-1000-0001", # 강남회원1
        "password": "0001"
    }
    
    try:
        print("Logging in as user...")
        res = requests.post(f"{BASE_URL}/api/auth/login", data=login_data)
        
        if res.status_code != 200:
            print(f"Login failed: {res.status_code} {res.text}")
            return
            
        token = res.json()["access_token"]
        print(f"✅ Login successful. Token obtained.")
        
        # 2. Get Active Popup with Token
        headers = {"Authorization": f"Bearer {token}"}
        print("Requesting active popup...")
        res = requests.get(f"{BASE_URL}/api/community/active-popup", headers=headers)
        
        if res.status_code == 200:
            print(f"✅ Popup Response: {res.json()}")
        else:
            print(f"❌ Failed to get popup: {res.status_code} {res.text}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_popup_as_user()
