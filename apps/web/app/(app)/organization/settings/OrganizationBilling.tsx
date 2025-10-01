"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCardIcon, Users, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/providers/OrganizationProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/Button";
import { LoadingContent } from "@/components/LoadingContent";
import { Badge } from "@/components/Badge";
import { can } from "@/utils/organization/rbac";
import { useToast } from "@/components/ui/use-toast";
import { capitalCase } from "capital-case";
import {
  getBillingPortalUrlAction,
  generateCheckoutSessionAction,
} from "@/utils/actions/premium";
import { toastError } from "@/components/Toast";
import { env } from "@/env";

interface OrganizationBillingData {
  organizationId: string;
  organizationName: string;
  hasPremium: boolean;
  tier: string | null;
  seats: {
    used: number;
    max: number | null;
    available: number | null;
  };
  members: number;
  emailAccounts: number;
  subscription: {
    status: string | null;
    renewsAt: Date | null;
    willCancel: boolean;
    provider: "stripe" | "lemon" | null;
  };
}

export function OrganizationBilling() {
  const { organizationId, organizationRole } = useOrganization();
  const { toast } = useToast();
  const [loadingBillingPortal, setLoadingBillingPortal] = useState(false);

  const canViewBilling = organizationRole ? can.viewBilling(organizationRole) : false;

  const { data, isLoading, error } = useSWR<OrganizationBillingData>(
    canViewBilling && organizationId
      ? `/api/organization/${organizationId}/billing`
      : null,
  );

  if (!canViewBilling) {
    return (
      <Card className="p-6">
        <div className="text-center text-sm text-gray-600">
          You don't have permission to view billing information.
        </div>
      </Card>
    );
  }

  return (
    <LoadingContent loading={isLoading} error={error}>
      {data && (
        <div className="space-y-6">
          {/* Billing Header */}
          <div>
            <h2 className="text-2xl font-bold">Billing & Subscription</h2>
            <p className="mt-1 text-sm text-gray-600">
              Manage your organization's subscription and billing.
            </p>
          </div>

          {/* Current Plan */}
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">Current Plan</h3>
                <div className="mt-2 flex items-center gap-2">
                  {data.hasPremium && data.tier ? (
                    <>
                      <Badge className="text-base">
                        {capitalCase(data.tier)}
                      </Badge>
                      {data.subscription.status && (
                        <span className="text-sm text-gray-600">
                          ({capitalCase(data.subscription.status)})
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline">Free Plan</Badge>
                  )}
                </div>
                {data.subscription.renewsAt && (
                  <p className="mt-2 text-sm text-gray-600">
                    {data.subscription.willCancel ? "Ends" : "Renews"} on{" "}
                    {new Date(data.subscription.renewsAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {data.hasPremium ? (
                  <>
                    {data.subscription.provider === "stripe" && (
                      <Button
                        loading={loadingBillingPortal}
                        onClick={async () => {
                          setLoadingBillingPortal(true);
                          const result = await getBillingPortalUrlAction({});
                          setLoadingBillingPortal(false);
                          const url = result?.data?.url;
                          if (result?.serverError || !url) {
                            toastError({
                              description:
                                result?.serverError ||
                                "Error loading billing portal. Please contact support.",
                            });
                          } else {
                            window.open(url);
                          }
                        }}
                      >
                        <CreditCardIcon className="mr-2 h-4 w-4" />
                        Manage Subscription
                      </Button>
                    )}
                    {data.subscription.provider === "lemon" && (
                      <Button asChild>
                        <Link
                          href={`https://${env.NEXT_PUBLIC_LEMON_STORE_ID}.lemonsqueezy.com/billing`}
                          target="_blank"
                        >
                          <CreditCardIcon className="mr-2 h-4 w-4" />
                          Manage Subscription
                        </Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <Button variant="primaryBlue" asChild>
                    <Link href="/premium">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Upgrade to Premium
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Seat Usage */}
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold">Seat Usage</h3>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Members</span>
                    <span className="font-semibold">
                      {data.seats.used} / {data.seats.max ?? "Unlimited"}
                    </span>
                  </div>

                  {data.seats.max !== null && (
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{
                            width: `${Math.min((data.seats.used / data.seats.max) * 100, 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Available seats</span>
                        <span
                          className={
                            data.seats.available === 0
                              ? "font-semibold text-red-600"
                              : "text-gray-900"
                          }
                        >
                          {data.seats.available}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {data.seats.available === 0 && (
                  <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                    <p className="text-sm text-yellow-800">
                      You've reached your seat limit. Upgrade your plan to add
                      more members.
                    </p>
                  </div>
                )}

                {!data.hasPremium && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm text-blue-800">
                      Upgrade to a premium plan to add more team members and
                      unlock advanced features.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Usage Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold">Organization Usage</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Members</span>
                  <Users className="h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-2 text-2xl font-bold">{data.members}</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email Accounts</span>
                  <CreditCardIcon className="h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-2 text-2xl font-bold">{data.emailAccounts}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </LoadingContent>
  );
}
