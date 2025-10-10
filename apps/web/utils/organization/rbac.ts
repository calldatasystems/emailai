import { OrganizationRole } from "@prisma/client";

/**
 * RBAC (Role-Based Access Control) System for Multi-Tenant Organizations
 *
 * This module defines permissions and role-based authorization rules.
 */

// Permission definitions
export enum Permission {
  // Organization Management
  ORG_VIEW = "org:view",
  ORG_UPDATE = "org:update",
  ORG_DELETE = "org:delete",

  // Member Management
  MEMBER_VIEW = "member:view",
  MEMBER_INVITE = "member:invite",
  MEMBER_REMOVE = "member:remove",
  MEMBER_UPDATE_ROLE = "member:update_role",

  // Email Account Management
  EMAIL_ACCOUNT_VIEW = "email_account:view",
  EMAIL_ACCOUNT_CREATE = "email_account:create",
  EMAIL_ACCOUNT_UPDATE = "email_account:update",
  EMAIL_ACCOUNT_DELETE = "email_account:delete",

  // Rules & Automation
  RULE_VIEW = "rule:view",
  RULE_CREATE = "rule:create",
  RULE_UPDATE = "rule:update",
  RULE_DELETE = "rule:delete",
  RULE_EXECUTE = "rule:execute",

  // Groups
  GROUP_VIEW = "group:view",
  GROUP_CREATE = "group:create",
  GROUP_UPDATE = "group:update",
  GROUP_DELETE = "group:delete",

  // Knowledge Base
  KNOWLEDGE_VIEW = "knowledge:view",
  KNOWLEDGE_CREATE = "knowledge:create",
  KNOWLEDGE_UPDATE = "knowledge:update",
  KNOWLEDGE_DELETE = "knowledge:delete",

  // Categories
  CATEGORY_VIEW = "category:view",
  CATEGORY_CREATE = "category:create",
  CATEGORY_UPDATE = "category:update",
  CATEGORY_DELETE = "category:delete",

  // Billing & Premium
  BILLING_VIEW = "billing:view",
  BILLING_MANAGE = "billing:manage",

  // Settings
  SETTINGS_VIEW = "settings:view",
  SETTINGS_UPDATE = "settings:update",

  // Analytics & Stats
  ANALYTICS_VIEW = "analytics:view",

  // API Keys
  API_KEY_VIEW = "api_key:view",
  API_KEY_CREATE = "api_key:create",
  API_KEY_DELETE = "api_key:delete",
}

/**
 * Permission matrix mapping roles to their allowed permissions
 */
const rolePermissions: Record<OrganizationRole, Permission[]> = {
  [OrganizationRole.OWNER]: [
    // Organization
    Permission.ORG_VIEW,
    Permission.ORG_UPDATE,
    Permission.ORG_DELETE,

    // Members
    Permission.MEMBER_VIEW,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE,
    Permission.MEMBER_UPDATE_ROLE,

    // Email Accounts
    Permission.EMAIL_ACCOUNT_VIEW,
    Permission.EMAIL_ACCOUNT_CREATE,
    Permission.EMAIL_ACCOUNT_UPDATE,
    Permission.EMAIL_ACCOUNT_DELETE,

    // Rules
    Permission.RULE_VIEW,
    Permission.RULE_CREATE,
    Permission.RULE_UPDATE,
    Permission.RULE_DELETE,
    Permission.RULE_EXECUTE,

    // Groups
    Permission.GROUP_VIEW,
    Permission.GROUP_CREATE,
    Permission.GROUP_UPDATE,
    Permission.GROUP_DELETE,

    // Knowledge
    Permission.KNOWLEDGE_VIEW,
    Permission.KNOWLEDGE_CREATE,
    Permission.KNOWLEDGE_UPDATE,
    Permission.KNOWLEDGE_DELETE,

    // Categories
    Permission.CATEGORY_VIEW,
    Permission.CATEGORY_CREATE,
    Permission.CATEGORY_UPDATE,
    Permission.CATEGORY_DELETE,

    // Billing
    Permission.BILLING_VIEW,
    Permission.BILLING_MANAGE,

    // Settings
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,

    // Analytics
    Permission.ANALYTICS_VIEW,

    // API Keys
    Permission.API_KEY_VIEW,
    Permission.API_KEY_CREATE,
    Permission.API_KEY_DELETE,
  ],

  [OrganizationRole.ADMIN]: [
    // Organization
    Permission.ORG_VIEW,
    Permission.ORG_UPDATE,

    // Members
    Permission.MEMBER_VIEW,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE, // Can remove non-owner members
    Permission.MEMBER_UPDATE_ROLE, // Can update non-owner roles

    // Email Accounts
    Permission.EMAIL_ACCOUNT_VIEW,
    Permission.EMAIL_ACCOUNT_CREATE,
    Permission.EMAIL_ACCOUNT_UPDATE,
    Permission.EMAIL_ACCOUNT_DELETE,

    // Rules
    Permission.RULE_VIEW,
    Permission.RULE_CREATE,
    Permission.RULE_UPDATE,
    Permission.RULE_DELETE,
    Permission.RULE_EXECUTE,

    // Groups
    Permission.GROUP_VIEW,
    Permission.GROUP_CREATE,
    Permission.GROUP_UPDATE,
    Permission.GROUP_DELETE,

    // Knowledge
    Permission.KNOWLEDGE_VIEW,
    Permission.KNOWLEDGE_CREATE,
    Permission.KNOWLEDGE_UPDATE,
    Permission.KNOWLEDGE_DELETE,

    // Categories
    Permission.CATEGORY_VIEW,
    Permission.CATEGORY_CREATE,
    Permission.CATEGORY_UPDATE,
    Permission.CATEGORY_DELETE,

    // Billing
    Permission.BILLING_VIEW,

    // Settings
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,

    // Analytics
    Permission.ANALYTICS_VIEW,

    // API Keys
    Permission.API_KEY_VIEW,
    Permission.API_KEY_CREATE,
    Permission.API_KEY_DELETE,
  ],

  [OrganizationRole.MEMBER]: [
    // Organization
    Permission.ORG_VIEW,

    // Members
    Permission.MEMBER_VIEW,

    // Email Accounts
    Permission.EMAIL_ACCOUNT_VIEW,
    Permission.EMAIL_ACCOUNT_CREATE,
    Permission.EMAIL_ACCOUNT_UPDATE, // Own accounts only
    Permission.EMAIL_ACCOUNT_DELETE, // Own accounts only

    // Rules
    Permission.RULE_VIEW,
    Permission.RULE_CREATE,
    Permission.RULE_UPDATE, // Own rules only
    Permission.RULE_DELETE, // Own rules only
    Permission.RULE_EXECUTE,

    // Groups
    Permission.GROUP_VIEW,
    Permission.GROUP_CREATE,
    Permission.GROUP_UPDATE, // Own groups only
    Permission.GROUP_DELETE, // Own groups only

    // Knowledge
    Permission.KNOWLEDGE_VIEW,
    Permission.KNOWLEDGE_CREATE,
    Permission.KNOWLEDGE_UPDATE, // Own knowledge only
    Permission.KNOWLEDGE_DELETE, // Own knowledge only

    // Categories
    Permission.CATEGORY_VIEW,
    Permission.CATEGORY_CREATE,
    Permission.CATEGORY_UPDATE, // Own categories only
    Permission.CATEGORY_DELETE, // Own categories only

    // Settings
    Permission.SETTINGS_VIEW,

    // Analytics
    Permission.ANALYTICS_VIEW,

    // API Keys
    Permission.API_KEY_VIEW, // Own keys only
    Permission.API_KEY_CREATE,
    Permission.API_KEY_DELETE, // Own keys only
  ],

  [OrganizationRole.VIEWER]: [
    // Organization
    Permission.ORG_VIEW,

    // Members
    Permission.MEMBER_VIEW,

    // Email Accounts
    Permission.EMAIL_ACCOUNT_VIEW,

    // Rules
    Permission.RULE_VIEW,

    // Groups
    Permission.GROUP_VIEW,

    // Knowledge
    Permission.KNOWLEDGE_VIEW,

    // Categories
    Permission.CATEGORY_VIEW,

    // Settings
    Permission.SETTINGS_VIEW,

    // Analytics
    Permission.ANALYTICS_VIEW,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: OrganizationRole,
  permission: Permission
): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: OrganizationRole,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(
  role: OrganizationRole,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: OrganizationRole): Permission[] {
  return rolePermissions[role] ?? [];
}

/**
 * Check if user can manage another member (based on roles)
 * Only owners can manage owners, admins can manage members/viewers
 */
export function canManageMember(
  userRole: OrganizationRole,
  targetRole: OrganizationRole
): boolean {
  // Owners can manage anyone
  if (userRole === OrganizationRole.OWNER) {
    return true;
  }

  // Admins can manage members and viewers, but not owners or other admins
  if (userRole === OrganizationRole.ADMIN) {
    return (
      targetRole === OrganizationRole.MEMBER ||
      targetRole === OrganizationRole.VIEWER
    );
  }

  // Members and viewers cannot manage anyone
  return false;
}

/**
 * Check if role can perform organization-level actions
 */
export function isOrgAdmin(role: OrganizationRole): boolean {
  return (
    role === OrganizationRole.OWNER || role === OrganizationRole.ADMIN
  );
}

/**
 * Check if role is owner
 */
export function isOwner(role: OrganizationRole): boolean {
  return role === OrganizationRole.OWNER;
}

/**
 * Helper functions for common permission checks
 */
export const can = {
  // Organization
  viewOrg: (role: OrganizationRole) => hasPermission(role, Permission.ORG_VIEW),
  updateOrg: (role: OrganizationRole) =>
    hasPermission(role, Permission.ORG_UPDATE),
  deleteOrg: (role: OrganizationRole) =>
    hasPermission(role, Permission.ORG_DELETE),

  // Members
  viewMembers: (role: OrganizationRole) =>
    hasPermission(role, Permission.MEMBER_VIEW),
  inviteMembers: (role: OrganizationRole) =>
    hasPermission(role, Permission.MEMBER_INVITE),
  removeMembers: (role: OrganizationRole) =>
    hasPermission(role, Permission.MEMBER_REMOVE),
  updateMemberRoles: (role: OrganizationRole) =>
    hasPermission(role, Permission.MEMBER_UPDATE_ROLE),

  // Email Accounts
  viewEmailAccounts: (role: OrganizationRole) =>
    hasPermission(role, Permission.EMAIL_ACCOUNT_VIEW),
  createEmailAccounts: (role: OrganizationRole) =>
    hasPermission(role, Permission.EMAIL_ACCOUNT_CREATE),
  updateEmailAccounts: (role: OrganizationRole) =>
    hasPermission(role, Permission.EMAIL_ACCOUNT_UPDATE),
  deleteEmailAccounts: (role: OrganizationRole) =>
    hasPermission(role, Permission.EMAIL_ACCOUNT_DELETE),

  // Rules
  viewRules: (role: OrganizationRole) =>
    hasPermission(role, Permission.RULE_VIEW),
  createRules: (role: OrganizationRole) =>
    hasPermission(role, Permission.RULE_CREATE),
  updateRules: (role: OrganizationRole) =>
    hasPermission(role, Permission.RULE_UPDATE),
  deleteRules: (role: OrganizationRole) =>
    hasPermission(role, Permission.RULE_DELETE),
  executeRules: (role: OrganizationRole) =>
    hasPermission(role, Permission.RULE_EXECUTE),

  // Billing
  viewBilling: (role: OrganizationRole) =>
    hasPermission(role, Permission.BILLING_VIEW),
  manageBilling: (role: OrganizationRole) =>
    hasPermission(role, Permission.BILLING_MANAGE),

  // Settings
  viewSettings: (role: OrganizationRole) =>
    hasPermission(role, Permission.SETTINGS_VIEW),
  updateSettings: (role: OrganizationRole) =>
    hasPermission(role, Permission.SETTINGS_UPDATE),

  // Analytics
  viewAnalytics: (role: OrganizationRole) =>
    hasPermission(role, Permission.ANALYTICS_VIEW),
};
