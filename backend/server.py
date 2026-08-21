from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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
audit_plans_collection = db["audit_plans"]
capa_reports_collection = db["capa_reports"]
organizations_collection = db["organizations"]

# JWT Secret
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

# Pydantic Models
class UserRegister(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    qualifications: Optional[str] = None  # Educational qualifications
    certifications: Optional[str] = None  # Relevant certifications
    years_of_experience: Optional[int] = None  # Years in auditing

class UserLogin(BaseModel):
    username: str
    password: str

class ProfilePictureUpdate(BaseModel):
    profile_picture: Optional[str] = None  # base64 image data or None to delete

class QualificationsUpdate(BaseModel):
    qualifications: Optional[str] = None
    certifications: Optional[str] = None
    years_of_experience: Optional[str] = None

class AdminCreateUser(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    qualifications: Optional[str] = None
    certifications: Optional[str] = None
    years_of_experience: Optional[int] = None
    is_admin: bool = False

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
    audit_id: Optional[str] = None  # Custom audit identifier
    description: Optional[str] = None
    plant_name: Optional[str] = None
    auditor_name: Optional[str] = None
    auditee_name: Optional[str] = None
    audit_scope: Optional[str] = None
    audit_criteria: Optional[str] = None

class AuditUpdate(BaseModel):
    status: Optional[str] = None  # draft, in-progress, completed
    responses: Optional[List[ResponseModel]] = None

class AuditModel(BaseModel):
    title: str
    questionnaire_id: str
    questionnaire_name: str
    description: Optional[str] = None
    status: str = "draft"  # draft, in-progress, completed
    auditor: str
    created_at: str
    responses: Optional[List[ResponseModel]] = []
    plant_name: Optional[str] = None
    auditor_name: Optional[str] = None
    auditee_name: Optional[str] = None
    scope_of_audit: Optional[str] = None
    audit_criteria: Optional[str] = None
    capa_report_file: Optional[str] = None  # base64 file data
    capa_report_filename: Optional[str] = None

class ClosureEvidence(BaseModel):
    type: str  # photo, document
    filename: str
    data: str  # base64
    timestamp: str

class CAPAModel(BaseModel):
    audit_id: str
    audit_title: str
    site_name: Optional[str] = None
    audit_date: str
    auditor_name: Optional[str] = None
    finding_description: str
    standard_clause: str
    category: str  # Minor NC, Major NC
    correction: Optional[str] = None
    root_cause_analysis: Optional[str] = None
    status: str = "Open"  # Open, In Progress, Closed
    closure_evidence: Optional[List[ClosureEvidence]] = None
    created_by: str
    created_at: str
    updated_at: Optional[str] = None

class CAPAUpdate(BaseModel):
    correction: Optional[str] = None
    root_cause_analysis: Optional[str] = None
    status: Optional[str] = None
    closure_evidence: Optional[List[ClosureEvidence]] = None

class CAPAEntry(BaseModel):
    question_id: str
    standard_clause: Optional[str] = None
    category: Optional[str] = None  # Major NC, Minor NC
    finding_description: Optional[str] = None
    question_text: Optional[str] = None
    correction: Optional[str] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    responsible_person: Optional[str] = None
    target_date: Optional[str] = None
    status: str = "Open"  # Open, In Progress, Closed
    closure_evidence: List[EvidenceModel] = []

class CAPAEntriesPayload(BaseModel):
    entries: List[CAPAEntry]

class PDFRequest(BaseModel):
    html: str
    filename: Optional[str] = "report"

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

def verify_admin(username: str = Depends(verify_token)) -> str:
    """Verify that the user is an admin"""
    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return username

# Initialize default admin account
def init_default_admin():
    """Create default admin account if it doesn't exist"""
    if users_collection.count_documents({"username": "SRD"}) == 0:
        admin_user = {
            "username": "SRD",
            "password": hash_password("7550"),
            "full_name": "Admin",
            "is_admin": True,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat()
        }
        users_collection.insert_one(admin_user)
        print("Default admin account created: SRD")

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
    
    # Initialize ISO 9001:2015 (QMS)
    if questionnaires_collection.count_documents({"name": "ISO 9001:2015"}) == 0:
        qms_questionnaire = {
            "name": "ISO 9001:2015",
            "description": "Quality Management System - Internal Audit Questionnaire for Packaged Drinking Water Plant",
            "created_at": datetime.utcnow().isoformat(),
            "is_default": True,
            "clauses": [
                {"clause_no": "4", "title": "Context of the Organization", "subclauses": [
                    {"clause_no": "4.1", "title": "Understanding the organization and its context", "questions": [{"id": "q_qms_4_1_1", "question_text": "Are internal and external issues relevant to the organization's purpose and affecting QMS identified and reviewed?", "order": 1}]},
                    {"clause_no": "4.2", "title": "Understanding the needs and expectations of interested parties", "questions": [{"id": "q_qms_4_2_1", "question_text": "Are interested parties (BIS, FSSAI, customers, employees, vendors) and their requirements identified?", "order": 1}]},
                    {"clause_no": "4.3", "title": "Determining the scope of the QMS", "questions": [{"id": "q_qms_4_3_1", "question_text": "Is the scope of the QMS defined including products and services covered and made available as documented information?", "order": 1}]},
                    {"clause_no": "4.4", "title": "Quality management system and its processes", "questions": [{"id": "q_qms_4_4_1", "question_text": "Are processes needed for QMS identified with their inputs, outputs, interactions, sequence and operation?", "order": 1}]}
                ]},
                {"clause_no": "5", "title": "Leadership", "subclauses": [
                    {"clause_no": "5.1", "title": "Leadership and commitment", "questions": [{"id": "q_qms_5_1_1", "question_text": "Does top management demonstrate leadership and accountability for QMS effectiveness?", "order": 1}]},
                    {"clause_no": "5.2", "title": "Quality Policy", "questions": [{"id": "q_qms_5_2_1", "question_text": "Is quality policy established, implemented, and providing framework for quality objectives?", "order": 1}]},
                    {"clause_no": "5.3", "title": "Organizational roles, responsibilities and authorities", "questions": [{"id": "q_qms_5_3_1", "question_text": "Are relevant roles, responsibilities and authorities for quality management defined and communicated?", "order": 1}]}
                ]},
                {"clause_no": "6", "title": "Planning", "subclauses": [
                    {"clause_no": "6.1", "title": "Actions to address risks and opportunities", "questions": [{"id": "q_qms_6_1_1", "question_text": "Are risks and opportunities related to QMS and achievement of intended results determined and addressed?", "order": 1}]},
                    {"clause_no": "6.2", "title": "Quality objectives and planning to achieve them", "questions": [{"id": "q_qms_6_2_1", "question_text": "Are quality objectives established, measurable, monitored, communicated and updated?", "order": 1}]},
                    {"clause_no": "6.3", "title": "Planning of changes", "questions": [{"id": "q_qms_6_3_1", "question_text": "Is planning of changes to QMS carried out in a planned manner considering purpose, consequences and integrity?", "order": 1}]}
                ]},
                {"clause_no": "7", "title": "Support", "subclauses": [
                    {"clause_no": "7.1", "title": "Resources", "questions": [{"id": "q_qms_7_1_1", "question_text": "Are resources (people, infrastructure, environment, monitoring equipment) provided for QMS?", "order": 1}]},
                    {"clause_no": "7.2", "title": "Competence", "questions": [{"id": "q_qms_7_2_1", "question_text": "Is competence determined for persons affecting QMS performance with appropriate education and training?", "order": 1}]},
                    {"clause_no": "7.3", "title": "Awareness", "questions": [{"id": "q_qms_7_3_1", "question_text": "Are persons aware of quality policy, objectives, their contribution and implications of nonconformity?", "order": 1}]},
                    {"clause_no": "7.4", "title": "Communication", "questions": [{"id": "q_qms_7_4_1", "question_text": "Are internal and external communications relevant to QMS determined and implemented?", "order": 1}]},
                    {"clause_no": "7.5", "title": "Documented information", "questions": [{"id": "q_qms_7_5_1", "question_text": "Is documented information required by ISO 9001 and organization created, updated and controlled?", "order": 1}]}
                ]},
                {"clause_no": "8", "title": "Operation", "subclauses": [
                    {"clause_no": "8.1", "title": "Operational planning and control", "questions": [{"id": "q_qms_8_1_1", "question_text": "Are operational processes planned, implemented and controlled to meet product/service requirements?", "order": 1}]},
                    {"clause_no": "8.2", "title": "Requirements for products and services", "questions": [{"id": "q_qms_8_2_1", "question_text": "Are customer requirements, statutory/regulatory requirements determined and reviewed before commitment?", "order": 1}]},
                    {"clause_no": "8.3", "title": "Design and development", "questions": [{"id": "q_qms_8_3_1", "question_text": "Is design and development process established with inputs, outputs, reviews, verification and validation?", "order": 1}]},
                    {"clause_no": "8.4", "title": "Control of externally provided processes, products and services", "questions": [{"id": "q_qms_8_4_1", "question_text": "Are externally provided processes, products and services controlled with supplier evaluation and monitoring?", "order": 1}]},
                    {"clause_no": "8.5", "title": "Production and service provision", "questions": [{"id": "q_qms_8_5_1", "question_text": "Is production carried out under controlled conditions with documented information, monitoring and competent personnel?", "order": 1}]},
                    {"clause_no": "8.6", "title": "Release of products and services", "questions": [{"id": "q_qms_8_6_1", "question_text": "Are planned arrangements made to verify requirements are met before release to customer?", "order": 1}]},
                    {"clause_no": "8.7", "title": "Control of nonconforming outputs", "questions": [{"id": "q_qms_8_7_1", "question_text": "Are nonconforming outputs identified, controlled and corrected to prevent unintended use?", "order": 1}]}
                ]},
                {"clause_no": "9", "title": "Performance Evaluation", "subclauses": [
                    {"clause_no": "9.1", "title": "Monitoring, measurement, analysis and evaluation", "questions": [{"id": "q_qms_9_1_1", "question_text": "Are monitoring, measurement, analysis methods determined to ensure valid results and customer satisfaction monitored?", "order": 1}]},
                    {"clause_no": "9.2", "title": "Internal audit", "questions": [{"id": "q_qms_9_2_1", "question_text": "Are internal audits conducted at planned intervals to determine QMS conformity and effectiveness?", "order": 1}]},
                    {"clause_no": "9.3", "title": "Management review", "questions": [{"id": "q_qms_9_3_1", "question_text": "Does top management review QMS at planned intervals for suitability, adequacy and effectiveness?", "order": 1}]}
                ]},
                {"clause_no": "10", "title": "Improvement", "subclauses": [
                    {"clause_no": "10.1", "title": "General", "questions": [{"id": "q_qms_10_1_1", "question_text": "Are opportunities for improvement determined and implemented to meet customer requirements?", "order": 1}]},
                    {"clause_no": "10.2", "title": "Nonconformity and corrective action", "questions": [{"id": "q_qms_10_2_1", "question_text": "Are nonconformities reacted to, corrected, root causes evaluated and corrective actions implemented?", "order": 1}]},
                    {"clause_no": "10.3", "title": "Continual improvement", "questions": [{"id": "q_qms_10_3_1", "question_text": "Does organization continually improve suitability, adequacy and effectiveness of QMS?", "order": 1}]}
                ]}
            ]
        }
        questionnaires_collection.insert_one(qms_questionnaire)
        print("Default ISO 9001:2015 questionnaire initialized")
    
    # Initialize ISO 14001:2015 (EMS)
    if questionnaires_collection.count_documents({"name": "ISO 14001:2015"}) == 0:
        ems_questionnaire = {
            "name": "ISO 14001:2015",
            "description": "Environmental Management System - Internal Audit Questionnaire for Packaged Drinking Water Plant",
            "created_at": datetime.utcnow().isoformat(),
            "is_default": True,
            "clauses": [
                {"clause_no": "4", "title": "Context of the Organization", "subclauses": [
                    {"clause_no": "4.1", "title": "Understanding the organization and its context", "questions": [{"id": "q_ems_4_1_1", "question_text": "Are internal and external environmental issues (water source, waste disposal, regulations) identified and reviewed?", "order": 1}]},
                    {"clause_no": "4.2", "title": "Understanding the needs and expectations of interested parties", "questions": [{"id": "q_ems_4_2_1", "question_text": "Are interested parties (PCB, BIS, community, vendors) and their environmental expectations identified?", "order": 1}]},
                    {"clause_no": "4.3", "title": "Determining the scope of the EMS", "questions": [{"id": "q_ems_4_3_1", "question_text": "Is the scope of EMS defined and documented (production of packaged drinking water and utilities)?", "order": 1}]},
                    {"clause_no": "4.4", "title": "Environmental management system", "questions": [{"id": "q_ems_4_4_1", "question_text": "Are all environmental aspects (effluent, emissions, waste, energy) covered in EMS processes?", "order": 1}]}
                ]},
                {"clause_no": "5", "title": "Leadership", "subclauses": [
                    {"clause_no": "5.1", "title": "Leadership and commitment", "questions": [{"id": "q_ems_5_1_1", "question_text": "Does top management demonstrate commitment to environmental protection, compliance and continual improvement?", "order": 1}]},
                    {"clause_no": "5.2", "title": "Environmental policy", "questions": [{"id": "q_ems_5_2_1", "question_text": "Is there an environmental policy committing to pollution prevention, compliance and continual improvement?", "order": 1}]},
                    {"clause_no": "5.3", "title": "Organizational roles, responsibilities and authorities", "questions": [{"id": "q_ems_5_3_1", "question_text": "Are EMS roles and responsibilities (Environmental Coordinator, STP Operator) defined and communicated?", "order": 1}]}
                ]},
                {"clause_no": "6", "title": "Planning", "subclauses": [
                    {"clause_no": "6.1.1", "title": "General", "questions": [{"id": "q_ems_6_1_1_1", "question_text": "Are environmental aspects, impacts and compliance obligations identified and reviewed?", "order": 1}]},
                    {"clause_no": "6.1.2", "title": "Environmental aspects", "questions": [{"id": "q_ems_6_1_2_1", "question_text": "Are significant aspects (water consumption, RO reject, chemical use, energy, solid waste) evaluated with controls?", "order": 1}]},
                    {"clause_no": "6.1.3", "title": "Compliance obligations", "questions": [{"id": "q_ems_6_1_3_1", "question_text": "Are all legal requirements (PCB, CPCB, waste disposal) identified, updated and complied with?", "order": 1}]},
                    {"clause_no": "6.1.4", "title": "Planning actions", "questions": [{"id": "q_ems_6_1_4_1", "question_text": "Are action plans established to address environmental risks, opportunities and compliance?", "order": 1}]},
                    {"clause_no": "6.2", "title": "Environmental objectives and planning", "questions": [{"id": "q_ems_6_2_1", "question_text": "Are environmental objectives (reduce RO reject by 10%) defined, measurable and reviewed for progress?", "order": 1}]},
                    {"clause_no": "6.3", "title": "Planning of changes", "questions": [{"id": "q_ems_6_3_1", "question_text": "Are environmental aspects considered while planning process or layout changes?", "order": 1}]}
                ]},
                {"clause_no": "7", "title": "Support", "subclauses": [
                    {"clause_no": "7.1", "title": "Resources", "questions": [{"id": "q_ems_7_1_1", "question_text": "Are sufficient resources available for EMS operation (STP equipment, waste bins, monitoring instruments)?", "order": 1}]},
                    {"clause_no": "7.2", "title": "Competence", "questions": [{"id": "q_ems_7_2_1", "question_text": "Are personnel handling chemicals or waste trained and competent?", "order": 1}]},
                    {"clause_no": "7.3", "title": "Awareness", "questions": [{"id": "q_ems_7_3_1", "question_text": "Are employees aware of environmental policy, aspects and emergency response procedures?", "order": 1}]},
                    {"clause_no": "7.4", "title": "Communication", "questions": [{"id": "q_ems_7_4_1", "question_text": "Is communication with external stakeholders (PCB) documented and tracked?", "order": 1}]},
                    {"clause_no": "7.5", "title": "Documented information", "questions": [{"id": "q_ems_7_5_1", "question_text": "Are EMS documents and records (consent to operate, waste manifests, test reports) controlled?", "order": 1}]}
                ]},
                {"clause_no": "8", "title": "Operation", "subclauses": [
                    {"clause_no": "8.1", "title": "Operational planning and control", "questions": [{"id": "q_ems_8_1_1", "question_text": "Are operational controls implemented for significant aspects (effluent, RO reject, solid waste, energy)?", "order": 1}]},
                    {"clause_no": "8.2", "title": "Emergency preparedness and response", "questions": [{"id": "q_ems_8_2_1", "question_text": "Is there emergency preparedness plan for chemical spills, chlorine leaks or fire with mock drills conducted?", "order": 1}]}
                ]},
                {"clause_no": "9", "title": "Performance Evaluation", "subclauses": [
                    {"clause_no": "9.1", "title": "Monitoring, measurement, analysis and evaluation", "questions": [{"id": "q_ems_9_1_1", "question_text": "Are environmental monitoring (effluent quality, noise, air, water consumption) carried out as per plan?", "order": 1}]},
                    {"clause_no": "9.1.2", "title": "Evaluation of compliance", "questions": [{"id": "q_ems_9_1_2_1", "question_text": "Are compliance evaluations against legal requirements conducted periodically?", "order": 1}]},
                    {"clause_no": "9.2", "title": "Internal audit", "questions": [{"id": "q_ems_9_2_1", "question_text": "Is EMS internal audit conducted as per schedule and nonconformities tracked for closure?", "order": 1}]},
                    {"clause_no": "9.3", "title": "Management review", "questions": [{"id": "q_ems_9_3_1", "question_text": "Does management review cover environmental objectives, incidents, compliance and resource needs?", "order": 1}]}
                ]},
                {"clause_no": "10", "title": "Improvement", "subclauses": [
                    {"clause_no": "10.1", "title": "General", "questions": [{"id": "q_ems_10_1_1", "question_text": "Are opportunities for environmental improvement identified and acted upon?", "order": 1}]},
                    {"clause_no": "10.2", "title": "Nonconformity and corrective action", "questions": [{"id": "q_ems_10_2_1", "question_text": "Are environmental nonconformities (STP overflow, spillage) recorded and corrected with CAPA?", "order": 1}]},
                    {"clause_no": "10.3", "title": "Continual improvement", "questions": [{"id": "q_ems_10_3_1", "question_text": "What environmental improvements have been implemented (reuse reject water, LED lighting, optimized CIP water)?", "order": 1}]}
                ]}
            ]
        }
        questionnaires_collection.insert_one(ems_questionnaire)
        print("Default ISO 14001:2015 questionnaire initialized")
    
    # Initialize FSSC 22000 V6.0
    if questionnaires_collection.count_documents({"name": "FSSC 22000 V6.0"}) == 0:
        fssc_questionnaire = {
            "name": "FSSC 22000 V6.0",
            "description": "Food Safety System Certification 22000 Version 6.0 - Audit Questionnaire for Packaged Drinking Water Plant",
            "created_at": datetime.utcnow().isoformat(),
            "is_default": True,
            "clauses": [
                {
                    "clause_no": "ISO 22000:2018",
                    "title": "Food Safety Management System",
                    "subclauses": [
                        {"clause_no": "4.1", "title": "Understanding the organization and its context", "questions": [{"id": "q_fssc_4_1_1", "question_text": "Has the organization identified internal and external issues affecting FSMS (e.g., raw water variability, supplier reliability)?", "order": 1}]},
                        {"clause_no": "4.2", "title": "Understanding interested parties", "questions": [{"id": "q_fssc_4_2_1", "question_text": "Have interested parties (e.g., BIS, FSSAI, customers) and their requirements been defined?", "order": 1}]},
                        {"clause_no": "4.3", "title": "Scope of the food safety management system", "questions": [{"id": "q_fssc_4_3_1", "question_text": "Is the scope of FSMS documented including production of packaged drinking water (20L jars, 1L bottles)?", "order": 1}]},
                        {"clause_no": "4.4", "title": "Food safety management system", "questions": [{"id": "q_fssc_4_4_1", "question_text": "Is the FSMS established, implemented, and continually improved?", "order": 1}]},
                        {"clause_no": "5.1", "title": "Leadership and commitment", "questions": [{"id": "q_fssc_5_1_1", "question_text": "Does top management demonstrate commitment to food safety (attending reviews, providing resources)?", "order": 1}]},
                        {"clause_no": "5.2", "title": "Food safety policy", "questions": [{"id": "q_fssc_5_2_1", "question_text": "Is the Food Safety Policy communicated and understood at all levels?", "order": 1}]},
                        {"clause_no": "5.3", "title": "Organizational roles, responsibilities and authorities", "questions": [{"id": "q_fssc_5_3_1", "question_text": "Are food safety responsibilities assigned to trained personnel (QA, production, maintenance)?", "order": 1}]},
                        {"clause_no": "6.1", "title": "Actions to address risks and opportunities", "questions": [{"id": "q_fssc_6_1_1", "question_text": "Have risks and opportunities been identified for each process (e.g., contamination, supply chain)?", "order": 1}]},
                        {"clause_no": "6.2", "title": "Food safety objectives and planning to achieve them", "questions": [{"id": "q_fssc_6_2_1", "question_text": "Are measurable FSMS objectives set (e.g., micro compliance rate > 98%) and tracked?", "order": 1}]},
                        {"clause_no": "7.1.1", "title": "Resources", "questions": [{"id": "q_fssc_7_1_1_1", "question_text": "Are adequate resources provided (trained staff, lab equipment, RO plant maintenance)?", "order": 1}]},
                        {"clause_no": "7.2", "title": "Competence", "questions": [{"id": "q_fssc_7_2_1", "question_text": "Is competence ensured through training on GMP, HACCP, BIS, and hygiene?", "order": 1}]},
                        {"clause_no": "7.3", "title": "Awareness", "questions": [{"id": "q_fssc_7_3_1", "question_text": "Is awareness on food safety maintained among employees?", "order": 1}]},
                        {"clause_no": "7.4", "title": "Communication", "questions": [{"id": "q_fssc_7_4_1", "question_text": "Are internal and external communications defined and documented?", "order": 1}]},
                        {"clause_no": "7.5", "title": "Documented information", "questions": [{"id": "q_fssc_7_5_1", "question_text": "Is documented information (SOPs, records) controlled and updated properly?", "order": 1}]},
                        {"clause_no": "8.1", "title": "Operational planning and control", "questions": [{"id": "q_fssc_8_1_1", "question_text": "Are PRPs implemented as per ISO/TS 22002-1 requirements?", "order": 1}]},
                        {"clause_no": "8.2", "title": "Traceability", "questions": [{"id": "q_fssc_8_2_1", "question_text": "Are traceability systems available for each batch and container of water produced?", "order": 1}]},
                        {"clause_no": "8.3", "title": "Emergency preparedness and response", "questions": [{"id": "q_fssc_8_3_1", "question_text": "Are emergency preparedness plans available for contamination, power failure, or water source failure?", "order": 1}]},
                        {"clause_no": "8.4", "title": "Hazard analysis", "questions": [{"id": "q_fssc_8_4_1", "question_text": "Is hazard analysis conducted covering all inputs (raw water, chemicals, packaging)?", "order": 1}]},
                        {"clause_no": "8.5", "title": "Operational PRPs and CCPs monitoring", "questions": [{"id": "q_fssc_8_5_1", "question_text": "Are operational PRPs and CCPs monitored and records maintained?", "order": 1}]},
                        {"clause_no": "8.6", "title": "Verification of the hazard control plan", "questions": [{"id": "q_fssc_8_6_1", "question_text": "Are verification and validation procedures in place for filters, UV, and RO units?", "order": 1}]},
                        {"clause_no": "9.1", "title": "Monitoring, measurement, analysis and evaluation", "questions": [{"id": "q_fssc_9_1_1", "question_text": "Are monitoring and analysis results reviewed for FSMS performance?", "order": 1}]},
                        {"clause_no": "9.2", "title": "Internal audit", "questions": [{"id": "q_fssc_9_2_1", "question_text": "Are internal audits conducted and corrective actions implemented?", "order": 1}]},
                        {"clause_no": "9.3", "title": "Management review", "questions": [{"id": "q_fssc_9_3_1", "question_text": "Does management review cover all inputs and outputs related to FSMS?", "order": 1}]},
                        {"clause_no": "10.1", "title": "Nonconformity and corrective action", "questions": [{"id": "q_fssc_10_1_1", "question_text": "Are nonconformities addressed and root causes analyzed?", "order": 1}]},
                        {"clause_no": "10.2", "title": "Continual improvement", "questions": [{"id": "q_fssc_10_2_1", "question_text": "Is continual improvement evident in FSMS performance and audits?", "order": 1}]}
                    ]
                },
                {
                    "clause_no": "ISO/TS 22002-1:2009",
                    "title": "Prerequisite Programs (PRPs)",
                    "subclauses": [
                        {"clause_no": "4.1", "title": "Facility location and surrounding areas", "questions": [{"id": "q_fssc_prp_4_1_1", "question_text": "Is the facility located away from potential contamination sources (drains, garbage, smoke)?", "order": 1}]},
                        {"clause_no": "4.2", "title": "Building design and facilities", "questions": [{"id": "q_fssc_prp_4_2_1", "question_text": "Are building structures designed to prevent cross-contamination (e.g., air curtains, segregation)?", "order": 1}]},
                        {"clause_no": "4.3", "title": "Utilities", "questions": [{"id": "q_fssc_prp_4_3_1", "question_text": "Are utilities such as process water, compressed air, and steam tested and controlled?", "order": 1}]},
                        {"clause_no": "4.4", "title": "Waste management", "questions": [{"id": "q_fssc_prp_4_4_1", "question_text": "Is waste managed effectively (sludge, reject water, damaged bottles)?", "order": 1}]},
                        {"clause_no": "4.5", "title": "Equipment suitability", "questions": [{"id": "q_fssc_prp_4_5_1", "question_text": "Is equipment made of food-grade materials and easy to clean?", "order": 1}]},
                        {"clause_no": "4.6", "title": "Cleaning and sanitation", "questions": [{"id": "q_fssc_prp_4_6_1", "question_text": "Are validated cleaning and sanitation programs in place for tanks, pipelines, and fillers?", "order": 1}]},
                        {"clause_no": "4.7", "title": "Personnel hygiene facilities", "questions": [{"id": "q_fssc_prp_4_7_1", "question_text": "Are adequate hygiene facilities (hand wash, sanitizers, foot dips) provided?", "order": 1}]},
                        {"clause_no": "4.8", "title": "Personnel hygiene", "questions": [{"id": "q_fssc_prp_4_8_1", "question_text": "Are personnel trained on personal hygiene and GMP practices?", "order": 1}]},
                        {"clause_no": "4.9", "title": "Maintenance and calibration", "questions": [{"id": "q_fssc_prp_4_9_1", "question_text": "Is a preventive maintenance and calibration program implemented for instruments?", "order": 1}]},
                        {"clause_no": "4.10", "title": "Prevention of cross-contamination", "questions": [{"id": "q_fssc_prp_4_10_1", "question_text": "Are foreign material controls like strainers, filters, and sieves maintained?", "order": 1}]},
                        {"clause_no": "4.11", "title": "Product handling, storage and transportation", "questions": [{"id": "q_fssc_prp_4_11_1", "question_text": "Is product stored under hygienic conditions and protected from recontamination?", "order": 1}]},
                        {"clause_no": "4.12", "title": "Procurement of materials", "questions": [{"id": "q_fssc_prp_4_12_1", "question_text": "Are approved suppliers verified for RM/PM like soda ash, antiscalant, bottles, caps, and jars?", "order": 1}]},
                        {"clause_no": "4.13", "title": "Product formulation and allergen management", "questions": [{"id": "q_fssc_prp_4_13_1", "question_text": "Is allergen management considered (if any additives are used)?", "order": 1}]},
                        {"clause_no": "4.14", "title": "Rework control", "questions": [{"id": "q_fssc_prp_4_14_1", "question_text": "Is rework (e.g., rewashed jars) controlled and traceable?", "order": 1}]},
                        {"clause_no": "4.15", "title": "Food defense", "questions": [{"id": "q_fssc_prp_4_15_1", "question_text": "Is food defense implemented (restricted entry, CCTV, visitor log)?", "order": 1}]}
                    ]
                },
                {
                    "clause_no": "FSSC 22000 V6",
                    "title": "Additional Requirements",
                    "subclauses": [
                        {"clause_no": "2.5.1", "title": "Control of purchased materials and services", "questions": [{"id": "q_fssc_add_2_5_1_1", "question_text": "Is control over purchased materials and services documented and verified?", "order": 1}]},
                        {"clause_no": "2.5.2", "title": "Product labeling and traceability", "questions": [{"id": "q_fssc_add_2_5_2_1", "question_text": "Are product labeling and traceability verified for accuracy and regulatory compliance?", "order": 1}]},
                        {"clause_no": "2.5.3", "title": "Food defense", "questions": [{"id": "q_fssc_add_2_5_3_1", "question_text": "Is a food defense plan in place with periodic vulnerability assessment?", "order": 1}]},
                        {"clause_no": "2.5.4", "title": "Food fraud prevention", "questions": [{"id": "q_fssc_add_2_5_4_1", "question_text": "Is food fraud prevention documented with raw material vulnerability assessment?", "order": 1}]},
                        {"clause_no": "2.5.5", "title": "Allergen management", "questions": [{"id": "q_fssc_add_2_5_5_1", "question_text": "Are allergen controls documented (even if 'not applicable')?", "order": 1}]},
                        {"clause_no": "2.5.6", "title": "Environmental monitoring program", "questions": [{"id": "q_fssc_add_2_5_6_1", "question_text": "Is an environmental monitoring program in place for airborne yeast & mold in filling areas?", "order": 1}]},
                        {"clause_no": "2.5.7", "title": "Equipment management", "questions": [{"id": "q_fssc_add_2_5_7_1", "question_text": "Is equipment management ensuring food contact safety (SS material verification)?", "order": 1}]},
                        {"clause_no": "2.5.8", "title": "Transportation", "questions": [{"id": "q_fssc_add_2_5_8_1", "question_text": "Is transportation system controlled to ensure sealed and hygienic delivery of jars?", "order": 1}]},
                        {"clause_no": "2.5.9", "title": "Management of change", "questions": [{"id": "q_fssc_add_2_5_9_1", "question_text": "Is management of change applied to any new supplier, process, or design change?", "order": 1}]},
                        {"clause_no": "2.5.10", "title": "Food safety culture", "questions": [{"id": "q_fssc_add_2_5_10_1", "question_text": "Is a food safety culture program implemented (training, awareness, reporting culture)?", "order": 1}]}
                    ]
                }
            ]
        }
        questionnaires_collection.insert_one(fssc_questionnaire)
        print("Default FSSC 22000 V6.0 questionnaire initialized")

# Auth Endpoints
@app.post("/api/auth/register")
async def register(user: UserRegister, admin: str = Depends(verify_admin)):
    """Admin-only endpoint to register new users"""
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_pw = hash_password(user.password)
    user_doc = {
        "username": user.username,
        "password": hashed_pw,
        "full_name": user.full_name or user.username,
        "qualifications": user.qualifications,
        "certifications": user.certifications,
        "years_of_experience": user.years_of_experience,
        "is_active": True,  # New users are active by default
        "is_admin": False,  # Regular users are not admins
        "created_at": datetime.utcnow().isoformat()
    }
    result = users_collection.insert_one(user_doc)
    
    return {
        "message": "User registered successfully",
        "user": {
            "id": str(result.inserted_id),
            "username": user.username,
            "full_name": user_doc["full_name"],
            "is_active": user_doc["is_active"]
        }
    }

@app.post("/api/auth/login")
async def login(user: UserLogin):
    user_doc = users_collection.find_one({"username": user.username})
    if not user_doc or not verify_password(user.password, user_doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user account is active
    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is disabled. Contact administrator.")
    
    token = create_token(user.username)
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": str(user_doc["_id"]),
            "username": user_doc["username"],
            "full_name": user_doc.get("full_name", user_doc["username"]),
            "is_admin": user_doc.get("is_admin", False)
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
        "full_name": user_doc.get("full_name", user_doc["username"]),
        "qualifications": user_doc.get("qualifications", None),
        "certifications": user_doc.get("certifications", None),
        "years_of_experience": user_doc.get("years_of_experience", None),
        "profile_picture": user_doc.get("profile_picture", None),
        "is_admin": user_doc.get("is_admin", False),
        "is_active": user_doc.get("is_active", True)
    }

@app.put("/api/auth/profile-picture")
async def update_profile_picture(data: ProfilePictureUpdate, username: str = Depends(verify_token)):
    """Update or delete user's profile picture"""
    update_data = {}
    
    if data.profile_picture is None:
        # Delete profile picture
        update_data["profile_picture"] = None
        message = "Profile picture deleted"
    else:
        # Update profile picture with base64 data
        update_data["profile_picture"] = data.profile_picture
        message = "Profile picture updated"
    
    result = users_collection.update_one(
        {"username": username},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": message, "profile_picture": data.profile_picture}

@app.put("/api/auth/qualifications")
async def update_qualifications(data: QualificationsUpdate, username: str = Depends(verify_token)):
    """Update user's qualifications, certifications, and years of experience"""
    update_data = {}
    
    if data.qualifications is not None:
        update_data["qualifications"] = data.qualifications
    if data.certifications is not None:
        update_data["certifications"] = data.certifications
    if data.years_of_experience is not None:
        update_data["years_of_experience"] = data.years_of_experience
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = users_collection.update_one(
        {"username": username},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "message": "Qualifications updated successfully",
        "qualifications": data.qualifications,
        "certifications": data.certifications,
        "years_of_experience": data.years_of_experience
    }

# Admin Endpoints
@app.post("/api/admin/users")
async def admin_create_user(user_data: AdminCreateUser, admin: str = Depends(verify_admin)):
    """Admin-only endpoint to create new users"""
    if users_collection.find_one({"username": user_data.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_pw = hash_password(user_data.password)
    user_doc = {
        "username": user_data.username,
        "password": hashed_pw,
        "full_name": user_data.full_name or user_data.username,
        "qualifications": user_data.qualifications,
        "certifications": user_data.certifications,
        "years_of_experience": user_data.years_of_experience,
        "is_active": True,
        "is_admin": user_data.is_admin,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": admin
    }
    result = users_collection.insert_one(user_doc)
    
    return {
        "message": "User created successfully",
        "user": {
            "id": str(result.inserted_id),
            "username": user_data.username,
            "full_name": user_doc["full_name"],
            "is_active": True,
            "is_admin": user_data.is_admin
        }
    }

@app.get("/api/admin/users")
async def admin_get_users(admin: str = Depends(verify_admin)):
    """Admin-only endpoint to get all users"""
    users = list(users_collection.find())
    users_list = []
    for user in users:
        users_list.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "full_name": user.get("full_name", user["username"]),
            "qualifications": user.get("qualifications"),
            "certifications": user.get("certifications"),
            "years_of_experience": user.get("years_of_experience"),
            "is_active": user.get("is_active", True),
            "is_admin": user.get("is_admin", False),
            "created_at": user.get("created_at")
        })
    return {"users": users_list}

@app.put("/api/admin/users/{user_id}/toggle-status")
async def admin_toggle_user_status(user_id: str, admin: str = Depends(verify_admin)):
    """Admin-only endpoint to enable/disable user accounts"""
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from disabling themselves
    if user["username"] == admin:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    
    new_status = not user.get("is_active", True)
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": new_status}}
    )
    
    return {
        "message": f"User {'enabled' if new_status else 'disabled'} successfully",
        "user": {
            "id": user_id,
            "username": user["username"],
            "is_active": new_status
        }
    }

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: str = Depends(verify_admin)):
    """Admin-only endpoint to permanently delete user accounts"""
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from deleting themselves
    if user["username"] == admin:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Prevent deleting admin accounts
    if user.get("is_admin", False):
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    
    # Delete the user
    users_collection.delete_one({"_id": ObjectId(user_id)})
    
    return {
        "message": "User deleted successfully",
        "username": user["username"]
    }

@app.put("/api/admin/users/{user_id}/qualifications")
async def admin_update_user_qualifications(user_id: str, data: QualificationsUpdate, admin: str = Depends(verify_admin)):
    """Admin-only endpoint to update any user's qualifications"""
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {}
    if data.qualifications is not None:
        update_data["qualifications"] = data.qualifications
    if data.certifications is not None:
        update_data["certifications"] = data.certifications
    if data.years_of_experience is not None:
        update_data["years_of_experience"] = data.years_of_experience
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "message": "Qualifications updated successfully",
        "qualifications": data.qualifications,
        "certifications": data.certifications,
        "years_of_experience": data.years_of_experience
    }

@app.get("/api/admin/users/{user_id}/audits")
async def admin_get_user_audits(user_id: str, admin: str = Depends(verify_admin)):
    """Admin-only endpoint to get all audits for a specific user"""
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all audits for this user
    audits = list(audits_collection.find({"auditor": user["username"]}).sort("created_at", -1))
    for audit in audits:
        audit["id"] = str(audit["_id"])
        del audit["_id"]
    
    return {"audits": audits}

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
    # All users (including admin) see only their own audits on the Audits tab
    audits = list(audits_collection.find({"auditor": username}).sort("created_at", -1))
    for audit in audits:
        audit["id"] = str(audit["_id"])
        del audit["_id"]
    return {"audits": audits}

@app.get("/api/audits/{audit_id}")
async def get_audit(audit_id: str, username: str = Depends(verify_token)):
    # Check if user is admin
    user = users_collection.find_one({"username": username})
    is_admin = user.get("is_admin", False) if user else False
    
    # Admin can view any audit, regular users can only view their own
    if is_admin:
        audit = audits_collection.find_one({"_id": ObjectId(audit_id)})
    else:
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
        "audit_id": audit.audit_id,  # Custom audit identifier
        "description": audit.description,
        "plant_name": audit.plant_name,
        "auditor_name": audit.auditor_name,
        "auditee_name": audit.auditee_name,
        "audit_scope": audit.audit_scope,
        "audit_criteria": audit.audit_criteria,
        "auditor": username,
        "status": "draft",
        "responses": [],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    result = audits_collection.insert_one(audit_doc)
    return {"message": "Audit created", "id": str(result.inserted_id)}

@app.put("/api/audits/{audit_id}")
async def update_audit(audit_id: str, audit_update: AuditUpdate, username: str = Depends(verify_token)):
    update_data = {k: v for k, v in audit_update.dict().items() if v is not None}
    
    result = audits_collection.update_one(
        {"_id": ObjectId(audit_id), "auditor": username},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    return {"message": "Audit updated successfully"}

@app.put("/api/audits/{audit_id}/capa-file")
async def upload_capa_file(audit_id: str, file_data: dict, username: str = Depends(verify_token)):
    """Upload CAPA report file to audit"""
    update_data = {
        "capa_report_file": file_data.get("file_data"),
        "capa_report_filename": file_data.get("filename")
    }
    
    result = audits_collection.update_one(
        {"_id": ObjectId(audit_id), "auditor": username},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    return {"message": "CAPA report uploaded successfully", "filename": file_data.get("filename")}

@app.delete("/api/audits/{audit_id}/capa-file")
async def delete_capa_file(audit_id: str, username: str = Depends(verify_token)):
    """Delete CAPA report file from audit"""
    result = audits_collection.update_one(
        {"_id": ObjectId(audit_id), "auditor": username},
        {"$set": {"capa_report_file": None, "capa_report_filename": None}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    return {"message": "CAPA report deleted successfully"}

@app.post("/api/reports/pdf")
def generate_report_pdf(req: PDFRequest, username: str = Depends(verify_token)):
    """Convert report HTML (with embedded base64 images) into a real multi-page PDF"""
    try:
        from weasyprint import HTML as WeasyHTML
        pdf_bytes = WeasyHTML(string=req.html).write_pdf()
        safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in (req.filename or "report"))
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@app.get("/api/audits/{audit_id}/capa-entries")
async def get_capa_entries(audit_id: str, username: str = Depends(verify_token)):
    """Get CAPA entries prepared for this audit"""
    user = users_collection.find_one({"username": username})
    is_admin = user.get("is_admin", False) if user else False
    query = {"_id": ObjectId(audit_id)} if is_admin else {"_id": ObjectId(audit_id), "auditor": username}
    audit = audits_collection.find_one(query)
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return {"capa_entries": audit.get("capa_entries", []), "capa_updated_by": audit.get("capa_updated_by"), "capa_updated_at": audit.get("capa_updated_at")}

@app.put("/api/audits/{audit_id}/capa-entries")
async def save_capa_entries(audit_id: str, payload: CAPAEntriesPayload, username: str = Depends(verify_token)):
    """Save CAPA entries (prepared online by auditee/auditor) for this audit"""
    user = users_collection.find_one({"username": username})
    is_admin = user.get("is_admin", False) if user else False
    query = {"_id": ObjectId(audit_id)} if is_admin else {"_id": ObjectId(audit_id), "auditor": username}
    result = audits_collection.update_one(
        query,
        {"$set": {
            "capa_entries": [e.dict() for e in payload.entries],
            "capa_updated_by": username,
            "capa_updated_at": datetime.utcnow().isoformat(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    return {"message": "CAPA entries saved successfully", "count": len(payload.entries)}

@app.delete("/api/audits/{audit_id}")
async def delete_audit(audit_id: str, username: str = Depends(verify_token)):
    result = audits_collection.delete_one({"_id": ObjectId(audit_id), "auditor": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Audit not found")
    return {"message": "Audit deleted successfully"}

# CAPA Report Endpoints
@app.post("/api/capa")
async def create_capa(capa: CAPAModel, username: str = Depends(verify_token)):
    """Create CAPA report entry"""
    capa_dict = capa.dict()
    capa_dict["created_at"] = datetime.utcnow().isoformat()
    capa_dict["created_by"] = username
    result = capa_reports_collection.insert_one(capa_dict)
    capa_dict["_id"] = str(result.inserted_id)
    return capa_dict

@app.get("/api/capa")
async def get_all_capa(username: str = Depends(verify_token)):
    """Get all CAPA reports for current user"""
    capas = list(capa_reports_collection.find({"created_by": username}).sort("created_at", -1))
    for capa in capas:
        capa["_id"] = str(capa["_id"])
    return capas

@app.get("/api/capa/{capa_id}")
async def get_capa(capa_id: str, username: str = Depends(verify_token)):
    """Get specific CAPA report"""
    capa = capa_reports_collection.find_one({"_id": ObjectId(capa_id), "created_by": username})
    if not capa:
        raise HTTPException(status_code=404, detail="CAPA report not found")
    capa["_id"] = str(capa["_id"])
    return capa

@app.put("/api/capa/{capa_id}")
async def update_capa(capa_id: str, updates: CAPAUpdate, username: str = Depends(verify_token)):
    """Update CAPA report"""
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    result = capa_reports_collection.update_one(
        {"_id": ObjectId(capa_id), "created_by": username},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="CAPA report not found")
    
    return {"message": "CAPA report updated successfully"}

@app.delete("/api/capa/{capa_id}")
async def delete_capa(capa_id: str, username: str = Depends(verify_token)):
    """Delete CAPA report"""
    result = capa_reports_collection.delete_one({"_id": ObjectId(capa_id), "created_by": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="CAPA report not found")
    return {"message": "CAPA report deleted successfully"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# Initialize default data on startup
@app.on_event("startup")
async def startup_event():
    init_default_admin()
    init_default_questionnaire()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
