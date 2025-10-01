import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "@/utils/prisma";
import {
  createOrganization,
  getOrganization,
  getUserOrganizations,
  getUserDefaultOrganization,
  addOrganizationMember,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  isOrganizationMember,
  canAccessEmailAccount,
} from "@/utils/organization";
import { OrganizationRole } from "@prisma/client";

describe("Organization Management", () => {
  let testUserId: string;
  let testUser2Id: string;
  let testOrgId: string;

  beforeEach(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: "Test User 1",
      },
    });
    testUserId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `test2-${Date.now()}@example.com`,
        name: "Test User 2",
      },
    });
    testUser2Id = user2.id;
  });

  afterEach(async () => {
    // Cleanup
    if (testOrgId) {
      await prisma.organization.delete({ where: { id: testOrgId } });
    }
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, testUser2Id] } },
    });
  });

  describe("createOrganization", () => {
    it("should create organization with owner", async () => {
      const org = await createOrganization({
        name: "Test Org",
        slug: `test-org-${Date.now()}`,
        ownerId: testUserId,
      });

      testOrgId = org.id;

      expect(org).toBeDefined();
      expect(org.name).toBe("Test Org");
      expect(org.members).toHaveLength(1);
      expect(org.members[0].userId).toBe(testUserId);
      expect(org.members[0].role).toBe(OrganizationRole.OWNER);
    });

    it("should create organization with domain", async () => {
      const org = await createOrganization({
        name: "Acme Corp",
        slug: `acme-${Date.now()}`,
        ownerId: testUserId,
        domain: "acme.com",
      });

      testOrgId = org.id;

      expect(org.domain).toBe("acme.com");
    });
  });

  describe("getOrganization", () => {
    beforeEach(async () => {
      const org = await createOrganization({
        name: "Test Org",
        slug: `test-${Date.now()}`,
        ownerId: testUserId,
      });
      testOrgId = org.id;
    });

    it("should get organization with members", async () => {
      const org = await getOrganization(testOrgId, { members: true });

      expect(org).toBeDefined();
      expect(org?.members).toBeDefined();
      expect(org?.members).toHaveLength(1);
    });

    it("should return null for non-existent organization", async () => {
      const org = await getOrganization("non-existent-id");
      expect(org).toBeNull();
    });
  });

  describe("getUserOrganizations", () => {
    beforeEach(async () => {
      const org1 = await createOrganization({
        name: "Org 1",
        slug: `org1-${Date.now()}`,
        ownerId: testUserId,
      });
      testOrgId = org1.id;

      // Add user to another org
      const org2 = await createOrganization({
        name: "Org 2",
        slug: `org2-${Date.now()}`,
        ownerId: testUser2Id,
      });

      await addOrganizationMember(org2.id, testUserId, OrganizationRole.MEMBER);
    });

    it("should get all user organizations", async () => {
      const orgs = await getUserOrganizations(testUserId);

      expect(orgs.length).toBeGreaterThanOrEqual(2);
      expect(orgs[0].role).toBeDefined();
      expect(orgs[0].memberCount).toBeDefined();
    });

    it("should order by creation date", async () => {
      const orgs = await getUserOrganizations(testUserId);

      // First org should be the oldest (default personal org)
      expect(orgs[0].name).toBe("Org 1");
    });
  });

  describe("getUserDefaultOrganization", () => {
    beforeEach(async () => {
      const org = await createOrganization({
        name: "Default Org",
        slug: `default-${Date.now()}`,
        ownerId: testUserId,
      });
      testOrgId = org.id;
    });

    it("should get user's first created organization", async () => {
      const defaultOrg = await getUserDefaultOrganization(testUserId);

      expect(defaultOrg).toBeDefined();
      expect(defaultOrg?.name).toBe("Default Org");
      expect(defaultOrg?.role).toBe(OrganizationRole.OWNER);
    });

    it("should return null for user with no organizations", async () => {
      const newUser = await prisma.user.create({
        data: { email: `no-org-${Date.now()}@example.com` },
      });

      const defaultOrg = await getUserDefaultOrganization(newUser.id);
      expect(defaultOrg).toBeNull();

      await prisma.user.delete({ where: { id: newUser.id } });
    });
  });

  describe("addOrganizationMember", () => {
    beforeEach(async () => {
      const org = await createOrganization({
        name: "Test Org",
        slug: `test-${Date.now()}`,
        ownerId: testUserId,
      });
      testOrgId = org.id;
    });

    it("should add member to organization", async () => {
      const member = await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );

      expect(member.userId).toBe(testUser2Id);
      expect(member.organizationId).toBe(testOrgId);
      expect(member.role).toBe(OrganizationRole.MEMBER);
    });

    it("should add admin to organization", async () => {
      const admin = await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.ADMIN,
      );

      expect(admin.role).toBe(OrganizationRole.ADMIN);
    });
  });

  describe("removeOrganizationMember", () => {
    beforeEach(async () => {
      const org = await createOrganization({
        name: "Test Org",
        slug: `test-${Date.now()}`,
        ownerId: testUserId,
      });
      testOrgId = org.id;

      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );
    });

    it("should remove member from organization", async () => {
      await removeOrganizationMember(testOrgId, testUser2Id);

      const isMember = await isOrganizationMember(testUser2Id, testOrgId);
      expect(isMember).toBe(false);
    });
  });

  describe("updateOrganizationMemberRole", () => {
    beforeEach(async () => {
      const org = await createOrganization({
        name: "Test Org",
        slug: `test-${Date.now()}`,
        ownerId: testUserId,
      });
      testOrgId = org.id;

      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );
    });

    it("should update member role to admin", async () => {
      await updateOrganizationMemberRole(
        testOrgId,
        testUser2Id,
        OrganizationRole.ADMIN,
      );

      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: testUser2Id,
            organizationId: testOrgId,
          },
        },
      });

      expect(membership?.role).toBe(OrganizationRole.ADMIN);
    });
  });

  describe("isOrganizationMember", () => {
    beforeEach(async () => {
      const org = await createOrganization({
        name: "Test Org",
        slug: `test-${Date.now()}`,
        ownerId: testUserId,
      });
      testOrgId = org.id;
    });

    it("should return true for organization member", async () => {
      const isMember = await isOrganizationMember(testUserId, testOrgId);
      expect(isMember).toBe(true);
    });

    it("should return false for non-member", async () => {
      const isMember = await isOrganizationMember(testUser2Id, testOrgId);
      expect(isMember).toBe(false);
    });
  });

  describe("canAccessEmailAccount", () => {
    let emailAccountId: string;

    beforeEach(async () => {
      const org = await createOrganization({
        name: "Test Org",
        slug: `test-${Date.now()}`,
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
          email: `test-${Date.now()}@example.com`,
          userId: testUserId,
          accountId: account.id,
          organizationId: testOrgId,
        },
      });
      emailAccountId = emailAccount.id;
    });

    afterEach(async () => {
      if (emailAccountId) {
        await prisma.emailAccount.delete({ where: { id: emailAccountId } });
      }
    });

    it("should allow owner to access email account", async () => {
      const canAccess = await canAccessEmailAccount(testUserId, emailAccountId);
      expect(canAccess).toBe(true);
    });

    it("should allow org member to access email account", async () => {
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

    it("should deny access to non-org member", async () => {
      const canAccess = await canAccessEmailAccount(
        testUser2Id,
        emailAccountId,
      );
      expect(canAccess).toBe(false);
    });
  });
});
