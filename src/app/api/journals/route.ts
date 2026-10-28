import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { JournalEntry, LedgerAccount, nextSeq } from "@/models";
import { generateDocNo } from "@/lib/utils";
import { canWrite, canDelete } from "@/lib/rbac";

type LineIn = {
  accountId?: string;
  debit?: number;
  credit?: number;
  memo?: string;
};

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(200, Number(searchParams.get("limit") || 50));

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const data = await JournalEntry.find(filter).sort({ entryDate: -1 }).limit(limit).lean();
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const rawLines: LineIn[] = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length < 2) {
    return NextResponse.json({ error: "need_two_lines" }, { status: 400 });
  }

  const accountIds = [...new Set(rawLines.map((l) => String(l.accountId || "")).filter(Boolean))];
  const accounts = await LedgerAccount.find({ _id: { $in: accountIds }, isActive: true }).lean();
  const byId = new Map(accounts.map((a) => [String(a._id), a]));

  const lines = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const row of rawLines) {
    const id = String(row.accountId || "");
    const acc = byId.get(id);
    if (!acc) {
      return NextResponse.json({ error: "invalid_account" }, { status: 400 });
    }
    const debit = Math.max(0, Number(row.debit || 0));
    const credit = Math.max(0, Number(row.credit || 0));
    if (debit > 0 && credit > 0) {
      return NextResponse.json({ error: "line_both_sides" }, { status: 400 });
    }
    if (debit === 0 && credit === 0) continue;
    totalDebit += debit;
    totalCredit += credit;
    lines.push({
      accountId: acc._id,
      accountName: acc.name,
      debit,
      credit,
      memo: row.memo || "",
    });
  }

  if (lines.length < 2) {
    return NextResponse.json({ error: "need_two_lines" }, { status: 400 });
  }
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json({ error: "unbalanced", totalDebit, totalCredit }, { status: 400 });
  }

  const postNow = body.status === "posted" || body.post === true;
  const seq = await nextSeq("journal_entry");
  const entry = await JournalEntry.create({
    entryNo: generateDocNo("JE", seq),
    entryDate: body.entryDate ? new Date(body.entryDate) : new Date(),
    memo: String(body.memo || "").trim(),
    status: postNow ? "posted" : "draft",
    lines,
    totalDebit,
    totalCredit,
    createdBy: session.id,
    postedAt: postNow ? new Date() : undefined,
  });

  if (postNow) {
    for (const line of lines) {
      const delta = Number(line.debit || 0) - Number(line.credit || 0);
      await LedgerAccount.findByIdAndUpdate(line.accountId, { $inc: { balance: delta } });
    }
  }

  return NextResponse.json({ data: entry }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const id = body._id || body.id;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const existing = await JournalEntry.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "posted") {
    return NextResponse.json({ error: "already_posted" }, { status: 400 });
  }

  if (body.post === true || body.status === "posted") {
    if (Math.abs(existing.totalDebit - existing.totalCredit) > 0.01) {
      return NextResponse.json({ error: "unbalanced" }, { status: 400 });
    }
    for (const line of existing.lines) {
      const delta = Number(line.debit || 0) - Number(line.credit || 0);
      await LedgerAccount.findByIdAndUpdate(line.accountId, { $inc: { balance: delta } });
    }
    existing.status = "posted";
    existing.postedAt = new Date();
    await existing.save();
    return NextResponse.json({ data: existing });
  }

  if (body.memo != null) existing.memo = String(body.memo);
  if (body.entryDate) existing.entryDate = new Date(body.entryDate);
  await existing.save();
  return NextResponse.json({ data: existing });
}

export async function DELETE(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canDelete(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await connectDB();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const existing = await JournalEntry.findById(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "posted") {
    return NextResponse.json({ error: "cannot_delete_posted" }, { status: 400 });
  }
  await existing.deleteOne();
  return NextResponse.json({ ok: true });
}
