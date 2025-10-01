import { NextResponse } from "next/server";
import prisma from "@/utils/prisma";
import { withEmailAccount } from "@/utils/middleware";
import type { Knowledge } from "@prisma/client";

export type GetKnowledgeResponse = {
  items: Knowledge[];
};

export const GET = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;
  const organizationId = request.auth.organizationId;

  // Build where clause to include organization scope
  const where = organizationId
    ? {
        emailAccountId,
        emailAccount: {
          organizationId, // Ensure the email account belongs to the org
        },
      }
    : {
        // Fallback: just filter by email account (backwards compatibility)
        emailAccountId,
      };

  const items = await prisma.knowledge.findMany({
    where,
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result: GetKnowledgeResponse = { items };

  return NextResponse.json(result);
});
