import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { getUserOrganizations } from "@/utils/organization";
import { withError } from "@/utils/middleware";

/**
 * GET /api/user/organizations
 * Get all organizations for the current user
 */
export const GET = withError(async () => {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizations = await getUserOrganizations(session.user.id);

  return NextResponse.json(organizations);
});
