import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Location, Business, Account } from "@/models";
import { hasPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();

  const type = new URL(req.url).searchParams.get("type");

  if (type === "locations") {
    const locations = await Location.find({ isActive: true }).lean();
    return NextResponse.json({
      data: locations.map((l) => ({
        name: l.name,
        code: l.code,
        address: l.address,
        phone: l.phone,
        _id: l._id,
      })),
    });
  }

  if (type === "business") {
    const business = await Business.findOne().lean();
    if (!business) return NextResponse.json({ data: [] });
    return NextResponse.json({
      data: [
        { label: "Business Name", value: business.name },
        { label: "Phone", value: business.phone },
        { label: "Email", value: business.email },
        { label: "BIN", value: business.bin },
        { label: "Invoice Prefix", value: business.invoicePrefix },
      ],
    });
  }

  if (type === "calendar") {
    const today = new Date();
    return NextResponse.json({
      data: [
        { label: "Today", value: today.toISOString().slice(0, 10) },
        { label: "Month", value: today.toLocaleString("en", { month: "long", year: "numeric" }) },
      ],
    });
  }

  if (type === "profile") {
    const { User } = await import("@/models");
    const user = await User.findById(session.id).select("name email role phone avatarUrl locale").lean();
    const name = String((user as { name?: string } | null)?.name || session.name);
    const email = String((user as { email?: string } | null)?.email || session.email);
    const role = String((user as { role?: string } | null)?.role || session.role);
    const phone = String((user as { phone?: string } | null)?.phone || "");
    const avatarUrl = String((user as { avatarUrl?: string } | null)?.avatarUrl || "");
    return NextResponse.json({
      data: [
        { label: "Name", value: name },
        { label: "Email", value: email },
        { label: "Role", value: role },
        { label: "Phone", value: phone },
      ],
      user: { name, email, role, phone, avatarUrl },
      avatarUrl,
    });
  }

  const [locations, business, accounts] = await Promise.all([
    Location.find({ isActive: true }).lean(),
    Business.findOne().lean(),
    Account.find({ isActive: true }).lean(),
  ]);
  return NextResponse.json({ locations, business, accounts });
}

export async function PUT(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const type = body.type || "business";

  try {
    if (type === "profile") {
      const { User } = await import("@/models");
      const { createSessionToken, applySessionCookie, hashPassword, verifyPassword } = await import("@/lib/auth");
      const user = await User.findById(session.id);
      if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

      const name = String(body.name ?? user.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

      const phone = body.phone != null ? String(body.phone).trim() : String(user.phone || "");
      let avatarUrl = user.avatarUrl || "";
      if (body.avatarUrl != null) {
        avatarUrl = String(body.avatarUrl || "");
        if (avatarUrl && !avatarUrl.startsWith("data:image/") && !avatarUrl.startsWith("http")) {
          return NextResponse.json({ error: "invalid_image" }, { status: 400 });
        }
        if (avatarUrl.startsWith("data:image/") && avatarUrl.length > 1_200_000) {
          return NextResponse.json({ error: "too_large" }, { status: 400 });
        }
      }

      const newPassword = String(body.newPassword || "");
      if (newPassword) {
        if (newPassword.length < 6) return NextResponse.json({ error: "weak_password" }, { status: 400 });
        const currentPassword = String(body.currentPassword || "");
        const ok = user.passwordHash && (await verifyPassword(currentPassword, String(user.passwordHash)));
        if (!ok) return NextResponse.json({ error: "bad_password" }, { status: 400 });
        user.passwordHash = await hashPassword(newPassword);
      }

      user.name = name;
      user.phone = phone;
      user.avatarUrl = avatarUrl;
      await user.save();

      const res = NextResponse.json({
        data: {
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || "",
          avatarUrl: user.avatarUrl || "",
        },
      });
      applySessionCookie(
        res,
        await createSessionToken({
          id: session.id,
          name: String(user.name),
          email: String(user.email),
          role: String(user.role || session.role),
          locale: user.locale === "en" ? "en" : "bn",
        }),
      );
      return res;
    }

    if (!hasPermission(session.role, "manage_settings")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (type === "business") {
      const $set: Record<string, unknown> = {};
      for (const key of [
        "name",
        "nameBn",
        "address",
        "addressBn",
        "phone",
        "email",
        "website",
        "bin",
        "tin",
        "mushak",
        "currency",
        "invoicePrefix",
        "purchasePrefix",
        "defaultLocale",
        "stockMethod",
        "logoUrl",
        "faviconUrl",
        "requireGps",
        "requireOtp",
        "requirePhoto",
        "expectedVisitsPerDay",
      ]) {
        if (body[key] != null) $set[key] = body[key];
      }
      if (body.REQUIRE_GPS != null) $set.requireGps = Boolean(body.REQUIRE_GPS);
      if (body.REQUIRE_OTP != null) $set.requireOtp = Boolean(body.REQUIRE_OTP);
      if (body.REQUIRE_PHOTO != null) $set.requirePhoto = Boolean(body.REQUIRE_PHOTO);
      for (const flag of ["requireGps", "requireOtp", "requirePhoto"] as const) {
        if ($set[flag] != null) $set[flag] = $set[flag] === true || $set[flag] === "true" || $set[flag] === 1;
      }
      if ($set.expectedVisitsPerDay != null) {
        const n = Number($set.expectedVisitsPerDay);
        $set.expectedVisitsPerDay = Number.isFinite(n) && n > 0 ? n : 3.5;
      }
      const business =
        (await Business.findOneAndUpdate({}, { $set }, { new: true })) ||
        (await Business.create($set));
      return NextResponse.json({ data: business });
    }

    if (type === "location") {
      if (body._id) {
        const updated = await Location.findByIdAndUpdate(
          body._id,
          {
            $set: {
              name: body.name,
              code: body.code,
              address: body.address,
              phone: body.phone,
              isActive: body.isActive !== false,
            },
          },
          { new: true },
        );
        if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
        return NextResponse.json({ data: updated });
      }
      const created = await Location.create({
        name: body.name,
        code: body.code,
        address: body.address,
        phone: body.phone,
        isActive: true,
      });
      return NextResponse.json({ data: created }, { status: 201 });
    }

    return NextResponse.json({ error: "unknown_type" }, { status: 400 });
  } catch (err) {
    console.error("PUT /api/meta", err);
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasPermission(session.role, "manage_settings")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();
  const id = new URL(req.url).searchParams.get("locationId");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const updated = await Location.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, soft: true });
}
