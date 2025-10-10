import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import {
  shareEmailAccountWithOrganization,
  unshareEmailAccountFromOrganization,
} from "@/utils/organization/email-accounts";
import { withError } from "@/utils/middleware";

const shareSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
});

/**
 * POST /api/user/email-account/[emailAccountId]/share
 * Share email account with an organization
 */
export const POST = withError(
  async (
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ) => {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { emailAccountId } = await context.params;
    const body = await request.json();
    const { organizationId } = shareSchema.parse(body);

    const result = await shareEmailAccountWithOrganization({
      emailAccountId,
      userId: session.user.id,
      organizationId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  },
);

/**
 * DELETE /api/user/email-account/[emailAccountId]/share
 * Unshare email account from organization (make it personal)
 */
export const DELETE = withError(
  async (
    _request: Request,
    context: { params: Promise<Record<string, string>> },
  ) => {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { emailAccountId } = await context.params;

    const result = await unshareEmailAccountFromOrganization({
      emailAccountId,
      userId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  },
);
