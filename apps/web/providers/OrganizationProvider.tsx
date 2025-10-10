"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useSession } from "next-auth/react";
import type { OrganizationRole } from "@prisma/client";
import useSWR from "swr";
import { fetcher } from "@/utils/swr";

/**
 * Organization Context for Multi-Tenant Support
 *
 * This provider manages the current organization context throughout the application.
 * It supports organization switching and provides organization-related state.
 */

export interface OrganizationMember {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: OrganizationRole;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  role: OrganizationRole;
  memberCount?: number;
  emailAccountCount?: number;
  premium?: {
    id: string;
    lemonSqueezyRenewsAt: Date | null;
    maxSeats: number | null;
    usedSeats: number;
  } | null;
}

interface OrganizationContextValue {
  // Current organization
  organization: Organization | null;
  organizationId: string | null;
  organizationRole: OrganizationRole | null;

  // All user's organizations
  organizations: Organization[];
  isLoadingOrganizations: boolean;

  // Organization switching
  switchOrganization: (organizationId: string) => Promise<void>;
  isSwitching: boolean;

  // Refresh organization data
  refreshOrganization: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null,
);

interface OrganizationProviderProps {
  children: React.ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { data: session, update: updateSession } = useSession();
  const [isSwitching, setIsSwitching] = useState(false);

  // Fetch all user's organizations
  const {
    data: organizations,
    isLoading: isLoadingOrganizations,
    mutate: mutateOrganizations,
  } = useSWR<Organization[]>(
    session?.user?.id ? "/api/user/organizations" : null,
    fetcher,
  );

  // Current organization from session
  const organizationId = session?.organizationId ?? null;
  const organizationRole = session?.organizationRole ?? null;

  // Find current organization in the list
  const organization =
    organizations?.find((org) => org.id === organizationId) ?? null;

  // Switch to a different organization
  const switchOrganization = useCallback(
    async (newOrganizationId: string) => {
      setIsSwitching(true);
      try {
        // Update session with new organization
        const response = await fetch("/api/user/organization/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: newOrganizationId }),
        });

        if (!response.ok) {
          throw new Error("Failed to switch organization");
        }

        const data = await response.json();

        // Update NextAuth session
        await updateSession({
          organizationId: data.organizationId,
          organizationSlug: data.organizationSlug,
          organizationRole: data.organizationRole,
        });

        // Reload the page to clear any organization-specific cached data
        window.location.reload();
      } catch (error) {
        console.error("Error switching organization:", error);
        throw error;
      } finally {
        setIsSwitching(false);
      }
    },
    [updateSession],
  );

  // Refresh current organization data
  const refreshOrganization = useCallback(async () => {
    if (!organizationId) return;
    await mutateOrganizations();
  }, [organizationId, mutateOrganizations]);

  // Refresh all organizations list
  const refreshOrganizations = useCallback(async () => {
    await mutateOrganizations();
  }, [mutateOrganizations]);

  const value: OrganizationContextValue = {
    organization,
    organizationId,
    organizationRole,
    organizations: organizations ?? [],
    isLoadingOrganizations,
    switchOrganization,
    isSwitching,
    refreshOrganization,
    refreshOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook to access organization context
 */
export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganizationContext must be used within OrganizationProvider",
    );
  }
  return context;
}

/**
 * Hook to get current organization
 */
export function useOrganization() {
  const { organization, organizationId, organizationRole } =
    useOrganizationContext();
  return { organization, organizationId, organizationRole };
}

/**
 * Hook to check if user has permission based on their role
 */
export function useOrganizationRole() {
  const { organizationRole } = useOrganizationContext();
  return organizationRole;
}

/**
 * Hook for organization switching
 */
export function useOrganizationSwitcher() {
  const {
    organizations,
    isLoadingOrganizations,
    switchOrganization,
    isSwitching,
    organizationId,
  } = useOrganizationContext();

  return {
    organizations,
    isLoadingOrganizations,
    switchOrganization,
    isSwitching,
    currentOrganizationId: organizationId,
  };
}
