import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { transferEmailAccountOwnership } from "@/utils/organization/email-accounts";
import { withError } from "@/utils/middleware";

const transferSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
});

/**
 * POST /api/user/email-account/[emailAccountId]/transfer
 * Transfer email account ownership to another user in the same organization
 */
export const POST = withError(
  async (
    request: Request,
    context: { params: Promise<{ emailAccountId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { emailAccountId } = await context.params;
    const body = await request.json();
    const { targetUserId } = transferSchema.parse(body);

    const result = await transferEmailAccountOwnership({
      emailAccountId,
      currentUserId: session.user.id,
      targetUserId,
      role: session.organizationRole,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
