/**
 * Fine-Tuning Service
 *
 * Handles automatic fine-tuning of AI models for individual users
 * based on their email history.
 */

import { prisma } from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";
import type { FineTuningStatus } from "@prisma/client";

const logger = createScopedLogger("fine-tuning-service");

const MIN_EMAILS_FOR_TRAINING = 100;
const RECOMMENDED_EMAILS = 200;

interface CreateJobOptions {
  userId: string;
  baseModel?: string;
  epochs?: number;
}

interface JobUpdateOptions {
  status?: FineTuningStatus;
  progress?: number;
  currentStep?: string;
  errorMessage?: string;
  modelName?: string;
  trainingEmails?: number;
  executorId?: string;
  executorUrl?: string;
  checkpointPath?: string;
  actualCost?: number;
}

export class FineTuningService {
  /**
   * Check if user is eligible for fine-tuning
   */
  static async isEligibleForFineTuning(userId: string): Promise<{
    eligible: boolean;
    sentEmailCount: number;
    reason?: string;
  }> {
    // Count user's sent emails
    const sentEmailCount = await prisma.emailMessage.count({
      where: {
        emailAccount: {
          userId,
        },
        sent: true,
      },
    });

    if (sentEmailCount < MIN_EMAILS_FOR_TRAINING) {
      return {
        eligible: false,
        sentEmailCount,
        reason: `Need at least ${MIN_EMAILS_FOR_TRAINING} sent emails. Currently have ${sentEmailCount}.`,
      };
    }

    // Check if there's already a pending or in-progress job
    const existingJob = await prisma.fineTuningJob.findFirst({
      where: {
        userId,
        status: {
          in: [
            "PENDING",
            "EXTRACTING_DATA",
            "PREPARING_DATA",
            "PROVISIONING_GPU",
            "TRAINING",
            "EVALUATING",
            "DEPLOYING",
          ],
        },
      },
    });

    if (existingJob) {
      return {
        eligible: false,
        sentEmailCount,
        reason: `Fine-tuning job already in progress (${existingJob.status})`,
      };
    }

    // Check if user already has a completed job from the last 30 days
    const recentCompletedJob = await prisma.fineTuningJob.findFirst({
      where: {
        userId,
        status: "COMPLETED",
        deployedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    if (recentCompletedJob) {
      return {
        eligible: false,
        sentEmailCount,
        reason: "Model was trained within the last 30 days. Wait before re-training.",
      };
    }

    return {
      eligible: true,
      sentEmailCount,
    };
  }

  /**
   * Create a new fine-tuning job
   */
  static async createJob(options: CreateJobOptions) {
    const { userId, baseModel = "llama3.1:8b", epochs = 3 } = options;

    // Check eligibility
    const eligibility = await this.isEligibleForFineTuning(userId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    logger.info("Creating fine-tuning job", { userId, baseModel });

    // Estimate cost (rough estimate: $1-2 for 8B model)
    const costEstimate = baseModel.includes("70b") ? 12.0 : 1.5;

    const job = await prisma.fineTuningJob.create({
      data: {
        userId,
        baseModel,
        epochs,
        costEstimate,
        status: "PENDING",
        currentStep: "Waiting to start",
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    logger.info("Fine-tuning job created", {
      jobId: job.id,
      userId,
      userEmail: job.user.email,
    });

    return job;
  }

  /**
   * Update job status
   */
  static async updateJob(jobId: string, updates: JobUpdateOptions) {
    logger.info("Updating fine-tuning job", { jobId, updates });

    const job = await prisma.fineTuningJob.update({
      where: { id: jobId },
      data: {
        ...updates,
        updatedAt: new Date(),
        ...(updates.status === "COMPLETED" && !updates.modelName
          ? {}
          : updates.status === "COMPLETED"
            ? { deployedAt: new Date() }
            : {}),
      },
    });

    // If completed, update user's aiModel
    if (updates.status === "COMPLETED" && updates.modelName) {
      await prisma.user.update({
        where: { id: job.userId },
        data: {
          aiProvider: "ollama",
          aiModel: updates.modelName,
        },
      });

      logger.info("User AI model updated", {
        userId: job.userId,
        modelName: updates.modelName,
      });
    }

    return job;
  }

  /**
   * Get job status
   */
  static async getJob(jobId: string) {
    return prisma.fineTuningJob.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get all jobs for a user
   */
  static async getUserJobs(userId: string) {
    return prisma.fineTuningJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get active (in-progress) job for user
   */
  static async getActiveJob(userId: string) {
    return prisma.fineTuningJob.findFirst({
      where: {
        userId,
        status: {
          in: [
            "PENDING",
            "EXTRACTING_DATA",
            "PREPARING_DATA",
            "PROVISIONING_GPU",
            "TRAINING",
            "EVALUATING",
            "DEPLOYING",
          ],
        },
      },
    });
  }

  /**
   * Cancel a job
   */
  static async cancelJob(jobId: string) {
    logger.info("Cancelling fine-tuning job", { jobId });

    return prisma.fineTuningJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED",
        currentStep: "Cancelled by user",
      },
    });
  }

  /**
   * Mark job as failed
   */
  static async failJob(jobId: string, errorMessage: string) {
    logger.error("Fine-tuning job failed", { jobId, errorMessage });

    return prisma.fineTuningJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage,
      },
    });
  }

  /**
   * Auto-check if user should be offered fine-tuning
   * Called periodically or after user sends emails
   */
  static async autoCheckAndNotify(userId: string) {
    const eligibility = await this.isEligibleForFineTuning(userId);

    if (!eligibility.eligible) {
      return { shouldNotify: false, ...eligibility };
    }

    // Check if we've already notified them recently
    const recentJob = await prisma.fineTuningJob.findFirst({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    if (recentJob) {
      return {
        shouldNotify: false,
        ...eligibility,
        reason: "User was already notified recently",
      };
    }

    logger.info("User eligible for fine-tuning", {
      userId,
      sentEmailCount: eligibility.sentEmailCount,
    });

    return {
      shouldNotify: true,
      ...eligibility,
      message:
        eligibility.sentEmailCount >= RECOMMENDED_EMAILS
          ? `You have ${eligibility.sentEmailCount} sent emails! Train a personalized AI model to match your writing style.`
          : `You have ${eligibility.sentEmailCount} sent emails. You can now train a personalized AI model! (${RECOMMENDED_EMAILS}+ recommended for best results)`,
    };
  }
}
