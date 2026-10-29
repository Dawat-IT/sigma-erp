import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { seedBootstrapHeaderOk } from "@/lib/seed-guard";

const PUBLIC = ["/login", "/api/auth/login", "/api/locale", "/api/favicon", "/api/health"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (
    pathname === "/api/seed" &&
    req.method === "POST" &&
    seedBootstrapHeaderOk(req.headers.get("x-seed-bootstrap-secret"))
  ) {
    return NextResponse.next();
  }

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("gp_erp_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("no secret");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = String(payload.role || "viewer");

    const ADMIN_ONLY_PATHS = ["/users", "/settings", "/roles"];
    if (role !== "admin" && ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const HR_PAYROLL_PATHS = ["/hr", "/contacts/employees", "/contacts/payslips"];
    if (role !== "admin" && role !== "accountant" && HR_PAYROLL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
