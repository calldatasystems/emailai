# Auto-Send Guardrails Implementation

## Overview

The auto-send guardrails system allows users to define natural language rules that control when emails can be auto-sent versus held for review. This prevents inappropriate or sensitive emails from being automatically sent without user approval.

## Features

- **Natural Language Rules**: Users define guardrails in plain English (e.g., "Do not auto-send if recipient is asking for a time or date commitment")
- **AI-Powered Evaluation**: Each email is evaluated against active guardrails using AI
- **Multiple Severity Levels**: BLOCK, WARN, INFO
- **Flexible Actions**: HOLD_FOR_REVIEW, ASK_USER, LOG_ONLY
- **Scope Control**: Apply to all emails, external only, internal only, or specific domains
- **Priority System**: Higher priority guardrails are checked first
- **Audit Trail**: All violations are logged with AI reasoning
- **Default Templates**: Pre-configured guardrails for common scenarios

## Database Schema

### AutoSendGuardrail Model

```prisma
model AutoSendGuardrail {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userId         String?
  user           User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name        String
  description String @db.Text // Natural language guardrail

  enabled     Boolean @default(true)
  priority    Int     @default(0)
  severity    GuardrailSeverity @default(BLOCK)
  action      GuardrailAction @default(HOLD_FOR_REVIEW)
  appliesTo   GuardrailScope  @default(ALL)

  examples    Json?

  triggeredCount Int @default(0)
  lastTriggered  DateTime?

  violations AutoSendViolation[]
}
```

### AutoSendViolation Model

```prisma
model AutoSendViolation {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  guardrailId String
  guardrail   AutoSendGuardrail @relation(fields: [guardrailId], references: [id], onDelete: Cascade)

  threadId     String
  messageId    String?
  emailSubject String?
  emailPreview String? @db.Text

  aiReasoning String @db.Text
  confidence  Float
}
```

### Enums

```prisma
enum GuardrailSeverity {
  BLOCK // Prevent auto-send
  WARN  // Show warning, ask user
  INFO  // Log only, allow send
}

enum GuardrailAction {
  HOLD_FOR_REVIEW // Convert to draft
  ASK_USER        // Prompt user before sending
  LOG_ONLY        // Just log the violation
}

enum GuardrailScope {
  ALL             // All emails
  EXTERNAL_ONLY   // External recipients only
  INTERNAL_ONLY   // Internal recipients only
  SPECIFIC_DOMAINS // Specific domains (from examples)
}
```

## Architecture

### Components

1. **GuardrailService** (`utils/ai/guardrails/guardrail-service.ts`)
   - Core service for evaluating emails against guardrails
   - Uses AI to evaluate natural language rules
   - Returns evaluation results with reasoning and confidence

2. **API Endpoints** (`app/api/user/guardrails/route.ts`)
   - GET: Fetch user's guardrails
   - POST: Create new guardrail
   - PATCH: Update guardrail
   - DELETE: Remove guardrail

3. **UI Component** (`app/(app)/[emailAccountId]/settings/GuardrailsSection.tsx`)
   - Table view of all guardrails
   - Create/edit dialog
   - Enable/disable toggle
   - Default templates button

4. **Integration** (`utils/ai/choose-rule/execute.ts`)
   - Checks guardrails before executing REPLY or SEND_EMAIL actions
   - Converts blocked emails to drafts
   - Logs warnings for non-blocking guardrails

5. **Helper Functions** (`utils/ai/guardrails/check-before-send.ts`)
   - `checkGuardrailsBeforeSend()`: Main check function
   - `convertToDraftIfBlocked()`: Converts auto-send to draft
   - `hasActiveGuardrails()`: Quick check for active guardrails

## How It Works

### 1. User Creates Guardrail

```typescript
POST /api/user/guardrails
{
  "name": "Date/Time Commitment Check",
  "description": "Do not auto-send if the recipient is asking for a specific date, time, or meeting commitment",
  "severity": "BLOCK",
  "action": "HOLD_FOR_REVIEW",
  "priority": 100,
  "examples": {
    "shouldBlock": [
      "When are you available next week?",
      "Can we schedule a call on Tuesday?"
    ]
  }
}
```

### 2. Email Triggering Auto-Send Rule

When an email matches a rule with auto-send enabled:

```typescript
// In execute.ts
await executeAct({
  gmail,
  executedRule,
  message,
  emailAccount,
  // ... other params
});
```

### 3. Guardrail Evaluation

Before executing REPLY or SEND_EMAIL actions:

```typescript
const checkResult = await checkGuardrailsBeforeSend({
  userId,
  organizationId,
  emailAccount,
  email: message,
  draftContent: action.content,
  actionType: "REPLY",
});
```

### 4. AI Evaluation

For each active guardrail:

```typescript
const system = `You are a guardrail evaluator for email auto-sending.
Determine if an email violates a specific guardrail rule.`;

const prompt = `Evaluate if this email violates the following guardrail:

**Guardrail Rule:**
${guardrail.name}: ${guardrail.description}

**Email to Evaluate:**
To: ${emailContext.recipient}
Subject: ${emailContext.subject}
${emailContext.body}`;

const result = await chatCompletionObject({
  system,
  prompt,
  schema: evaluationSchema,
  useEconomyModel: true,
});
```

AI returns:
```json
{
  "shouldBlock": true,
  "reasoning": "The recipient is asking about availability for next week, which requires a specific date/time commitment",
  "confidence": 0.95
}
```

### 5. Action Taken

If `shouldBlock = true` and `severity = BLOCK`:

```typescript
// Convert REPLY/SEND_EMAIL to DRAFT_EMAIL
const draftAction = {
  ...action,
  type: ActionType.DRAFT_EMAIL,
};

await runActionFunction({
  gmail,
  email: message,
  action: draftAction,
  // ... other params
});

// Update executed rule
await prisma.executedRule.update({
  where: { id: executedRuleId },
  data: {
    automated: false,
    reason: `Held for review by guardrails: Date/Time Commitment Check`,
  },
});

// Log violation
await prisma.autoSendViolation.create({
  data: {
    guardrailId: guardrail.id,
    threadId: email.threadId,
    aiReasoning: "The recipient is asking about availability...",
    confidence: 0.95,
  },
});
```

## Default Guardrails

The system provides 6 recommended default guardrails:

1. **Date/Time Commitment Check** (Priority: 100)
   - Blocks emails when recipient asks for specific dates/times
   - Examples: "When are you available?", "Can we schedule a call?"

2. **Objectionable Language Check** (Priority: 200)
   - Blocks emails with profanity or offensive content
   - Highest priority to prevent reputational damage

3. **Financial Commitment Check** (Priority: 90)
   - Blocks pricing, contract, or payment discussions
   - Examples: "What's your pricing?", "Send over a contract"

4. **Sensitive Topic Check** (Priority: 150)
   - Blocks legal matters, HR issues, confidential information

5. **Request for Detailed Information** (Priority: 50, WARN)
   - Warns when recipient asks for technical details
   - Doesn't block, just alerts user

6. **First-Time Contact** (Priority: 40, WARN)
   - Warns when replying to someone for the first time
   - Ensures appropriate tone

## API Reference

### GET /api/user/guardrails

**Query Parameters:**
- `organizationId` (optional): Filter by organization

**Response:**
```json
{
  "guardrails": [
    {
      "id": "gr_123",
      "name": "Date/Time Commitment Check",
      "description": "Do not auto-send if...",
      "enabled": true,
      "severity": "BLOCK",
      "action": "HOLD_FOR_REVIEW",
      "priority": 100,
      "triggeredCount": 5,
      "lastTriggered": "2025-10-04T10:00:00Z",
      "_count": {
        "violations": 5
      }
    }
  ]
}
```

### POST /api/user/guardrails

**Request:**
```json
{
  "name": "Custom Guardrail",
  "description": "Natural language rule description",
  "severity": "BLOCK",
  "action": "HOLD_FOR_REVIEW",
  "appliesTo": "ALL",
  "priority": 50,
  "examples": {
    "shouldBlock": ["example 1", "example 2"]
  }
}
```

### PATCH /api/user/guardrails?id={guardrailId}

**Request:**
```json
{
  "enabled": false,
  "priority": 75
}
```

### DELETE /api/user/guardrails?id={guardrailId}

Deletes the guardrail and all associated violations.

## UI Usage

### Settings Page Integration

Add to `app/(app)/[emailAccountId]/settings/page.tsx`:

```tsx
import { GuardrailsSection } from "./GuardrailsSection";

export default function SettingsPage() {
  return (
    <div>
      {/* ... other sections ... */}
      <GuardrailsSection />
    </div>
  );
}
```

### Creating a Guardrail

1. Go to Settings → Auto-Send Guardrails
2. Click "New Guardrail"
3. Fill in:
   - Name (e.g., "Legal Matters Check")
   - Description (natural language rule)
   - Severity (BLOCK, WARN, INFO)
   - Action (HOLD_FOR_REVIEW, ASK_USER, LOG_ONLY)
   - Applies To (ALL, EXTERNAL_ONLY, INTERNAL_ONLY, SPECIFIC_DOMAINS)
   - Priority (higher = checked first)
   - Examples (optional, one per line)
4. Click "Create"

### Using Default Templates

1. Go to Settings → Auto-Send Guardrails
2. Click "Create Defaults"
3. 4 default guardrails are created automatically

## Testing

### Test Case 1: Block Email with Date Request

**Setup:**
- Create guardrail: "Do not auto-send if recipient asks for a date/time"

**Test:**
1. Receive email: "When are you available for a call next week?"
2. AI rule triggers auto-reply
3. Guardrail evaluates email
4. AI determines: `shouldBlock = true`, reasoning = "Asking for availability"
5. Email converted to draft instead of sent
6. User sees draft in Gmail with note about guardrail

**Expected Result:**
- Email NOT sent
- Draft created instead
- Violation logged
- ExecutedRule marked as `automated: false`

### Test Case 2: Warning for First Contact

**Setup:**
- Create guardrail: "Warn when replying to first-time contact" (severity: WARN)

**Test:**
1. Receive email from new sender
2. AI rule triggers auto-reply
3. Guardrail evaluates email
4. Warning logged (but email still sent)

**Expected Result:**
- Email sent normally
- Warning logged
- User can review warnings later

### Test Case 3: Organization-Wide Guardrail

**Setup:**
- Admin creates guardrail at organization level

**Test:**
1. All users in organization have guardrail active
2. Any auto-send is checked against it
3. Violations tracked at organization level

## Migration

To apply the database schema:

```bash
cd apps/web
npx prisma migrate dev --name add_guardrails
```

This will create:
- `AutoSendGuardrail` table
- `AutoSendViolation` table
- New enums for severity, action, scope

## Performance Considerations

1. **AI Calls**: Each guardrail evaluation requires an AI call
   - Uses economy model (`useEconomyModel: true`) for lower cost
   - Only evaluates when auto-send is triggered
   - Cached results not implemented yet (future enhancement)

2. **Database Queries**:
   - Guardrails fetched once per email evaluation
   - Indexed by `userId`, `organizationId`, `enabled`
   - Violations insert is async (doesn't block email flow)

3. **Optimization Ideas**:
   - Cache guardrail evaluations for similar emails
   - Batch evaluate multiple guardrails in single AI call
   - Use regex pre-filters before AI evaluation
   - Add guardrail statistics dashboard

## Security

- Guardrails are user/organization scoped
- API endpoints verify ownership
- Violations include confidence scores for auditing
- AI evaluation uses user's AI provider settings
- No PII stored in violations (only preview)

## Future Enhancements

1. **Guardrail Templates Marketplace**
   - Share guardrails between users
   - Community-contributed templates
   - Industry-specific guardrails

2. **Advanced Scope Rules**
   - Regex patterns for email addresses
   - Content-based filtering (attachments, links)
   - Time-based rules (don't auto-send after hours)

3. **Learning from Violations**
   - Auto-suggest new guardrails based on violations
   - Improve AI evaluation with user feedback
   - Detect patterns in blocked emails

4. **Analytics Dashboard**
   - Guardrail effectiveness metrics
   - Most triggered guardrails
   - False positive/negative rates
   - Cost tracking for AI evaluations

5. **Override Capabilities**
   - Allow user to "Send Anyway" from draft
   - Track override reasons
   - Suggest guardrail adjustments

6. **Batch Evaluation**
   - Test guardrails against historical emails
   - Preview impact before enabling
   - A/B test different guardrail configurations

## Troubleshooting

### Guardrails not triggering

**Check:**
1. Guardrail is `enabled: true`
2. Rule has `automate: true`
3. Action type is REPLY or SEND_EMAIL
4. EmailAccount is passed to `executeAct()`

### AI evaluation errors

**Check:**
1. User has valid AI provider configured
2. AI model supports structured output
3. Check logs for specific error messages
4. Verify economy model is available

### Performance issues

**Check:**
1. Number of active guardrails per user
2. AI provider response times
3. Database query performance (indexes)
4. Consider caching frequently evaluated emails

## Summary

The auto-send guardrails system provides a powerful, flexible way to control email automation with natural language rules. By leveraging AI for evaluation, users can define complex policies without writing code, while maintaining full visibility and control over their automated email workflows.

Key benefits:
- **Safety**: Prevents inappropriate auto-sends
- **Flexibility**: Natural language rules, no coding required
- **Transparency**: Full audit trail with AI reasoning
- **Control**: Multiple severity levels and actions
- **Scalability**: Organization-wide guardrails
