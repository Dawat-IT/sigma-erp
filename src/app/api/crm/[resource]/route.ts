import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { canWrite } from "@/lib/rbac";
import { CRM_RESOURCES, isCrmResource } from "@/lib/crm-resources";
import { Lead, CrmClient, Contact } from "@/models";
import { resolveFollowUpParty, stampLeadNextFollowUp } from "@/lib/crm-follow";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { resource } = await ctx.params;
  if (!isCrmResource(resource)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await connectDB();
  const handler = CRM_RESOURCES[resource];
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(500, Number(searchParams.get("limit") || 200));
  const filter: Record<string, unknown> = {};

  if (q && handler.search.length) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const or: Record<string, unknown>[] = handler.search.map((f) => ({ [f]: new RegExp(safe, "i") }));
    if (resource === "followups") {
      const phoneRe = new RegExp(safe, "i");
      const [leads, clients] = await Promise.all([
        Lead.find({ mobile: phoneRe }).select("_id").lean(),
        CrmClient.find({ mobile: phoneRe }).select("_id").lean(),
      ]);
      if (leads.length) or.push({ leadId: { $in: leads.map((row) => row._id) } });
      if (clients.length) {
        or.push({ clientId: { $in: clients.map((row) => row._id) } });
      }
      const houses = await Contact.find({
        type: { $in: ["customer", "both"] },
        $or: [{ name: phoneRe }, { mobile: phoneRe }],
      })
        .select("_id")
        .lean();
      if (houses.length) or.push({ houseId: { $in: houses.map((row) => row._id) } });
    }
    filter.$or = or;
  }

  for (const key of ["status", "rating", "source", "product", "company", "stage"]) {
    const value = searchParams.get(key)?.trim();
    if (value && value !== "all") filter[key] = value;
  }

  const leadId = searchParams.get("leadId")?.trim();
  const clientId = searchParams.get("clientId")?.trim();
  const houseId = searchParams.get("houseId")?.trim();
  const party = searchParams.get("party")?.trim();
  if (resource === "followups") {
    if (leadId) filter.leadId = leadId;
    if (clientId) filter.clientId = clientId;
    if (houseId) {
      const linked = await CrmClient.findOne({ contactId: houseId }).select("_id").lean();
      filter.$or = [{ houseId }, ...(linked ? [{ clientId: linked._id }] : [])];
    } else if (party === "client") {
      filter.$or = [
        { kind: "client" },
        { houseId: { $exists: true, $ne: null } },
        { clientId: { $exists: true, $ne: null } },
      ];
    }
    if (party === "lead" && !leadId && !clientId) {
      filter.$and = [...(Array.isArray(filter.$and) ? filter.$and : []), {
        $or: [{ kind: "lead" }, { kind: { $exists: false } }],
      }];
    }
  }

  if (resource === "followups") {
    const view = searchParams.get("view") || "all";
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekEnd = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    if (view === "overdue") {
      filter.scheduledAt = { $lt: todayStart };
      filter.status = { $nin: ["completed"] };
    } else if (view === "today") {
      filter.scheduledAt = { $gte: todayStart, $lte: todayEnd };
    } else if (view === "upcoming") {
      filter.scheduledAt = { $gt: todayEnd, $lte: weekEnd };
      filter.status = { $nin: ["completed"] };
    } else if (view !== "all") {
      filter.status = view.replace("-", "_");
    }
  }

  const query = handler.model
    .find(filter)
    .sort(resource === "followups" ? { scheduledAt: searchParams.get("sort") === "desc" ? -1 : 1 } : "-createdAt")
    .limit(limit);
  if (resource === "followups") {
    query
      .populate("houseId", "name mobile location address")
      .populate("clientId", "name mobile company contactId")
      .populate("leadId", "name mobile status");
  }
  const data = await query.lean();
  const total = await handler.model.countDocuments(filter);
  return NextResponse.json({ data, total });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { resource } = await ctx.params;
  if (!isCrmResource(resource)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json();
  for (const field of CRM_RESOURCES[resource].required) {
    if (!body[field]) {
      return NextResponse.json({ error: "validation", field }, { status: 400 });
    }
  }

  await connectDB();
  if (resource === "followups") {
    if (!body.leadId && !body.clientId && !body.houseId) {
      return NextResponse.json({ error: "party_required" }, { status: 400 });
    }
    const party = await resolveFollowUpParty(body);
    Object.assign(body, party);
  }

  const created = await CRM_RESOURCES[resource].model.create(body);
  if (resource === "followups" && created.scheduledAt) {
    await stampLeadNextFollowUp(created.leadId ? String(created.leadId) : undefined, created.scheduledAt);
  }
  return NextResponse.json({ data: created }, { status: 201 });
}
