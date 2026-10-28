import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireWrite } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { assertCanFieldAct, ensureServiceFieldSchema, hashOtp, publicJob } from "@/lib/service-field";
import { ServiceJob } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "bad_otp" }, { status: 400 });
  }

  await connectDB();
  await ensureServiceFieldSchema();
  const job = await ServiceJob.findById(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const deny = await assertCanFieldAct(session, job);
  if (deny) return NextResponse.json({ error: deny.error }, { status: deny.status });

  const hash = String(job.get("otpHash") || "");
  const expires = job.get("otpExpiresAt") as Date | undefined;
  if (!hash || !expires || new Date(expires).getTime() < Date.now() || hashOtp(code) !== hash) {
    return NextResponse.json({ error: "bad_otp" }, { status: 400 });
  }

  job.set("otpVerifiedAt", new Date());
  await job.save();
  await writeAudit({
    userId: session.id,
    userName: session.name,
    action: "otp_verify",
    entityType: "ServiceJob",
    entityId: String(job._id),
    details: job.jobNo,
  });

  return NextResponse.json({ ok: true, data: publicJob(job.toObject() as Record<string, unknown>) });
}
