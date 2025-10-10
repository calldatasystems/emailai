import { NextResponse } from "next/server";
import prisma from "@/utils/prisma";
import { withEmailAccount } from "@/utils/middleware";

export type GroupsResponse = Awaited<ReturnType<typeof getGroups>>;

async function getGroups({
  emailAccountId,
  organizationId,
}: {
  emailAccountId: string;
  organizationId?: string;
}) {
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

  const groups = await prisma.group.findMany({
    where,
    select: {
      id: true,
      name: true,
      rule: { select: { id: true, name: true } },
      _count: { select: { items: true } },
      isShared: true,
      createdBy: true,
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
  return { groups };
}

export const GET = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;
  const organizationId = request.auth.organizationId;
  const result = await getGroups({ emailAccountId, organizationId });
  return NextResponse.json(result);
});
