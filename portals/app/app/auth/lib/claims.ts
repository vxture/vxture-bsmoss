// Adapted from the yucer engineering reference for product bsmoss.
export const GOVERNANCE_ROLE_CODES = [
  "owner",
  "manager",
  "member",
  "readonly",
  "guest",
] as const;
export type GovernanceRoleCode = (typeof GOVERNANCE_ROLE_CODES)[number];

const MANAGE_ROLES = new Set(["org:owner", "workspace:owner", "workspace:manager"]);

export interface ScopedRole {
  scope: string;
  role: string;
}

export function parseRoles(roles: readonly string[]): ScopedRole[] {
  return roles.map((raw) => {
    const r = raw.trim().toLowerCase();
    const idx = r.indexOf(":");
    return idx === -1
      ? { scope: "", role: r }
      : { scope: r.slice(0, idx), role: r.slice(idx + 1) };
  });
}

export function canManageWorkspace(roles: readonly string[]): boolean {
  return roles.some((r) => MANAGE_ROLES.has(r.trim().toLowerCase()));
}

export function isWorkspaceOwner(roles: readonly string[]): boolean {
  return roles.some((r) => r.trim().toLowerCase() === "workspace:owner");
}

export interface AccessClaims {
  sub: string;
  active_org?: string;
  active_org_type?: string;
  active_org_name?: string;
  active_workspace?: string;
  active_workspace_name?: string;
  roles?: string[];
  account_status?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  email?: string;
  phone?: string;

  user_no?: string;
}

export interface AuthUser {
  sub: string;
  activeOrg: string | null;
  activeOrgType: string | null;
  activeOrgName: string | null;
  activeWorkspace: string | null;
  activeWorkspaceName: string | null;
  roles: string[];
  accountStatus: string | null;
  canManage: boolean;
  isWorkspaceOwner: boolean;

  displayName: string;

  picture: string | null;
  email: string | null;
  phone: string | null;
  userNo: string | null;
}

export function toAuthUser(claims: AccessClaims): AuthUser {
  const roles = Array.isArray(claims.roles) ? claims.roles : [];
  return {
    sub: claims.sub,
    activeOrg: claims.active_org ?? null,
    activeOrgType: claims.active_org_type ?? null,
    activeOrgName: claims.active_org_name ?? null,
    activeWorkspace: claims.active_workspace ?? null,
    activeWorkspaceName: claims.active_workspace_name ?? null,
    roles,
    accountStatus: claims.account_status ?? null,
    canManage: canManageWorkspace(roles),
    isWorkspaceOwner: isWorkspaceOwner(roles),
    displayName: claims.name ?? claims.preferred_username ?? claims.sub,
    picture: claims.picture ?? null,
    email: claims.email ?? null,
    phone: claims.phone ?? null,
    userNo: claims.user_no ?? null,
  };
}
