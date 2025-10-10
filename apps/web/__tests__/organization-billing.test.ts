import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "@/utils/prisma";
import {
  createOrganization,
  addOrganizationMember,
  removeOrganizationMember,
} from "@/utils/organization";
import {
  calculateOrganizationSeats,
  canAddOrganizationMember,
  getOrganizationBilling,
  hasOrganizationPremium,
} from "@/utils/organization/billing";
import { OrganizationRole, PremiumTier } from "@prisma/client";

describe("Organization Billing", () => {
  let testUserId: string;
  let testUser2Id: string;
  let testOrgId: string;

  beforeEach(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: `test-billing-${Date.now()}@example.com`,
        name: "Test User 1",
      },
    });
    testUserId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `test-billing-2-${Date.now()}@example.com`,
        name: "Test User 2",
      },
    });
    testUser2Id = user2.id;

    // Create organization
    const org = await createOrganization({
      name: "Billing Test Org",
      slug: `billing-test-${Date.now()}`,
      ownerId: testUserId,
    });
    testOrgId = org.id;
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

  describe("calculateOrganizationSeats", () => {
    it("should count organization members", async () => {
      const seats = await calculateOrganizationSeats(testOrgId);
      expect(seats).toBe(1); // Only owner

      await addOrganizationMember(
        testOrgId,
        testUser2Id,
        OrganizationRole.MEMBER,
      );

      const seatsAfter = await calculateOrganizationSeats(testOrgId);
      expect(seatsAfter).toBe(2);
    });
  });

  describe("canAddOrganizationMember", () => {
    it("should allow adding member when no premium (free tier)", async () => {
      const result = await canAddOrganizationMember(testOrgId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("does not have a premium subscription");
    });

    it("should allow adding member with unlimited seats", async () => {
      // Create premium with unlimited seats
      const premium = await prisma.premium.create({
        data: {
          tier: PremiumTier.BUSINESS_ANNUALLY,
          maxSeats: null, // Unlimited
          usedSeats: 1,
        },
      });

      await prisma.organization.update({
        where: { id: testOrgId },
        data: { premiumId: premium.id },
      });

      const result = await canAddOrganizationMember(testOrgId);
      expect(result.allowed).toBe(true);

      // Cleanup
      await prisma.premium.delete({ where: { id: premium.id } });
    });

    it("should enforce seat limits", async () => {
      // Create premium with 2 seat limit
      const premium = await prisma.premium.create({
        data: {
          tier: PremiumTier.BUSINESS_MONTHLY,
          maxSeats: 2,
          usedSeats: 2, // Already at limit
        },
      });

      await prisma.organization.update({
        where: { id: testOrgId },
        data: { premiumId: premium.id },
      });

      const result = await canAddOrganizationMember(testOrgId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Seat limit reached");

      // Cleanup
      await prisma.premium.delete({ where: { id: premium.id } });
    });

    it("should allow adding when seats available", async () => {
      // Create premium with 5 seat limit, 1 used
      const premium = await prisma.premium.create({
        data: {
          tier: PremiumTier.BUSINESS_MONTHLY,
          maxSeats: 5,
          usedSeats: 1,
        },
      });

      await prisma.organization.update({
        where: { id: testOrgId },
        data: { premiumId: premium.id },
      });

      const result = await canAddOrganizationMember(testOrgId);
      expect(result.allowed).toBe(true);

      // Cleanup
      await prisma.premium.delete({ where: { id: premium.id } });
    });
  });

  describe("getOrganizationBilling", () => {
    it("should return billing info for organization without premium", async () => {
      const billing = await getOrganizationBilling(testOrgId);

      expect(billing).toBeDefined();
      expect(billing?.hasPremium).toBe(false);
      expect(billing?.tier).toBeNull();
      expect(billing?.seats.used).toBe(0);
      expect(billing?.seats.max).toBeNull();
    });

    it("should return billing info for organization with premium", async () => {
      const premium = await prisma.premium.create({
        data: {
          tier: PremiumTier.BUSINESS_ANNUALLY,
          maxSeats: 10,
          usedSeats: 3,
        },
      });

      await prisma.organization.update({
        where: { id: testOrgId },
        data: { premiumId: premium.id },
      });

      const billing = await getOrganizationBilling(testOrgId);

      expect(billing?.hasPremium).toBe(true);
      expect(billing?.tier).toBe(PremiumTier.BUSINESS_ANNUALLY);
      expect(billing?.seats.used).toBe(3);
      expect(billing?.seats.max).toBe(10);
      expect(billing?.seats.available).toBe(7);

      // Cleanup
      await prisma.premium.delete({ where: { id: premium.id } });
    });
  });

  describe("hasOrganizationPremium", () => {
    it("should return false for organization without premium", async () => {
      const hasPremium = await hasOrganizationPremium(testOrgId);
      expect(hasPremium).toBe(false);
    });

    it("should return true for organization with active premium", async () => {
      const premium = await prisma.premium.create({
        data: {
          tier: PremiumTier.BUSINESS_MONTHLY,
          maxSeats: 5,
          usedSeats: 1,
          stripeRenewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      });

      await prisma.organization.update({
        where: { id: testOrgId },
        data: { premiumId: premium.id },
      });

      const hasPremium = await hasOrganizationPremium(testOrgId);
      expect(hasPremium).toBe(true);

      // Cleanup
      await prisma.premium.delete({ where: { id: premium.id } });
    });

    it("should return false for expired premium", async () => {
      const premium = await prisma.premium.create({
        data: {
          tier: PremiumTier.BUSINESS_MONTHLY,
          maxSeats: 5,
          usedSeats: 1,
          stripeRenewsAt: new Date(Date.now() - 1000), // Expired
        },
      });

      await prisma.organization.update({
        where: { id: testOrgId },
        data: { premiumId: premium.id },
      });

      const hasPremium = await hasOrganizationPremium(testOrgId);
      expect(hasPremium).toBe(false);

      // Cleanup
      await prisma.premium.delete({ where: { id: premium.id } });
    });

    it("should return true for lifetime premium", async () => {
      const premium = await prisma.premium.create({
        data: {
          tier: PremiumTier.LIFETIME,
          maxSeats: null,
          usedSeats: 1,
        },
      });

      await prisma.organization.update({
        where: { id: testOrgId },
        data: { premiumId: premium.id },
      });

      const hasPremium = await hasOrganizationPremium(testOrgId);
      expect(hasPremium).toBe(true);

      // Cleanup
      await prisma.premium.delete({ where: { id: premium.id } });
    });
  });
});
