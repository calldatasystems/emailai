import { NextResponse } from "next/server";
import prisma from "@/utils/prisma";
import { withAuth } from "@/utils/middleware";

export type GetEmailAccountsResponse = Awaited<
  ReturnType<typeof getEmailAccounts>
>;

async function getEmailAccounts({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId?: string;
}) {
  // Build where clause to include organization scope
  const where = organizationId
    ? {
        // For org members: show all email accounts in the organization
        organizationId,
      }
    : {
        // Fallback: show user's personal accounts (backwards compatibility)
        userId,
      };

  const emailAccounts = await prisma.emailAccount.findMany({
    where,
    select: {
      id: true,
      email: true,
      accountId: true,
      name: true,
      image: true,
      organizationId: true,
      user: {
        select: {
          name: true,
          image: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const accountsWithNames = emailAccounts.map((account) => {
    // Old accounts don't have a name attached, so use the name from the user
    if (account.user.email === account.email) {
      return {
        ...account,
        name: account.name || account.user.name,
        image: account.image || account.user.image,
        isPrimary: true,
      };
    }

    return { ...account, isPrimary: false };
  });

  return { emailAccounts: accountsWithNames };
}

export const GET = withAuth(async (request) => {
  const userId = request.auth.userId;
  const organizationId = request.auth.organizationId;
  const result = await getEmailAccounts({ userId, organizationId });
  return NextResponse.json(result);
});
