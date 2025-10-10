# UI Visibility for Fine-Tuning - Complete Guide

This document explains all the UI components and visibility features for per-user AI model fine-tuning.

## Overview

Users get complete visibility into their AI model training status through:

1. **Real-time notification banners** (training progress, completion alerts)
2. **Settings page controls** (start training, view progress, toggle models)
3. **Model management** (enable/disable fine-tuned models)
4. **Training history** (view past jobs, costs, results)
5. **Status badges** (active/inactive indicators)

## Components Created

### 1. Notification Banner Component

**File**: `components/FineTuningNotificationBanner.tsx`

**Shows**:
- ✅ **Training in Progress**: Live progress bar, status updates
- ✅ **Training Complete**: Success message with "View Settings" button
- ✅ **Training Failed**: Error message with "Try Again" button
- ✅ **Eligibility Alert**: When user hits 100+ emails, prompt to train

**Usage**:
```tsx
// Add to root layout
// apps/web/app/(app)/layout.tsx
import { FineTuningNotificationBanner } from "@/components/FineTuningNotificationBanner";

export default function Layout({ children }) {
  return (
    <>
      <FineTuningNotificationBanner />
      {children}
    </>
  );
}
```

**Features**:
- Auto-updates every 15 seconds
- Dismissible notifications
- Links to settings page
- Shows ETA for completion

### 2. Model Controls Component

**File**: `apps/web/app/(app)/[emailAccountId]/settings/FineTunedModelControls.tsx`

**Shows**:
- ✅ **Enable/Disable Toggle**: Switch between fine-tuned and base model
- ✅ **Model Info**: Name, training date, email count, cost
- ✅ **Status Badge**: Active/Inactive
- ✅ **Model Comparison**: Shows difference between base and fine-tuned
- ✅ **Quick Actions**: Compare examples, view details

**Usage**:
```tsx
// In settings page
import { FineTunedModelControls } from "./FineTunedModelControls";

<FineTunedModelControls
  user={user}
  completedModel={completedModel}
  onUpdate={() => fetchData()}
/>
```

### 3. Enhanced AI Model Section

**File**: `apps/web/app/(app)/[emailAccountId]/settings/AIModelSection.tsx`

**Shows**:
- ✅ **Eligibility Check**: Shows sent email count, requirement progress
- ✅ **Training Progress**: Real-time progress bar during training
- ✅ **Job Status**: Current step (extracting, training, deploying)
- ✅ **Training History**: Last 5 jobs with status badges
- ✅ **Cost Information**: Estimated and actual costs
- ✅ **Model Information**: Deployment date, email count used

**Tabs**:
1. **Train**: Start new training job
2. **Status**: View active job progress
3. **History**: View past training jobs
4. **Settings**: Toggle and configure models

## API Endpoints

### GET /api/user/ai/fine-tune

**Response**:
```json
{
  "jobs": [
    {
      "id": "job_123",
      "status": "COMPLETED",
      "progress": 100,
      "modelName": "emailai-abc123",
      "createdAt": "2025-01-15T10:00:00Z",
      "deployedAt": "2025-01-15T14:00:00Z",
      "trainingEmails": 250,
      "actualCost": 1.50
    }
  ],
  "activeJob": {
    "id": "job_124",
    "status": "TRAINING",
    "progress": 65,
    "currentStep": "Training model (epoch 2/3)",
    "costEstimate": 1.50
  },
  "eligibility": {
    "eligible": true,
    "sentEmailCount": 250,
    "message": "You have 250 sent emails! Train a personalized AI model."
  }
}
```

### POST /api/user/ai/fine-tune

**Request**:
```json
{
  "baseModel": "llama3.1:8b",
  "epochs": 3
}
```

**Response**:
```json
{
  "success": true,
  "job": {
    "id": "job_125",
    "status": "PENDING",
    "progress": 0,
    "estimatedCost": 1.50
  }
}
```

### PATCH /api/user/settings/ai-model

**Request**:
```json
{
  "useFineTunedModel": true,
  "modelName": "emailai-abc123"
}
```

**Response**:
```json
{
  "success": true,
  "aiProvider": "ollama",
  "aiModel": "emailai-abc123"
}
```

## Status Flow & UI States

### State 1: Not Eligible
**User has < 100 sent emails**

```
┌─────────────────────────────────────┐
│ Personalized AI Model               │
├─────────────────────────────────────┤
│ ⓘ Send at least 100 emails to      │
│   train your personalized AI model. │
│   You currently have 45 sent       │
│   emails.                           │
│                                     │
│ Progress: [████░░░░░░] 45/100      │
└─────────────────────────────────────┘
```

### State 2: Eligible - Not Started
**User has 100+ emails, no training yet**

```
┌─────────────────────────────────────┐
│ Personalized AI Model               │
├─────────────────────────────────────┤
│ ✨ You have 150 sent emails!        │
│    Train a personalized AI model.   │
│                                     │
│ Benefits:                           │
│ • Matches your writing style        │
│ • Uses your tone & vocabulary       │
│ • Costs $1-2 one-time               │
│                                     │
│ [Train Personalized Model]          │
│                                     │
│ Estimated time: 2-4 hours           │
│ Training emails: 150                │
└─────────────────────────────────────┘
```

### State 3: Training Started
**Job created, waiting to start**

```
┌─────────────────────────────────────┐
│ Personalized AI Model               │
├─────────────────────────────────────┤
│ ⟳ Training in progress              │
│                                     │
│ Status: PENDING                     │
│ [░░░░░░░░░░] 0%                     │
│                                     │
│ Waiting to start...                 │
│                                     │
│ [Cancel]  Est. cost: $1.50          │
└─────────────────────────────────────┘
```

### State 4: Extracting Data
**Pulling emails from database**

```
┌─────────────────────────────────────┐
│ Personalized AI Model               │
├─────────────────────────────────────┤
│ ⟳ Training in progress              │
│                                     │
│ Status: EXTRACTING_DATA             │
│ [███░░░░░░░] 10%                    │
│                                     │
│ Extracting 150 sent emails from     │
│ your inbox...                       │
│                                     │
│ [Cancel]  ~3.5 hours remaining      │
└─────────────────────────────────────┘
```

### State 5: Training
**Model training on GPU**

```
┌─────────────────────────────────────┐
│ Personalized AI Model               │
├─────────────────────────────────────┤
│ ⟳ Training in progress              │
│                                     │
│ Status: TRAINING                    │
│ [██████████░] 65%                   │
│                                     │
│ Training model (epoch 2/3)          │
│ Learning your writing patterns...   │
│                                     │
│ [Cancel]  ~1.2 hours remaining      │
└─────────────────────────────────────┘
```

### State 6: Deploying
**Almost done, deploying to Ollama**

```
┌─────────────────────────────────────┐
│ Personalized AI Model               │
├─────────────────────────────────────┤
│ ⟳ Training in progress              │
│                                     │
│ Status: DEPLOYING                   │
│ [█████████████] 90%                 │
│                                     │
│ Deploying model to AI server...     │
│                                     │
│ [Cancel]  ~10 minutes remaining     │
└─────────────────────────────────────┘
```

### State 7: Complete
**Training done, model active**

```
┌─────────────────────────────────────┐
│ Personalized AI Model    [Active]  │
├─────────────────────────────────────┤
│ ✓ Personalized model active         │
│                                     │
│ Model: emailai-abc123               │
│ Trained: Jan 15, 2025               │
│ Emails used: 150                    │
│ Cost: $1.50                         │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Use Personalized Model    [ON] │ │
│ │ AI writes emails in your style │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Compare Examples] [View Details]   │
└─────────────────────────────────────┘
```

### State 8: Complete + Disabled
**Model trained but user toggled it off**

```
┌─────────────────────────────────────┐
│ Personalized AI Model  [Inactive]  │
├─────────────────────────────────────┤
│ ℹ Using base model                  │
│                                     │
│ Model: emailai-abc123               │
│ Trained: Jan 15, 2025               │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Use Personalized Model   [OFF] │ │
│ │ Using standard AI model        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Enable your personalized model      │
│ above to get emails that sound      │
│ more like you.                      │
└─────────────────────────────────────┘
```

### State 9: Failed
**Training encountered an error**

```
┌─────────────────────────────────────┐
│ Personalized AI Model               │
├─────────────────────────────────────┤
│ ✗ Training failed                   │
│                                     │
│ Error: GPU instance terminated      │
│                                     │
│ Don't worry, you weren't charged.   │
│                                     │
│ [Try Again]  [View Logs]            │
│                                     │
│ Training History:                   │
│ • Jan 15, 2025 - FAILED             │
│ • Jan 10, 2025 - COMPLETED          │
└─────────────────────────────────────┘
```

## Notification Banner States

### Banner 1: Training Started
```
┌────────────────────────────────────────┐
│ ⟳ Training Your AI Model         [×]  │
│                                        │
│ Extracting sent emails from database  │
│ [███░░░░░░░] 10% • ~3 hours remaining │
│                                        │
│ View Details →                         │
└────────────────────────────────────────┘
```

### Banner 2: Training Complete
```
┌────────────────────────────────────────┐
│ ✓ Your AI Model is Ready! 🎉     [×]  │
│                                        │
│ Your personalized AI model has been    │
│ trained and deployed. AI-generated     │
│ emails will now match your writing!    │
│                                        │
│ [View Settings] [Got it]               │
└────────────────────────────────────────┘
```

### Banner 3: Training Failed
```
┌────────────────────────────────────────┐
│ ✗ Training Failed                 [×]  │
│                                        │
│ GPU instance terminated unexpectedly.  │
│ You were not charged for this attempt. │
│                                        │
│ [Try Again]                            │
└────────────────────────────────────────┘
```

### Banner 4: Eligibility Alert
```
┌────────────────────────────────────────┐
│ ✨ Ready for Personalized AI!     [×]  │
│                                        │
│ You have 150 sent emails! Train a      │
│ personalized AI model to match your    │
│ writing style.                         │
│                                        │
│ [Train Model] [Later]                  │
└────────────────────────────────────────┘
```

## Implementation Checklist

### Phase 1: Core UI (Required)
- [ ] Add `FineTuningNotificationBanner` to app layout
- [ ] Add `AIModelSection` to settings page
- [ ] Test notification banner appears on training start
- [ ] Test progress updates every 15 seconds
- [ ] Test completion notification

### Phase 2: Model Controls (Required)
- [ ] Add `FineTunedModelControls` component
- [ ] Test enable/disable toggle works
- [ ] Verify API endpoint `/api/user/settings/ai-model`
- [ ] Test switching updates `User.aiModel` in DB
- [ ] Verify AI uses correct model after toggle

### Phase 3: Enhanced Visibility (Optional)
- [ ] Add training history table
- [ ] Add cost tracking display
- [ ] Add email count progress bar (< 100 emails)
- [ ] Add "Compare Examples" modal
- [ ] Add model quality metrics

### Phase 4: Notifications (Optional)
- [ ] Email notification on completion
- [ ] Push notification support
- [ ] In-app notification history
- [ ] SMS alerts (for long-running jobs)

## Testing Guide

### Test Case 1: New User (< 100 emails)
1. Create test user with 50 sent emails
2. Go to Settings → AI Model
3. Should see: "Send at least 100 emails... You currently have 50"
4. Progress bar shows 50/100

### Test Case 2: Eligible User (100+ emails)
1. User has 150 sent emails
2. Go to Settings → AI Model
3. Should see: "You have 150 sent emails! Train a model"
4. "Train Personalized Model" button visible
5. Click button → Job created

### Test Case 3: Training Progress
1. Start training job
2. Notification banner appears: "Training Your AI Model"
3. Progress bar shows 0%
4. Wait 30 seconds, progress updates (e.g., 10%)
5. Current step shows: "Extracting emails..."

### Test Case 4: Training Complete
1. Job completes (status: COMPLETED)
2. Notification banner changes: "Your AI Model is Ready! 🎉"
3. Settings page shows: "Personalized model active"
4. Toggle switch is ON by default
5. User.aiModel in DB = "emailai-abc123"

### Test Case 5: Toggle Model
1. User has completed model
2. Go to Settings → AI Model Controls
3. Toggle "Use Personalized Model" to OFF
4. User.aiModel in DB = null (uses default)
5. Toggle back to ON
6. User.aiModel in DB = "emailai-abc123"

### Test Case 6: Training Failed
1. Simulate failed job (update DB: status = FAILED)
2. Notification banner shows: "Training Failed"
3. Error message displayed
4. "Try Again" button visible
5. Click → Creates new job

## Monitoring Dashboard (Future)

**Admin view** (`/admin/fine-tuning`):
```
Fine-Tuning Jobs Overview
─────────────────────────────────────────────
Total Jobs: 47
  ├─ Completed: 35 (74%)
  ├─ In Progress: 2 (4%)
  ├─ Failed: 8 (17%)
  └─ Pending: 2 (4%)

Active Jobs
─────────────────────────────────────────────
User               Status      Progress  ETA
user1@example.com  TRAINING    65%      1.2h
user2@example.com  DEPLOYING   90%      10m

Recent Completions
─────────────────────────────────────────────
user3@example.com  ✓ 2h ago   $1.50   emailai-xyz123
user4@example.com  ✓ 5h ago   $1.20   emailai-abc456

Cost Summary
─────────────────────────────────────────────
Total Spent: $52.50
Average per Job: $1.50
Failed (no charge): $0
```

## Support & Troubleshooting

### User can't see their model
**Check**:
1. Job status: `SELECT * FROM "FineTuningJob" WHERE "userId" = 'user-id';`
2. User AI settings: `SELECT "aiProvider", "aiModel" FROM "User" WHERE id = 'user-id';`
3. Model in Ollama: `curl $OLLAMA_BASE_URL/api/tags | grep emailai`

### Notification not showing
**Check**:
1. Component added to layout
2. API endpoint accessible
3. Browser console for errors
4. User dismissed notification

### Toggle not working
**Check**:
1. API endpoint `/api/user/settings/ai-model`
2. User owns the model (job.userId matches)
3. Job status is COMPLETED
4. Database permissions

## Next Steps

1. ✅ Add notification banner to layout
2. ✅ Add AI model section to settings
3. ✅ Test with real user data
4. ✅ Monitor first production training
5. ⬜ Add email notifications
6. ⬜ Build admin dashboard
7. ⬜ Add model comparison feature
8. ⬜ Implement quality metrics

---

**All components are ready to use!** Just add them to your app and users will have complete visibility into their AI model training.
