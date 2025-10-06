/**
 * Multi-Tenant Migration Rollback Script
 *
 * This script provides rollback capabilities for the multi-tenant migration.
 * Use with extreme caution in production.
 *
 * What it does:
 * 1. Unlink email accounts from organizations
 * 2. Unlink premiums from organizations
 * 3. Optionally delete organizations
 *
 * Usage:
 *   npx tsx scripts/rollback-multi-tenant.ts [options]
 *
 * Options:
 *   --dry-run           Preview changes without making them
 *   --keep-orgs         Keep organizations, only unlink relationships
 *   --organization-id=X Rollback specific organization only
 */

import prisma from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("rollback-migration");

interface RollbackOptions {
  dryRun: boolean;
  keepOrgs: boolean;
  organizationId?: string;
}

interface RollbackStats {
  emailAccountsUnlinked: number;
  premiumsUnlinked: number;
  organizationsDeleted: number;
  errors: number;
}

/**
 * Unlink email accounts from organizations
 */
async function unlinkEmailAccounts(
  options: RollbackOptions,
): Promise<{ unlinked: number; errors: number }> {
  logger.info("Starting email account unlinking");

  const where = options.organizationId
    ? { organizationId: options.organizationId }
    : { organizationId: { not: null } };

  const emailAccounts = await prisma.emailAccount.findMany({
    where,
    select: {
      id: true,
      email: true,
      organizationId: true,
    },
  });

  logger.info(`Found ${emailAccounts.length} email accounts to unlink`);

  let unlinked = 0;
  let errors = 0;

  for (const emailAccount of emailAccounts) {
    logger.info("Unlinking email account from organization", {
      emailAccountId: emailAccount.id,
      email: emailAccount.email,
      organizationId: emailAccount.organizationId,
    });

    if (!options.dryRun) {
      try {
        await prisma.emailAccount.update({
          where: { id: emailAccount.id },
          data: { organizationId: null },
        });

        logger.info("Email account unlinked", {
          emailAccountId: emailAccount.id,
        });
        unlinked++;
      } catch (error) {
        logger.error("Failed to unlink email account", {
          emailAccountId: emailAccount.id,
          error,
        });
        errors++;
      }
    } else {
      logger.info("[DRY RUN] Would unlink email account", {
        emailAccountId: emailAccount.id,
      });
      unlinked++;
    }
  }

  logger.info("Email account unlinking complete", { unlinked, errors });

  return { unlinked, errors };
}

/**
 * Unlink premiums from organizations
 */
async function unlinkPremiums(
  options: RollbackOptions,
): Promise<{ unlinked: number; errors: number }> {
  logger.info("Starting premium unlinking");

  const premiums = await prisma.premium.findMany({
    include: {
      organizations: true,
    },
  });

  const premiumsToUnlink = options.organizationId
    ? premiums.filter((p) =>
        p.organizations.some((o) => o.id === options.organizationId),
      )
    : premiums.filter((p) => p.organizations.length > 0);

  logger.info(`Found ${premiumsToUnlink.length} premiums to unlink`);

  let unlinked = 0;
  let errors = 0;

  for (const premium of premiumsToUnlink) {
    logger.info("Unlinking premium from organizations", {
      premiumId: premium.id,
      tier: premium.tier,
      organizationCount: premium.organizations.length,
    });

    if (!options.dryRun) {
      try {
        const orgIdsToDisconnect = options.organizationId
          ? [options.organizationId]
          : premium.organizations.map((o) => o.id);

        await prisma.premium.update({
          where: { id: premium.id },
          data: {
            organizations: {
              disconnect: orgIdsToDisconnect.map((id) => ({ id })),
            },
            usedSeats: 1, // Reset to single user
          },
        });

        logger.info("Premium unlinked", {
          premiumId: premium.id,
        });
        unlinked++;
      } catch (error) {
        logger.error("Failed to unlink premium", {
          premiumId: premium.id,
          error,
        });
        errors++;
      }
    } else {
      logger.info("[DRY RUN] Would unlink premium", {
        premiumId: premium.id,
      });
      unlinked++;
    }
  }

  logger.info("Premium unlinking complete", { unlinked, errors });

  return { unlinked, errors };
}

/**
 * Delete organizations (optional)
 */
async function deleteOrganizations(
  options: RollbackOptions,
): Promise<{ deleted: number; errors: number }> {
  logger.info("Starting organization deletion");

  const where = options.organizationId
    ? { id: options.organizationId }
    : {};

  const organizations = await prisma.organization.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          members: true,
          emailAccounts: true,
        },
      },
    },
  });

  logger.info(`Found ${organizations.length} organizations to delete`);

  let deleted = 0;
  let errors = 0;

  for (const org of organizations) {
    // Safety check: warn about organizations with data
    if (org._count.emailAccounts > 0) {
      logger.warn(
        "Organization still has email accounts, skipping deletion",
        {
          organizationId: org.id,
          name: org.name,
          emailAccounts: org._count.emailAccounts,
        },
      );
      errors++;
      continue;
    }

    logger.info("Deleting organization", {
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      members: org._count.members,
    });

    if (!options.dryRun) {
      try {
        await prisma.organization.delete({
          where: { id: org.id },
        });

        logger.info("Organization deleted", {
          organizationId: org.id,
        });
        deleted++;
      } catch (error) {
        logger.error("Failed to delete organization", {
          organizationId: org.id,
          error,
        });
        errors++;
      }
    } else {
      logger.info("[DRY RUN] Would delete organization", {
        organizationId: org.id,
      });
      deleted++;
    }
  }

  logger.info("Organization deletion complete", { deleted, errors });

  return { deleted, errors };
}

/**
 * Main rollback function
 */
async function runRollback(options: RollbackOptions) {
  const stats: RollbackStats = {
    emailAccountsUnlinked: 0,
    premiumsUnlinked: 0,
    organizationsDeleted: 0,
    errors: 0,
  };

  logger.info("Starting multi-tenant rollback", { options });

  try {
    // Step 1: Unlink email accounts
    const emailStats = await unlinkEmailAccounts(options);
    stats.emailAccountsUnlinked = emailStats.unlinked;
    stats.errors += emailStats.errors;

    // Step 2: Unlink premiums
    const premiumStats = await unlinkPremiums(options);
    stats.premiumsUnlinked = premiumStats.unlinked;
    stats.errors += premiumStats.errors;

    // Step 3: Delete organizations (if not keeping)
    if (!options.keepOrgs) {
      const orgStats = await deleteOrganizations(options);
      stats.organizationsDeleted = orgStats.deleted;
      stats.errors += orgStats.errors;
    } else {
      logger.info("Keeping organizations (--keep-orgs)");
    }

    return stats;
  } catch (error) {
    logger.error("Rollback failed", { error });
    throw error;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): RollbackOptions {
  const args = process.argv.slice(2);

  const options: RollbackOptions = {
    dryRun: false,
    keepOrgs: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--keep-orgs") {
      options.keepOrgs = true;
    } else if (arg.startsWith("--organization-id=")) {
      options.organizationId = arg.split("=")[1];
    } else if (arg === "--help") {
      console.log(`
Usage: npx tsx scripts/rollback-multi-tenant.ts [options]

Options:
  --dry-run              Preview changes without making them
  --keep-orgs            Keep organizations, only unlink relationships
  --organization-id=X    Rollback specific organization only
  --help                 Show this help message

Examples:
  # Preview rollback
  npx tsx scripts/rollback-multi-tenant.ts --dry-run

  # Rollback but keep empty organizations
  npx tsx scripts/rollback-multi-tenant.ts --keep-orgs

  # Rollback specific organization
  npx tsx scripts/rollback-multi-tenant.ts --organization-id=org_123

  # Complete rollback (removes everything)
  npx tsx scripts/rollback-multi-tenant.ts

⚠️  WARNING: This script will unlink email accounts and premiums from organizations.
⚠️  Always run with --dry-run first to preview changes.
⚠️  Consider backing up your database before running.
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();

  console.log("⚠️  WARNING: This will rollback multi-tenant migration!\n");

  if (options.dryRun) {
    console.log("🔍 Running in DRY RUN mode - no changes will be made\n");
  } else {
    console.log("⚠️  Running in LIVE mode - changes will be applied!\n");
    console.log("🛑 Press Ctrl+C now to cancel, or wait 5 seconds to continue...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log("🔄 Starting rollback...\n");

  const stats = await runRollback(options);

  console.log("\n📊 Rollback Summary:");
  console.log(`   Email accounts unlinked: ${stats.emailAccountsUnlinked}`);
  console.log(`   Premiums unlinked: ${stats.premiumsUnlinked}`);
  console.log(`   Organizations deleted: ${stats.organizationsDeleted}`);
  console.log(`   Errors: ${stats.errors}`);

  if (options.dryRun) {
    console.log("\n💡 Run without --dry-run to apply changes");
  } else {
    console.log("\n✅ Rollback complete!");
  }
}

main()
  .catch((error) => {
    logger.error("Rollback failed", { error });
    console.error("\n❌ Rollback failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
