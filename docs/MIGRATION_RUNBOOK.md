# EmailAI Production Migration Runbook

## Overview

This runbook provides step-by-step instructions for migrating an existing EmailAI installation to the multi-tenant organization model in production.

**Migration Type**: Zero-downtime rolling migration
**Estimated Duration**: 2-4 hours (depending on data size)
**Required Downtime**: None (with proper planning)

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Migration Strategy](#migration-strategy)
3. [Pre-Migration Steps](#pre-migration-steps)
4. [Migration Execution](#migration-execution)
5. [Post-Migration Verification](#post-migration-verification)
6. [Rollback Procedure](#rollback-procedure)
7. [Troubleshooting](#troubleshooting)

## Pre-Migration Checklist

### Required Preparations

- [ ] **Backup Created**: Full database backup completed and verified
- [ ] **Backup Tested**: Restore test completed successfully
- [ ] **Team Notified**: All stakeholders aware of migration schedule
- [ ] **Maintenance Window**: Scheduled (even if zero-downtime)
- [ ] **Rollback Plan**: Documented and team briefed
- [ ] **Migration Script**: Tested on staging environment
- [ ] **Monitoring**: All alerts configured and active
- [ ] **On-Call**: Engineer available for entire migration window
- [ ] **Communication**: Status page updated, users notified

### Environment Verification

- [ ] Production database accessible
- [ ] Sufficient disk space (at least 2x current database size)
- [ ] Database connections available (check connection pool)
- [ ] Application servers healthy
- [ ] Load balancer configured
- [ ] Monitoring tools active (Sentry, Datadog, etc.)

### Stakeholder Communication

**1 Week Before:**
```
Subject: EmailAI Multi-Tenant Migration - [DATE]

We will be migrating EmailAI to a new multi-tenant organization model on [DATE] at [TIME].

What to expect:
- No service interruption expected
- New organization features available after migration
- All existing data will be preserved
- Minimal performance impact during migration

Timeline:
- [TIME]: Migration begins
- [TIME]: Migration complete (estimated)
- [TIME]: Verification complete

Please contact [EMAIL] with any concerns.
```

**Day Before:**
```
Subject: Reminder: EmailAI Migration Tomorrow

Migration begins tomorrow at [TIME].

What you need to do:
- Nothing! The migration is automatic.
- Avoid making billing changes during migration window.
- Report any issues to [EMAIL].

Status updates: https://status.emailai.com
```

## Migration Strategy

### Approach

We use a **rolling migration strategy** with these phases:

1. **Schema Migration** - Add new tables and columns (non-breaking)
2. **Data Migration** - Populate organizations and link resources
3. **Verification** - Ensure data integrity
4. **Deployment** - Deploy new application code
5. **Cleanup** - Remove deprecated fields (optional, can defer)

### Zero-Downtime Technique

```
Old Application ──────────────────┐
                                   │
                                   ├──> Database (old + new schema)
                                   │
New Application ──────────────────┘

Timeline:
1. Add new schema (old app ignores it)
2. Migrate data (while old app still running)
3. Deploy new app servers one by one
4. Remove old app servers
5. (Later) Clean up old schema
```

### Rollback Strategy

At each phase, we can roll back:
- **Phase 1-2**: No app changes yet, just revert database changes
- **Phase 3-4**: Roll back deployment to previous version
- **Phase 5**: Keep old schema for emergency rollback

## Pre-Migration Steps

### Step 1: Create Full Backup

```bash
# Set variables
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="emailai_prod_backup_${BACKUP_DATE}.sql"
S3_BUCKET="emailai-backups"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -Fc -b -v \
  -f "/tmp/${BACKUP_FILE}" $DB_NAME

# Compress
gzip "/tmp/${BACKUP_FILE}"

# Upload to S3
aws s3 cp "/tmp/${BACKUP_FILE}.gz" \
  "s3://${S3_BUCKET}/migrations/${BACKUP_FILE}.gz"

# Verify upload
aws s3 ls "s3://${S3_BUCKET}/migrations/${BACKUP_FILE}.gz"

# Test restore (on staging)
gunzip "/tmp/${BACKUP_FILE}.gz"
pg_restore -h $STAGING_DB_HOST -U $DB_USER \
  -d emailai_staging -c -v "/tmp/${BACKUP_FILE}"
```

**Verification:**
```bash
# Check backup size
ls -lh "/tmp/${BACKUP_FILE}.gz"

# Check S3 upload
aws s3 ls --recursive "s3://${S3_BUCKET}/migrations/" | grep $BACKUP_DATE

# Verify restore worked
psql -h $STAGING_DB_HOST -U $DB_USER -d emailai_staging -c "SELECT COUNT(*) FROM users;"
```

### Step 2: Run Migration Dry-Run

```bash
cd apps/web

# Set environment to production (read-only)
export DATABASE_URL="postgresql://..."
export DRY_RUN=true

# Run migration script in dry-run mode
npx tsx ../../scripts/migrate-to-multi-tenant-complete.ts --dry-run

# Review output
# - Check number of organizations to be created
# - Check number of email accounts to migrate
# - Check for any errors or warnings
# - Estimate duration
```

**Expected Output:**
```
=== EmailAI Multi-Tenant Migration (DRY RUN) ===

Phase 1: Organization Creation
  - Users found: 1,250
  - Organizations to create: 1,250
  - Estimated time: 2 minutes

Phase 2: Email Account Linking
  - Email accounts found: 3,420
  - Accounts to link: 3,420
  - Estimated time: 5 minutes

Phase 3: Premium Migration
  - Premium subscriptions found: 450
  - Migrations needed: 450
  - Estimated time: 1 minute

Total estimated time: 8 minutes

DRY RUN COMPLETE - No changes made
```

### Step 3: Staging Migration

```bash
# Run full migration on staging
export DATABASE_URL="postgresql://staging..."
export DRY_RUN=false

npx tsx ../../scripts/migrate-to-multi-tenant-complete.ts

# Verify staging migration
npm run test:e2e

# Test critical user flows
# 1. Login
# 2. View organization
# 3. Add member
# 4. Access email account
# 5. Create automation rule
```

### Step 4: Schedule Maintenance Window

Even for zero-downtime migration, schedule a "low-traffic window":

**Recommended Times:**
- US-based users: 2-6 AM EST (Sunday-Thursday)
- EU-based users: 2-6 AM CET (Sunday-Thursday)
- Global: Check analytics for lowest traffic period

**Maintenance Page (Optional):**
```html
<!-- apps/web/app/maintenance/page.tsx -->
<div>
  <h1>Scheduled Maintenance</h1>
  <p>
    We're upgrading EmailAI to support organizations!
    Expected completion: [TIME]
  </p>
  <p>Status: <a href="https://status.emailai.com">status.emailai.com</a></p>
</div>
```

## Migration Execution

### Phase 1: Database Schema Migration (5-10 minutes)

**Purpose**: Add new tables and columns without breaking existing app

```bash
# Connect to production database
psql $DATABASE_URL

-- Start transaction
BEGIN;

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  error_message TEXT
);

-- Log migration start
INSERT INTO migration_log (migration_name, status)
VALUES ('multi_tenant_schema', 'in_progress');

-- Run Prisma migrations
-- (Exit psql first)
```

```bash
cd apps/web

# Run schema migrations
npx prisma migrate deploy

# This adds:
# - Organization table
# - OrganizationMember table
# - OrganizationRole enum
# - organizationId columns to existing tables
# - Indexes for performance
```

**Verification:**
```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('Organization', 'OrganizationMember');

-- Check new columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'EmailAccount'
AND column_name = 'organizationId';

-- Verify indexes created
SELECT indexname FROM pg_indexes
WHERE tablename = 'Organization';
```

**Update Migration Log:**
```sql
UPDATE migration_log
SET status = 'completed', completed_at = NOW()
WHERE migration_name = 'multi_tenant_schema'
AND status = 'in_progress';
```

**At this point**: Old application still works fine, new columns are NULL

### Phase 2: Data Migration (10-30 minutes)

**Purpose**: Create organizations and link existing data

```bash
# Log migration start
psql $DATABASE_URL << EOF
INSERT INTO migration_log (migration_name, status)
VALUES ('multi_tenant_data', 'in_progress');
EOF

# Run data migration
cd apps/web
npx tsx ../../scripts/migrate-to-multi-tenant-complete.ts --skip-schema

# Monitor progress
tail -f migration.log
```

**Migration Script Actions:**
1. For each user → Create personal organization
2. For each email account → Link to user's organization
3. For each premium subscription → Link to organization
4. Verify all data migrated correctly

**Monitoring During Migration:**

```bash
# In separate terminal, monitor progress
watch -n 5 'psql $DATABASE_URL -c "
SELECT
  (SELECT COUNT(*) FROM \"Organization\") as orgs,
  (SELECT COUNT(*) FROM \"OrganizationMember\") as members,
  (SELECT COUNT(*) FROM \"EmailAccount\" WHERE \"organizationId\" IS NOT NULL) as linked_accounts,
  (SELECT COUNT(*) FROM \"Premium\" WHERE \"organizationId\" IS NOT NULL) as linked_premium
"'
```

**Expected Output:**
```
Migration Progress:
  Organizations created: 1,250 / 1,250 (100%)
  Email accounts linked: 3,420 / 3,420 (100%)
  Premium subscriptions linked: 450 / 450 (100%)

Verification:
  ✓ All users have organizations
  ✓ All email accounts linked
  ✓ All premium subscriptions linked
  ✓ No orphaned records

Migration completed successfully in 15m 23s
```

**Update Migration Log:**
```sql
UPDATE migration_log
SET status = 'completed', completed_at = NOW()
WHERE migration_name = 'multi_tenant_data'
AND status = 'in_progress';
```

### Phase 3: Verification (5-10 minutes)

**Critical Checks:**

```sql
-- 1. All users have organizations
SELECT COUNT(*) FROM users
WHERE id NOT IN (
  SELECT DISTINCT "userId" FROM "OrganizationMember"
);
-- Expected: 0

-- 2. All organizations have owners
SELECT COUNT(*) FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationMember" om
  WHERE om."organizationId" = o.id
  AND om.role = 'OWNER'
);
-- Expected: 0

-- 3. All email accounts have organizations
SELECT COUNT(*) FROM "EmailAccount"
WHERE "organizationId" IS NULL;
-- Expected: 0

-- 4. All premium subscriptions have organizations
SELECT COUNT(*) FROM "Premium"
WHERE "organizationId" IS NULL;
-- Expected: 0

-- 5. No duplicate organization memberships
SELECT "userId", "organizationId", COUNT(*)
FROM "OrganizationMember"
GROUP BY "userId", "organizationId"
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 6. Organization seat counts match members
SELECT
  o.id,
  o.name,
  p."usedSeats" as premium_seats,
  COUNT(om.id) as actual_members
FROM "Organization" o
LEFT JOIN "Premium" p ON p."organizationId" = o.id
LEFT JOIN "OrganizationMember" om ON om."organizationId" = o.id
WHERE p."usedSeats" IS NOT NULL
GROUP BY o.id, o.name, p."usedSeats"
HAVING COUNT(om.id) != p."usedSeats";
-- Expected: 0 rows
```

**Functional Testing:**

Test these flows manually or with automation:

```bash
# Run E2E tests
cd apps/web
npm run test:e2e:production

# Or manual testing:
# 1. Login as test user
# 2. Verify organization shown
# 3. Verify email accounts accessible
# 4. Create new automation rule
# 5. Invite team member (if on paid plan)
# 6. Transfer email account ownership
```

### Phase 4: Application Deployment (15-30 minutes)

**Deploy new application code** that uses organizations.

**Rolling Deployment Strategy:**

```bash
# Assume you have 4 app servers behind load balancer

# 1. Deploy to 25% of servers (1 server)
# Mark server 1 as draining
# Wait for connections to drain (2 minutes)
# Deploy new code to server 1
# Health check server 1
curl https://app-server-1.internal/api/health
# Add server 1 back to load balancer

# 2. Monitor for 5 minutes
# Check error rates in Sentry
# Check response times in Datadog
# If issues: rollback server 1, stop deployment

# 3. Deploy to 50% (servers 2)
# Repeat process for server 2

# 4. Monitor for 5 minutes

# 5. Deploy to 75% (server 3)
# Repeat process

# 6. Deploy to 100% (server 4)
# Repeat process

# 7. All servers updated
# Monitor for 15 minutes
```

**Vercel Deployment:**

```bash
# Deploy to production
vercel deploy --prod

# Vercel automatically does rolling deployment
# Monitor deployment
vercel logs --production --follow
```

**Docker Deployment:**

```bash
# Build new image
docker build -t emailai:v2.0.0-orgs .

# Tag as latest
docker tag emailai:v2.0.0-orgs emailai:latest

# Push to registry
docker push emailai:latest

# Rolling update (Kubernetes)
kubectl set image deployment/emailai \
  emailai=emailai:v2.0.0-orgs

# Monitor rollout
kubectl rollout status deployment/emailai

# Or Docker Compose
docker-compose pull
docker-compose up -d --no-deps --build app
```

**Health Checks:**

```bash
# Check all servers healthy
for server in app-{1..4}; do
  echo "Checking $server..."
  curl -f "https://${server}.internal/api/health" || echo "FAILED"
done

# Check database connections
psql $DATABASE_URL -c "
SELECT count(*) FROM pg_stat_activity
WHERE datname = 'emailai_prod'
"

# Check application logs
tail -f /var/log/emailai/app.log | grep -i error
```

### Phase 5: Post-Deployment Monitoring (1-2 hours)

**Monitor these metrics closely:**

1. **Error Rate** (Should remain < 1%)
   ```bash
   # Via Sentry
   # Check dashboard for spike in errors

   # Via logs
   grep -i error /var/log/emailai/app.log | wc -l
   ```

2. **Response Time** (Should remain < 500ms p95)
   ```bash
   # Via Datadog/monitoring tool

   # Or check nginx logs
   awk '{print $NF}' /var/log/nginx/access.log | \
     awk '{sum+=$1; count++} END {print sum/count}'
   ```

3. **Database Queries** (No slow queries)
   ```sql
   -- Check for slow queries
   SELECT
     query,
     calls,
     total_time / calls as avg_time_ms,
     max_time as max_time_ms
   FROM pg_stat_statements
   WHERE query LIKE '%Organization%'
   ORDER BY total_time DESC
   LIMIT 10;
   ```

4. **User Reports** (Should be zero)
   - Monitor support email
   - Check social media mentions
   - Review status page

**Alert Thresholds:**

```yaml
# Datadog monitor example
- name: "High Error Rate After Migration"
  metric: "emailai.errors"
  threshold: 10 errors/minute
  action: Page on-call engineer

- name: "Slow Organization Queries"
  metric: "emailai.db.query_time"
  filter: "query:Organization"
  threshold: "> 100ms"
  action: Alert team channel

- name: "Failed Logins"
  metric: "emailai.auth.failed"
  threshold: "> 5 in 5 minutes"
  action: Alert team channel
```

## Post-Migration Verification

### Data Integrity Checks

Run comprehensive verification:

```bash
cd apps/web
npx tsx ../../scripts/verify-migration.ts
```

**Verify Script** (`scripts/verify-migration.ts`):

```typescript
import { prisma } from '../apps/web/utils/prisma';

async function verifyMigration() {
  console.log('Starting post-migration verification...\n');

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  // Check 1: All users have organizations
  const usersWithoutOrgs = await prisma.user.count({
    where: {
      memberships: {
        none: {},
      },
    },
  });

  if (usersWithoutOrgs === 0) {
    console.log('✓ All users have organizations');
    results.passed++;
  } else {
    console.error(`✗ ${usersWithoutOrgs} users without organizations`);
    results.failed++;
  }

  // Check 2: All organizations have owners
  const orgsWithoutOwners = await prisma.organization.count({
    where: {
      members: {
        none: {
          role: 'OWNER',
        },
      },
    },
  });

  if (orgsWithoutOwners === 0) {
    console.log('✓ All organizations have owners');
    results.passed++;
  } else {
    console.error(`✗ ${orgsWithoutOwners} organizations without owners`);
    results.failed++;
  }

  // Check 3: Email account access
  const accountsWithoutOrg = await prisma.emailAccount.count({
    where: {
      organizationId: null,
    },
  });

  if (accountsWithoutOrg === 0) {
    console.log('✓ All email accounts linked to organizations');
    results.passed++;
  } else {
    console.error(`✗ ${accountsWithoutOrg} email accounts not linked`);
    results.failed++;
  }

  // Check 4: Billing integrity
  const premiumWithoutOrg = await prisma.premium.count({
    where: {
      organizationId: null,
    },
  });

  if (premiumWithoutOrg === 0) {
    console.log('✓ All premium subscriptions linked');
    results.passed++;
  } else {
    console.log(`⚠ ${premiumWithoutOrg} premium records not linked`);
    results.warnings++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Warnings: ${results.warnings}`);
  console.log('='.repeat(50));

  return results.failed === 0;
}

verifyMigration()
  .then((success) => {
    if (success) {
      console.log('\n✓ Migration verification PASSED');
      process.exit(0);
    } else {
      console.error('\n✗ Migration verification FAILED');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Verification error:', error);
    process.exit(1);
  });
```

### User Acceptance Testing

**Test Critical Flows:**

1. **Login Flow**
   ```
   - User can login
   - Redirected to organization page
   - Organization name displayed correctly
   ```

2. **Email Access**
   ```
   - Can view email accounts
   - Can switch between accounts
   - Can read/send emails
   ```

3. **Organization Management**
   ```
   - Can view organization members
   - Can invite new member (if admin)
   - Can view billing info (if owner/admin)
   ```

4. **Automation**
   ```
   - Existing rules still work
   - Can create new rules
   - Rules execute correctly
   ```

5. **Billing**
   ```
   - Subscription status correct
   - Seat count accurate
   - Can add/remove members within limits
   ```

### Communication

**Post-Migration Announcement:**

```
Subject: EmailAI Migration Complete - Organizations Now Available!

We've successfully migrated EmailAI to support organizations! 🎉

What's new:
✓ Collaborate with your team on shared email accounts
✓ Manage team members and permissions
✓ Seat-based billing for teams

What happened to your data:
✓ All your email accounts and rules are preserved
✓ You now have a personal organization
✓ Your subscription (if any) is linked to your organization

Getting started with organizations:
- View your organization: [LINK]
- Invite team members: [LINK]
- Learn more: [LINK TO DOCS]

Questions? Reply to this email or visit [SUPPORT_URL]

Thank you for your patience during the migration!
```

## Rollback Procedure

If critical issues arise during migration:

### When to Rollback

**Rollback Immediately If:**
- Error rate > 5%
- Database connection failures
- Data integrity issues detected
- Critical user flows broken
- Unrecoverable errors in logs

**Consider Rollback If:**
- Error rate 2-5%
- Performance degradation > 50%
- Multiple user complaints
- Billing issues detected

### Rollback Steps

**Phase 1: Stop New Deployments**

```bash
# Cancel any in-progress deployments
vercel rollback  # For Vercel
# Or
kubectl rollout undo deployment/emailai  # For Kubernetes
# Or
docker-compose down && docker-compose up -d  # Revert to old image
```

**Phase 2: Rollback Application Code**

```bash
# Deploy previous version
git checkout v1.9.0  # Last known good version
vercel deploy --prod

# Or use deployment ID
vercel rollback [DEPLOYMENT_ID]

# Verify rollback
curl https://yourdomain.com/api/health
```

**Phase 3: Rollback Database (If Needed)**

⚠️ **Only if data corruption detected**

```bash
# Run rollback script
cd apps/web
npx tsx ../../scripts/rollback-multi-tenant.ts --keep-orgs

# This will:
# - Unlink email accounts from organizations
# - Unlink premium subscriptions from organizations
# - Keep organization data for retry
```

**Phase 4: Restore from Backup (Last Resort)**

⚠️ **Only if rollback script fails**

```bash
# Download backup
aws s3 cp "s3://emailai-backups/migrations/${BACKUP_FILE}.gz" ./

# Decompress
gunzip "${BACKUP_FILE}.gz"

# Stop application
# (Prevent writes during restore)

# Restore database
pg_restore -h $DB_HOST -U $DB_USER \
  -d emailai_prod -c -v "${BACKUP_FILE}"

# Restart application (old version)

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

**Phase 5: Incident Communication**

```
Subject: EmailAI Migration Paused - Service Restored

We encountered an issue during our organization migration and have rolled back to ensure service stability.

Current status:
✓ All services operational
✓ No data loss
✓ Previous functionality restored

Next steps:
- We're investigating the issue
- Migration will be rescheduled after resolution
- We'll notify you of new date

We apologize for any inconvenience.
```

## Troubleshooting

### Issue: Migration Script Fails Midway

**Symptoms:**
- Script exits with error
- Partial data migrated
- Some organizations created, others missing

**Resolution:**

```bash
# Check migration log
psql $DATABASE_URL -c "
SELECT * FROM migration_log
WHERE status = 'in_progress'
ORDER BY started_at DESC;
"

# Identify failed stage
# Re-run migration with --resume flag
npx tsx ../../scripts/migrate-to-multi-tenant-complete.ts --resume
```

### Issue: Slow Query Performance

**Symptoms:**
- API response times increased
- Database CPU high
- Timeout errors

**Resolution:**

```sql
-- Check for missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename IN ('Organization', 'OrganizationMember', 'EmailAccount')
  AND n_distinct > 100
  AND correlation < 0.1;

-- Add missing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_email_account_org_id ON "EmailAccount"("organizationId");

-- Analyze tables
ANALYZE "Organization";
ANALYZE "OrganizationMember";
ANALYZE "EmailAccount";
```

### Issue: Users Can't Access Email Accounts

**Symptoms:**
- 403 Forbidden errors
- "No access" messages
- Email accounts not showing

**Diagnosis:**

```sql
-- Check organization membership
SELECT
  u.email,
  o.name as org_name,
  om.role,
  COUNT(ea.id) as email_accounts
FROM users u
LEFT JOIN "OrganizationMember" om ON om."userId" = u.id
LEFT JOIN "Organization" o ON o.id = om."organizationId"
LEFT JOIN "EmailAccount" ea ON ea."organizationId" = o.id
WHERE u.email = 'user@example.com'
GROUP BY u.id, u.email, o.name, om.role;
```

**Resolution:**

```sql
-- If user has no organization, create one
INSERT INTO "Organization" (id, name, slug)
VALUES (gen_random_uuid(), 'User Name Org', 'user-name-org');

-- Add user as owner
INSERT INTO "OrganizationMember" ("userId", "organizationId", role)
VALUES ('user-id', 'org-id', 'OWNER');

-- Link email accounts
UPDATE "EmailAccount"
SET "organizationId" = 'org-id'
WHERE "userId" = 'user-id'
AND "organizationId" IS NULL;
```

### Issue: Billing Subscription Errors

**Symptoms:**
- Seat limit not enforced
- Subscription status incorrect
- Payment webhook failures

**Diagnosis:**

```sql
-- Check premium linkage
SELECT
  u.email,
  o.name,
  p.tier,
  p."usedSeats",
  p."maxSeats",
  COUNT(om.id) as actual_members
FROM "Premium" p
JOIN "Organization" o ON o.id = p."organizationId"
LEFT JOIN users u ON u.id = p."userId"
LEFT JOIN "OrganizationMember" om ON om."organizationId" = o.id
GROUP BY u.email, o.name, p.tier, p."usedSeats", p."maxSeats";
```

**Resolution:**

```typescript
// Sync seat counts
import { syncOrganizationSeats } from '../utils/billing';

await syncOrganizationSeats(organizationId);
```

---

## Migration Completion Checklist

- [ ] All verification checks passed
- [ ] No error rate increase detected
- [ ] Response times normal
- [ ] User acceptance testing completed
- [ ] Team training completed
- [ ] Documentation updated
- [ ] Support team briefed
- [ ] Monitoring dashboards updated
- [ ] Post-migration email sent
- [ ] Migration retrospective scheduled

## Next Steps After Migration

1. **Monitor for 7 days** - Watch for any delayed issues
2. **Schedule cleanup** - Remove deprecated fields (after 30 days)
3. **Update documentation** - Reflect new organization model
4. **Train support team** - On new organization features
5. **Gather feedback** - From early organization users
6. **Plan Phase 2** - Additional organization features

---

**For Questions or Issues:**
- Escalation: CTO (phone number)
- Database Issues: DBA on-call
- Application Issues: Engineering lead
- User Communication: Product manager
