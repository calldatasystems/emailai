"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Edit,
  ShieldAlert,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toastError, toastSuccess } from "@/components/Toast";

interface Guardrail {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: "BLOCK" | "WARN" | "INFO";
  action: "HOLD_FOR_REVIEW" | "ASK_USER" | "LOG_ONLY";
  appliesTo: "ALL" | "EXTERNAL_ONLY" | "INTERNAL_ONLY" | "SPECIFIC_DOMAINS";
  priority: number;
  examples?: {
    shouldBlock?: string[];
    domains?: string[];
  };
  triggeredCount: number;
  lastTriggered: string | null;
  _count: {
    violations: number;
  };
}

interface GuardrailFormData {
  name: string;
  description: string;
  severity: "BLOCK" | "WARN" | "INFO";
  action: "HOLD_FOR_REVIEW" | "ASK_USER" | "LOG_ONLY";
  appliesTo: "ALL" | "EXTERNAL_ONLY" | "INTERNAL_ONLY" | "SPECIFIC_DOMAINS";
  priority: number;
  examplesShouldBlock: string;
  examplesDomains: string;
}

const defaultFormData: GuardrailFormData = {
  name: "",
  description: "",
  severity: "BLOCK",
  action: "HOLD_FOR_REVIEW",
  appliesTo: "ALL",
  priority: 50,
  examplesShouldBlock: "",
  examplesDomains: "",
};

export function GuardrailsSection() {
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGuardrail, setEditingGuardrail] = useState<Guardrail | null>(
    null,
  );
  const [formData, setFormData] = useState<GuardrailFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);

  const fetchGuardrails = async () => {
    try {
      const res = await fetch("/api/user/guardrails");
      if (!res.ok) throw new Error("Failed to fetch guardrails");
      const data = await res.json();
      setGuardrails(data.guardrails || []);
    } catch (error) {
      console.error("Failed to fetch guardrails:", error);
      toastError({ description: "Failed to load guardrails" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardrails();
  }, []);

  const handleCreateDefaults = async () => {
    try {
      setSaving(true);
      const defaults = [
        {
          name: "Date/Time Commitment Check",
          description:
            "Do not auto-send if the recipient is asking for a specific date, time, or meeting commitment. Hold for user review to ensure availability.",
          severity: "BLOCK",
          action: "HOLD_FOR_REVIEW",
          priority: 100,
          examples: {
            shouldBlock: [
              "When are you available next week?",
              "Can we schedule a call on Tuesday?",
              "What time works for you?",
            ],
          },
        },
        {
          name: "Objectionable Language Check",
          description:
            "Do not auto-send if the email contains profanity, offensive language, or inappropriate content.",
          severity: "BLOCK",
          action: "HOLD_FOR_REVIEW",
          priority: 200,
        },
        {
          name: "Financial Commitment Check",
          description:
            "Do not auto-send if the recipient is asking about pricing, contracts, or financial commitments. Hold for review.",
          severity: "BLOCK",
          action: "HOLD_FOR_REVIEW",
          priority: 90,
          examples: {
            shouldBlock: [
              "What's your pricing?",
              "Can you send over a contract?",
              "How much does this cost?",
            ],
          },
        },
        {
          name: "Sensitive Topic Check",
          description:
            "Do not auto-send if the email discusses sensitive topics like legal matters, HR issues, or confidential information.",
          severity: "BLOCK",
          action: "HOLD_FOR_REVIEW",
          priority: 150,
        },
      ];

      for (const guardrail of defaults) {
        await fetch("/api/user/guardrails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(guardrail),
        });
      }

      toastSuccess({ description: "Default guardrails created" });
      await fetchGuardrails();
    } catch (error) {
      toastError({ description: "Failed to create default guardrails" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (guardrail: Guardrail) => {
    setEditingGuardrail(guardrail);
    setFormData({
      name: guardrail.name,
      description: guardrail.description,
      severity: guardrail.severity,
      action: guardrail.action,
      appliesTo: guardrail.appliesTo,
      priority: guardrail.priority,
      examplesShouldBlock: guardrail.examples?.shouldBlock?.join("\n") || "",
      examplesDomains: guardrail.examples?.domains?.join("\n") || "",
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingGuardrail(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description) {
      toastError({ description: "Name and description are required" });
      return;
    }

    setSaving(true);
    try {
      const examples: any = {};
      if (formData.examplesShouldBlock) {
        examples.shouldBlock = formData.examplesShouldBlock
          .split("\n")
          .filter((s) => s.trim());
      }
      if (formData.examplesDomains) {
        examples.domains = formData.examplesDomains
          .split("\n")
          .filter((s) => s.trim());
      }

      const body = {
        name: formData.name,
        description: formData.description,
        severity: formData.severity,
        action: formData.action,
        appliesTo: formData.appliesTo,
        priority: formData.priority,
        examples: Object.keys(examples).length > 0 ? examples : undefined,
      };

      let res;
      if (editingGuardrail) {
        res = await fetch(`/api/user/guardrails?id=${editingGuardrail.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/user/guardrails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save guardrail");
      }

      toastSuccess({
        description: editingGuardrail
          ? "Guardrail updated"
          : "Guardrail created",
      });
      setDialogOpen(false);
      await fetchGuardrails();
    } catch (error: any) {
      toastError({ description: error.message || "Failed to save guardrail" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this guardrail?")) return;

    try {
      const res = await fetch(`/api/user/guardrails?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete guardrail");

      toastSuccess({ description: "Guardrail deleted" });
      await fetchGuardrails();
    } catch (error) {
      toastError({ description: "Failed to delete guardrail" });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/user/guardrails?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) throw new Error("Failed to update guardrail");

      toastSuccess({
        description: enabled ? "Guardrail enabled" : "Guardrail disabled",
      });
      await fetchGuardrails();
    } catch (error) {
      toastError({ description: "Failed to update guardrail" });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "BLOCK":
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case "WARN":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "INFO":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary"> = {
      BLOCK: "destructive",
      WARN: "default",
      INFO: "secondary",
    };
    return (
      <Badge variant={variants[severity] || "secondary"}>{severity}</Badge>
    );
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

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-lg font-medium">Auto-Send Guardrails</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Define natural language rules to control when emails can be
              auto-sent
            </p>
          </div>
          <div className="flex gap-2">
            {guardrails.length === 0 && (
              <Button
                onClick={handleCreateDefaults}
                variant="outline"
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Defaults
              </Button>
            )}
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Guardrail
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Guardrails use AI to evaluate emails against natural language rules.
            For example: "Do not auto-send if recipient is asking for a time or
            date commitment"
          </AlertDescription>
        </Alert>

        {/* Guardrails Table */}
        {guardrails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No guardrails configured</p>
            <p className="text-sm mt-1">
              Create your first guardrail to start protecting auto-send
            </p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Enabled</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Triggered</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guardrails.map((guardrail) => (
                  <TableRow key={guardrail.id}>
                    <TableCell>
                      <Switch
                        checked={guardrail.enabled}
                        onCheckedChange={(enabled: boolean) =>
                          handleToggle(guardrail.id, enabled)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(guardrail.severity)}
                        <span className="font-medium">{guardrail.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground max-w-md truncate">
                        {guardrail.description}
                      </p>
                    </TableCell>
                    <TableCell>{getSeverityBadge(guardrail.severity)}</TableCell>
                    <TableCell>{guardrail.priority}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">
                          {guardrail.triggeredCount} times
                        </p>
                        {guardrail.lastTriggered && (
                          <p className="text-muted-foreground">
                            Last:{" "}
                            {new Date(
                              guardrail.lastTriggered,
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(guardrail)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(guardrail.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGuardrail ? "Edit Guardrail" : "Create Guardrail"}
              </DialogTitle>
              <DialogDescription>
                Define a natural language rule for when emails should not be
                auto-sent
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Date/Time Commitment Check"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">
                  Description (Natural Language Rule)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Do not auto-send if the recipient is asking for a specific date, time, or meeting commitment"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Describe in plain English when emails should be blocked
                </p>
              </div>

              {/* Severity */}
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, severity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BLOCK">
                      BLOCK - Prevent auto-send
                    </SelectItem>
                    <SelectItem value="WARN">WARN - Ask user first</SelectItem>
                    <SelectItem value="INFO">INFO - Log only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action */}
              <div>
                <Label htmlFor="action">Action</Label>
                <Select
                  value={formData.action}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, action: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOLD_FOR_REVIEW">
                      Hold for Review
                    </SelectItem>
                    <SelectItem value="ASK_USER">Ask User</SelectItem>
                    <SelectItem value="LOG_ONLY">Log Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Applies To */}
              <div>
                <Label htmlFor="appliesTo">Applies To</Label>
                <Select
                  value={formData.appliesTo}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, appliesTo: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Emails</SelectItem>
                    <SelectItem value="EXTERNAL_ONLY">
                      External Only
                    </SelectItem>
                    <SelectItem value="INTERNAL_ONLY">
                      Internal Only
                    </SelectItem>
                    <SelectItem value="SPECIFIC_DOMAINS">
                      Specific Domains
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div>
                <Label htmlFor="priority">Priority (higher = checked first)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Examples */}
              <div>
                <Label htmlFor="examples">Examples (optional, one per line)</Label>
                <Textarea
                  id="examples"
                  value={formData.examplesShouldBlock}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      examplesShouldBlock: e.target.value,
                    })
                  }
                  placeholder="When are you available next week?&#10;Can we schedule a call on Tuesday?"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide examples of emails that should trigger this guardrail
                </p>
              </div>

              {/* Domains (if SPECIFIC_DOMAINS) */}
              {formData.appliesTo === "SPECIFIC_DOMAINS" && (
                <div>
                  <Label htmlFor="domains">Domains (one per line)</Label>
                  <Textarea
                    id="domains"
                    value={formData.examplesDomains}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examplesDomains: e.target.value,
                      })
                    }
                    placeholder="example.com&#10;company.com"
                    rows={2}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingGuardrail ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
