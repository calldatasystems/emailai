# Email Account Sharing - Testing Guide

## Overview
This guide covers testing email account sharing functionality within organizations, including multi-user access, ownership transfer, and permission controls.

## Prerequisites

- Phase 1-6 completed
- At least 2 test users
- Organization with multiple members
- At least 1 Gmail account connected

## Test Scenarios

### 1. Email Account Creation with Organization Context

**Objective:** Verify new email accounts are automatically linked to user's organization

**Steps:**
1. Sign in as User A (has organization)
2. Connect a new Gmail account via OAuth
3. Verify email account created
4. Check database: email account should have `organizationId` set

**Expected Results:**
```sql
SELECT id, email, userId, organizationId FROM "EmailAccount" WHERE email = 'test@example.com';
-- Should show organizationId populated
```

**Success Criteria:**
- ✅ Email account has organizationId matching user's default org
- ✅ Email account visible in organization's email accounts list
- ✅ Organization members can see the email account

### 2. Multi-User Access to Shared Email Account

**Objective:** Verify organization members can access emails from shared accounts

**Setup:**
```
Organization: Acme Corp
Members:
  - User A (OWNER) - owns alice@acme.com
  - User B (MEMBER)
  - User C (ADMIN)
```

**Steps:**
1. Sign in as User A
2. Connect alice@acme.com (automatically shared with org)
3. Navigate to email inbox
4. Sign out

5. Sign in as User B (MEMBER)
6. Switch to alice@acme.com email account
7. View inbox and threads
8. Try to read emails, apply rules, etc.

**Expected Results:**
- ✅ User B can see alice@acme.com in account list
- ✅ User B can view emails from alice@acme.com
- ✅ User B can read email content
- ✅ User B can apply rules/automations
- ✅ All actions are attributed to User B in logs

**API Tests:**
```bash
# Get email accounts (should include shared ones)
curl -H "Cookie: $SESSION" \
  http://localhost:3000/api/user/email-accounts

# Get threads from shared account
curl -H "Cookie: $SESSION" \
  http://localhost:3000/api/google/threads?emailAccountId=<shared_account_id>

# Get specific email
curl -H "Cookie: $SESSION" \
  http://localhost:3000/api/google/messages?emailAccountId=<shared_account_id>&threadId=<thread_id>
```

### 3. Email Account Ownership Transfer

**Objective:** Verify ownership can be transferred between organization members

**Setup:**
```
Organization: Acme Corp
Members:
  - User A (ADMIN) - owns support@acme.com
  - User B (MEMBER)
```

**Steps:**
1. Sign in as User A (current owner)
2. Navigate to email account settings
3. Click "Transfer Ownership"
4. Select User B as new owner
5. Confirm transfer

6. Verify in database:
```sql
SELECT email, userId, organizationId
FROM "EmailAccount"
WHERE email = 'support@acme.com';
-- userId should now be User B's ID
```

7. Sign in as User B
8. Verify support@acme.com shows as "Owned by you"

**Expected Results:**
- ✅ User A can transfer ownership (is admin)
- ✅ User B becomes new owner
- ✅ User A retains access (still org member)
- ✅ Email account remains in organization
- ✅ Transfer logged in audit trail

**API Test:**
```bash
# Transfer ownership
curl -X POST \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"targetUserId": "<user_b_id>"}' \
  http://localhost:3000/api/user/email-account/<account_id>/transfer
```

### 4. Sharing Email Account with Organization

**Objective:** Verify personal email account can be shared with organization

**Setup:**
```
User A has personal email: personal@gmail.com
User A is member of organization: Acme Corp
```

**Steps:**
1. Create email account without organizationId:
```sql
UPDATE "EmailAccount"
SET "organizationId" = NULL
WHERE email = 'personal@gmail.com';
```

2. Sign in as User A
3. Navigate to email account settings
4. Click "Share with Organization"
5. Select organization "Acme Corp"
6. Confirm

7. Verify in database:
```sql
SELECT email, userId, organizationId
FROM "EmailAccount"
WHERE email = 'personal@gmail.com';
-- organizationId should now be set
```

**Expected Results:**
- ✅ Email account becomes shared with organization
- ✅ Other org members can now access it
- ✅ User A remains owner
- ✅ User A can unshare later

**API Test:**
```bash
# Share with organization
curl -X POST \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "<org_id>"}' \
  http://localhost:3000/api/user/email-account/<account_id>/share

# Unshare from organization
curl -X DELETE \
  -H "Cookie: $SESSION" \
  http://localhost:3000/api/user/email-account/<account_id>/share
```

### 5. Permission-Based Access Control

**Objective:** Verify different roles have appropriate access levels

**Test Matrix:**

| Action | OWNER | ADMIN | MEMBER | VIEWER |
|--------|-------|-------|--------|--------|
| View emails | ✅ | ✅ | ✅ | ✅ |
| Send emails | ✅ | ✅ | ✅ | ❌ |
| Apply rules | ✅ | ✅ | ✅ | ❌ |
| Create rules | ✅ | ✅ | ✅ | ❌ |
| Transfer ownership | ✅ (owner) | ✅ | ❌ | ❌ |
| Share/unshare | ✅ (owner) | ✅ | ❌ | ❌ |
| Delete account | ✅ (owner) | ✅ | ❌ | ❌ |

**Steps for Each Role:**
1. Create test user with specific role
2. Add to organization
3. Attempt each action
4. Verify success/failure matches matrix

### 6. Account Linking/Merging with Organizations

**Objective:** Verify account linking respects organization context

**Setup:**
```
User A: alice@example.com (has Org A)
User B: bob@example.com (standalone account with Gmail connected)
```

**Steps:**
1. Sign in as User A
2. Initiate account linking for bob@example.com
3. Complete OAuth flow
4. Verify merge

5. Check database:
```sql
-- User B should be deleted
SELECT * FROM "User" WHERE email = 'bob@example.com';
-- Should return 0 rows

-- Email account should now belong to User A and Org A
SELECT email, userId, organizationId
FROM "EmailAccount"
WHERE email = 'bob@example.com';
-- userId = User A's ID, organizationId = Org A's ID
```

**Expected Results:**
- ✅ Email account merged successfully
- ✅ Email account linked to User A's organization
- ✅ User A can access emails from both accounts
- ✅ Organization members can access merged account

### 7. Cross-Organization Access Prevention

**Objective:** Verify users cannot access email accounts from other organizations

**Setup:**
```
Organization A: Acme Corp
  - User A (ADMIN) - owns acme@example.com

Organization B: Beta Inc
  - User B (ADMIN) - owns beta@example.com
```

**Steps:**
1. As User B, attempt to access acme@example.com
2. Try to read emails from acme@example.com
3. Try to modify settings for acme@example.com

**Expected Results:**
- ❌ User B cannot see acme@example.com in account list
- ❌ API returns 403 Forbidden when accessing acme emails
- ❌ Cannot view or modify acme@example.com settings
- ✅ Proper error messages displayed

**API Test:**
```bash
# Should return 403
curl -H "Cookie: $USER_B_SESSION" \
  http://localhost:3000/api/google/threads?emailAccountId=<acme_account_id>
```

### 8. Data Access Layer Verification

**Objective:** Verify all queries respect organization boundaries

**Test Queries:**
```bash
# Rules should only show for org email accounts
curl -H "Cookie: $SESSION" \
  http://localhost:3000/api/user/rules?emailAccountId=<account_id>

# Groups should be org-scoped
curl -H "Cookie: $SESSION" \
  http://localhost:3000/api/user/group?emailAccountId=<account_id>

# Categories should be org-scoped
curl -H "Cookie: $SESSION" \
  http://localhost:3000/api/user/categories?emailAccountId=<account_id>
```

**Expected Results:**
- ✅ Only returns data for email accounts in user's organizations
- ✅ No data leak across organizations
- ✅ Proper 403/404 for unauthorized access

### 9. Organization Email Accounts List

**Objective:** Verify organization members can see all org email accounts

**Steps:**
1. Create organization with 3 email accounts
2. Sign in as organization member
3. Fetch organization email accounts

**API Test:**
```bash
curl -H "Cookie: $SESSION" \
  http://localhost:3000/api/organization/<org_id>/email-accounts
```

**Expected Results:**
```json
{
  "emailAccounts": [
    {
      "id": "...",
      "email": "sales@acme.com",
      "user": {
        "id": "...",
        "name": "Alice",
        "email": "alice@example.com"
      }
    },
    {
      "id": "...",
      "email": "support@acme.com",
      "user": {
        "id": "...",
        "name": "Bob",
        "email": "bob@example.com"
      }
    }
  ]
}
```

### 10. Backwards Compatibility

**Objective:** Verify existing single-user setups still work

**Setup:**
- User with email account but NO organizationId
- User NOT in any organization

**Steps:**
1. Query email accounts
2. Access emails
3. Apply rules
4. All features should work

**Expected Results:**
- ✅ Email accounts without organizationId still accessible
- ✅ All features work as before
- ✅ No breaking changes for single-user mode
- ✅ User can optionally join/create organization later

## Performance Tests

### 1. Email Account Query Performance

**Objective:** Verify queries remain fast with organization checks

**Test:**
```sql
EXPLAIN ANALYZE
SELECT * FROM "EmailAccount" ea
WHERE ea."organizationId" = '<org_id>';
-- Should use index on organizationId
```

**Success Criteria:**
- Index scan (not sequential)
- < 10ms query time
- Execution plan shows index usage

### 2. Access Control Check Performance

**Test:**
```typescript
// Benchmark canAccessEmailAccount function
console.time('access-check');
await canAccessEmailAccount(userId, emailAccountId);
console.timeEnd('access-check');
```

**Success Criteria:**
- < 50ms per check
- Minimal database queries (ideally 1-2)
- Can be cached if needed

## Error Scenarios

### 1. Transfer to Non-Member

**Test:**
```bash
# Try to transfer to user NOT in organization
curl -X POST \
  -H "Cookie: $SESSION" \
  -d '{"targetUserId": "<external_user_id>"}' \
  .../transfer
```

**Expected:**
```json
{
  "error": "Target user must be a member of the same organization"
}
```

### 2. Non-Owner Transfer Attempt

**Test:** Member (not owner/admin) tries to transfer

**Expected:**
```json
{
  "error": "You don't have permission to transfer this email account"
}
```

### 3. Share with Unauthorized Organization

**Test:** Try to share with organization user is not a member of

**Expected:**
```json
{
  "error": "You must be a member of the organization to share with it"
}
```

## Security Tests

### 1. Token Access Control

**Verify:** User A cannot use User B's Gmail OAuth tokens

**Test:**
- Extract token from User A's account
- Try to use it as User B via API
- Should be rejected

### 2. SQL Injection Protection

**Test:** Try malicious input in organization/email IDs

```bash
curl http://localhost:3000/api/organization/'; DROP TABLE "Organization"; --/email-accounts
```

**Expected:** Parameterized queries prevent injection

### 3. Session Hijacking

**Test:** Use expired/invalid session token

**Expected:** 401 Unauthorized

## Monitoring & Logging

**Verify logs capture:**
- Email account access events
- Ownership transfers
- Sharing/unsharing actions
- Failed access attempts
- Organization membership checks

**Sample log entries:**
```
INFO: Email account accessed
  userId: user_123
  emailAccountId: acc_456
  organizationId: org_789
  action: view_inbox

INFO: Email account ownership transferred
  emailAccountId: acc_456
  fromUserId: user_123
  toUserId: user_789
  organizationId: org_789
  initiatedBy: user_123
```

## Regression Tests

After implementing Phase 7, verify:
- ✅ Phase 1-6 tests still pass
- ✅ Existing email accounts still accessible
- ✅ Rules, groups, categories still work
- ✅ Billing/seat management unaffected
- ✅ Shared resources (Phase 5) still work

## Cleanup

After testing, reset test data:
```sql
-- Delete test email accounts
DELETE FROM "EmailAccount" WHERE email LIKE '%test%';

-- Delete test organizations
DELETE FROM "Organization" WHERE name LIKE '%Test%';

-- Delete test users
DELETE FROM "User" WHERE email LIKE '%test%';
```
