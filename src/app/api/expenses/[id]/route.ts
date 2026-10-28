import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireDelete, requireWrite } from "@/lib/rbac";
import { Expense } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  await connectDB();
  const body = await req.json();
  const updated = await Expense.findByIdAndUpdate(
    id,
    {
      category: body.category,
      title: body.title,
      amount: Number(body.amount || 0),
      paymentMethod: body.paymentMethod,
      note: body.note,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
    },
    { new: true },
  );
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;
  const { id } = await ctx.params;
  await connectDB();
  const deleted = await Expense.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
