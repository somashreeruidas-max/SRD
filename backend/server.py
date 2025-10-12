from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
import bcrypt
import jwt
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
security = HTTPBearer()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client["iso_audit_db"]
users_collection = db["users"]
questionnaires_collection = db["questionnaires"]
audits_collection = db["audits"]

# JWT Secret
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

# Pydantic Models
class UserRegister(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class QuestionModel(BaseModel):
    id: str
    question_text: str
    order: int

class SubClauseModel(BaseModel):
    clause_no: str
    title: str
    questions: List[QuestionModel]

class ClauseModel(BaseModel):
    clause_no: str
    title: str
    subclauses: List[SubClauseModel]

class QuestionnaireCreate(BaseModel):
    name: str
    description: Optional[str] = None
    clauses: List[ClauseModel]

class QuestionnaireUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    clauses: Optional[List[ClauseModel]] = None

class EvidenceModel(BaseModel):
    type: str  # photo, document, audio, video
    filename: str
    data: str  # base64
    timestamp: str

class ResponseModel(BaseModel):
    question_id: str
    clause_no: str
    observations: Optional[str] = None
    conformance: Optional[str] = None  # M, Mi, C
    evidence: List[EvidenceModel] = []

class AuditCreate(BaseModel):
    questionnaire_id: str
    title: str
    description: Optional[str] = None

class AuditUpdate(BaseModel):
    status: Optional[str] = None  # draft, in-progress, completed
    responses: Optional[List[ResponseModel]] = None

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Initialize default questionnaire
def init_default_questionnaire():
    if questionnaires_collection.count_documents({"name": "ISO 45001:2018"}) == 0:
        default_questionnaire = {
            "name": "ISO 45001:2018",
            "description": "Occupational Health and Safety Management Systems - Internal Audit Questionnaire for Packaged Drinking Water Plant",
            "created_at": datetime.utcnow().isoformat(),
            "is_default": True,
            "clauses": [
                {
                    "clause_no": "4",
                    "title": "Context of the Organisation",
                    "subclauses": [
                        {
                            "clause_no": "4.1",
                            "title": "Understanding the organisation and its context",
                            "questions": [
                                {
                                    "id": "q_4_1_1",
                                    "question_text": "Has the plant identified internal and external issues affecting OHS performance, such as machine hazards, chemical exposure, and confined space entry?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "4.2",
                            "title": "Understanding the needs and expectations of workers and interested parties",
                            "questions": [
                                {
                                    "id": "q_4_2_1",
                                    "question_text": "Are the needs of employees, contractors, legal authorities, and customers identified and considered in OHS planning?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "4.3",
                            "title": "Determining the scope of the OH&S management system",
                            "questions": [
                                {
                                    "id": "q_4_3_1",
                                    "question_text": "Is the scope of OHSMS clearly defined to include production, utilities, lab, WTP, and maintenance areas?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "4.4",
                            "title": "OH&S management system",
                            "questions": [
                                {
                                    "id": "q_4_4_1",
                                    "question_text": "Are OHSMS processes established, implemented, and maintained across all plant operations?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                },
                {
                    "clause_no": "5",
                    "title": "Leadership and Worker Participation",
                    "subclauses": [
                        {
                            "clause_no": "5.1",
                            "title": "Leadership and commitment",
                            "questions": [
                                {
                                    "id": "q_5_1_1",
                                    "question_text": "Does top management demonstrate leadership in promoting a safe work culture and providing necessary resources?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "5.2",
                            "title": "OH&S policy",
                            "questions": [
                                {
                                    "id": "q_5_2_1",
                                    "question_text": "Is there a documented OH&S policy in place, communicated to all levels, that focuses on zero accidents and legal compliance?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "5.3",
                            "title": "Organisational roles, responsibilities, and authorities",
                            "questions": [
                                {
                                    "id": "q_5_3_1",
                                    "question_text": "Are the roles of safety officers, first-aiders, and fire wardens clearly defined and communicated?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "5.4",
                            "title": "Consultation and participation of workers",
                            "questions": [
                                {
                                    "id": "q_5_4_1",
                                    "question_text": "Are employees involved in safety committees and hazard identification programs?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                },
                {
                    "clause_no": "6",
                    "title": "Planning",
                    "subclauses": [
                        {
                            "clause_no": "6.1.1",
                            "title": "General",
                            "questions": [
                                {
                                    "id": "q_6_1_1_1",
                                    "question_text": "Has the plant identified risks (e.g., chemical handling, slips) and opportunities (e.g., automation, PPE improvement)?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "6.1.2.1",
                            "title": "Hazard identification",
                            "questions": [
                                {
                                    "id": "q_6_1_2_1_1",
                                    "question_text": "Are hazards identified for all operations — e.g., RO plant, bottle blowing, filling, and chemical dosing?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "6.1.2.2",
                            "title": "Assessment of OH&S risks and other risks",
                            "questions": [
                                {
                                    "id": "q_6_1_2_2_1",
                                    "question_text": "Are all identified hazards evaluated for risk level and control measures?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "6.1.2.3",
                            "title": "Assessment of OH&S opportunities",
                            "questions": [
                                {
                                    "id": "q_6_1_2_3_1",
                                    "question_text": "Are opportunities for reducing risk (e.g., ergonomic improvements, automation) identified and implemented?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "6.1.3",
                            "title": "Determination of legal and other requirements",
                            "questions": [
                                {
                                    "id": "q_6_1_3_1",
                                    "question_text": "Are legal requirements like the Factory Act, Fire NOC, and OHS license updated and maintained?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "6.1.4",
                            "title": "Planning actions",
                            "questions": [
                                {
                                    "id": "q_6_1_4_1",
                                    "question_text": "Are risk mitigation plans documented with responsible persons and timelines?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "6.2.1",
                            "title": "OH&S objectives and planning to achieve them",
                            "questions": [
                                {
                                    "id": "q_6_2_1_1",
                                    "question_text": "Are measurable objectives set (e.g., zero lost-time accidents, 100% PPE compliance)?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "6.2.2",
                            "title": "Planning actions to achieve objectives",
                            "questions": [
                                {
                                    "id": "q_6_2_2_1",
                                    "question_text": "Are resources, responsibilities, and monitoring methods defined for OHS objectives?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                },
                {
                    "clause_no": "7",
                    "title": "Support",
                    "subclauses": [
                        {
                            "clause_no": "7.1",
                            "title": "Resources",
                            "questions": [
                                {
                                    "id": "q_7_1_1",
                                    "question_text": "Are adequate safety resources (PPE, first aid kits, fire extinguishers) provided and maintained?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "7.2",
                            "title": "Competence",
                            "questions": [
                                {
                                    "id": "q_7_2_1",
                                    "question_text": "Are workers trained in first aid, fire safety, chemical handling, and lockout/tagout procedures?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "7.3",
                            "title": "Awareness",
                            "questions": [
                                {
                                    "id": "q_7_3_1",
                                    "question_text": "Are employees aware of OHS policy, emergency routes, and reporting procedures?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "7.4",
                            "title": "Communication",
                            "questions": [
                                {
                                    "id": "q_7_4_1",
                                    "question_text": "Is there effective communication for safety alerts, incidents, and toolbox talks?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "7.5.1",
                            "title": "General",
                            "questions": [
                                {
                                    "id": "q_7_5_1_1",
                                    "question_text": "Are OHS documents (SOPs, MSDS, permits) properly maintained and controlled?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                },
                {
                    "clause_no": "8",
                    "title": "Operation",
                    "subclauses": [
                        {
                            "clause_no": "8.1.1",
                            "title": "Operational planning and control",
                            "questions": [
                                {
                                    "id": "q_8_1_1_1",
                                    "question_text": "Are safe work procedures implemented for operations like CIP, filler cleaning, and RO maintenance?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "8.1.2",
                            "title": "Management of change",
                            "questions": [
                                {
                                    "id": "q_8_1_2_1",
                                    "question_text": "Are new installations or process changes reviewed for potential safety risks?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "8.1.3",
                            "title": "Outsourcing",
                            "questions": [
                                {
                                    "id": "q_8_1_3_1",
                                    "question_text": "Are contractor activities (e.g., cylinder refilling, electrical maintenance) controlled under OHSMS?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "8.2",
                            "title": "Emergency preparedness and response",
                            "questions": [
                                {
                                    "id": "q_8_2_1",
                                    "question_text": "Are emergency response plans in place for fire, chlorine leak, or electrical failure, and are drills conducted regularly?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                },
                {
                    "clause_no": "9",
                    "title": "Performance Evaluation",
                    "subclauses": [
                        {
                            "clause_no": "9.1.1",
                            "title": "Monitoring, measurement, analysis and evaluation",
                            "questions": [
                                {
                                    "id": "q_9_1_1_1",
                                    "question_text": "Are incidents, near misses, and unsafe conditions tracked and analysed for trends?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "9.1.2",
                            "title": "Evaluation of compliance",
                            "questions": [
                                {
                                    "id": "q_9_1_2_1",
                                    "question_text": "Are legal and regulatory requirements reviewed periodically for compliance?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "9.2",
                            "title": "Internal audit",
                            "questions": [
                                {
                                    "id": "q_9_2_1",
                                    "question_text": "Are OHS internal audits conducted as per plan, and findings closed timely manner?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "9.3",
                            "title": "Management review",
                            "questions": [
                                {
                                    "id": "q_9_3_1",
                                    "question_text": "Does management review OHS performance, accident data, and objectives periodically?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                },
                {
                    "clause_no": "10",
                    "title": "Improvement",
                    "subclauses": [
                        {
                            "clause_no": "10.1",
                            "title": "Incident, nonconformity and corrective action",
                            "questions": [
                                {
                                    "id": "q_10_1_1",
                                    "question_text": "Are incidents investigated, root causes identified, and corrective actions implemented?",
                                    "order": 1
                                }
                            ]
                        },
                        {
                            "clause_no": "10.2",
                            "title": "Continual improvement",
                            "questions": [
                                {
                                    "id": "q_10_2_1",
                                    "question_text": "Are actions taken to improve safety culture, reduce risks, and enhance worker welfare?",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        questionnaires_collection.insert_one(default_questionnaire)
        print("Default ISO 45001:2018 questionnaire initialized")

# Auth Endpoints
@app.post("/api/auth/register")
async def register(user: UserRegister):
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_pw = hash_password(user.password)
    user_doc = {
        "username": user.username,
        "password": hashed_pw,
        "full_name": user.full_name or user.username,
        "created_at": datetime.utcnow().isoformat()
    }
    result = users_collection.insert_one(user_doc)
    token = create_token(user.username)
    
    return {
        "message": "User registered successfully",
        "token": token,
        "user": {
            "id": str(result.inserted_id),
            "username": user.username,
            "full_name": user_doc["full_name"]
        }
    }

@app.post("/api/auth/login")
async def login(user: UserLogin):
    user_doc = users_collection.find_one({"username": user.username})
    if not user_doc or not verify_password(user.password, user_doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user.username)
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": str(user_doc["_id"]),
            "username": user_doc["username"],
            "full_name": user_doc.get("full_name", user_doc["username"])
        }
    }

@app.get("/api/auth/me")
async def get_current_user(username: str = Depends(verify_token)):
    user_doc = users_collection.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user_doc["_id"]),
        "username": user_doc["username"],
        "full_name": user_doc.get("full_name", user_doc["username"])
    }

# Questionnaire Endpoints
@app.get("/api/questionnaires")
async def get_questionnaires(username: str = Depends(verify_token)):
    questionnaires = list(questionnaires_collection.find())
    for q in questionnaires:
        q["id"] = str(q["_id"])
        del q["_id"]
    return {"questionnaires": questionnaires}

@app.get("/api/questionnaires/{questionnaire_id}")
async def get_questionnaire(questionnaire_id: str, username: str = Depends(verify_token)):
    questionnaire = questionnaires_collection.find_one({"_id": ObjectId(questionnaire_id)})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    questionnaire["id"] = str(questionnaire["_id"])
    del questionnaire["_id"]
    return questionnaire

@app.post("/api/questionnaires")
async def create_questionnaire(questionnaire: QuestionnaireCreate, username: str = Depends(verify_token)):
    questionnaire_doc = questionnaire.dict()
    questionnaire_doc["created_by"] = username
    questionnaire_doc["created_at"] = datetime.utcnow().isoformat()
    questionnaire_doc["is_default"] = False
    result = questionnaires_collection.insert_one(questionnaire_doc)
    return {"message": "Questionnaire created", "id": str(result.inserted_id)}

@app.put("/api/questionnaires/{questionnaire_id}")
async def update_questionnaire(
    questionnaire_id: str,
    questionnaire: QuestionnaireUpdate,
    username: str = Depends(verify_token)
):
    update_data = {k: v for k, v in questionnaire.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    result = questionnaires_collection.update_one(
        {"_id": ObjectId(questionnaire_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    return {"message": "Questionnaire updated successfully"}

@app.delete("/api/questionnaires/{questionnaire_id}")
async def delete_questionnaire(questionnaire_id: str, username: str = Depends(verify_token)):
    # Check if it's the default questionnaire
    questionnaire = questionnaires_collection.find_one({"_id": ObjectId(questionnaire_id)})
    if questionnaire and questionnaire.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete default questionnaire")
    
    result = questionnaires_collection.delete_one({"_id": ObjectId(questionnaire_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    return {"message": "Questionnaire deleted successfully"}

# Audit Endpoints
@app.get("/api/audits")
async def get_audits(username: str = Depends(verify_token)):
    audits = list(audits_collection.find({"auditor": username}).sort("created_at", -1))
    for audit in audits:
        audit["id"] = str(audit["_id"])
        del audit["_id"]
    return {"audits": audits}

@app.get("/api/audits/{audit_id}")
async def get_audit(audit_id: str, username: str = Depends(verify_token)):
    audit = audits_collection.find_one({"_id": ObjectId(audit_id), "auditor": username})
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    audit["id"] = str(audit["_id"])
    del audit["_id"]
    return audit

@app.post("/api/audits")
async def create_audit(audit: AuditCreate, username: str = Depends(verify_token)):
    # Verify questionnaire exists
    questionnaire = questionnaires_collection.find_one({"_id": ObjectId(audit.questionnaire_id)})
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    audit_doc = {
        "questionnaire_id": audit.questionnaire_id,
        "questionnaire_name": questionnaire["name"],
        "title": audit.title,
        "description": audit.description,
        "auditor": username,
        "status": "draft",
        "responses": [],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    result = audits_collection.insert_one(audit_doc)
    return {"message": "Audit created", "id": str(result.inserted_id)}

@app.put("/api/audits/{audit_id}")
async def update_audit(
    audit_id: str,
    audit: AuditUpdate,
    username: str = Depends(verify_token)
):
    update_data = {k: v for k, v in audit.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    result = audits_collection.update_one(
        {"_id": ObjectId(audit_id), "auditor": username},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    return {"message": "Audit updated successfully"}

@app.delete("/api/audits/{audit_id}")
async def delete_audit(audit_id: str, username: str = Depends(verify_token)):
    result = audits_collection.delete_one({"_id": ObjectId(audit_id), "auditor": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    return {"message": "Audit deleted successfully"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# Initialize default data on startup
@app.on_event("startup")
async def startup_event():
    init_default_questionnaire()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
