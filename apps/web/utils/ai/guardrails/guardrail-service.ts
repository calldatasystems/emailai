/**
 * Auto-Send Guardrail Service
 *
 * Evaluates whether an email should be auto-sent or held for review
 * based on user-defined natural language guardrails.
 */

import { prisma } from "@/utils/prisma";
import { chatCompletionObject } from "@/utils/llms";
import { createScopedLogger } from "@/utils/logger";
import type { EmailAccountWithAI } from "@/utils/llms/types";
import { GuardrailSeverity } from "@prisma/client";
import { z } from "zod";

const logger = createScopedLogger("guardrail-service");

const evaluationSchema = z.object({
  shouldBlock: z.boolean(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  triggeredGuardrails: z.array(z.string()), // IDs of triggered guardrails
});

interface EmailContext {
  subject: string;
  body: string;
  recipient: string;
  threadId: string;
  messageId?: string;
  isReply: boolean;
  previousEmails?: Array<{
    from: string;
    body: string;
  }>;
}

interface GuardrailEvaluationResult {
  canAutoSend: boolean;
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

export class GuardrailService {
  /**
   * Evaluate if an email can be auto-sent
   */
  static async evaluateEmail(
    userId: string,
    organizationId: string | null,
    emailContext: EmailContext,
    emailAccount: EmailAccountWithAI,
  ): Promise<GuardrailEvaluationResult> {
    logger.info("Evaluating email against guardrails", {
      userId,
      organizationId,
      threadId: emailContext.threadId,
    });

    // Get active guardrails for user and organization
    const guardrails = await this.getActiveGuardrails(userId, organizationId);

    if (guardrails.length === 0) {
      logger.info("No guardrails configured, allowing auto-send");
      return {
        canAutoSend: true,
        blockedBy: [],
        warnings: [],
      };
    }

    // Evaluate email against each guardrail
    const results = await this.evaluateAgainstGuardrails(
      guardrails,
      emailContext,
      emailAccount,
    );

    // Determine if email can be sent
    const blockedGuardrails = results.filter((r) => r.triggered && r.guardrail.severity === "BLOCK");
    const warningGuardrails = results.filter((r) => r.triggered && r.guardrail.severity === "WARN");

    const canAutoSend = blockedGuardrails.length === 0;

    // Log violations
    for (const result of results) {
      if (result.triggered) {
        await this.logViolation(
          result.guardrail.id,
          emailContext,
          result.reasoning,
          result.confidence,
        );

        // Update guardrail statistics
        await prisma.autoSendGuardrail.update({
          where: { id: result.guardrail.id },
          data: {
            triggeredCount: { increment: 1 },
            lastTriggered: new Date(),
          },
        });
      }
    }

    logger.info("Guardrail evaluation complete", {
      canAutoSend,
      blockedCount: blockedGuardrails.length,
      warningCount: warningGuardrails.length,
    });

    return {
      canAutoSend,
      blockedBy: blockedGuardrails.map((r) => ({
        guardrail: {
          id: r.guardrail.id,
          name: r.guardrail.name,
          description: r.guardrail.description,
          action: r.guardrail.action,
        },
        reasoning: r.reasoning,
        confidence: r.confidence,
      })),
      warnings: warningGuardrails.map((r) => ({
        guardrail: {
          id: r.guardrail.id,
          name: r.guardrail.name,
          description: r.guardrail.description,
        },
        reasoning: r.reasoning,
      })),
    };
  }

  /**
   * Get active guardrails for user/organization
   */
  private static async getActiveGuardrails(
    userId: string,
    organizationId: string | null,
  ) {
    const where = {
      enabled: true,
      OR: [
        { userId },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    };

    return prisma.autoSendGuardrail.findMany({
      where,
      orderBy: { priority: "desc" }, // Higher priority first
    });
  }

  /**
   * Evaluate email against all guardrails using AI
   */
  private static async evaluateAgainstGuardrails(
    guardrails: any[],
    emailContext: EmailContext,
    emailAccount: EmailAccountWithAI,
  ) {
    const results = [];

    for (const guardrail of guardrails) {
      // Check scope
      if (!this.isInScope(guardrail, emailContext)) {
        continue;
      }

      // Use AI to evaluate this specific guardrail
      const evaluation = await this.evaluateSingleGuardrail(
        guardrail,
        emailContext,
        emailAccount,
      );

      results.push({
        guardrail,
        triggered: evaluation.shouldBlock,
        reasoning: evaluation.reasoning,
        confidence: evaluation.confidence,
      });
    }

    return results;
  }

  /**
   * Check if guardrail applies to this email based on scope
   */
  private static isInScope(guardrail: any, emailContext: EmailContext): boolean {
    const recipientDomain = emailContext.recipient.split("@")[1];

    switch (guardrail.appliesTo) {
      case "ALL":
        return true;

      case "EXTERNAL_ONLY":
        // Check if recipient is external (different domain than sender)
        // This would need sender domain info
        return true; // Simplified for now

      case "INTERNAL_ONLY":
        // Check if recipient is internal (same domain)
        return true; // Simplified for now

      case "SPECIFIC_DOMAINS":
        // Check if in examples.domains array
        const domains = guardrail.examples?.domains || [];
        return domains.includes(recipientDomain);

      default:
        return true;
    }
  }

  /**
   * Evaluate a single guardrail using AI
   */
  private static async evaluateSingleGuardrail(
    guardrail: any,
    emailContext: EmailContext,
    emailAccount: EmailAccountWithAI,
  ) {
    const system = `You are a guardrail evaluator for email auto-sending. Your job is to determine if an email violates a specific guardrail rule.

Be strict but fair. Only block emails that clearly violate the guardrail. When in doubt, allow the email.

Return your evaluation with:
- shouldBlock: true if the email violates the guardrail
- reasoning: Brief explanation of why (1-2 sentences)
- confidence: 0-1 score of how confident you are`;

    const prompt = `Evaluate if this email violates the following guardrail:

**Guardrail Rule:**
${guardrail.name}: ${guardrail.description}

**Email to Evaluate:**
To: ${emailContext.recipient}
Subject: ${emailContext.subject}

${emailContext.body}

${
  emailContext.previousEmails && emailContext.previousEmails.length > 0
    ? `**Context (Previous Emails in Thread):**
${emailContext.previousEmails
  .map((e) => `From ${e.from}:\n${e.body}`)
  .join("\n\n")}
`
    : ""
}

${
  guardrail.examples
    ? `**Examples of emails that SHOULD be blocked:**
${JSON.stringify(guardrail.examples, null, 2)}
`
    : ""
}

Does this email violate the guardrail? Should it be blocked from auto-sending?`;

    logger.trace("Evaluating guardrail", {
      guardrailId: guardrail.id,
      guardrailName: guardrail.name,
    });

    try {
      const result = await chatCompletionObject({
        userAi: emailAccount.user,
        system,
        prompt,
        schema: evaluationSchema,
        userEmail: emailAccount.email,
        usageLabel: "Guardrail Evaluation",
        useEconomyModel: true, // Use cheaper model for guardrails
      });

      logger.trace("Guardrail evaluation result", {
        guardrailId: guardrail.id,
        shouldBlock: result.object.shouldBlock,
        confidence: result.object.confidence,
      });

      return result.object;
    } catch (error) {
      logger.error("Failed to evaluate guardrail", {
        guardrailId: guardrail.id,
        error,
      });

      // On error, be conservative and block
      return {
        shouldBlock: true,
        reasoning: "Error evaluating guardrail - blocking as a precaution",
        confidence: 0.5,
        triggeredGuardrails: [guardrail.id],
      };
    }
  }

  /**
   * Log a guardrail violation
   */
  private static async logViolation(
    guardrailId: string,
    emailContext: EmailContext,
    reasoning: string,
    confidence: number,
  ) {
    await prisma.autoSendViolation.create({
      data: {
        guardrailId,
        threadId: emailContext.threadId,
        messageId: emailContext.messageId,
        emailSubject: emailContext.subject,
        emailPreview: emailContext.body.substring(0, 500),
        aiReasoning: reasoning,
        confidence,
      },
    });
  }

  /**
   * Get default guardrails (recommended templates)
   */
  static getDefaultGuardrails() {
    return [
      {
        name: "Date/Time Commitment Check",
        description:
          "Do not auto-send if the recipient is asking for a specific date, time, or meeting commitment. Hold for user review to ensure availability.",
        severity: GuardrailSeverity.BLOCK,
        action: "HOLD_FOR_REVIEW",
        priority: 100,
        examples: {
          shouldBlock: [
            "When are you available next week?",
            "Can we schedule a call on Tuesday?",
            "What time works for you?",
          ],
        },
      },
      {
        name: "Objectionable Language Check",
        description:
          "Do not auto-send if the email contains profanity, offensive language, or inappropriate content.",
        severity: GuardrailSeverity.BLOCK,
        action: "HOLD_FOR_REVIEW",
        priority: 200,
      },
      {
        name: "Financial Commitment Check",
        description:
          "Do not auto-send if the recipient is asking about pricing, contracts, or financial commitments. Hold for review.",
        severity: GuardrailSeverity.BLOCK,
        action: "HOLD_FOR_REVIEW",
        priority: 90,
        examples: {
          shouldBlock: [
            "What's your pricing?",
            "Can you send over a contract?",
            "How much does this cost?",
          ],
        },
      },
      {
        name: "Sensitive Topic Check",
        description:
          "Do not auto-send if the email discusses sensitive topics like legal matters, HR issues, or confidential information.",
        severity: GuardrailSeverity.BLOCK,
        action: "HOLD_FOR_REVIEW",
        priority: 150,
      },
      {
        name: "Request for Detailed Information",
        description:
          "Warn if the recipient is asking for detailed technical information or specifications that may require careful review.",
        severity: GuardrailSeverity.WARN,
        action: "ASK_USER",
        priority: 50,
      },
      {
        name: "First-Time Contact",
        description:
          "Warn when replying to someone for the first time to ensure appropriate tone and content.",
        severity: GuardrailSeverity.WARN,
        action: "ASK_USER",
        priority: 40,
      },
    ];
  }

  /**
   * Create default guardrails for a user
   */
  static async createDefaultGuardrails(
    userId: string,
    organizationId?: string,
  ) {
    const defaults = this.getDefaultGuardrails();

    for (const guardrail of defaults) {
      await prisma.autoSendGuardrail.create({
        data: {
          ...guardrail,
          userId,
          organizationId,
        },
      });
    }

    logger.info("Created default guardrails", { userId, count: defaults.length });
  }
}
