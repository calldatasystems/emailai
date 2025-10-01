import { NextResponse } from "next/server";
import { withEmailAccount } from "@/utils/middleware";
import prisma from "@/utils/prisma";

export type RulesResponse = Awaited<ReturnType<typeof getRules>>;

async function getRules({
  emailAccountId,
  organizationId,
}: {
  emailAccountId: string;
  organizationId?: string;
}) {
  // Build where clause to include organization scope
  // Rules are scoped to email accounts, which are scoped to organizations
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

  return await prisma.rule.findMany({
    where,
    include: {
      actions: true,
      group: { select: { name: true } },
      categoryFilters: { select: { id: true, name: true } },
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export const GET = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;
  const organizationId = request.auth.organizationId;
  const result = await getRules({ emailAccountId, organizationId });
  return NextResponse.json(result);
});
