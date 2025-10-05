import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { FineTuningService } from "@/utils/ai/fine-tuning/fine-tuning-service";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("api/user/ai/fine-tune");

/**
 * POST /api/user/ai/fine-tune
 * Create a new fine-tuning job for the authenticated user
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { baseModel, epochs } = body;

    logger.info("Fine-tuning job request", {
      userId: session.user.id,
      baseModel,
      epochs,
    });

    // Check eligibility
    const eligibility = await FineTuningService.isEligibleForFineTuning(
      session.user.id,
    );

    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: eligibility.reason,
          sentEmailCount: eligibility.sentEmailCount,
        },
        { status: 400 },
      );
    }

    // Create job
    const job = await FineTuningService.createJob({
      userId: session.user.id,
      baseModel,
      epochs,
    });

    // TODO: Trigger the actual fine-tuning process
    // This could be:
    // 1. A webhook to a separate worker service
    // 2. A message to a queue (Redis, SQS, etc.)
    // 3. A GitHub Action trigger
    // 4. A Vast.ai API call
    //
    // For now, we just create the job record
    // The actual training would be handled by a separate service

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        estimatedCost: job.costEstimate,
      },
    });
  } catch (error: any) {
    logger.error("Failed to create fine-tuning job", { error });
    return NextResponse.json(
      { error: error.message || "Failed to create fine-tuning job" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/user/ai/fine-tune
 * Get fine-tuning job status and history
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      // Get specific job
      const job = await FineTuningService.getJob(jobId);

      if (!job || job.userId !== session.user.id) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      return NextResponse.json({ job });
    }

    // Get all jobs for user
    const jobs = await FineTuningService.getUserJobs(session.user.id);
    const activeJob = await FineTuningService.getActiveJob(session.user.id);
    const eligibility = await FineTuningService.isEligibleForFineTuning(
      session.user.id,
    );

    return NextResponse.json({
      jobs,
      activeJob,
      eligibility: {
        eligible: eligibility.eligible,
        sentEmailCount: eligibility.sentEmailCount,
        reason: eligibility.reason,
      },
    });
  } catch (error: any) {
    logger.error("Failed to get fine-tuning status", { error });
    return NextResponse.json(
      { error: error.message || "Failed to get fine-tuning status" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/ai/fine-tune
 * Cancel a fine-tuning job
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 },
      );
    }

    // Verify ownership
    const job = await FineTuningService.getJob(jobId);
    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Cancel job
    const cancelledJob = await FineTuningService.cancelJob(jobId);

    return NextResponse.json({
      success: true,
      job: cancelledJob,
    });
  } catch (error: any) {
    logger.error("Failed to cancel fine-tuning job", { error });
    return NextResponse.json(
      { error: error.message || "Failed to cancel fine-tuning job" },
      { status: 500 },
    );
  }
}
