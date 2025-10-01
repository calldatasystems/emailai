import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { getOrganizationMembership } from "@/utils/organization";
import { withError } from "@/utils/middleware";

const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1),
});

/**
 * POST /api/user/organization/switch
 * Switch the user's active organization
 */
export const POST = withError(async (request: Request) => {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { organizationId } = switchOrganizationSchema.parse(body);

  // Verify user is a member of the organization
  const membership = await getOrganizationMembership(
    session.user.id,
    organizationId,
  );

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this organization" },
      { status: 403 },
    );
  }

  // Return organization context for session update
  return NextResponse.json({
    organizationId: membership.organization.id,
    organizationSlug: membership.organization.slug,
    organizationRole: membership.role,
  });
});
