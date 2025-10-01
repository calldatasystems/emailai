# EmailAI Organizations - User Guide

## Introduction

Organizations in EmailAI allow teams to collaborate on email management. Share email accounts, rules, knowledge, and categories with your team members.

## Getting Started

### Your First Organization

When you sign up for EmailAI, a personal organization is automatically created for you. This is your default workspace.

**Your organization includes:**
- Your email accounts
- Your automation rules
- Your email groups and categories
- Your knowledge base entries

### Understanding Organizations

Think of an organization as a shared workspace where your team can:
- Access shared email accounts together
- Collaborate on email automation
- Share knowledge and best practices
- Manage team email efficiently

## Organization Roles

EmailAI has four user roles with different permissions:

### Owner
- Full control over the organization
- Can manage all settings
- Can add/remove members
- Can delete the organization
- Can manage billing and subscriptions

### Admin
- Can manage organization settings
- Can add/remove members
- Can manage email accounts
- Can view billing information
- **Cannot** delete the organization

### Member
- Can access shared email accounts
- Can create and edit own rules
- Can view shared resources
- Can contribute to knowledge base
- **Cannot** manage organization or members

### Viewer
- Read-only access to emails
- Can view shared resources
- **Cannot** make changes or send emails
- Perfect for auditors or trainees

## Managing Your Organization

### Accessing Organization Settings

1. Click your profile in the top right
2. Select **Organization Settings**
3. You'll see three tabs: **General**, **Members**, **Billing**

### General Settings

**Organization Name**
- Your team's display name
- Visible to all members
- Example: "Acme Corp Support Team"

**Domain**
- Your company's email domain
- Example: "acme.com"
- Used for automatic member invitations (future feature)

**Logo URL**
- URL to your organization's logo
- Displayed in the organization switcher
- Optional but recommended

### Managing Members

**Inviting Team Members**

1. Go to **Organization Settings** → **Members**
2. Click **Invite Member**
3. Enter their email address
4. Select their role (Admin, Member, or Viewer)
5. Click **Send Invitation**

The invited user will receive an email with instructions to join your organization.

**Changing Member Roles**

1. Go to **Members** tab
2. Find the member in the list
3. Click the role dropdown next to their name
4. Select the new role
5. Confirm the change

**Removing Members**

1. Go to **Members** tab
2. Find the member to remove
3. Click the **Remove** button
4. Confirm the removal

⚠️ **Note**: Removing a member removes their access to all organization resources immediately.

## Email Accounts

### Shared Email Accounts

When you connect an email account to EmailAI, it's automatically shared with your organization. All organization members can access it.

**Benefits:**
- Team inbox collaboration
- Multiple people can respond to emails
- Shared automation rules
- Unified email management

### Email Account Ownership

Each email account has an owner:
- The person who originally connected it
- Has full control over the account
- Can transfer ownership to another team member
- Can share/unshare the account

### Accessing Shared Email Accounts

1. Click the email account dropdown in the top navigation
2. You'll see all email accounts you have access to:
   - **Owned by you**: Accounts you connected
   - **Shared with you**: Team email accounts

3. Select any account to switch to it
4. You can now:
   - View emails
   - Send responses
   - Apply automation rules
   - Create filters and groups

### Transferring Email Account Ownership

**As the current owner:**

1. Go to email account settings
2. Click **Transfer Ownership**
3. Select the new owner from your team
4. Confirm the transfer

**Important:**
- New owner must be in the same organization
- You'll still have access as a team member
- Transfer cannot be undone (new owner must transfer back)

### Personal vs. Shared Email Accounts

**Personal Email Accounts:**
- Only you can access
- Not shared with the organization
- Perfect for private email management

**To make an email account personal:**
1. Go to email account settings
2. Click **Unshare from Organization**
3. Confirm

**To share a personal account:**
1. Go to email account settings
2. Click **Share with Organization**
3. Select your organization
4. Confirm

## Collaboration Features

### Shared Automation Rules

Create rules once, use across your team:

**Creating a Shared Rule:**
1. Go to **Automation** → **Rules**
2. Click **Create Rule**
3. Set up your automation
4. Toggle **Share with organization** (Admin/Owner only)
5. Save the rule

**Using Shared Rules:**
- All team members can see shared rules
- Rules apply to emails for everyone
- Only the creator or admins can edit shared rules

### Shared Knowledge Base

Build a team knowledge base for consistent responses:

**Adding Knowledge:**
1. Go to **Automation** → **Knowledge Base**
2. Click **Add Entry**
3. Enter a title and content
4. Save

**Using Team Knowledge:**
- AI uses team knowledge for drafting replies
- Ensures consistent messaging
- Everyone can contribute (if Member role or higher)

### Shared Categories

Organize emails with team-wide categories:

**Creating Categories:**
1. Go to **Smart Categories**
2. Click **Create Category**
3. Define the category
4. Save

**Benefits:**
- Consistent email organization across team
- Shared filtering and views
- Unified reporting

## Billing & Subscriptions

### Understanding Seat-Based Pricing

Organizations use seat-based billing:
- **1 seat = 1 team member**
- First seat included in base subscription
- Additional seats charged per month/year

**Example:**
- Base subscription: $15/month
- Additional seats: $10/month each
- 5-person team: $15 + (4 × $10) = $55/month

### Viewing Your Billing

**As Owner or Admin:**
1. Go to **Organization Settings** → **Billing**
2. You'll see:
   - Current plan and tier
   - Seat usage (e.g., "5 / 10 seats used")
   - Subscription renewal date
   - Payment method

**As Member or Viewer:**
- Billing tab is not visible
- Contact your organization owner for billing questions

### Managing Seats

**Adding Team Members:**
- When you invite a new member, a seat is consumed
- If you've reached your seat limit, you'll need to upgrade
- Click **Upgrade Plan** to add more seats

**Removing Team Members:**
- Removing a member frees up a seat
- You'll receive a credit for the unused time
- Seat is immediately available for a new member

### Upgrading Your Plan

1. Go to **Billing** tab
2. Click **Manage Subscription**
3. Opens your Stripe/LemonSqueezy billing portal
4. Adjust your seat count or plan tier
5. Changes take effect immediately

## Switching Organizations

If you're a member of multiple organizations:

1. Click the organization name in the top navigation
2. Select the organization you want to switch to
3. The entire app switches to that organization's context:
   - Email accounts
   - Rules and automation
   - Knowledge base
   - Settings

## Best Practices

### Email Account Management

✅ **Do:**
- Share team inboxes (support@, sales@) with the organization
- Keep personal email accounts private
- Transfer ownership when team members leave
- Document email account purposes in settings

❌ **Don't:**
- Share personal accounts unless necessary
- Leave orphaned email accounts without owners
- Give everyone admin access unnecessarily

### Automation Rules

✅ **Do:**
- Share commonly used rules with the team
- Name rules clearly (e.g., "Auto-archive newsletters")
- Test rules before sharing
- Document complex rules in descriptions

❌ **Don't:**
- Create duplicate rules (check if one exists first)
- Share experimental rules with the team
- Forget to disable rules that are no longer needed

### Team Collaboration

✅ **Do:**
- Use consistent naming conventions
- Contribute to the team knowledge base
- Communicate rule changes to the team
- Regular review of shared resources

❌ **Don't:**
- Delete shared resources without checking with team
- Change critical rules without notification
- Hoard knowledge (share insights!)

## Troubleshooting

### I can't see an email account

**Check:**
1. Is the account shared with your organization?
2. Are you in the correct organization?
3. Ask the account owner to verify sharing settings

### I can't edit a rule

**Possible reasons:**
1. You're a Viewer (read-only access)
2. The rule is owned by someone else and you're not an admin
3. Try refreshing the page

### Seat limit reached

**Solution:**
1. Remove inactive team members
2. Upgrade your plan for more seats
3. Contact your organization owner

### Can't transfer email account ownership

**Check:**
1. Target user is in the same organization
2. You're the current owner or an admin
3. Email account is shared with organization

## FAQ

**Q: What happens to my data if I leave an organization?**
A: You lose access to the organization's shared resources, but your personal data remains intact.

**Q: Can I be in multiple organizations?**
A: Yes! You can join or create multiple organizations and switch between them.

**Q: Who pays for the subscription?**
A: The organization owner manages the subscription. All members benefit from the organization's premium features.

**Q: Can I transfer email account ownership back to me?**
A: The new owner can transfer it back to you, or an admin can do it.

**Q: What happens when we remove a team member?**
A: They lose access immediately. Their created resources remain but ownership may need to be transferred.

**Q: Can I share only specific email accounts?**
A: Yes, you can unshare accounts to keep them personal.

## Need Help?

**Support Options:**
- **Email**: support@emailai.com
- **Documentation**: https://docs.emailai.com
- **Community**: https://community.emailai.com

**For Administrators:**
- See the [Admin Guide](ADMIN_GUIDE.md) for advanced features
- See the [API Documentation](API_DOCUMENTATION.md) for integrations
