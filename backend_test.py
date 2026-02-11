#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import os

# Use the public endpoint from frontend .env
API_URL = "https://aquacompliance.preview.emergentagent.com"

class RCASystemTester:
    def __init__(self):
        self.base_url = API_URL
        self.token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_user_id = None
        self.test_finding_id = None
        self.test_rca_id = None
        self.test_capa_id = None
        self.test_evidence_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, files=None, use_admin=False):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Use admin token if specified, otherwise regular token
        token = self.admin_token if use_admin and self.admin_token else self.token
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files:
            # Remove Content-Type for file uploads
            headers.pop('Content-Type', None)
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, headers=headers, data=data, files=files, timeout=30)
                else:
                    response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return None, f"Unsupported method: {method}"
            
            return response, None
        except requests.exceptions.RequestException as e:
            return None, str(e)

    def test_seed_data(self):
        """Test seeding sample data"""
        response, error = self.make_request('POST', 'seed-data')
        if error:
            self.log_test("Seed Sample Data", False, error)
            return False
        
        success = response.status_code in [200, 201]
        if success:
            try:
                data = response.json()
                self.log_test("Seed Sample Data", True, f"Response: {data.get('message', 'Success')}")
            except:
                self.log_test("Seed Sample Data", True, "Data seeded successfully")
        else:
            self.log_test("Seed Sample Data", False, f"Status: {response.status_code}")
        return success

    def test_admin_login(self):
        """Test admin login"""
        login_data = {
            "email": "admin@aquaguard.com",
            "password": "admin123"
        }
        
        response, error = self.make_request('POST', 'auth/login', login_data)
        if error:
            self.log_test("Admin Login", False, error)
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_test("Admin Login", True, f"Token received, Role: {data['user']['role']}")
                return True
            except Exception as e:
                self.log_test("Admin Login", False, f"Invalid response format: {e}")
                return False
        else:
            self.log_test("Admin Login", False, f"Status: {response.status_code}")
            return False

    def test_user_login(self):
        """Test QA manager login"""
        login_data = {
            "email": "qa.manager@aquaguard.com", 
            "password": "password123"
        }
        
        response, error = self.make_request('POST', 'auth/login', login_data)
        if error:
            self.log_test("QA Manager Login", False, error)
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                self.token = data['access_token']
                self.log_test("QA Manager Login", True, f"Token received, Role: {data['user']['role']}")
                return True
            except Exception as e:
                self.log_test("QA Manager Login", False, f"Invalid response format: {e}")
                return False
        else:
            self.log_test("QA Manager Login", False, f"Status: {response.status_code}")
            return False

    def test_get_current_user(self):
        """Test getting current user info"""
        response, error = self.make_request('GET', 'auth/me')
        if error:
            self.log_test("Get Current User", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                self.log_test("Get Current User", True, f"User: {data['name']} ({data['role']})")
            except:
                self.log_test("Get Current User", True, "User info retrieved")
        else:
            self.log_test("Get Current User", False, f"Status: {response.status_code}")
        return success

    def test_get_findings(self):
        """Test getting audit findings"""
        response, error = self.make_request('GET', 'findings')
        if error:
            self.log_test("Get Findings", False, error)
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                findings_count = len(data)
                if findings_count > 0:
                    # Store first finding ID for later tests
                    self.test_finding_id = data[0]['id']
                self.log_test("Get Findings", True, f"Retrieved {findings_count} findings")
                return True
            except Exception as e:
                self.log_test("Get Findings", False, f"Invalid response: {e}")
                return False
        else:
            self.log_test("Get Findings", False, f"Status: {response.status_code}")
            return False

    def test_create_finding(self):
        """Test creating a new audit finding"""
        finding_data = {
            "audit_type": "ISO 9001",
            "clause_reference": "8.5.1",
            "department": "QA",
            "finding_description": "Test finding for automated testing - calibration issue detected",
            "objective_evidence": "Test evidence - calibration records missing",
            "severity": 3,
            "likelihood": 3,
            "auditor_name": "Test Auditor",
            "audit_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response, error = self.make_request('POST', 'findings', finding_data)
        if error:
            self.log_test("Create Finding", False, error)
            return False
        
        if response.status_code in [200, 201]:
            try:
                data = response.json()
                self.test_finding_id = data['id']
                self.log_test("Create Finding", True, f"Finding created with ID: {self.test_finding_id}")
                return True
            except Exception as e:
                self.log_test("Create Finding", False, f"Invalid response: {e}")
                return False
        else:
            self.log_test("Create Finding", False, f"Status: {response.status_code}")
            return False

    def test_update_finding(self):
        """Test updating a finding"""
        if not self.test_finding_id:
            self.log_test("Update Finding", False, "No test finding ID available")
            return False
        
        update_data = {
            "status": "In Progress",
            "finding_description": "Updated test finding - calibration issue being addressed"
        }
        
        response, error = self.make_request('PUT', f'findings/{self.test_finding_id}', update_data)
        if error:
            self.log_test("Update Finding", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                self.log_test("Update Finding", True, f"Status updated to: {data.get('status', 'Unknown')}")
            except:
                self.log_test("Update Finding", True, "Finding updated successfully")
        else:
            self.log_test("Update Finding", False, f"Status: {response.status_code}")
        return success

    def test_create_rca(self):
        """Test creating RCA"""
        if not self.test_finding_id:
            self.log_test("Create RCA", False, "No test finding ID available")
            return False
        
        rca_data = {
            "finding_id": self.test_finding_id,
            "rca_type": "5-why",
            "problem_statement": "Calibration records are missing for critical equipment",
            "five_whys": [
                {"why": "Why are calibration records missing?", "answer": "Records were not properly filed"},
                {"why": "Why were records not filed?", "answer": "Filing procedure was not followed"},
                {"why": "Why was procedure not followed?", "answer": "Staff was not trained on new procedure"},
                {"why": "Why was staff not trained?", "answer": "Training schedule was not updated"},
                {"why": "Why was schedule not updated?", "answer": "No process owner assigned for training updates"}
            ],
            "root_cause": "Lack of process ownership for training schedule updates led to inadequate staff training on filing procedures"
        }
        
        response, error = self.make_request('POST', 'rca', rca_data)
        if error:
            self.log_test("Create RCA", False, error)
            return False
        
        if response.status_code in [200, 201]:
            try:
                data = response.json()
                self.test_rca_id = data['id']
                self.log_test("Create RCA", True, f"RCA created with ID: {self.test_rca_id}")
                return True
            except Exception as e:
                self.log_test("Create RCA", False, f"Invalid response: {e}")
                return False
        else:
            self.log_test("Create RCA", False, f"Status: {response.status_code}")
            return False

    def test_get_rcas(self):
        """Test getting RCAs"""
        response, error = self.make_request('GET', 'rca')
        if error:
            self.log_test("Get RCAs", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                self.log_test("Get RCAs", True, f"Retrieved {len(data)} RCAs")
            except:
                self.log_test("Get RCAs", True, "RCAs retrieved successfully")
        else:
            self.log_test("Get RCAs", False, f"Status: {response.status_code}")
        return success

    def test_create_capa(self):
        """Test creating CAPA"""
        if not self.test_finding_id:
            self.log_test("Create CAPA", False, "No test finding ID available")
            return False
        
        capa_data = {
            "finding_id": self.test_finding_id,
            "rca_id": self.test_rca_id,
            "action_type": "corrective",
            "action_plan": "1. Assign process owner for training updates 2. Update training schedule 3. Train all staff on filing procedures",
            "responsible_person": "QA Manager",
            "responsible_email": "qa.manager@aquaguard.com",
            "target_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "resources_required": "Training materials, 2 days staff time",
            "verification_method": "Audit of filing compliance after 30 days"
        }
        
        response, error = self.make_request('POST', 'capa', capa_data)
        if error:
            self.log_test("Create CAPA", False, error)
            return False
        
        if response.status_code in [200, 201]:
            try:
                data = response.json()
                self.test_capa_id = data['id']
                self.log_test("Create CAPA", True, f"CAPA created with ID: {self.test_capa_id}")
                return True
            except Exception as e:
                self.log_test("Create CAPA", False, f"Invalid response: {e}")
                return False
        else:
            self.log_test("Create CAPA", False, f"Status: {response.status_code}")
            return False

    def test_update_capa(self):
        """Test updating CAPA status"""
        if not self.test_capa_id:
            self.log_test("Update CAPA", False, "No test CAPA ID available")
            return False
        
        update_data = {
            "status": "In Progress"
        }
        
        response, error = self.make_request('PUT', f'capa/{self.test_capa_id}', update_data)
        if error:
            self.log_test("Update CAPA", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            self.log_test("Update CAPA", True, "CAPA status updated to In Progress")
        else:
            self.log_test("Update CAPA", False, f"Status: {response.status_code}")
        return success

    def test_get_capas(self):
        """Test getting CAPAs"""
        response, error = self.make_request('GET', 'capa')
        if error:
            self.log_test("Get CAPAs", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                self.log_test("Get CAPAs", True, f"Retrieved {len(data)} CAPAs")
            except:
                self.log_test("Get CAPAs", True, "CAPAs retrieved successfully")
        else:
            self.log_test("Get CAPAs", False, f"Status: {response.status_code}")
        return success

    def test_get_evidence(self):
        """Test getting evidence"""
        response, error = self.make_request('GET', 'evidence')
        if error:
            self.log_test("Get Evidence", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                self.log_test("Get Evidence", True, f"Retrieved {len(data)} evidence items")
            except:
                self.log_test("Get Evidence", True, "Evidence retrieved successfully")
        else:
            self.log_test("Get Evidence", False, f"Status: {response.status_code}")
        return success

    def test_risk_matrix(self):
        """Test risk matrix endpoint"""
        response, error = self.make_request('GET', 'risk-matrix')
        if error:
            self.log_test("Risk Matrix", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                matrix = data.get('matrix', [])
                self.log_test("Risk Matrix", True, f"Matrix loaded with {len(matrix)} rows")
            except:
                self.log_test("Risk Matrix", True, "Risk matrix retrieved successfully")
        else:
            self.log_test("Risk Matrix", False, f"Status: {response.status_code}")
        return success

    def test_dashboard_analytics(self):
        """Test dashboard analytics"""
        response, error = self.make_request('GET', 'analytics/dashboard')
        if error:
            self.log_test("Dashboard Analytics", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                total_findings = data.get('total_findings', 0)
                self.log_test("Dashboard Analytics", True, f"Analytics loaded - {total_findings} total findings")
            except:
                self.log_test("Dashboard Analytics", True, "Analytics retrieved successfully")
        else:
            self.log_test("Dashboard Analytics", False, f"Status: {response.status_code}")
        return success

    def test_compliance_analytics(self):
        """Test compliance analytics"""
        response, error = self.make_request('GET', 'analytics/compliance')
        if error:
            self.log_test("Compliance Analytics", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                total = data.get('total', 0)
                self.log_test("Compliance Analytics", True, f"Compliance data loaded - {total} findings analyzed")
            except:
                self.log_test("Compliance Analytics", True, "Compliance analytics retrieved successfully")
        else:
            self.log_test("Compliance Analytics", False, f"Status: {response.status_code}")
        return success

    def test_management_report(self):
        """Test management review report"""
        response, error = self.make_request('GET', 'reports/management-review')
        if error:
            self.log_test("Management Report", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                report_date = data.get('report_date', 'Unknown')
                self.log_test("Management Report", True, f"Report generated for {report_date}")
            except:
                self.log_test("Management Report", True, "Management report retrieved successfully")
        else:
            self.log_test("Management Report", False, f"Status: {response.status_code}")
        return success

    def test_user_management(self):
        """Test user management (admin only)"""
        response, error = self.make_request('GET', 'users', use_admin=True)
        if error:
            self.log_test("User Management", False, error)
            return False
        
        success = response.status_code == 200
        if success:
            try:
                data = response.json()
                self.log_test("User Management", True, f"Retrieved {len(data)} users")
            except:
                self.log_test("User Management", True, "Users retrieved successfully")
        else:
            self.log_test("User Management", False, f"Status: {response.status_code}")
        return success

    def run_all_tests(self):
        """Run all backend API tests"""
        print(f"🚀 Starting RCA System Backend API Tests")
        print(f"📍 Testing endpoint: {self.base_url}")
        print("=" * 60)
        
        # Core authentication tests
        if not self.test_seed_data():
            print("⚠️  Seed data failed, continuing with existing data...")
        
        if not self.test_admin_login():
            print("❌ Admin login failed - some tests may not work")
        
        if not self.test_user_login():
            print("❌ User login failed - stopping tests")
            return False
        
        # User info test
        self.test_get_current_user()
        
        # Findings tests
        self.test_get_findings()
        self.test_create_finding()
        self.test_update_finding()
        
        # RCA tests
        self.test_create_rca()
        self.test_get_rcas()
        
        # CAPA tests
        self.test_create_capa()
        self.test_update_capa()
        self.test_get_capas()
        
        # Evidence tests
        self.test_get_evidence()
        
        # Analytics and reporting tests
        self.test_risk_matrix()
        self.test_dashboard_analytics()
        self.test_compliance_analytics()
        self.test_management_report()
        
        # Admin tests
        if self.admin_token:
            self.test_user_management()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    """Main test execution"""
    tester = RCASystemTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "endpoint": API_URL,
        "summary": {
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "failed_tests": tester.tests_run - tester.tests_passed,
            "success_rate": round((tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0, 1)
        },
        "test_results": tester.test_results
    }
    
    # Write results to file
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())