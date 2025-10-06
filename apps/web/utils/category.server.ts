import prisma from "@/utils/prisma";
import type { Prisma } from "@prisma/client";

export type CategoryWithRules = Prisma.CategoryGetPayload<{
  select: {
    id: true;
    name: true;
    description: true;
    rules: { select: { id: true; name: true } };
  };
}>;

export const getUserCategories = async ({
  emailAccountId,
  organizationId,
}: {
  emailAccountId: string;
  organizationId?: string;
}) => {
  // Build where clause to include organization scope
  const where = organizationId
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

  const categories = await prisma.category.findMany({
    where,
  });
  return categories;
};

export const getUserCategoriesWithRules = async ({
  emailAccountId,
  organizationId,
}: {
  emailAccountId: string;
  organizationId?: string;
}) => {
  // Build where clause to include organization scope
  const where = organizationId
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

  const categories = await prisma.category.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      rules: { select: { id: true, name: true } },
    },
  });
  return categories;
};

export const getUserCategoriesForNames = async ({
  emailAccountId,
  names,
}: {
  emailAccountId: string;
  names: string[];
}) => {
  if (!names.length) return [];

  const categories = await prisma.category.findMany({
    where: { emailAccountId, name: { in: names } },
    select: { id: true },
  });
  if (categories.length !== names.length) {
    console.warn("Not all categories were found", {
      requested: names.length,
      found: categories.length,
      names,
    });
  }
  return categories.map((c) => c.id);
};
