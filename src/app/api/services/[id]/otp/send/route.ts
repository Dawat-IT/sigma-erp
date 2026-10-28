import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireWrite } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  OTP_TTL_MS,
  assertCanFieldAct,
  ensureServiceFieldSchema,
  hashOtp,
  publicJob,
  randomOtp,
} from "@/lib/service-field";
import { Contact, ServiceJob } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await connectDB();
  await ensureServiceFieldSchema();
  const job = await ServiceJob.findById(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const deny = await assertCanFieldAct(session, job);
  if (deny) return NextResponse.json({ error: deny.error }, { status: deny.status });

  const customer = await Contact.findById(job.customerId).select("mobile name");
  const code = randomOtp();
  job.set("otpHash", hashOtp(code));
  job.set("otpExpiresAt", new Date(Date.now() + OTP_TTL_MS));
  job.set("otpVerifiedAt", null);
  await job.save();

  console.info("[otp] send", job.jobNo, customer?.mobile || "");
  await writeAudit({
    userId: session.id,
    userName: session.name,
    action: "otp_send",
    entityType: "ServiceJob",
    entityId: String(job._id),
    details: job.jobNo,
  });

  const payload: { sent: true; mock?: string; data?: Record<string, unknown> } = {
    sent: true,
    data: publicJob(job.toObject() as Record<string, unknown>),
  };
  if (process.env.NODE_ENV !== "production") payload.mock = code;
  return NextResponse.json(payload);
}
