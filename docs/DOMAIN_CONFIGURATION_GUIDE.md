# Domain Configuration Guide for calldata.app

Step-by-step guide to configure all calldata.app domains for EmailAI and shared infrastructure.

---

## Prerequisites

- Domain `calldata.app` registered with a domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)
- Access to DNS management for calldata.app
- Hosting platforms ready (Vercel, Fly.io, Vast.ai, etc.)

---

## Overview

We'll configure these domains:

| Domain | Purpose | Hosting |
|--------|---------|---------|
| `emailai.calldata.app` | EmailAI web app | Vercel / Cloudflare Pages |
| `api.calldata.app` | Unified API gateway | Fly.io / Railway / Self-hosted |
| `ai.calldata.app` | Shared Ollama server | Vast.ai / Self-hosted |
| `auth.calldata.app` | SSO authentication | Vercel / Self-hosted |
| `docs.calldata.app` | Documentation | Vercel / GitHub Pages |
| `status.calldata.app` | Status page | BetterUptime / Statuspage.io |

---

## Method 1: Cloudflare (Recommended - Easiest)

Cloudflare provides free DNS, SSL, CDN, and easy subdomain management.

### Step 1: Transfer Domain to Cloudflare (Optional but Recommended)

1. **Sign up for Cloudflare**: https://dash.cloudflare.com/sign-up
2. **Add your domain**:
   - Click "Add a site"
   - Enter `calldata.app`
   - Select Free plan
3. **Update nameservers** at your registrar:
   - Cloudflare will show you 2 nameservers (e.g., `carter.ns.cloudflare.com`)
   - Go to your domain registrar (Namecheap, GoDaddy, etc.)
   - Replace existing nameservers with Cloudflare's nameservers
   - Wait 24-48 hours for propagation (usually faster)

### Step 2: Configure DNS Records in Cloudflare

Go to **DNS** tab in Cloudflare dashboard:

#### **A. EmailAI Web App** (`emailai.calldata.app`)

**If hosting on Vercel:**

1. Deploy EmailAI to Vercel:
   ```bash
   cd emailai
   vercel --prod
   ```

2. In Vercel dashboard:
   - Go to your project → Settings → Domains
   - Add domain: `emailai.calldata.app`
   - Vercel will show you DNS records to add

3. In Cloudflare DNS, add:
   ```
   Type: CNAME
   Name: emailai
   Target: cname.vercel-dns.com
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

4. In Vercel, click "Verify" - domain should be active within minutes

**If hosting on Cloudflare Pages:**

1. Deploy to Cloudflare Pages:
   ```bash
   cd emailai
   npx wrangler pages deploy
   ```

2. In Cloudflare Pages:
   - Go to your project → Custom domains
   - Add: `emailai.calldata.app`
   - DNS records are added automatically!

#### **B. Unified API Gateway** (`api.calldata.app`)

**If using Fly.io:**

1. Deploy API gateway:
   ```bash
   # Create fly.toml for API gateway
   fly launch --name calldata-api
   fly deploy
   ```

2. Add certificate:
   ```bash
   fly certs add api.calldata.app
   ```

3. Fly.io will show you DNS records. In Cloudflare, add:
   ```
   Type: CNAME
   Name: api
   Target: calldata-api.fly.dev
   Proxy status: DNS only (gray cloud) - Let Fly.io handle SSL
   TTL: Auto
   ```

**If self-hosting:**

1. In Cloudflare DNS, add:
   ```
   Type: A
   Name: api
   IPv4 address: YOUR_SERVER_IP
   Proxy status: Proxied (orange cloud) - Free SSL!
   TTL: Auto
   ```

#### **C. Shared AI Server** (`ai.calldata.app`)

**If using Vast.ai:**

1. Rent Vast.ai instance and note the IP address

2. Set up Ollama:
   ```bash
   ssh root@ssh5.vast.ai -p PORT
   cd emailai/ollama-server/scripts
   sudo bash setup.sh prod
   ```

3. In Cloudflare DNS, add:
   ```
   Type: A
   Name: ai
   IPv4 address: VAST_AI_IP_ADDRESS
   Proxy status: DNS only (gray cloud) - Direct connection needed
   TTL: Auto
   ```

4. Optional: Set up Cloudflare Tunnel for security (see below)

**If self-hosting:**

1. In Cloudflare DNS, add:
   ```
   Type: A
   Name: ai
   IPv4 address: YOUR_SERVER_IP
   Proxy status: DNS only (gray cloud)
   TTL: Auto
   ```

#### **D. Documentation** (`docs.calldata.app`)

**If using Vercel/Next.js:**

Same as EmailAI web app - deploy and add CNAME:
```
Type: CNAME
Name: docs
Target: cname.vercel-dns.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

**If using GitHub Pages:**

1. In Cloudflare DNS:
   ```
   Type: CNAME
   Name: docs
   Target: YOUR_USERNAME.github.io
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

2. In your GitHub repo, add file `CNAME` with content:
   ```
   docs.calldata.app
   ```

#### **E. Status Page** (`status.calldata.app`)

**Using BetterUptime (Free):**

1. Sign up: https://betteruptime.com
2. Create status page
3. In BetterUptime, set custom domain: `status.calldata.app`
4. Add to Cloudflare DNS:
   ```
   Type: CNAME
   Name: status
   Target: statuspage.betteruptime.com
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

#### **F. SSO Authentication** (`auth.calldata.app`)

If building custom auth service, deploy like API gateway.

If using hosted service (Auth0, Clerk, etc.):
```
Type: CNAME
Name: auth
Target: PROVIDED_BY_SERVICE
Proxy status: Proxied (orange cloud)
TTL: Auto
```

### Step 3: Enable SSL (Automatic with Cloudflare)

1. In Cloudflare dashboard → SSL/TLS
2. Select "Full (strict)" encryption mode
3. SSL certificates are automatically provisioned for all subdomains

---

## Method 2: Manual DNS Configuration (Any Registrar)

If not using Cloudflare, configure at your domain registrar (Namecheap, GoDaddy, etc.)

### Step 1: Configure DNS Records

Log in to your domain registrar's DNS management:

#### **Add these records:**

```
# EmailAI Web App
Type: CNAME
Host: emailai
Value: cname.vercel-dns.com
TTL: 300 (or Auto)

# API Gateway (if using Fly.io)
Type: CNAME
Host: api
Value: calldata-api.fly.dev
TTL: 300

# AI Server (self-hosted or Vast.ai)
Type: A
Host: ai
Value: YOUR_SERVER_IP
TTL: 300

# Docs (if Vercel)
Type: CNAME
Host: docs
Value: cname.vercel-dns.com
TTL: 300

# Status (if BetterUptime)
Type: CNAME
Host: status
Value: statuspage.betteruptime.com
TTL: 300
```

### Step 2: Configure SSL Certificates

Since you don't have Cloudflare's automatic SSL, configure SSL at each hosting provider:

**Vercel**: Automatic SSL for custom domains
**Fly.io**: Run `fly certs add DOMAIN`
**Self-hosted**: Use Let's Encrypt with Certbot

#### **Let's Encrypt SSL (Self-Hosted Servers)**

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate for ai.calldata.app
sudo certbot --nginx -d ai.calldata.app

# Auto-renewal
sudo certbot renew --dry-run
```

---

## Method 3: Cloudflare Tunnel (Most Secure for Self-Hosted)

For self-hosted services (especially AI server), use Cloudflare Tunnel for security without exposing IP.

### Step 1: Install Cloudflared

```bash
# On your server (Ubuntu/Debian)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### Step 2: Authenticate

```bash
cloudflared tunnel login
# Opens browser - authenticate with Cloudflare account
```

### Step 3: Create Tunnel

```bash
# Create tunnel for AI server
cloudflared tunnel create calldata-ai

# Note the tunnel ID shown
```

### Step 4: Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: TUNNEL_ID_FROM_PREVIOUS_STEP
credentials-file: /root/.cloudflared/TUNNEL_ID.json

ingress:
  # AI Server
  - hostname: ai.calldata.app
    service: http://localhost:11434

  # Catch-all rule (required)
  - service: http_status:404
```

### Step 5: Create DNS Record

```bash
# This creates DNS record automatically
cloudflared tunnel route dns calldata-ai ai.calldata.app
```

### Step 6: Run Tunnel

```bash
# Run tunnel (foreground)
cloudflared tunnel run calldata-ai

# Or install as service (recommended)
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### Step 7: Verify

Visit `https://ai.calldata.app` - should connect to your Ollama server securely!

**Benefits:**
- ✅ No open ports on your server
- ✅ Free SSL from Cloudflare
- ✅ DDoS protection
- ✅ Hide server IP address

---

## Platform-Specific Configurations

### **Vercel Configuration**

1. **Deploy EmailAI:**
   ```bash
   cd emailai
   vercel --prod
   ```

2. **Add custom domain in Vercel dashboard:**
   - Project → Settings → Domains
   - Add: `emailai.calldata.app`
   - Follow DNS instructions

3. **Environment variables:**
   ```bash
   # Add in Vercel dashboard or via CLI
   vercel env add NEXTAUTH_URL production
   # Enter: https://emailai.calldata.app

   vercel env add OLLAMA_BASE_URL production
   # Enter: https://ai.calldata.app/api
   ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

### **Fly.io Configuration**

1. **Create `fly.toml`** for API gateway:
   ```toml
   app = "calldata-api"

   [http_service]
     internal_port = 3000
     force_https = true

   [[services]]
     protocol = "tcp"
     internal_port = 3000

     [[services.ports]]
       port = 80
       handlers = ["http"]

     [[services.ports]]
       port = 443
       handlers = ["tls", "http"]
   ```

2. **Deploy:**
   ```bash
   fly launch --name calldata-api
   fly deploy
   ```

3. **Add certificate:**
   ```bash
   fly certs add api.calldata.app
   ```

4. **Set secrets:**
   ```bash
   fly secrets set DATABASE_URL="postgresql://..."
   fly secrets set NEXTAUTH_SECRET="..."
   ```

### **Vast.ai Configuration**

1. **Rent instance** with:
   - GPU: RTX 4090 (24GB) for Llama 3.3 70B
   - Image: Ubuntu 22.04 with CUDA
   - Disk: 100GB+
   - Port: 11434 (Ollama default)

2. **Connect via SSH:**
   ```bash
   ssh root@ssh5.vast.ai -p YOUR_PORT
   ```

3. **Deploy Ollama:**
   ```bash
   git clone https://github.com/your-org/emailai.git
   cd emailai/ollama-server/scripts
   sudo bash setup.sh prod
   ```

4. **Get public IP:**
   ```bash
   curl ifconfig.me
   ```

5. **Add DNS record** (see Cloudflare instructions above)

6. **Test:**
   ```bash
   curl https://ai.calldata.app/api/tags
   ```

---

## Configuration Summary Table

| Domain | DNS Record | Target | SSL Provider |
|--------|------------|--------|--------------|
| `emailai.calldata.app` | CNAME | `cname.vercel-dns.com` | Vercel/Cloudflare |
| `api.calldata.app` | CNAME | `calldata-api.fly.dev` | Fly.io |
| `ai.calldata.app` | A or Tunnel | `YOUR_IP` or Tunnel | Cloudflare/Let's Encrypt |
| `docs.calldata.app` | CNAME | `cname.vercel-dns.com` | Vercel/Cloudflare |
| `status.calldata.app` | CNAME | `statuspage.betteruptime.com` | BetterUptime |
| `auth.calldata.app` | CNAME | TBD | Provider/Cloudflare |

---

## Environment Variable Updates

### **EmailAI (`apps/web/.env`)**

```bash
# Production configuration
NEXTAUTH_URL=https://emailai.calldata.app
OLLAMA_BASE_URL=https://ai.calldata.app/api
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
DEFAULT_LLM_PROVIDER=ollama

# Google OAuth redirect URI (add in Google Cloud Console)
# https://emailai.calldata.app/api/auth/callback/google
```

### **Foundations (`foundations/.env`)**

```bash
NEXTAUTH_URL=https://foundations.calldata.app
OLLAMA_BASE_URL=https://ai.calldata.app/api
NEXT_PUBLIC_API_URL=https://api.calldata.app/v1/foundations
```

---

## Testing & Verification

### **1. Test DNS Propagation**

```bash
# Check if DNS is resolving
dig emailai.calldata.app
dig api.calldata.app
dig ai.calldata.app

# Or use online tool
# https://dnschecker.org
```

### **2. Test SSL Certificates**

```bash
# Check SSL certificate
curl -vI https://emailai.calldata.app
curl -vI https://ai.calldata.app

# Or use browser - look for padlock icon
```

### **3. Test EmailAI Application**

```bash
# Should load EmailAI
curl https://emailai.calldata.app

# Open in browser
open https://emailai.calldata.app
```

### **4. Test AI Server**

```bash
# Test Ollama API
curl https://ai.calldata.app/api/tags

# Should return list of models
```

### **5. Test OAuth Flow**

1. Visit `https://emailai.calldata.app`
2. Click "Sign In with Google"
3. Should redirect to Google
4. After auth, should redirect back to `https://emailai.calldata.app`

---

## Troubleshooting

### **DNS not resolving**

```bash
# Check DNS records
dig emailai.calldata.app

# If no response, wait for propagation (up to 48 hours)
# Or check DNS records are correct in registrar
```

### **SSL certificate errors**

```bash
# Cloudflare: Make sure SSL mode is "Full (strict)"
# Vercel: Domain must be verified in dashboard
# Fly.io: Run `fly certs check api.calldata.app`
# Self-hosted: Check certbot logs
```

### **503/502 errors**

```bash
# Check if service is running
# Vercel: Check deployment logs
# Fly.io: fly status
# Self-hosted: systemctl status nginx
```

### **OAuth redirect URI mismatch**

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit OAuth 2.0 Client
3. Add authorized redirect URI:
   ```
   https://emailai.calldata.app/api/auth/callback/google
   ```
4. Save and retry

### **CORS errors on API**

Update API CORS configuration:

```javascript
// api.calldata.app CORS config
const corsOptions = {
  origin: [
    'https://emailai.calldata.app',
    'https://foundations.calldata.app',
    'http://localhost:3000', // Development
  ],
  credentials: true,
};
```

---

## Security Checklist

- [ ] SSL/TLS enabled on all domains (HTTPS)
- [ ] Cloudflare proxy enabled (orange cloud) for web apps
- [ ] Rate limiting configured on API gateway
- [ ] Firewall rules configured on AI server
- [ ] Environment variables set in hosting platforms (not in code)
- [ ] Google OAuth redirect URIs updated
- [ ] CORS configured correctly
- [ ] API authentication tokens rotated
- [ ] Backup DNS records documented

---

## Maintenance

### **Renewing SSL Certificates**

**Cloudflare/Vercel/Fly.io**: Automatic renewal ✅

**Self-hosted (Let's Encrypt)**:
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renews via cron/systemd
# Check: systemctl status certbot.timer
```

### **Updating DNS Records**

When changing hosting providers:

1. Update DNS record in Cloudflare/registrar
2. Wait for propagation (5-60 minutes)
3. Test new endpoint
4. Monitor for issues

### **Monitoring**

Set up monitoring for all domains:

```bash
# Use UptimeRobot, BetterUptime, or custom monitoring
# Monitor these endpoints:
https://emailai.calldata.app/api/health
https://api.calldata.app/health
https://ai.calldata.app/api/tags
```

---

## Quick Reference Commands

```bash
# Deploy EmailAI to Vercel
vercel --prod

# Deploy API to Fly.io
fly deploy

# Setup Ollama on Vast.ai
ssh root@ssh5.vast.ai -p PORT
cd emailai/ollama-server/scripts && sudo bash setup.sh prod

# Test DNS
dig emailai.calldata.app

# Test SSL
curl -vI https://emailai.calldata.app

# Test Ollama
curl https://ai.calldata.app/api/tags

# Cloudflare Tunnel (run as service)
sudo cloudflared service install
sudo systemctl start cloudflared
```

---

## Next Steps

1. ✅ Configure domains (follow this guide)
2. ✅ Deploy EmailAI to production
3. ✅ Deploy Ollama AI server
4. ✅ Update Google OAuth settings
5. ✅ Test all endpoints
6. ✅ Set up monitoring
7. ✅ Configure backups

---

**Need help?** See:
- [DOMAIN_STRUCTURE.md](./DOMAIN_STRUCTURE.md) - Domain architecture
- [README.md](../README.md) - Main documentation
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment details
