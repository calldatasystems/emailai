# EmailAI - Usage Controls & Rate Limiting

## Current Status: ⚠️ **MINIMAL CONTROLS IMPLEMENTED**

This document explains how EmailAI currently handles usage limits and what needs to be implemented to prevent abuse.

**Last Updated**: 2025-09-30

---

## Executive Summary

### What's Currently Implemented ✅

1. **Gmail API Rate Limiting** (External - Google's limits)
2. **AI Credits System** (Schema exists, not fully enforced)
3. **Unsubscribe Credits** (Schema exists, not fully enforced)
4. **Tier-Based Access Control** (Feature gating by plan)

### What's NOT Implemented ❌

1. **Application-Level Rate Limiting** (No API throttling)
2. **Email Processing Limits** (No "X emails per day" enforcement)
3. **Storage Limits** (No database size limits per org)
4. **Request Rate Limiting** (No protection against API abuse)
5. **Bandwidth Throttling** (No limits on data transfer)

### Critical Gap 🚨

**A user COULD theoretically:**
- Process millions of emails per day (limited only by Gmail API)
- Make unlimited API calls
- Store unlimited data in database
- Consume unlimited AI credits

**Why this hasn't been a problem:**
- Gmail API has its own rate limits (external protection)
- Current user base is small/trusted
- AI providers (OpenAI) have their own rate limits
- Database costs are currently manageable

---

## External Rate Limits (Already Protecting You)

### 1. Gmail API Limits (Google's Quotas)

**Google enforces these limits automatically:**

```
Per User Quotas:
  - 250 quota units per user per second
  - 15,000 quota units per user per minute

Operations Cost:
  - list messages: 5 units
  - get message: 5 units
  - modify message: 5 units
  - batch modify: 50 units

Effective Limits:
  - ~3,000 messages/minute (listing)
  - ~180,000 messages/hour max
  - ~4.3 million messages/day max (theoretical)
```

**Current Implementation:**
```typescript
// utils/gmail/retry.ts
export async function retryGmailOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (error.status === 429) {
      // Gmail rate limit hit - wait and retry
      await sleep(calculateBackoff(error.attemptNumber));
      return retryGmailOperation(operation, maxRetries - 1);
    }
    throw error;
  }
}
```

**Status**: ✅ Handled with exponential backoff

### 2. OpenAI API Limits

**OpenAI enforces:**
```
Free Tier:
  - 3 requests/minute
  - $5/month max

Paid Tier ($5+ prepaid):
  - 3,500 requests/minute
  - 90,000 requests/day
  - Rate limited automatically
```

**Current Implementation:**
```typescript
// Users can provide their own API key
// OR use your shared API key (needs rate limiting!)

export async function chatCompletionStream({
  prompt,
  model = "gpt-4",
  apiKey, // User's key OR your shared key
}: {
  prompt: string;
  model?: string;
  apiKey?: string;
}) {
  // If using shared key, this NEEDS rate limiting!
  const key = apiKey || env.OPENAI_API_KEY;
  // ... makes API call
}
```

**Status**: ⚠️ Partially protected (by OpenAI's limits)

### 3. Payment Provider Limits

**Stripe/LemonSqueezy webhook rate limits:**
```
Stripe:
  - 100 requests/second per account
  - Automatic retry with backoff

LemonSqueezy:
  - 60 requests/minute per account
```

**Status**: ✅ External protection

---

## Current Internal Controls

### 1. Credit System (Schema Exists, Not Enforced)

**Database Schema:**
```prisma
model Premium {
  // AI Credits
  aiMonth   Int? // 1-12 (current month)
  aiCredits Int? // Remaining credits this month

  // Unsubscribe Credits
  unsubscribeMonth   Int?
  unsubscribeCredits Int?
}
```

**Intended Behavior:**
```typescript
// What SHOULD happen (not currently enforced):

async function checkAiCredits(userId: string) {
  const premium = await getUserPremium(userId);

  // If free tier
  if (!premium.tier) {
    if (premium.aiCredits && premium.aiCredits > 0) {
      // Decrement credit
      await decrementAiCredit(userId);
      return true;
    }
    throw new Error("AI credits exhausted");
  }

  // If paid tier - unlimited
  return true;
}
```

**Current Reality:**
```typescript
// What ACTUALLY happens:
async function hasAiAccess(tier: PremiumTier | null) {
  if (!tier) return false; // Free tier blocked
  return true; // Paid tier = unlimited (no counting!)
}
```

**Status**: ⚠️ Schema exists, not enforced

### 2. Tier-Based Feature Access

**What IS enforced:**
```typescript
// Feature gating by tier
export const hasAiAccess = (tier: PremiumTier | null) => {
  if (!tier) return false; // No AI on free tier

  const ranking = tierRanking[tier];
  return ranking >= tierRanking[PremiumTier.BUSINESS_MONTHLY];
};

// In practice:
Free Tier: ❌ No AI features
Basic/Business: ✅ AI features (unlimited)
Business Plus: ✅ AI features (unlimited)
```

**Status**: ✅ Working (but binary - no usage limits)

---

## What's Missing (Critical Gaps)

### 1. API Rate Limiting ❌

**Current State:**
```
No rate limiting on API endpoints!

A malicious user could:
  - Make 1000s of requests per second
  - Overwhelm the database
  - Rack up infrastructure costs
```

**What's Needed:**
```typescript
// Option A: Redis-based rate limiting
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds
  analytics: true,
});

// In API route:
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return new Response("Rate limit exceeded", { status: 429 });
  }

  // ... handle request
}
```

**Recommended Limits:**
```typescript
const RATE_LIMITS = {
  // Per IP address
  anonymous: "10 req/10s",      // 1 req/second

  // Per authenticated user
  free: "30 req/minute",         // 1 req/2s
  basic: "120 req/minute",       // 2 req/s
  business: "300 req/minute",    // 5 req/s
  enterprise: "1000 req/minute", // 16 req/s

  // Specific endpoints
  aiEndpoints: "10 req/minute",     // AI calls are expensive
  bulkOperations: "5 req/minute",   // Bulk ops hit DB hard
  emailSync: "60 req/hour",         // Gmail sync
};
```

### 2. Email Processing Limits ❌

**Current State:**
```
No limits on emails processed!

A user could:
  - Sync millions of emails
  - Process entire Gmail history (10+ years)
  - Fill up database with historical data
```

**What's Needed:**
```typescript
// Track email processing per organization
model OrganizationUsage {
  id             String   @id @default(cuid())
  organizationId String
  month          Int      // 1-12
  year           Int      // 2025

  emailsProcessed  Int @default(0)
  aiCallsMade      Int @default(0)
  storageUsedMb    Int @default(0)

  @@unique([organizationId, month, year])
}

// Enforce limits
const EMAIL_PROCESSING_LIMITS = {
  FREE: 1000,           // 1k emails/month
  BASIC: 10_000,        // 10k emails/month
  BUSINESS: 100_000,    // 100k emails/month
  BUSINESS_PLUS: 1_000_000, // 1M emails/month
  ENTERPRISE: null,     // Unlimited
};

async function canProcessEmail(orgId: string): Promise<boolean> {
  const usage = await getMonthlyUsage(orgId);
  const tier = await getOrganizationTier(orgId);
  const limit = EMAIL_PROCESSING_LIMITS[tier];

  if (!limit) return true; // Unlimited
  return usage.emailsProcessed < limit;
}
```

### 3. AI Usage Limits ❌

**Current State:**
```
Paid users have "unlimited" AI calls!

Cost exposure:
  - GPT-4: $0.03 per 1k tokens (~$0.10 per email)
  - User processes 10k emails = $1,000 in AI costs
  - 100 users doing this = $100k/month in AI bills
```

**What's Needed:**
```typescript
// Track AI usage
const AI_CALL_LIMITS = {
  FREE: 0,              // No AI
  BASIC: 1_000,         // 1k AI calls/month
  BUSINESS: 10_000,     // 10k AI calls/month
  BUSINESS_PLUS: 100_000, // 100k AI calls/month
  ENTERPRISE: null,     // Unlimited (but monitored)
};

async function canMakeAiCall(orgId: string): Promise<boolean> {
  const usage = await getMonthlyUsage(orgId);
  const tier = await getOrganizationTier(orgId);
  const limit = AI_CALL_LIMITS[tier];

  if (!limit) return true;
  if (usage.aiCallsMade >= limit) {
    throw new Error(`AI limit reached (${limit}/month). Upgrade for more.`);
  }
  return true;
}

// Track after each AI call
async function trackAiUsage(orgId: string, tokensUsed: number) {
  await prisma.organizationUsage.update({
    where: { orgId_month_year },
    data: {
      aiCallsMade: { increment: 1 },
      aiTokensUsed: { increment: tokensUsed },
    },
  });
}
```

### 4. Storage Limits ❌

**Current State:**
```
No storage limits!

A user could:
  - Store millions of emails in DB
  - Never delete old data
  - Database grows infinitely
  - Backup costs skyrocket
```

**What's Needed:**
```typescript
const STORAGE_LIMITS_GB = {
  FREE: 0.5,      // 500 MB
  BASIC: 5,       // 5 GB
  BUSINESS: 50,   // 50 GB
  BUSINESS_PLUS: 500, // 500 GB
  ENTERPRISE: null,   // Unlimited
};

// Check storage periodically
async function checkStorageLimit(orgId: string): Promise<void> {
  const storageUsed = await calculateStorageUsed(orgId);
  const tier = await getOrganizationTier(orgId);
  const limit = STORAGE_LIMITS_GB[tier];

  if (limit && storageUsed > limit) {
    // Send warning email
    await sendStorageWarning(orgId, storageUsed, limit);

    // Block new email syncing
    await disableEmailSync(orgId);

    throw new Error(`Storage limit reached (${storageUsed}GB / ${limit}GB)`);
  }
}

// Calculate storage
async function calculateStorageUsed(orgId: string): Promise<number> {
  const result = await prisma.$queryRaw`
    SELECT
      pg_size_pretty(
        SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))
      ) as size
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('EmailAccount', 'EmailMessage', 'Rule', 'Knowledge')
    -- Filter by organizationId somehow
  `;

  return parseSizeToGB(result.size);
}
```

### 5. Webhook Rate Limiting ❌

**Current State:**
```
No limits on outbound webhooks!

A user could:
  - Configure webhook to fire on every email
  - Process 100k emails = 100k webhook calls
  - Overwhelm their server (or yours)
```

**What's Needed:**
```typescript
// Webhook queue with rate limiting
const WEBHOOK_LIMITS = {
  maxRetries: 3,
  timeout: 5000, // 5 seconds
  rateLimit: "100 req/minute", // Per organization
};

async function sendWebhook(orgId: string, event: any) {
  // Check rate limit
  const canSend = await checkWebhookRateLimit(orgId);
  if (!canSend) {
    logger.warn("Webhook rate limit exceeded", { orgId });
    return;
  }

  // Add to queue (background job)
  await queue.add("webhook", {
    organizationId: orgId,
    event,
    retries: 0,
  });
}
```

---

## Recommended Implementation Priority

### Phase 1: Critical (Implement ASAP) 🔴

**1. API Rate Limiting**
```
Cost to you if abused: High
Difficulty: Medium
Time: 2-3 days

Use: Upstash Redis + @upstash/ratelimit
```

**2. AI Usage Tracking & Limits**
```
Cost to you if abused: Very High ($$$)
Difficulty: Medium
Time: 3-5 days

Implement:
  - Track AI calls per org per month
  - Enforce limits by tier
  - Alert when 80% used
  - Block at 100%
```

**3. Email Processing Limits**
```
Cost to you if abused: Medium (DB growth)
Difficulty: Low
Time: 1-2 days

Implement:
  - Count emails synced per month
  - Enforce tier limits
  - Show usage in dashboard
```

### Phase 2: Important (Within 1 Month) 🟡

**4. Storage Monitoring**
```
Cost to you if abused: Medium (DB/backup costs)
Difficulty: Medium
Time: 2-3 days

Implement:
  - Calculate storage per org
  - Warn at 80%
  - Block new data at 100%
```

**5. Webhook Rate Limiting**
```
Cost to you if abused: Low
Difficulty: Low
Time: 1 day

Implement:
  - Queue webhooks
  - Rate limit per org
```

### Phase 3: Nice to Have (Within 3 Months) 🟢

**6. Usage Dashboard**
```
Benefit: User transparency, upsell opportunity
Difficulty: Medium
Time: 3-5 days

Features:
  - Show current usage
  - Show limits by tier
  - "Upgrade for more" CTAs
  - Usage graphs
```

**7. Overage Billing**
```
Benefit: Revenue from heavy users
Difficulty: High
Time: 5-7 days

Features:
  - Allow usage over limits
  - Charge per overage unit
  - "Add-on packs"
```

---

## Implementation Example: API Rate Limiting

### Setup Upstash Redis

```bash
# 1. Sign up at upstash.com (free tier: 10k requests/day)

# 2. Create Redis database

# 3. Add to .env
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

### Install Package

```bash
npm install @upstash/ratelimit @upstash/redis
```

### Create Rate Limiter Utility

```typescript
// utils/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getUserTier } from "./premium";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different limits per tier
const rateLimiters = {
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 req/min
    analytics: true,
  }),

  basic: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, "1 m"), // 120 req/min
    analytics: true,
  }),

  business: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, "1 m"), // 300 req/min
    analytics: true,
  }),

  enterprise: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, "1 m"), // 1000 req/min
    analytics: true,
  }),
};

export async function rateLimit(userId: string) {
  const tier = await getUserTier(userId);

  const limiter = tier
    ? rateLimiters.business // Default for paid
    : rateLimiters.free;

  const { success, limit, reset, remaining } = await limiter.limit(userId);

  return {
    success,
    limit,
    reset,
    remaining,
  };
}
```

### Apply to API Routes

```typescript
// app/api/user/rules/route.ts
import { rateLimit } from "@/utils/rate-limit";

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limit check
  const { success, limit, reset, remaining } = await rateLimit(session.user.id);

  if (!success) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        limit,
        reset: new Date(reset),
        remaining,
      }),
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  // Continue with normal request handling...
}
```

### Middleware Approach (Better)

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "./utils/rate-limit";

export async function middleware(request: NextRequest) {
  // Only rate limit API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const userId = request.cookies.get("user_id")?.value;

    if (userId) {
      const { success, limit, reset, remaining } = await rateLimit(userId);

      if (!success) {
        return new NextResponse(
          JSON.stringify({ error: "Rate limit exceeded" }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
```

---

## Cost Impact Analysis

### Without Limits (Current State)

**Worst Case Scenario:**
```
100 users, each processing 100k emails/month with AI

Gmail API: Free (Google's limits protect you)
AI Costs: 100 users × 100k emails × $0.10 = $1,000,000/month 🚨
Database: 100 × 100k × 50KB = 500GB = ~$200/month
Bandwidth: Minimal

Total: ~$1M/month (AI costs dominate)
```

### With Limits (Recommended)

**Realistic Scenario:**
```
Tier Breakdown:
  - 70 free users: 0 AI calls
  - 20 basic users: 20 × 1k AI × $0.10 = $200
  - 8 business users: 8 × 10k AI × $0.10 = $800
  - 2 business plus: 2 × 100k AI × $0.10 = $2,000

Total AI costs: $3,000/month
Database: Controlled growth = $50/month
Bandwidth: Minimal

Total: ~$3,000/month ✅
```

**Protection Factor: 333x cost reduction**

---

## Monitoring & Alerts

### What to Monitor

```typescript
// Daily monitoring dashboard
const metrics = {
  // Per organization
  emailsProcessedToday: number,
  aiCallsToday: number,
  apiRequestsToday: number,
  storageUsedGB: number,

  // Thresholds
  approaching80Percent: boolean,
  limitReached: boolean,

  // Anomalies
  unusualSpike: boolean, // 10x normal usage
  suspiciousActivity: boolean,
};
```

### Alert Triggers

```typescript
// Send alerts when:
if (usage.aiCalls > limit * 0.8) {
  await sendEmail({
    to: orgOwner.email,
    subject: "80% AI usage reached",
    body: "You've used 80% of your AI credits. Upgrade?"
  });
}

if (usage.aiCalls > limit * 1.5) {
  await sendSlackAlert({
    channel: "#ops-alerts",
    message: `🚨 Org ${org.name} at 150% AI usage - possible abuse?`,
  });
}
```

---

## Summary & Recommendations

### Current Risk Level: 🔴 **HIGH**

**You are currently protected by:**
- ✅ Gmail API rate limits (external)
- ✅ OpenAI rate limits (external)
- ✅ Small user base (low risk)

**You are NOT protected from:**
- ❌ API abuse (unlimited requests)
- ❌ AI cost exposure (unlimited AI calls)
- ❌ Database bloat (unlimited storage)

### Immediate Actions (Next 2 Weeks)

1. **Implement API rate limiting** (Upstash Redis)
   - Cost: $0-10/month (free tier sufficient initially)
   - Benefit: Prevent API abuse
   - Priority: CRITICAL

2. **Track AI usage per organization**
   - Add OrganizationUsage table
   - Implement monthly limits
   - Priority: CRITICAL

3. **Set email processing limits**
   - Count emails synced
   - Enforce tier limits
   - Priority: HIGH

4. **Create usage monitoring dashboard**
   - Admin view of all org usage
   - Anomaly detection
   - Priority: MEDIUM

### Long-term Strategy

**Usage-Based Pricing Model:**
```
Base: $20/month (includes 10k emails, 1k AI calls)
Additional:
  - $5 per 10k emails
  - $10 per 1k AI calls
  - $1 per GB storage
```

This converts heavy users from cost risk to revenue opportunity!

---

**Want me to implement any of these controls?** I can:
1. Set up Upstash rate limiting
2. Create OrganizationUsage tracking
3. Build usage monitoring dashboard
4. Implement tier-based limits

Let me know which is highest priority!
