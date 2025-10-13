/**
 * Background Job Processor for LoRA Fine-Tuning
 *
 * This service automatically processes pending fine-tuning jobs
 * without requiring manual worker execution.
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { createScopedLogger } from "@/utils/logger";

const execAsync = promisify(exec);
const logger = createScopedLogger("fine-tuning-job-processor");

/**
 * Trigger the fine-tuning worker to process a specific job
 * Runs in the background without blocking the API response
 */
export async function triggerJobProcessing(jobId: string): Promise<void> {
  logger.info("Triggering job processing", { jobId });

  try {
    // Get the path to the worker script
    const projectRoot = path.resolve(process.cwd(), "../..");
    const workerScript = path.join(projectRoot, "scripts/fine-tuning-worker.ts");

    // Use absolute paths to avoid PATH issues
    // process.execPath gives us the absolute path to the current Node.js executable
    const nodePath = process.execPath;
    const pnpmPath = path.join(path.dirname(nodePath), "pnpm");

    // Pass environment variables to worker
    const envVars = [
      `DATABASE_URL="${process.env.DATABASE_URL}"`,
      `DIRECT_URL="${process.env.DIRECT_URL}"`,
      `OLLAMA_BASE_URL="${process.env.OLLAMA_BASE_URL}"`,
      `GOOGLE_CLIENT_ID="${process.env.GOOGLE_CLIENT_ID}"`,
      `GOOGLE_CLIENT_SECRET="${process.env.GOOGLE_CLIENT_SECRET}"`,
      `GOOGLE_ENCRYPT_SECRET="${process.env.GOOGLE_ENCRYPT_SECRET}"`,
      `GOOGLE_ENCRYPT_SALT="${process.env.GOOGLE_ENCRYPT_SALT}"`,
    ].join(" ");

    // Run worker in background (non-blocking)
    // Use pnpm exec tsx to ensure TypeScript execution works
    const command = `cd ${projectRoot} && ${envVars} nohup ${pnpmPath} exec tsx ${workerScript} --job-id=${jobId} > /tmp/fine-tuning-${jobId}.log 2>&1 &`;

    logger.info("Executing worker command", { command: command.replace(/DATABASE_URL="[^"]*"/, 'DATABASE_URL="***"'), nodePath, pnpmPath });

    // Execute in background - don't await
    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error("Worker execution error", {
          jobId,
          error: error.message,
          stderr
        });
      } else {
        logger.info("Worker started successfully", { jobId, stdout });
      }
    });

    logger.info("Job processing triggered", { jobId });
  } catch (error: any) {
    logger.error("Failed to trigger job processing", {
      jobId,
      error: error.message
    });
    // Don't throw - we don't want to fail the API request
    // The job will remain PENDING and can be retried
  }
}

/**
 * Alternative: Process job immediately in the same process
 * Use this for testing or if you have sufficient server resources
 */
export async function processJobImmediately(jobId: string): Promise<void> {
  logger.info("Processing job immediately", { jobId });

  try {
    const projectRoot = path.resolve(process.cwd(), "../..");
    const workerScript = path.join(projectRoot, "scripts/fine-tuning-worker.ts");

    const command = `cd ${projectRoot} && npx ts-node ${workerScript} --job-id=${jobId}`;

    logger.info("Executing worker synchronously", { command });

    // This will block until training completes (2-4 hours!)
    // Only use for testing
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    logger.info("Job processing completed", { jobId, stdout });

    if (stderr) {
      logger.warn("Job processing stderr", { jobId, stderr });
    }
  } catch (error: any) {
    logger.error("Job processing failed", {
      jobId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Check if there are any pending jobs and trigger processing
 * Use this with a cron job or periodic check
 */
export async function processPendingJobs(): Promise<void> {
  logger.info("Checking for pending jobs");

  try {
    const projectRoot = path.resolve(process.cwd(), "../..");
    const workerScript = path.join(projectRoot, "scripts/fine-tuning-worker.ts");

    const command = `cd ${projectRoot} && nohup npx ts-node ${workerScript} > /tmp/fine-tuning-worker.log 2>&1 &`;

    logger.info("Executing worker for all pending jobs", { command });

    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error("Worker execution error", {
          error: error.message,
          stderr
        });
      } else {
        logger.info("Worker started successfully", { stdout });
      }
    });

    logger.info("Pending jobs processing triggered");
  } catch (error: any) {
    logger.error("Failed to process pending jobs", {
      error: error.message
    });
  }
}
