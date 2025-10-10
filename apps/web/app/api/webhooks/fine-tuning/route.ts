import { NextResponse } from "next/server";
import { FineTuningService } from "@/utils/ai/fine-tuning/fine-tuning-service";
import { createScopedLogger } from "@/utils/logger";
import type { FineTuningStatus } from "@prisma/client";
import { env } from "@/env";

const logger = createScopedLogger("webhooks/fine-tuning");

/**
 * POST /api/webhooks/fine-tuning
 *
 * Webhook endpoint for receiving fine-tuning job status updates
 * from the training service (e.g., Vast.ai instance, worker service, GitHub Action)
 *
 * Expected payload:
 * {
 *   jobId: string;
 *   status: FineTuningStatus;
 *   progress?: number;
 *   currentStep?: string;
 *   errorMessage?: string;
 *   modelName?: string;
 *   trainingEmails?: number;
 *   executorId?: string;
 *   checkpointPath?: string;
 *   actualCost?: number;
 * }
 */
export async function POST(request: Request) {
  try {
    // Verify webhook signature/token
    const authHeader = request.headers.get("authorization");
    const webhookSecret = env.INTERNAL_API_KEY;

    if (!webhookSecret) {
      logger.error("INTERNAL_API_KEY not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${webhookSecret}`) {
      logger.warn("Invalid webhook authentication");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const payload = await request.json();
    const {
      jobId,
      status,
      progress,
      currentStep,
      errorMessage,
      modelName,
      trainingEmails,
      executorId,
      executorUrl,
      checkpointPath,
      actualCost,
    } = payload;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 },
      );
    }

    logger.info("Received fine-tuning job update", {
      jobId,
      status,
      progress,
      currentStep,
    });

    // Verify job exists
    const job = await FineTuningService.getJob(jobId);
    if (!job) {
      logger.warn("Job not found", { jobId });
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Update job
    const updatedJob = await FineTuningService.updateJob(jobId, {
      status: status as FineTuningStatus,
      progress,
      currentStep,
      errorMessage,
      modelName,
      trainingEmails,
      executorId,
      executorUrl,
      checkpointPath,
      actualCost,
    });

    logger.info("Fine-tuning job updated", {
      jobId,
      status: updatedJob.status,
      modelName: updatedJob.modelName,
    });

    // TODO: Send notification to user
    // - Email notification on completion/failure
    // - Push notification
    // - In-app notification

    return NextResponse.json({
      success: true,
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        progress: updatedJob.progress,
      },
    });
  } catch (error: any) {
    logger.error("Failed to process fine-tuning webhook", { error });
    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 },
    );
  }
}
