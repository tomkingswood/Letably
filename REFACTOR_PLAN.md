# Codebase Refactoring Report v2

**Generated:** 2026-02-12
**Scope:** Full codebase audit — backend + frontend, focused on AI context-loss patterns
**Files analyzed:** 150+ TypeScript/JavaScript files

**Previous report status:** v1 dead code items (sections 2.1–2.7) and frontend refactoring batches 1–5 have been completed. This report covers remaining duplication and new findings.

---

## Executive Summary

The codebase shows clear signs of **AI context-loss across sessions**: identical patterns re-implemented independently, entity types defined 3–4 times with subtle differences, and boilerplate copy-pasted with minor variable name swaps. The backend has ~150 duplicated "get by ID" query blocks and 9 controllers still using legacy error handling. The frontend has 15+ pages with the same auth+load+error scaffolding and 5 entity types each defined in 3+ locations with conflicting shapes.

**Estimated removable duplication:** 3,000–4,000 lines across both codebases.

---

## 1. Backend: Error Handling — 9 Controllers Still on Legacy Pattern

The codebase has been migrating from manual try/catch to `asyncHandler`, but 9 controllers still use the old pattern. Both patterns do the same thing — the only difference is boilerplate.

**Pattern A (target — used by 24+ controllers):**
```javascript
exports.fn = asyncHandler(async (req, res) => {
  // errors auto-caught
}, 'operation description');
```

**Pattern B (legacy — 9 controllers, ~60 functions):**
```javascript
exports.fn = async (req, res) => {
  try { /* ... */ } catch (err) { handleError(res, err, 'operation description'); }
};
```

### Files still using Pattern B

| Controller | Functions using try/catch | Lines |
|-----------|--------------------------|-------|
| `agencyController.js` | `register`, `updateBranding`, `setupCustomDomain` | 17, 108, 193 |
| `certificatesController.js` | `uploadCertificate` | 103–204 |
| `guarantorController.js` | `signAgreement` | 64–99 |
| `idDocumentsController.js` | `downloadApplicantId`, `downloadGuarantorId` | 205–269, 276–329 |
| `landlordPanelController.js` | `downloadMonthlyStatementPDF`, `downloadAnnualStatementPDF` | 583–757, 762–931 |
| `settingsController.js` | Most functions | throughout |
| `tenancyCommunicationController.js` | Multiple functions | throughout |
| `tenantDocumentsController.js` | Multiple functions | throughout |
| `pdfGeneratorController.js` | Multiple functions | throughout |

**Fix:** Wrap each function in `asyncHandler(async (req, res) => { ... }, 'description')`. Remove the try/catch. Where the catch block does something beyond `handleError` (e.g., custom status codes), keep the extra logic inside the asyncHandler body using thrown errors.

**Risk:** LOW — asyncHandler calls `handleError` internally, so behavior is identical.

---

## 2. Backend: "Get Entity by ID" — 150+ Duplicate Query Blocks

Nearly every controller contains this pattern, copy-pasted and adjusted for table/column names:

```javascript
const result = await db.query(
  'SELECT * FROM <table> WHERE id = $1 AND agency_id = $2',
  [id, agencyId],
  agencyId
);
if (!result.rows[0]) {
  return res.status(404).json({ error: '<Entity> not found' });
}
const entity = result.rows[0];
```

This appears **150+ times** across 24 controllers with only the table name, variable name, and error message changing.

### Proposed helper

```javascript
// utils/entityFetchers.js
async function findByIdOrFail(table, id, agencyId, entityLabel) {
  const result = await db.query(
    `SELECT * FROM ${table} WHERE id = $1 AND agency_id = $2`,
    [id, agencyId], agencyId
  );
  if (!result.rows[0]) {
    const err = new Error(`${entityLabel} not found`);
    err.statusCode = 404;
    throw err;
  }
  return result.rows[0];
}
```

**Usage:** `const bedroom = await findByIdOrFail('bedrooms', id, agencyId, 'Bedroom');`

**Risk:** LOW — the SQL and error shape are identical everywhere. Must handle the few cases that SELECT specific columns instead of `*`.

---

## 3. Backend: PDF Statement Generation — ~350 Lines Duplicated

Two controllers generate PDF statements with ~90% identical code:

| Controller | Function | Lines |
|-----------|----------|-------|
| `adminReportsController.js` | PDF generation | 59–190 |
| `landlordPanelController.js` | `downloadMonthlyStatementPDF` | 583–757 |
| `landlordPanelController.js` | `downloadAnnualStatementPDF` | 762–931 |

All three create a `PDFDocument` with identical margins, render the same header with agency branding, draw the same table structure with identical column positions, and format currency/dates the same way. Only the title text and data source differ.

**Fix:** Extract to `services/pdfStatementService.js` with parameterized title/data. All three call sites become ~10 lines each.

**Risk:** MEDIUM — PDF layout is pixel-sensitive; test visually after extraction.

---

## 4. Backend: Email Composition — Repeated Across 3+ Controllers

The email-building pattern (fetch branding → build HTML with `createEmailTemplate` → build plain text → call `queueEmail`) appears in:

- `applicationsController.js` (welcome email, guarantor notification)
- `maintenanceController.js` (admin/landlord/tenant notifications)
- `landlordPanelController.js` (various notifications)
- `tenancyCommunicationController.js` (message notifications)

Each builds the email object slightly differently but the structure is identical: subject, HTML via template, plain text fallback, priority, recipient.

**Fix:** Create `helpers/emailBuilder.js`:
```javascript
function buildAndQueueEmail({ to, subject, bodyHtml, bodyText, branding, priority = 1 }, agencyId) {
  const html = createEmailTemplate(subject, bodyHtml, branding);
  return queueEmail({ to_email: to.email, to_name: to.name, subject, html_body: html, text_body: bodyText, priority }, agencyId);
}
```

**Risk:** LOW — wrapper only, doesn't change email content.

---

## 5. Backend: Response Format Inconsistency — 4 Styles

Controllers return data in 4 different shapes:

| Style | Example | Controllers |
|-------|---------|-------------|
| `{ entity }` | `res.json({ agency })` | agencyController, most GETs |
| `{ message, entity }` | `res.json({ message: 'Created', bedroom })` | bedroomsController, CUD operations |
| Direct data | `res.json(result.rows[0])` | applicationsController, remindersController |
| `{ message, ...spread }` | `res.json({ message: '...', ...result })` | agencyController.setupCustomDomain |

**Fix:** Standardize on `{ entity }` for reads and `{ message, entity }` for mutations. Updating this across the codebase can be done incrementally since the frontend already handles both shapes.

**Risk:** MEDIUM — frontend code that destructures responses must be updated in sync.

---

## 6. Backend: Validation Inconsistency — 3 Approaches

| Approach | Where | Example |
|----------|-------|---------|
| Shared validators (`validateEmail`, `validatePassword`) | `authController.js` only | `const { isValid, error } = validatePassword(password)` |
| Inline regex checks | `settingsController.js` | `const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| No validation | `guarantorController.js`, `certificateTypesController.js` | Missing parameter checks |

The email regex is defined locally in `settingsController.js` instead of reusing the validator in `utils/validators.js`. Phone and URL validation exist only in `settingsController.js`.

**Fix:** Add `validateUKPhoneNumber()` and `validateURL()` to `utils/validators.js`. Replace all inline regex checks.

**Risk:** LOW.

---

## 7. Backend: Route File Inconsistencies

### 7.1 Middleware application — 4 conflicting styles

| Style | Files |
|-------|-------|
| Global `router.use(authenticateToken, requireAdmin)` | adminReports, users, certificates, agreementSections, emailQueue, smtp |
| Per-route inline | reminders, auth, guarantor, super |
| Split (tenant routes first, then `router.use` for admin) | payments, tenancies, maintenance |
| Custom middleware arrays | images (`const adminImageMiddleware = [...]`) |

**Fix:** Standardize: use `router.use()` at top for single-role files; use per-route for mixed-role files with a clear comment separating sections.

### 7.2 Local rate limiters — 2 route files

| File | Limiter | Problem |
|------|---------|---------|
| `routes/super.js` (line 15) | `loginLimiter` | Uses raw `express-rate-limit` instead of `createRateLimiter` from `middleware/rateLimit.js` |
| `routes/guarantor.js` (lines 7–17) | `guarantorLimiter`, `guarantorSignLimiter` | Defined locally instead of exported from `rateLimit.js` |

**Fix:** Move all rate limiter definitions to `middleware/rateLimit.js` and export them.

### 7.3 Local multer configuration — 1 file

`routes/idDocuments.js` (lines 8–13) creates a local `multer({ storage: multer.memoryStorage() })` instead of using `uploadFactory.js`. This is the only file using memory storage.

**Fix:** Add an `idDocumentUpload` export to `uploadFactory.js`.

---

## 8. Frontend: Auth + Loading + Error Boilerplate — 15+ Pages

Nearly every page follows this identical ~60-line scaffold:

```tsx
const { isLoading: authLoading, isAuthenticated } = useRequireXxx();
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

useEffect(() => {
  if (!authLoading && isAuthenticated) fetchData();
}, [authLoading, isAuthenticated]);

const fetchData = async () => {
  try {
    setLoading(true);
    const response = await api.someCall();
    setData(response.data);
  } catch (err: unknown) {
    setError(getErrorMessage(err, 'Failed to load'));
  } finally {
    setLoading(false);
  }
};

if (authLoading || loading) return <LoadingSpinner ... />;
```

### Pages with this exact pattern

| Page | Auth hook | Lines of boilerplate |
|------|-----------|---------------------|
| `app/landlord/page.tsx` | `useRequireLandlord` | ~55 |
| `app/landlord/[id]/page.tsx` | `useRequireLandlord` | ~55 |
| `app/landlord/communication/page.tsx` | `useRequireLandlord` | ~45 |
| `app/landlord/maintenance/page.tsx` | `useRequireLandlord` | ~45 |
| `app/landlord/statements/page.tsx` | `useRequireLandlord` | ~60 |
| `app/landlord/reports/page.tsx` | `useRequireLandlord` | ~50 |
| `app/my-applications/page.tsx` | `useRequireAuth` | ~40 |
| `app/tenancy/page.tsx` | `useRequireTenant` | ~70 (7 try/catch blocks!) |
| `app/account/page.tsx` | `useRequireAuth` | ~55 |
| `app/applications/[id]/page.tsx` | `useRequireAuth` | ~100 |
| `app/[agency]/admin/landlords/[id]/page.tsx` | `useRequireAdmin` (context) | ~55 |
| `app/[agency]/admin/reminders/manage/page.tsx` | admin context | ~50 |
| `app/landlord/payment-calendar/page.tsx` | `useRequireLandlord` | ~45 |
| + 5 more admin pages | admin context | ~45 each |

**Total duplicated boilerplate:** ~800+ lines

### Proposed hook

```tsx
// hooks/useAuthenticatedData.ts
function useAuthenticatedData<T>(
  fetchFn: () => Promise<T>,
  options?: { errorMessage?: string }
): { data: T | null; loading: boolean; error: string; refetch: () => void }
```

Each page collapses from 60 lines of scaffolding to:
```tsx
const { data, loading, error } = useAuthenticatedData(
  () => api.landlordPanel.getDashboard().then(r => r.data)
);
```

**Risk:** LOW — purely additive, existing pages can migrate incrementally.

---

## 9. Frontend: Currency Formatting — 4+ Local Implementations

| File | Implementation | Line |
|------|---------------|------|
| `app/landlord/[id]/page.tsx` | `` const formatCurrency = (amount: number) => `£${amount.toFixed(2)}` `` | ~85 |
| `app/landlord/statements/page.tsx` | `new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)` | ~233 |
| `components/reports/utils.ts` | Same `Intl.NumberFormat` pattern | 5 |
| `components/shared/PaymentScheduleGrid.tsx` | Uses `calculatePaymentBreakdown` which formats internally | — |
| Various inline | `£${amount.toFixed(2)}` or `Intl.NumberFormat` scattered in JSX | multiple |

Note: `formatCurrency` in `components/reports/utils.ts` exists and is correct, but most pages don't import it.

**Fix:** Add `formatCurrency` to a shared `lib/formatters.ts` (or move from reports/utils.ts). Replace all local implementations.

**Risk:** LOW.

---

## 10. Frontend: Duplicate TypeScript Types — 5 Entities × 3+ Definitions Each

This is the most classic AI context-loss pattern: the same entity typed differently in different sessions.

### 10.1 Tenancy — 4 definitions

| Location | Fields | Status type | Notes |
|----------|--------|------------|-------|
| `lib/types.ts:159` | 29 fields | Union literal (6 values) | Canonical, includes members array |
| `components/tenancy/types.ts:20` | 10 fields | `string` | Missing tenancy_type, created_at, updated_at |
| `app/landlord/[id]/page.tsx:35` | 10 fields | `string` | Uses address_line1/city instead of property_address |
| `app/landlord/page.tsx:14` | ~12 fields | `string` | Local, different field set |

### 10.2 TenancyMember — 3 definitions

| Location | Fields | Key differences |
|----------|--------|----------------|
| `lib/types.ts:102` | 31 fields | Comprehensive, includes key tracking |
| `components/tenancy/types.ts:1` | 17 fields | Missing guarantor fields, key tracking |
| `app/landlord/[id]/page.tsx:12` | 11 fields | Uses `surname` instead of `last_name`; adds `payment_schedules` array |

### 10.3 PaymentSchedule — 3 definitions

| Location | Fields | Key differences |
|----------|--------|----------------|
| `lib/types.ts:190` | 22 fields | Full shape with payment_history |
| `app/landlord/payment-calendar/page.tsx:8` | 13 fields | Adds tenant_name, property_address (joined fields) |
| `app/landlord/[id]/page.tsx:25` | 8 fields | Minimal, loose `string` types |

### 10.4 Message/Attachment — 3 definitions

| Location | Interface names | Key differences |
|----------|----------------|----------------|
| `lib/communication-utils.ts:13` | `MessageAttachment`, `CommunicationMessage` | Full shape |
| `components/shared/MessageThread.tsx:18` | `ThreadAttachment`, `ThreadMessage` | Missing `created_at` on attachment, `content` is `string \| null` |
| `lib/maintenance-utils.ts:10` | `MaintenanceAttachment`, `MaintenanceComment` | Different parent ID field, extra change-tracking fields |

### 10.5 MaintenanceRequest — 3 definitions

| Location | Approach | Key differences |
|----------|----------|----------------|
| `lib/maintenance-utils.ts:34` | Base + Detail inheritance | Proper hierarchy |
| `app/tenancy/maintenance/[id]/page.tsx:20` | Flat interface | Missing creator_name, creator_email |
| `app/landlord/maintenance/[id]/page.tsx:63` | Extends MaintenanceRequestDetail | Redundantly re-adds property_location |

**Fix:** Consolidate all entity types into `lib/types.ts` (which already has most). Remove all local definitions. Where a page needs extra joined fields (like `tenant_name`), extend the base type:
```typescript
interface PaymentWithContext extends PaymentSchedule {
  tenant_name: string;
  property_address: string;
}
```

**Risk:** LOW — type changes are compile-time only.

---

## 11. Frontend: Modal/Dialog Pattern — 10+ Ad-hoc Implementations

The same modal structure is hand-coded in 10+ locations:

```tsx
{showModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <button onClick={() => setShowModal(false)}>✕</button>
      </div>
      {/* content */}
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={() => setShowModal(false)}>Cancel</button>
        <button onClick={handleConfirm}>Confirm</button>
      </div>
    </div>
  </div>
)}
```

Found in: `[agency]/admin/tenancies/[id]/page.tsx` (multiple modals), `applications/[id]/page.tsx`, `[agency]/admin/landlords/[id]/page.tsx`, and 7+ more pages.

**Fix:** Create `components/ui/Modal.tsx`:
```tsx
<Modal open={showModal} onClose={() => setShowModal(false)} title="Confirm">
  {content}
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
    <Button onClick={handleConfirm}>Confirm</Button>
  </Modal.Footer>
</Modal>
```

**Risk:** LOW.

---

## 12. Frontend: Page Layout Wrapper — 20+ Pages

Every page manually writes:
```tsx
<div className="min-h-screen bg-gray-50">
  <div className="bg-primary text-white py-8">
    <div className="container mx-auto px-4">
      <h1>Title</h1>
      <p>Subtitle</p>
    </div>
  </div>
  <div className="container mx-auto px-4 py-8">
    {/* page content */}
  </div>
</div>
```

This exact structure appears in 20+ pages across landlord, tenant, admin, and public sections.

**Fix:** Create `components/layouts/PageLayout.tsx`:
```tsx
<PageLayout title="My Properties" subtitle="Manage your portfolio">
  {content}
</PageLayout>
```

**Risk:** LOW.

---

## 13. Backend: Repeated "Defense-in-Depth" Comments

The comment `// Defense-in-depth: explicit agency_id filtering` appears **256 times** across 26 files. While the intent is good, it's noise at this scale — the pattern is universal and self-evident.

**Fix:** Remove the comment from individual queries. Add a single note in `CLAUDE.md` or a `docs/security.md` explaining the agency_id filtering convention.

**Risk:** NONE.

---

## Priority Matrix

### Tier 1 — High impact, low risk (do first)

| # | Fix | Files | Estimated savings |
|---|-----|-------|-------------------|
| 1 | Migrate 9 controllers to asyncHandler | 9 backend controllers | ~300 lines of try/catch removed |
| 2 | Consolidate TypeScript type definitions | 15+ frontend files | ~200 lines + eliminates type drift |
| 3 | Create `formatCurrency` shared util | 4+ frontend files | ~40 lines + consistency |
| 4 | Move local rate limiters to rateLimit.js | 2 route files | ~25 lines |
| 5 | Move idDocuments multer to uploadFactory | 1 route file | ~10 lines |

### Tier 2 — High impact, moderate effort

| # | Fix | Files | Estimated savings |
|---|-----|-------|-------------------|
| 6 | Create `useAuthenticatedData` hook | 15+ frontend pages | ~800 lines of boilerplate |
| 7 | Extract `findByIdOrFail` query helper | 24 backend controllers | ~600 lines (150 blocks × 4 lines) |
| 8 | Create `PageLayout` component | 20+ frontend pages | ~400 lines |
| 9 | Create `Modal` component | 10+ frontend pages | ~300 lines |
| 10 | Create `emailBuilder` helper | 4 backend controllers | ~200 lines |

### Tier 3 — Moderate impact, higher effort

| # | Fix | Files | Estimated savings |
|---|-----|-------|-------------------|
| 11 | Standardize backend response format | all controllers | ~100 lines + API consistency |
| 12 | Consolidate PDF generation service | 2 backend controllers | ~350 lines |
| 13 | Consolidate validation to shared validators | 3+ backend controllers | ~50 lines |
| 14 | Standardize route middleware patterns | 28 route files | consistency, no line savings |
| 15 | Remove "Defense-in-depth" comment spam | 26 backend files | ~256 lines of comments |

### Out of scope (architectural — too risky for refactoring pass)

- Splitting mega-components (applications/[id]/page.tsx at 1,647 lines, PaymentScheduleGrid at 458 lines)
- Unifying the two auth systems (context-based vs hook-based)
- Adding a proper repository/data-access layer
- Moving business logic from controllers to services

---

## Key Files Reference

| File | Role |
|------|------|
| `backend/src/utils/asyncHandler.js` | Target error handling pattern |
| `backend/src/utils/validators.js` | Expand with phone/URL validators |
| `backend/src/middleware/rateLimit.js` | Centralize all rate limiters here |
| `backend/src/middleware/uploadFactory.js` | Add idDocumentUpload export |
| `frontend/lib/types.ts` | Canonical type definitions — consolidate here |
| `frontend/components/reports/utils.ts` | Has `formatCurrency` — promote to shared lib |
| `frontend/hooks/useAuth.ts` | Base for `useAuthenticatedData` hook |
| `frontend/components/ui/LoadingSpinner.tsx` | Already adopted in batch 5 |
| `frontend/lib/statusBadges.ts` | Canonical badge source (complete) |
| `frontend/lib/dateUtils.ts` | Canonical date formatting (complete) |
| `frontend/lib/validation.ts` | Canonical password validation (complete) |
