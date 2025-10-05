/**
 * Auto-check fine-tuning eligibility
 *
 * This module automatically checks if users are eligible for fine-tuning
 * after they send emails or at regular intervals.
 */

import { prisma } from "@/utils/prisma";
import { FineTuningService } from "./fine-tuning-service";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("auto-check-eligibility");

/**
 * Check eligibility after user sends an email
 * Call this from the Gmail webhook handler or send email action
 */
export async function checkEligibilityAfterEmailSent(userId: string) {
  try {
    // Check every 10 emails sent to avoid excessive checks
    const sentEmailCount = await prisma.emailMessage.count({
      where: {
        emailAccount: { userId },
        isSent: true,
      },
    });

    // Only check at milestones: 100, 110, 120, ... 200, 220, 240, etc.
    if (sentEmailCount < 100 || sentEmailCount % 10 !== 0) {
      return null;
    }

    logger.info("Checking fine-tuning eligibility", {
      userId,
      sentEmailCount,
    });

    const result = await FineTuningService.autoCheckAndNotify(userId);

    if (result.shouldNotify) {
      // Store notification flag in database
      // The UI can then show a banner/toast to the user
      await prisma.user.update({
        where: { id: userId },
        data: {
          errorMessages: {
            fineTuningEligible: {
              timestamp: new Date().toISOString(),
              sentEmailCount: result.sentEmailCount,
              message: result.message,
            },
          },
        },
      });

      logger.info("User notified of fine-tuning eligibility", {
        userId,
        sentEmailCount: result.sentEmailCount,
      });

      return result;
    }

    return null;
  } catch (error) {
    logger.error("Failed to check eligibility", { userId, error });
    return null;
  }
}

/**
 * Batch check all users who might be eligible
 * Run this as a daily cron job
 */
export async function batchCheckEligibility() {
  logger.info("Starting batch eligibility check");

  try {
    // Find users with 100+ sent emails who don't have an active job or recent model
    const candidateUsers = await prisma.$queryRaw<{ userId: string }[]>`
      SELECT DISTINCT ea."userId" as "userId"
      FROM "EmailMessage" em
      JOIN "EmailAccount" ea ON em."emailAccountId" = ea.id
      WHERE em."isSent" = true
      GROUP BY ea."userId"
      HAVING COUNT(*) >= 100
    `;

    logger.info("Found candidate users", { count: candidateUsers.length });

    let notifiedCount = 0;

    for (const { userId } of candidateUsers) {
      const result = await FineTuningService.autoCheckAndNotify(userId);

      if (result.shouldNotify) {
        // Store notification
        await prisma.user.update({
          where: { id: userId },
          data: {
            errorMessages: {
              fineTuningEligible: {
                timestamp: new Date().toISOString(),
                sentEmailCount: result.sentEmailCount,
                message: result.message,
              },
            },
          },
        });

        notifiedCount++;
      }

      // Rate limit: wait 100ms between users
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info("Batch eligibility check completed", {
      totalUsers: candidateUsers.length,
      notified: notifiedCount,
    });

    return { totalUsers: candidateUsers.length, notified: notifiedCount };
  } catch (error) {
    logger.error("Batch eligibility check failed", { error });
    throw error;
  }
}
