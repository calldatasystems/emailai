import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { getOrganization, isOrganizationMember } from "@/utils/organization";
import { withError } from "@/utils/middleware";

/**
 * GET /api/organization/[organizationId]/members
 * Get all members of an organization
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

    const organization = await getOrganization(organizationId, {
      members: true,
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Return members with their user info and role
    const members = organization.members.map((member) => ({
      id: member.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      role: member.role,
    }));

    return NextResponse.json(members);
  },
);
