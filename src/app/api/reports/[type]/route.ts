import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Sale, Purchase, Expense, Product, Contact, Account } from "@/models";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectDB();

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  const salesMatch: Record<string, unknown> = { status: "final" };
  if (Object.keys(dateFilter).length) salesMatch.saleDate = dateFilter;

  let rows: { label: string; value: number }[] = [];

  switch (type) {
    case "profit-loss": {
      const [sales, purchases, expenses] = await Promise.all([
        Sale.aggregate([{ $match: salesMatch }, { $group: { _id: null, t: { $sum: "$grandTotal" } } }]),
        Purchase.aggregate([
          { $match: Object.keys(dateFilter).length ? { purchaseDate: dateFilter } : {} },
          { $group: { _id: null, t: { $sum: "$grandTotal" } } },
        ]),
        Expense.aggregate([
          { $match: Object.keys(dateFilter).length ? { expenseDate: dateFilter } : {} },
          { $group: { _id: null, t: { $sum: "$amount" } } },
        ]),
      ]);
      const rev = sales[0]?.t || 0;
      const cogs = purchases[0]?.t || 0;
      const exp = expenses[0]?.t || 0;
      rows = [
        { label: "Total Sales", value: rev },
        { label: "Total Purchase", value: cogs },
        { label: "Total Expense", value: exp },
        { label: "Gross Profit", value: rev - cogs },
        { label: "Net Profit", value: rev - cogs - exp },
      ];
      break;
    }
    case "stock":
    case "items": {
      const products = await Product.find({ isActive: true }).limit(100).lean();
      rows = products.map((p) => ({
        label: p.name,
        value: (p.stocks || []).reduce((a: number, s: { qty?: number }) => a + (s.qty || 0), 0),
      }));
      break;
    }
    case "customer-supplier": {
      const contacts = await Contact.find().limit(100).lean();
      rows = contacts.map((c) => ({
        label: `${c.name} (${c.type})`,
        value: c.balance || 0,
      }));
      break;
    }
    case "expense": {
      const ex = await Expense.find().sort({ expenseDate: -1 }).limit(50).lean();
      rows = ex.map((e) => ({ label: `${e.category}: ${e.title}`, value: e.amount }));
      break;
    }
    case "sell-payment": {
      const due = await Sale.aggregate([
        { $match: { dueAmount: { $gt: 0 } } },
        { $group: { _id: "$customerName", value: { $sum: "$dueAmount" } } },
      ]);
      rows = due.map((d: { _id: string; value: number }) => ({
        label: d._id || "Unknown",
        value: d.value,
      }));
      break;
    }
    case "purchase-payment": {
      const due = await Purchase.aggregate([
        { $match: { dueAmount: { $gt: 0 } } },
        { $group: { _id: "$supplierName", value: { $sum: "$dueAmount" } } },
      ]);
      rows = due.map((d: { _id: string; value: number }) => ({
        label: d._id || "Unknown",
        value: d.value,
      }));
      break;
    }
    case "balance-sheet":
    case "trial-balance":
    case "cash-flow":
    case "account-report": {
      const accs = await Account.find().lean();
      rows = accs.map((a) => ({ label: a.name, value: a.balance || 0 }));
      break;
    }
    default: {
      const sales = await Sale.aggregate([
        { $match: salesMatch },
        { $group: { _id: null, t: { $sum: "$grandTotal" } } },
      ]);
      rows = [{ label: "Total", value: sales[0]?.t || 0 }];
    }
  }

  return NextResponse.json({ data: rows, rows, summary: rows });
}
