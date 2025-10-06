/**
 * Data Migration Script: Single-tenant to Multi-tenant Organizations
 *
 * This script migrates existing users to the organization-based multi-tenant structure.
 * It creates a default personal organization for each existing user and links their
 * email accounts to that organization.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-to-multi-tenant.ts [--dry-run]
 */

import prisma from "@/utils/prisma";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("migrate-to-multi-tenant");

interface MigrationStats {
  usersProcessed: number;
  organizationsCreated: number;
  membershipsCreated: number;
  emailAccountsLinked: number;
  errors: number;
}

function generateSlug(email: string): string {
  // Generate a URL-safe slug from email
  const username = email.split("@")[0];
  const slug = username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Add random suffix to ensure uniqueness
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${randomSuffix}`;
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

async function migrateUser(
  userId: string,
  email: string,
  name: string | null,
  dryRun: boolean,
  stats: MigrationStats
): Promise<void> {
  logger.info(`Processing user: ${email}`, { userId });

  try {
    // Check if user already has an organization
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId },
      include: { organization: true },
    });

    if (existingMembership) {
      logger.info(`User already has organization, skipping`, {
        userId,
        email,
        organizationId: existingMembership.organizationId,
      });
      stats.usersProcessed++;
      return;
    }

    // Generate unique slug
    const baseSlug = generateSlug(email);
    const slug = await ensureUniqueSlug(baseSlug);

    const orgName = name ? `${name}'s Organization` : `${email}'s Organization`;

    if (dryRun) {
      logger.info("[DRY RUN] Would create organization", {
        userId,
        email,
        orgName,
        slug,
      });
      stats.organizationsCreated++;
      stats.membershipsCreated++;
    } else {
      // Create organization
      const organization = await prisma.organization.create({
        data: {
          name: orgName,
          slug,
        },
      });

      logger.info(`Created organization`, {
        organizationId: organization.id,
        slug: organization.slug,
        userId,
      });
      stats.organizationsCreated++;

      // Create organization membership with OWNER role
      await prisma.organizationMember.create({
        data: {
          userId,
          organizationId: organization.id,
          role: "OWNER",
        },
      });

      logger.info(`Created organization membership`, {
        userId,
        organizationId: organization.id,
        role: "OWNER",
      });
      stats.membershipsCreated++;

      // Link all user's email accounts to the organization
      const emailAccounts = await prisma.emailAccount.findMany({
        where: { userId },
        select: { id: true, email: true },
      });

      if (emailAccounts.length > 0) {
        await prisma.emailAccount.updateMany({
          where: { userId },
          data: { organizationId: organization.id },
        });

        logger.info(`Linked email accounts to organization`, {
          userId,
          organizationId: organization.id,
          count: emailAccounts.length,
          emails: emailAccounts.map((a) => a.email),
        });
        stats.emailAccountsLinked += emailAccounts.length;
      }
    }

    stats.usersProcessed++;
  } catch (error) {
    logger.error(`Error migrating user ${email}`, {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    stats.errors++;
  }
}

async function runMigration(dryRun: boolean = false): Promise<void> {
  logger.info(
    `Starting multi-tenant migration ${dryRun ? "(DRY RUN)" : ""}...`
  );

  const stats: MigrationStats = {
    usersProcessed: 0,
    organizationsCreated: 0,
    membershipsCreated: 0,
    emailAccountsLinked: 0,
    errors: 0,
  };

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    logger.info(`Found ${users.length} users to process`);

    // Process each user
    for (const user of users) {
      await migrateUser(user.id, user.email, user.name, dryRun, stats);
    }

    // Print summary
    logger.info("Migration completed!", {
      dryRun,
      stats,
    });

    console.log("\n=== Migration Summary ===");
    console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
    console.log(`Users processed: ${stats.usersProcessed}`);
    console.log(`Organizations created: ${stats.organizationsCreated}`);
    console.log(`Memberships created: ${stats.membershipsCreated}`);
    console.log(`Email accounts linked: ${stats.emailAccountsLinked}`);
    console.log(`Errors: ${stats.errors}`);
    console.log("========================\n");

    if (dryRun) {
      console.log("This was a dry run. No changes were made to the database.");
      console.log("Run without --dry-run to apply changes.");
    }
  } catch (error) {
    logger.error("Migration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const isDryRun = process.argv.includes("--dry-run");

runMigration(isDryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
