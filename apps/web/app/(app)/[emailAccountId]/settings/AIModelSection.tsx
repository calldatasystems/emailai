"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Clock,
  Zap,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toastError, toastSuccess } from "@/components/Toast";
import { FineTunedModelControls } from "./FineTunedModelControls";

interface FineTuningJob {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  modelName: string | null;
  createdAt: string;
  deployedAt: string | null;
  costEstimate: number | null;
  actualCost: number | null;
}

interface FineTuningData {
  jobs: FineTuningJob[];
  activeJob: FineTuningJob | null;
  eligibility: {
    eligible: boolean;
    sentEmailCount: number;
    reason?: string;
  };
}

export function AIModelSection() {
  const [data, setData] = useState<FineTuningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch job status
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/user/ai/fine-tune");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setData(data);
    } catch (error) {
      console.error("Failed to fetch fine-tuning status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll for updates if there's an active job
    const interval = setInterval(() => {
      if (data?.activeJob) {
        fetchStatus();
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [data?.activeJob]);

  const startFineTuning = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/user/ai/fine-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseModel: "llama3.1:8b",
          epochs: 3,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to start fine-tuning");
      }

      toastSuccess({
        description: "Fine-tuning job created! This will take 2-4 hours.",
      });

      await fetchStatus();
    } catch (error: any) {
      toastError({
        description: error.message || "Failed to start fine-tuning",
      });
    } finally {
      setCreating(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/user/ai/fine-tune?jobId=${jobId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to cancel job");

      toastSuccess({ description: "Fine-tuning job cancelled" });
      await fetchStatus();
    } catch (error: any) {
      toastError({
        description: error.message || "Failed to cancel job",
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Card>
    );
  }

  const { eligibility, activeJob, jobs } = data || {};
  const completedJob = jobs?.find((j) => j.status === "COMPLETED");

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <h3 className="text-lg font-medium">Personalized AI Model</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Train an AI model on your writing style for more authentic email
            replies
          </p>
        </div>

        {/* Eligibility Status */}
        {!eligibility?.eligible && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {eligibility?.reason ||
                `Send at least 100 emails to train your personalized AI model. You currently have ${eligibility?.sentEmailCount || 0} sent emails.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Active Job */}
        {activeJob && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Training in progress</span>
              </div>
              <Badge variant="secondary">{activeJob.status}</Badge>
            </div>

            <Progress value={activeJob.progress} />

            {activeJob.currentStep && (
              <p className="text-sm text-muted-foreground">
                {activeJob.currentStep}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelJob(activeJob.id)}
              >
                Cancel
              </Button>
              {activeJob.costEstimate && (
                <span className="text-sm text-muted-foreground self-center">
                  Estimated cost: ${activeJob.costEstimate.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Completed Model */}
        {completedJob && !activeJob && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">
                  Personalized model active: {completedJob.modelName}
                </p>
                <p className="text-sm">
                  Trained on {completedJob.createdAt &&
                    new Date(completedJob.createdAt).toLocaleDateString()}
                  {completedJob.actualCost && (
                    <> • Cost: ${completedJob.actualCost.toFixed(2)}</>
                  )}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Start Training Button */}
        {!activeJob && eligibility?.eligible && (
          <div className="space-y-3">
            <Button
              onClick={startFineTuning}
              disabled={creating}
              className="w-full"
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {completedJob ? "Re-train Model" : "Train Personalized Model"}
            </Button>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Training takes 2-4 hours on a rented GPU</p>
              <p>• Estimated cost: $1-2 (one-time)</p>
              <p>• Uses {eligibility?.sentEmailCount} of your sent emails</p>
              <p>
                • Model will match your writing style, tone, and vocabulary
              </p>
            </div>
          </div>
        )}

        {/* Training History */}
        {jobs && jobs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Training History</h4>
            <div className="space-y-2">
              {jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50"
                >
                  <div>
                    <span className="font-medium">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                    {job.modelName && (
                      <span className="text-muted-foreground ml-2">
                        {job.modelName}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={
                      job.status === "COMPLETED"
                        ? "default"
                        : job.status === "FAILED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
