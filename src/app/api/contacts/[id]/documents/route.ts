import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireWrite } from "@/lib/rbac";
import { Contact } from "@/models";
import { isEmployeeDocUrl, sanitizeCertificates, type EmployeeCertificate } from "@/lib/employee-docs";

type Ctx = { params: Promise<{ id: string }> };

function docsPayload(doc: { nidFrontUrl?: string; nidBackUrl?: string; certificates?: EmployeeCertificate[] }) {
  return {
    nidFrontUrl: doc.nidFrontUrl || "",
    nidBackUrl: doc.nidBackUrl || "",
    certificates: Array.isArray(doc.certificates) ? doc.certificates : [],
  };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || "");
  const url = String(body.url || body.dataUrl || "").trim();
  const title = String(body.title || "Certificate").trim() || "Certificate";
  if (!isEmployeeDocUrl(url)) return NextResponse.json({ error: "invalid_image" }, { status: 400 });

  await connectDB();
  const employee = await Contact.findById(id);
  if (!employee || employee.type !== "employee") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (kind === "nidFront") employee.set("nidFrontUrl", url);
  else if (kind === "nidBack") employee.set("nidBackUrl", url);
  else if (kind === "certificate") {
    const current = sanitizeCertificates(employee.get("certificates"));
    current.push({ title, url, at: new Date() });
    employee.set("certificates", current);
    employee.markModified("certificates");
  } else {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  await employee.save();
  return NextResponse.json({ data: docsPayload(employee.toObject() as never) });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const kind = String(req.nextUrl.searchParams.get("kind") || "");
  const index = Number(req.nextUrl.searchParams.get("index"));

  await connectDB();
  const employee = await Contact.findById(id);
  if (!employee || employee.type !== "employee") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (kind === "nidFront") employee.set("nidFrontUrl", "");
  else if (kind === "nidBack") employee.set("nidBackUrl", "");
  else if (kind === "certificate" && Number.isInteger(index) && index >= 0) {
    const current = sanitizeCertificates(employee.get("certificates"));
    employee.set(
      "certificates",
      current.filter((_, i) => i !== index),
    );
    employee.markModified("certificates");
  } else {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  await employee.save();
  return NextResponse.json({ data: docsPayload(employee.toObject() as never) });
}
