# Feature Specification: Letably Platform

**Feature Branch**: `001-letably-platform`
**Created**: 2026-01-31
**Status**: Draft
**Input**: Multi-tenant property management SaaS platform for UK letting agencies

---

## Overview

**Product Name:** Letably
**Domain:** letably.com
**Version:** 1.0

Letably is a multi-tenant property management SaaS platform for UK letting agencies. It enables agencies to manage properties, tenants, landlords, payments, and maintenance through a white-labeled portal.

### Problem Statement

UK letting agencies currently use fragmented tools (spreadsheets, generic CRMs, paper forms) to manage their property portfolios. They need:

- A centralized system for property and tenant management
- Professional tenant/landlord portals they can brand as their own
- Automated payment tracking and reminders
- Digital tenancy agreements and document signing
- Maintenance request handling

**Letably solves this** by providing a complete, white-labeled property management platform that agencies can deploy under their own brand.

### Target Users

| User Type | Description |
|-----------|-------------|
| **Agency Administrators** (Primary) | Letting agency staff who manage day-to-day operations |
| **Tenants** (Secondary) | People renting properties through member agencies |
| **Landlords** (Secondary) | Property owners who work with member agencies |
| **Platform Super-Admin** (Future) | Letably staff managing the multi-tenant platform |

---

## Clarifications

### Session 2026-01-31

- Q: How should the system handle overlapping tenancy dates for the same property/room within an agency? → A: System prevents overlapping tenancies (validation blocks conflicting dates on the same property/room)
- Q: What are the maintenance request workflow states? → A: 3-state workflow matching existing SCL system: Submitted → In Progress → Completed, with priority levels (low/medium/high) and categories (plumbing, electrical, heating, appliances, structural, pest_control, general, other)
- Q: What are the application workflow states? → A: Matching existing SCL system: Pending → Awaiting Guarantor (if required) → Submitted → Approved → Converted to Tenancy
- Q: What are the tenancy status states? → A: Matching existing SCL system: Pending → Awaiting Signatures → Signed → Approval → Active → Expired
- Q: How does e-signature work for tenancy agreements? → A: Typed signature (name must match tenant name), each tenant member signs individually, signed agreement HTML snapshot stored, guarantor agreements handled via token-based public URLs
- Q: How are payments and partial payments handled? → A: Matching existing SCL system - Payment statuses: pending, paid, partial, overdue. Multiple payments can be recorded against one schedule. Payment options: monthly, quarterly, monthly_to_quarterly, upfront. Uses PCM (per calendar month) calculation method (UK standard).
- Q: What happens when an agency's subscription expires? → A: Read-only mode - users can view data but cannot create/edit until subscription is renewed
- Q: What happens when a landlord is removed but has active properties? → A: Allow removal - properties become unassigned (no landlord linked)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agency Onboarding & Setup (Priority: P1)

A new letting agency signs up for Letably and configures their branded portal so they can start managing their property portfolio.

**Why this priority**: This is the foundation - without agencies onboarded with their branding, no other functionality can be used. Steel City Living (founding customer) needs this first.

**Independent Test**: Can be fully tested by completing agency signup flow and verifying branded portal access at `portal.letably.com/{slug}/`

**Acceptance Scenarios**:

1. **Given** a letting agency visits the signup page, **When** they complete registration with company details, **Then** they receive a welcome email with setup instructions and can access their portal
2. **Given** an agency admin is logged in, **When** they upload their logo and set brand color, **Then** their portal immediately reflects the new branding
3. **Given** a premium agency subscription, **When** they configure a custom domain (e.g., `portal.myagency.com`), **Then** their portal is accessible via that domain with auto-provisioned SSL and optional "Powered by" footer removal

---

### User Story 2 - Property Portfolio Management (Priority: P1)

Agency administrators add and manage their property portfolio including individual room listings and compliance certificates.

**Why this priority**: Core business function - agencies cannot operate without managing their property inventory.

**Independent Test**: Can be fully tested by adding a property with rooms and certificates, then verifying all data is stored and retrievable

**Acceptance Scenarios**:

1. **Given** an agency admin is logged in, **When** they create a new property with address, description, and photos, **Then** the property is saved and can be marked as live or draft
2. **Given** a property exists, **When** the admin adds rooms with individual prices, availability, and features, **Then** each room can be let independently
3. **Given** a property exists, **When** the admin uploads gas safety, EPC, or electrical certificates, **Then** the system tracks expiry dates and sends reminders before expiry
4. **Given** a property exists, **When** the admin assigns it to a landlord, **Then** the landlord can view the property in their portal

---

### User Story 3 - Tenant Account & Application Processing (Priority: P1)

Agency administrators create tenant accounts and process rental applications through to approved tenancies.

**Why this priority**: Essential for the core business flow - agencies need to onboard tenants to generate revenue.

**Independent Test**: Can be fully tested by creating a tenant, processing their application, and converting to a tenancy

**Acceptance Scenarios**:

1. **Given** an agency admin is logged in, **When** they create a tenant account with email, **Then** the tenant receives an invite email and can set their password via setup link
2. **Given** a tenant account exists, **When** the admin creates an application for them, **Then** the admin can approve or reject the application
3. **Given** an approved application, **When** the admin converts it to a tenancy, **Then** they can assign tenant(s) to property/room, set dates, rent amount, and generate payment schedule

---

### User Story 4 - Tenant Portal Experience (Priority: P2)

Tenants access their portal to view tenancy details, sign agreements digitally, report maintenance, and track payments.

**Why this priority**: Critical for tenant adoption and reducing agency admin workload through self-service.

**Independent Test**: Can be fully tested by a tenant logging in, viewing their tenancy, signing an agreement, and submitting a maintenance request

**Acceptance Scenarios**:

1. **Given** a tenant with an active tenancy, **When** they log into the portal, **Then** they see their property address, rent amount, tenancy dates, and payment schedule
2. **Given** an unsigned tenancy agreement, **When** the tenant reviews and e-signs it, **Then** the signed copy is stored and downloadable by both tenant and agency
3. **Given** a maintenance issue, **When** the tenant submits a request with description and photos, **Then** they can track the request status through resolution
4. **Given** a tenant portal, **When** the tenant views payment history, **Then** they see all payments (paid, pending, overdue) with due dates and can download receipts

---

### User Story 5 - Landlord Portal Experience (Priority: P2)

Landlords access their portal to view their property portfolio, tenant information, and payment reports.

**Why this priority**: Landlords are key stakeholders who need visibility into their investments.

**Independent Test**: Can be fully tested by a landlord logging in and viewing their properties, tenants, and payment statements

**Acceptance Scenarios**:

1. **Given** a landlord with assigned properties, **When** they log into the portal, **Then** they see all their properties with occupancy status and current tenants
2. **Given** a landlord viewing a property, **When** they access payment reports, **Then** they see rent collected, payment history, and can download statements
3. **Given** a maintenance request on a landlord's property, **When** it is submitted, **Then** the landlord receives an email notification and can view issue details and resolution status in the portal

---

### User Story 6 - Payment Schedule & Tracking (Priority: P2)

Agency administrators have automated payment schedule generation and can track/record all tenant payments with automated reminders.

**Why this priority**: Payment management is core to agency operations and cash flow visibility.

**Independent Test**: Can be fully tested by creating a tenancy and verifying auto-generated payment schedule, recording payments, and confirming reminder delivery

**Acceptance Scenarios**:

1. **Given** a new tenancy is created, **When** the system processes it, **Then** monthly payments are auto-generated based on rent amount, frequency, and tenancy dates
2. **Given** a payment is due, **When** the admin records it as paid (full or partial), **Then** the payment status updates and notes can be added
3. **Given** configurable reminder settings, **When** a payment approaches due date, **Then** the system sends reminders before due date and overdue notices after

---

### User Story 7 - Public Property API (Priority: P3)

Agencies can access a public API to display their properties on their own website and receive viewing requests.

**Why this priority**: Nice-to-have feature that extends platform value but not essential for core operations.

**Independent Test**: Can be fully tested by authenticating with API key, fetching property listings, and submitting a viewing request

**Acceptance Scenarios**:

1. **Given** an agency with an API key, **When** they call the properties endpoint, **Then** they receive their public properties in a structured format
2. **Given** a website visitor viewing a property, **When** they submit a viewing request via API, **Then** the agency receives a notification and the visitor receives confirmation

---

### Edge Cases

- Agency subscription expiry: System enters read-only mode - users can view all data but cannot create or edit until subscription is renewed
- Overlapping tenancy dates for the same property/room: System prevents overlaps by validating date conflicts during tenancy creation/modification
- Tenant in multiple agencies: Each agency has separate user accounts - a person renting from Agency A and Agency B has two distinct portal accounts
- Partial payments: System supports multiple payments against one schedule with balance tracking; status auto-updates to 'partial' when partially paid
- Certificate expiry without renewal: System continues sending reminders and flags certificate as expired; property remains operational but compliance status shows warning
- Custom domain DNS misconfiguration: System displays configuration error in admin settings; agency portal remains accessible via standard URL (`portal.letably.com/{slug}/`) until DNS is correctly configured
- Landlord removal with active properties: Allowed - properties become unassigned (landlord link set to null)

---

## Requirements *(mandatory)*

### Functional Requirements

**Multi-Tenancy & Isolation**

- **FR-001**: System MUST support multiple agencies on a single deployment with complete data isolation
- **FR-002**: System MUST ensure each agency can only access their own data (properties, tenants, landlords, payments)
- **FR-003**: System MUST support agency-specific branding (logo, primary color)
- **FR-004**: System MUST provide each agency a unique portal URL (`portal.letably.com/{slug}/`)
- **FR-005**: System MUST support custom domain configuration for premium agencies
- **FR-005a**: System MUST enforce read-only mode for agencies with expired subscriptions (view access only, no create/edit)

**User Management**

- **FR-006**: System MUST support distinct user roles: Agency Admin, Tenant, Landlord
- **FR-007**: System MUST allow agency admins to create and manage user accounts within their agency
- **FR-008**: System MUST send email invitations with secure password setup links
- **FR-009**: System MUST support password reset functionality for all user types

**Property Management**

- **FR-010**: System MUST allow creation of properties with address, description, photos, and status (live/draft)
- **FR-011**: System MUST support room-level management within properties
- **FR-012**: System MUST track property compliance certificates with expiry dates
- **FR-013**: System MUST send expiry reminders for certificates before they expire
- **FR-014**: System MUST allow properties to be assigned to landlords (nullable - properties can exist without landlord assignment)
- **FR-014a**: System MUST allow landlord removal even with assigned properties (properties become unassigned)

**Tenant & Tenancy Management**

- **FR-015**: System MUST support tenant application workflow with states: Pending → Awaiting Guarantor (if required) → Submitted → Approved → Converted to Tenancy
- **FR-016**: System MUST allow creation of tenancies linking tenants to properties/rooms with status workflow: Pending → Awaiting Signatures → Signed → Approval → Active → Expired

- **FR-017**: System MUST support tenancy details: start/end dates, rent amount, payment frequency, payment option (monthly, quarterly, upfront)
- **FR-017a**: System MUST prevent overlapping tenancy dates for the same property/room (validation blocks conflicting date ranges)
- **FR-018**: System MUST generate digital tenancy agreements for e-signature using typed signature (name matching tenant name)
- **FR-018a**: System MUST support individual signing by each tenant member with HTML snapshot of signed agreement stored
- **FR-018b**: System MUST support guarantor agreements via token-based public URLs when guarantor is required
- **FR-019**: System MUST store signed agreements and make them downloadable

**Maintenance**

- **FR-020**: System MUST allow tenants to submit maintenance requests with descriptions and photos
- **FR-021**: System MUST track maintenance request status through 3-state workflow: Submitted → In Progress → Completed
- **FR-021a**: System MUST support maintenance request priority levels: Low, Medium, High
- **FR-021b**: System MUST support maintenance request categories: Plumbing, Electrical, Heating, Appliances, Structural, Pest Control, General, Other
- **FR-022**: System MUST notify landlords when maintenance is reported on their properties

**Payments**

- **FR-023**: System MUST auto-generate payment schedules based on tenancy terms using PCM (per calendar month) calculation method
- **FR-023a**: System MUST support payment options: monthly, quarterly, monthly_to_quarterly, upfront
- **FR-023b**: System MUST generate deposit payments due 7 days before tenancy start
- **FR-023c**: System MUST auto-generate rolling monthly payments via scheduled job for rolling tenancies
- **FR-024**: System MUST support recording multiple payments against a single schedule (partial payments)
- **FR-024a**: System MUST prevent overpayment (payment cannot exceed remaining balance)
- **FR-025**: System MUST track payment status: pending, paid, partial, overdue (auto-updated daily)
- **FR-026**: System MUST send configurable payment reminders and overdue notices
- **FR-027**: System MUST provide payment history and downloadable receipts

**Reporting**

- **FR-028**: System MUST provide landlords with payment/income reports per property
- **FR-029**: System MUST allow landlords to download payment statements

**API (Optional)**

- **FR-030**: System MUST provide authenticated read-only API for public property listings
- **FR-031**: System MUST support viewing request submission via API

### Key Entities

- **Agency**: Represents a letting agency tenant of the platform. Has branding settings, subscription tier, users, properties.
- **User**: A person who can log in. Belongs to an agency with a specific role (Admin, Tenant, Landlord). May be associated with multiple roles.
- **Property**: A rental property managed by an agency. Has address, description, photos, status, and may contain multiple rooms.
- **Room**: An individual lettable unit within a property. Has price, availability, features.
- **Certificate**: Compliance document for a property (Gas Safety, EPC, Electrical). Has document file and expiry date.
- **Landlord**: A property owner linked to an agency. Can have multiple properties assigned.
- **Tenant**: A renter linked to an agency. Has applications and tenancies.
- **Application**: A rental application from a tenant for a property/room. Has status (pending, awaiting_guarantor, submitted, approved, converted_to_tenancy), guarantor requirement flag, and form data.
- **Tenancy**: Rental agreement linking tenant(s) to property/room. Has status (pending, awaiting_signatures, signed, approval, active, expired, taken_over, awaiting_new_tenancy), dates, rent terms, payment option, and linked agreement documents.
- **TenancyMember**: Links a tenant to a tenancy. Has signature status, signature data, signed agreement HTML snapshot, and signed timestamp.
- **GuarantorAgreement**: Guarantor commitment for a tenancy member. Has access token, signature status, signature data, and signed agreement HTML.
- **PaymentSchedule**: A scheduled payment obligation. Has due date, amount due, payment type (rent/deposit/utilities/fees/other), schedule type (automated/manual), covers_from/covers_to dates, and status (pending/paid/partial/overdue).
- **Payment**: An individual payment record against a schedule. Has amount, payment date, and optional reference. Multiple payments can apply to one schedule for partial payment tracking.
- **MaintenanceRequest**: An issue reported by a tenant. Has title, description, category (plumbing/electrical/heating/appliances/structural/pest_control/general/other), priority (low/medium/high), status (submitted/in_progress/completed), photos, and comment thread with optional attachments.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Adoption & Usage**

- **SC-001**: 5+ agencies onboarded within first year
- **SC-002**: 500+ monthly active users across all agencies
- **SC-003**: 80% of tenants log into their portal at least once
- **SC-004**: 90%+ of tenancy agreements signed digitally (vs. paper)

**User Experience**

- **SC-005**: Users can complete agency signup and branding setup in under 10 minutes
- **SC-006**: Agency admins can add a new property with rooms in under 5 minutes
- **SC-007**: Tenants can submit a maintenance request in under 2 minutes
- **SC-008**: Page load time under 2 seconds for all portal pages

**Operational Efficiency**

- **SC-009**: Support tickets per agency under 5 per month
- **SC-010**: Zero data leakage incidents between agencies (complete tenant isolation)
- **SC-011**: System supports 50+ concurrent users per agency without degradation
- **SC-012**: 99.5% uptime availability

**Compliance**

- **SC-013**: All certificate expiry reminders sent at least 30 days before expiry
- **SC-014**: GDPR compliance: user data exportable and deletable on request

---

## Constraints

### Technical Constraints

- Must migrate from existing SQLite codebase to PostgreSQL
- Must maintain compatibility with existing Steel City Living data
- Single deployment serves all agencies (no per-agency deployments)

### Business Constraints

- Steel City Living is first customer (founding agency)
- Must support existing Steel City Living workflows
- Premium features (custom domain, "Powered by" removal) require subscription tier

### Timeline Constraints

- Phase 1 MVP: Core multi-tenancy, white-labeling, existing features
- Public API: Post-MVP
- Super-admin dashboard: Post-MVP

---

## Out of Scope (v1.0)

- Online rent payment processing (Stripe/GoCardless integration)
- Automated reference checking
- Inventory check-in/check-out
- Mobile native apps (web responsive only)
- Multi-language support
- Integration with Rightmove/Zoopla
- Platform super-admin dashboard

---

## Assumptions

- Agencies will have their own email domains for professional communication
- Tenants and landlords have access to email for account invitations
- UK letting regulations regarding required certificates are known and documented
- Standard web browser access is sufficient (no offline requirements)
- Payment recording is manual entry; no direct bank integration in v1.0
- Single currency (GBP) for all monetary values
- English language only for v1.0

---

## Dependencies

- Email delivery service for invitations, notifications, and reminders
- File storage service for photos, documents, and certificates
- SSL certificate provisioning for custom domains
- DNS management capability for custom domain verification

---

*Specification Version: 1.0*
*Created: January 2026*
