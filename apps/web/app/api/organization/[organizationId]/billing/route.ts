import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { getOrganizationBilling } from "@/utils/organization/billing";
import { isOrganizationMember } from "@/utils/organization";
import { can } from "@/utils/organization/rbac";
import { withError } from "@/utils/middleware";

/**
 * GET /api/organization/[organizationId]/billing
 * Get organization billing information
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

    // Only members with billing view permission can see billing
    if (
      !session.organizationRole ||
      !can.viewBilling(session.organizationRole)
    ) {
      return NextResponse.json(
        { error: "You don't have permission to view billing information" },
        { status: 403 },
      );
    }

    const billing = await getOrganizationBilling(organizationId);

    if (!billing) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(billing);
  },
);
