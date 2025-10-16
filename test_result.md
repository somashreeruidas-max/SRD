#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "ISO 45001:2018 Internal Audit mobile app backend testing - comprehensive testing of authentication, questionnaire management, and audit APIs"

backend:
  - task: "Authentication API - User Registration"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "POST /api/auth/register endpoint working correctly. Successfully registers new users with username, password, and full_name. Returns JWT token and user info."

  - task: "Authentication API - User Login"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "POST /api/auth/login endpoint working correctly. Validates credentials and returns JWT token. Properly handles invalid credentials with 401 status."

  - task: "Authentication API - Get Current User"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "GET /api/auth/me endpoint working correctly. Returns user info when valid JWT token provided. Properly enforces authentication."

  - task: "Questionnaire API - List Questionnaires"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "GET /api/questionnaires endpoint working correctly. Returns list of questionnaires including default ISO 45001:2018 questionnaire with proper authentication."

  - task: "Questionnaire API - Get Specific Questionnaire"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "GET /api/questionnaires/:id endpoint working correctly. Returns complete questionnaire with clauses, subclauses, and questions structure."

  - task: "Questionnaire API - Create Questionnaire"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "POST /api/questionnaires endpoint working correctly. Successfully creates new questionnaires with proper structure validation."

  - task: "Questionnaire API - Delete Protection"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "DELETE /api/questionnaires/:id endpoint properly protects default ISO 45001:2018 questionnaire from deletion with 400 status code."

  - task: "Audit API - Create Audit"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "POST /api/audits endpoint working correctly. Creates new audit from questionnaire with proper title, description, and initial draft status."

  - task: "Audit API - List User Audits"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "GET /api/audits endpoint working correctly. Returns user-specific audits with proper authentication and data isolation."

  - task: "Audit API - Update with Responses and Evidence"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "PUT /api/audits/:id endpoint working correctly. Successfully updates audit with responses including observations, conformance status (M/Mi/C), and base64 evidence attachments (photos, documents, audio)."

  - task: "Audit API - Get Specific Audit"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "GET /api/audits/:id endpoint working correctly. Returns complete audit with all responses and evidence data properly stored and retrieved."

  - task: "Audit API - Status Transitions"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Audit status transitions working correctly. Successfully transitions from draft -> in-progress -> completed status."

  - task: "Security - JWT Authentication"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "JWT authentication properly enforced across all protected endpoints. Unauthorized access properly rejected with 401 status."

  - task: "Evidence Management - Base64 Storage"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Base64 evidence storage working correctly. Successfully stores and retrieves photos, documents, audio, and video evidence with proper metadata (filename, type, timestamp)."

frontend:
  - task: "Questionnaire Editing - Delete Questions"
    implemented: true
    working: true
    file: "frontend/app/questionnaire/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "user"
        comment: "User reported: unable to delete added questions. If added one question but not able to delete it."
      - working: true
        agent: "main"
        comment: "Fixed bug where wrong clause number was being passed to handleDeleteQuestion. Changed from passing subclause.clause_no to clause.clause_no. Also properly calculated subclauseIndex once per iteration to avoid repeated findIndex calls."
  
  - task: "Questionnaire Editing - Save Changes"
    implemented: true
    working: true
    file: "frontend/app/questionnaire/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "user"
        comment: "User reported: unable to save changes after editing questions. The 'include option' is not working."
      - working: true
        agent: "main"
        comment: "Fixed bug in handleEditQuestion, handleDeleteQuestion, and handleAddQuestion where incorrect clause numbers were being passed. Now correctly passing clause.clause_no as the clauseNo parameter instead of subclause.clause_no. This ensures the functions can properly find and update the correct clause."
  
  - task: "Audit Report - Complete Text Report Download"
    implemented: true
    working: true
    file: "frontend/app/audit/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "user"
        comment: "User disappointed with audit summary download sheet. Requested text-based complete audit report."
      - working: true
        agent: "main"
        comment: "Implemented comprehensive text-based audit report (handleDownloadTextReport). Report includes: header with audit info, statistics (completion rate, conformance summary), detailed clause-by-clause results with all questions/observations/evidence, and non-conformances summary section. Downloads as .txt file. Added green download button in audit header alongside existing PDF options."
  
  - task: "User Registration - Auditor Qualification Fields"
    implemented: true
    working: "NA"
    file: "frontend/app/(auth)/register.tsx, frontend/context/AuthContext.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added three new optional input fields to registration screen: Qualifications, Certifications, and Years of Experience. Updated AuthContext register function to accept and send these fields to backend. Backend already supports these fields in the User model and /api/auth/register endpoint."
  
  - task: "User Profile - Display Auditor Qualifications"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added 'Auditor Qualifications' section to profile screen. Displays qualifications, certifications, and years of experience fetched from /api/auth/me endpoint. Shows 'Not specified' for empty fields. Uses appropriate icons (school, ribbon, time) for visual clarity."

metadata:
  created_by: "testing_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "User Registration - Auditor Qualification Fields"
    - "User Profile - Display Auditor Qualifications"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "testing"
    message: "Comprehensive backend testing completed successfully. All 14 test scenarios passed with 100% success rate. All authentication, questionnaire, and audit APIs are working correctly including JWT security, base64 evidence storage, and proper error handling."
  - agent: "main"
    message: "Fixed critical bugs in questionnaire editing functionality. The root cause was that the handleEditQuestion, handleDeleteQuestion, and handleAddQuestion functions were receiving the wrong clause number parameter. They were receiving subclause.clause_no when they needed clause.clause_no. This caused the functions to fail to find the correct clause in the questionnaire structure, preventing both deletion and saving of changes. The fix now correctly passes clause.clause_no and properly calculates subclauseIndex. Changes should now persist when clicking Save."
  - agent: "main"
    message: "Added comprehensive text-based audit report generation. Created new handleDownloadTextReport function that generates a complete audit report in text format (.txt file) including: audit information, statistics, detailed audit results with all clauses/subclauses/questions, conformance status, observations, evidence details, and a non-conformances summary section. The text report is well-formatted with sections, borders, and easy-to-read structure. Added green download button in audit header for text report. Now users have 3 download options: 1) Complete Text Report (green), 2) Findings Only PDF (yellow), 3) Full PDF Report (blue)."
  - agent: "main"
    message: "Implemented auditor qualification fields feature. Added three optional fields to registration screen: Qualifications (text input), Certifications (text input), and Years of Experience (numeric input). Updated AuthContext and register function to send these fields to backend. Backend already supports these fields in User model. Also updated Profile screen to display these fields in a new 'Auditor Qualifications' section with appropriate icons. Fields show 'Not specified' when empty. Ready for backend testing to verify data flow from registration to profile display."