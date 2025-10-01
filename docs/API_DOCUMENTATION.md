# EmailAI API Documentation - Organizations

## Overview

The EmailAI API provides programmatic access to organization management, email accounts, and automation features. This document covers organization-specific endpoints.

**Base URL**: `https://api.emailai.com/v1`

**Authentication**: Bearer token (API key)

## Authentication

### Generating an API Key

1. Log in to EmailAI
2. Navigate to Settings → API Keys
3. Click "Generate New Key"
4. Copy and store securely (shown only once)

### Using API Keys

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.emailai.com/v1/organization/org_123/members
```

**Security Best Practices:**
- Never commit API keys to version control
- Rotate keys every 90 days
- Use separate keys for different environments
- Revoke keys immediately if compromised

## Organization Endpoints

### Get Organization

```http
GET /api/organization/{organizationId}
```

**Description**: Retrieve organization details

**Parameters:**
- `organizationId` (path) - Organization ID

**Response:**
```json
{
  "id": "org_123",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "domain": "acme.com",
  "logoUrl": "https://acme.com/logo.png",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T00:00:00Z"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer sk_..." \
  https://api.emailai.com/v1/organization/org_123
```

### Update Organization

```http
PATCH /api/organization/{organizationId}
```

**Description**: Update organization details

**Permissions**: OWNER or ADMIN

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "domain": "acme.com",
  "logoUrl": "https://acme.com/new-logo.png"
}
```

**Response:**
```json
{
  "id": "org_123",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "domain": "acme.com",
  "logoUrl": "https://acme.com/new-logo.png",
  "updatedAt": "2024-01-20T00:00:00Z"
}
```

## Member Management

### List Members

```http
GET /api/organization/{organizationId}/members
```

**Description**: Get all organization members

**Permissions**: All members can view

**Response:**
```json
{
  "members": [
    {
      "id": "mem_123",
      "userId": "user_456",
      "organizationId": "org_123",
      "role": "OWNER",
      "user": {
        "id": "user_456",
        "name": "John Doe",
        "email": "john@acme.com",
        "image": "https://..."
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Add Member

```http
POST /api/organization/{organizationId}/members
```

**Description**: Invite a new member to the organization

**Permissions**: OWNER or ADMIN

**Request Body:**
```json
{
  "userId": "user_789",
  "role": "MEMBER"
}
```

**Response:**
```json
{
  "id": "mem_124",
  "userId": "user_789",
  "organizationId": "org_123",
  "role": "MEMBER",
  "user": {
    "id": "user_789",
    "name": "Jane Smith",
    "email": "jane@acme.com",
    "image": "https://..."
  },
  "createdAt": "2024-01-20T00:00:00Z"
}
```

**Errors:**
- `400` - Seat limit reached
- `403` - Insufficient permissions
- `404` - User not found

### Remove Member

```http
DELETE /api/organization/{organizationId}/members/{memberId}
```

**Description**: Remove a member from the organization

**Permissions**: OWNER or ADMIN

**Response:**
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

### Update Member Role

```http
PATCH /api/organization/{organizationId}/members/{memberId}
```

**Description**: Change a member's role

**Permissions**: OWNER or ADMIN

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

**Response:**
```json
{
  "id": "mem_124",
  "userId": "user_789",
  "organizationId": "org_123",
  "role": "ADMIN",
  "updatedAt": "2024-01-20T00:00:00Z"
}
```

## Email Account Management

### List Organization Email Accounts

```http
GET /api/organization/{organizationId}/email-accounts
```

**Description**: Get all email accounts in the organization

**Permissions**: All members can view

**Response:**
```json
{
  "emailAccounts": [
    {
      "id": "acc_123",
      "email": "support@acme.com",
      "name": "Acme Support",
      "userId": "user_456",
      "organizationId": "org_123",
      "user": {
        "id": "user_456",
        "name": "John Doe",
        "email": "john@acme.com"
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Transfer Email Account Ownership

```http
POST /api/user/email-account/{emailAccountId}/transfer
```

**Description**: Transfer ownership to another organization member

**Permissions**: Account owner or ADMIN

**Request Body:**
```json
{
  "targetUserId": "user_789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ownership transferred successfully"
}
```

**Errors:**
- `400` - Target user not in same organization
- `403` - Insufficient permissions

### Share Email Account with Organization

```http
POST /api/user/email-account/{emailAccountId}/share
```

**Description**: Share a personal email account with organization

**Permissions**: Account owner only

**Request Body:**
```json
{
  "organizationId": "org_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email account shared with organization"
}
```

### Unshare Email Account

```http
DELETE /api/user/email-account/{emailAccountId}/share
```

**Description**: Make shared email account personal

**Permissions**: Account owner only

**Response:**
```json
{
  "success": true,
  "message": "Email account is now personal"
}
```

## Billing

### Get Organization Billing

```http
GET /api/organization/{organizationId}/billing
```

**Description**: Retrieve billing information

**Permissions**: OWNER or ADMIN

**Response:**
```json
{
  "organizationId": "org_123",
  "organizationName": "Acme Corp",
  "hasPremium": true,
  "tier": "BUSINESS_ANNUALLY",
  "seats": {
    "used": 5,
    "max": 10,
    "available": 5
  },
  "members": 5,
  "emailAccounts": 3,
  "subscription": {
    "status": "active",
    "renewsAt": "2025-01-01T00:00:00Z",
    "willCancel": false,
    "provider": "stripe"
  }
}
```

## Webhooks (Future Feature)

### Create Webhook

```http
POST /api/organization/{organizationId}/webhooks
```

**Description**: Register a webhook endpoint

**Permissions**: OWNER or ADMIN

**Request Body:**
```json
{
  "url": "https://yourapp.com/webhooks/emailai",
  "events": [
    "member.added",
    "member.removed",
    "member.role_changed",
    "email_account.transferred"
  ],
  "secret": "your_webhook_secret"
}
```

**Response:**
```json
{
  "id": "webhook_123",
  "url": "https://yourapp.com/webhooks/emailai",
  "events": ["member.added", "member.removed"],
  "createdAt": "2024-01-20T00:00:00Z"
}
```

### Webhook Payload

```json
{
  "id": "evt_123",
  "event": "member.added",
  "organizationId": "org_123",
  "data": {
    "memberId": "mem_124",
    "userId": "user_789",
    "role": "MEMBER",
    "addedBy": "user_456"
  },
  "timestamp": "2024-01-20T12:00:00Z"
}
```

**Verifying Webhooks:**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return signature === digest;
}
```

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

### Common Errors

**Invalid API Key:**
```json
{
  "error": "Invalid API key",
  "code": "INVALID_API_KEY"
}
```

**Insufficient Permissions:**
```json
{
  "error": "You don't have permission to perform this action",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

**Seat Limit Reached:**
```json
{
  "error": "Seat limit reached (5/5). Please upgrade your plan.",
  "code": "SEAT_LIMIT_REACHED",
  "details": {
    "used": 5,
    "max": 5
  }
}
```

## Rate Limiting

**Limits:**
- 100 requests per minute per API key
- 1000 requests per hour per API key

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

**Rate Limit Exceeded:**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Pagination

**Endpoints with pagination:**
- `/api/organization/{id}/members`
- `/api/organization/{id}/email-accounts`

**Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

**Example:**
```bash
curl -H "Authorization: Bearer sk_..." \
  "https://api.emailai.com/v1/organization/org_123/members?page=2&limit=25"
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 25,
    "total": 100,
    "pages": 4
  }
}
```

## Code Examples

### Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.emailai.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.EMAILAI_API_KEY}`
  }
});

// List organization members
async function listMembers(organizationId) {
  const response = await client.get(`/organization/${organizationId}/members`);
  return response.data.members;
}

// Add member
async function addMember(organizationId, userId, role) {
  const response = await client.post(
    `/organization/${organizationId}/members`,
    { userId, role }
  );
  return response.data;
}

// Get billing info
async function getBilling(organizationId) {
  const response = await client.get(`/organization/${organizationId}/billing`);
  return response.data;
}
```

### Python

```python
import requests
import os

class EmailAIClient:
    def __init__(self, api_key):
        self.base_url = 'https://api.emailai.com/v1'
        self.headers = {'Authorization': f'Bearer {api_key}'}

    def list_members(self, organization_id):
        url = f'{self.base_url}/organization/{organization_id}/members'
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()['members']

    def add_member(self, organization_id, user_id, role):
        url = f'{self.base_url}/organization/{organization_id}/members'
        data = {'userId': user_id, 'role': role}
        response = requests.post(url, json=data, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def get_billing(self, organization_id):
        url = f'{self.base_url}/organization/{organization_id}/billing'
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

# Usage
client = EmailAIClient(os.environ['EMAILAI_API_KEY'])
members = client.list_members('org_123')
```

### cURL

```bash
# Set API key
API_KEY="your_api_key_here"
ORG_ID="org_123"

# List members
curl -H "Authorization: Bearer $API_KEY" \
  https://api.emailai.com/v1/organization/$ORG_ID/members

# Add member
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_789","role":"MEMBER"}' \
  https://api.emailai.com/v1/organization/$ORG_ID/members

# Get billing
curl -H "Authorization: Bearer $API_KEY" \
  https://api.emailai.com/v1/organization/$ORG_ID/billing
```

## Best Practices

### Error Handling

```javascript
async function safeApiCall(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.response) {
      // API returned an error
      console.error('API Error:', error.response.data);
      if (error.response.status === 429) {
        // Rate limited, retry after delay
        await new Promise(resolve => setTimeout(resolve, 60000));
        return await fn();
      }
    } else {
      // Network error
      console.error('Network Error:', error.message);
    }
    throw error;
  }
}
```

### Retry Logic

```javascript
async function retryableRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.response?.status >= 500) {
        // Server error, retry with exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      } else {
        throw error; // Don't retry client errors
      }
    }
  }
}
```

### Caching

```javascript
const cache = new Map();

async function getCachedMembers(organizationId) {
  const cacheKey = `members:${organizationId}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 300000) {
    // Cache valid for 5 minutes
    return cached.data;
  }

  const members = await listMembers(organizationId);
  cache.set(cacheKey, {
    data: members,
    timestamp: Date.now()
  });

  return members;
}
```

## API Changelog

### v1.0.0 (2024-01-01)
- Initial release
- Organization CRUD endpoints
- Member management endpoints
- Email account management endpoints
- Billing endpoints

### Future Versions

**v1.1.0 (Planned)**
- Webhooks support
- Bulk operations
- Advanced filtering and search
- Audit log API

**v2.0.0 (Planned)**
- GraphQL API
- Real-time subscriptions
- Advanced analytics endpoints

## Support

**API Support:**
- Email: api-support@emailai.com
- Documentation: https://docs.emailai.com/api
- Status Page: https://status.emailai.com

**Report Issues:**
- GitHub: https://github.com/emailai/emailai/issues
- Support Portal: https://support.emailai.com
