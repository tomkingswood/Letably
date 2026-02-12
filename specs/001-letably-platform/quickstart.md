# Quickstart: Letably Platform

**Branch**: `001-letably-platform` | **Date**: 2026-01-31

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Git

## Local Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone <repo-url> letably
cd letably

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Start PostgreSQL (example with Docker)
docker run --name letably-postgres \
  -e POSTGRES_USER=letably \
  -e POSTGRES_PASSWORD=letably_dev \
  -e POSTGRES_DB=letably \
  -p 5432:5432 \
  -d postgres:15

# Or use existing PostgreSQL installation
createdb letably
```

### 3. Environment Configuration

**Backend (`backend/.env`)**:
```env
# Database
DATABASE_URL=postgresql://letably:letably_dev@localhost:5432/letably

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Email (development - use Mailtrap or similar)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
EMAIL_FROM=noreply@letably.com

# Server
PORT=3001
NODE_ENV=development

# File Storage
UPLOAD_DIR=./uploads
```

**Frontend (`frontend/.env.local`)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Database Migration

```bash
cd backend

# Run migrations
npm run migrate

# Seed with test agency
npm run seed:agency
```

### 5. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 6. Access Application

- **Frontend**: http://localhost:3000/steelcity/login
- **API**: http://localhost:3001/api
- **Default Admin**: admin@steelcity.com / password123

---

## Validation Checklist

After setup, verify these scenarios work:

### Agency Isolation

```bash
# Create two test agencies
npm run seed:test-agencies

# Login as Agency A admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agency-a.com","password":"test123","agency_slug":"agency-a"}'

# Save token and list properties
export TOKEN_A="<token from response>"
curl http://localhost:3001/api/admin/properties \
  -H "Authorization: Bearer $TOKEN_A"

# Should only see Agency A properties, not Agency B
```

### White-Labeling

1. Navigate to http://localhost:3000/steelcity/admin/settings
2. Upload a new logo
3. Change primary color
4. Verify branding updates across portal

### Tenant Portal

1. Login as tenant: tenant@steelcity.com / password123
2. Verify tenancy details visible
3. Submit a maintenance request
4. Verify request appears in admin dashboard

### Payment Recording

1. Login as admin
2. Navigate to a tenancy's payment schedule
3. Record a partial payment
4. Verify status changes to "partial"
5. Record remaining balance
6. Verify status changes to "paid"

### E-Signature Flow

1. Create a new tenancy (or use existing pending one)
2. Move tenancy to "awaiting_signatures"
3. Login as tenant member
4. Navigate to tenancy and sign agreement
5. Verify signature stored and status updates

---

## Project Structure

```
letably/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── middleware/       # Auth, agency context
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   ├── helpers/          # Utilities
│   │   ├── validators/       # Input validation
│   │   └── db.js             # PostgreSQL connection
│   ├── migrations/           # Database migrations
│   ├── seeds/                # Test data
│   └── tests/
│
├── frontend/
│   ├── app/
│   │   └── [agency]/         # Dynamic agency routing
│   ├── components/           # React components
│   └── lib/                  # Utilities, API client
│
└── specs/
    └── 001-letably-platform/
        ├── spec.md           # Feature specification
        ├── plan.md           # Implementation plan
        ├── research.md       # Technical decisions
        ├── data-model.md     # Database schema
        ├── contracts/        # API contracts
        └── quickstart.md     # This file
```

---

## Common Tasks

### Add New Agency

```sql
INSERT INTO agencies (name, slug, email, primary_color)
VALUES ('New Agency', 'newagency', 'admin@newagency.com', '#2563eb');

-- Create admin user
INSERT INTO users (agency_id, email, password_hash, role, first_name, last_name)
VALUES (
  (SELECT id FROM agencies WHERE slug = 'newagency'),
  'admin@newagency.com',
  '$2b$10$...', -- bcrypt hash
  'admin',
  'Admin',
  'User'
);
```

### Run Tests

```bash
# Backend tests
cd backend
npm test                    # All tests
npm run test:unit          # Unit only
npm run test:integration   # Integration only
npm run test:security      # Security/isolation tests

# Frontend tests
cd frontend
npm run test               # Unit tests
npm run test:e2e           # Playwright E2E
```

### Check Agency Isolation

```bash
# Run isolation test suite
cd backend
npm run test:isolation

# Manual check
psql -d letably -c "
  SET app.agency_id = 1;
  SELECT COUNT(*) FROM properties;  -- Should show Agency 1 count
  SET app.agency_id = 2;
  SELECT COUNT(*) FROM properties;  -- Should show Agency 2 count
"
```

---

## Troubleshooting

### "Cannot connect to database"

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check connection string
psql $DATABASE_URL -c "SELECT 1"
```

### "Agency not found" on login

```bash
# Check agency exists
psql -d letably -c "SELECT slug FROM agencies"

# Verify URL includes correct slug
# ✓ http://localhost:3000/steelcity/login
# ✗ http://localhost:3000/login
```

### "RLS policy violation"

```bash
# Check app.agency_id is being set
# Add logging in auth middleware:
console.log('Setting agency_id:', agencyId);

# Verify policy exists
psql -d letably -c "\dp properties"
```

### File uploads not working

```bash
# Check upload directory exists and is writable
mkdir -p backend/uploads
chmod 755 backend/uploads

# Check UPLOAD_DIR in .env matches
```

---

## Next Steps

After local validation:

1. Review [plan.md](./plan.md) for phased implementation
2. Review [data-model.md](./data-model.md) for full schema
3. Review [contracts/openapi.yaml](./contracts/openapi.yaml) for API spec
4. Run `/speckit.tasks` to generate task breakdown

---

*Quickstart Version: 1.0*
*Created: 2026-01-31*
