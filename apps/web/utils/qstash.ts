import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

/**
 * Conditional QStash signature verification wrapper
 * Only verifies if QStash env vars are configured, otherwise passes through
 * This prevents build-time errors when QStash is not configured
 */
export function withQStashVerification(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    // Only verify if QStash keys are configured
    if (env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) {
      const { verifySignatureAppRouter } = await import(
        "@upstash/qstash/dist/nextjs"
      );
      const verifiedHandler = verifySignatureAppRouter(handler);
      return verifiedHandler(request);
    }

    // If QStash not configured, just run the handler without verification
    // This allows the app to build even if QStash env vars are not set
    return handler(request);
  };
}
