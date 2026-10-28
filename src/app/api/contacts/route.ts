import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { canManagePayroll, requireWrite } from "@/lib/rbac";
import { parseCoord } from "@/lib/service-field";
import { Contact } from "@/models";
import { isEmployeeDocUrl, sanitizeCertificates } from "@/lib/employee-docs";

function withSupplierAliases<T extends Record<string, unknown>>(doc: T) {
  const type = String(doc.type || "");
  if (type !== "supplier" && type !== "both") return doc;
  return {
    ...doc,
    supplierName: String(doc.supplierName || doc.name || ""),
    supplierContact: String(doc.supplierContact || doc.mobile || ""),
    supplierEmail: String(doc.supplierEmail || doc.email || ""),
    location: String(doc.location || ""),
    supplierWhatsApp: String(doc.supplierWhatsApp || ""),
    supplierWeChat: String(doc.supplierWeChat || ""),
    supplierCurrencyName: String(doc.supplierCurrencyName || ""),
  };
}

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));

  const filter: Record<string, unknown> = { isActive: true };
  if (type === "customer") filter.type = { $in: ["customer", "both"] };
  if (type === "supplier") filter.type = { $in: ["supplier", "both"] };
  if (type === "employee") {
    if (!canManagePayroll(session.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    filter.type = "employee";
  }
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { nameBn: new RegExp(q, "i") },
      { mobile: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      { supplierName: new RegExp(q, "i") },
      { supplierContact: new RegExp(q, "i") },
      { location: new RegExp(q, "i") },
      { city: new RegExp(q, "i") },
      { address: new RegExp(q, "i") },
      { contactPerson: new RegExp(q, "i") },
      { group: new RegExp(q, "i") },
      { nid: new RegExp(q, "i") },
      { designation: new RegExp(q, "i") },
      { speciality: new RegExp(q, "i") },
      { workType: new RegExp(q, "i") },
    ];
  }

  const [data, total] = await Promise.all([
    Contact.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Contact.countDocuments(filter),
  ]);

  return NextResponse.json({
    data: data.map((row) => withSupplierAliases(row as Record<string, unknown>)),
    total,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  const body = await req.json();
  const name = String(body.supplierName || body.name || "").trim();
  const mobile = String(body.supplierContact || body.mobile || "").trim();
  const email = String(body.supplierEmail || body.email || "").trim();

  if (!name || !mobile) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const type = String(body.type || "customer");
  if (type === "employee" && !canManagePayroll(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const nid = String(body.nid || "").trim();
  if (type === "employee" && !nid) {
    return NextResponse.json({ error: "missing_nid" }, { status: 400 });
  }

  try {
    const contact = await Contact.create({
      type: body.type || "customer",
      name,
      nameBn: body.nameBn,
      mobile,
      phone: body.phone,
      email,
      address: body.address,
      city: body.city,
      notes: body.notes,
      group: body.group,
      contactPerson: body.contactPerson,
      whatsapp: body.whatsapp,
      nid: nid || undefined,
      fatherName: body.fatherName,
      motherName: body.motherName,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      gender: body.gender || undefined,
      bloodGroup: body.bloodGroup,
      presentAddress: body.presentAddress || body.address,
      permanentAddress: body.permanentAddress,
      emergencyName: body.emergencyName,
      emergencyPhone: body.emergencyPhone,
      bankName: body.bankName,
      bankAccount: body.bankAccount,
      bankRouting: body.bankRouting,
      nidFrontUrl: isEmployeeDocUrl(String(body.nidFrontUrl || "")) ? String(body.nidFrontUrl) : undefined,
      nidBackUrl: isEmployeeDocUrl(String(body.nidBackUrl || "")) ? String(body.nidBackUrl) : undefined,
      certificates: sanitizeCertificates(body.certificates),
      bin: body.bin,
      tin: body.tin,
      creditLimit: Number(body.creditLimit || 0),
      balance: Number(body.openingBalance || 0),
      openingBalance: Number(body.openingBalance || 0),
      basicSalary: Number(body.basicSalary || 0),
      houseRent: Number(body.houseRent || 0),
      medical: Number(body.medical || 0),
      conveyance: Number(body.conveyance || 0),
      incentive: Number(body.incentive || 0),
      campaign: Number(body.campaign || 0),
      yearlyCollection: Number(body.yearlyCollection || 0),
      designation: body.designation,
      department: body.department,
      workType: body.workType || undefined,
      speciality: body.speciality,
      joinDate: body.joinDate ? new Date(body.joinDate) : undefined,
      location: body.location,
      supplierName: name,
      supplierContact: mobile,
      supplierEmail: email,
      supplierWhatsApp: body.supplierWhatsApp,
      supplierWeChat: body.supplierWeChat,
      supplierCurrencyName: body.supplierCurrencyName,
      ...(parseCoord(body.lat, body.lng) || {}),
    });

    return NextResponse.json({ data: withSupplierAliases(contact.toObject()) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/contacts", err);
    return NextResponse.json({ error: "failed" }, { status: 400 });
  }
}
