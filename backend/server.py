from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import shutil
import asyncio
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'aquaguard-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# File upload directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# Resend Email Configuration
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Create the main app
app = FastAPI(title="AquaGuard RCA System")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "auditor"  # admin, qa_manager, department_head, auditor
    department: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    department: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class AuditFindingCreate(BaseModel):
    audit_type: str  # ISO 9001, ISO 14001, ISO 45001, FSSC 22000
    clause_reference: str
    department: str
    finding_description: str
    objective_evidence: str
    severity: int = 3  # 1-5
    likelihood: int = 3  # 1-5
    auditor_name: str
    audit_date: str

class AuditFindingUpdate(BaseModel):
    audit_type: Optional[str] = None
    clause_reference: Optional[str] = None
    department: Optional[str] = None
    finding_description: Optional[str] = None
    objective_evidence: Optional[str] = None
    risk_rating: Optional[str] = None
    severity: Optional[int] = None
    likelihood: Optional[int] = None
    status: Optional[str] = None
    auditor_name: Optional[str] = None
    audit_date: Optional[str] = None

class RCACreate(BaseModel):
    finding_id: str
    rca_type: str  # 5-why, fishbone, fault-tree
    problem_statement: str
    five_whys: Optional[List[Dict[str, str]]] = None
    fishbone: Optional[Dict[str, List[str]]] = None
    fault_tree: Optional[Dict[str, Any]] = None
    root_cause: str
    contributors: Optional[List[str]] = None

class CAPACreate(BaseModel):
    finding_id: str
    rca_id: Optional[str] = None
    action_type: str  # corrective, preventive
    action_plan: str
    responsible_person: str
    responsible_email: Optional[str] = None
    target_date: str
    resources_required: Optional[str] = None
    verification_method: Optional[str] = None

class CAPAUpdate(BaseModel):
    action_plan: Optional[str] = None
    responsible_person: Optional[str] = None
    responsible_email: Optional[str] = None
    target_date: Optional[str] = None
    status: Optional[str] = None
    completion_date: Optional[str] = None
    effectiveness_verified: Optional[bool] = None
    effectiveness_notes: Optional[str] = None
    approval_status: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None

class EvidenceCreate(BaseModel):
    finding_id: Optional[str] = None
    capa_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    document_type: str  # sop, photo, lab_report, verification_record, other

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_risk_rating(severity: int, likelihood: int) -> str:
    score = severity * likelihood
    if score >= 20:
        return "Critical"
    elif score >= 12:
        return "High"
    elif score >= 6:
        return "Medium"
    return "Low"

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user.email,
        "password": hash_password(user.password),
        "name": user.name,
        "role": user.role,
        "department": user.department,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user.email, user.role)
    user_response = UserResponse(
        id=user_id,
        email=user.email,
        name=user.name,
        role=user.role,
        department=user.department,
        created_at=user_doc["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        department=user.get("department"),
        created_at=user["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== USER MANAGEMENT ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "qa_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    return {"message": "Role updated"}

# ==================== AUDIT FINDINGS ====================

@api_router.post("/findings")
async def create_finding(finding: AuditFindingCreate, current_user: dict = Depends(get_current_user)):
    finding_id = str(uuid.uuid4())
    risk_rating = calculate_risk_rating(finding.severity, finding.likelihood)
    
    finding_doc = {
        "id": finding_id,
        "audit_type": finding.audit_type,
        "clause_reference": finding.clause_reference,
        "department": finding.department,
        "finding_description": finding.finding_description,
        "objective_evidence": finding.objective_evidence,
        "risk_rating": risk_rating,
        "severity": finding.severity,
        "likelihood": finding.likelihood,
        "auditor_name": finding.auditor_name,
        "audit_date": finding.audit_date,
        "status": "Open",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.findings.insert_one(finding_doc)
    finding_doc.pop("_id", None)
    return finding_doc

@api_router.get("/findings")
async def get_findings(
    status: Optional[str] = None,
    department: Optional[str] = None,
    audit_type: Optional[str] = None,
    risk_rating: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if department:
        query["department"] = department
    if audit_type:
        query["audit_type"] = audit_type
    if risk_rating:
        query["risk_rating"] = risk_rating
    
    findings = await db.findings.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return findings

@api_router.get("/findings/{finding_id}")
async def get_finding(finding_id: str, current_user: dict = Depends(get_current_user)):
    finding = await db.findings.find_one({"id": finding_id}, {"_id": 0})
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding

@api_router.put("/findings/{finding_id}")
async def update_finding(finding_id: str, update: AuditFindingUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if "severity" in update_data or "likelihood" in update_data:
        finding = await db.findings.find_one({"id": finding_id})
        severity = update_data.get("severity", finding.get("severity", 3))
        likelihood = update_data.get("likelihood", finding.get("likelihood", 3))
        update_data["risk_rating"] = calculate_risk_rating(severity, likelihood)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.findings.update_one({"id": finding_id}, {"$set": update_data})
    
    updated = await db.findings.find_one({"id": finding_id}, {"_id": 0})
    return updated

@api_router.delete("/findings/{finding_id}")
async def delete_finding(finding_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "qa_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.findings.delete_one({"id": finding_id})
    await db.rcas.delete_many({"finding_id": finding_id})
    await db.capas.delete_many({"finding_id": finding_id})
    return {"message": "Deleted"}

# ==================== RCA ROUTES ====================

@api_router.post("/rca")
async def create_rca(rca: RCACreate, current_user: dict = Depends(get_current_user)):
    rca_id = str(uuid.uuid4())
    rca_doc = {
        "id": rca_id,
        "finding_id": rca.finding_id,
        "rca_type": rca.rca_type,
        "problem_statement": rca.problem_statement,
        "five_whys": rca.five_whys,
        "fishbone": rca.fishbone,
        "fault_tree": rca.fault_tree,
        "root_cause": rca.root_cause,
        "contributors": rca.contributors or [],
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.rcas.insert_one(rca_doc)
    
    # Update finding status
    await db.findings.update_one(
        {"id": rca.finding_id},
        {"$set": {"status": "In Progress", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    rca_doc.pop("_id", None)
    return rca_doc

@api_router.get("/rca")
async def get_rcas(finding_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if finding_id:
        query["finding_id"] = finding_id
    rcas = await db.rcas.find(query, {"_id": 0}).to_list(1000)
    return rcas

@api_router.get("/rca/{rca_id}")
async def get_rca(rca_id: str, current_user: dict = Depends(get_current_user)):
    rca = await db.rcas.find_one({"id": rca_id}, {"_id": 0})
    if not rca:
        raise HTTPException(status_code=404, detail="RCA not found")
    return rca

# ==================== CAPA ROUTES ====================

@api_router.post("/capa")
async def create_capa(capa: CAPACreate, current_user: dict = Depends(get_current_user)):
    capa_id = str(uuid.uuid4())
    capa_doc = {
        "id": capa_id,
        "finding_id": capa.finding_id,
        "rca_id": capa.rca_id,
        "action_type": capa.action_type,
        "action_plan": capa.action_plan,
        "responsible_person": capa.responsible_person,
        "responsible_email": capa.responsible_email,
        "target_date": capa.target_date,
        "resources_required": capa.resources_required,
        "verification_method": capa.verification_method,
        "status": "Pending",
        "completion_date": None,
        "effectiveness_verified": False,
        "effectiveness_notes": None,
        "approval_status": "Pending",
        "approved_by": None,
        "approval_date": None,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.capas.insert_one(capa_doc)
    capa_doc.pop("_id", None)
    return capa_doc

@api_router.get("/capa")
async def get_capas(
    finding_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if finding_id:
        query["finding_id"] = finding_id
    if status:
        query["status"] = status
    capas = await db.capas.find(query, {"_id": 0}).to_list(1000)
    return capas

@api_router.put("/capa/{capa_id}")
async def update_capa(capa_id: str, update: CAPAUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    # Handle approval
    if update_data.get("approval_status") == "Approved":
        update_data["approved_by"] = current_user["name"]
        update_data["approval_date"] = datetime.now(timezone.utc).isoformat()
    
    await db.capas.update_one({"id": capa_id}, {"$set": update_data})
    
    # Check if finding should be closed
    capa = await db.capas.find_one({"id": capa_id}, {"_id": 0})
    if capa and capa.get("status") == "Completed" and capa.get("effectiveness_verified"):
        all_capas = await db.capas.find({"finding_id": capa["finding_id"]}, {"_id": 0}).to_list(100)
        all_complete = all(c.get("status") == "Completed" and c.get("effectiveness_verified") for c in all_capas)
        if all_complete:
            await db.findings.update_one(
                {"id": capa["finding_id"]},
                {"$set": {"status": "Closed", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    return capa

# ==================== EVIDENCE/ATTACHMENTS ====================

@api_router.post("/evidence")
async def upload_evidence(
    file: UploadFile = File(...),
    finding_id: Optional[str] = Form(None),
    capa_id: Optional[str] = Form(None),
    title: str = Form(...),
    description: str = Form(""),
    document_type: str = Form("other"),
    current_user: dict = Depends(get_current_user)
):
    evidence_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{evidence_id}{file_ext}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    evidence_doc = {
        "id": evidence_id,
        "finding_id": finding_id,
        "capa_id": capa_id,
        "title": title,
        "description": description,
        "document_type": document_type,
        "filename": file.filename,
        "file_path": str(file_path),
        "file_size": os.path.getsize(file_path),
        "content_type": file.content_type,
        "uploaded_by": current_user["id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    await db.evidence.insert_one(evidence_doc)
    evidence_doc.pop("_id", None)
    return evidence_doc

@api_router.get("/evidence")
async def get_evidence(
    finding_id: Optional[str] = None,
    capa_id: Optional[str] = None,
    document_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if finding_id:
        query["finding_id"] = finding_id
    if capa_id:
        query["capa_id"] = capa_id
    if document_type:
        query["document_type"] = document_type
    evidence = await db.evidence.find(query, {"_id": 0}).to_list(1000)
    return evidence

@api_router.get("/evidence/{evidence_id}/download")
async def download_evidence(evidence_id: str, current_user: dict = Depends(get_current_user)):
    evidence = await db.evidence.find_one({"id": evidence_id})
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return FileResponse(evidence["file_path"], filename=evidence["filename"])

@api_router.delete("/evidence/{evidence_id}")
async def delete_evidence(evidence_id: str, current_user: dict = Depends(get_current_user)):
    evidence = await db.evidence.find_one({"id": evidence_id})
    if evidence:
        try:
            os.remove(evidence["file_path"])
        except:
            pass
        await db.evidence.delete_one({"id": evidence_id})
    return {"message": "Deleted"}

# ==================== ANALYTICS ====================

@api_router.get("/analytics/dashboard")
async def get_dashboard_analytics(current_user: dict = Depends(get_current_user)):
    # Total findings by status
    findings = await db.findings.find({}, {"_id": 0}).to_list(10000)
    
    total = len(findings)
    by_status = {"Open": 0, "In Progress": 0, "Closed": 0}
    by_risk = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    by_department = {}
    by_audit_type = {}
    by_month = {}
    
    for f in findings:
        by_status[f.get("status", "Open")] = by_status.get(f.get("status", "Open"), 0) + 1
        by_risk[f.get("risk_rating", "Medium")] = by_risk.get(f.get("risk_rating", "Medium"), 0) + 1
        
        dept = f.get("department", "Unknown")
        by_department[dept] = by_department.get(dept, 0) + 1
        
        audit = f.get("audit_type", "Unknown")
        by_audit_type[audit] = by_audit_type.get(audit, 0) + 1
        
        date_str = f.get("audit_date", f.get("created_at", ""))[:7]
        if date_str:
            by_month[date_str] = by_month.get(date_str, 0) + 1
    
    # CAPA stats
    capas = await db.capas.find({}, {"_id": 0}).to_list(10000)
    overdue_capas = 0
    today = datetime.now(timezone.utc).isoformat()[:10]
    for c in capas:
        if c.get("status") != "Completed" and c.get("target_date", "") < today:
            overdue_capas += 1
    
    return {
        "total_findings": total,
        "by_status": by_status,
        "by_risk": by_risk,
        "by_department": [{"name": k, "count": v} for k, v in by_department.items()],
        "by_audit_type": [{"name": k, "count": v} for k, v in by_audit_type.items()],
        "trend_data": [{"month": k, "count": v} for k, v in sorted(by_month.items())],
        "total_capas": len(capas),
        "overdue_capas": overdue_capas,
        "closure_rate": round((by_status.get("Closed", 0) / total * 100) if total > 0 else 0, 1)
    }

@api_router.get("/analytics/compliance")
async def get_compliance_analytics(
    audit_type: Optional[str] = None,
    department: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if audit_type:
        query["audit_type"] = audit_type
    if department:
        query["department"] = department
    
    findings = await db.findings.find(query, {"_id": 0}).to_list(10000)
    
    compliance_by_clause = {}
    for f in findings:
        clause = f.get("clause_reference", "Unknown")
        if clause not in compliance_by_clause:
            compliance_by_clause[clause] = {"total": 0, "closed": 0}
        compliance_by_clause[clause]["total"] += 1
        if f.get("status") == "Closed":
            compliance_by_clause[clause]["closed"] += 1
    
    return {
        "total": len(findings),
        "by_clause": [
            {"clause": k, "total": v["total"], "closed": v["closed"], 
             "rate": round(v["closed"]/v["total"]*100, 1) if v["total"] > 0 else 0}
            for k, v in compliance_by_clause.items()
        ]
    }

# ==================== RISK MATRIX ====================

@api_router.get("/risk-matrix")
async def get_risk_matrix(current_user: dict = Depends(get_current_user)):
    findings = await db.findings.find({}, {"_id": 0, "id": 1, "finding_description": 1, "severity": 1, "likelihood": 1, "risk_rating": 1, "status": 1}).to_list(10000)
    
    matrix = [[[] for _ in range(5)] for _ in range(5)]
    for f in findings:
        sev = f.get("severity", 3) - 1
        lik = f.get("likelihood", 3) - 1
        if 0 <= sev < 5 and 0 <= lik < 5:
            matrix[4-sev][lik].append({
                "id": f["id"],
                "description": f.get("finding_description", "")[:50],
                "risk_rating": f.get("risk_rating"),
                "status": f.get("status")
            })
    
    return {"matrix": matrix}

# ==================== SAMPLE DATA ====================

@api_router.post("/seed-data")
async def seed_sample_data():
    # Check if data exists
    existing = await db.findings.count_documents({})
    if existing > 0:
        return {"message": "Data already exists", "count": existing}
    
    # Create admin user
    admin_exists = await db.users.find_one({"email": "admin@aquaguard.com"})
    if not admin_exists:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id,
            "email": "admin@aquaguard.com",
            "password": hash_password("admin123"),
            "name": "System Administrator",
            "role": "admin",
            "department": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Create sample users
    sample_users = [
        {"email": "qa.manager@aquaguard.com", "name": "Sarah Chen", "role": "qa_manager", "department": "QA"},
        {"email": "production.head@aquaguard.com", "name": "Michael Roberts", "role": "department_head", "department": "Production"},
        {"email": "auditor@aquaguard.com", "name": "James Wilson", "role": "auditor", "department": None},
    ]
    
    for u in sample_users:
        exists = await db.users.find_one({"email": u["email"]})
        if not exists:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": u["email"],
                "password": hash_password("password123"),
                "name": u["name"],
                "role": u["role"],
                "department": u["department"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Sample findings
    sample_findings = [
        {
            "id": str(uuid.uuid4()),
            "audit_type": "FSSC 22000",
            "clause_reference": "ISO 22000:2018 - 8.5.1",
            "department": "Production",
            "finding_description": "Microbiological nonconformity detected in finished product batch PW-2024-0892. E. coli count exceeded acceptable limits (>100 CFU/ml vs limit of <1 CFU/100ml).",
            "objective_evidence": "Lab Report #LR-2024-456, dated 2024-01-15. Product held in quarantine zone.",
            "risk_rating": "Critical",
            "severity": 5,
            "likelihood": 3,
            "auditor_name": "James Wilson",
            "audit_date": "2024-01-15",
            "status": "In Progress",
            "created_by": "system",
            "created_at": "2024-01-15T10:00:00Z",
            "updated_at": "2024-01-16T10:00:00Z"
        },
        {
            "id": str(uuid.uuid4()),
            "audit_type": "FSSC 22000",
            "clause_reference": "ISO 22000:2018 - 8.5.2.3",
            "department": "Production",
            "finding_description": "CCP Deviation: UV treatment system showed 15% reduction in effectiveness during routine monitoring. Critical limit of 40 mJ/cm² not achieved for 2 hours.",
            "objective_evidence": "UV System Log #UV-2024-0115, Maintenance Record #MR-567",
            "risk_rating": "High",
            "severity": 4,
            "likelihood": 3,
            "auditor_name": "Sarah Chen",
            "audit_date": "2024-01-20",
            "status": "Open",
            "created_by": "system",
            "created_at": "2024-01-20T14:30:00Z",
            "updated_at": "2024-01-20T14:30:00Z"
        },
        {
            "id": str(uuid.uuid4()),
            "audit_type": "ISO 9001",
            "clause_reference": "ISO 9001:2015 - 8.5.1",
            "department": "Production",
            "finding_description": "Bottle rinsing validation failure: Residual chlorine levels in rinsed bottles exceeded specifications (5.2 ppm vs max 2 ppm).",
            "objective_evidence": "Validation Report #VR-2024-023, Water Analysis Report #WA-789",
            "risk_rating": "Medium",
            "severity": 3,
            "likelihood": 3,
            "auditor_name": "James Wilson",
            "audit_date": "2024-02-01",
            "status": "Open",
            "created_by": "system",
            "created_at": "2024-02-01T09:15:00Z",
            "updated_at": "2024-02-01T09:15:00Z"
        },
        {
            "id": str(uuid.uuid4()),
            "audit_type": "ISO 14001",
            "clause_reference": "ISO 14001:2015 - 8.1",
            "department": "Utilities",
            "finding_description": "Environmental aspect noncompliance: Wastewater discharge pH levels exceeded permitted limits (pH 9.2 vs max 8.5) on three occasions.",
            "objective_evidence": "Effluent Monitoring Report #EMR-2024-Q1, CPCB Notice #N-2024-112",
            "risk_rating": "High",
            "severity": 4,
            "likelihood": 4,
            "auditor_name": "External Auditor",
            "audit_date": "2024-02-10",
            "status": "Open",
            "created_by": "system",
            "created_at": "2024-02-10T11:00:00Z",
            "updated_at": "2024-02-10T11:00:00Z"
        },
        {
            "id": str(uuid.uuid4()),
            "audit_type": "ISO 45001",
            "clause_reference": "ISO 45001:2018 - 8.1.2",
            "department": "Maintenance",
            "finding_description": "Unsafe maintenance practice: Lockout/Tagout (LOTO) procedure not followed during conveyor belt maintenance. Worker observed performing maintenance without proper isolation.",
            "objective_evidence": "Safety Observation Report #SOR-2024-034, CCTV Footage timestamp 14:32:15",
            "risk_rating": "Critical",
            "severity": 5,
            "likelihood": 4,
            "auditor_name": "Safety Officer",
            "audit_date": "2024-02-15",
            "status": "In Progress",
            "created_by": "system",
            "created_at": "2024-02-15T15:00:00Z",
            "updated_at": "2024-02-16T09:00:00Z"
        },
        {
            "id": str(uuid.uuid4()),
            "audit_type": "ISO 9001",
            "clause_reference": "ISO 9001:2015 - 7.1.5",
            "department": "QA",
            "finding_description": "Calibration overdue for 3 critical measuring instruments: pH meter (2 weeks), Turbidity meter (1 month), Conductivity meter (3 weeks).",
            "objective_evidence": "Calibration Schedule #CS-2024, Equipment Log",
            "risk_rating": "Medium",
            "severity": 3,
            "likelihood": 2,
            "auditor_name": "James Wilson",
            "audit_date": "2024-02-20",
            "status": "Closed",
            "created_by": "system",
            "created_at": "2024-02-20T10:30:00Z",
            "updated_at": "2024-03-01T16:00:00Z"
        },
        {
            "id": str(uuid.uuid4()),
            "audit_type": "FSSC 22000",
            "clause_reference": "ISO 22000:2018 - 7.2",
            "department": "Warehouse",
            "finding_description": "Inadequate pest control measures in raw material storage area. Evidence of rodent activity (droppings) found near packaging material storage.",
            "objective_evidence": "Pest Control Report #PCR-2024-02, Photo Evidence #PE-445",
            "risk_rating": "High",
            "severity": 4,
            "likelihood": 3,
            "auditor_name": "Sarah Chen",
            "audit_date": "2024-02-25",
            "status": "Open",
            "created_by": "system",
            "created_at": "2024-02-25T14:00:00Z",
            "updated_at": "2024-02-25T14:00:00Z"
        },
        {
            "id": str(uuid.uuid4()),
            "audit_type": "ISO 45001",
            "clause_reference": "ISO 45001:2018 - 7.2",
            "department": "HR",
            "finding_description": "Training records incomplete for 12 new employees. Food safety and HACCP awareness training not documented.",
            "objective_evidence": "Training Matrix #TM-2024, HR Records Review",
            "risk_rating": "Low",
            "severity": 2,
            "likelihood": 2,
            "auditor_name": "James Wilson",
            "audit_date": "2024-03-01",
            "status": "Open",
            "created_by": "system",
            "created_at": "2024-03-01T09:00:00Z",
            "updated_at": "2024-03-01T09:00:00Z"
        }
    ]
    
    await db.findings.insert_many(sample_findings)
    
    # Sample RCA for microbiological finding
    finding_id = sample_findings[0]["id"]
    rca_id = str(uuid.uuid4())
    sample_rca = {
        "id": rca_id,
        "finding_id": finding_id,
        "rca_type": "fishbone",
        "problem_statement": "E. coli contamination detected in finished product batch PW-2024-0892",
        "five_whys": [
            {"why": "Why was E. coli detected?", "answer": "Water source contamination"},
            {"why": "Why was water source contaminated?", "answer": "Breakthrough in filtration system"},
            {"why": "Why did filtration fail?", "answer": "Filter replacement delayed"},
            {"why": "Why was replacement delayed?", "answer": "Spare parts not available"},
            {"why": "Why were parts unavailable?", "answer": "Inventory management failure"}
        ],
        "fishbone": {
            "Man": ["Operator training gap", "Shift handover issues"],
            "Machine": ["UV system malfunction", "Filter integrity failure"],
            "Method": ["Monitoring frequency inadequate", "SOP not followed"],
            "Material": ["Raw water quality variation", "Filter media degraded"],
            "Measurement": ["Testing delay", "Sample handling error"],
            "Environment": ["Seasonal contamination spike", "Source water affected"]
        },
        "root_cause": "Primary root cause: Filter replacement schedule not followed due to inventory management failure. Contributing factor: Inadequate monitoring frequency failed to detect early warning signs.",
        "contributors": ["system"],
        "created_by": "system",
        "created_at": "2024-01-16T10:00:00Z"
    }
    await db.rcas.insert_one(sample_rca)
    
    # Sample CAPA
    sample_capa = {
        "id": str(uuid.uuid4()),
        "finding_id": finding_id,
        "rca_id": rca_id,
        "action_type": "corrective",
        "action_plan": "1. Immediate replacement of all filters in affected line. 2. Implement automated filter replacement alerts. 3. Review and update inventory management system for critical spares.",
        "responsible_person": "Michael Roberts",
        "responsible_email": "production.head@aquaguard.com",
        "target_date": "2024-02-15",
        "resources_required": "New filters, Inventory software module, Training materials",
        "verification_method": "Post-implementation water quality testing for 30 days, inventory audit",
        "status": "In Progress",
        "completion_date": None,
        "effectiveness_verified": False,
        "effectiveness_notes": None,
        "approval_status": "Approved",
        "approved_by": "Sarah Chen",
        "approval_date": "2024-01-17T09:00:00Z",
        "created_by": "system",
        "created_at": "2024-01-16T14:00:00Z"
    }
    await db.capas.insert_one(sample_capa)
    
    return {"message": "Sample data created", "findings_count": len(sample_findings)}

# ==================== REPORT GENERATION ====================

@api_router.get("/reports/management-review")
async def generate_management_review(current_user: dict = Depends(get_current_user)):
    findings = await db.findings.find({}, {"_id": 0}).to_list(10000)
    capas = await db.capas.find({}, {"_id": 0}).to_list(10000)
    rcas = await db.rcas.find({}, {"_id": 0}).to_list(10000)
    
    today = datetime.now(timezone.utc).isoformat()[:10]
    overdue = [c for c in capas if c.get("status") != "Completed" and c.get("target_date", "") < today]
    
    by_status = {"Open": 0, "In Progress": 0, "Closed": 0}
    by_risk = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    
    for f in findings:
        by_status[f.get("status", "Open")] = by_status.get(f.get("status", "Open"), 0) + 1
        by_risk[f.get("risk_rating", "Medium")] = by_risk.get(f.get("risk_rating", "Medium"), 0) + 1
    
    return {
        "report_date": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_findings": len(findings),
            "by_status": by_status,
            "by_risk": by_risk,
            "total_capas": len(capas),
            "overdue_capas": len(overdue),
            "closure_rate": round((by_status.get("Closed", 0) / len(findings) * 100) if findings else 0, 1)
        },
        "critical_findings": [f for f in findings if f.get("risk_rating") == "Critical"],
        "overdue_actions": overdue,
        "recent_closures": [f for f in findings if f.get("status") == "Closed"][:5],
        "root_causes": [{"finding_id": r["finding_id"], "root_cause": r["root_cause"]} for r in rcas]
    }

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
