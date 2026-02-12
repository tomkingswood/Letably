# Implementation Plan: Letably Platform

**Branch**: `001-letably-platform` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-letably-platform/spec.md`
**Reference Plan**: `H:\SCL (New)\docs\speckit\plan.md`

## Summary

Letably is a multi-tenant property management SaaS platform for UK letting agencies. The implementation transforms the existing Steel City Living (SCL) single-tenant application into a multi-agency platform with white-labeling, data isolation via PostgreSQL Row-Level Security (RLS), and custom domain support for premium agencies.

## Technical Context

**Language/Version**: Node.js 18+, TypeScript 5.x (frontend)
**Primary Dependencies**: Express.js (backend), Next.js 14 (frontend), React, TailwindCSS, Shadcn/ui
**Storage**: PostgreSQL 15+ with Row-Level Security (migrating from SQLite)
**Testing**: Jest (unit), Supertest (API integration), Playwright (E2E)
**Target Platform**: Linux server (OVH VPS), web browsers (responsive)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: <2s page load, <500ms API response (p95), 50+ concurrent users per agency
**Constraints**: Single deployment serves all agencies, must migrate existing SCL data
**Scale/Scope**: Phase 1: 5-20 agencies, 500+ MAU; Phase 3: 100+ agencies

## Constitution Check

*GATE: No constitution defined for this project. Proceeding with standard best practices.*

- **Data Isolation**: RLS policies enforce agency boundaries at database level
- **Security**: JWT with agency context, bcrypt password hashing, HTTPS only
- **Testing**: Unit, integration, E2E, and security tests required
- **Observability**: Structured logging, error tracking

## Project Structure

### Documentation (this feature)

```text
specs/001-letably-platform/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── controllers/     # Request handlers (existing patterns from SCL)
│   ├── middleware/      # Auth, agency context, rate limiting
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic (email, payments, agreements)
│   ├── helpers/         # Utility functions
│   ├── validators/      # Input validation
│   └── db.js            # PostgreSQL connection (migrated from SQLite)
└── tests/
    ├── unit/
    ├── integration/
    └── security/

frontend/
├── app/                 # Next.js App Router pages
│   ├── [agency]/        # Dynamic agency routing
│   │   ├── login/
│   │   ├── admin/
│   │   ├── tenant/
│   │   └── landlord/
│   └── api/             # API routes (if needed)
├── components/          # React components (Shadcn/ui based)
├── lib/                 # Utilities, API client, auth context
└── tests/
    └── e2e/             # Playwright tests

shared/                  # Shared types/contracts (optional)
```

**Structure Decision**: Web application structure matching existing SCL codebase. Frontend uses Next.js App Router with dynamic `[agency]` routing for multi-tenancy. Backend remains Express.js with PostgreSQL replacing SQLite.

## Reference Codebase

The existing Steel City Living application at `H:\SCL (New)\` serves as the foundation. All patterns are preserved but adapted for multi-tenancy by adding `agency_id` filtering.

### Key Backend Files to Adapt

| Component | Source Path | Adaptation Required |
|-----------|-------------|---------------------|
| Server Entry | `backend/src/server.js` | Add agency context middleware |
| Database | `backend/src/db.js` | PostgreSQL with RLS |
| Auth | `backend/src/middleware/auth.js` | Include `agency_id` in JWT |
| Rate Limiting | `backend/src/middleware/rateLimiter.js` | Per-agency limits |
| All Controllers | `backend/src/controllers/*.js` | Agency context filtering |
| Email Service | `backend/src/services/emailService.js` | Agency branding |
| Payment Service | `backend/src/services/paymentService.js` | Agency scoping |

### Key Frontend Files to Adapt

| Component | Source Path | Adaptation Required |
|-----------|-------------|---------------------|
| App Layout | `frontend/app/layout.tsx` | Agency context provider |
| API Client | `frontend/lib/api.ts` | Agency header injection |
| Auth Context | `frontend/lib/auth-context.tsx` | Agency info in context |
| All Pages | `frontend/app/*` | Move under `[agency]/` route |

## Technology Stack

### Confirmed (from SCL codebase)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14, React, TypeScript | Existing, proven |
| Styling | TailwindCSS, Shadcn/ui | Existing, consistent UI |
| Backend | Express.js, Node.js | Existing, familiar |
| Auth | JWT (jsonwebtoken) | Existing, stateless |
| Email | Nodemailer | Existing |
| PDF Generation | Custom service | Agreements, receipts |

### Changed for Multi-Tenancy

| Layer | From | To | Rationale |
|-------|------|-----|-----------|
| Database | SQLite (better-sqlite3) | PostgreSQL (pg) | RLS, concurrent connections, scalability |
| Session | JWT only | JWT + Redis (Phase 2) | Token invalidation, scalability |

### Infrastructure

| Component | Technology | Notes |
|-----------|------------|-------|
| Hosting | OVH VPS | Existing relationship |
| Web Server | Nginx | Reverse proxy, SSL, custom domains |
| Process Manager | PM2 | Node.js management |
| SSL | Let's Encrypt (certbot) | Auto-renewal, custom domain support |
| DNS | Cloudflare (optional) | Custom domain DNS verification |

## Phased Implementation

### Phase 1: Database Migration
- Set up PostgreSQL locally and on server
- Create migration scripts from SQLite schema
- Add `agencies` table and `agency_id` to all tables
- Create RLS policies for data isolation
- Migrate Steel City Living data as Agency 1
- Update backend to use PostgreSQL driver

### Phase 2: Multi-Tenancy Backend
- Create agency context middleware
- Update JWT to include `agency_id`
- Update all controllers to use agency context
- Add agency CRUD endpoints
- Update email service for agency branding
- Implement subscription/read-only mode logic

### Phase 3: Multi-Tenancy Frontend
- Implement dynamic `[agency]` routing
- Create agency context provider
- Update all API calls to include agency
- Implement white-labeling (logo, colors)
- Update layouts for agency branding

### Phase 4: Custom Domains (Premium)
- Add domain lookup middleware
- Configure Nginx for custom domains
- Implement Let's Encrypt auto-provisioning
- Add domain management to agency settings

### Phase 5: Public API (Post-MVP)
- Create public API routes
- Implement API key authentication
- Add rate limiting per API key
- API documentation

### Phase 6: Launch Prep
- Security audit
- Performance testing
- Backup/restore testing
- Monitoring setup
- Production deployment

## Complexity Tracking

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| PostgreSQL RLS | Database-level isolation is more secure than application-level filtering | Application-level `WHERE agency_id=?` - rejected as it requires perfect implementation in every query |
| Single deployment | Simpler ops, cost-effective for Phase 1 scale | Per-agency deployments - rejected as operationally complex |
| Path-based routing (`/agency/`) | Works with single deployment, no DNS complexity | Subdomain routing - rejected as requires wildcard DNS |

---

*Plan Version: 1.0*
*Created: 2026-01-31*
