import { OrganizationRole, type Organization, type OrganizationMember } from "@prisma/client";
import prisma from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";
import { canAddOrganizationMember, updateOrganizationSeats } from "./billing";

const logger = createScopedLogger("organization");

export type OrganizationWithMembers = Organization & {
  members: (OrganizationMember & {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  })[];
};

/**
 * Get organization by ID with optional includes
 */
export async function getOrganization(
  organizationId: string,
  include?: {
    members?: boolean;
    emailAccounts?: boolean;
    premium?: boolean;
  }
) {
  try {
    return await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: include?.members
          ? {
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
            }
          : undefined,
        emailAccounts: include?.emailAccounts
          ? {
              select: {
                id: true,
                email: true,
                name: true,
                image: true,
              },
            }
          : undefined,
        premium: include?.premium,
      },
    });
  } catch (error) {
    logger.error("Error fetching organization", { organizationId, error });
    return null;
  }
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string) {
  try {
    return await prisma.organization.findUnique({
      where: { slug },
      include: {
        premium: true,
      },
    });
  } catch (error) {
    logger.error("Error fetching organization by slug", { slug, error });
    return null;
  }
}

/**
 * Get all organizations for a user
 */
export async function getUserOrganizations(userId: string) {
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            premium: true,
            _count: {
              select: {
                members: true,
                emailAccounts: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc", // First created org = default personal org
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
      memberCount: m.organization._count.members,
      emailAccountCount: m.organization._count.emailAccounts,
    }));
  } catch (error) {
    logger.error("Error fetching user organizations", { userId, error });
    return [];
  }
}

/**
 * Get user's default organization (first created, usually personal org)
 */
export async function getUserDefaultOrganization(userId: string) {
  try {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId },
      include: {
        organization: {
          include: {
            premium: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!membership) return null;

    return {
      ...membership.organization,
      role: membership.role,
    };
  } catch (error) {
    logger.error("Error fetching default organization", { userId, error });
    return null;
  }
}

/**
 * Get user's membership in an organization
 */
export async function getOrganizationMembership(
  userId: string,
  organizationId: string
) {
  try {
    return await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: {
        organization: true,
      },
    });
  } catch (error) {
    logger.error("Error fetching organization membership", {
      userId,
      organizationId,
      error,
    });
    return null;
  }
}

/**
 * Check if user is a member of an organization
 */
export async function isOrganizationMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await getOrganizationMembership(userId, organizationId);
  return !!membership;
}

/**
 * Check if email account belongs to organization
 */
export async function isEmailAccountInOrganization(
  emailAccountId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { organizationId: true },
    });

    return emailAccount?.organizationId === organizationId;
  } catch (error) {
    logger.error("Error checking email account organization", {
      emailAccountId,
      organizationId,
      error,
    });
    return false;
  }
}

/**
 * Check if user can access an email account (via organization membership)
 */
export async function canAccessEmailAccount(
  userId: string,
  emailAccountId: string
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
 * Create a new organization
 */
export async function createOrganization(data: {
  name: string;
  slug: string;
  ownerId: string;
  domain?: string;
  logoUrl?: string;
}) {
  try {
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        logoUrl: data.logoUrl,
        members: {
          create: {
            userId: data.ownerId,
            role: OrganizationRole.OWNER,
          },
        },
      },
      include: {
        members: {
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
        },
      },
    });

    logger.info("Organization created", {
      organizationId: organization.id,
      slug: organization.slug,
      ownerId: data.ownerId,
    });

    return organization;
  } catch (error) {
    logger.error("Error creating organization", { data, error });
    throw error;
  }
}

/**
 * Update organization details
 */
export async function updateOrganization(
  organizationId: string,
  data: {
    name?: string;
    slug?: string;
    domain?: string;
    logoUrl?: string;
  }
) {
  try {
    return await prisma.organization.update({
      where: { id: organizationId },
      data,
    });
  } catch (error) {
    logger.error("Error updating organization", { organizationId, data, error });
    throw error;
  }
}

/**
 * Add a member to an organization (with seat limit enforcement)
 */
export async function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: OrganizationRole = OrganizationRole.MEMBER
) {
  try {
    // Check seat limits
    const seatCheck = await canAddOrganizationMember(organizationId);
    if (!seatCheck.allowed) {
      throw new Error(seatCheck.reason || "Cannot add member");
    }

    // Create member
    const member = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        role,
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
      },
    });

    // Update seat count
    await updateOrganizationSeats({ organizationId }).catch((error) => {
      logger.error("Failed to update org seats after adding member", {
        organizationId,
        error,
      });
      // Don't throw - member was added successfully
    });

    return member;
  } catch (error) {
    logger.error("Error adding organization member", {
      organizationId,
      userId,
      role,
      error,
    });
    throw error;
  }
}

/**
 * Remove a member from an organization (updates seat count)
 */
export async function removeOrganizationMember(
  organizationId: string,
  userId: string
) {
  try {
    await prisma.organizationMember.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    logger.info("Removed organization member", { organizationId, userId });

    // Update seat count
    await updateOrganizationSeats({ organizationId }).catch((error) => {
      logger.error("Failed to update org seats after removing member", {
        organizationId,
        error,
      });
      // Don't throw - member was removed successfully
    });
  } catch (error) {
    logger.error("Error removing organization member", {
      organizationId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Update member role
 */
export async function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: OrganizationRole
) {
  try {
    return await prisma.organizationMember.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data: { role },
    });
  } catch (error) {
    logger.error("Error updating member role", {
      organizationId,
      userId,
      role,
      error,
    });
    throw error;
  }
}

/**
 * Delete an organization (owner only)
 */
export async function deleteOrganization(organizationId: string) {
  try {
    await prisma.organization.delete({
      where: { id: organizationId },
    });

    logger.info("Organization deleted", { organizationId });
  } catch (error) {
    logger.error("Error deleting organization", { organizationId, error });
    throw error;
  }
}
