import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { prisma } from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";
import { env } from "@/env";

const logger = createScopedLogger("api/user/settings/ai-model");

/**
 * PATCH /api/user/settings/ai-model
 * Toggle between fine-tuned model and base model
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { useFineTunedModel, modelName } = body;

    logger.info("Toggling AI model", {
      userId: session.user.id,
      useFineTunedModel,
      modelName,
    });

    if (useFineTunedModel) {
      // Enable fine-tuned model
      if (!modelName) {
        return NextResponse.json(
          { error: "Model name required" },
          { status: 400 },
        );
      }

      // Verify the model exists for this user
      const job = await prisma.fineTuningJob.findFirst({
        where: {
          userId: session.user.id,
          modelName,
          status: "COMPLETED",
        },
      });

      if (!job) {
        return NextResponse.json(
          { error: "Model not found or not completed" },
          { status: 404 },
        );
      }

      // Update user to use fine-tuned model
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          aiProvider: "ollama",
          aiModel: modelName,
        },
      });

      logger.info("Enabled fine-tuned model", {
        userId: session.user.id,
        modelName,
      });

      return NextResponse.json({
        success: true,
        aiProvider: "ollama",
        aiModel: modelName,
      });
    } else {
      // Disable fine-tuned model (use base model)
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          aiProvider: env.DEFAULT_LLM_PROVIDER || null,
          aiModel: null, // Use default model
        },
      });

      logger.info("Disabled fine-tuned model", {
        userId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        aiProvider: env.DEFAULT_LLM_PROVIDER || null,
        aiModel: null,
      });
    }
  } catch (error: any) {
    logger.error("Failed to update AI model settings", { error });
    return NextResponse.json(
      { error: error.message || "Failed to update AI model settings" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/user/settings/ai-model
 * Get current AI model settings and available models
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiProvider: true,
        aiModel: true,
      },
    });

    // Get all completed fine-tuned models for this user
    const completedModels = await prisma.fineTuningJob.findMany({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
      },
      orderBy: { deployedAt: "desc" },
      select: {
        modelName: true,
        deployedAt: true,
        trainingEmails: true,
        actualCost: true,
      },
    });

    const isUsingFineTuned =
      user?.aiProvider === "ollama" && user?.aiModel?.startsWith("emailai-");

    return NextResponse.json({
      currentProvider: user?.aiProvider,
      currentModel: user?.aiModel,
      isUsingFineTuned,
      availableModels: completedModels,
      baseModel: {
        provider: env.DEFAULT_LLM_PROVIDER,
        model: env.NEXT_PUBLIC_OLLAMA_MODEL,
      },
    });
  } catch (error: any) {
    logger.error("Failed to get AI model settings", { error });
    return NextResponse.json(
      { error: error.message || "Failed to get AI model settings" },
      { status: 500 },
    );
  }
}
