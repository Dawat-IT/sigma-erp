import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ActivityLog } from "@/models";
import { formatBDT } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  
  const filter: Record<string, unknown> = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) (filter.createdAt as Record<string, Date>).$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      (filter.createdAt as Record<string, Date>).$lte = end;
    }
  }

  if (q) {
    filter.$or = [
      { userName: new RegExp(q, "i") },
      { action: new RegExp(q, "i") },
      { entityType: new RegExp(q, "i") },
      { details: new RegExp(q, "i") }
    ];
  }

  const logs = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const data = logs.map(log => ({
    label: `${log.userName} ${log.action} ${log.entityType} - ${log.details || ""}`,
    value: log.createdAt,
  }));

  return NextResponse.json({ data, summary: data });
}
