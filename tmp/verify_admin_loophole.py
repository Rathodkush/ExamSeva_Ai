import requests
import json

def test_admin_registration():
    url = "http://127.0.0.1:5000/register"
    data = {
        "fullName": "Test Admin",
        "email": "testadmin@example.com",
        "password": "password123",
        "role": "admin"
    }
    
    try:
        response = requests.post(url, data=data)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            user = result.get('user', {})
            print(f"Registered Role: {user.get('role')}")
            if user.get('role') == 'admin':
                print("FAIL: Still able to register as admin!")
            else:
                print("SUCCESS: Forced to student role.")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error connecting to Python service: {e}")
        print("Verification skipped: Ensure Python service is running at http://127.0.0.1:5000")

if __name__ == "__main__":
    test_admin_registration()
