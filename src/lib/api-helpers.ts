import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite } from "@/lib/rbac";
import type { Model } from "mongoose";

export function makeListRoute(
  ModelCtor: Model<unknown>,
  opts?: { searchFields?: string[]; defaultSort?: string },
) {
  return async function GET(req: NextRequest) {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(200, Number(searchParams.get("limit") || 50));
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    const filter: Record<string, unknown> = {};
    if (q && opts?.searchFields?.length) {
      filter.$or = opts.searchFields.map((f) => ({
        [f]: new RegExp(q, "i"),
      }));
    }

    const [data, total] = await Promise.all([
      ModelCtor.find(filter)
        .sort(opts?.defaultSort || "-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ModelCtor.countDocuments(filter),
    ]);

    return NextResponse.json({ data, total, page, limit });
  };
}

export function makePostRoute(ModelCtor: Model<unknown>, fields: string[]) {
  return async function POST(req: NextRequest) {
    const { session, error } = await requireWrite();
    if (error || !session) return error!;
    await connectDB();
    const body = await req.json();
    const doc: Record<string, unknown> = {};
    for (const f of fields) {
      if (body[f] !== undefined) doc[f] = body[f];
    }
    const created = await ModelCtor.create(doc);
    return NextResponse.json({ data: created }, { status: 201 });
  };
}
