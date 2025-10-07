"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useOrganization } from "@/providers/OrganizationProvider";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { LoadingContent } from "@/components/LoadingContent";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrganizationMembers } from "./OrganizationMembers";
import { OrganizationBilling } from "./OrganizationBilling";
import { useToast } from "@/components/ui/use-toast";
import { can } from "@/utils/organization/rbac";

const organizationSettingsSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

type OrganizationSettingsValues = z.infer<typeof organizationSettingsSchema>;

export function OrganizationSettingsContent() {
  const { organization, organizationId, organizationRole } = useOrganization();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const canViewBilling = organizationRole ? can.viewBilling(organizationRole) : false;

  const form = useForm<OrganizationSettingsValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      name: organization?.name || "",
      domain: organization?.domain || "",
      logoUrl: organization?.logoUrl || "",
    },
  });

  const onSubmit = async (data: OrganizationSettingsValues) => {
    if (!organizationId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/organization/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update organization");
      }

      toast({
        title: "Settings saved",
        description: "Organization settings updated successfully.",
      });

      // Reload page to refresh organization data
      window.location.reload();
    } catch (error) {
      console.error("Error updating organization:", error);
      toast({
        title: "Error",
        description: "Failed to update organization settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!organization) {
    return (
      <LoadingContent loading={true} error={undefined}>
        <div />
      </LoadingContent>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your organization's settings, members, and billing.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {canViewBilling && <TabsTrigger value="billing">Billing</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Organization" {...field} />
                      </FormControl>
                      <FormDescription>
                        The name of your organization.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="company.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Your organization's domain. Users with this email domain
                        can be automatically invited.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/logo.png"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A URL to your organization's logo image.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" loading={isSaving}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <OrganizationMembers />
        </TabsContent>

        {canViewBilling && (
          <TabsContent value="billing">
            <OrganizationBilling />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
