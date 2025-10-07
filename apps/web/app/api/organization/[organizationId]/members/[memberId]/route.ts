import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import {
  removeOrganizationMember,
  isOrganizationMember,
} from "@/utils/organization";
import { can } from "@/utils/organization/rbac";
import { withError } from "@/utils/middleware";
import prisma from "@/utils/prisma";

/**
 * DELETE /api/organization/[organizationId]/members/[memberId]
 * Remove a member from an organization
 */
export const DELETE = withError(
  async (
    _request: Request,
    context: {
      params: Promise<Record<string, string>>;
    },
  ) => {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, memberId } = await context.params;

    // Verify user is a member
    const isMember = await isOrganizationMember(
      session.user.id,
      organizationId,
    );
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user has permission to remove members
    if (
      !session.organizationRole ||
      !can.removeMembers(session.organizationRole)
    ) {
      return NextResponse.json(
        { error: "You don't have permission to remove members" },
        { status: 403 },
      );
    }

    // Get the member to be removed
    const memberToRemove = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      select: { userId: true, role: true },
    });

    if (!memberToRemove) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot remove yourself
    if (memberToRemove.userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the organization" },
        { status: 400 },
      );
    }

    // Cannot remove owners (unless you're also an owner)
    if (
      memberToRemove.role === "OWNER" &&
      session.organizationRole !== "OWNER"
    ) {
      return NextResponse.json(
        { error: "You cannot remove organization owners" },
        { status: 403 },
      );
    }

    await removeOrganizationMember(organizationId, memberToRemove.userId);

    return NextResponse.json({ success: true });
  },
);
