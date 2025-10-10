import type { gmail_v1 } from "@googleapis/gmail";
import { runActionFunction } from "@/utils/ai/actions";
import prisma from "@/utils/prisma";
import type { Prisma } from "@prisma/client";
import { ExecutedRuleStatus, ActionType } from "@prisma/client";
import { createScopedLogger } from "@/utils/logger";
import type { ParsedMessage } from "@/utils/types";
import { updateExecutedActionWithDraftId } from "@/utils/ai/choose-rule/draft-management";
import {
  checkGuardrailsBeforeSend,
  convertToDraftIfBlocked,
} from "@/utils/ai/guardrails/check-before-send";
import type { EmailAccountWithAI } from "@/utils/llms/types";

type ExecutedRuleWithActionItems = Prisma.ExecutedRuleGetPayload<{
  include: { actionItems: true };
}>;

/**
 * Executes actions for a rule that has been applied to an email message.
 * This function:
 * 1. Updates the executed rule status from PENDING to APPLYING
 * 2. Processes each action item associated with the rule
 * 3. Handles reply tracking if this is a reply tracking rule
 * 4. Updates the rule status to APPLIED when complete
 */
export async function executeAct({
  gmail,
  executedRule,
  userEmail,
  userId,
  emailAccountId,
  message,
  emailAccount,
}: {
  gmail: gmail_v1.Gmail;
  executedRule: ExecutedRuleWithActionItems;
  message: ParsedMessage;
  userEmail: string;
  userId: string;
  emailAccountId: string;
  emailAccount?: EmailAccountWithAI;
}) {
  const logger = createScopedLogger("ai-execute-act").with({
    email: userEmail,
    executedRuleId: executedRule.id,
    ruleId: executedRule.ruleId,
    threadId: executedRule.threadId,
    messageId: executedRule.messageId,
  });

  const pendingRules = await prisma.executedRule.updateMany({
    where: { id: executedRule.id, status: ExecutedRuleStatus.PENDING },
    data: { status: ExecutedRuleStatus.APPLYING },
  });

  if (pendingRules.count === 0) {
    logger.info("Executed rule is not pending or does not exist");
    return;
  }

  for (const action of executedRule.actionItems) {
    try {
      // Check guardrails before sending/replying
      if (
        emailAccount &&
        (action.type === ActionType.REPLY || action.type === ActionType.SEND_EMAIL)
      ) {
        const checkResult = await checkGuardrailsBeforeSend({
          userId,
          organizationId: emailAccount.organizationId || null,
          emailAccount,
          email: message,
          draftContent: (action as any).content || "",
          actionType: action.type,
        });

        if (!checkResult.canSend) {
          logger.info("Email blocked by guardrails", {
            blockedBy: checkResult.blockedBy.map((b) => b.guardrail.name),
          });

          // Convert to draft instead of sending
          const draftAction = {
            ...action,
            type: ActionType.DRAFT_EMAIL,
          };

          const actionResult = await runActionFunction({
            gmail,
            email: message,
            action: draftAction,
            userEmail,
            userId,
            emailAccountId,
            executedRule,
          });

          if (actionResult?.draftId) {
            await updateExecutedActionWithDraftId({
              actionId: action.id,
              draftId: actionResult.draftId,
              logger,
            });
          }

          // Mark execution as held for review
          await convertToDraftIfBlocked(checkResult, executedRule.id);

          continue;
        }

        if (checkResult.warnings.length > 0) {
          logger.warn("Email has guardrail warnings", {
            warnings: checkResult.warnings.map((w) => w.guardrail.name),
          });
        }
      }

      const actionResult = await runActionFunction({
        gmail,
        email: message,
        action,
        userEmail,
        userId,
        emailAccountId,
        executedRule,
      });

      if (action.type === ActionType.DRAFT_EMAIL && actionResult?.draftId) {
        await updateExecutedActionWithDraftId({
          actionId: action.id,
          draftId: actionResult.draftId,
          logger,
        });
      }
    } catch (error) {
      await prisma.executedRule.update({
        where: { id: executedRule.id },
        data: { status: ExecutedRuleStatus.ERROR },
      });
      throw error;
    }
  }

  await prisma.executedRule
    .update({
      where: { id: executedRule.id },
      data: { status: ExecutedRuleStatus.APPLIED },
    })
    .catch((error) => {
      logger.error("Failed to update executed rule", { error });
    });
}
