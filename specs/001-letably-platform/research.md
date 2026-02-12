# Research: Letably Platform

**Branch**: `001-letably-platform` | **Date**: 2026-01-31

## Research Summary

Most technical decisions are pre-determined by the existing Steel City Living (SCL) codebase at `H:\SCL (New)\`. This research documents the key decisions for the new multi-tenancy requirements.

---

## Decision 1: Multi-Tenancy Data Isolation Strategy

**Decision**: PostgreSQL Row-Level Security (RLS)

**Rationale**:
- Database-enforced isolation prevents accidental data leaks even if application code has bugs
- Single database simplifies operations, backups, and migrations
- RLS policies are transparent to application code after initial setup
- PostgreSQL is proven for multi-tenant SaaS at this scale

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Application-level filtering (`WHERE agency_id=?`) | Every query must include filter - risk of leaks if forgotten |
| Separate databases per agency | Operationally complex, connection pooling challenges, migration overhead |
| Separate schemas per agency | Middle ground but still complex, no benefit over RLS |

**Implementation Pattern**:
```sql
-- Set agency context at connection level
SET app.agency_id = 1;

-- RLS policy automatically filters
CREATE POLICY agency_isolation ON properties
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Decision 2: Database Migration (SQLite → PostgreSQL)

**Decision**: PostgreSQL 15+ with pg driver

**Rationale**:
- Required for RLS (SQLite doesn't support it)
- Better concurrent connection handling for multi-tenant load
- Proven scalability path for SaaS applications
- Rich ecosystem (pgAdmin, pgBackRest, pg_stat_statements)

**Migration Strategy**:
1. Export SQLite schema to PostgreSQL-compatible DDL
2. Add `agency_id` column to all tenant-scoped tables
3. Create `agencies` table
4. Migrate existing SCL data with `agency_id = 1`
5. Create RLS policies
6. Update backend db.js to use `pg` driver

**Key Schema Changes**:
- `INTEGER PRIMARY KEY` → `SERIAL PRIMARY KEY`
- `TEXT` → `TEXT` (compatible)
- `REAL` → `NUMERIC(10,2)` for money
- `BOOLEAN` (0/1) → `BOOLEAN` (native)
- Add `agency_id` FK to all tenant tables

---

## Decision 3: Frontend Multi-Tenancy Routing

**Decision**: Path-based routing (`/agency-slug/...`)

**Rationale**:
- Works with single deployment on single domain
- No DNS complexity (wildcard certificates, CNAME setup)
- Easy to test locally without DNS changes
- Custom domains handled separately via Nginx

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Subdomain routing (`agency.letably.com`) | Requires wildcard SSL, DNS complexity |
| Query parameter (`?agency=slug`) | Poor UX, not bookmarkable per-agency |

**Implementation**:
```
portal.letably.com/steelcity/login
portal.letably.com/steelcity/admin/properties
portal.letably.com/steelcity/tenant/dashboard
```

Next.js App Router structure:
```
app/
├── [agency]/
│   ├── layout.tsx      # Agency context provider
│   ├── login/page.tsx
│   ├── admin/
│   └── tenant/
```

---

## Decision 4: Custom Domain Handling (Premium)

**Decision**: Nginx reverse proxy with domain lookup middleware

**Rationale**:
- Nginx can route multiple domains to same Next.js app
- Let's Encrypt certbot supports automatic SSL provisioning
- Domain-to-agency mapping stored in database

**Flow**:
1. Custom domain DNS points to Letably server
2. Nginx routes request to Next.js
3. Middleware looks up domain in `agencies.custom_portal_domain`
4. Agency context set from lookup result
5. Request proceeds with agency context

**Nginx Configuration Pattern**:
```nginx
server {
    listen 443 ssl;
    server_name *.letably.com portal.myagency.com portal.otheragency.com;

    ssl_certificate /etc/letsencrypt/live/letably.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/letably.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Decision 5: Authentication with Agency Context

**Decision**: JWT with `agency_id` claim

**Rationale**:
- Stateless, scales horizontally
- Agency context embedded in token - no extra DB lookup per request
- Existing SCL implementation uses JWT - minimal changes

**JWT Payload Structure**:
```json
{
  "user_id": 123,
  "agency_id": 1,
  "role": "admin",
  "iat": 1706745600,
  "exp": 1706832000
}
```

**Middleware Flow**:
1. Extract JWT from `Authorization: Bearer {token}`
2. Validate signature and expiry
3. Extract `agency_id` from payload
4. Set PostgreSQL session: `SET app.agency_id = {agency_id}`
5. RLS automatically filters all queries

---

## Decision 6: Email Service Branding

**Decision**: Template variables for agency branding

**Rationale**:
- Single email service with dynamic branding
- Agency logo and colors injected into templates
- Consistent structure, agency-specific appearance

**Template Variables**:
```javascript
const emailContext = {
  agency_name: agency.name,
  agency_logo_url: agency.logo_url,
  agency_primary_color: agency.primary_color,
  agency_email: agency.email,
  agency_phone: agency.phone,
  portal_url: `https://portal.letably.com/${agency.slug}/`
};
```

---

## Decision 7: Subscription & Read-Only Mode

**Decision**: Database flag with middleware enforcement

**Rationale**:
- Simple boolean check in middleware
- Read endpoints allowed, write endpoints blocked
- Clear user feedback when blocked

**Implementation**:
```javascript
// Agency middleware
if (!agency.is_active || agency.subscription_expired) {
  if (req.method !== 'GET') {
    return res.status(403).json({
      error: 'Subscription expired',
      message: 'Your subscription has expired. Contact support to renew.'
    });
  }
}
```

---

## Decision 8: Payment Calculation Method

**Decision**: PCM (Per Calendar Month) - UK standard

**Rationale**:
- UK letting industry standard
- Existing SCL implementation uses this method
- Handles partial months correctly

**Formula**:
```javascript
// Partial month calculation
const partialAmount = (daysInPeriod / daysInMonth) * monthlyRate;

// Monthly rate from weekly
const monthlyRate = (weeklyRate * 52) / 12;
```

---

## Outstanding Research (Deferred)

| Topic | Phase | Notes |
|-------|-------|-------|
| Redis session store | Phase 2+ | For token invalidation at scale |
| CDN for assets | Phase 3+ | CloudFlare or similar for static files |
| Monitoring stack | Phase 6 | Prometheus/Grafana or managed service |
| Backup automation | Phase 6 | pgBackRest or managed PostgreSQL |

---

*Research Version: 1.0*
*Created: 2026-01-31*
