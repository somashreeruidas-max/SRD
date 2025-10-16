#!/usr/bin/env python3
"""
ISO 45001:2018 Internal Audit Backend API Test Suite
Tests all authentication, questionnaire, and audit endpoints
"""

import requests
import json
import base64
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://quality-auditor-1.preview.emergentagent.com/api"
TEST_USER = {
    "username": "audit_tester_2024",
    "password": "SecurePass123!",
    "full_name": "Audit Test User"
}

# Test user with qualification fields for new feature testing
TEST_USER_WITH_QUALIFICATIONS = {
    "username": "qualified_auditor_2024",
    "password": "SecurePass456!",
    "full_name": "Dr. Sarah Johnson",
    "qualifications": "PhD in Environmental Engineering, MSc in Quality Management",
    "certifications": "ISO 45001 Lead Auditor, ISO 9001 Lead Auditor, NEBOSH IGC",
    "years_of_experience": 15
}

# Test user without qualification fields
TEST_USER_MINIMAL = {
    "username": "minimal_auditor_2024",
    "password": "SecurePass789!",
    "full_name": "John Smith"
}

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.questionnaire_id = None
        self.audit_id = None
        self.test_results = []
        
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
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        
        if self.token:
            default_headers["Authorization"] = f"Bearer {self.token}"
        
        if headers:
            default_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=default_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            return None, str(e)
    
    def test_health_check(self):
        """Test health endpoint"""
        response = self.make_request("GET", "/health")
        if isinstance(response, tuple):
            self.log_result("Health Check", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            self.log_result("Health Check", True, "Backend is healthy")
            return True
        else:
            self.log_result("Health Check", False, f"Health check failed with status {response.status_code}")
            return False
    
    def test_user_registration(self):
        """Test user registration"""
        response = self.make_request("POST", "/auth/register", TEST_USER)
        if isinstance(response, tuple):
            self.log_result("User Registration", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                self.token = data["token"]
                self.user_id = data["user"]["id"]
                self.log_result("User Registration", True, "User registered successfully")
                return True
            else:
                self.log_result("User Registration", False, "Missing token or user in response", data)
                return False
        elif response.status_code == 400:
            # User might already exist, try login instead
            return self.test_user_login()
        else:
            self.log_result("User Registration", False, f"Registration failed with status {response.status_code}", response.text)
            return False
    
    def test_user_login(self):
        """Test user login"""
        login_data = {
            "username": TEST_USER["username"],
            "password": TEST_USER["password"]
        }
        response = self.make_request("POST", "/auth/login", login_data)
        if isinstance(response, tuple):
            self.log_result("User Login", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                self.token = data["token"]
                self.user_id = data["user"]["id"]
                self.log_result("User Login", True, "User logged in successfully")
                return True
            else:
                self.log_result("User Login", False, "Missing token or user in response", data)
                return False
        else:
            self.log_result("User Login", False, f"Login failed with status {response.status_code}", response.text)
            return False
    
    def test_get_current_user(self):
        """Test get current user endpoint"""
        if not self.token:
            self.log_result("Get Current User", False, "No authentication token available")
            return False
            
        response = self.make_request("GET", "/auth/me")
        if isinstance(response, tuple):
            self.log_result("Get Current User", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "username" in data and "id" in data:
                self.log_result("Get Current User", True, "User info retrieved successfully")
                return True
            else:
                self.log_result("Get Current User", False, "Missing user info in response", data)
                return False
        else:
            self.log_result("Get Current User", False, f"Get user failed with status {response.status_code}", response.text)
            return False
    
    def test_get_questionnaires(self):
        """Test get questionnaires endpoint"""
        if not self.token:
            self.log_result("Get Questionnaires", False, "No authentication token available")
            return False
            
        response = self.make_request("GET", "/questionnaires")
        if isinstance(response, tuple):
            self.log_result("Get Questionnaires", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "questionnaires" in data and len(data["questionnaires"]) > 0:
                # Store the first questionnaire ID for later tests
                self.questionnaire_id = data["questionnaires"][0]["id"]
                self.log_result("Get Questionnaires", True, f"Retrieved {len(data['questionnaires'])} questionnaires")
                return True
            else:
                self.log_result("Get Questionnaires", False, "No questionnaires found", data)
                return False
        else:
            self.log_result("Get Questionnaires", False, f"Get questionnaires failed with status {response.status_code}", response.text)
            return False
    
    def test_get_specific_questionnaire(self):
        """Test get specific questionnaire endpoint"""
        if not self.token or not self.questionnaire_id:
            self.log_result("Get Specific Questionnaire", False, "No authentication token or questionnaire ID available")
            return False
            
        response = self.make_request("GET", f"/questionnaires/{self.questionnaire_id}")
        if isinstance(response, tuple):
            self.log_result("Get Specific Questionnaire", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "name" in data and "clauses" in data:
                self.log_result("Get Specific Questionnaire", True, f"Retrieved questionnaire: {data['name']}")
                return True
            else:
                self.log_result("Get Specific Questionnaire", False, "Missing questionnaire data", data)
                return False
        else:
            self.log_result("Get Specific Questionnaire", False, f"Get questionnaire failed with status {response.status_code}", response.text)
            return False
    
    def test_create_questionnaire(self):
        """Test create questionnaire endpoint"""
        if not self.token:
            self.log_result("Create Questionnaire", False, "No authentication token available")
            return False
            
        new_questionnaire = {
            "name": "Test Custom Questionnaire",
            "description": "A test questionnaire for API testing",
            "clauses": [
                {
                    "clause_no": "1",
                    "title": "Test Clause",
                    "subclauses": [
                        {
                            "clause_no": "1.1",
                            "title": "Test Subclause",
                            "questions": [
                                {
                                    "id": "test_q_1",
                                    "question_text": "Is this a test question?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        
        response = self.make_request("POST", "/questionnaires", new_questionnaire)
        if isinstance(response, tuple):
            self.log_result("Create Questionnaire", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "id" in data:
                self.log_result("Create Questionnaire", True, "Questionnaire created successfully")
                return True
            else:
                self.log_result("Create Questionnaire", False, "Missing questionnaire ID in response", data)
                return False
        else:
            self.log_result("Create Questionnaire", False, f"Create questionnaire failed with status {response.status_code}", response.text)
            return False
    
    def test_create_audit(self):
        """Test create audit endpoint"""
        if not self.token or not self.questionnaire_id:
            self.log_result("Create Audit", False, "No authentication token or questionnaire ID available")
            return False
            
        audit_data = {
            "questionnaire_id": self.questionnaire_id,
            "title": "Test Safety Audit - Water Plant",
            "description": "Comprehensive safety audit for packaged drinking water plant"
        }
        
        response = self.make_request("POST", "/audits", audit_data)
        if isinstance(response, tuple):
            self.log_result("Create Audit", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "id" in data:
                self.audit_id = data["id"]
                self.log_result("Create Audit", True, "Audit created successfully")
                return True
            else:
                self.log_result("Create Audit", False, "Missing audit ID in response", data)
                return False
        else:
            self.log_result("Create Audit", False, f"Create audit failed with status {response.status_code}", response.text)
            return False
    
    def test_get_audits(self):
        """Test get audits endpoint"""
        if not self.token:
            self.log_result("Get Audits", False, "No authentication token available")
            return False
            
        response = self.make_request("GET", "/audits")
        if isinstance(response, tuple):
            self.log_result("Get Audits", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "audits" in data:
                self.log_result("Get Audits", True, f"Retrieved {len(data['audits'])} audits")
                return True
            else:
                self.log_result("Get Audits", False, "Missing audits in response", data)
                return False
        else:
            self.log_result("Get Audits", False, f"Get audits failed with status {response.status_code}", response.text)
            return False
    
    def test_update_audit_with_responses(self):
        """Test update audit with responses and evidence"""
        if not self.token or not self.audit_id:
            self.log_result("Update Audit with Responses", False, "No authentication token or audit ID available")
            return False
        
        # Create mock base64 image data
        mock_image_data = base64.b64encode(b"mock_image_data_for_testing").decode('utf-8')
        
        audit_update = {
            "status": "in-progress",
            "responses": [
                {
                    "question_id": "q_4_1_1",
                    "clause_no": "4.1",
                    "observations": "Machine hazards properly identified. Safety guards in place on all production equipment. Chemical exposure risks documented with proper MSDS sheets available.",
                    "conformance": "C",
                    "evidence": [
                        {
                            "type": "photo",
                            "filename": "safety_guards.jpg",
                            "data": mock_image_data,
                            "timestamp": datetime.now().isoformat()
                        },
                        {
                            "type": "document",
                            "filename": "msds_sheets.pdf",
                            "data": mock_image_data,
                            "timestamp": datetime.now().isoformat()
                        }
                    ]
                },
                {
                    "question_id": "q_5_1_1",
                    "clause_no": "5.1",
                    "observations": "Management demonstrates strong commitment to safety culture. Regular safety meetings conducted. However, some resource allocation delays noted.",
                    "conformance": "Mi",
                    "evidence": [
                        {
                            "type": "audio",
                            "filename": "safety_meeting_recording.mp3",
                            "data": mock_image_data,
                            "timestamp": datetime.now().isoformat()
                        }
                    ]
                }
            ]
        }
        
        response = self.make_request("PUT", f"/audits/{self.audit_id}", audit_update)
        if isinstance(response, tuple):
            self.log_result("Update Audit with Responses", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            self.log_result("Update Audit with Responses", True, "Audit updated with responses and evidence")
            return True
        else:
            self.log_result("Update Audit with Responses", False, f"Update audit failed with status {response.status_code}", response.text)
            return False
    
    def test_get_specific_audit(self):
        """Test get specific audit endpoint"""
        if not self.token or not self.audit_id:
            self.log_result("Get Specific Audit", False, "No authentication token or audit ID available")
            return False
            
        response = self.make_request("GET", f"/audits/{self.audit_id}")
        if isinstance(response, tuple):
            self.log_result("Get Specific Audit", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "title" in data and "responses" in data:
                response_count = len(data["responses"])
                self.log_result("Get Specific Audit", True, f"Retrieved audit with {response_count} responses")
                return True
            else:
                self.log_result("Get Specific Audit", False, "Missing audit data", data)
                return False
        else:
            self.log_result("Get Specific Audit", False, f"Get audit failed with status {response.status_code}", response.text)
            return False
    
    def test_complete_audit(self):
        """Test completing an audit"""
        if not self.token or not self.audit_id:
            self.log_result("Complete Audit", False, "No authentication token or audit ID available")
            return False
            
        audit_update = {
            "status": "completed"
        }
        
        response = self.make_request("PUT", f"/audits/{self.audit_id}", audit_update)
        if isinstance(response, tuple):
            self.log_result("Complete Audit", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            self.log_result("Complete Audit", True, "Audit marked as completed")
            return True
        else:
            self.log_result("Complete Audit", False, f"Complete audit failed with status {response.status_code}", response.text)
            return False
    
    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        # Save current token
        original_token = self.token
        self.token = None
        
        # Test accessing protected endpoint without token
        response = self.make_request("GET", "/questionnaires")
        if isinstance(response, tuple):
            self.log_result("Unauthorized Access Test", False, "Connection failed", response[1])
            self.token = original_token
            return False
            
        if response.status_code == 401 or response.status_code == 403:
            self.log_result("Unauthorized Access Test", True, "Properly rejected unauthorized access")
            self.token = original_token
            return True
        else:
            self.log_result("Unauthorized Access Test", False, f"Should have rejected unauthorized access, got status {response.status_code}")
            self.token = original_token
            return False
    
    def test_invalid_credentials(self):
        """Test login with invalid credentials"""
        invalid_login = {
            "username": "nonexistent_user",
            "password": "wrong_password"
        }
        
        response = self.make_request("POST", "/auth/login", invalid_login)
        if isinstance(response, tuple):
            self.log_result("Invalid Credentials Test", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 401:
            self.log_result("Invalid Credentials Test", True, "Properly rejected invalid credentials")
            return True
        else:
            self.log_result("Invalid Credentials Test", False, f"Should have rejected invalid credentials, got status {response.status_code}")
            return False
    
    def test_delete_default_questionnaire_protection(self):
        """Test that default questionnaire cannot be deleted"""
        if not self.token or not self.questionnaire_id:
            self.log_result("Delete Default Questionnaire Protection", False, "No authentication token or questionnaire ID available")
            return False
            
        response = self.make_request("DELETE", f"/questionnaires/{self.questionnaire_id}")
        if isinstance(response, tuple):
            self.log_result("Delete Default Questionnaire Protection", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 400:
            self.log_result("Delete Default Questionnaire Protection", True, "Default questionnaire properly protected from deletion")
            return True
        else:
            self.log_result("Delete Default Questionnaire Protection", False, f"Should have protected default questionnaire, got status {response.status_code}")
            return False
    
    def test_registration_with_qualifications(self):
        """Test user registration with qualification fields"""
        response = self.make_request("POST", "/auth/register", TEST_USER_WITH_QUALIFICATIONS)
        if isinstance(response, tuple):
            self.log_result("Registration with Qualifications", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                self.log_result("Registration with Qualifications", True, "User with qualifications registered successfully")
                return data["token"]
            else:
                self.log_result("Registration with Qualifications", False, "Missing token or user in response", data)
                return False
        elif response.status_code == 400:
            # User might already exist, try login
            login_data = {
                "username": TEST_USER_WITH_QUALIFICATIONS["username"],
                "password": TEST_USER_WITH_QUALIFICATIONS["password"]
            }
            login_response = self.make_request("POST", "/auth/login", login_data)
            if login_response.status_code == 200:
                data = login_response.json()
                self.log_result("Registration with Qualifications", True, "User with qualifications logged in (already existed)")
                return data["token"]
            else:
                self.log_result("Registration with Qualifications", False, f"Registration failed with status {response.status_code}", response.text)
                return False
        else:
            self.log_result("Registration with Qualifications", False, f"Registration failed with status {response.status_code}", response.text)
            return False
    
    def test_registration_without_qualifications(self):
        """Test user registration without qualification fields"""
        response = self.make_request("POST", "/auth/register", TEST_USER_MINIMAL)
        if isinstance(response, tuple):
            self.log_result("Registration without Qualifications", False, "Connection failed", response[1])
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                self.log_result("Registration without Qualifications", True, "User without qualifications registered successfully")
                return data["token"]
            else:
                self.log_result("Registration without Qualifications", False, "Missing token or user in response", data)
                return False
        elif response.status_code == 400:
            # User might already exist, try login
            login_data = {
                "username": TEST_USER_MINIMAL["username"],
                "password": TEST_USER_MINIMAL["password"]
            }
            login_response = self.make_request("POST", "/auth/login", login_data)
            if login_response.status_code == 200:
                data = login_response.json()
                self.log_result("Registration without Qualifications", True, "User without qualifications logged in (already existed)")
                return data["token"]
            else:
                self.log_result("Registration without Qualifications", False, f"Registration failed with status {response.status_code}", response.text)
                return False
        else:
            self.log_result("Registration without Qualifications", False, f"Registration failed with status {response.status_code}", response.text)
            return False
    
    def test_qualification_data_retrieval(self, token, expected_qualifications=None):
        """Test retrieving user data with qualification fields"""
        # Save current token
        original_token = self.token
        self.token = token
        
        response = self.make_request("GET", "/auth/me")
        if isinstance(response, tuple):
            self.log_result("Qualification Data Retrieval", False, "Connection failed", response[1])
            self.token = original_token
            return False
            
        if response.status_code == 200:
            data = response.json()
            
            # Check if qualification fields are present
            qualification_fields = ["qualifications", "certifications", "years_of_experience"]
            
            if expected_qualifications:
                # Test user with qualifications - verify all fields are correct
                all_correct = True
                errors = []
                
                for field in qualification_fields:
                    if field not in data:
                        errors.append(f"Missing field: {field}")
                        all_correct = False
                    elif data[field] != expected_qualifications.get(field):
                        errors.append(f"{field}: got '{data[field]}', expected '{expected_qualifications.get(field)}'")
                        all_correct = False
                
                if all_correct:
                    self.log_result("Qualification Data Retrieval (with qualifications)", True, "All qualification fields retrieved correctly")
                    self.token = original_token
                    return True
                else:
                    self.log_result("Qualification Data Retrieval (with qualifications)", False, f"Qualification field errors: {errors}")
                    self.token = original_token
                    return False
            else:
                # Test user without qualifications - verify fields are null/empty
                non_null_fields = []
                for field in qualification_fields:
                    if field in data and data[field] is not None:
                        non_null_fields.append(f"{field}: {data[field]}")
                
                if len(non_null_fields) == 0:
                    self.log_result("Qualification Data Retrieval (without qualifications)", True, "Qualification fields are properly null/empty")
                    self.token = original_token
                    return True
                else:
                    self.log_result("Qualification Data Retrieval (without qualifications)", False, f"Expected null qualification fields but found: {non_null_fields}")
                    self.token = original_token
                    return False
        else:
            self.log_result("Qualification Data Retrieval", False, f"Get user data failed with status {response.status_code}", response.text)
            self.token = original_token
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting ISO 45001:2018 Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Core connectivity and health
        if not self.test_health_check():
            print("❌ Backend health check failed - stopping tests")
            return False
        
        # Authentication flow
        if not self.test_user_registration():
            print("❌ Authentication setup failed - stopping tests")
            return False
            
        self.test_get_current_user()
        
        # Questionnaire management
        self.test_get_questionnaires()
        self.test_get_specific_questionnaire()
        self.test_create_questionnaire()
        
        # Audit management
        self.test_create_audit()
        self.test_get_audits()
        self.test_update_audit_with_responses()
        self.test_get_specific_audit()
        self.test_complete_audit()
        
        # Security and error handling
        self.test_unauthorized_access()
        self.test_invalid_credentials()
        self.test_delete_default_questionnaire_protection()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)