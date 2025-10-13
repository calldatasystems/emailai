#!/usr/bin/env ts-node
/**
 * Fine-Tuning Worker Script
 *
 * This script polls for pending fine-tuning jobs and executes them.
 * Can be run as:
 * 1. A standalone worker process
 * 2. A cron job
 * 3. Triggered by a queue system
 *
 * Usage:
 *   ts-node scripts/fine-tuning-worker.ts
 *   ts-node scripts/fine-tuning-worker.ts --job-id=<jobId>
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { auth as googleAuth } from "@googleapis/gmail";
import { gmail as gmailApi } from "@googleapis/gmail";
import {
  createDecipheriv,
  scryptSync,
} from "node:crypto";

const prisma = new PrismaClient();

// Token decryption (must match encryption logic in apps/web/utils/encryption.ts)
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const decryptionKey = scryptSync(
  process.env.GOOGLE_ENCRYPT_SECRET!,
  process.env.GOOGLE_ENCRYPT_SALT!,
  KEY_LENGTH,
);

function decryptToken(encryptedText: string | null): string | null {
  if (encryptedText === null || encryptedText === undefined) return null;

  try {
    const buffer = Buffer.from(encryptedText, "hex");

    // Extract IV (first 16 bytes)
    const iv = buffer.subarray(0, IV_LENGTH);

    // Extract auth tag (next 16 bytes)
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);

    // Extract encrypted content (remaining bytes)
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, decryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("[decryptToken] Decryption failed:", error);
    return null;
  }
}

// Simplified Gmail client for worker (avoids path alias issues)
async function getGmailClient(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.refresh_token) {
    throw new Error("No account or refresh token found");
  }

  // Decrypt tokens (they are stored encrypted in database)
  const decryptedRefreshToken = decryptToken(account.refresh_token);
  const decryptedAccessToken = decryptToken(account.access_token);

  if (!decryptedRefreshToken) {
    throw new Error("Failed to decrypt refresh token");
  }

  console.log(`[getGmailClient] Tokens decrypted successfully (access_token: ${decryptedAccessToken ? 'present' : 'missing'})`);

  const oauth2Client = new googleAuth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: decryptedRefreshToken,
    access_token: decryptedAccessToken,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Always refresh token if expired OR if expiry is within next 5 minutes
  const expiryDate = account.expires_at ? account.expires_at * 1000 : 0;
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);

  if (!account.expires_at || expiryDate < fiveMinutesFromNow) {
    console.log(`[getGmailClient] Refreshing access token (expires_at: ${account.expires_at}, now: ${Math.floor(Date.now() / 1000)})`);

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update the OAuth client with new credentials IMMEDIATELY
      oauth2Client.setCredentials({
        refresh_token: decryptedRefreshToken,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
      });

      // Update token in database
      await prisma.account.update({
        where: { id: accountId },
        data: {
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
        },
      });

      console.log(`[getGmailClient] Token refreshed successfully (new expires_at: ${credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : 'null'})`);
    } catch (error: any) {
      console.error(`[getGmailClient] Token refresh failed:`, error.message);
      throw new Error(`Failed to refresh OAuth token: ${error.message}`);
    }
  } else {
    console.log(`[getGmailClient] Using existing access token (expires in ${Math.floor((expiryDate - Date.now()) / 1000 / 60)} minutes)`);
  }

  return gmailApi({ version: "v1", auth: oauth2Client });
}

interface WorkerConfig {
  jobId?: string; // Process specific job
  vastaiApiKey?: string; // Vast.ai API key
  ollamaBaseUrl?: string; // Where to deploy the model
  webhookUrl?: string; // Where to send status updates
}

async function updateJobStatus(
  jobId: string,
  updates: {
    status?: string;
    progress?: number;
    currentStep?: string;
    errorMessage?: string;
    modelName?: string;
    trainingEmails?: number;
    checkpointPath?: string;
    actualCost?: number;
    adapterPath?: string;
    adapterSize?: number;
  },
) {
  console.log(`[${jobId}] Updating status:`, updates);

  await prisma.fineTuningJob.update({
    where: { id: jobId },
    data: {
      ...updates,
      updatedAt: new Date(),
      ...(updates.status === "COMPLETED" ? { deployedAt: new Date() } : {}),
    },
  });

  // Send webhook notification
  const webhookUrl =
    process.env.FINE_TUNING_WEBHOOK_URL ||
    `${process.env.NEXTAUTH_URL}/api/webhooks/fine-tuning`;

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          jobId,
          ...updates,
        }),
      });
    } catch (error) {
      console.error("Failed to send webhook:", error);
    }
  }
}

async function exportEmailsForTraining(jobId: string, userId: string) {
  console.log(`[${jobId}] Extracting emails for user ${userId}`);

  await updateJobStatus(jobId, {
    status: "EXTRACTING_DATA",
    progress: 10,
    currentStep: "Extracting sent emails from database",
  });

  // Get email account and access token
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { userId },
    include: {
      account: true,
    },
  });

  if (!emailAccount) {
    throw new Error(`No email account found for user ${userId}`);
  }

  // Get email metadata from database
  const emailMetadata = await prisma.emailMessage.findMany({
    where: {
      emailAccount: { userId },
      sent: true,
      draft: false,
    },
    select: {
      messageId: true,
      to: true,
      from: true,
      date: true,
    },
    orderBy: { date: "desc" },
    take: 500, // Max 500 emails for training
  });

  console.log(`[${jobId}] Found ${emailMetadata.length} sent emails to fetch content for`);

  await updateJobStatus(jobId, {
    progress: 15,
    currentStep: `Fetching content for ${emailMetadata.length} emails from Gmail`,
  });

  // Get Gmail client
  const gmail = await getGmailClient(emailAccount.account.id);

  // Fetch email content from Gmail API in batches
  const trainingData: Array<{
    instruction: string;
    input: string;
    output: string;
  }> = [];

  const batchSize = 50;
  for (let i = 0; i < emailMetadata.length; i += batchSize) {
    const batch = emailMetadata.slice(i, i + batchSize);
    console.log(`[${jobId}] Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emailMetadata.length / batchSize)}`);

    await Promise.all(
      batch.map(async (meta) => {
        try {
          const message = await gmail.users.messages.get({
            userId: "me",
            id: meta.messageId,
            format: "full",
          });

          // Extract subject from headers
          const headers = message.data.payload?.headers || [];
          const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";

          // Extract email body
          let textContent = "";

          function extractText(part: any): string {
            if (part.mimeType === "text/plain" && part.body?.data) {
              return Buffer.from(part.body.data, "base64").toString("utf-8");
            }
            if (part.mimeType === "text/html" && part.body?.data) {
              // For now, use HTML if plain text not available
              return Buffer.from(part.body.data, "base64").toString("utf-8");
            }
            if (part.parts) {
              for (const subPart of part.parts) {
                const text = extractText(subPart);
                if (text) return text;
              }
            }
            return "";
          }

          if (message.data.payload) {
            textContent = extractText(message.data.payload);
          }

          if (textContent && textContent.length > 50) {
            trainingData.push({
              instruction: `Write a professional email to: ${meta.to}`,
              input: subject ? `Subject: ${subject}` : "Write an email",
              output: textContent.substring(0, 4000), // Limit length
            });
          }
        } catch (error: any) {
          console.error(`[${jobId}] Failed to fetch message ${meta.messageId}:`, error.message);
        }
      })
    );

    // Update progress
    const progress = 15 + Math.floor((i / emailMetadata.length) * 15);
    await updateJobStatus(jobId, {
      progress,
      currentStep: `Fetched ${Math.min(i + batchSize, emailMetadata.length)}/${emailMetadata.length} emails`,
    });
  }

  console.log(`[${jobId}] Successfully extracted ${trainingData.length} emails with content`);

  if (trainingData.length === 0) {
    throw new Error("No email content could be extracted from Gmail API");
  }

  const trainingDataDir = path.join(
    process.cwd(),
    "ollama-server/fine-tuning/training-data",
    jobId,
  );
  fs.mkdirSync(trainingDataDir, { recursive: true });

  // Save training data
  const trainFile = path.join(trainingDataDir, "train_alpaca.jsonl");
  fs.writeFileSync(
    trainFile,
    trainingData.map((d) => JSON.stringify(d)).join("\n"),
  );

  await updateJobStatus(jobId, {
    status: "PREPARING_DATA",
    progress: 30,
    currentStep: `Prepared ${trainingData.length} emails for training`,
    trainingEmails: trainingData.length,
  });

  return { trainingDataDir, emailCount: trainingData.length };
}

async function trainModel(
  jobId: string,
  trainingDataDir: string,
  baseModel: string,
) {
  console.log(`[${jobId}] Starting model training`);

  await updateJobStatus(jobId, {
    status: "TRAINING",
    progress: 40,
    currentStep: "Fine-tuning model (this takes 2-4 hours)",
  });

  const fineTuningDir = path.join(
    process.cwd(),
    "ollama-server/fine-tuning",
  );
  const outputDir = path.join(fineTuningDir, "output", jobId);

  try {
    // Run fine-tuning script
    const command = `cd ${fineTuningDir} && python scripts/finetune-lora.py \
      --config configs/lora-config-8b.yaml \
      --data-path ${trainingDataDir} \
      --output ${outputDir}`;

    execSync(command, { stdio: "inherit" });

    await updateJobStatus(jobId, {
      status: "EVALUATING",
      progress: 80,
      currentStep: "Evaluating model quality",
      checkpointPath: outputDir,
    });

    return outputDir;
  } catch (error: any) {
    throw new Error(`Training failed: ${error.message}`);
  }
}

async function deployToOllama(
  jobId: string,
  userId: string,
  modelPath: string,
) {
  console.log(`[${jobId}] Deploying LoRA adapter to Ollama`);

  await updateJobStatus(jobId, {
    status: "DEPLOYING",
    progress: 90,
    currentStep: "Deploying LoRA adapter to Ollama server",
  });

  const modelName = `emailai-${userId.slice(0, 8)}`;
  const adapterPath = modelPath; // LoRA adapter directory

  try {
    const fineTuningDir = path.join(
      process.cwd(),
      "ollama-server/fine-tuning",
    );

    // Get Ollama URL from environment
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434/api";
    const ollamaHost = ollamaUrl.replace("/api", ""); // Remove /api suffix for CLI

    // Deploy as LoRA adapters (lightweight, not merged)
    const command = `cd ${fineTuningDir} && OLLAMA_HOST=${ollamaHost} bash scripts/deploy-to-ollama.sh \
      --model ${modelPath} \
      --user-id ${userId}`;

    console.log(`[${jobId}] Deploying to Ollama host: ${ollamaHost}`);
    execSync(command, { stdio: "inherit" });

    // Get adapter size
    const adapterSizeBytes = getDirectorySize(adapterPath);

    await updateJobStatus(jobId, {
      status: "COMPLETED",
      progress: 100,
      currentStep: "LoRA adapter deployed successfully",
      modelName,
    });

    // Update FineTuningJob with adapter path and size
    await prisma.fineTuningJob.update({
      where: { id: jobId },
      data: {
        adapterPath,
        adapterSize: adapterSizeBytes,
      },
    });

    // Update user's LoRA adapter settings
    await prisma.user.update({
      where: { id: userId },
      data: {
        aiProvider: "ollama",
        aiModel: modelName,
        loraAdapterId: jobId,
        loraAdapterPath: adapterPath,
        adapterLastTrained: new Date(),
      },
    });

    return modelName;
  } catch (error: any) {
    throw new Error(`LoRA adapter deployment failed: ${error.message}`);
  }
}

function getDirectorySize(dirPath: string): number {
  let totalSize = 0;

  function calculateSize(itemPath: string) {
    const stats = fs.statSync(itemPath);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(itemPath);
      files.forEach((file) => {
        calculateSize(path.join(itemPath, file));
      });
    } else {
      totalSize += stats.size;
    }
  }

  if (fs.existsSync(dirPath)) {
    calculateSize(dirPath);
  }

  return totalSize;
}

async function processJob(jobId: string) {
  console.log(`[${jobId}] Processing fine-tuning job`);

  try {
    const job = await prisma.fineTuningJob.findUnique({
      where: { id: jobId },
      include: { user: true },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== "PENDING") {
      console.log(
        `[${jobId}] Job status is ${job.status}, skipping`,
      );
      return;
    }

    // Step 1: Extract emails
    const { trainingDataDir, emailCount } = await exportEmailsForTraining(
      jobId,
      job.userId,
    );

    if (emailCount < 50) {
      throw new Error(
        `Not enough emails for training. Found ${emailCount}, need at least 50.`,
      );
    }

    // Step 2: Train model
    const modelPath = await trainModel(jobId, trainingDataDir, job.baseModel);

    // Step 3: Deploy to Ollama
    const modelName = await deployToOllama(jobId, job.userId, modelPath);

    console.log(
      `[${jobId}] Job completed successfully. Model: ${modelName}`,
    );
  } catch (error: any) {
    console.error(`[${jobId}] Job failed:`, error);

    await updateJobStatus(jobId, {
      status: "FAILED",
      errorMessage: error.message,
    });

    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jobIdArg = args.find((a) => a.startsWith("--job-id="));

  if (jobIdArg) {
    // Process specific job
    const jobId = jobIdArg.split("=")[1];
    await processJob(jobId);
  } else {
    // Poll for pending jobs
    console.log("Polling for pending fine-tuning jobs...");

    const pendingJobs = await prisma.fineTuningJob.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 1, // Process one at a time
    });

    if (pendingJobs.length === 0) {
      console.log("No pending jobs found");
      return;
    }

    for (const job of pendingJobs) {
      await processJob(job.id);
    }
  }
}

main()
  .catch((error) => {
    console.error("Worker error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
