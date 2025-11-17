# Ollama HTTPS Setup via AWS ALB

This document explains the HTTPS configuration for the Ollama API endpoint.

## Architecture

```
User/EmailAI → HTTPS → AWS ALB → EC2 Instances (nginx) → HTTP → Vast.ai Ollama
                (443)              (8001)                        (10570)
```

## Components

### 1. Vast.ai Ollama Instance

- **Instance ID:** 27963320
- **Direct HTTP endpoint:** http://45.14.246.9:10570/api
- **Model:** llama3.3:70b (40GB)
- **Deployment command:**
  ```bash
  vastai create instance <OFFER_ID> \
    --image ollama/ollama:latest \
    --disk 150 \
    --label emailai-ollama-prod \
    --onstart-cmd 'OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve > /tmp/ollama.log 2>&1 &'
  ```

### 2. Nginx Reverse Proxy (on EmailAI EC2 instances)

- **Listens on:** Port 8001
- **Proxies to:** http://45.14.246.9:10570
- **Configuration:** `/etc/nginx/conf.d/ollama-proxy.conf`
- **Features:**
  - 600s timeouts for long-running operations
  - Streaming support (proxy_buffering off)
  - WebSocket support
  - Health check endpoint at `/health`

### 3. AWS Application Load Balancer

- **Listener:** HTTPS (port 443)
- **Host:** ollama.calldata.app
- **Target Group:** emailai-prod-ollama-tg
- **Target Port:** 8001 (nginx reverse proxy)
- **Health Check:** `/api/tags` (200 or 502 acceptable)

## DNS Configuration

Add this CNAME record to your DNS:

```
ollama.calldata.app → CNAME → <ALB-DNS-NAME>
```

The ALB DNS name will be output by terraform after deployment.

## SSL Certificate

**Option 1: Wildcard Certificate (Recommended)**
Request a certificate for `*.calldata.app` to cover all subdomains:

```bash
aws acm request-certificate \
  --domain-name "*.calldata.app" \
  --validation-method DNS \
  --region us-east-1
```

**Option 2: Specific Subdomain**
Add `ollama.calldata.app` as a Subject Alternative Name to the existing emailai certificate.

## GitHub Secret Configuration

Update the `VASTAI_OLLAMA_URL` secret to use the HTTPS endpoint:

**Secret Name:** `VASTAI_OLLAMA_URL`
**Secret Value:** `https://ollama.calldata.app/api`

This URL will be used by the EmailAI application to communicate with Ollama via HTTPS.

## Testing

### 1. Test Direct Vast.ai Endpoint (HTTP)

```bash
curl http://45.14.246.9:10570/api/tags
```

### 2. Test ALB HTTPS Endpoint

```bash
curl https://ollama.calldata.app/api/tags
```

Both should return: `{"models":[...]}`

### 3. Test Model Generation

```bash
curl https://ollama.calldata.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.3:70b",
    "prompt": "Why is the sky blue?",
    "stream": false
  }'
```

## Deployment Steps

1. **Request ACM Certificate** (if not using wildcard)

   ```bash
   aws acm request-certificate \
     --domain-name ollama.calldata.app \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Add DNS validation record** provided by ACM

3. **Wait for certificate validation** (5-30 minutes)

4. **Deploy infrastructure with terraform**

   - The terraform config includes:
     - `terraform/environments/prod/ollama-proxy.tf` - ALB listener rule and target group
     - `terraform/modules/emailai/main.tf` - nginx configuration in user_data
     - `terraform/modules/vpc/main.tf` - security group rule for port 8001

5. **Add DNS CNAME for ollama.calldata.app** pointing to ALB

6. **Update GitHub Secret**

   - Set `VASTAI_OLLAMA_URL` to `https://ollama.calldata.app/api`

7. **Deploy EmailAI** via GitHub Actions

## Security

- ✅ HTTPS encryption between users and ALB (TLS 1.2+)
- ✅ HTTP between ALB and EC2 instances (within AWS VPC)
- ⚠️ HTTP between EC2 and Vast.ai (external, unencrypted)
  - Acceptable for this use case as it's server-to-server
  - Could add Cloudflare Tunnel later if needed for E2E encryption

## Monitoring

- ALB access logs
- Target group health checks
- CloudWatch metrics for nginx proxy
- Ollama logs on Vast.ai: `/tmp/ollama.log`

## Costs

- **Vast.ai GPU:** ~$0.23/hour for RTX 4090
- **AWS ALB:** ~$0.0225/hour + $0.008/LCU-hour
- **EC2 instances:** Already running for EmailAI (no additional cost)
- **Total additional cost:** ~$0.25/hour = ~$180/month

## Troubleshooting

### Ollama not responding

```bash
# Check Vast.ai instance status
vastai show instance 27963147

# Check Ollama logs
ssh -p <PORT> root@<HOST>
tail -f /tmp/ollama.log
```

### Nginx proxy issues

```bash
# SSH to EC2 instance via SSM
aws ssm start-session --target <INSTANCE_ID>

# Check nginx status
sudo systemctl status nginx

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Test proxy locally
curl http://localhost:8001/api/tags
```

### ALB health check failing

- Check target group health in AWS Console
- Verify security group allows port 8001 from ALB
- Check nginx is listening on port 8001: `sudo netstat -tlnp | grep 8001`
