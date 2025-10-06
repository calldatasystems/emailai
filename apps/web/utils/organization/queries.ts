import type { Prisma } from "@prisma/client";

/**
 * Organization-Scoped Query Helpers
 *
 * These utilities help build Prisma where clauses that respect organization boundaries.
 * All queries should use these helpers to ensure proper data isolation.
 */

/**
 * Build a where clause for resources scoped to an email account (which belongs to an org)
 *
 * @example
 * const where = orgScopedEmailAccountWhere({
 *   emailAccountId,
 *   organizationId,
 *   additionalFilters: { name: { contains: 'test' } }
 * });
 */
export function orgScopedEmailAccountWhere({
  emailAccountId,
  organizationId,
  additionalFilters,
}: {
  emailAccountId: string;
  organizationId?: string;
  additionalFilters?: Record<string, any>;
}): Prisma.RuleWhereInput | Prisma.GroupWhereInput | Prisma.KnowledgeWhereInput {
  const base = organizationId
    ? {
        emailAccountId,
        emailAccount: {
          organizationId, // Ensure the email account belongs to the org
        },
      }
    : {
        // Fallback: just filter by email account (backwards compatibility)
        emailAccountId,
      };

  return additionalFilters ? { ...base, ...additionalFilters } : base;
}

/**
 * Build a where clause for email accounts in an organization
 *
 * @example
 * const where = orgScopedEmailAccountsWhere({ userId, organizationId });
 */
export function orgScopedEmailAccountsWhere({
  userId,
  organizationId,
  additionalFilters,
}: {
  userId: string;
  organizationId?: string;
  additionalFilters?: Record<string, any>;
}): Prisma.EmailAccountWhereInput {
  const base = organizationId
    ? {
        // For org members: show all email accounts in the organization
        organizationId,
      }
    : {
        // Fallback: show user's personal accounts (backwards compatibility)
        userId,
      };

  return additionalFilters ? { ...base, ...additionalFilters } : base;
}

/**
 * Verify that an email account belongs to an organization
 */
export function verifyEmailAccountOrganization({
  organizationId,
}: {
  organizationId: string;
}): Prisma.EmailAccountWhereInput {
  return {
    organizationId,
  };
}

/**
 * Build a where clause for resources that might not have an email account relation
 * but should still be scoped to an organization
 */
export function orgScopedDirectWhere({
  organizationId,
  additionalFilters,
}: {
  organizationId?: string;
  additionalFilters?: Record<string, any>;
}): Record<string, any> {
  if (!organizationId) {
    return additionalFilters || {};
  }

  return additionalFilters
    ? { organizationId, ...additionalFilters }
    : { organizationId };
}

/**
 * Helper to check if a query should use organization scoping
 */
export function shouldUseOrgScoping(organizationId?: string): boolean {
  return !!organizationId;
}

/**
 * Build organization context for logging/auditing
 */
export function getOrgContext({
  userId,
  organizationId,
  emailAccountId,
}: {
  userId: string;
  organizationId?: string;
  emailAccountId?: string;
}) {
  return {
    userId,
    organizationId: organizationId || null,
    emailAccountId: emailAccountId || null,
  };
}
