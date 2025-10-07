/**
 * Migration Script: User-based Premium → Organization-based Premium
 *
 * This script migrates existing user Premium subscriptions to organization-level billing.
 *
 * What it does:
 * 1. Finds all users with Premium subscriptions
 * 2. Gets their default (personal) organization
 * 3. Links Premium to the organization
 * 4. Calculates and sets initial seat usage
 * 5. Updates Stripe/LemonSqueezy subscription metadata
 *
 * Usage:
 *   npx tsx scripts/migrate-billing-to-orgs.ts
 *
 * Options:
 *   --dry-run    Preview changes without making them
 *   --user-id=X  Migrate specific user only
 */

import prisma from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";
import { linkPremiumToOrganization } from "@/utils/organization/billing";

const logger = createScopedLogger("billing-migration");

interface MigrationOptions {
  dryRun: boolean;
  userId?: string;
}

async function migrateBillingToOrgs(options: MigrationOptions) {
  const { dryRun, userId } = options;

  logger.info("Starting billing migration", { dryRun, userId });

  // Find all users with Premium that's not yet linked to an organization
  const usersWithPremium = await prisma.user.findMany({
    where: {
      id: userId || undefined,
      premium: {
        isNot: null,
      },
    },
    include: {
      premium: {
        include: {
          organizations: true, // Check if already linked
        },
      },
      organizationMembers: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: "asc", // First created = default personal org
        },
      },
    },
  });

  logger.info(`Found ${usersWithPremium.length} users with Premium`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

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
        skippedCount++;
        continue;
      }

      // Get user's default organization (first created, usually personal)
      const defaultOrg = user.organizationMembers[0]?.organization;

      if (!defaultOrg) {
        logger.error("User has no organization, cannot migrate", {
          userId: user.id,
          email: user.email,
        });
        errorCount++;
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

      if (!dryRun) {
        try {
          // Link Premium to organization and calculate seats
          await linkPremiumToOrganization({
            premiumId: premium.id,
            organizationId: defaultOrg.id,
          });

          logger.info("Successfully migrated Premium", {
            userId: user.id,
            premiumId: premium.id,
            organizationId: defaultOrg.id,
          });

          migratedCount++;
        } catch (error) {
          logger.error("Failed to migrate Premium", {
            userId: user.id,
            premiumId: premium.id,
            organizationId: defaultOrg.id,
            error,
          });
          errorCount++;
        }
      } else {
        logger.info("[DRY RUN] Would migrate Premium to organization", {
          userId: user.id,
          premiumId: premium.id,
          organizationId: defaultOrg.id,
        });
        migratedCount++;
      }
    }
  }

  logger.info("Migration complete", {
    total: usersWithPremium.length,
    migrated: migratedCount,
    skipped: skippedCount,
    errors: errorCount,
    dryRun,
  });

  return {
    total: usersWithPremium.length,
    migrated: migratedCount,
    skipped: skippedCount,
    errors: errorCount,
  };
}

// Parse command line arguments
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--user-id=")) {
      options.userId = arg.split("=")[1];
    } else if (arg === "--help") {
      console.log(`
Usage: npx tsx scripts/migrate-billing-to-orgs.ts [options]

Options:
  --dry-run        Preview changes without making them
  --user-id=X      Migrate specific user only
  --help           Show this help message

Examples:
  # Preview migration for all users
  npx tsx scripts/migrate-billing-to-orgs.ts --dry-run

  # Migrate all users
  npx tsx scripts/migrate-billing-to-orgs.ts

  # Migrate specific user only
  npx tsx scripts/migrate-billing-to-orgs.ts --user-id=user_123
      `);
      process.exit(0);
    }
  }

  return options;
}

// Run migration
async function main() {
  const options = parseArgs();

  if (options.dryRun) {
    console.log("🔍 Running in DRY RUN mode - no changes will be made\n");
  }

  const result = await migrateBillingToOrgs(options);

  console.log("\n📊 Migration Summary:");
  console.log(`   Total users with Premium: ${result.total}`);
  console.log(`   ✅ Migrated: ${result.migrated}`);
  console.log(`   ⏭️  Skipped (already linked): ${result.skipped}`);
  console.log(`   ❌ Errors: ${result.errors}`);

  if (options.dryRun) {
    console.log("\n💡 Run without --dry-run to apply changes");
  }
}

main()
  .catch((error) => {
    logger.error("Migration failed", { error });
    console.error("❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
