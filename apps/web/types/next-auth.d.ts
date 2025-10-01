import { OrganizationRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    accessToken?: string;
    error?: string;
    // Organization context
    organizationId?: string;
    organizationSlug?: string;
    organizationRole?: OrganizationRole;
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    error?: string;
    // Organization context
    organizationId?: string;
    organizationSlug?: string;
    organizationRole?: OrganizationRole;
  }
}
