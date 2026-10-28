import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { canManagePayroll, requireDelete, requireWrite } from "@/lib/rbac";
import { parseCoord } from "@/lib/service-field";
import { Contact } from "@/models";
import { isEmployeeDocUrl, sanitizeCertificates } from "@/lib/employee-docs";
import {
  isGenericSupplierLabel,
  propagateSupplierIdentity,
  deactivateSupplierLinks,
} from "@/lib/product-suppliers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await connectDB();
  const doc = await Contact.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (doc.type === "employee" && !canManagePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data: {
    ...doc,
    supplierName: doc.supplierName || doc.name || "",
    supplierContact: doc.supplierContact || doc.mobile || "",
    supplierEmail: doc.supplierEmail || doc.email || "",
  } });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  const current = await Contact.findById(id).select("type").lean();
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (current.type === "employee" && !canManagePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.supplierName || body.name || "").trim();
    const mobile = String(body.supplierContact || body.mobile || "").trim();
    const email = String(body.supplierEmail || body.email || "").trim();

    if (!name || !mobile) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const openingBalance =
      body.openingBalance != null && body.openingBalance !== ""
        ? Number(body.openingBalance)
        : undefined;

    const $set: Record<string, unknown> = {
      name,
      mobile,
      email,
      isActive: true,
      supplierName: name,
      supplierContact: mobile,
      supplierEmail: email,
    };

    if (body.nameBn !== undefined) {
      let nameBn = String(body.nameBn || "").trim();
      if (!nameBn || isGenericSupplierLabel(nameBn)) {
        nameBn = name;
      }
      $set.nameBn = nameBn;
    }
    if (body.address !== undefined) $set.address = String(body.address || "").trim();
    if (body.location !== undefined) $set.location = String(body.location || "").trim();
    for (const key of ["phone", "city", "notes", "group", "contactPerson", "whatsapp"] as const) {
      if (body[key] !== undefined) $set[key] = String(body[key] || "").trim();
    }
    if (body.supplierWhatsApp !== undefined) $set.supplierWhatsApp = String(body.supplierWhatsApp || "").trim();
    if (body.supplierWeChat !== undefined) $set.supplierWeChat = String(body.supplierWeChat || "").trim();
    if (body.supplierCurrencyName !== undefined) {
      $set.supplierCurrencyName = String(body.supplierCurrencyName || "").trim();
    }
    if (body.creditLimit != null && body.creditLimit !== "") $set.creditLimit = Number(body.creditLimit || 0);
    if (body.nid != null && String(body.nid).trim() !== "") $set.nid = String(body.nid);
    if (body.nidFrontUrl !== undefined) {
      $set.nidFrontUrl = isEmployeeDocUrl(String(body.nidFrontUrl || "")) ? String(body.nidFrontUrl) : "";
    }
    if (body.nidBackUrl !== undefined) {
      $set.nidBackUrl = isEmployeeDocUrl(String(body.nidBackUrl || "")) ? String(body.nidBackUrl) : "";
    }
    if (body.certificates !== undefined) $set.certificates = sanitizeCertificates(body.certificates);
    if (body.type === "employee" && !String($set.nid || body.nid || "").trim()) {
      const existing = await Contact.findById(id).select("nid type").lean();
      if (!existing?.nid) return NextResponse.json({ error: "missing_nid" }, { status: 400 });
    }
    for (const key of [
      "fatherName",
      "motherName",
      "gender",
      "bloodGroup",
      "presentAddress",
      "permanentAddress",
      "emergencyName",
      "emergencyPhone",
      "bankName",
      "bankAccount",
      "bankRouting",
    ] as const) {
      if (body[key] !== undefined) $set[key] = String(body[key] || "").trim();
    }
    if (body.dateOfBirth) $set.dateOfBirth = new Date(body.dateOfBirth);
    if (body.bin != null && String(body.bin).trim() !== "") $set.bin = String(body.bin);
    if (body.tin != null && String(body.tin).trim() !== "") $set.tin = String(body.tin);
    if (body.type) $set.type = body.type;
    if (body.basicSalary != null && body.basicSalary !== "") {
      $set.basicSalary = Number(body.basicSalary);
    }
    if (body.houseRent != null && body.houseRent !== "") $set.houseRent = Number(body.houseRent);
    if (body.medical != null && body.medical !== "") $set.medical = Number(body.medical);
    if (body.conveyance != null && body.conveyance !== "") $set.conveyance = Number(body.conveyance);
    if (body.incentive != null && body.incentive !== "") $set.incentive = Number(body.incentive);
    if (body.campaign != null && body.campaign !== "") $set.campaign = Number(body.campaign);
    if (body.yearlyCollection != null && body.yearlyCollection !== "") {
      $set.yearlyCollection = Number(body.yearlyCollection);
    }
    if (body.designation != null) $set.designation = String(body.designation || "").trim();
    if (body.department != null) $set.department = String(body.department || "").trim();
    if (body.workType != null) $set.workType = String(body.workType || "").trim() || undefined;
    if (body.speciality != null) $set.speciality = String(body.speciality || "").trim();
    if (body.joinDate) $set.joinDate = new Date(body.joinDate);
    const coords = parseCoord(body.lat, body.lng);
    if (coords) {
      $set.lat = coords.lat;
      $set.lng = coords.lng;
    } else if (body.lat === null && body.lng === null) {
      $set.lat = null;
      $set.lng = null;
    }
    if (openingBalance != null && Number.isFinite(openingBalance)) {
      const existing = await Contact.findById(id).lean();
      if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const oldOpening = Number(existing.openingBalance || 0);
      const oldBalance = Number(existing.balance || 0);
      $set.openingBalance = openingBalance;
      $set.balance = oldBalance - oldOpening + openingBalance;
    }

    const updated = await Contact.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await propagateSupplierIdentity(id);

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update_failed";
    console.error("PUT /api/contacts/[id]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  await connectDB();
  const current = await Contact.findById(id).select("type").lean();
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (current.type === "employee" && !canManagePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await Contact.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true },
  );
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await deactivateSupplierLinks(id);
  return NextResponse.json({ ok: true, soft: true, data: updated });
}
