import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "@/utils/prisma";
import { createOrganization, addOrganizationMember } from "@/utils/organization";
import {
  canAccessEmailAccount,
  canManageEmailAccount,
  getAccessibleEmailAccounts,
  transferEmailAccountOwnership,
  shareEmailAccountWithOrganization,
  unshareEmailAccountFromOrganization,
} from "@/utils/organization/email-accounts";
import { OrganizationRole } from "@prisma/client";

describe("Organization Email Accounts", () => {
  let testUserId: string;
  let testUser2Id: string;
  let testOrgId: string;
  let emailAccountId: string;

  beforeEach(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: `test-email-${Date.now()}@example.com`,
        name: "Test User 1",
      },
    });
    testUserId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `test-email-2-${Date.now()}@example.com`,
        name: "Test User 2",
      },
    });
    testUser2Id = user2.id;

    // Create organization
    const org = await createOrganization({
      name: "Email Test Org",
      slug: `email-test-${Date.now()}`,
      ownerId: testUserId,
    });
    testOrgId = org.id;

    // Create account for email account
    const account = await prisma.account.create({
      data: {
        userId: testUserId,
        type: "oauth",
        provider: "google",
        providerAccountId: `test-${Date.now()}`,
        access_token: "test-token",
      },
    });

    // Create email account
    const emailAccount = await prisma.emailAccount.create({
      data: {
        email: `email-${Date.now()}@example.com`,
        userId: testUserId,
        accountId: account.id,
        organizationId: testOrgId,
      },
    });
    emailAccountId = emailAccount.id;
  });

  afterEach(async () => {
    // Cleanup
    if (emailAccountId) {
      await prisma.emailAccount.delete({ where: { id: emailAccountId } });
    }
    if (testOrgId) {
      await prisma.organization.delete({ where: { id: testOrgId } });
    }
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, testUser2Id] } },
    });
  });

  describe("canAccessEmailAccount", () => {
    it("should allow owner to access", async () => {
      const canAccess = await canAccessEmailAccount(testUserId, emailAccountId);
      expect(canAccess).toBe(true);
    });

    it("should allow org member to access", async () => {
      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );

      const canAccess = await canAccessEmailAccount(
        testUser2Id,
        emailAccountId,
      );
      expect(canAccess).toBe(true);
    });

    it("should deny access to external user", async () => {
      const externalUser = await prisma.user.create({
        data: { email: `external-${Date.now()}@example.com` },
      });

      const canAccess = await canAccessEmailAccount(
        externalUser.id,
        emailAccountId,
      );
      expect(canAccess).toBe(false);

      await prisma.user.delete({ where: { id: externalUser.id } });
    });
  });

  describe("canManageEmailAccount", () => {
    it("should allow owner to manage", async () => {
      const canManage = await canManageEmailAccount(
        testUserId,
        emailAccountId,
        OrganizationRole.MEMBER,
      );
      expect(canManage).toBe(true);
    });

    it("should allow org admin to manage", async () => {
      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.ADMIN,
      );

      const canManage = await canManageEmailAccount(
        testUser2Id,
        emailAccountId,
        OrganizationRole.ADMIN,
      );
      expect(canManage).toBe(true);
    });

    it("should deny management to regular member", async () => {
      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );

      const canManage = await canManageEmailAccount(
        testUser2Id,
        emailAccountId,
        OrganizationRole.MEMBER,
      );
      expect(canManage).toBe(false);
    });
  });

  describe("getAccessibleEmailAccounts", () => {
    it("should return owned email accounts", async () => {
      const accounts = await getAccessibleEmailAccounts(testUserId);

      expect(accounts.length).toBeGreaterThanOrEqual(1);
      expect(accounts.some((a) => a.id === emailAccountId)).toBe(true);
    });

    it("should return org email accounts", async () => {
      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );

      const accounts = await getAccessibleEmailAccounts(testUser2Id);

      // Should include email account from organization
      expect(accounts.some((a) => a.id === emailAccountId)).toBe(true);
    });
  });

  describe("transferEmailAccountOwnership", () => {
    beforeEach(async () => {
      // Add user2 to organization
      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );
    });

    it("should transfer ownership to org member", async () => {
      const result = await transferEmailAccountOwnership({
        emailAccountId,
        currentUserId: testUserId,
        targetUserId: testUser2Id,
        role: OrganizationRole.OWNER,
      });

      expect(result.success).toBe(true);

      // Verify new owner
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
      });
      expect(emailAccount?.userId).toBe(testUser2Id);
    });

    it("should fail transfer to non-org member", async () => {
      const externalUser = await prisma.user.create({
        data: { email: `external-transfer-${Date.now()}@example.com` },
      });

      const result = await transferEmailAccountOwnership({
        emailAccountId,
        currentUserId: testUserId,
        targetUserId: externalUser.id,
        role: OrganizationRole.OWNER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("same organization");

      await prisma.user.delete({ where: { id: externalUser.id } });
    });

    it("should fail transfer by non-owner member", async () => {
      const result = await transferEmailAccountOwnership({
        emailAccountId,
        currentUserId: testUser2Id,
        targetUserId: testUserId,
        role: OrganizationRole.MEMBER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("permission");
    });
  });

  describe("shareEmailAccountWithOrganization", () => {
    let personalEmailAccountId: string;

    beforeEach(async () => {
      // Create personal email account (not shared)
      const account = await prisma.account.create({
        data: {
          userId: testUserId,
          type: "oauth",
          provider: "google",
          providerAccountId: `personal-${Date.now()}`,
          access_token: "test-token",
        },
      });

      const personalAccount = await prisma.emailAccount.create({
        data: {
          email: `personal-${Date.now()}@example.com`,
          userId: testUserId,
          accountId: account.id,
          organizationId: null, // Personal, not shared
        },
      });
      personalEmailAccountId = personalAccount.id;
    });

    afterEach(async () => {
      if (personalEmailAccountId) {
        await prisma.emailAccount.delete({
          where: { id: personalEmailAccountId },
        });
      }
    });

    it("should share personal account with organization", async () => {
      const result = await shareEmailAccountWithOrganization({
        emailAccountId: personalEmailAccountId,
        userId: testUserId,
        organizationId: testOrgId,
      });

      expect(result.success).toBe(true);

      // Verify shared
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: personalEmailAccountId },
      });
      expect(emailAccount?.organizationId).toBe(testOrgId);
    });

    it("should fail share by non-owner", async () => {
      const result = await shareEmailAccountWithOrganization({
        emailAccountId: personalEmailAccountId,
        userId: testUser2Id,
        organizationId: testOrgId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("owner");
    });
  });

  describe("unshareEmailAccountFromOrganization", () => {
    it("should unshare email account", async () => {
      const result = await unshareEmailAccountFromOrganization({
        emailAccountId,
        userId: testUserId,
      });

      expect(result.success).toBe(true);

      // Verify unshared
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
      });
      expect(emailAccount?.organizationId).toBeNull();
    });

    it("should fail unshare by non-owner", async () => {
      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );

      const result = await unshareEmailAccountFromOrganization({
        emailAccountId,
        userId: testUser2Id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("owner");
    });
  });
});
