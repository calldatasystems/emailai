import { NextResponse } from "next/server";
import { withEmailAccount } from "@/utils/middleware";
import { getEmailActionsByDay } from "@emailai/tinybird";
import { env } from "@/env";

export type EmailActionStatsResponse = Awaited<
  ReturnType<typeof getEmailActionStats>
>;

async function getEmailActionStats({ userEmail }: { userEmail: string }) {
  // Return empty result if Tinybird is not configured (dev environment)
  if (!env.TINYBIRD_TOKEN) {
    return { result: [] };
  }

  const result = (
    await getEmailActionsByDay({ ownerEmail: userEmail })
  ).data.map((d) => ({
    date: d.date,
    Archived: d.archive_count,
    Deleted: d.delete_count,
  }));

  return { result };
}

export const GET = withEmailAccount(async (request) => {
  const userEmail = request.auth.email;

  const result = await getEmailActionStats({ userEmail });

  return NextResponse.json(result);
});
