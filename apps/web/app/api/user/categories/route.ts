import { NextResponse } from "next/server";
import { withEmailAccount } from "@/utils/middleware";
import { getUserCategories } from "@/utils/category.server";

export type UserCategoriesResponse = Awaited<ReturnType<typeof getCategories>>;

async function getCategories({
  emailAccountId,
  organizationId,
}: {
  emailAccountId: string;
  organizationId?: string;
}) {
  const result = await getUserCategories({ emailAccountId, organizationId });
  return { result };
}

export const GET = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;
  const organizationId = request.auth.organizationId;
  const result = await getCategories({ emailAccountId, organizationId });
  return NextResponse.json(result);
});
