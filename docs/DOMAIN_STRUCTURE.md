# calldata.app Domain Structure

This document describes the complete domain structure for all calldata.app products and services.

## Overview

calldata.app uses a hierarchical subdomain structure to organize products, APIs, and shared infrastructure in a user-friendly and scalable way.

---

## Domain Hierarchy

### **Main Domain**
```
calldata.app                      # Marketing/landing page for calldata brand
```

---

### **Product Domains** (User-Facing Applications)
```
emailai.calldata.app              # EmailAI - AI Email Assistant
foundations.calldata.app          # Foundations - [Product Description]
[product].calldata.app            # Future products follow same pattern
```

**Pattern**: `[product-name].calldata.app`

**Purpose**: Direct user access to web applications

---

### **API Domains** (Developer-Facing)

#### **Option 1: Unified API Gateway** (Recommended)
```
api.calldata.app/v1/emailai/*         # EmailAI API endpoints
api.calldata.app/v1/foundations/*     # Foundations API endpoints
api.calldata.app/v1/[product]/*       # Future product APIs
```

**Benefits**:
- Single domain for developers to remember
- Easier SSL/certificate management
- Centralized rate limiting, analytics, and monitoring
- Versioned endpoints (v1, v2, etc.)

**Example Usage**:
```bash
# Get EmailAI threads
curl https://api.calldata.app/v1/emailai/threads

# Get Foundations data
curl https://api.calldata.app/v1/foundations/projects
```

#### **Option 2: Direct Product APIs** (Advanced/Internal)
```
api.emailai.calldata.app/*            # EmailAI direct API
api.foundations.calldata.app/*        # Foundations direct API
api.[product].calldata.app/*          # Future product direct APIs
```

**Benefits**:
- Product isolation
- Independent scaling
- Direct access for advanced users

**Recommendation**: Use unified gateway (`api.calldata.app`) in public documentation, mention direct APIs for advanced users.

---

### **Shared Infrastructure**

```
ai.calldata.app                   # Shared Ollama AI inference server
                                  # Serves all calldata.app products
                                  # Endpoints: /api/generate, /api/embeddings

auth.calldata.app                 # Centralized SSO authentication
                                  # OAuth, SAML, single sign-on across products

docs.calldata.app                 # Unified documentation portal
                                  # Routes to product-specific docs
                                  # /emailai, /foundations, /api

status.calldata.app               # Status page for all services
                                  # Real-time uptime monitoring
                                  # Incident history

admin.calldata.app                # Cross-product admin dashboard
                                  # User management, analytics
                                  # Organization/billing management

analytics.calldata.app            # Shared analytics dashboard
                                  # Cross-product insights
                                  # Usage metrics, trends

cache.calldata.app                # Shared Redis cache (optional)
                                  # Centralized caching layer
```

---

### **Development & Staging Environments**

```
dev.emailai.calldata.app          # EmailAI development
staging.emailai.calldata.app      # EmailAI staging
dev.foundations.calldata.app      # Foundations development
staging.foundations.calldata.app  # Foundations staging
```

**Pattern**: `[env].[product].calldata.app`

**Alternative** (if preferred):
```
emailai-dev.calldata.app          # EmailAI development
emailai-staging.calldata.app      # EmailAI staging
```

---

## Complete Structure Map

```
calldata.app
├── Marketing/Landing
│
├── Products
│   ├── emailai.calldata.app
│   ├── foundations.calldata.app
│   └── [future-product].calldata.app
│
├── APIs
│   ├── api.calldata.app
│   │   ├── /v1/emailai/*
│   │   ├── /v1/foundations/*
│   │   └── /v1/[product]/*
│   │
│   └── Direct APIs (optional)
│       ├── api.emailai.calldata.app
│       └── api.foundations.calldata.app
│
├── Shared Infrastructure
│   ├── ai.calldata.app
│   ├── auth.calldata.app
│   ├── docs.calldata.app
│   ├── status.calldata.app
│   ├── admin.calldata.app
│   ├── analytics.calldata.app
│   └── cache.calldata.app
│
└── Development
    ├── dev.emailai.calldata.app
    ├── staging.emailai.calldata.app
    ├── dev.foundations.calldata.app
    └── staging.foundations.calldata.app
```

---

## DNS Configuration

### **Example DNS Records**

```bash
# Main domain
calldata.app                    A       123.45.67.89    # Marketing site
www.calldata.app                CNAME   calldata.app

# Products
emailai.calldata.app            CNAME   emailai-prod.vercel.app
foundations.calldata.app        CNAME   foundations-prod.vercel.app

# Unified API
api.calldata.app                CNAME   api-gateway.fly.io

# Shared Infrastructure
ai.calldata.app                 A       45.67.89.123    # Vast.ai or dedicated server
auth.calldata.app               CNAME   auth-service.vercel.app
docs.calldata.app               CNAME   docs-site.vercel.app
status.calldata.app             CNAME   status.betteruptime.com
admin.calldata.app              CNAME   admin-dashboard.vercel.app

# Development
dev.emailai.calldata.app        CNAME   emailai-dev.vercel.app
staging.emailai.calldata.app    CNAME   emailai-staging.vercel.app
```

### **Wildcard Option** (Alternative)

```bash
# Single wildcard for all subdomains
*.calldata.app                  A       123.45.67.90

# Then route internally via reverse proxy (Nginx, Caddy, Cloudflare Workers)
```

---

## SSL/TLS Certificates

### **Option 1: Wildcard Certificate** (Recommended)
```
*.calldata.app
calldata.app
```

**Benefits**:
- Single certificate for all subdomains
- Easier management
- Lower cost

**Providers**: Let's Encrypt (free), Cloudflare (free with proxy)

### **Option 2: Individual Certificates**
```
calldata.app
emailai.calldata.app
foundations.calldata.app
api.calldata.app
ai.calldata.app
...
```

**Benefits**: More granular control, better for compliance

---

## User Experience Examples

### **End User (EmailAI)**

1. Visit: `emailai.calldata.app`
2. Click "Sign In" → Redirects to `auth.calldata.app`
3. After authentication → Returns to `emailai.calldata.app/automation`
4. Check docs: `docs.calldata.app/emailai`
5. Check status: `status.calldata.app`

### **Developer (Integrating EmailAI API)**

1. Read API docs: `docs.calldata.app/emailai/api`
2. API base URL: `https://api.calldata.app/v1/emailai`
3. Example request:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://api.calldata.app/v1/emailai/threads
   ```

### **Admin User**

1. Access admin: `admin.calldata.app`
2. View analytics: `analytics.calldata.app`
3. Check AI server health: `ai.calldata.app/metrics`
4. Manage users across all products

---

## Scaling Considerations

### **Traffic Distribution**

```
calldata.app Products:
├── emailai.calldata.app        → Vercel/Cloudflare (CDN + edge)
├── foundations.calldata.app    → Vercel/Cloudflare
└── api.calldata.app            → API Gateway (Kong/Tyk/AWS API Gateway)
    ├── Rate limiting
    ├── Load balancing
    └── Routing to backend services
```

### **Shared AI Infrastructure**

```
ai.calldata.app (Single Ollama Instance)
├── Serves: emailai.calldata.app
├── Serves: foundations.calldata.app
├── Serves: [future products]
└── Load balanced across multiple GPUs (if needed)
```

**Benefits**:
- Cost-effective: One GPU serves all products
- Consistent performance
- Centralized model management
- Easy to scale horizontally

---

## Migration Path

### **Phase 1: EmailAI Only**
```
emailai.calldata.app            # Live
api.calldata.app/v1/emailai/*   # Live
ai.calldata.app                 # Live
```

### **Phase 2: Add Foundations**
```
foundations.calldata.app        # Live
api.calldata.app/v1/foundations/* # Live
ai.calldata.app                 # Shared with EmailAI
```

### **Phase 3: Shared Services**
```
auth.calldata.app               # SSO across products
docs.calldata.app               # Unified docs
status.calldata.app             # All services
admin.calldata.app              # Cross-product admin
```

---

## Security Best Practices

### **CORS Configuration**

```javascript
// api.calldata.app CORS policy
const allowedOrigins = [
  'https://emailai.calldata.app',
  'https://foundations.calldata.app',
  'http://localhost:3000', // Development
];
```

### **API Authentication**

```bash
# Production API calls require authentication
curl -H "Authorization: Bearer $API_KEY" \
  https://api.calldata.app/v1/emailai/threads

# Internal service-to-service calls
curl -H "X-Internal-Key: $INTERNAL_KEY" \
  https://ai.calldata.app/api/generate
```

### **Rate Limiting**

```
api.calldata.app:
├── Free tier: 100 req/min
├── Basic tier: 1000 req/min
├── Pro tier: 10000 req/min
└── Enterprise: Unlimited
```

---

## Monitoring & Observability

### **Status Page** (status.calldata.app)

```
✓ emailai.calldata.app          99.9% uptime
✓ foundations.calldata.app      99.8% uptime
✓ api.calldata.app              99.95% uptime
✓ ai.calldata.app               99.7% uptime
✗ auth.calldata.app             Investigating (2 min ago)
```

### **Metrics Collection**

```
All services send metrics to:
├── analytics.calldata.app (Internal dashboard)
├── Sentry (Error tracking)
├── PostHog (Product analytics)
└── Axiom (Logging)
```

---

## Environment Variables

### **EmailAI Configuration**

```bash
# apps/web/.env
NEXTAUTH_URL=https://emailai.calldata.app
OLLAMA_BASE_URL=https://ai.calldata.app/api
NEXT_PUBLIC_API_URL=https://api.calldata.app/v1/emailai
```

### **Foundations Configuration**

```bash
# foundations/.env
NEXTAUTH_URL=https://foundations.calldata.app
OLLAMA_BASE_URL=https://ai.calldata.app/api
NEXT_PUBLIC_API_URL=https://api.calldata.app/v1/foundations
```

---

## Future Considerations

### **Custom Domains for Enterprise**

```
# White-label support for enterprise customers
customer1-email.company.com     → emailai.calldata.app (backend)
customer2-email.company.com     → emailai.calldata.app (backend)
```

### **Regional Deployments**

```
# Multi-region support
emailai-us.calldata.app         # US region
emailai-eu.calldata.app         # EU region
emailai-asia.calldata.app       # Asia region

# Or via API routing
api.calldata.app/v1/emailai/*   → Routed based on geo-IP
```

---

## Summary

**Recommended Domain Structure:**

| Domain | Purpose | Example |
|--------|---------|---------|
| `calldata.app` | Marketing/landing | Main website |
| `[product].calldata.app` | Product apps | `emailai.calldata.app` |
| `api.calldata.app/v1/[product]/*` | Unified API | `api.calldata.app/v1/emailai/threads` |
| `ai.calldata.app` | Shared AI | Ollama server for all products |
| `auth.calldata.app` | SSO | Authentication across products |
| `docs.calldata.app` | Documentation | Unified docs portal |
| `status.calldata.app` | Status page | Service health monitoring |
| `admin.calldata.app` | Admin | Cross-product management |

**Benefits:**
- ✅ Easy to remember and predictable
- ✅ Scalable to unlimited products
- ✅ Professional and organized
- ✅ Cost-effective (shared infrastructure)
- ✅ SEO-friendly (each product has own domain)
- ✅ Enterprise-ready (SSO, white-label support)

---

**Questions or updates?** See main [README.md](../README.md) or [ARCHITECTURE.md](./ARCHITECTURE.md)
