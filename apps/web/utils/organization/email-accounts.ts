/**
 * Organization Email Account Utilities
 *
 * Handles email account sharing and access control within organizations
 */

import prisma from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";
import { isOrganizationMember } from "@/utils/organization";
import { can } from "@/utils/organization/rbac";
import type { OrganizationRole } from "@prisma/client";

const logger = createScopedLogger("organization-email-accounts");

/**
 * Check if a user can access an email account
 * Access is granted if:
 * 1. User owns the email account (userId matches)
 * 2. User is a member of the organization that owns the email account
 */
export async function canAccessEmailAccount(
  userId: string,
  emailAccountId: string,
): Promise<boolean> {
  try {
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { userId: true, organizationId: true },
    });

    if (!emailAccount) return false;

    // User owns the email account directly
    if (emailAccount.userId === userId) return true;

    // User has access via organization
    if (emailAccount.organizationId) {
      return await isOrganizationMember(userId, emailAccount.organizationId);
    }

    return false;
  } catch (error) {
    logger.error("Error checking email account access", {
      userId,
      emailAccountId,
      error,
    });
    return false;
  }
}

/**
 * Check if user can manage an email account
 * Management permissions (transfer ownership, delete) require:
 * 1. User owns the email account, OR
 * 2. User is ADMIN/OWNER of the organization
 */
export async function canManageEmailAccount(
  userId: string,
  emailAccountId: string,
  role?: OrganizationRole,
): Promise<boolean> {
  try {
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { userId: true, organizationId: true },
    });

    if (!emailAccount) return false;

    // Owner can always manage
    if (emailAccount.userId === userId) return true;

    // Organization admins/owners can manage
    if (role && can.updateOrg(role)) return true;

    return false;
  } catch (error) {
    logger.error("Error checking email account management permission", {
      userId,
      emailAccountId,
      error,
    });
    return false;
  }
}

/**
 * Get all email accounts accessible to a user
 * Includes:
 * 1. Email accounts owned by the user
 * 2. Email accounts in organizations the user is a member of
 */
export async function getAccessibleEmailAccounts(userId: string) {
  try {
    // Get user's organization memberships
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });

    const organizationIds = memberships.map((m) => m.organizationId);

    // Get email accounts user can access
    const emailAccounts = await prisma.emailAccount.findMany({
      where: {
        OR: [
          { userId }, // Owned by user
          { organizationId: { in: organizationIds } }, // In user's organizations
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return emailAccounts;
  } catch (error) {
    logger.error("Error getting accessible email accounts", { userId, error });
    return [];
  }
}

/**
 * Transfer email account ownership to another user
 * Requirements:
 * - Target user must be in the same organization
 * - Current user must be owner or org admin
 */
export async function transferEmailAccountOwnership({
  emailAccountId,
  currentUserId,
  targetUserId,
  role,
}: {
  emailAccountId: string;
  currentUserId: string;
  targetUserId: string;
  role?: OrganizationRole;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if current user can manage this email account
    const canManage = await canManageEmailAccount(
      currentUserId,
      emailAccountId,
      role,
    );

    if (!canManage) {
      return {
        success: false,
        error: "You don't have permission to transfer this email account",
      };
    }

    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { organizationId: true, email: true },
    });

    if (!emailAccount) {
      return { success: false, error: "Email account not found" };
    }

    if (!emailAccount.organizationId) {
      return {
        success: false,
        error: "Email account must be in an organization to transfer ownership",
      };
    }

    // Verify target user is in the same organization
    const targetIsMember = await isOrganizationMember(
      targetUserId,
      emailAccount.organizationId,
    );

    if (!targetIsMember) {
      return {
        success: false,
        error: "Target user must be a member of the same organization",
      };
    }

    // Transfer ownership
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { userId: targetUserId },
    });

    logger.info("Email account ownership transferred", {
      emailAccountId,
      email: emailAccount.email,
      fromUserId: currentUserId,
      toUserId: targetUserId,
      organizationId: emailAccount.organizationId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error transferring email account ownership", {
      emailAccountId,
      currentUserId,
      targetUserId,
      error,
    });
    return {
      success: false,
      error: "Failed to transfer email account ownership",
    };
  }
}

/**
 * Share email account with organization
 * Links the email account to the user's organization if not already linked
 */
export async function shareEmailAccountWithOrganization({
  emailAccountId,
  userId,
  organizationId,
}: {
  emailAccountId: string;
  userId: string;
  organizationId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { userId: true, organizationId: true },
    });

    if (!emailAccount) {
      return { success: false, error: "Email account not found" };
    }

    // Only the owner can share the email account
    if (emailAccount.userId !== userId) {
      return {
        success: false,
        error: "Only the account owner can share it with an organization",
      };
    }

    // Verify user is a member of the target organization
    const isMember = await isOrganizationMember(userId, organizationId);
    if (!isMember) {
      return {
        success: false,
        error: "You must be a member of the organization to share with it",
      };
    }

    // Already shared with this organization
    if (emailAccount.organizationId === organizationId) {
      return {
        success: false,
        error: "Email account is already shared with this organization",
      };
    }

    // Share with organization
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { organizationId },
    });

    logger.info("Email account shared with organization", {
      emailAccountId,
      userId,
      organizationId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error sharing email account with organization", {
      emailAccountId,
      userId,
      organizationId,
      error,
    });
    return {
      success: false,
      error: "Failed to share email account with organization",
    };
  }
}

/**
 * Unshare email account from organization (make it personal)
 * Only the owner can unshare their email account
 */
export async function unshareEmailAccountFromOrganization({
  emailAccountId,
  userId,
}: {
  emailAccountId: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { userId: true, organizationId: true },
    });

    if (!emailAccount) {
      return { success: false, error: "Email account not found" };
    }

    // Only the owner can unshare
    if (emailAccount.userId !== userId) {
      return {
        success: false,
        error: "Only the account owner can unshare it from the organization",
      };
    }

    if (!emailAccount.organizationId) {
      return {
        success: false,
        error: "Email account is not shared with any organization",
      };
    }

    // Unshare from organization
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { organizationId: null },
    });

    logger.info("Email account unshared from organization", {
      emailAccountId,
      userId,
      organizationId: emailAccount.organizationId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error unsharing email account from organization", {
      emailAccountId,
      userId,
      error,
    });
    return {
      success: false,
      error: "Failed to unshare email account from organization",
    };
  }
}

/**
 * Get email accounts for a specific organization
 */
export async function getOrganizationEmailAccounts(organizationId: string) {
  try {
    const emailAccounts = await prisma.emailAccount.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return emailAccounts;
  } catch (error) {
    logger.error("Error getting organization email accounts", {
      organizationId,
      error,
    });
    return [];
  }
}
