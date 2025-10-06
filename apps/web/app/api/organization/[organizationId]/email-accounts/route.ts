import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { getOrganizationEmailAccounts } from "@/utils/organization/email-accounts";
import { isOrganizationMember } from "@/utils/organization";
import { withError } from "@/utils/middleware";

/**
 * GET /api/organization/[organizationId]/email-accounts
 * Get all email accounts for an organization
 */
export const GET = withError(
  async (
    _request: Request,
    context: { params: Promise<{ organizationId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await context.params;

    // Verify user is a member
    const isMember = await isOrganizationMember(
      session.user.id,
      organizationId,
    );
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const emailAccounts = await getOrganizationEmailAccounts(organizationId);

    return NextResponse.json({ emailAccounts });
  },
);
