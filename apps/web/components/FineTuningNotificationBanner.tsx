"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  XCircle,
  X,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface FineTuningJob {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  modelName: string | null;
  errorMessage: string | null;
}

interface NotificationData {
  activeJob?: FineTuningJob;
  eligibility?: {
    eligible: boolean;
    sentEmailCount: number;
    message?: string;
  };
}

export function FineTuningNotificationBanner() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchStatus();

    // Poll for updates if there's an active job
    const interval = setInterval(() => {
      fetchStatus();
    }, 15000); // Every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/user/ai/fine-tune");
      if (!res.ok) return;

      const result = await res.json();
      setData({
        activeJob: result.activeJob,
        eligibility: result.eligibility,
      });
    } catch (error) {
      console.error("Failed to fetch fine-tuning status:", error);
    }
  };

  const dismiss = (type: string) => {
    setDismissed([...dismissed, type]);
  };

  const goToSettings = () => {
    router.push("/settings#ai-model");
  };

  // Show training in progress
  if (data?.activeJob && !dismissed.includes("training")) {
    const { status, progress, currentStep, errorMessage } = data.activeJob;

    return (
      <div className="fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
        <Alert className="shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Loader2 className="h-5 w-5 animate-spin mt-0.5" />
              <div className="flex-1 space-y-2">
                <AlertTitle>Training Your AI Model</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-sm">{currentStep || status}</p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {progress}% complete • ~{Math.ceil((100 - progress) / 30)}{" "}
                    hours remaining
                  </p>
                  {errorMessage && (
                    <p className="text-xs text-destructive">{errorMessage}</p>
                  )}
                </AlertDescription>
                <Button
                  variant="link"
                  size="sm"
                  onClick={goToSettings}
                  className="h-auto p-0"
                >
                  View Details →
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => dismiss("training")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // Show completion notification
  if (
    data?.activeJob?.status === "COMPLETED" &&
    !dismissed.includes("completed")
  ) {
    return (
      <div className="fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
        <Alert className="shadow-lg border-green-500">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <AlertTitle>Your AI Model is Ready! 🎉</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-sm">
                    Your personalized AI model has been trained and deployed.
                    AI-generated emails will now match your writing style!
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={goToSettings}
                    >
                      View Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dismiss("completed")}
                    >
                      Got it
                    </Button>
                  </div>
                </AlertDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => dismiss("completed")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // Show failure notification
  if (
    data?.activeJob?.status === "FAILED" &&
    !dismissed.includes("failed")
  ) {
    return (
      <div className="fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
        <Alert className="shadow-lg border-destructive">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <AlertTitle>Training Failed</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-sm">
                    {data.activeJob.errorMessage ||
                      "An error occurred during training."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToSettings}
                  >
                    Try Again
                  </Button>
                </AlertDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => dismiss("failed")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // Show eligibility notification
  if (
    !data?.activeJob &&
    data?.eligibility?.eligible &&
    data?.eligibility?.message &&
    !dismissed.includes("eligible")
  ) {
    return (
      <div className="fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
        <Alert className="shadow-lg border-blue-500">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <AlertTitle>Ready for Personalized AI!</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-sm">{data.eligibility.message}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={goToSettings}
                    >
                      Train Model
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dismiss("eligible")}
                    >
                      Later
                    </Button>
                  </div>
                </AlertDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => dismiss("eligible")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return null;
}
