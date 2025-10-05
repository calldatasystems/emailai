/**
 * Check guardrails before auto-sending emails
 */

import { GuardrailService } from "./guardrail-service";
import type { EmailForAction } from "@/utils/ai/types";
import type { EmailAccountWithAI } from "@/utils/llms/types";
import { createScopedLogger } from "@/utils/logger";
import { prisma } from "@/utils/prisma";

const logger = createScopedLogger("guardrails-check");

interface CheckGuardrailsOptions {
  userId: string;
  organizationId: string | null;
  emailAccount: EmailAccountWithAI;
  email: EmailForAction;
  draftContent: string;
  actionType: "REPLY" | "SEND_EMAIL";
}

export interface GuardrailCheckResult {
  canSend: boolean;
  shouldHoldForReview: boolean;
  blockedBy: Array<{
    guardrail: {
      id: string;
      name: string;
      description: string;
      action: string;
    };
    reasoning: string;
    confidence: number;
  }>;
  warnings: Array<{
    guardrail: {
      id: string;
      name: string;
      description: string;
    };
    reasoning: string;
  }>;
}

/**
 * Check if an email can be auto-sent based on guardrails
 */
export async function checkGuardrailsBeforeSend(
  options: CheckGuardrailsOptions,
): Promise<GuardrailCheckResult> {
  const { userId, organizationId, emailAccount, email, draftContent, actionType } = options;

  logger.info("Checking guardrails before send", {
    userId,
    threadId: email.threadId,
    actionType,
  });

  try {
    // Extract email context
    const emailContext = {
      subject: email.headers.subject || "",
      body: draftContent,
      recipient: email.headers.from, // We're replying to the sender
      threadId: email.threadId,
      messageId: email.id,
      isReply: actionType === "REPLY",
      previousEmails: email.snippet ? [{ from: email.headers.from, body: email.snippet }] : undefined,
    };

    // Evaluate against guardrails
    const result = await GuardrailService.evaluateEmail(
      userId,
      organizationId,
      emailContext,
      emailAccount,
    );

    logger.info("Guardrail evaluation complete", {
      canAutoSend: result.canAutoSend,
      blockedCount: result.blockedBy.length,
      warningCount: result.warnings.length,
    });

    // Determine if we should hold for review
    const shouldHoldForReview = result.blockedBy.some(
      (b) => b.guardrail.action === "HOLD_FOR_REVIEW",
    );

    return {
      canSend: result.canAutoSend,
      shouldHoldForReview,
      blockedBy: result.blockedBy,
      warnings: result.warnings,
    };
  } catch (error) {
    logger.error("Failed to check guardrails", { error });

    // On error, be conservative and block
    return {
      canSend: false,
      shouldHoldForReview: true,
      blockedBy: [
        {
          guardrail: {
            id: "error",
            name: "System Error",
            description: "An error occurred while checking guardrails",
            action: "HOLD_FOR_REVIEW",
          },
          reasoning: "Failed to evaluate guardrails due to system error",
          confidence: 1.0,
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Convert auto-send action to draft if guardrails block it
 */
export async function convertToDraftIfBlocked(
  checkResult: GuardrailCheckResult,
  executedRuleId: string,
): Promise<void> {
  if (!checkResult.shouldHoldForReview) return;

  logger.info("Converting auto-send to draft due to guardrails", {
    executedRuleId,
    blockedBy: checkResult.blockedBy.map((b) => b.guardrail.name),
  });

  // Update the executed rule to show it was blocked
  await prisma.executedRule.update({
    where: { id: executedRuleId },
    data: {
      automated: false, // Mark as non-automated since we're holding it
      reason: `Held for review by guardrails: ${checkResult.blockedBy
        .map((b) => b.guardrail.name)
        .join(", ")}`,
    },
  });
}

/**
 * Check if user has any active guardrails
 */
export async function hasActiveGuardrails(
  userId: string,
  organizationId: string | null,
): Promise<boolean> {
  const count = await prisma.autoSendGuardrail.count({
    where: {
      enabled: true,
      OR: [
        { userId },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
  });

  return count > 0;
}
