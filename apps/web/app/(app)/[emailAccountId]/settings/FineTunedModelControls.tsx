"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toastError, toastSuccess } from "@/components/Toast";
import type { User } from "@prisma/client";

interface FineTunedModelControlsProps {
  user: Pick<User, "aiProvider" | "aiModel" | "id">;
  completedModel?: {
    modelName: string;
    deployedAt: Date;
    trainingEmails: number;
    actualCost?: number;
  };
  onUpdate?: () => void;
}

export function FineTunedModelControls({
  user,
  completedModel,
  onUpdate,
}: FineTunedModelControlsProps) {
  const [toggling, setToggling] = useState(false);

  // Check if fine-tuned model is enabled
  const isFineTunedEnabled =
    user.aiProvider === "ollama" &&
    user.aiModel?.startsWith("emailai-") &&
    user.aiModel === completedModel?.modelName;

  const toggleFineTunedModel = async () => {
    setToggling(true);
    try {
      const response = await fetch("/api/user/settings/ai-model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useFineTunedModel: !isFineTunedEnabled,
          modelName: completedModel?.modelName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update model settings");
      }

      toastSuccess({
        description: isFineTunedEnabled
          ? "Switched to base model"
          : "Switched to your personalized model",
      });

      onUpdate?.();
    } catch (error: any) {
      toastError({
        description: error.message || "Failed to update model settings",
      });
    } finally {
      setToggling(false);
    }
  };

  if (!completedModel) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <CardTitle>Personalized AI Model</CardTitle>
          </div>
          <Badge variant={isFineTunedEnabled ? "default" : "secondary"}>
            {isFineTunedEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>
        <CardDescription>
          Control your fine-tuned AI model trained on your writing style
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Model Info */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Model Name</span>
            <code className="text-sm">{completedModel.modelName}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Trained On</span>
            <span className="text-sm">
              {new Date(completedModel.deployedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Training Emails</span>
            <span className="text-sm">{completedModel.trainingEmails}</span>
          </div>
          {completedModel.actualCost && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Training Cost</span>
              <span className="text-sm">
                ${completedModel.actualCost.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="fine-tuned-toggle" className="text-base">
              Use Personalized Model
            </Label>
            <p className="text-sm text-muted-foreground">
              {isFineTunedEnabled
                ? "AI writes emails in your style"
                : "Using standard AI model"}
            </p>
          </div>
          <Switch
            id="fine-tuned-toggle"
            checked={isFineTunedEnabled}
            onCheckedChange={toggleFineTunedModel}
            disabled={toggling}
          />
        </div>

        {/* Status Alerts */}
        {isFineTunedEnabled ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Personalized Model Active</AlertTitle>
            <AlertDescription>
              All AI-generated emails will match your writing style, tone, and
              vocabulary. The AI learned from {completedModel.trainingEmails}{" "}
              of your sent emails.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Using Base Model</AlertTitle>
            <AlertDescription>
              You're using the standard AI model. Enable your personalized
              model above to get emails that sound more like you.
            </AlertDescription>
          </Alert>
        )}

        {/* Model Comparison */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">What's the difference?</h4>
          <div className="grid gap-2">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">Base Model</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional, generic responses. Works well but doesn't match
                your personal style.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default">Personalized Model</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Matches your tone, formality, greetings, and vocabulary. Sounds
                like you wrote it yourself.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              /* TODO: Show model comparison */
            }}
            className="flex-1"
          >
            Compare Examples
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              /* TODO: Show training details */
            }}
            className="flex-1"
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
