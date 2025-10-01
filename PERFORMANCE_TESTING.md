# Multi-Tenant Performance Testing & Optimization

## Overview
This document covers performance testing, optimization strategies, and monitoring for the multi-tenant EmailAI system.

## Database Performance

### Index Verification

**Check all indexes are in place:**
```sql
-- Organizations
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Organization';

-- Expected indexes:
-- - Organization_slug_key (UNIQUE)
-- - Organization_slug_idx

-- OrganizationMember
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'OrganizationMember';

-- Expected indexes:
-- - OrganizationMember_userId_organizationId_key (UNIQUE)
-- - OrganizationMember_organizationId_idx
-- - OrganizationMember_userId_idx

-- EmailAccount
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'EmailAccount';

-- Expected indexes:
-- - EmailAccount_organizationId_idx
```

### Query Performance Tests

**1. Organization Member Lookup:**
```sql
EXPLAIN ANALYZE
SELECT * FROM "OrganizationMember"
WHERE "userId" = 'user_123';

-- Expected: Index scan on OrganizationMember_userId_idx
-- Target: < 5ms
```

**2. Email Account Organization Lookup:**
```sql
EXPLAIN ANALYZE
SELECT * FROM "EmailAccount"
WHERE "organizationId" = 'org_123';

-- Expected: Index scan on EmailAccount_organizationId_idx
-- Target: < 10ms
```

**3. Organization-Scoped Rules:**
```sql
EXPLAIN ANALYZE
SELECT r.* FROM "Rule" r
JOIN "EmailAccount" ea ON r."emailAccountId" = ea.id
WHERE ea."organizationId" = 'org_123';

-- Expected: Index scans with join
-- Target: < 50ms for 1000 rules
```

**4. Shared Resources Lookup:**
```sql
EXPLAIN ANALYZE
SELECT * FROM "Rule"
WHERE "emailAccountId" = 'acc_123'
  AND ("isShared" = true OR "createdBy" = 'user_123' OR "createdBy" IS NULL);

-- Expected: Index scan using Rule_emailAccountId_isShared_idx
-- Target: < 20ms
```

### Performance Benchmarks

**Target Metrics:**
- Organization lookup: < 5ms
- Member check: < 10ms
- Email account access check: < 15ms
- Org-scoped data query: < 50ms
- Seat calculation: < 20ms

**Load Scenarios:**
- Small org (1-5 members): All queries < 10ms
- Medium org (6-50 members): All queries < 50ms
- Large org (51-500 members): All queries < 200ms
- Enterprise org (500+ members): All queries < 500ms

## Application Performance

### API Response Times

**Baseline Targets:**
```
GET /api/organization/[id]/members          < 100ms
GET /api/organization/[id]/email-accounts   < 150ms
GET /api/organization/[id]/billing          < 200ms
POST /api/user/email-account/[id]/transfer  < 300ms
GET /api/user/rules?emailAccountId=X        < 200ms
```

### Caching Strategy

**1. Organization Data:**
```typescript
// Cache user's organizations for 5 minutes
const cacheKey = `user:${userId}:organizations`;
const ttl = 300; // 5 minutes

// Invalidate on:
// - Member added/removed
// - Organization updated
// - User role changed
```

**2. Email Account Access:**
```typescript
// Cache access check results for 1 minute
const cacheKey = `access:${userId}:${emailAccountId}`;
const ttl = 60; // 1 minute

// Invalidate on:
// - Organization membership changed
// - Email account ownership transferred
// - Email account shared/unshared
```

**3. Billing Information:**
```typescript
// Cache billing data for 10 minutes
const cacheKey = `billing:${organizationId}`;
const ttl = 600; // 10 minutes

// Invalidate on:
// - Member added/removed
// - Subscription changed
// - Seat limit updated
```

### N+1 Query Prevention

**Problem:**
```typescript
// Bad: N+1 queries
const orgs = await prisma.organization.findMany();
for (const org of orgs) {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: org.id },
  });
}
```

**Solution:**
```typescript
// Good: Single query with include
const orgs = await prisma.organization.findMany({
  include: {
    members: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    },
  },
});
```

## Load Testing

### Tools
- **k6** - Load testing tool
- **Artillery** - Alternative load testing
- **PostgreSQL pg_stat_statements** - Query analysis

### Test Scenarios

**1. Concurrent Organization Access:**
```javascript
// k6 script
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100, // 100 virtual users
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3000/api/user/email-accounts');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

**2. Heavy Read Workload:**
```javascript
export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up
    { duration: '5m', target: 200 }, // Peak load
    { duration: '1m', target: 0 },   // Ramp down
  ],
};

export default function () {
  // Mix of endpoints
  http.get('/api/organization/[id]/members');
  http.get('/api/organization/[id]/email-accounts');
  http.get('/api/user/rules?emailAccountId=X');
}
```

**3. Write Operations:**
```javascript
export const options = {
  vus: 20,
  duration: '2m',
};

export default function () {
  // Add/remove members
  http.post('/api/organization/[id]/members', JSON.stringify({
    userId: 'user_123',
    role: 'MEMBER',
  }));

  // Transfer ownership
  http.post('/api/user/email-account/[id]/transfer', JSON.stringify({
    targetUserId: 'user_456',
  }));
}
```

### Performance Metrics to Monitor

**Response Times:**
- p50 (median)
- p95 (95th percentile)
- p99 (99th percentile)
- Max response time

**Throughput:**
- Requests per second
- Successful requests
- Failed requests

**Database:**
- Query count
- Slow queries (> 100ms)
- Connection pool usage
- Lock contention

**Memory:**
- Application memory usage
- Database memory usage
- Cache hit rate

## Optimization Strategies

### 1. Database Connection Pooling

**Configure Prisma connection pool:**
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Connection pool settings
  connection_limit = 20
  pool_timeout = 10
}
```

**Environment variables:**
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

### 2. Query Optimization

**Use select to limit fields:**
```typescript
// Before
const org = await prisma.organization.findUnique({
  where: { id: organizationId },
});

// After (faster)
const org = await prisma.organization.findUnique({
  where: { id: organizationId },
  select: {
    id: true,
    name: true,
    slug: true,
  },
});
```

**Batch queries instead of loops:**
```typescript
// Before
for (const emailAccountId of emailAccountIds) {
  await canAccessEmailAccount(userId, emailAccountId);
}

// After (faster)
const emailAccounts = await prisma.emailAccount.findMany({
  where: {
    id: { in: emailAccountIds },
    OR: [
      { userId },
      { organization: { members: { some: { userId } } } },
    ],
  },
});
```

### 3. Denormalization (if needed)

**Add computed fields to reduce joins:**
```prisma
model Organization {
  // ... other fields

  // Denormalized counts (updated on change)
  memberCount       Int @default(0)
  emailAccountCount Int @default(0)
}
```

**Update on changes:**
```typescript
// After adding member
await prisma.organization.update({
  where: { id: organizationId },
  data: { memberCount: { increment: 1 } },
});
```

### 4. Read Replicas (for scale)

**PostgreSQL read replicas:**
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")       // Primary (writes)
  url      = env("DATABASE_REPLICA_URL") // Replica (reads)
}
```

**Route queries:**
```typescript
// Writes go to primary
await prisma.$transaction([
  prisma.organization.create({ ... }),
]);

// Reads can go to replica
await prisma.organization.findMany({
  ...
});
```

## Monitoring

### Database Monitoring

**Enable pg_stat_statements:**
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT
  substring(query, 1, 50) AS short_query,
  round(total_exec_time::numeric, 2) AS total_time,
  calls,
  round(mean_exec_time::numeric, 2) AS mean,
  round(max_exec_time::numeric, 2) AS max
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Monitor connection pool:**
```sql
SELECT
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity;
```

### Application Monitoring

**Use Prisma metrics:**
```typescript
// Enable Prisma metrics
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'info', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
      params: e.params,
    });
  }
});
```

**Custom performance logging:**
```typescript
async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;

    logger.info('Performance metric', {
      operation: name,
      duration,
      success: true,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Performance metric', {
      operation: name,
      duration,
      success: false,
      error,
    });
    throw error;
  }
}

// Usage
const orgs = await measurePerformance(
  'getUserOrganizations',
  () => getUserOrganizations(userId)
);
```

## Performance Regression Testing

**Setup automated tests:**
```typescript
// __tests__/performance/organization.perf.test.ts
describe('Organization Performance', () => {
  it('should load organizations in < 50ms', async () => {
    const start = performance.now();
    await getUserOrganizations(testUserId);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should check access in < 20ms', async () => {
    const start = performance.now();
    await canAccessEmailAccount(testUserId, testEmailAccountId);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(20);
  });
});
```

## Scaling Recommendations

### Vertical Scaling
- **Database**: 4 vCPU, 16GB RAM minimum for production
- **Application**: 2 vCPU, 4GB RAM per instance
- **Cache**: 2GB RAM for Redis/Memcached

### Horizontal Scaling
- Multiple application instances behind load balancer
- Database read replicas for read-heavy workloads
- Distributed caching layer

### Data Partitioning (future)
- Shard by organization ID for very large deployments
- Separate databases for analytics vs transactional data

## Red Flags to Watch For

🚨 **Warning Signs:**
- Query times > 500ms consistently
- Connection pool exhaustion
- Memory leaks in long-running processes
- Cache hit rate < 70%
- Database CPU > 80% sustained
- Slow query log filling up

📊 **Action Thresholds:**
- p95 response time > 1s → Investigate immediately
- Database connections > 80% → Scale pool
- Memory usage growing → Check for leaks
- Error rate > 1% → Debug and fix

## Checklist

Performance validation checklist:
- [ ] All database indexes created
- [ ] Query execution plans verified
- [ ] No N+1 queries in hot paths
- [ ] Caching implemented for frequent queries
- [ ] Load testing completed successfully
- [ ] Monitoring and alerting configured
- [ ] Performance budgets defined
- [ ] Regression tests in place
