-- CreateEnum
CREATE TYPE "FineTuningStatus" AS ENUM ('PENDING', 'EXTRACTING_DATA', 'PREPARING_DATA', 'PROVISIONING_GPU', 'TRAINING', 'EVALUATING', 'DEPLOYING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuardrailSeverity" AS ENUM ('INFO', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "GuardrailAction" AS ENUM ('HOLD_FOR_REVIEW', 'ASK_USER', 'LOG_ONLY', 'ESCALATE');

-- CreateEnum
CREATE TYPE "GuardrailScope" AS ENUM ('ALL', 'EXTERNAL_ONLY', 'INTERNAL_ONLY', 'SPECIFIC_DOMAINS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adapterLastTrained" TIMESTAMP(3),
ADD COLUMN     "loraAdapterId" TEXT,
ADD COLUMN     "loraAdapterPath" TEXT;

-- CreateTable
CREATE TABLE "FineTuningJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "FineTuningStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "baseModel" TEXT NOT NULL DEFAULT 'llama3.1:8b',
    "trainingEmails" INTEGER,
    "epochs" INTEGER NOT NULL DEFAULT 3,
    "adapterPath" TEXT,
    "adapterSize" INTEGER,
    "loraRank" INTEGER NOT NULL DEFAULT 16,
    "loraAlpha" INTEGER NOT NULL DEFAULT 16,
    "modelName" TEXT,
    "checkpointPath" TEXT,
    "deployedAt" TIMESTAMP(3),
    "executorId" TEXT,
    "executorUrl" TEXT,
    "costEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "actualCost" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "FineTuningJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoSendGuardrail" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "severity" "GuardrailSeverity" NOT NULL DEFAULT 'BLOCK',
    "action" "GuardrailAction" NOT NULL DEFAULT 'HOLD_FOR_REVIEW',
    "appliesTo" "GuardrailScope" NOT NULL DEFAULT 'ALL',
    "examples" JSONB,
    "triggeredCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggered" TIMESTAMP(3),

    CONSTRAINT "AutoSendGuardrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoSendViolation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guardrailId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "emailSubject" TEXT,
    "emailPreview" TEXT,
    "aiReasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "userOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideAt" TIMESTAMP(3),

    CONSTRAINT "AutoSendViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FineTuningJob_userId_idx" ON "FineTuningJob"("userId");

-- CreateIndex
CREATE INDEX "FineTuningJob_status_idx" ON "FineTuningJob"("status");

-- CreateIndex
CREATE INDEX "AutoSendGuardrail_userId_idx" ON "AutoSendGuardrail"("userId");

-- CreateIndex
CREATE INDEX "AutoSendGuardrail_organizationId_idx" ON "AutoSendGuardrail"("organizationId");

-- CreateIndex
CREATE INDEX "AutoSendGuardrail_enabled_idx" ON "AutoSendGuardrail"("enabled");

-- CreateIndex
CREATE INDEX "AutoSendViolation_guardrailId_idx" ON "AutoSendViolation"("guardrailId");

-- CreateIndex
CREATE INDEX "AutoSendViolation_threadId_idx" ON "AutoSendViolation"("threadId");

-- AddForeignKey
ALTER TABLE "FineTuningJob" ADD CONSTRAINT "FineTuningJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoSendGuardrail" ADD CONSTRAINT "AutoSendGuardrail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoSendGuardrail" ADD CONSTRAINT "AutoSendGuardrail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoSendViolation" ADD CONSTRAINT "AutoSendViolation_guardrailId_fkey" FOREIGN KEY ("guardrailId") REFERENCES "AutoSendGuardrail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
