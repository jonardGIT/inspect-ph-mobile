import {
  canAccessFieldWorkspace,
  canAuthorPublicReports,
  isDashboardPrimaryRole,
  isMobilePrimaryRole,
  isOwnerSelfServiceRole,
} from "@/lib/role-surface";

describe("mobile role-surface helpers", () => {
  it("treats inspector, business owner, and citizen as mobile-primary roles", () => {
    expect(isMobilePrimaryRole("inspector")).toBe(true);
    expect(isMobilePrimaryRole("business_owner")).toBe(true);
    expect(isMobilePrimaryRole("citizen")).toBe(true);
    expect(isMobilePrimaryRole("office_clerk")).toBe(false);
  });

  it("allows only inspectors into the field workspace", () => {
    expect(canAccessFieldWorkspace("inspector")).toBe(true);
    expect(canAccessFieldWorkspace("admin")).toBe(false);
    expect(canAccessFieldWorkspace("office_supervisor")).toBe(false);
  });

  it("allows anonymous and citizen reporting author flows", () => {
    expect(canAuthorPublicReports(undefined)).toBe(true);
    expect(canAuthorPublicReports(null)).toBe(true);
    expect(canAuthorPublicReports("citizen")).toBe(true);
    expect(canAuthorPublicReports("business_owner")).toBe(false);
    expect(canAuthorPublicReports("office_clerk")).toBe(false);
  });

  it("recognizes owner self-service and dashboard-primary roles correctly", () => {
    expect(isOwnerSelfServiceRole("business_owner")).toBe(true);
    expect(isOwnerSelfServiceRole("citizen")).toBe(false);
    expect(isDashboardPrimaryRole("office_clerk")).toBe(true);
    expect(isDashboardPrimaryRole("lgu_admin")).toBe(true);
    expect(isDashboardPrimaryRole("inspector")).toBe(false);
  });
});
