# Tasks: Letably Platform

**Input**: Design documents from `/specs/001-letably-platform/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Reference Codebase**: H:\SCL (New)\ - adapt existing patterns for multi-tenancy

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/` (controllers/, middleware/, routes/, services/, helpers/, validators/)
- **Frontend**: `frontend/app/`, `frontend/components/`, `frontend/lib/`
- **Migrations**: `backend/migrations/`

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize Letably project structure from existing SCL codebase

- [ ] T001 Create Letably repository and copy SCL codebase structure
- [ ] T002 [P] Update package.json with project name "letably" in backend/package.json
- [ ] T003 [P] Update package.json with project name "letably" in frontend/package.json
- [ ] T004 [P] Install PostgreSQL driver `pg` in backend (npm install pg)
- [ ] T005 [P] Create .env.example files for backend and frontend with required variables
- [ ] T006 [P] Update .gitignore to include PostgreSQL and new environment patterns
- [ ] T007 Create backend/migrations/ directory for PostgreSQL migrations

---

## Phase 2: Foundational (Database Migration & Multi-Tenancy Infrastructure)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Setup

- [ ] T008 Create PostgreSQL database and user for development in local environment
- [ ] T009 Create migration 001_create_agencies.sql for agencies table in backend/migrations/
- [ ] T010 Create migration 002_add_agency_id.sql adding agency_id to all existing tables in backend/migrations/
- [ ] T011 Create migration 003_create_rls_policies.sql with RLS policies for all tables in backend/migrations/
- [ ] T012 Create migration 004_seed_certificate_types.sql for global reference data in backend/migrations/
- [ ] T013 Create migration runner script in backend/src/scripts/migrate.js
- [ ] T014 Update backend/src/db.js to use PostgreSQL (pg) instead of SQLite (better-sqlite3)
- [ ] T015 Create SCL data migration script to import as Agency 1 in backend/src/scripts/migrate-scl-data.js

### Multi-Tenancy Middleware

- [ ] T016 Create agency context middleware in backend/src/middleware/agencyContext.js
- [ ] T017 Update auth middleware to extract agency_id from JWT in backend/src/middleware/auth.js
- [ ] T018 Create subscription check middleware for read-only mode in backend/src/middleware/subscriptionCheck.js
- [ ] T019 Update rate limiter for per-agency limits in backend/src/middleware/rateLimiter.js
- [ ] T020 Update JWT token generation to include agency_id in backend/src/controllers/authController.js

### Frontend Multi-Tenancy Setup

- [ ] T021 Create agency context provider in frontend/lib/agency-context.tsx
- [ ] T022 Update API client to include agency context in frontend/lib/api.ts
- [ ] T023 Create [agency] dynamic route folder structure in frontend/app/[agency]/
- [ ] T024 Create agency middleware for route validation in frontend/middleware.ts
- [ ] T025 Update auth context to include agency info in frontend/lib/auth-context.tsx

**Checkpoint**: Foundation ready - multi-tenancy infrastructure complete, user story implementation can now begin

---

## Phase 3: User Story 1 - Agency Onboarding & Setup (Priority: P1) 🎯 MVP

**Goal**: New letting agencies can sign up, configure branding, and access their portal

**Independent Test**: Complete agency signup flow and verify branded portal access at `portal.letably.com/{slug}/`

### Backend Implementation for US1

- [ ] T026 [P] [US1] Create Agency model/queries in backend/src/models/agency.js
- [ ] T027 [P] [US1] Create AgencySettings model/queries in backend/src/models/agencySettings.js
- [ ] T028 [US1] Create AgencyService with CRUD and branding operations in backend/src/services/agencyService.js
- [ ] T029 [US1] Create agency routes (register, get, update branding) in backend/src/routes/agencies.js
- [ ] T030 [US1] Create agencyController with signup and settings handlers in backend/src/controllers/agencyController.js
- [ ] T031 [US1] Update authController login to validate agency_slug in backend/src/controllers/authController.js
- [ ] T032 [US1] Create welcome email template with agency branding in backend/src/services/emailService.js
- [ ] T033 [US1] Add agency branding validation (logo URL, hex color) in backend/src/validators/agencyValidator.js
- [ ] T034 [US1] Register agency routes in server.js in backend/src/server.js

### Frontend Implementation for US1

- [ ] T035 [P] [US1] Create agency signup page in frontend/app/signup/page.tsx
- [ ] T036 [P] [US1] Create agency login page in frontend/app/[agency]/login/page.tsx
- [ ] T037 [US1] Create agency settings page in frontend/app/[agency]/admin/settings/page.tsx
- [ ] T038 [US1] Create branding settings component (logo upload, color picker) in frontend/components/BrandingSettings.tsx
- [ ] T039 [US1] Create agency layout with dynamic branding in frontend/app/[agency]/layout.tsx
- [ ] T040 [US1] Update root layout to handle agency context in frontend/app/layout.tsx
- [ ] T041 [US1] Create agency header component with logo in frontend/components/AgencyHeader.tsx
- [ ] T042 [US1] Add CSS variables for agency primary color in frontend/app/globals.css

**Checkpoint**: Agency signup, login, and branding fully functional. Steel City Living can be onboarded.

---

## Phase 4: User Story 2 - Property Portfolio Management (Priority: P1)

**Goal**: Agency admins can add/manage properties with rooms and certificates

**Independent Test**: Add a property with rooms and certificates, verify all data stored and retrievable

### Backend Implementation for US2

- [ ] T043 [P] [US2] Update Property model with agency_id scoping in backend/src/models/property.js
- [ ] T044 [P] [US2] Update Room model with agency_id scoping in backend/src/models/room.js
- [ ] T045 [P] [US2] Update Certificate model with agency_id scoping in backend/src/models/certificate.js
- [ ] T046 [P] [US2] Update Image model with agency_id scoping in backend/src/models/image.js
- [ ] T047 [P] [US2] Update Location model with agency_id scoping in backend/src/models/location.js
- [ ] T048 [US2] Update propertiesController with agency context in backend/src/controllers/propertiesController.js
- [ ] T049 [US2] Update roomsController with agency context in backend/src/controllers/roomsController.js
- [ ] T050 [US2] Create certificatesController with expiry tracking in backend/src/controllers/certificatesController.js
- [ ] T051 [US2] Update imagesController with agency context in backend/src/controllers/imagesController.js
- [ ] T052 [US2] Create certificate reminder service in backend/src/services/certificateReminderService.js
- [ ] T053 [US2] Update properties routes with agency middleware in backend/src/routes/properties.js
- [ ] T054 [US2] Update rooms routes with agency middleware in backend/src/routes/rooms.js
- [ ] T055 [US2] Create certificates routes in backend/src/routes/certificates.js
- [ ] T056 [US2] Add tenancy overlap validation to property/room availability in backend/src/validators/propertyValidator.js

### Frontend Implementation for US2

- [ ] T057 [P] [US2] Update properties list page with agency context in frontend/app/[agency]/admin/properties/page.tsx
- [ ] T058 [P] [US2] Update property detail page with agency context in frontend/app/[agency]/admin/properties/[id]/page.tsx
- [ ] T059 [US2] Create property form component with rooms and certificates in frontend/components/PropertyForm.tsx
- [ ] T060 [US2] Create room management component in frontend/components/RoomManager.tsx
- [ ] T061 [US2] Create certificate upload component with expiry tracking in frontend/components/CertificateUpload.tsx
- [ ] T062 [US2] Create certificate expiry warnings component in frontend/components/CertificateWarnings.tsx
- [ ] T063 [US2] Update image gallery component for properties/rooms in frontend/components/ImageGallery.tsx

**Checkpoint**: Property, room, and certificate management fully functional with agency isolation.

---

## Phase 5: User Story 3 - Tenant Account & Application Processing (Priority: P1)

**Goal**: Agency admins can create tenant accounts and process applications to tenancies

**Independent Test**: Create a tenant, process their application, and convert to a tenancy

### Backend Implementation for US3

- [ ] T064 [P] [US3] Update User model with agency_id scoping in backend/src/models/user.js
- [ ] T065 [P] [US3] Update Application model with agency_id scoping in backend/src/models/application.js
- [ ] T066 [P] [US3] Update Tenancy model with agency_id scoping in backend/src/models/tenancy.js
- [ ] T067 [P] [US3] Update TenancyMember model with agency_id scoping in backend/src/models/tenancyMember.js
- [ ] T068 [P] [US3] Update Landlord model with agency_id scoping in backend/src/models/landlord.js
- [ ] T069 [US3] Update usersController with agency context in backend/src/controllers/usersController.js
- [ ] T070 [US3] Update applicationsController with agency context and workflow in backend/src/controllers/applicationsController.js
- [ ] T071 [US3] Update tenanciesController with agency context in backend/src/controllers/tenanciesController.js
- [ ] T072 [US3] Update landlordsController with agency context in backend/src/controllers/landlordsController.js
- [ ] T073 [US3] Update user routes with agency middleware in backend/src/routes/users.js
- [ ] T074 [US3] Update applications routes with agency middleware in backend/src/routes/applications.js
- [ ] T075 [US3] Update tenancies routes with agency middleware in backend/src/routes/tenancies.js
- [ ] T076 [US3] Update landlords routes with agency middleware in backend/src/routes/landlords.js
- [ ] T077 [US3] Create tenant invitation email with agency branding in backend/src/services/emailService.js
- [ ] T078 [US3] Add application status workflow validation in backend/src/validators/applicationValidator.js
- [ ] T079 [US3] Add tenancy date overlap validation in backend/src/validators/tenancyValidator.js

### Frontend Implementation for US3

- [ ] T080 [P] [US3] Update users list page with agency context in frontend/app/[agency]/admin/users/page.tsx
- [ ] T081 [P] [US3] Update applications list page with agency context in frontend/app/[agency]/admin/applications/page.tsx
- [ ] T082 [P] [US3] Update tenancies list page with agency context in frontend/app/[agency]/admin/tenancies/page.tsx
- [ ] T083 [US3] Create tenant creation form component in frontend/components/TenantForm.tsx
- [ ] T084 [US3] Create application review component with status workflow in frontend/components/ApplicationReview.tsx
- [ ] T085 [US3] Create tenancy creation wizard in frontend/components/TenancyWizard.tsx
- [ ] T086 [US3] Update landlords list page with agency context in frontend/app/[agency]/admin/landlords/page.tsx
- [ ] T087 [US3] Create landlord form component in frontend/components/LandlordForm.tsx

**Checkpoint**: Tenant onboarding, application processing, and tenancy creation fully functional.

---

## Phase 6: User Story 4 - Tenant Portal Experience (Priority: P2)

**Goal**: Tenants can view tenancy, sign agreements, report maintenance, track payments

**Independent Test**: Tenant logs in, views tenancy, signs agreement, submits maintenance request

### Backend Implementation for US4

- [ ] T088 [P] [US4] Create GuarantorAgreement model with agency_id scoping in backend/src/models/guarantorAgreement.js
- [ ] T089 [P] [US4] Update MaintenanceRequest model with agency_id scoping in backend/src/models/maintenanceRequest.js
- [ ] T090 [P] [US4] Update MaintenanceComment model with agency_id scoping in backend/src/models/maintenanceComment.js
- [ ] T091 [US4] Create tenant portal controller with tenancy view in backend/src/controllers/tenantPortalController.js
- [ ] T092 [US4] Update agreement signing endpoint with HTML snapshot in backend/src/controllers/tenanciesController.js
- [ ] T093 [US4] Create guarantor signing public endpoint in backend/src/controllers/guarantorController.js
- [ ] T094 [US4] Update maintenanceController with tenant submission in backend/src/controllers/maintenanceController.js
- [ ] T095 [US4] Create tenant portal routes in backend/src/routes/tenantPortal.js
- [ ] T096 [US4] Create guarantor public routes (no auth) in backend/src/routes/guarantor.js
- [ ] T097 [US4] Update maintenance routes with tenant access in backend/src/routes/maintenance.js
- [ ] T098 [US4] Create agreement PDF/HTML generation service in backend/src/services/agreementService.js
- [ ] T099 [US4] Create maintenance notification service for landlords in backend/src/services/maintenanceNotificationService.js

### Frontend Implementation for US4

- [ ] T100 [P] [US4] Create tenant dashboard page in frontend/app/[agency]/tenant/page.tsx
- [ ] T101 [P] [US4] Create tenant tenancy view page in frontend/app/[agency]/tenant/tenancy/page.tsx
- [ ] T102 [US4] Create agreement signing page in frontend/app/[agency]/tenant/agreement/page.tsx
- [ ] T103 [US4] Create signature input component (typed name) in frontend/components/SignatureInput.tsx
- [ ] T104 [US4] Create guarantor signing public page in frontend/app/guarantor/[token]/page.tsx
- [ ] T105 [US4] Create maintenance request form in frontend/app/[agency]/tenant/maintenance/new/page.tsx
- [ ] T106 [US4] Create maintenance request list in frontend/app/[agency]/tenant/maintenance/page.tsx
- [ ] T107 [US4] Create maintenance request detail with comments in frontend/app/[agency]/tenant/maintenance/[id]/page.tsx
- [ ] T108 [US4] Create payment history view in frontend/app/[agency]/tenant/payments/page.tsx
- [ ] T109 [US4] Create tenant layout with navigation in frontend/app/[agency]/tenant/layout.tsx

**Checkpoint**: Tenant portal fully functional - view tenancy, sign agreements, submit maintenance, view payments.

---

## Phase 7: User Story 5 - Landlord Portal Experience (Priority: P2)

**Goal**: Landlords can view their properties, tenants, and payment reports

**Independent Test**: Landlord logs in and views their properties, tenants, and payment statements

### Backend Implementation for US5

- [ ] T110 [US5] Create landlord portal controller with property views in backend/src/controllers/landlordPanelController.js
- [ ] T111 [US5] Create landlord payment reports endpoint in backend/src/controllers/landlordPanelController.js
- [ ] T112 [US5] Create landlord statement PDF generation in backend/src/services/statementService.js
- [ ] T113 [US5] Update landlord portal routes in backend/src/routes/landlordPanel.js
- [ ] T114 [US5] Create landlord maintenance view endpoint in backend/src/controllers/landlordPanelController.js

### Frontend Implementation for US5

- [ ] T115 [P] [US5] Create landlord dashboard page in frontend/app/[agency]/landlord/page.tsx
- [ ] T116 [P] [US5] Create landlord properties list in frontend/app/[agency]/landlord/properties/page.tsx
- [ ] T117 [US5] Create landlord property detail view in frontend/app/[agency]/landlord/properties/[id]/page.tsx
- [ ] T118 [US5] Create landlord payment reports page in frontend/app/[agency]/landlord/reports/page.tsx
- [ ] T119 [US5] Create statement download component in frontend/components/StatementDownload.tsx
- [ ] T120 [US5] Create landlord maintenance view in frontend/app/[agency]/landlord/maintenance/page.tsx
- [ ] T121 [US5] Create landlord layout with navigation in frontend/app/[agency]/landlord/layout.tsx

**Checkpoint**: Landlord portal fully functional - view properties, tenants, payments, maintenance.

---

## Phase 8: User Story 6 - Payment Schedule & Tracking (Priority: P2)

**Goal**: Auto-generate payment schedules, record payments, send reminders

**Independent Test**: Create tenancy, verify auto-generated schedule, record payments, confirm reminders

### Backend Implementation for US6

- [ ] T122 [P] [US6] Update PaymentSchedule model with agency_id scoping in backend/src/models/paymentSchedule.js
- [ ] T123 [P] [US6] Update Payment model with agency_id scoping in backend/src/models/payment.js
- [ ] T124 [US6] Update payment schedule generation service with PCM method in backend/src/services/paymentService.js
- [ ] T125 [US6] Create rolling monthly payment generation service in backend/src/services/rollingPaymentService.js
- [ ] T126 [US6] Update paymentsController with agency context in backend/src/controllers/paymentsController.js
- [ ] T127 [US6] Create payment reminder service in backend/src/services/reminderService.js
- [ ] T128 [US6] Create overdue status update service (daily job) in backend/src/services/overduePaymentService.js
- [ ] T129 [US6] Update payments routes with agency middleware in backend/src/routes/payments.js
- [ ] T130 [US6] Add partial payment validation and balance tracking in backend/src/validators/paymentValidator.js
- [ ] T131 [US6] Create cron job scheduler for reminders and overdue updates in backend/src/jobs/scheduler.js

### Frontend Implementation for US6

- [ ] T132 [P] [US6] Update payments list page with agency context in frontend/app/[agency]/admin/payments/page.tsx
- [ ] T133 [US6] Create payment recording form in frontend/components/PaymentForm.tsx
- [ ] T134 [US6] Create payment schedule view with status indicators in frontend/components/PaymentScheduleView.tsx
- [ ] T135 [US6] Create overdue payments dashboard widget in frontend/components/OverduePaymentsWidget.tsx
- [ ] T136 [US6] Create payment receipt download component in frontend/components/PaymentReceipt.tsx

**Checkpoint**: Payment management fully functional - auto-generation, recording, reminders, status tracking.

---

## Phase 9: User Story 7 - Public Property API (Priority: P3)

**Goal**: Agencies can access a public API for their website

**Independent Test**: Authenticate with API key, fetch properties, submit viewing request

### Backend Implementation for US7

- [ ] T137 [P] [US7] Create ViewingRequest model with agency_id scoping in backend/src/models/viewingRequest.js
- [ ] T138 [US7] Create API key authentication middleware in backend/src/middleware/apiKeyAuth.js
- [ ] T139 [US7] Create public API controller in backend/src/controllers/publicApiController.js
- [ ] T140 [US7] Create viewing request notification service in backend/src/services/viewingRequestService.js
- [ ] T141 [US7] Create public API routes in backend/src/routes/publicApi.js
- [ ] T142 [US7] Add API key generation to agency settings in backend/src/controllers/agencyController.js
- [ ] T143 [US7] Create API rate limiting per key in backend/src/middleware/apiRateLimiter.js

### Frontend Implementation for US7

- [ ] T144 [US7] Create API key management in agency settings in frontend/app/[agency]/admin/settings/api/page.tsx
- [ ] T145 [US7] Create viewing requests management page in frontend/app/[agency]/admin/viewing-requests/page.tsx
- [ ] T146 [US7] Create API documentation component in frontend/components/ApiDocumentation.tsx

**Checkpoint**: Public API fully functional - property listings, viewing requests, API key management.

---

## Phase 10: Custom Domains (Premium Feature)

**Goal**: Premium agencies can use their own domain

- [ ] T147 Create domain lookup middleware in backend/src/middleware/domainLookup.js
- [ ] T148 Create domain verification service in backend/src/services/domainService.js
- [ ] T149 Add custom domain endpoints to agency settings in backend/src/controllers/agencyController.js
- [ ] T150 Create Nginx configuration template for custom domains in deployment/nginx/custom-domain.conf
- [ ] T151 Create Let's Encrypt auto-provisioning script in deployment/scripts/ssl-provision.sh
- [ ] T152 Create custom domain settings UI in frontend/app/[agency]/admin/settings/domain/page.tsx
- [ ] T153 Create DNS verification instructions component in frontend/components/DnsVerification.tsx

**Checkpoint**: Premium agencies can configure and verify custom domains.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Security, performance, and deployment readiness

### Security

- [ ] T154 [P] Add agency isolation security tests in backend/tests/security/isolation.test.js
- [ ] T155 [P] Add input sanitization review across all controllers
- [ ] T156 Review and harden JWT implementation in backend/src/middleware/auth.js
- [ ] T157 Add CORS configuration for agency domains in backend/src/server.js

### Performance

- [ ] T158 [P] Add database query optimization and indexes review
- [ ] T159 [P] Add caching layer for agency branding in backend/src/services/agencyService.js
- [ ] T160 Configure PM2 for production deployment in backend/ecosystem.config.js

### Data Migration

- [ ] T161 Test SCL data migration with production data copy
- [ ] T162 Create rollback migration script in backend/src/scripts/rollback-migration.js
- [ ] T163 Document migration runbook in docs/migration-runbook.md

### Documentation & Deployment

- [ ] T164 [P] Create API documentation in docs/api.md
- [ ] T165 [P] Create deployment guide in docs/deployment.md
- [ ] T166 Run quickstart.md validation scenarios
- [ ] T167 Create production Nginx configuration in deployment/nginx/letably.conf
- [ ] T168 Create backup/restore scripts in deployment/scripts/backup.sh

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - US1-US3 (P1): Core MVP - complete in order or parallel
  - US4-US6 (P2): Value-add - can start after Foundational
  - US7 (P3): Post-MVP - can defer
- **Custom Domains (Phase 10)**: Depends on US1 being complete
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation only - No dependencies on other stories
- **US2 (P1)**: Foundation only - No dependencies on other stories
- **US3 (P1)**: Foundation only - May reference properties from US2 but independently testable
- **US4 (P2)**: Requires US3 (tenancies exist) for meaningful testing
- **US5 (P2)**: Requires US2 (properties exist) and US3 (tenancies for payments)
- **US6 (P2)**: Requires US3 (tenancies for payment schedules)
- **US7 (P3)**: Requires US2 (properties to list)

### Suggested MVP Scope

**Minimum Viable Product (MVP)**: Complete Phases 1-5 (Setup + Foundation + US1 + US2 + US3)

This delivers:
- Agency onboarding and branding
- Property and room management
- Tenant account creation and application processing
- Basic tenancy management

### Parallel Opportunities

Within Foundation Phase:
```
Parallel: T009, T010, T011, T012 (migrations - different files)
Parallel: T016, T017, T018, T019 (middleware - different files)
Parallel: T021, T022, T023, T024, T025 (frontend setup - different files)
```

Within User Story Phases:
```
Parallel: All model updates marked [P] within each story
Parallel: Backend routes after controllers complete
Parallel: Frontend pages after API ready
```

Multiple Team Strategy:
```
Developer A: US1 (Agency setup)
Developer B: US2 (Properties)
Developer C: US3 (Tenants/Applications)
-- converge for US4-US6 which integrate components --
```

---

## Summary

| Phase | Task Count | Description |
|-------|------------|-------------|
| Setup | 7 | Project initialization |
| Foundational | 18 | Database + Multi-tenancy infra |
| US1 (P1) | 17 | Agency Onboarding |
| US2 (P1) | 21 | Property Management |
| US3 (P1) | 24 | Tenant/Application Processing |
| US4 (P2) | 22 | Tenant Portal |
| US5 (P2) | 12 | Landlord Portal |
| US6 (P2) | 15 | Payment Tracking |
| US7 (P3) | 10 | Public API |
| Custom Domains | 7 | Premium Feature |
| Polish | 15 | Security/Deployment |
| **Total** | **168** | |

---

*Tasks Version: 1.0*
*Created: 2026-01-31*
