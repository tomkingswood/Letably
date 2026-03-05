# Letably Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-31

## Active Technologies

- Node.js 18+, TypeScript 5.x (frontend) + Express.js (backend), Next.js 14 (frontend), React, TailwindCSS, Shadcn/ui (001-letably-platform)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

Node.js 18+, TypeScript 5.x (frontend): Follow standard conventions

## Recent Changes

- 001-letably-platform: Added Node.js 18+, TypeScript 5.x (frontend) + Express.js (backend), Next.js 14 (frontend), React, TailwindCSS, Shadcn/ui

<!-- MANUAL ADDITIONS START -->

## Frontend Agency Slug Routing

**CRITICAL: All user-facing portal pages (tenant, landlord, admin) MUST live under the `app/[agency]/` route segment.**

- The `[agency]` dynamic segment is the agency slug (e.g. `test`, `acme-lettings`). It determines which agency's data to load.
- `app/[agency]/layout.tsx` wraps all child routes with `AgencyProvider` (resolves agency from slug, provides branding) and `AuthProvider` (manages agency-scoped auth tokens in localStorage as `token_<slug>`, `user_<slug>`).
- Without the agency slug in the URL, the app has no way to know which agency context to use — API calls, auth tokens, and data are all scoped per agency.
- Pages under `[agency]/` use `useAuth()` from `lib/auth-context.tsx` (NOT `hooks/useAuth.ts`) and `useAgency()` from `lib/agency-context.tsx` for authentication and agency context.
- Role-based auth guards are implemented as layout files (e.g. `[agency]/admin/layout.tsx`, `[agency]/tenancy/layout.tsx`) that check `user.role` and redirect unauthorized users to `/${agencySlug}`.
- The `hooks/useAuth.ts` hooks (`useRequireTenant`, `useRequireLandlord`, etc.) are for pages NOT under `[agency]/` that use the `lastAgencySlug` fallback. Pages under `[agency]/` should always use the context-based auth.

## Custom Domain Support

Agencies can optionally use a custom portal domain (e.g. `portal.steelcityliving.com`) instead of `letably.com/steel-city-living`. When a custom domain is active, the agency slug is invisible to users — all URLs are clean (e.g. `/admin`, `/tenancy`).

### How it works

1. **Next.js middleware** (`frontend/middleware.ts`) detects non-platform hostnames via `isPlatformHost()` (checks for `localhost`, `letably.com`, `vercel.app`). Any other hostname is treated as a custom domain.
2. Middleware resolves the domain to a slug by calling `GET /api/agencies/resolve-domain?domain=<host>` (with a 5-minute in-memory cache).
3. Middleware **rewrites** the URL internally: `portal.example.com/admin` → `/steel-city-living/admin`. The browser URL stays clean — the slug is only in the internal Next.js routing.
4. The `[agency]` layout picks up the slug from the rewritten URL as normal.

### CRITICAL: Use `buildPath()` for ALL internal links

**NEVER hardcode `/${agencySlug}/...` in links or redirects.** Always use `buildPath()` from the agency context:

```typescript
const { buildPath } = useAgency();

// GOOD — works on both platform domain and custom domain
<Link href={buildPath('/admin')}>Admin</Link>
router.push(buildPath('/tenancy'));
window.location.href = buildPath('/login');

// BAD — breaks on custom domain (adds slug to URL)
<Link href={`/${agencySlug}/admin`}>Admin</Link>
```

`buildPath()` behaviour:
- **Platform domain** (`letably.com`): returns `/${agencySlug}/path` (slug visible in URL)
- **Custom domain** (`portal.example.com`): returns `/path` (no slug — middleware handles it)

### Components outside `[agency]` context

`Header.tsx` and other components that render outside the `AgencyProvider` cannot use `buildPath()`. These use a standalone `isCustomDomainHost()` check:

```typescript
function isCustomDomainHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return !host.includes('localhost') && !host.includes('letably.com') && !host.includes('vercel.app');
}
const prefix = (agencySlug && !isCustomDomainHost()) ? `/${agencySlug}` : '';
```

### API calls from the browser

All client-side API calls use the relative URL `/api` (not `http://localhost:3001/api`). Next.js `rewrites` in `next.config.js` proxy these to the backend. This is essential for custom domains — browsers block cross-origin requests to private network addresses (localhost) from non-localhost origins.

```typescript
// frontend/lib/api.ts
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL_INTERNAL || 'http://localhost:3001/api';
  }
  return '/api';  // Client-side: relative URL proxied by Next.js
};
```

### Backend email links

When the backend generates links in emails (setup-password, guarantor signing, etc.), use `buildAgencyUrl()` from `backend/src/utils/urlBuilder.js` with the optional `customDomain` parameter:

```javascript
const { buildAgencyUrl } = require('../utils/urlBuilder');

// If agency has a custom domain, links use it; otherwise, falls back to slug-based URL
const url = buildAgencyUrl(agency.slug, 'setup-password/TOKEN', agency.custom_portal_domain);
// → "https://portal.example.com/setup-password/TOKEN"  (custom domain)
// → "https://letably.com/steel-city-living/setup-password/TOKEN"  (platform domain)
```

The custom domain is available in three places depending on context:
- **`req.agency.custom_portal_domain`** — from agencyContext or auth middleware
- **`branding.customDomain`** — from `getAgencyBranding(agencyId)` (most email code uses this)
- **Direct SQL** — `SELECT custom_portal_domain FROM agencies WHERE id = $1`

When adding new email-generating code, use `branding.customDomain` if you already have branding, or `req.agency?.custom_portal_domain` in controllers.

### Admin setup

Custom domains are configured **only** by super admins at `/sup3rAdm1n/agencies/[id]`. Agencies cannot self-configure custom domains. The `agencies.custom_portal_domain` column stores the domain — if it's set, it's active (no verification step). DNS/SSL configuration is handled manually by the platform operator.

### Key files

| File | Role |
|------|------|
| `frontend/middleware.ts` | Custom domain detection, slug resolution, URL rewriting |
| `frontend/lib/agency-context.tsx` | `buildPath()`, `isCustomDomain` flag |
| `frontend/lib/api.ts` | Relative `/api` URL for client-side (proxied) |
| `frontend/next.config.js` | Rewrites that proxy `/api` to backend |
| `frontend/components/ui/Header.tsx` | `isCustomDomainHost()` for outside-context links |
| `backend/src/models/agency.js` | `findByDomain()` — looks up agency by domain |
| `backend/src/controllers/agencyController.js` | `resolveDomain` endpoint for middleware |
| `backend/src/utils/urlBuilder.js` | `buildAgencyUrl()` with optional custom domain |
| `backend/src/controllers/superController.js` | `updateCustomDomain` — super admin endpoint |
| `frontend/app/sup3rAdm1n/agencies/[id]/page.tsx` | Custom domain management UI |

## Multi-Tenancy Safety Rules

**CRITICAL: Every SQL query in the backend MUST include an explicit `AND agency_id = $N` filter in the WHERE clause.**

- Development uses `postgres` (superuser) which bypasses RLS. Production uses a non-superuser where RLS acts as a secondary safety net.
- The primary tenant isolation MUST come from explicit `WHERE agency_id = $N` in every query. Never rely on RLS alone.
- This applies to ALL query types: SELECT, UPDATE, DELETE. INSERT queries must include `agency_id` in the VALUES.
- When building dynamic queries (e.g. with optional filters), always start with `WHERE table.agency_id = $1` as the base condition, never `WHERE 1=1`.
- For JOINed queries, filter on the primary table's `agency_id` (e.g. `AND t.agency_id = $N` when querying tenancy_members via tenancies).
- Always use `db.query(sql, params, agencyId)` with the third `agencyId` argument to set the RLS session context. This ensures RLS is active as a secondary safety net, but it does NOT add a WHERE filter — you must do both.
- Never use `db.systemQuery()` for application queries — it bypasses RLS context and has no agency filter. Reserve it for system/migration scripts only.

## Application form_data Pattern

**The `applications` table uses a hybrid storage pattern: core SQL columns for always-present fields + a JSONB `form_data` column for conditional fields.**

### Why

Application data varies by `application_type` (student vs professional) and `residential_status` (Private Tenant shows landlord fields, etc.). Instead of 30+ nullable columns, conditional fields are stored in a single JSONB column. A `form_version` integer tracks which form version created the data.

### Column split

**Core columns** (always present, used for workflow/queries):
- Personal: `title`, `title_other`, `first_name`, `middle_name`, `surname`, `email`, `phone`, `date_of_birth`, `current_address`, `id_type`, `payment_method`
- Declaration: `declaration_name`, `declaration_agreed`, `declaration_date`
- Workflow: `status`, `completed_at`, `guarantor_token`, `guarantor_token_expires_at`, `guarantor_completed_at`

**JSONB `form_data`** (conditional, defined in `helpers/formData.js`):
- Address: `residential_status`, `residential_status_other`, `period_years`, `period_months`, `address_history`
- Landlord (Private Tenant only): `landlord_name`, `landlord_address`, `landlord_email`, `landlord_phone`
- Student only: `university`, `year_of_study`, `course`, `student_number`, `payment_plan`
- Professional only: `employment_type`, `company_name`, `employment_start_date`, `contact_name`, `contact_job_title`, `contact_email`, `contact_phone`, `company_address`
- Guarantor (only when `guarantor_required = true`): `guarantor_name`, `guarantor_dob`, `guarantor_email`, `guarantor_phone`, `guarantor_address`, `guarantor_relationship`, `guarantor_id_type`, `guarantor_signature_name`, `guarantor_signature_agreed`

### How to read application data

All repository read functions (`getApplicationById`, `getAllApplications`, etc.) automatically **hydrate** the result — `form_data` fields are spread onto the row with safe defaults. Callers access `application.residential_status`, `application.landlord_name`, etc. directly, exactly like regular columns.

```javascript
// Repository does this internally:
const app = hydrateApplication(row); // spreads form_data onto row
// Callers use flat access:
app.residential_status // works
app.landlord_name      // works, returns null if not set
```

**If writing a direct SQL query** (not through the repository), either:
1. Call `hydrateApplication(row)` from `helpers/formData.js` after the query
2. Or use `form_data->>'field_name'` in the SQL: `SELECT form_data->>'payment_plan' as payment_plan FROM applications`

### How to write application data

Pass a flat object to `appRepo.updateApplication()`. The repository separates core columns from form_data fields automatically via `extractFormData()`.

```javascript
// Controller passes flat object — repo handles the split:
await appRepo.updateApplication(id, {
  email, phone, // core columns
  residential_status, landlord_name, // goes to form_data automatically
  address_history: addressHistoryJson, // JSON string parsed back to array
}, agencyId);
```

### Guarantor data

Guarantor personal fields are stored in `form_data` (conditional on `guarantor_required`). The guarantor form submission uses `updateGuarantorInfo()` which **merges** into existing form_data via PostgreSQL `COALESCE(form_data, '{}')::jsonb || $1::jsonb` — this preserves any applicant-submitted form_data fields while adding/overwriting the guarantor fields. Guarantor workflow columns (`guarantor_token`, `guarantor_token_expires_at`, `guarantor_completed_at`) remain as core columns.

### Legacy column compatibility

Some form_data fields also exist as legacy SQL columns (e.g. `payment_plan`, `guarantor_name`). The hydration logic handles this: form_data value takes priority, but if form_data is empty for a field, the legacy column value is preserved. Direct SQL queries should use `COALESCE(form_data->>'field', legacy_column) as field`.

### Key files

| File | Role |
|------|------|
| `helpers/formData.js` | `hydrateApplication()`, `extractFormData()`, field defaults |
| `repositories/applicationRepository.js` | All CRUD — hydrates on read, extracts on write |
| `migrations/add_missing_columns.sql` | Schema: core columns + form_data JSONB + form_version |

## PostgreSQL Numeric Columns in Frontend

**CRITICAL: PostgreSQL returns `DECIMAL`/`NUMERIC` columns as strings, not numbers.** Even though TypeScript interfaces type these as `number`, the runtime value from the API will be `"125.00"` (a string).

**Always wrap with `Number()` before calling `.toFixed()`:**
```typescript
// BAD — will crash at runtime if value is a string from the API
amount.toFixed(2)
price_pppw.toFixed(2)

// GOOD — defensive, works with both string and number
Number(amount).toFixed(2)
Number(price_pppw).toFixed(2)
```

This applies to any value from the API that represents money (`amount`, `amount_due`, `amount_paid`, `price_pppw`, `deposit_amount`, `rent_pppw`).

When storing these values in state via `parseFloat()` or `Number()`, coerce them at the point of assignment rather than at the point of display, so the runtime type matches the TypeScript type.

<!-- MANUAL ADDITIONS END -->
