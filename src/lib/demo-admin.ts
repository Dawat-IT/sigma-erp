import { hashPassword, verifyPassword } from "@/lib/auth";
import {
  DEMO_ADMIN,
  DEMO_ADMIN_ALIASES,
  DEMO_MANAGER,
  DEMO_MANAGER_ALIASES,
} from "@/lib/seed-data";
import { User } from "@/models";

export { DEMO_ADMIN, DEMO_ADMIN_ALIASES, DEMO_MANAGER, DEMO_MANAGER_ALIASES };

const DEMO_ADMIN_EMAILS = DEMO_ADMIN_ALIASES.filter((value) => value.includes("@"));
const DEMO_MANAGER_EMAILS = DEMO_MANAGER_ALIASES.filter((value) => value.includes("@"));

export function normalizeLoginId(value: string) {
  return String(value || "").trim().toLowerCase();
}

export function isDemoAdminIdentity(email: string) {
  return DEMO_ADMIN_ALIASES.includes(normalizeLoginId(email));
}

export function isDemoManagerIdentity(email: string) {
  return DEMO_MANAGER_ALIASES.includes(normalizeLoginId(email));
}

export async function findDemoAdmin() {
  return User.findOne({ email: { $in: DEMO_ADMIN_EMAILS } });
}

export async function findDemoManager() {
  return User.findOne({ email: { $in: DEMO_MANAGER_EMAILS } });
}

export async function ensureDemoAdminUser(locationId?: unknown, opts?: { resetPassword?: boolean }) {
  const resetPassword = opts?.resetPassword ?? process.env.NODE_ENV !== "production";
  let admin = await findDemoAdmin();
  if (!admin) {
    admin = await User.create({
      name: DEMO_ADMIN.name,
      email: DEMO_ADMIN.email,
      passwordHash: await hashPassword(DEMO_ADMIN.password),
      role: "admin",
      phone: DEMO_ADMIN.phone,
      locale: "bn",
      isActive: true,
      ...(locationId ? { locationIds: [locationId] } : {}),
    });
    return admin;
  }

  admin.email = DEMO_ADMIN.email;
  if (resetPassword) admin.passwordHash = await hashPassword(DEMO_ADMIN.password);
  admin.isActive = true;
  admin.name = DEMO_ADMIN.name;
  admin.role = "admin";
  if (locationId) admin.locationIds = [locationId as never];
  await admin.save();
  return admin;
}

export async function ensureDemoManagerUser(locationId?: unknown, opts?: { resetPassword?: boolean }) {
  const resetPassword = opts?.resetPassword ?? process.env.NODE_ENV !== "production";
  let manager = await findDemoManager();
  if (!manager) {
    manager = await User.create({
      name: DEMO_MANAGER.name,
      email: DEMO_MANAGER.email,
      passwordHash: await hashPassword(DEMO_MANAGER.password),
      role: "manager",
      phone: DEMO_MANAGER.phone,
      locale: "bn",
      isActive: true,
      ...(locationId ? { locationIds: [locationId] } : {}),
    });
    return manager;
  }

  manager.email = DEMO_MANAGER.email;
  if (resetPassword) manager.passwordHash = await hashPassword(DEMO_MANAGER.password);
  manager.isActive = true;
  manager.name = DEMO_MANAGER.name;
  manager.role = "manager";
  if (locationId) manager.locationIds = [locationId as never];
  await manager.save();
  return manager;
}

/** Demo email + demo password always unlocks, even if the stored hash is stale. */
export async function resolveLoginUser(email: string, password: string) {
  const loginId = normalizeLoginId(email);
  let user = await User.findOne({ email: loginId });

  // Public deployments only accept the actual stored account password.
  if (process.env.NODE_ENV === "production") {
    if (!user?.passwordHash) return null;
    return (await verifyPassword(password, user.passwordHash)) ? user : null;
  }

  if (!user && isDemoAdminIdentity(loginId)) {
    user = await findDemoAdmin();
  } else if (!user && isDemoManagerIdentity(loginId)) {
    user = await findDemoManager();
  }

  if (isDemoAdminIdentity(loginId) && password === DEMO_ADMIN.password) {
    if (!user) {
      return ensureDemoAdminUser();
    }

    let matches = false;
    try {
      matches = Boolean(user.passwordHash) && (await verifyPassword(password, user.passwordHash));
    } catch {
      matches = false;
    }

    if (!matches || !user.isActive || user.email !== DEMO_ADMIN.email) {
      user.passwordHash = await hashPassword(DEMO_ADMIN.password);
      user.email = DEMO_ADMIN.email;
      user.isActive = true;
      if (user.role !== "admin") user.role = "admin";
      await user.save();
    }
    return user;
  }

  if (isDemoManagerIdentity(loginId) && password === DEMO_MANAGER.password) {
    if (!user) {
      return ensureDemoManagerUser();
    }

    let matches = false;
    try {
      matches = Boolean(user.passwordHash) && (await verifyPassword(password, user.passwordHash));
    } catch {
      matches = false;
    }

    if (!matches || !user.isActive || user.email !== DEMO_MANAGER.email) {
      user.passwordHash = await hashPassword(DEMO_MANAGER.password);
      user.email = DEMO_MANAGER.email;
      user.isActive = true;
      if (user.role !== "manager") user.role = "manager";
      await user.save();
    }
    return user;
  }

  if (!user?.passwordHash) return null;
  try {
    return (await verifyPassword(password, user.passwordHash)) ? user : null;
  } catch {
    return null;
  }
}
