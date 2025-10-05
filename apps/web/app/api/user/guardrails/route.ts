import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { prisma } from "@/utils/prisma";
import { GuardrailService } from "@/utils/ai/guardrails/guardrail-service";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("api/user/guardrails");

/**
 * GET /api/user/guardrails
 * Get all guardrails for the user
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    const guardrails = await prisma.autoSendGuardrail.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: { violations: true },
        },
      },
    });

    return NextResponse.json({ guardrails });
  } catch (error: any) {
    logger.error("Failed to get guardrails", { error });
    return NextResponse.json(
      { error: error.message || "Failed to get guardrails" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/user/guardrails
 * Create a new guardrail
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      severity = "BLOCK",
      action = "HOLD_FOR_REVIEW",
      appliesTo = "ALL",
      priority = 50,
      examples,
      organizationId,
    } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: "Name and description are required" },
        { status: 400 },
      );
    }

    logger.info("Creating guardrail", {
      userId: session.user.id,
      name,
      organizationId,
    });

    const guardrail = await prisma.autoSendGuardrail.create({
      data: {
        name,
        description,
        severity,
        action,
        appliesTo,
        priority,
        examples,
        userId: session.user.id,
        organizationId,
      },
    });

    return NextResponse.json({ guardrail });
  } catch (error: any) {
    logger.error("Failed to create guardrail", { error });
    return NextResponse.json(
      { error: error.message || "Failed to create guardrail" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/user/guardrails
 * Update a guardrail
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Guardrail ID required" },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Verify ownership
    const existing = await prisma.autoSendGuardrail.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Guardrail not found" },
        { status: 404 },
      );
    }

    if (
      existing.userId !== session.user.id &&
      !existing.organizationId // TODO: Check org membership
    ) {
      return NextResponse.json(
        { error: "Not authorized to edit this guardrail" },
        { status: 403 },
      );
    }

    logger.info("Updating guardrail", {
      userId: session.user.id,
      guardrailId: id,
    });

    const guardrail = await prisma.autoSendGuardrail.update({
      where: { id },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ guardrail });
  } catch (error: any) {
    logger.error("Failed to update guardrail", { error });
    return NextResponse.json(
      { error: error.message || "Failed to update guardrail" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/guardrails
 * Delete a guardrail
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Guardrail ID required" },
        { status: 400 },
      );
    }

    // Verify ownership
    const existing = await prisma.autoSendGuardrail.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Guardrail not found" },
        { status: 404 },
      );
    }

    if (existing.userId !== session.user.id && !existing.organizationId) {
      return NextResponse.json(
        { error: "Not authorized to delete this guardrail" },
        { status: 403 },
      );
    }

    logger.info("Deleting guardrail", {
      userId: session.user.id,
      guardrailId: id,
    });

    await prisma.autoSendGuardrail.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Failed to delete guardrail", { error });
    return NextResponse.json(
      { error: error.message || "Failed to delete guardrail" },
      { status: 500 },
    );
  }
}
