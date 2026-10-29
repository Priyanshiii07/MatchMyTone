"""End-to-end auth and ownership smoke test for a running local API."""

import os
import sys
import uuid

import requests
from models import users


base = os.getenv("MATCHMYTONE_API_URL", "http://127.0.0.1:5000/api").rstrip("/")
email = f"smoke-{uuid.uuid4().hex[:10]}@example.com"
password = "SmokeTest!123"
phone = str(9000000000 + (uuid.uuid4().int % 99999999)).zfill(10)
updated_phone = str(9000000000 + (uuid.uuid4().int % 99999999)).zfill(10)
profile = {"name": f"Smoke {uuid.uuid4().hex[:10]}", "email": email, "password": password, "gender": "other", "dob": "1990-01-01", "age": 36}


def check(response, expected, label):
    if response.status_code != expected:
        raise RuntimeError(f"{label}: expected {expected}, got {response.status_code}: {response.text}")
    return response.json()


created = check(requests.post(f"{base}/auth/register", json=profile), 201, "registration")
assert "password" not in str(created).lower()
stored = users.find_one({"email": email}, {"_id": 0, "password_hash": 1})
assert stored and stored["password_hash"].startswith("$2"), stored
duplicate = requests.post(f"{base}/auth/register", json=profile)
assert duplicate.status_code == 409, duplicate.text
login = check(requests.post(f"{base}/auth/login", json={"email": email, "password": password}), 200, "login")
token = login["user"]["token"]
headers = {"Authorization": f"Bearer {token}"}
check(requests.get(f"{base}/users/profile", headers=headers), 200, "profile retrieval")
check(requests.put(f"{base}/users/profile", headers=headers, json={**profile, "phone": updated_phone}), 200, "profile update")
saved_analysis = check(requests.post(f"{base}/quiz/skincare", headers=headers, json={"answers": {"q1": {"label": "A"}}, "result": "Oily Skin"}), 201, "analysis save")
pdf = requests.get(f"{base}/quiz/skincare/{saved_analysis['result']['id']}/pdf", headers=headers)
assert pdf.status_code == 200 and pdf.headers.get("content-type", "").startswith("application/pdf"), pdf.text[:200]
results = check(requests.get(f"{base}/quiz/results", headers=headers), 200, "analysis retrieval")
assert results["results"]["skincare"], results
other = {"name": f"Other {uuid.uuid4().hex[:10]}", "email": f"other-{uuid.uuid4().hex[:10]}@example.com", "password": password, "gender": "other", "dob": "1991-01-01", "age": 35}
check(requests.post(f"{base}/auth/register", json=other), 201, "second registration")
other_login = check(requests.post(f"{base}/auth/login", json={"email": other["email"], "password": password}), 200, "second login")
other_results = check(requests.get(f"{base}/quiz/results", headers={"Authorization": f"Bearer {other_login['user']['token']}"}), 200, "other user history")
assert not other_results["results"]["skincare"], other_results
assert requests.get(f"{base}/users/profile").status_code == 401
assert requests.post(f"{base}/auth/login", json={"email": email, "password": "Wrong!123"}).status_code == 401
print(f"Smoke test passed for {email}")
