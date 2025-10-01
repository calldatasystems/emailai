# EmailAI Monitoring & Alerting Setup

## Overview

This document provides comprehensive monitoring and alerting configuration for the multi-tenant EmailAI application. It covers application performance monitoring (APM), infrastructure monitoring, logging, and incident response.

## Table of Contents

1. [Monitoring Stack](#monitoring-stack)
2. [Application Monitoring](#application-monitoring)
3. [Infrastructure Monitoring](#infrastructure-monitoring)
4. [Database Monitoring](#database-monitoring)
5. [Logging](#logging)
6. [Alerting](#alerting)
7. [Dashboards](#dashboards)
8. [Incident Response](#incident-response)

## Monitoring Stack

### Recommended Tools

**Application Performance Monitoring:**
- **Sentry** - Error tracking and performance monitoring
- **PostHog** - Product analytics and session replay

**Infrastructure Monitoring:**
- **Datadog** - Full-stack monitoring (recommended for enterprise)
- **Grafana + Prometheus** - Open-source alternative
- **Better Stack** - Uptime monitoring and incident management

**Logging:**
- **Axiom** - Log aggregation and analysis
- **LogDNA** - Alternative logging platform
- **CloudWatch Logs** - For AWS deployments

**Database Monitoring:**
- **pganalyze** - PostgreSQL performance monitoring
- **Prisma Pulse** - Real-time database monitoring

## Application Monitoring

### Sentry Configuration

**1. Installation:**

```bash
cd apps/web
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**2. Configure Environment Variables:**

`.env.production`:
```bash
SENTRY_DSN="https://xxx@sentry.io/xxx"
SENTRY_ORG="your-org"
SENTRY_PROJECT="emailai-prod"
SENTRY_AUTH_TOKEN="sntrys_xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
```

**3. Sentry Configuration:**

`sentry.server.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Session replay for debugging
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Filter sensitive data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }

    // Remove sensitive context
    if (event.contexts?.emailAccount) {
      delete event.contexts.emailAccount.refreshToken;
      delete event.contexts.emailAccount.accessToken;
    }

    return event;
  },

  // Ignore expected errors
  ignoreErrors: [
    /Network request failed/,
    /ResizeObserver loop limit exceeded/,
    /Non-Error promise rejection captured/,
  ],
});
```

`sentry.client.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

**4. Custom Error Tracking:**

`utils/monitoring.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

export function captureOrganizationError(
  error: Error,
  context: {
    organizationId?: string;
    userId?: string;
    action?: string;
  }
) {
  Sentry.withScope((scope) => {
    scope.setContext("organization", {
      organizationId: context.organizationId,
      userId: context.userId,
      action: context.action,
    });
    scope.setLevel("error");
    Sentry.captureException(error);
  });
}

export function trackPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, any>
) {
  Sentry.withScope((scope) => {
    scope.setContext("performance", {
      operation,
      duration,
      ...metadata,
    });

    if (duration > 1000) {
      scope.setLevel("warning");
      Sentry.captureMessage(`Slow operation: ${operation} (${duration}ms)`);
    }
  });
}
```

**5. Performance Monitoring:**

```typescript
import { startSpan } from "@sentry/nextjs";

export async function getOrganizationWithSpan(id: string) {
  return await startSpan(
    {
      name: "db.getOrganization",
      op: "db.query",
      attributes: { organizationId: id },
    },
    async () => {
      return await prisma.organization.findUnique({
        where: { id },
        include: { members: true },
      });
    }
  );
}
```

### PostHog Analytics

**1. Installation:**

```bash
npm install posthog-js posthog-node
```

**2. Environment Variables:**

```bash
NEXT_PUBLIC_POSTHOG_KEY="phc_xxx"
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
```

**3. Client Configuration:**

`app/providers/PostHogProvider.tsx`:
```typescript
'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        capture_pageview: false,
        autocapture: false,

        // Respect user privacy
        opt_out_capturing_by_default: false,
        respect_dnt: true,
      });
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      });
    }
  }, [session]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

**4. Track Custom Events:**

```typescript
import { usePostHog } from 'posthog-js/react';

export function OrganizationSettings() {
  const posthog = usePostHog();

  const handleMemberAdded = (memberId: string, role: string) => {
    posthog.capture('member_added', {
      memberId,
      role,
      organizationId: currentOrgId,
    });
  };

  const handleBillingUpdated = (seats: number, tier: string) => {
    posthog.capture('billing_updated', {
      seats,
      tier,
      organizationId: currentOrgId,
    });
  };

  return <div>...</div>;
}
```

**5. Feature Flags:**

```typescript
import { useFeatureFlagEnabled } from 'posthog-js/react';

export function NewFeature() {
  const isEnabled = useFeatureFlagEnabled('new-organization-ui');

  if (!isEnabled) {
    return <OldUI />;
  }

  return <NewUI />;
}
```

## Infrastructure Monitoring

### Datadog Setup

**1. Installation:**

```bash
# Install Datadog Agent on server
DD_API_KEY=xxx DD_SITE="datadoghq.com" bash -c "$(curl -L https://s.datadoghq.com/scripts/install_script_agent7.sh)"
```

**2. Configure Application Metrics:**

`utils/metrics.ts`:
```typescript
import { StatsD } from 'hot-shots';

const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  prefix: 'emailai.',
  globalTags: {
    env: process.env.NODE_ENV || 'development',
    service: 'web',
  },
});

export const metrics = {
  increment: (metric: string, tags?: Record<string, string>) => {
    dogstatsd.increment(metric, 1, tags);
  },

  gauge: (metric: string, value: number, tags?: Record<string, string>) => {
    dogstatsd.gauge(metric, value, tags);
  },

  histogram: (metric: string, value: number, tags?: Record<string, string>) => {
    dogstatsd.histogram(metric, value, tags);
  },

  timing: (metric: string, duration: number, tags?: Record<string, string>) => {
    dogstatsd.timing(metric, duration, tags);
  },
};
```

**3. Track Business Metrics:**

```typescript
// Track organization creation
export async function createOrganization(data: CreateOrgInput) {
  const start = Date.now();

  try {
    const org = await prisma.organization.create({ data });

    metrics.increment('organization.created', {
      tier: org.tier || 'free',
    });

    metrics.timing('organization.create_duration', Date.now() - start);

    return org;
  } catch (error) {
    metrics.increment('organization.create_error');
    throw error;
  }
}

// Track API endpoint performance
export async function GET(request: Request) {
  const start = Date.now();

  try {
    const data = await fetchData();

    metrics.timing('api.organization.get', Date.now() - start, {
      status: '200',
    });

    return NextResponse.json(data);
  } catch (error) {
    metrics.timing('api.organization.get', Date.now() - start, {
      status: '500',
    });

    metrics.increment('api.organization.error');
    throw error;
  }
}
```

**4. Custom Metrics Dashboard:**

Create `datadog-dashboard.json`:
```json
{
  "title": "EmailAI Production Dashboard",
  "widgets": [
    {
      "definition": {
        "title": "Organizations Created",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:emailai.organization.created{env:production}.as_count()",
            "display_type": "bars"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "API Response Times",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:emailai.api.organization.get{env:production}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Error Rate",
        "type": "query_value",
        "requests": [
          {
            "q": "sum:emailai.api.organization.error{env:production}.as_rate()",
            "aggregator": "avg"
          }
        ]
      }
    }
  ]
}
```

### Prometheus + Grafana (Open Source Alternative)

**1. Prometheus Configuration:**

`prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'emailai-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'

  - job_name: 'postgresql'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
```

**2. Expose Metrics Endpoint:**

`app/api/metrics/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { register } from "prom-client";

export async function GET() {
  const metrics = await register.metrics();

  return new NextResponse(metrics, {
    headers: {
      'Content-Type': register.contentType,
    },
  });
}
```

**3. Custom Metrics:**

`utils/prometheus.ts`:
```typescript
import { Counter, Histogram, Gauge, register } from 'prom-client';

// Request counter
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Response time histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Active organizations gauge
export const activeOrganizations = new Gauge({
  name: 'emailai_active_organizations',
  help: 'Number of active organizations',
  registers: [register],
});

// Update gauge periodically
setInterval(async () => {
  const count = await prisma.organization.count();
  activeOrganizations.set(count);
}, 60000);
```

## Database Monitoring

### pganalyze Configuration

**1. Create pganalyze Account:**

Sign up at https://pganalyze.com

**2. Install Collector:**

```bash
# Install pganalyze collector
curl -L https://packages.pganalyze.com/pganalyze_collector.sh | sudo bash

# Configure
sudo nano /etc/pganalyze-collector.conf
```

**3. Configuration:**

`/etc/pganalyze-collector.conf`:
```ini
[emailai_prod]
api_key = YOUR_API_KEY
db_host = localhost
db_name = emailai_prod
db_username = emailai
db_password = YOUR_PASSWORD
db_port = 5432

# Enable query statistics
db_query_stats_enabled = true

# AWS RDS specific settings (if applicable)
aws_region = us-east-1
aws_db_instance_id = emailai-prod
```

**4. Start Collector:**

```bash
sudo systemctl enable pganalyze-collector
sudo systemctl start pganalyze-collector
sudo systemctl status pganalyze-collector
```

### Custom Database Monitoring

**1. Query Performance Tracking:**

```typescript
import { PrismaClient } from '@prisma/client';
import { metrics } from './metrics';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
  ],
});

// Track slow queries
prisma.$on('query', (e) => {
  metrics.timing('db.query', e.duration, {
    model: e.target || 'unknown',
  });

  if (e.duration > 100) {
    console.warn('Slow query detected:', {
      query: e.query.substring(0, 200),
      duration: e.duration,
      timestamp: new Date().toISOString(),
    });

    metrics.increment('db.slow_query', {
      model: e.target || 'unknown',
    });
  }
});

prisma.$on('error', (e) => {
  console.error('Database error:', e);
  metrics.increment('db.error');
});
```

**2. Connection Pool Monitoring:**

```typescript
// Monitor connection pool health
setInterval(async () => {
  try {
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) as count
      FROM pg_stat_activity
      WHERE datname = 'emailai_prod'
    `;

    const activeConnections = Number(result[0].count);

    metrics.gauge('db.connections.active', activeConnections);

    if (activeConnections > 20) {
      console.warn('High number of active connections:', activeConnections);
    }
  } catch (error) {
    console.error('Failed to check connection pool:', error);
  }
}, 30000);
```

**3. Table Size Monitoring:**

```typescript
// Track database size and table sizes
export async function monitorDatabaseSize() {
  const tablesSizes = await prisma.$queryRaw<
    Array<{ table_name: string; size_mb: number }>
  >`
    SELECT
      schemaname || '.' || tablename AS table_name,
      pg_total_relation_size(schemaname || '.' || tablename) / 1024 / 1024 AS size_mb
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY size_mb DESC
    LIMIT 10
  `;

  tablesSizes.forEach((table) => {
    metrics.gauge('db.table_size_mb', table.size_mb, {
      table: table.table_name,
    });
  });

  return tablesSizes;
}

// Run every hour
setInterval(monitorDatabaseSize, 3600000);
```

## Logging

### Axiom Setup

**1. Create Axiom Account:**

Sign up at https://axiom.co

**2. Environment Variables:**

```bash
AXIOM_TOKEN="xaat-xxx"
AXIOM_DATASET="production"
AXIOM_ORG_ID="your-org"
```

**3. Configure Logger:**

`utils/logger.ts`:
```typescript
import pino from 'pino';
import { Axiom } from '@axiomhq/js';

const axiom = new Axiom({
  token: process.env.AXIOM_TOKEN!,
  orgId: process.env.AXIOM_ORG_ID,
});

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // Custom serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        host: req.headers.host,
        userAgent: req.headers['user-agent'],
      },
    }),
  },

  // Stream to Axiom
  stream: {
    write: (msg: string) => {
      const log = JSON.parse(msg);

      axiom.ingest(process.env.AXIOM_DATASET!, [
        {
          ...log,
          timestamp: new Date().toISOString(),
          service: 'emailai-web',
          environment: process.env.NODE_ENV,
        },
      ]);

      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(msg);
      }
    },
  },
});

// Flush logs on exit
process.on('beforeExit', async () => {
  await axiom.flush();
});

export { logger };
```

**4. Structured Logging:**

```typescript
import { logger } from './logger';

// Info logging
logger.info({ organizationId, userId }, 'Organization created');

// Error logging
logger.error({ err, organizationId }, 'Failed to add member');

// Performance logging
logger.debug({ duration, operation: 'getOrganization' }, 'Query completed');

// Security logging
logger.warn({ userId, attemptedOrgId }, 'Unauthorized access attempt');
```

**5. Log Query Interface:**

Create Axiom queries for common scenarios:

```apl
// Find errors in the last hour
['production']
| where _time > ago(1h)
| where level == "error"
| project _time, msg, err, organizationId, userId

// Slow queries
['production']
| where _time > ago(24h)
| where operation == "getOrganization"
| where duration > 100
| summarize avg(duration), max(duration), count() by organizationId

// Failed authentication attempts
['production']
| where _time > ago(1h)
| where msg contains "unauthorized"
| summarize count() by userId
| order by count desc
```

### CloudWatch Logs (AWS)

**1. Configure CloudWatch Agent:**

`/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`:
```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/emailai/app.log",
            "log_group_name": "/emailai/production/app",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/emailai/production/nginx-access",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
```

**2. Start Agent:**

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

## Alerting

### Sentry Alerts

**1. Configure Alert Rules:**

Sentry Dashboard → Alerts → Create Alert Rule

**Critical Errors Alert:**
```
Condition: Error count > 10 in 5 minutes
Filter: level:error AND environment:production
Actions: Email ops@example.com, Slack #incidents
```

**Performance Degradation Alert:**
```
Condition: P95 response time > 2 seconds in 10 minutes
Filter: transaction:/api/organization/*
Actions: Email ops@example.com
```

**2. Programmatic Alerts:**

```typescript
import * as Sentry from "@sentry/nextjs";

export async function checkSystemHealth() {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        component: 'health-check',
        check: 'database',
      },
    });
  }

  // Check external services
  try {
    await checkGmailAPI();
  } catch (error) {
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        component: 'health-check',
        check: 'gmail-api',
      },
    });
  }
}
```

### Datadog Monitors

**1. Create Monitors via UI:**

Datadog → Monitors → New Monitor

**High Error Rate Monitor:**
```
Metric: emailai.api.organization.error
Condition: sum:emailai.api.organization.error{env:production}.as_rate() > 0.05
Alert message: High error rate detected: {{value}} errors/second
Notify: @ops-team @slack-incidents
```

**Slow API Monitor:**
```
Metric: emailai.api.organization.get
Condition: avg:emailai.api.organization.get{env:production} > 2000
Alert message: API response time degraded: {{value}}ms (threshold: 2000ms)
Notify: @ops-team
```

**Database Connection Pool Monitor:**
```
Metric: emailai.db.connections.active
Condition: avg:emailai.db.connections.active{env:production} > 20
Alert message: High database connection usage: {{value}}/25
Notify: @ops-team
```

**2. Programmatic Monitors:**

`scripts/setup-datadog-monitors.ts`:
```typescript
import { v1 } from '@datadog/datadog-api-client';

const configuration = v1.createConfiguration();
const apiInstance = new v1.MonitorsApi(configuration);

async function createMonitors() {
  // High error rate monitor
  await apiInstance.createMonitor({
    body: {
      name: 'EmailAI - High Error Rate',
      type: 'metric alert',
      query: 'sum(last_5m):sum:emailai.api.organization.error{env:production}.as_rate() > 0.05',
      message: 'High error rate detected @ops-team',
      tags: ['service:emailai', 'env:production'],
      priority: 1,
    },
  });

  // Seat limit approaching
  await apiInstance.createMonitor({
    body: {
      name: 'EmailAI - Organization Seat Limit Warning',
      type: 'metric alert',
      query: 'avg(last_10m):avg:emailai.organization.seat_usage{env:production} > 0.8',
      message: 'Organization approaching seat limit @ops-team',
      tags: ['service:emailai', 'env:production'],
      priority: 3,
    },
  });
}
```

### Better Stack (Uptime Monitoring)

**1. Create Uptime Checks:**

Better Stack Dashboard → Monitors → Create Monitor

**Production Health Check:**
```
Name: EmailAI Production Health
URL: https://yourdomain.com/api/health
Method: GET
Expected Status: 200
Check Interval: 60 seconds
Timeout: 30 seconds

Alert Channels:
- Email: ops@example.com
- Slack: #incidents
- PagerDuty: emailai-critical
```

**2. Status Page:**

Create public status page: https://status.yourdomain.com

**Components:**
- Web Application
- API
- Database
- Gmail Integration
- Stripe Billing

### PagerDuty Integration

**1. Setup PagerDuty:**

```bash
# Environment variables
PAGERDUTY_INTEGRATION_KEY="xxx"
```

**2. Create Alert Function:**

`utils/pagerduty.ts`:
```typescript
import axios from 'axios';

export async function triggerPagerDutyAlert(
  severity: 'critical' | 'error' | 'warning' | 'info',
  summary: string,
  details: Record<string, any>
) {
  await axios.post('https://events.pagerduty.com/v2/enqueue', {
    routing_key: process.env.PAGERDUTY_INTEGRATION_KEY,
    event_action: 'trigger',
    payload: {
      summary,
      severity,
      source: 'emailai-production',
      custom_details: details,
    },
  });
}

// Usage
export async function handleCriticalError(error: Error, context: any) {
  await triggerPagerDutyAlert(
    'critical',
    `Database connection failed: ${error.message}`,
    {
      error: error.stack,
      context,
      timestamp: new Date().toISOString(),
    }
  );
}
```

## Dashboards

### Grafana Dashboard

**1. Install Grafana:**

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

**2. Dashboard JSON:**

`grafana-dashboard.json`:
```json
{
  "dashboard": {
    "title": "EmailAI Production Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"emailai-app\"}[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "emailai_db_connections_active"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Active Organizations",
        "targets": [
          {
            "expr": "emailai_active_organizations"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

**3. Import Dashboard:**

```bash
# Via API
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -d @grafana-dashboard.json \
  http://localhost:3000/api/dashboards/db
```

### Custom Admin Dashboard

**1. Create Monitoring Dashboard:**

`app/[emailAccountId]/admin/monitoring/page.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    // Fetch metrics every 30 seconds
    const interval = setInterval(async () => {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      setMetrics(data);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard
        title="Total Organizations"
        value={metrics?.organizations.total}
        change={metrics?.organizations.changePercent}
      />
      <MetricCard
        title="Active Users (24h)"
        value={metrics?.users.active24h}
        change={metrics?.users.changePercent}
      />
      <MetricCard
        title="API Response Time (P95)"
        value={`${metrics?.api.p95ResponseTime}ms`}
        threshold={2000}
      />
      <MetricCard
        title="Error Rate"
        value={`${metrics?.errors.rate}%`}
        threshold={1}
      />
      <MetricCard
        title="Database Connections"
        value={`${metrics?.db.connections}/25`}
        threshold={20}
      />
      <MetricCard
        title="Email Sync Queue"
        value={metrics?.queue.pending}
        threshold={1000}
      />
    </div>
  );
}
```

**2. Metrics API Endpoint:**

`app/api/admin/metrics/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/utils/prisma";

export async function GET() {
  const session = await getServerSession();

  // Only allow admins
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalOrgs,
    activeUsers24h,
    errorCount,
    dbConnections,
  ] = await Promise.all([
    prisma.organization.count(),

    prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),

    prisma.$queryRaw`
      SELECT COUNT(*) FROM error_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `,

    prisma.$queryRaw`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = 'emailai_prod'
    `,
  ]);

  return NextResponse.json({
    organizations: {
      total: totalOrgs,
    },
    users: {
      active24h: activeUsers24h,
    },
    errors: {
      count: errorCount,
    },
    db: {
      connections: dbConnections,
    },
  });
}
```

## Incident Response

### Runbook

**1. Critical Alert Received:**

```
1. Acknowledge alert in PagerDuty/Slack
2. Check status page for ongoing incidents
3. Access monitoring dashboards (Datadog/Grafana)
4. Review recent deployments (last 2 hours)
5. Check application logs (Axiom/CloudWatch)
6. Check error tracking (Sentry)
```

**2. Database Issues:**

```
Symptoms: High response times, connection errors, timeouts

Investigation:
1. Check database CPU/memory (CloudWatch/Datadog)
2. Check active connections: SELECT count(*) FROM pg_stat_activity
3. Check slow queries: pganalyze or pg_stat_statements
4. Check replication lag (if applicable)

Resolution:
- Kill slow queries: SELECT pg_terminate_backend(pid)
- Increase connection pool: Update DATABASE_URL connection_limit
- Optimize slow queries: Add indexes, rewrite queries
- Scale database: Upgrade instance size
```

**3. High Error Rate:**

```
Symptoms: Increased 500 errors, Sentry alerts

Investigation:
1. Check Sentry for error patterns
2. Review application logs for stack traces
3. Check recent code deployments
4. Check external service status (Gmail API, Stripe)

Resolution:
- Rollback deployment if recent deploy
- Fix bug and deploy hotfix
- Disable failing feature with feature flag
- Scale up if capacity issue
```

**4. External Service Outage:**

```
Symptoms: Gmail API errors, Stripe webhook failures

Investigation:
1. Check Gmail API status: https://www.google.com/appsstatus
2. Check Stripe status: https://status.stripe.com
3. Review error logs for specific service errors

Resolution:
- Implement graceful degradation
- Queue failed operations for retry
- Communicate to users via status page
- Monitor for service recovery
```

### On-Call Rotation

**Weekly Rotation:**
```
Week 1: Engineer A (primary), Engineer B (secondary)
Week 2: Engineer B (primary), Engineer C (secondary)
Week 3: Engineer C (primary), Engineer A (secondary)
```

**Escalation Path:**
```
Level 1: On-call engineer (15 min response time)
Level 2: Engineering manager (30 min response time)
Level 3: CTO (1 hour response time)
```

### Post-Incident Review

**Template:**

```markdown
# Incident Post-Mortem: [TITLE]

**Date**: 2024-01-15
**Duration**: 14:30 - 16:45 UTC (2h 15m)
**Severity**: Critical
**Impact**: 500 organizations unable to sync emails

## Timeline

- 14:30 - Alert triggered: High error rate on Gmail API
- 14:35 - On-call engineer acknowledged
- 14:45 - Root cause identified: OAuth token refresh failing
- 15:00 - Hotfix deployed to production
- 15:30 - Error rate back to normal
- 16:45 - All affected users recovered

## Root Cause

OAuth refresh token encryption key was rotated without updating all instances.

## Resolution

1. Reverted encryption key to previous version
2. Implemented key rotation procedure
3. Added monitoring for OAuth failures

## Action Items

- [ ] Document key rotation procedure (Owner: Engineer A, Due: 2024-01-20)
- [ ] Add alerts for OAuth failure rate (Owner: Engineer B, Due: 2024-01-18)
- [ ] Implement zero-downtime key rotation (Owner: Engineer C, Due: 2024-02-01)
- [ ] Add integration tests for OAuth flow (Owner: Engineer A, Due: 2024-01-25)

## Lessons Learned

- Need better coordination for infrastructure changes
- Monitoring gaps: OAuth failures weren't alerted quickly enough
- Documentation needed for key rotation procedures
```

## Monitoring Checklist

### Daily Checks
- [ ] Review error rate in Sentry
- [ ] Check API response times
- [ ] Verify backup success
- [ ] Review critical alerts

### Weekly Checks
- [ ] Review slow query reports (pganalyze)
- [ ] Check database growth trends
- [ ] Review capacity metrics
- [ ] Analyze user analytics (PostHog)

### Monthly Checks
- [ ] Review and update alert thresholds
- [ ] Analyze incident trends
- [ ] Update monitoring documentation
- [ ] Review on-call rotation effectiveness

---

**Next Steps:**
- See [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md) for migration procedures
- See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for deployment configuration
- See [SECURITY_AUDIT.md](../SECURITY_AUDIT.md) for security monitoring
