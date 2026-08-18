#!/usr/bin/env python3
"""
ISO Audit App - Fork Job Backend Testing
Tests for newly implemented features:
1. Audit ID in backend response
2. Admin qualifications update endpoint
"""

import requests
import json
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://iso-audit-hub-8.preview.emergentagent.com/api"

# Admin credentials
ADMIN_USER = {
    "username": "SRD",
    "password": "7550"
}

class ForkJobTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.test_user_id = None
        self.test_audit_id = None
        self.questionnaire_id = None
        self.test_results = []
        self.passed = 0
        self.failed = 0
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        if success:
            self.passed += 1
            status = "✅ PASS"
        else:
            self.failed += 1
            status = "❌ FAIL"
            
        print(f"{status}: {test_name}")
        print(f"   {message}")
        if details:
            print(f"   Details: {details}")
        print()
    
    def make_request(self, method, endpoint, data=None, token=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            return None
    
    def test_admin_login(self):
        """Test admin login"""
        print("=" * 80)
        print("TEST 1: Admin Login")
        print("=" * 80)
        
        response = self.make_request("POST", "/auth/login", ADMIN_USER)
        
        if not response:
            self.log_result("Admin Login", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                self.admin_token = data["token"]
                self.log_result("Admin Login", True, f"Admin logged in successfully as {ADMIN_USER['username']}")
                return True
            else:
                self.log_result("Admin Login", False, "No token in response", data)
                return False
        else:
            self.log_result("Admin Login", False, f"Login failed with status {response.status_code}", response.text)
            return False
    
    def test_get_questionnaires(self):
        """Get list of questionnaires"""
        print("=" * 80)
        print("TEST 2: Get Questionnaires")
        print("=" * 80)
        
        response = self.make_request("GET", "/questionnaires", token=self.admin_token)
        
        if not response:
            self.log_result("Get Questionnaires", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            
            # Handle both response formats: direct list or nested in "questionnaires" key
            questionnaires = data.get("questionnaires", data) if isinstance(data, dict) else data
            
            if isinstance(questionnaires, list) and len(questionnaires) > 0:
                # Get the first questionnaire (should be FSSC 22000 V6.0 or ISO 45001)
                self.questionnaire_id = questionnaires[0]["id"]
                self.log_result("Get Questionnaires", True, f"Found {len(questionnaires)} questionnaires. Using: {questionnaires[0]['name']}")
                return True
            else:
                self.log_result("Get Questionnaires", False, "No questionnaires found", data)
                return False
        else:
            self.log_result("Get Questionnaires", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def test_create_audit_with_audit_id(self):
        """Test creating audit with custom audit_id"""
        print("=" * 80)
        print("TEST 3: Create Audit with Audit ID")
        print("=" * 80)
        
        audit_data = {
            "questionnaire_id": self.questionnaire_id,
            "title": "Fork Job Test Audit - Audit ID Feature",
            "audit_id": "TEST-AUDIT-2024-001",  # Custom audit identifier
            "description": "Testing audit_id field in backend response",
            "plant_name": "Test Plant",
            "auditor_name": "SRD",
            "auditee_name": "Test Auditee",
            "audit_scope": "Complete facility audit",
            "audit_criteria": "ISO 45001:2018"
        }
        
        response = self.make_request("POST", "/audits", audit_data, token=self.admin_token)
        
        if not response:
            self.log_result("Create Audit with Audit ID", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "id" in data:
                self.test_audit_id = data["id"]
                self.log_result("Create Audit with Audit ID", True, f"Audit created successfully with ID: {self.test_audit_id}")
                return True
            else:
                self.log_result("Create Audit with Audit ID", False, "No audit ID in response", data)
                return False
        else:
            self.log_result("Create Audit with Audit ID", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def test_get_audit_verify_audit_id(self):
        """Test GET /api/audits/{id} and verify audit_id field is present"""
        print("=" * 80)
        print("TEST 4: Get Audit and Verify Audit ID Field (HIGH PRIORITY)")
        print("=" * 80)
        
        response = self.make_request("GET", f"/audits/{self.test_audit_id}", token=self.admin_token)
        
        if not response:
            self.log_result("Get Audit - Verify Audit ID", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            
            # Check if audit_id field exists
            if "audit_id" in data:
                if data["audit_id"] == "TEST-AUDIT-2024-001":
                    self.log_result(
                        "Get Audit - Verify Audit ID", 
                        True, 
                        f"✓ audit_id field present in response with correct value: {data['audit_id']}"
                    )
                    return True
                else:
                    self.log_result(
                        "Get Audit - Verify Audit ID", 
                        False, 
                        f"audit_id field present but value mismatch. Expected: TEST-AUDIT-2024-001, Got: {data['audit_id']}"
                    )
                    return False
            else:
                self.log_result(
                    "Get Audit - Verify Audit ID", 
                    False, 
                    "❌ CRITICAL: audit_id field NOT present in response",
                    f"Response keys: {list(data.keys())}"
                )
                return False
        else:
            self.log_result("Get Audit - Verify Audit ID", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def test_create_audit_without_audit_id(self):
        """Test creating audit without audit_id (should be optional)"""
        print("=" * 80)
        print("TEST 5: Create Audit without Audit ID (Optional Field)")
        print("=" * 80)
        
        audit_data = {
            "questionnaire_id": self.questionnaire_id,
            "title": "Fork Job Test Audit - No Audit ID",
            "description": "Testing that audit_id is optional",
            "plant_name": "Test Plant 2"
        }
        
        response = self.make_request("POST", "/audits", audit_data, token=self.admin_token)
        
        if not response:
            self.log_result("Create Audit without Audit ID", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "id" in data:
                # Now verify the audit can be retrieved
                audit_id = data["id"]
                get_response = self.make_request("GET", f"/audits/{audit_id}", token=self.admin_token)
                
                if get_response and get_response.status_code == 200:
                    audit_data = get_response.json()
                    # audit_id should be None or not present
                    if "audit_id" not in audit_data or audit_data["audit_id"] is None:
                        self.log_result("Create Audit without Audit ID", True, "✓ Audit created successfully without audit_id (field is optional)")
                        return True
                    else:
                        self.log_result("Create Audit without Audit ID", False, f"Unexpected audit_id value: {audit_data['audit_id']}")
                        return False
                else:
                    self.log_result("Create Audit without Audit ID", False, "Failed to retrieve created audit")
                    return False
            else:
                self.log_result("Create Audit without Audit ID", False, "No audit ID in response", data)
                return False
        else:
            self.log_result("Create Audit without Audit ID", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def test_create_test_user(self):
        """Create a test user for qualification update testing"""
        print("=" * 80)
        print("TEST 6: Create Test User")
        print("=" * 80)
        
        user_data = {
            "username": "testuser_fork_2024",
            "password": "test123",
            "full_name": "Test User for Qualifications",
            "is_admin": False
        }
        
        response = self.make_request("POST", "/admin/users", user_data, token=self.admin_token)
        
        if not response:
            self.log_result("Create Test User", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            # Response structure: {"message": "...", "user": {"id": "..."}}
            if "user" in data and "id" in data["user"]:
                self.test_user_id = data["user"]["id"]
                self.log_result("Create Test User", True, f"Test user created with ID: {self.test_user_id}")
                return True
            else:
                self.log_result("Create Test User", False, "No user ID in response", data)
                return False
        elif response.status_code == 400:
            # User might already exist, try to get the user ID
            get_response = self.make_request("GET", "/admin/users", token=self.admin_token)
            if get_response and get_response.status_code == 200:
                users = get_response.json()
                for user in users:
                    if user.get("username") == "testuser_fork_2024":
                        self.test_user_id = user["id"]
                        self.log_result("Create Test User", True, f"Test user already exists with ID: {self.test_user_id}")
                        return True
            self.log_result("Create Test User", False, f"User already exists but couldn't retrieve ID", response.text)
            return False
        else:
            self.log_result("Create Test User", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def test_admin_update_qualifications(self):
        """Test admin updating user qualifications (HIGH PRIORITY)"""
        print("=" * 80)
        print("TEST 7: Admin Update User Qualifications (HIGH PRIORITY)")
        print("=" * 80)
        
        qual_data = {
            "qualifications": "B.Tech Mechanical Engineering",
            "certifications": "ISO 45001 Lead Auditor",
            "years_of_experience": "7"
        }
        
        response = self.make_request(
            "PUT", 
            f"/admin/users/{self.test_user_id}/qualifications", 
            qual_data, 
            token=self.admin_token
        )
        
        if not response:
            self.log_result("Admin Update Qualifications", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "updated successfully" in data["message"].lower():
                self.log_result(
                    "Admin Update Qualifications", 
                    True, 
                    f"✓ Admin successfully updated qualifications: {data}"
                )
                return True
            else:
                self.log_result("Admin Update Qualifications", False, "Unexpected response format", data)
                return False
        else:
            self.log_result("Admin Update Qualifications", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def test_verify_qualifications_updated(self):
        """Verify qualifications were actually updated in database"""
        print("=" * 80)
        print("TEST 8: Verify Qualifications Persisted")
        print("=" * 80)
        
        response = self.make_request("GET", "/admin/users", token=self.admin_token)
        
        if not response:
            self.log_result("Verify Qualifications Persisted", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            users = response.json()
            
            # Find our test user
            test_user = None
            for user in users:
                if user.get("id") == self.test_user_id:
                    test_user = user
                    break
            
            if not test_user:
                self.log_result("Verify Qualifications Persisted", False, "Test user not found in user list")
                return False
            
            # Verify qualifications
            expected = {
                "qualifications": "B.Tech Mechanical Engineering",
                "certifications": "ISO 45001 Lead Auditor",
                "years_of_experience": "7"
            }
            
            actual = {
                "qualifications": test_user.get("qualifications"),
                "certifications": test_user.get("certifications"),
                "years_of_experience": test_user.get("years_of_experience")
            }
            
            if actual == expected:
                self.log_result(
                    "Verify Qualifications Persisted", 
                    True, 
                    f"✓ Qualifications correctly persisted in database: {actual}"
                )
                return True
            else:
                self.log_result(
                    "Verify Qualifications Persisted", 
                    False, 
                    f"Qualification mismatch. Expected: {expected}, Got: {actual}"
                )
                return False
        else:
            self.log_result("Verify Qualifications Persisted", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def test_non_admin_cannot_update_qualifications(self):
        """Test that non-admin users cannot update qualifications"""
        print("=" * 80)
        print("TEST 9: Non-Admin Authorization Check")
        print("=" * 80)
        
        # First, login as the test user (non-admin)
        login_data = {
            "username": "testuser_fork_2024",
            "password": "test123"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if not response or response.status_code != 200:
            self.log_result("Non-Admin Authorization Check", False, "Failed to login as test user")
            return False
        
        user_token = response.json().get("token")
        
        # Try to update qualifications with non-admin token
        qual_data = {
            "qualifications": "Unauthorized Update",
            "certifications": "Should Fail",
            "years_of_experience": "99"
        }
        
        response = self.make_request(
            "PUT", 
            f"/admin/users/{self.test_user_id}/qualifications", 
            qual_data, 
            token=user_token
        )
        
        if not response:
            self.log_result("Non-Admin Authorization Check", False, "Connection failed")
            return False
        
        # Should get 403 Forbidden
        if response.status_code == 403:
            self.log_result(
                "Non-Admin Authorization Check", 
                True, 
                "✓ Non-admin user correctly denied access (403 Forbidden)"
            )
            return True
        elif response.status_code == 401:
            self.log_result(
                "Non-Admin Authorization Check", 
                True, 
                "✓ Non-admin user correctly denied access (401 Unauthorized)"
            )
            return True
        else:
            self.log_result(
                "Non-Admin Authorization Check", 
                False, 
                f"Expected 403/401, got {response.status_code}",
                response.text
            )
            return False
    
    def test_fssc_questionnaire_exists(self):
        """Verify FSSC 22000 V6.0 questionnaire exists"""
        print("=" * 80)
        print("TEST 10: FSSC 22000 V6.0 Questionnaire Exists")
        print("=" * 80)
        
        response = self.make_request("GET", "/questionnaires", token=self.admin_token)
        
        if not response:
            self.log_result("FSSC Questionnaire Exists", False, "Connection failed")
            return False
            
        if response.status_code == 200:
            questionnaires_data = response.json()
            
            # Handle both response formats
            questionnaires = questionnaires_data.get("questionnaires", questionnaires_data) if isinstance(questionnaires_data, dict) else questionnaires_data
            
            # Look for FSSC questionnaire
            fssc_found = False
            for q in questionnaires:
                if "FSSC" in q.get("name", "") or "22000" in q.get("name", ""):
                    fssc_found = True
                    self.log_result(
                        "FSSC Questionnaire Exists", 
                        True, 
                        f"✓ FSSC 22000 V6.0 questionnaire found: {q['name']}"
                    )
                    break
            
            if not fssc_found:
                self.log_result(
                    "FSSC Questionnaire Exists", 
                    False, 
                    "FSSC 22000 V6.0 questionnaire not found",
                    f"Available questionnaires: {[q['name'] for q in questionnaires]}"
                )
                return False
            
            return True
        else:
            self.log_result("FSSC Questionnaire Exists", False, f"Failed with status {response.status_code}", response.text)
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n" + "=" * 80)
        print("ISO AUDIT APP - FORK JOB BACKEND TESTING")
        print("Testing: Audit ID Feature & Admin Qualifications Update")
        print("=" * 80 + "\n")
        
        # Test sequence
        tests = [
            self.test_admin_login,
            self.test_get_questionnaires,
            self.test_create_audit_with_audit_id,
            self.test_get_audit_verify_audit_id,
            self.test_create_audit_without_audit_id,
            self.test_create_test_user,
            self.test_admin_update_qualifications,
            self.test_verify_qualifications_updated,
            self.test_non_admin_cannot_update_qualifications,
            self.test_fssc_questionnaire_exists
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_result(test.__name__, False, f"Exception occurred: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Success Rate: {(self.passed / (self.passed + self.failed) * 100):.1f}%")
        print("=" * 80 + "\n")
        
        # Print failed tests details
        if self.failed > 0:
            print("FAILED TESTS:")
            print("-" * 80)
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}")
                    print(f"   {result['message']}")
                    if result['details']:
                        print(f"   {result['details']}")
            print("=" * 80 + "\n")
        
        return self.failed == 0

if __name__ == "__main__":
    tester = ForkJobTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
