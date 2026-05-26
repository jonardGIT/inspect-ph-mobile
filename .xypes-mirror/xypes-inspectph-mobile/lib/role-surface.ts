import type { User } from "../shared/types/api";

type AppRole = User["role"] | null | undefined;

export function isMobilePrimaryRole(role: AppRole) {
  return (
    role === "inspector" || role === "business_owner" || role === "citizen"
  );
}

export function canAccessFieldWorkspace(role: AppRole) {
  return role === "inspector";
}

export function canAuthorPublicReports(role: AppRole) {
  return role === undefined || role === null || role === "citizen";
}

export function isOwnerSelfServiceRole(role: AppRole) {
  return role === "business_owner";
}

export function isDashboardPrimaryRole(role: AppRole) {
  return (
    role === "admin" ||
    role === "lgu_admin" ||
    role === "office_supervisor" ||
    role === "office_clerk"
  );
}
