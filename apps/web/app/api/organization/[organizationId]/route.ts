import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import {
  getOrganization,
  updateOrganization,
  deleteOrganization,
  isOrganizationMember,
} from "@/utils/organization";
import { can } from "@/utils/organization/rbac";
import { withError } from "@/utils/middleware";

const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

/**
 * GET /api/organization/[organizationId]
 * Get organization details
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
      emailAccounts: true,
      premium: true,
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(organization);
  },
);

/**
 * PATCH /api/organization/[organizationId]
 * Update organization details
 */
export const PATCH = withError(
  async (
    request: Request,
    context: { params: Promise<{ organizationId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await context.params;

    // Verify user has permission
    const isMember = await isOrganizationMember(
      session.user.id,
      organizationId,
    );
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user has permission to update org
    if (
      !session.organizationRole ||
      !can.updateOrg(session.organizationRole)
    ) {
      return NextResponse.json(
        { error: "You don't have permission to update this organization" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const data = updateOrganizationSchema.parse(body);

    const organization = await updateOrganization(organizationId, data);

    return NextResponse.json(organization);
  },
);

/**
 * DELETE /api/organization/[organizationId]
 * Delete organization (owner only)
 */
export const DELETE = withError(
  async (
    _request: Request,
    context: { params: Promise<{ organizationId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await context.params;

    // Verify user has permission
    const isMember = await isOrganizationMember(
      session.user.id,
      organizationId,
    );
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user has permission to delete org (owner only)
    if (
      !session.organizationRole ||
      !can.deleteOrg(session.organizationRole)
    ) {
      return NextResponse.json(
        { error: "Only organization owners can delete the organization" },
        { status: 403 },
      );
    }

    await deleteOrganization(organizationId);

    return NextResponse.json({ success: true });
  },
);
