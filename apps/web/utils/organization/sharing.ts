import type { OrganizationRole } from "@prisma/client";
import { can } from "./rbac";

/**
 * Sharing and Collaboration Utilities
 *
 * Utilities for managing shared resources within organizations
 */

/**
 * Determine if a user can share a resource based on their role
 */
export function canShareResource(role: OrganizationRole): boolean {
  // Only admins and owners can mark resources as shared
  return can.updateOrg(role);
}

/**
 * Determine if a user can edit a shared resource
 * Users can edit their own resources, admins+ can edit any resource
 */
export function canEditSharedResource({
  role,
  createdBy,
  userId,
}: {
  role: OrganizationRole;
  createdBy?: string | null;
  userId: string;
}): boolean {
  // Admins and owners can edit any resource
  if (can.updateOrg(role)) {
    return true;
  }

  // Users can edit their own resources
  return createdBy === userId;
}

/**
 * Determine if a user can delete a shared resource
 * Users can delete their own resources, admins+ can delete any resource
 */
export function canDeleteSharedResource({
  role,
  createdBy,
  userId,
}: {
  role: OrganizationRole;
  createdBy?: string | null;
  userId: string;
}): boolean {
  // Admins and owners can delete any resource
  if (can.updateOrg(role)) {
    return true;
  }

  // Users can delete their own resources
  return createdBy === userId;
}

/**
 * Get sharing context for resource creation
 */
export function getCreatorContext({
  userId,
  isShared = false,
}: {
  userId: string;
  isShared?: boolean;
}) {
  return {
    createdBy: userId,
    isShared,
  };
}

/**
 * Filter resources based on visibility
 * Shared resources are visible to all org members
 * Private resources are only visible to creator
 */
export function getVisibilityFilter({
  userId,
  includeShared = true,
}: {
  userId: string;
  includeShared?: boolean;
}) {
  if (!includeShared) {
    // Only show user's own resources
    return { createdBy: userId };
  }

  // Show either shared resources OR user's own resources
  return {
    OR: [
      { isShared: true }, // Shared with organization
      { createdBy: userId }, // User's private resources
      { createdBy: null }, // Legacy resources (created before sharing)
    ],
  };
}

/**
 * Check if a resource is editable by the user
 */
export function isResourceEditable({
  resource,
  userId,
  role,
}: {
  resource: {
    createdBy?: string | null;
    isShared?: boolean;
  };
  userId: string;
  role: OrganizationRole;
}): boolean {
  return canEditSharedResource({
    role,
    createdBy: resource.createdBy,
    userId,
  });
}

/**
 * Get creator display info
 */
export function getCreatorDisplayInfo(creator?: {
  name: string | null;
  email: string;
  image: string | null;
} | null): string {
  if (!creator) {
    return "Unknown";
  }

  return creator.name || creator.email;
}

/**
 * Format sharing status for display
 */
export function getSharingStatus(isShared?: boolean): {
  label: string;
  description: string;
  variant: "default" | "secondary";
} {
  if (isShared) {
    return {
      label: "Shared",
      description: "Visible to all organization members",
      variant: "default",
    };
  }

  return {
    label: "Private",
    description: "Only visible to you",
    variant: "secondary",
  };
}
