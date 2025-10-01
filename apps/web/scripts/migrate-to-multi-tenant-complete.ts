/**
 * Complete Multi-Tenant Migration Script
 *
 * This script performs a complete migration from single-tenant to multi-tenant setup.
 * It combines all migration phases into a single, comprehensive process.
 *
 * What it does:
 * 1. Phase 1: Create organizations for all users
 * 2. Phase 1: Link email accounts to organizations
 * 3. Phase 6: Migrate user Premium to organization-level
 * 4. Verification: Check data integrity
 *
 * Usage:
 *   npx tsx scripts/migrate-to-multi-tenant-complete.ts [options]
 *
 * Options:
 *   --dry-run    Preview changes without making them
 *   --skip-orgs  Skip organization creation (if already done)
 *   --skip-premium  Skip premium migration (if already done)
 */

import prisma from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";
import { OrganizationRole } from "@prisma/client";
import { linkPremiumToOrganization } from "@/utils/organization/billing";

const logger = createScopedLogger("complete-migration");

interface MigrationOptions {
  dryRun: boolean;
  skipOrgs: boolean;
  skipPremium: boolean;
}

interface MigrationStats {
  usersProcessed: number;
  organizationsCreated: number;
  emailAccountsLinked: number;
  premiumsMigrated: number;
  errors: number;
}

/**
 * Phase 1: Create organizations for all users
 */
async function createOrganizations(
  options: MigrationOptions,
): Promise<{ created: number; skipped: number; errors: number }> {
  logger.info("Starting organization creation phase");

  const users = await prisma.user.findMany({
    include: {
      organizationMembers: true,
    },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    // Skip users who already have organizations
    if (user.organizationMembers.length > 0) {
      logger.info("User already has organization, skipping", {
        userId: user.id,
        email: user.email,
      });
      skipped++;
      continue;
    }

    const orgName = user.name ? `${user.name}'s Organization` : "My Organization";
    const orgSlug = `${user.email.split("@")[0]}-${Date.now()}`;

    logger.info("Creating organization for user", {
      userId: user.id,
      email: user.email,
      orgName,
      orgSlug,
    });

    if (!options.dryRun) {
      try {
        await prisma.organization.create({
          data: {
            name: orgName,
            slug: orgSlug,
            members: {
              create: {
                userId: user.id,
                role: OrganizationRole.OWNER,
              },
            },
          },
        });

        logger.info("Organization created successfully", {
          userId: user.id,
          orgSlug,
        });
        created++;
      } catch (error) {
        logger.error("Failed to create organization", {
          userId: user.id,
          email: user.email,
          error,
        });
        errors++;
      }
    } else {
      logger.info("[DRY RUN] Would create organization", {
        userId: user.id,
        orgName,
        orgSlug,
      });
      created++;
    }
  }

  logger.info("Organization creation phase complete", {
    created,
    skipped,
    errors,
  });

  return { created, skipped, errors };
}

/**
 * Phase 1: Link email accounts to organizations
 */
async function linkEmailAccountsToOrganizations(
  options: MigrationOptions,
): Promise<{ linked: number; skipped: number; errors: number }> {
  logger.info("Starting email account linking phase");

  const emailAccounts = await prisma.emailAccount.findMany({
    where: {
      organizationId: null, // Only unlinked accounts
    },
    include: {
      user: {
        include: {
          organizationMembers: {
            orderBy: { createdAt: "asc" },
            take: 1,
            include: {
              organization: true,
            },
          },
        },
      },
    },
  });

  let linked = 0;
  let skipped = 0;
  let errors = 0;

  for (const emailAccount of emailAccounts) {
    const defaultOrg = emailAccount.user.organizationMembers[0]?.organization;

    if (!defaultOrg) {
      logger.warn("User has no organization, cannot link email account", {
        emailAccountId: emailAccount.id,
        userId: emailAccount.userId,
        email: emailAccount.email,
      });
      errors++;
      continue;
    }

    logger.info("Linking email account to organization", {
      emailAccountId: emailAccount.id,
      email: emailAccount.email,
      organizationId: defaultOrg.id,
      organizationName: defaultOrg.name,
    });

    if (!options.dryRun) {
      try {
        await prisma.emailAccount.update({
          where: { id: emailAccount.id },
          data: { organizationId: defaultOrg.id },
        });

        logger.info("Email account linked successfully", {
          emailAccountId: emailAccount.id,
          organizationId: defaultOrg.id,
        });
        linked++;
      } catch (error) {
        logger.error("Failed to link email account", {
          emailAccountId: emailAccount.id,
          error,
        });
        errors++;
      }
    } else {
      logger.info("[DRY RUN] Would link email account", {
        emailAccountId: emailAccount.id,
        organizationId: defaultOrg.id,
      });
      linked++;
    }
  }

  logger.info("Email account linking phase complete", {
    linked,
    skipped,
    errors,
  });

  return { linked, skipped, errors };
}

/**
 * Phase 6: Migrate user Premium to organization-level
 */
async function migratePremiumToOrganizations(
  options: MigrationOptions,
): Promise<{ migrated: number; skipped: number; errors: number }> {
  logger.info("Starting premium migration phase");

  const usersWithPremium = await prisma.user.findMany({
    where: {
      premium: {
        some: {
          id: { not: undefined },
        },
      },
    },
    include: {
      premium: {
        include: {
          organizations: true,
        },
      },
      organizationMembers: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of usersWithPremium) {
    const userPremiums = user.premium;

    for (const premium of userPremiums) {
      // Skip if already linked to an organization
      if (premium.organizations.length > 0) {
        logger.info("Premium already linked to organization, skipping", {
          userId: user.id,
          premiumId: premium.id,
          linkedOrgs: premium.organizations.length,
        });
        skipped++;
        continue;
      }

      const defaultOrg = user.organizationMembers[0]?.organization;

      if (!defaultOrg) {
        logger.error("User has no organization, cannot migrate premium", {
          userId: user.id,
          email: user.email,
        });
        errors++;
        continue;
      }

      logger.info("Migrating Premium to organization", {
        userId: user.id,
        email: user.email,
        premiumId: premium.id,
        premiumTier: premium.tier,
        organizationId: defaultOrg.id,
        organizationName: defaultOrg.name,
      });

      if (!options.dryRun) {
        try {
          await linkPremiumToOrganization({
            premiumId: premium.id,
            organizationId: defaultOrg.id,
          });

          logger.info("Successfully migrated Premium", {
            userId: user.id,
            premiumId: premium.id,
            organizationId: defaultOrg.id,
          });

          migrated++;
        } catch (error) {
          logger.error("Failed to migrate Premium", {
            userId: user.id,
            premiumId: premium.id,
            organizationId: defaultOrg.id,
            error,
          });
          errors++;
        }
      } else {
        logger.info("[DRY RUN] Would migrate Premium to organization", {
          userId: user.id,
          premiumId: premium.id,
          organizationId: defaultOrg.id,
        });
        migrated++;
      }
    }
  }

  logger.info("Premium migration phase complete", {
    migrated,
    skipped,
    errors,
  });

  return { migrated, skipped, errors };
}

/**
 * Verify migration integrity
 */
async function verifyMigration(): Promise<{
  usersWithoutOrgs: number;
  emailAccountsWithoutOrgs: number;
  premiumsWithoutOrgs: number;
}> {
  logger.info("Starting migration verification");

  // Check users without organizations
  const usersWithoutOrgs = await prisma.user.count({
    where: {
      organizationMembers: {
        none: {},
      },
    },
  });

  // Check email accounts without organizations
  const emailAccountsWithoutOrgs = await prisma.emailAccount.count({
    where: {
      organizationId: null,
    },
  });

  // Check premiums not linked to organizations (active premiums)
  const premiums = await prisma.premium.findMany({
    include: {
      organizations: true,
      users: true,
    },
  });

  const premiumsWithoutOrgs = premiums.filter(
    (p) => p.organizations.length === 0 && p.users.length > 0,
  ).length;

  logger.info("Verification complete", {
    usersWithoutOrgs,
    emailAccountsWithoutOrgs,
    premiumsWithoutOrgs,
  });

  return {
    usersWithoutOrgs,
    emailAccountsWithoutOrgs,
    premiumsWithoutOrgs,
  };
}

/**
 * Main migration function
 */
async function runCompleteMigration(options: MigrationOptions) {
  const stats: MigrationStats = {
    usersProcessed: 0,
    organizationsCreated: 0,
    emailAccountsLinked: 0,
    premiumsMigrated: 0,
    errors: 0,
  };

  logger.info("Starting complete multi-tenant migration", { options });

  try {
    // Phase 1: Create organizations
    if (!options.skipOrgs) {
      const orgStats = await createOrganizations(options);
      stats.organizationsCreated = orgStats.created;
      stats.errors += orgStats.errors;
    } else {
      logger.info("Skipping organization creation (--skip-orgs)");
    }

    // Phase 1: Link email accounts
    if (!options.skipOrgs) {
      const emailStats = await linkEmailAccountsToOrganizations(options);
      stats.emailAccountsLinked = emailStats.linked;
      stats.errors += emailStats.errors;
    }

    // Phase 6: Migrate premium
    if (!options.skipPremium) {
      const premiumStats = await migratePremiumToOrganizations(options);
      stats.premiumsMigrated = premiumStats.migrated;
      stats.errors += premiumStats.errors;
    } else {
      logger.info("Skipping premium migration (--skip-premium)");
    }

    // Verification
    if (!options.dryRun) {
      const verification = await verifyMigration();

      console.log("\n📋 Verification Results:");
      console.log(`   Users without organizations: ${verification.usersWithoutOrgs}`);
      console.log(`   Email accounts without organizations: ${verification.emailAccountsWithoutOrgs}`);
      console.log(`   Active premiums without organizations: ${verification.premiumsWithoutOrgs}`);

      if (
        verification.usersWithoutOrgs > 0 ||
        verification.emailAccountsWithoutOrgs > 0 ||
        verification.premiumsWithoutOrgs > 0
      ) {
        console.log("\n⚠️  Warning: Some entities were not migrated. Review logs for details.");
      } else {
        console.log("\n✅ All entities successfully migrated!");
      }
    }

    return stats;
  } catch (error) {
    logger.error("Migration failed", { error });
    throw error;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: false,
    skipOrgs: false,
    skipPremium: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--skip-orgs") {
      options.skipOrgs = true;
    } else if (arg === "--skip-premium") {
      options.skipPremium = true;
    } else if (arg === "--help") {
      console.log(`
Usage: npx tsx scripts/migrate-to-multi-tenant-complete.ts [options]

Options:
  --dry-run        Preview changes without making them
  --skip-orgs      Skip organization creation (if already done)
  --skip-premium   Skip premium migration (if already done)
  --help           Show this help message

Examples:
  # Preview complete migration
  npx tsx scripts/migrate-to-multi-tenant-complete.ts --dry-run

  # Run complete migration
  npx tsx scripts/migrate-to-multi-tenant-complete.ts

  # Run only premium migration (orgs already created)
  npx tsx scripts/migrate-to-multi-tenant-complete.ts --skip-orgs
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

  if (options.dryRun) {
    console.log("🔍 Running in DRY RUN mode - no changes will be made\n");
  }

  console.log("🚀 Starting Complete Multi-Tenant Migration\n");

  const stats = await runCompleteMigration(options);

  console.log("\n📊 Migration Summary:");
  console.log(`   Organizations created: ${stats.organizationsCreated}`);
  console.log(`   Email accounts linked: ${stats.emailAccountsLinked}`);
  console.log(`   Premiums migrated: ${stats.premiumsMigrated}`);
  console.log(`   Errors: ${stats.errors}`);

  if (options.dryRun) {
    console.log("\n💡 Run without --dry-run to apply changes");
  } else {
    console.log("\n✅ Migration complete!");
  }
}

main()
  .catch((error) => {
    logger.error("Migration failed", { error });
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
