# Security Tests

## Overview

This directory contains security-focused integration tests to verify multi-tenant isolation and access control.

## Setup

### 1. Install Dependencies

```bash
npm install --save-dev jest @types/jest ts-jest
```

### 2. Configure Jest

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}
```

### 3. Create Test Environment

Copy `.env.test.example` to `.env.test`:

```bash
cp .env.test.example .env.test
```

Edit `.env.test` with your test credentials and IDs.

### 4. Seed Test Data

Create test users and data in your database:

```sql
-- Create test companies
INSERT INTO companies (id, name) VALUES
  ('company-a-uuid', 'Test Company A'),
  ('company-b-uuid', 'Test Company B');

-- Create test users (via Supabase Auth or API)
-- User A: userA@companyA.com
-- User B: userB@companyB.com

-- Seed test data for Company B
INSERT INTO leads (id, company_id, name, phone) VALUES
  ('lead-b-uuid', 'company-b-uuid', 'Test Lead B', '+1234567890');

INSERT INTO deals (id, company_id, customer_name) VALUES
  ('deal-b-uuid', 'company-b-uuid', 'Test Deal B');

-- ... more test data
```

## Running Tests

### Run All Security Tests

```bash
npm test -- tests/security/
```

### Run Specific Test

```bash
npm test -- multi-tenant-isolation.test.ts
```

### Run with Coverage

```bash
npm test -- --coverage tests/security/
```

### Manual Test Runner

```bash
ts-node tests/security/multi-tenant-isolation.test.ts
```

## Test Scenarios

### 1. Cross-Company Data Access Prevention

**Tests:**
- User A cannot GET leads from Company B
- User A cannot GET deals from Company B
- User A cannot GET offers from Company B by ID
- User A cannot GET workers from Company B

**Expected:** All queries should return empty results or 403/404.

### 2. Cross-Company Modifications Prevention

**Tests:**
- User A cannot UPDATE deal from Company B
- User A cannot DELETE offer from Company B
- User A cannot UPDATE worker from Company B
- User A cannot DELETE worker from Company B

**Expected:** All operations should return 403/404.

### 3. Positive Tests (Own Company Access)

**Tests:**
- User A CAN access their own company data
- User B CAN access their own company data

**Expected:** Queries should return data, all records belong to correct company.

### 4. Authentication Tests

**Tests:**
- Unauthenticated request should fail (401)
- Invalid token should fail (401)

**Expected:** All unauthorized requests blocked.

## Interpreting Results

### ✅ Success
```
✅ User A cannot see Company B leads
✅ User A cannot update Company B deal: 403
✅ User A cannot delete Company B offer: 403
```

### ❌ Failure
```
❌ SECURITY VIOLATION: User A can see Company B lead!
❌ SECURITY VIOLATION: User A can delete Company B offer!
```

If any test fails, **DO NOT DEPLOY TO PRODUCTION** until fixed.

## CI/CD Integration

Add to your CI pipeline (GitHub Actions, etc.):

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- tests/security/
        env:
          TEST_API_URL: ${{ secrets.TEST_API_URL }}
          TEST_USER_A_EMAIL: ${{ secrets.TEST_USER_A_EMAIL }}
          # ... other secrets
```

## Troubleshooting

### Tests Fail to Connect

- Check `TEST_API_URL` is correct
- Ensure dev server is running: `npm run dev`

### Authentication Errors

- Verify test user credentials
- Check users exist in Supabase Auth
- Verify users have correct company assignments

### 403 Expected but Got 200

- **CRITICAL:** This means security is broken!
- Check security layer implementation
- Verify `company_id` filters in queries
- Review `requireAuth` and `requireCompanyAccess` usage

### 404 Instead of 403

- This is acceptable (resource "not found" from user's perspective)
- 404 can be a security best practice (don't reveal resource exists)

## Best Practices

1. **Run before every deployment**
2. **Add tests for new features**
3. **Never skip security tests**
4. **Keep test data isolated**
5. **Clean up after tests** (if needed)

## Support

If tests fail or security issues found:
1. **DO NOT DEPLOY**
2. Review `docs/SECURITY_AUDIT_MULTI_TENANT.md`
3. Check `docs/SECURITY_LAYER_IMPLEMENTATION.md`
4. Contact security team

---

**Remember: Security is not optional!**

