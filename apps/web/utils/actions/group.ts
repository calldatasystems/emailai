"use server";

import { z } from "zod";
import prisma from "@/utils/prisma";
import {
  addGroupItemBody,
  createGroupBody,
} from "@/utils/actions/group.validation";
import { addGroupItem, deleteGroupItem } from "@/utils/group/group-item";
import { actionClient } from "@/utils/actions/safe-action";

export const createGroupAction = actionClient
  .metadata({ name: "createGroup" })
  .schema(createGroupBody)
  .action(async ({ ctx: { emailAccountId }, parsedInput: { ruleId } }) => {
    const rule = await prisma.rule.findUnique({
      where: { id: ruleId, emailAccountId },
      select: { name: true, groupId: true },
    });
    if (rule?.groupId) return { groupId: rule.groupId };
    if (!rule) return { error: "Rule not found" };

    const group = await prisma.group.create({
      data: {
        name: rule.name,
        emailAccountId,
        rule: {
          connect: { id: ruleId },
        },
      },
    });

    return { groupId: group.id };
  });

export const addGroupItemAction = actionClient
  .metadata({ name: "addGroupItem" })
  .schema(addGroupItemBody)
  .action(
    async ({
      ctx: { emailAccountId },
      parsedInput: { groupId, type, value },
    }) => {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });
      if (!group) return { error: "Group not found" };
      if (group.emailAccountId !== emailAccountId)
        return {
          error: "You don't have permission to add items to this group",
        };

      await addGroupItem({ groupId, type, value });
    },
  );

export const deleteGroupItemAction = actionClient
  .metadata({ name: "deleteGroupItem" })
  .schema(z.object({ id: z.string() }))
  .action(async ({ ctx: { emailAccountId }, parsedInput: { id } }) => {
    await deleteGroupItem({ id, emailAccountId });
  });
