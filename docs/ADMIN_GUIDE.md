# EmailAI Organizations - Administrator Guide

## Introduction

This guide is for organization administrators (Owners and Admins) who manage EmailAI organizations. It covers advanced features, best practices, and operational procedures.

## Table of Contents

1. [Organization Setup](#organization-setup)
2. [Member Management](#member-management)
3. [Billing Administration](#billing-administration)
4. [Email Account Management](#email-account-management)
5. [Security & Compliance](#security--compliance)
6. [Monitoring & Analytics](#monitoring--analytics)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Organization Setup

### Initial Organization Configuration

**1. Basic Information**
```
Name: Your Company Name
Slug: your-company (used in URLs)
Domain: yourcompany.com
Logo: https://yourcompany.com/logo.png
```

**2. Recommended Settings**
- Set organization name to your company's official name
- Use a short, memorable slug
- Add your email domain for future auto-invites
- Upload a clear logo (200x200px minimum)

### Organization Structure Planning

**Small Teams (1-10 members)**
- Single organization for entire company
- Most members have Member role
- 1-2 Admins plus Owner

**Medium Teams (11-50 members)**
- Department-based email accounts
- More granular role assignments
- Multiple Admins per department

**Large Teams (50+ members)**
- Consider multiple organizations per department
- Dedicated billing administrator
- Structured onboarding process

## Member Management

### Invitation Workflow

**Best Practice Workflow:**

1. **Prepare**
   - Verify seat availability
   - Determine appropriate role
   - Check if user already has account

2. **Invite**
   - Use work email address
   - Start with Member role (can upgrade later)
   - Include welcome message (future feature)

3. **Onboard**
   - Schedule orientation call
   - Share team conventions and guidelines
   - Assign first email account

4. **Monitor**
   - Check user activity after 1 week
   - Gather feedback on organization setup
   - Adjust permissions as needed

### Role Assignment Strategy

**Owner Role:**
- Assign to: CEO, CTO, or primary decision maker
- Limit: 1-2 people maximum
- Responsibility: Billing, critical decisions

**Admin Role:**
- Assign to: Department heads, team leads
- Limit: 10-20% of organization
- Responsibility: Day-to-day management, member support

**Member Role:**
- Assign to: Regular team members
- Limit: 70-80% of organization
- Responsibility: Email management, collaboration

**Viewer Role:**
- Assign to: Auditors, trainees, contractors (limited scope)
- Limit: As needed
- Responsibility: Read-only access

### Offboarding Members

**Checklist when removing a member:**

1. **Before Removal:**
   - [ ] Identify email accounts they own
   - [ ] Transfer ownership to another team member
   - [ ] Document any unique rules they created
   - [ ] Export any personal knowledge they contributed

2. **During Removal:**
   - [ ] Click Remove on member list
   - [ ] Confirm removal
   - [ ] Seat is freed immediately

3. **After Removal:**
   - [ ] Verify they can no longer access organization
   - [ ] Check for any orphaned resources
   - [ ] Update team documentation

### Bulk Member Operations

**Adding Multiple Members:**
```bash
# Use the API for bulk invitations (future feature)
# For now, invite one at a time through UI
```

**Role Changes:**
- Select multiple members (future feature)
- Bulk assign new roles
- Audit log captures all changes

## Billing Administration

### Understanding Seat-Based Billing

**Seat Calculation:**
```
usedSeats = count(organization members)
availableSeats = maxSeats - usedSeats
```

**Automatic Billing:**
- Seats updated in real-time when members added/removed
- Stripe/LemonSqueezy automatically adjusts billing
- Proration applied for mid-cycle changes

### Billing Dashboard

**Access:** Organization Settings → Billing

**Information Displayed:**
- Current plan tier (Free, Business, Enterprise)
- Seat usage (e.g., "5 / 10 seats")
- Next renewal date
- Payment method
- Billing history (via payment portal)

### Managing Subscriptions

**Upgrading Plan:**
1. Click **Manage Subscription**
2. Opens Stripe/LemonSqueezy portal
3. Select new plan tier
4. Adjust seat count if needed
5. Confirm changes

**Downgrading Plan:**
1. Same process as upgrading
2. Changes take effect at next renewal
3. Ensure seat count is within new limit

**Adding Seats:**
- Automatic when inviting members
- Manual: Manage Subscription → Adjust quantity
- Instant provisioning

**Removing Seats:**
- Automatic when removing members
- Credit applied to next invoice
- Cannot go below current usage

### Cost Optimization

**Strategies:**
1. **Regular Audits**
   - Review member list monthly
   - Remove inactive members
   - Verify all seats are needed

2. **Right-Sizing**
   - Don't over-provision seats
   - Use Viewer role for read-only users (same cost but clear intent)
   - Consider annual billing for discount

3. **Department Allocation**
   - Track which departments use which seats
   - Charge back to department budgets
   - Use email account names to identify departments

## Email Account Management

### Email Account Governance

**Naming Conventions:**
```
support@company.com - Customer Support team
sales@company.com - Sales team
billing@company.com - Finance team
info@company.com - General inquiries
```

**Ownership Model:**
```
support@ - Owned by: Support Manager
sales@ - Owned by: Sales Director
billing@ - Owned by: Finance Lead
```

### Setting Up Team Inboxes

**Step-by-Step:**

1. **Identify Need**
   - Department needs shared access
   - Multiple people handling same inbox
   - Requires consistent automation

2. **Choose Owner**
   - Select department head or senior team member
   - They connect the email account
   - Automatically shared with organization

3. **Configure Automation**
   - Create shared rules for common scenarios
   - Set up categories for organization
   - Add knowledge base entries

4. **Train Team**
   - Show members how to access account
   - Explain automation rules
   - Define response time expectations

### Email Account Transfers

**Common Scenarios:**

**Employee Departure:**
```
Problem: Sales manager (account owner) is leaving
Solution:
1. Identify all email accounts they own
2. Transfer to replacement manager
3. Verify automation rules still work
4. Remove departing employee from organization
```

**Department Reorganization:**
```
Problem: Support team split into L1 and L2
Solution:
1. Create new email account for L2 support
2. Transfer original account to L1 lead
3. Update automation rules for routing
4. Train both teams on new structure
```

**Transfer Process:**
1. Go to email account settings
2. Click Transfer Ownership
3. Select new owner (must be in org)
4. Confirm transfer
5. Notify both old and new owner
6. Update documentation

### Email Account Security

**Best Practices:**
- **Shared Accounts**: Use team email addresses only (no personal accounts)
- **Access Control**: Limit who can transfer ownership (Owner/Admin only)
- **Audit**: Review account access quarterly
- **Monitoring**: Watch for unusual send patterns

**Security Checklist:**
- [ ] All team email accounts shared with organization
- [ ] Personal email accounts kept private
- [ ] Ownership clearly assigned
- [ ] No orphaned accounts (deleted user was owner)
- [ ] Automation rules reviewed for security

## Security & Compliance

### Access Control

**Organization-Level:**
- Organization isolation (no cross-org access)
- Role-Based Access Control (RBAC)
- Session management with JWT tokens
- OAuth token security (encrypted at rest)

**Verification:**
```bash
# Test that users cannot access other organizations
curl -H "Cookie: $USER_SESSION" \
  /api/organization/other_org_id/members
# Should return 403 Forbidden
```

### Audit Logging

**Events Logged:**
- Member added/removed
- Role changes
- Email account transfers
- Organization settings changes
- Billing events

**Accessing Logs:**
```bash
# View organization audit log (future feature)
GET /api/organization/{id}/audit-log

# Filter by event type
GET /api/organization/{id}/audit-log?event=MEMBER_ADDED

# Filter by date range
GET /api/organization/{id}/audit-log?from=2024-01-01&to=2024-01-31
```

### Data Privacy

**GDPR Compliance:**
- Members can request data export
- Members can request deletion
- Organization data separate from personal data
- Clear data ownership (organization vs. personal)

**Data Export:**
```bash
# Export all organization data
GET /api/organization/{id}/export

# Returns:
# - Email accounts
# - Rules and automation
# - Knowledge base
# - Member list
# - Audit logs
```

### Security Best Practices

**For Administrators:**
1. **Use Strong Passwords**
   - Enforce on Google accounts (OAuth provider)
   - Enable 2FA on Google accounts
   - Regular password rotation

2. **Limit Admin Access**
   - Only promote trusted team members
   - Review admin list quarterly
   - Demote when no longer needed

3. **Monitor Activity**
   - Review audit logs weekly
   - Watch for unusual access patterns
   - Investigate failed access attempts

4. **Secure Billing**
   - Limit billing access to Owner + 1 Admin
   - Use corporate credit card
   - Review invoices monthly

## Monitoring & Analytics

### Organization Metrics

**Key Metrics to Track:**

**Member Metrics:**
- Total members
- Members by role
- Active members (logged in last 7 days)
- Inactive members (no activity in 30 days)

**Email Account Metrics:**
- Total email accounts
- Emails processed per account
- Automation rule effectiveness
- Response time per account

**Billing Metrics:**
- Seat utilization (used / max)
- Cost per member
- Growth rate

### Performance Monitoring

**Response Time Targets:**
```
Organization page load: < 2s
Member list: < 1s
Email account list: < 1.5s
Billing page: < 2s
```

**Monitoring Tools:**
- Browser DevTools (Network tab)
- Application logs
- Database query performance
- Third-party monitoring (Sentry, Datadog)

### Usage Analytics

**Understanding Team Usage:**

**Email Volume:**
- Which accounts get most emails?
- Peak usage times
- Automation success rate

**Collaboration:**
- Which rules are shared most?
- Knowledge base contribution rate
- Category usage

**Cost Attribution:**
- Seat cost per department
- Email volume per seat
- ROI on premium features

## Troubleshooting

### Common Issues

**Issue: "Seat limit reached"**
```
Symptom: Cannot invite new member
Cause: All available seats are used
Solution:
1. Check Billing → Seat Usage
2. Options:
   a) Remove inactive members
   b) Upgrade to more seats
   c) Use Viewer role for read-only access
```

**Issue: "Member can't access email account"**
```
Symptom: Team member reports no access to shared email
Diagnosis:
1. Verify member is in organization
2. Check email account organizationId
3. Verify email account is shared (not personal)
4. Check member's session (have them log out/in)

Solution:
- If unshared: Share email account with organization
- If wrong org: Transfer to correct organization
- If session issue: Have member clear cookies and re-login
```

**Issue: "Cannot transfer email account"**
```
Symptom: Transfer fails with error
Possible Causes:
1. Target user not in same organization
2. Current user not owner or admin
3. Email account not shared with organization

Solution:
1. Verify target user in same org
2. Check your role (need Owner or Admin)
3. Share account with org first, then transfer
```

**Issue: "Billing portal won't open"**
```
Symptom: Clicking "Manage Subscription" does nothing
Causes:
1. Pop-up blocker enabled
2. No active subscription
3. Network error

Solution:
1. Allow pop-ups from emailai.com
2. Verify subscription exists
3. Check browser console for errors
4. Contact support with error message
```

### Emergency Procedures

**Member Locked Out:**
1. Verify their organization membership
2. Check if their account is active
3. Have them try "Forgot Password" flow
4. As last resort, remove and re-invite

**Billing Issue:**
1. Check payment method in billing portal
2. Verify card not expired
3. Contact payment provider support
4. Reach out to EmailAI support if needed

**Data Loss Concern:**
1. Check audit logs for deletion events
2. Verify with team if intentional
3. Contact support for recovery options
4. Review backup procedures

## Best Practices

### Organization Hygiene

**Monthly:**
- [ ] Review member list
- [ ] Remove inactive members
- [ ] Verify email account ownership
- [ ] Check seat utilization

**Quarterly:**
- [ ] Audit admin/owner roles
- [ ] Review shared resources
- [ ] Check automation rule effectiveness
- [ ] Verify billing accuracy

**Annually:**
- [ ] Security audit
- [ ] Cost optimization review
- [ ] Process documentation update
- [ ] Team training refresh

### Team Guidelines

**Create Written Guidelines:**
```markdown
# Email Management Guidelines

## Email Accounts
- Only use shared accounts for team emails
- Personal accounts must remain private
- Name accounts clearly (e.g., support@)

## Automation Rules
- Test rules before sharing with team
- Use clear, descriptive names
- Document complex rules

## Knowledge Base
- Add entries for common questions
- Keep entries up to date
- Use consistent formatting

## Response Times
- support@: 4 hours
- sales@: 8 hours
- info@: 24 hours
```

### Scaling Considerations

**Growing from 5 to 50 members:**

**Challenges:**
- More complex permissions
- Higher costs
- Need for sub-teams
- Reporting requirements

**Solutions:**
- Document processes early
- Assign department admins
- Use email account naming conventions
- Implement regular reviews

**Growing from 50 to 500 members:**

**Challenges:**
- Multiple organizations needed
- Department isolation
- Advanced reporting
- Compliance requirements

**Solutions:**
- Create separate organizations per department
- Implement cross-org reporting (custom)
- Consider enterprise support
- Establish governance committee

## Advanced Features

### API Access (for Administrators)

**Generate API Key:**
```bash
# In Settings → API Keys
POST /api/user/api-keys
{
  "name": "Organization Management Script"
}

# Returns: { "apiKey": "sk_..." }
```

**Example Usage:**
```bash
# List organization members
curl -H "Authorization: Bearer sk_..." \
  https://api.emailai.com/v1/organization/{id}/members

# Bulk invite (future)
curl -X POST \
  -H "Authorization: Bearer sk_..." \
  -d '{"emails": ["user1@co.com", "user2@co.com"], "role": "MEMBER"}' \
  https://api.emailai.com/v1/organization/{id}/members/bulk-invite
```

### Webhooks (Future Feature)

**Set up organization webhooks:**
```bash
POST /api/organization/{id}/webhooks
{
  "url": "https://yourapp.com/webhooks/emailai",
  "events": ["member.added", "member.removed", "email_account.transferred"]
}
```

**Webhook payload:**
```json
{
  "event": "member.added",
  "organizationId": "org_123",
  "data": {
    "memberId": "mem_456",
    "userId": "user_789",
    "role": "MEMBER",
    "addedBy": "user_111"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Support & Resources

**For Administrators:**
- Admin Slack Channel: #emailai-admins
- Email Support: admins@emailai.com
- Office Hours: Wednesdays 2-3pm PT
- Enterprise Support: enterprise@emailai.com

**Documentation:**
- User Guide: [USER_GUIDE_ORGANIZATIONS.md](USER_GUIDE_ORGANIZATIONS.md)
- API Docs: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- Deployment: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- Security: [SECURITY_AUDIT.md](../SECURITY_AUDIT.md)

**Community:**
- Forum: https://community.emailai.com
- GitHub: https://github.com/emailai/emailai
- Twitter: @emailai
