"""Backend regression tests: login + GET/PUT capa-entries endpoints.

These are required as a quick backend regression check per the review request.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
ADMIN_USER = "SRD"
ADMIN_PASS = "7550"


@pytest.fixture(scope="module")
def token():
    assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def audit_id(auth_headers):
    """Pick any existing audit for the current user to run regression against."""
    r = requests.get(f"{BASE_URL}/api/audits", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"GET audits failed: {r.status_code} {r.text}"
    audits = r.json().get("audits", [])
    if not audits:
        pytest.skip("No audits exist to test capa-entries against")
    # audits may be a list of dicts with 'id'
    first = audits[0]
    aid = first.get("id") or first.get("_id")
    assert aid, f"Audit missing id field: {first}"
    return aid


def test_login_ok():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body.get("token") or body.get("access_token")


def test_get_capa_entries(auth_headers, audit_id):
    r = requests.get(f"{BASE_URL}/api/audits/{audit_id}/capa-entries", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"GET capa-entries failed: {r.status_code} {r.text}"
    body = r.json()
    assert "capa_entries" in body
    assert isinstance(body["capa_entries"], list)


def test_put_capa_entries_persists(auth_headers, audit_id):
    # Backup existing entries so we can restore them after test
    r0 = requests.get(f"{BASE_URL}/api/audits/{audit_id}/capa-entries", headers=auth_headers, timeout=30)
    original = r0.json().get("capa_entries", []) if r0.status_code == 200 else []

    payload = {
        "entries": [
            {
                "question_id": "test-question-id-regression",
                "standard_clause": "6.1.2",
                "category": "Minor NC",
                "finding_description": "TEST_ regression finding",
                "question_text": "TEST_ question",
                "correction": "TEST_ correction",
                "root_cause": "TEST_ rc",
                "corrective_action": "TEST_ ca",
                "responsible_person": "TEST_ user",
                "target_date": "2026-02-01",
                "status": "Open",
            }
        ]
    }
    r = requests.put(
        f"{BASE_URL}/api/audits/{audit_id}/capa-entries",
        headers=auth_headers,
        json=payload,
        timeout=30,
    )
    assert r.status_code == 200, f"PUT capa-entries failed: {r.status_code} {r.text}"
    assert r.json().get("count") == 1

    # Verify persistence via GET
    r2 = requests.get(f"{BASE_URL}/api/audits/{audit_id}/capa-entries", headers=auth_headers, timeout=30)
    assert r2.status_code == 200
    entries = r2.json().get("capa_entries", [])
    assert any(e.get("finding_description") == "TEST_ regression finding" for e in entries), (
        f"PUT did not persist: {entries}"
    )

    # Restore original entries (best-effort cleanup)
    requests.put(
        f"{BASE_URL}/api/audits/{audit_id}/capa-entries",
        headers=auth_headers,
        json={"entries": original},
        timeout=30,
    )
