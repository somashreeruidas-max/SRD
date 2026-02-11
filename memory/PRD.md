# AquaGuard - RCA & Audit Finding Management System
## Product Requirements Document

### Original Problem Statement
Create a professional, modern, and visually beautiful web-based Root Cause Analysis (RCA) and Audit Finding Management System specifically designed for a Packaged Drinking Water Plant complying with ISO 9001, ISO 14001, ISO 45001, and FSSC 22000 standards.

### User Persona
- **QA Managers**: Oversee audit findings, approve CAPAs, verify effectiveness
- **Auditors**: Record findings, perform RCA analysis, create action plans
- **Department Heads**: Track department-specific findings and assigned actions
- **Administrators**: Manage users, configure system settings

### Core Requirements (Static)
1. Dashboard with KPIs (findings by status, risk, department)
2. Audit Finding Entry with ISO standard reference
3. RCA Wizard (5-Why, Fishbone analysis)
4. CAPA Management with approval workflow
5. Risk Assessment Matrix (5x5 severity x likelihood)
6. Evidence Repository for document storage
7. Analytics & Compliance Reports
8. PDF Report Generation
9. Role-based Access Control

### What's Been Implemented (Feb 11, 2026)
- [x] JWT-based authentication with role management
- [x] Dashboard with 4 KPI cards and 5 charts (Recharts)
- [x] Audit Findings CRUD with filters (status, department, standard, risk)
- [x] 4-step RCA Wizard (5-Why and Fishbone methods)
- [x] CAPA module with status tracking and approval workflow
- [x] 5x5 Risk Matrix with color-coded cells and interactive selection
- [x] Evidence Repository with file upload/download
- [x] Analytics page with compliance metrics
- [x] Browser-based PDF report generation
- [x] User Management (admin only)
- [x] Settings page with system info
- [x] 8 preloaded sample scenarios (microbiological NC, CCP deviation, etc.)
- [x] 4 demo user accounts (admin, QA manager, dept head, auditor)
- [x] Professional Navy/Blue theme with Manrope/Inter fonts
- [x] Collapsible sidebar navigation

### Architecture
- **Frontend**: React 19, TailwindCSS, Shadcn UI, Recharts
- **Backend**: FastAPI with JWT authentication
- **Database**: MongoDB
- **File Storage**: Local server storage

### P0/P1/P2 Features Remaining
**P0 (Critical)**
- None - Core functionality complete

**P1 (High Priority)**
- Email notifications for overdue CAPAs
- Dashboard date range filters
- Bulk finding import (CSV/Excel)

**P2 (Nice to Have)**
- Audit schedule calendar
- Custom report templates
- Mobile-responsive improvements
- Dark mode theme option

### Next Tasks
1. Add email notifications for CAPA deadlines
2. Implement audit trail/history logging
3. Add dashboard date filters
4. Create CSV/Excel export functionality
