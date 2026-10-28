import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireWrite } from "@/lib/rbac";
import { PHOTO_KINDS, assertCanFieldAct, ensureServiceFieldSchema, publicJob, type PhotoKind } from "@/lib/service-field";
import { ServiceJob } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const kindRaw = String(body.kind || "site");
  const kind = PHOTO_KINDS.includes(kindRaw as PhotoKind) ? (kindRaw as PhotoKind) : "site";
  const url = String(body.url || body.dataUrl || "").trim();
  if (!url) return NextResponse.json({ error: "need_photo" }, { status: 400 });
  if (url.startsWith("data:") && url.length > 1_200_000) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }
  if (!url.startsWith("data:") && !url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  await connectDB();
  await ensureServiceFieldSchema();
  const job = await ServiceJob.findById(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const deny = await assertCanFieldAct(session, job);
  if (deny) return NextResponse.json({ error: deny.error }, { status: deny.status });

  const photos = Array.isArray(job.get("photos")) ? [...(job.get("photos") as object[])] : [];
  photos.push({ url, kind, at: new Date(), by: session.id });
  job.set("photos", photos);
  await job.save();

  return NextResponse.json({ data: publicJob(job.toObject() as Record<string, unknown>) });
}
