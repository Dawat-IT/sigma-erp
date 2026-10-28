import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireWrite } from "@/lib/rbac";
import { Expense } from "@/models";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q")?.trim();
  const filter: Record<string, unknown> = {};
  if (from || to) {
    filter.expenseDate = {};
    if (from) (filter.expenseDate as Record<string, Date>).$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      (filter.expenseDate as Record<string, Date>).$lte = end;
    }
  }
  if (q) {
    filter.$or = [
      { category: new RegExp(q, "i") },
      { title: new RegExp(q, "i") },
      { note: new RegExp(q, "i") },
    ];
  }
  const data = await Expense.find(filter).sort({ expenseDate: -1 }).limit(200).lean();
  const total = data.reduce((a, e) => a + e.amount, 0);
  return NextResponse.json({ data, total });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  await connectDB();
  const body = await req.json();
  const expense = await Expense.create({
    category: body.category,
    title: body.title,
    amount: Number(body.amount),
    locationId: body.locationId || undefined,
    paymentMethod: body.paymentMethod || "cash",
    note: body.note,
    expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
    createdBy: session.id,
  });
  return NextResponse.json({ data: expense }, { status: 201 });
}
