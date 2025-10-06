import prisma from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";
import { updateSubscriptionItemQuantity } from "@/ee/billing/lemon/index";
import { updateStripeSubscriptionItemQuantity } from "@/ee/billing/stripe/index";

const logger = createScopedLogger("organization-billing");

/**
 * Organization-Level Billing Utilities
 *
 * Handles seat-based billing at the organization level
 */

/**
 * Calculate seat usage for an organization
 */
export async function calculateOrganizationSeats(
  organizationId: string,
): Promise<number> {
  // Count members in the organization
  const memberCount = await prisma.organizationMember.count({
    where: { organizationId },
  });

  return memberCount;
}

/**
 * Update organization seat count and sync with payment provider
 */
export async function updateOrganizationSeats({
  organizationId,
}: {
  organizationId: string;
}) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      premium: {
        select: {
          id: true,
          lemonSqueezySubscriptionItemId: true,
          stripeSubscriptionItemId: true,
          maxSeats: true,
        },
      },
    },
  });

  if (!organization?.premium) {
    logger.warn("Organization has no premium", { organizationId });
    return;
  }

  const { premium } = organization;

  // Calculate total seats used
  const usedSeats = await calculateOrganizationSeats(organizationId);

  logger.info("Updating organization seats", {
    organizationId,
    usedSeats,
    maxSeats: premium.maxSeats,
  });

  // Update seats in database
  await prisma.premium.update({
    where: { id: premium.id },
    data: { usedSeats },
  });

  // Sync with payment provider
  if (premium.stripeSubscriptionItemId) {
    try {
      await updateStripeSubscriptionItemQuantity(
        premium.stripeSubscriptionItemId,
        usedSeats,
      );
      logger.info("Updated Stripe subscription", {
        organizationId,
        seats: usedSeats,
      });
    } catch (error) {
      logger.error("Failed to update Stripe subscription", {
        organizationId,
        error,
      });
      throw error;
    }
  } else if (premium.lemonSqueezySubscriptionItemId) {
    try {
      await updateSubscriptionItemQuantity(
        premium.lemonSqueezySubscriptionItemId,
        usedSeats,
      );
      logger.info("Updated LemonSqueezy subscription", {
        organizationId,
        seats: usedSeats,
      });
    } catch (error) {
      logger.error("Failed to update LemonSqueezy subscription", {
        organizationId,
        error,
      });
      throw error;
    }
  }

  return { usedSeats, maxSeats: premium.maxSeats };
}

/**
 * Check if organization can add more members
 */
export async function canAddOrganizationMember(
  organizationId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      premium: {
        select: {
          maxSeats: true,
          usedSeats: true,
        },
      },
    },
  });

  if (!organization?.premium) {
    return {
      allowed: false,
      reason: "Organization does not have a premium subscription",
    };
  }

  const { maxSeats, usedSeats } = organization.premium;

  // Null maxSeats means unlimited
  if (maxSeats === null) {
    return { allowed: true };
  }

  if (usedSeats >= maxSeats) {
    return {
      allowed: false,
      reason: `Seat limit reached (${usedSeats}/${maxSeats}). Please upgrade your plan.`,
    };
  }

  return { allowed: true };
}

/**
 * Get organization billing info
 */
export async function getOrganizationBilling(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      premium: {
        select: {
          id: true,
          tier: true,
          maxSeats: true,
          usedSeats: true,
          lemonSqueezyRenewsAt: true,
          lemonSqueezySubscriptionStatus: true,
          stripeRenewsAt: true,
          stripeSubscriptionStatus: true,
          stripeCancelAtPeriodEnd: true,
        },
      },
      _count: {
        select: {
          members: true,
          emailAccounts: true,
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const hasStripe = !!organization.premium?.stripeSubscriptionStatus;
  const hasLemon = !!organization.premium?.lemonSqueezySubscriptionStatus;

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    hasPremium: !!organization.premium,
    tier: organization.premium?.tier || null,
    seats: {
      used: organization.premium?.usedSeats || 0,
      max: organization.premium?.maxSeats || null,
      available:
        organization.premium?.maxSeats === null
          ? null // unlimited
          : (organization.premium?.maxSeats || 0) -
            (organization.premium?.usedSeats || 0),
    },
    members: organization._count.members,
    emailAccounts: organization._count.emailAccounts,
    subscription: {
      status: hasStripe
        ? organization.premium?.stripeSubscriptionStatus
        : organization.premium?.lemonSqueezySubscriptionStatus,
      renewsAt: hasStripe
        ? organization.premium?.stripeRenewsAt
        : organization.premium?.lemonSqueezyRenewsAt,
      willCancel: organization.premium?.stripeCancelAtPeriodEnd || false,
      provider: hasStripe ? "stripe" : hasLemon ? "lemon" : null,
    },
  };
}

/**
 * Check if organization has active premium
 */
export async function hasOrganizationPremium(
  organizationId: string,
): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      premium: {
        select: {
          id: true,
          lemonSqueezyRenewsAt: true,
          stripeRenewsAt: true,
          tier: true,
        },
      },
    },
  });

  if (!organization?.premium) {
    return false;
  }

  const { premium } = organization;

  // Check if subscription is active (not expired)
  const now = new Date();
  const hasActiveLemon =
    premium.lemonSqueezyRenewsAt && premium.lemonSqueezyRenewsAt > now;
  const hasActiveStripe =
    premium.stripeRenewsAt && premium.stripeRenewsAt > now;

  return !!(hasActiveLemon || hasActiveStripe || premium.tier === "LIFETIME");
}

/**
 * Enforce seat limits when adding members
 */
export async function enforceSeatLimit({
  organizationId,
  action,
}: {
  organizationId: string;
  action: "add_member" | "add_email_account";
}): Promise<void> {
  const canAdd = await canAddOrganizationMember(organizationId);

  if (!canAdd.allowed) {
    throw new Error(canAdd.reason || "Cannot add member");
  }
}

/**
 * Link premium to organization (for migration)
 */
export async function linkPremiumToOrganization({
  premiumId,
  organizationId,
}: {
  premiumId: string;
  organizationId: string;
}) {
  // Update premium to link to organization
  await prisma.premium.update({
    where: { id: premiumId },
    data: {
      organizations: {
        connect: { id: organizationId },
      },
    },
  });

  // Calculate and update seats
  await updateOrganizationSeats({ organizationId });

  logger.info("Linked premium to organization", { premiumId, organizationId });
}
