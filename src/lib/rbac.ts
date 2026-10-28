import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { readSession } from "@/lib/auth";

/** Role hierarchy — higher index = more privileges */
const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  cashier: 1,
  accountant: 2,
  manager: 3,
  admin: 4,
};

export type Permission =
  | "read"
  | "write"
  | "delete"
  | "manage_users"
  | "manage_settings"
  | "seed"
  | "reports";

const PERMISSIONS: Record<string, Permission[]> = {
  viewer: ["read", "reports"],
  cashier: ["read", "write", "reports"],
  accountant: ["read", "write", "reports"],
  manager: ["read", "write", "delete", "reports"],
  admin: ["read", "write", "delete", "manage_users", "manage_settings", "seed", "reports"],
};

export function roleRank(role: string) {
  return ROLE_RANK[role] ?? 0;
}

export function hasPermission(role: string, permission: Permission) {
  return (PERMISSIONS[role] || []).includes(permission);
}

export function canWrite(role: string) {
  return hasPermission(role, "write");
}

export function canDelete(role: string) {
  return hasPermission(role, "delete");
}

/** Highest existing role — used as Super Admin for sensitive product cost. */
export function isSuperAdmin(role: string) {
  return role === "admin";
}

/** Salary master, monthly run, payslip pay. Admin always has full access. */
export function canManagePayroll(role: string) {
  return role === "admin" || role === "accountant";
}

export async function requireSession() {
  const session = await readSession();
  if (!session) {
    return { session: null as SessionUser | null, error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { session, error: null as NextResponse | null };
}

export async function requirePermission(permission: Permission) {
  const { session, error } = await requireSession();
  if (error || !session) return { session: null as SessionUser | null, error: error! };
  if (!hasPermission(session.role, permission)) {
    return {
      session: null as SessionUser | null,
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null as NextResponse | null };
}

export async function requireMinRole(minRole: keyof typeof ROLE_RANK) {
  const { session, error } = await requireSession();
  if (error || !session) return { session: null as SessionUser | null, error: error! };
  if (roleRank(session.role) < ROLE_RANK[minRole]) {
    return {
      session: null as SessionUser | null,
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null as NextResponse | null };
}

type GateOk = { session: SessionUser; error: null };
type GateErr = { session: null; error: NextResponse };

async function denyUnless(
  ok: (session: SessionUser) => boolean,
  code: string,
): Promise<GateOk | GateErr> {
  const { session, error } = await requireSession();
  if (error || !session) return { session: null, error: error! };
  if (!ok(session)) {
    return { session: null, error: NextResponse.json({ error: code }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function requireWrite() {
  return denyUnless((s) => canWrite(s.role), "need_write");
}

export async function requireDelete() {
  return denyUnless((s) => canDelete(s.role), "need_delete");
}

export async function requirePayroll() {
  return denyUnless((s) => canManagePayroll(s.role), "forbidden");
}

export async function requireAdmin() {
  return denyUnless((s) => s.role === "admin", "forbidden");
}

/** Field jobs: cashier/manager/admin. Accountant is money-only. */
export function canFieldWrite(role: string) {
  return role === "cashier" || role === "manager" || role === "admin";
}
