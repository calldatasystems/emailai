/**
 * Email Data Extractor
 *
 * Extracts and formats email data for LoRA fine-tuning.
 * Focuses on user's sent emails to learn their writing style.
 */

import { prisma } from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("email-data-extractor");

export interface TrainingEmail {
  id: string;
  threadId: string;
  messageId: string;
  from: string;
  to: string;
  date: Date;
  content?: string; // Email body text (if available)
}

export interface TrainingDataset {
  emails: TrainingEmail[];
  totalCount: number;
  userId: string;
  extractedAt: Date;
}

export interface ExtractionOptions {
  userId: string;
  minEmails?: number;
  maxEmails?: number;
  startDate?: Date;
  endDate?: Date;
}

export class EmailDataExtractor {
  /**
   * Extract sent emails for training
   */
  static async extractTrainingData(
    options: ExtractionOptions
  ): Promise<TrainingDataset> {
    const {
      userId,
      minEmails = 100,
      maxEmails = 1000,
      startDate,
      endDate,
    } = options;

    logger.info("Extracting training data", { userId, minEmails, maxEmails });

    // Build query filters
    const whereClause: any = {
      emailAccount: {
        userId,
      },
      sent: true,
      draft: false,
    };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }

    // Count total sent emails
    const totalCount = await prisma.emailMessage.count({
      where: whereClause,
    });

    logger.info("Found sent emails", { userId, totalCount });

    if (totalCount < minEmails) {
      logger.warn("Insufficient emails for training", {
        userId,
        totalCount,
        minEmails,
      });
      throw new Error(
        `Insufficient training data. Found ${totalCount} emails, need at least ${minEmails}.`
      );
    }

    // Fetch emails (limit to maxEmails)
    const emails = await prisma.emailMessage.findMany({
      where: whereClause,
      orderBy: {
        date: "desc",
      },
      take: maxEmails,
      select: {
        id: true,
        threadId: true,
        messageId: true,
        from: true,
        to: true,
        date: true,
      },
    });

    logger.info("Extracted training emails", {
      userId,
      extractedCount: emails.length,
      totalCount,
    });

    return {
      emails,
      totalCount,
      userId,
      extractedAt: new Date(),
    };
  }

  /**
   * Get statistics about available training data
   */
  static async getTrainingDataStats(userId: string) {
    const sentEmailCount = await prisma.emailMessage.count({
      where: {
        emailAccount: {
          userId,
        },
        sent: true,
        draft: false,
      },
    });

    // Get date range
    const oldestEmail = await prisma.emailMessage.findFirst({
      where: {
        emailAccount: {
          userId,
        },
        sent: true,
        draft: false,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
      },
    });

    const newestEmail = await prisma.emailMessage.findFirst({
      where: {
        emailAccount: {
          userId,
        },
        sent: true,
        draft: false,
      },
      orderBy: {
        date: "desc",
      },
      select: {
        date: true,
      },
    });

    return {
      totalSentEmails: sentEmailCount,
      dateRange: {
        oldest: oldestEmail?.date,
        newest: newestEmail?.date,
      },
      isEligible: sentEmailCount >= 100,
      recommendedForTraining: Math.min(sentEmailCount, 1000),
    };
  }

  /**
   * Extract emails by time period (useful for incremental training)
   */
  static async extractByTimePeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TrainingDataset> {
    return this.extractTrainingData({
      userId,
      startDate,
      endDate,
      minEmails: 0, // Allow any amount for incremental training
      maxEmails: 1000,
    });
  }

  /**
   * Extract recent emails (last N months)
   */
  static async extractRecentEmails(
    userId: string,
    months: number = 6
  ): Promise<TrainingDataset> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return this.extractTrainingData({
      userId,
      startDate,
      minEmails: 100,
      maxEmails: 1000,
    });
  }
}
