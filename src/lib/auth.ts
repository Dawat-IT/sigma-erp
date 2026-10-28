import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const COOKIE = "gp_erp_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET missing");
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  locale: "bn" | "en";
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

function sessionFromJwt(payload: unknown): SessionUser | null {
  const p = payload as Partial<SessionUser> | null;
  if (!p?.id) return null;
  return {
    id: String(p.id),
    name: String(p.name || ""),
    email: String(p.email || ""),
    role: String(p.role || "viewer"),
    locale: p.locale === "en" ? "en" : "bn",
  };
}

/** JWT + live User row. Role and isActive always come from the database. */
export async function readLiveUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const jwtUser = sessionFromJwt(payload);
    if (!jwtUser) return null;
    const { connectDB } = await import("@/lib/db");
    const { User } = await import("@/models");
    await connectDB();
    const user = await User.findById(jwtUser.id).select("isActive role name email locale");
    if (!user || user.isActive === false) return null;
    return {
      id: String(user._id),
      name: String(user.name || jwtUser.name),
      email: String(user.email || jwtUser.email),
      role: String(user.role || "viewer"),
      locale: user.locale === "en" ? "en" : "bn",
    };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionUser | null> {
  return readLiveUser();
}

export function applySessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export function clearSessionOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export { COOKIE as SESSION_COOKIE };
