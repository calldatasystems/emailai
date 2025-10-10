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

const prisma = new PrismaClient();

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

  // Export sent emails to JSONL format
  const emails = await prisma.emailMessage.findMany({
    where: {
      emailAccount: { userId },
      isSent: true,
    },
    select: {
      to: true,
      subject: true,
      textPlain: true,
      textHtml: true,
    },
    orderBy: { sentAt: "desc" },
    take: 500, // Max 500 emails for training
  });

  const trainingDataDir = path.join(
    process.cwd(),
    "ollama-server/fine-tuning/training-data",
    jobId,
  );
  fs.mkdirSync(trainingDataDir, { recursive: true });

  // Convert to training format (Alpaca)
  const trainingData = emails
    .filter((e) => e.textPlain || e.textHtml)
    .map((email) => ({
      instruction: `Write a professional email reply to: ${email.to}`,
      input: `Subject: ${email.subject}`,
      output: email.textPlain || email.textHtml || "",
    }));

  // Save training data
  const trainFile = path.join(trainingDataDir, "train_alpaca.jsonl");
  fs.writeFileSync(
    trainFile,
    trainingData.map((d) => JSON.stringify(d)).join("\n"),
  );

  await updateJobStatus(jobId, {
    status: "PREPARING_DATA",
    progress: 20,
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
    progress: 30,
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
  console.log(`[${jobId}] Deploying to Ollama`);

  await updateJobStatus(jobId, {
    status: "DEPLOYING",
    progress: 90,
    currentStep: "Deploying model to Ollama server",
  });

  const modelName = `emailai-${userId.slice(0, 8)}`;

  try {
    const fineTuningDir = path.join(
      process.cwd(),
      "ollama-server/fine-tuning",
    );

    // Deploy to Ollama
    const command = `cd ${fineTuningDir} && bash scripts/deploy-to-ollama.sh \
      --model ${modelPath} \
      --user-id ${userId} \
      --model-name ${modelName}`;

    execSync(command, { stdio: "inherit" });

    await updateJobStatus(jobId, {
      status: "COMPLETED",
      progress: 100,
      currentStep: "Model deployed successfully",
      modelName,
    });

    // Update user's AI settings
    await prisma.user.update({
      where: { id: userId },
      data: {
        aiProvider: "ollama",
        aiModel: modelName,
      },
    });

    return modelName;
  } catch (error: any) {
    throw new Error(`Deployment failed: ${error.message}`);
  }
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
