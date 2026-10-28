import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Contact, Purchase, Sale, ServiceJob } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

type LedgerEntry = {
  date: string;
  type: string;
  ref: string;
  referenceNo?: string;
  description: string;
  debit: number;
  credit: number;
  paidAmount: number;
  dueAmount: number;
  balance: number;
  link?: string;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await connectDB();

  const contact = await Contact.findById(id).lean();
  if (!contact || contact.isActive === false) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const isSupplier = contact.type === "supplier" || contact.type === "both";
  const isCustomer = contact.type === "customer" || contact.type === "both";

  const opening = Number(contact.openingBalance || 0);
  const entries: LedgerEntry[] = [];
  let running = opening;

  const createdAt =
    contact && "createdAt" in contact && contact.createdAt
      ? new Date(contact.createdAt as Date).toISOString()
      : new Date(0).toISOString();

  entries.push({
    date: createdAt,
    type: "opening",
    ref: "—",
    description: "Opening balance",
    debit: opening > 0 ? opening : 0,
    credit: opening < 0 ? Math.abs(opening) : 0,
    paidAmount: 0,
    dueAmount: opening > 0 ? opening : 0,
    balance: running,
  });

  if (isCustomer) {
    const saleFilter: Record<string, unknown> = {
      customerId: id,
      status: { $in: ["quotation", "final", "returned"] },
    };
    if (from || to) {
      saleFilter.saleDate = {};
      if (from) (saleFilter.saleDate as Record<string, Date>).$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (saleFilter.saleDate as Record<string, Date>).$lte = end;
      }
    }

    const sales = await Sale.find(saleFilter).sort({ saleDate: 1 }).lean();
    for (const sale of sales) {
      const masterRef = sale.referenceNo || "";
      if (sale.quotationNo) {
        entries.push({
          date: new Date(sale.saleDate || sale.createdAt).toISOString(),
          type: "quotation",
          ref: sale.quotationNo,
          referenceNo: masterRef,
          description: `Quotation · ${sale.quotationNo}`,
          debit: 0,
          credit: 0,
          paidAmount: 0,
          dueAmount: 0,
          balance: running,
          link: `/sales/${sale._id}/quotation`,
        });
      }
      if (sale.status === "quotation") continue;

      if (sale.salesOrderNo) {
        entries.push({
          date: new Date(sale.saleDate || sale.createdAt).toISOString(),
          type: "sales_order",
          ref: sale.salesOrderNo,
          referenceNo: masterRef,
          description: `Sales Order · ${sale.salesOrderNo}`,
          debit: 0,
          credit: 0,
          paidAmount: 0,
          dueAmount: 0,
          balance: running,
          link: `/sales/${sale._id}/invoice`,
        });
      }

      const grand = Number(sale.grandTotal || 0);
      entries.push({
        date: new Date(sale.saleDate || sale.createdAt).toISOString(),
        type: "invoice",
        ref: sale.invoiceNo,
        referenceNo: masterRef,
        description: `Invoice · ${sale.invoiceNo}`,
        debit: grand,
        credit: 0,
        paidAmount: 0,
        dueAmount: grand,
        balance: running,
        link: `/sales/${sale._id}/invoice`,
      });

      const payments = Array.isArray(sale.payments) ? sale.payments : [];
      let paidSoFar = 0;
      for (const p of payments) {
        const amt = Number(p.amount || 0);
        if (!amt) continue;
        paidSoFar += amt;
        entries.push({
          date: new Date(p.paidAt || sale.saleDate || sale.createdAt).toISOString(),
          type: "payment",
          ref: sale.invoiceNo,
          referenceNo: masterRef,
          description: `Receipt · ${p.method}`,
          debit: 0,
          credit: amt,
          paidAmount: amt,
          dueAmount: Math.max(0, grand - paidSoFar),
          balance: running,
          link: `/sales/${sale._id}/invoice`,
        });
      }
    }

    const jobFilter: Record<string, unknown> = {
      customerId: id,
      status: { $in: ["completed", "delivered"] },
    };
    if (from || to) {
      jobFilter.receivedDate = {};
      if (from) (jobFilter.receivedDate as Record<string, Date>).$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (jobFilter.receivedDate as Record<string, Date>).$lte = end;
      }
    }
    const jobs = await ServiceJob.find(jobFilter).sort({ receivedDate: 1 }).lean();
    for (const job of jobs) {
      const debit = Number(job.grandTotal || 0);
      const credit = Number(job.paidAmount || 0);
      if (!debit && !credit) continue;
      running = running + debit - credit;
      entries.push({
        date: new Date(job.receivedDate || job.createdAt).toISOString(),
        type: "service",
        ref: job.jobNo,
        description: `Service · ${job.status}`,
        debit,
        credit,
        paidAmount: credit,
        dueAmount: Math.max(0, debit - credit),
        balance: running,
        link: `/services/${job._id}/invoice`,
      });
    }
  }

  if (isSupplier) {
    const purchaseFilter: Record<string, unknown> = { supplierId: id };
    if (from || to) {
      purchaseFilter.purchaseDate = {};
      if (from) (purchaseFilter.purchaseDate as Record<string, Date>).$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        (purchaseFilter.purchaseDate as Record<string, Date>).$lte = end;
      }
    }

    const purchases = await Purchase.find(purchaseFilter).sort({ purchaseDate: 1 }).lean();
    for (const purchase of purchases) {
      // Payable: purchase increases what we owe (credit), payments reduce it (debit)
      const credit = Number(purchase.grandTotal || 0);
      const debit = Number(purchase.paidAmount || 0);
      running = running + credit - debit;
      entries.push({
        date: new Date(purchase.purchaseDate || purchase.createdAt).toISOString(),
        type: "purchase",
        ref: purchase.referenceNo,
        description: `Purchase · ${purchase.status}`,
        debit,
        credit,
        paidAmount: debit,
        dueAmount: Math.max(0, credit - debit),
        balance: running,
        link: `/purchases`,
      });
    }
  }

  // Sort all entries by date (opening stays first by using early date, then re-sort non-opening)
  const openingEntry = entries[0]!;
  const rest = entries.slice(1).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Recalculate running balance in chronological order
  let bal = opening;
  const ledger: LedgerEntry[] = [
    {
      ...openingEntry,
      balance: bal,
    },
  ];
  for (const e of rest) {
    if (isSupplier && !isCustomer) {
      bal = bal + e.credit - e.debit;
    } else if (isCustomer && !isSupplier) {
      bal = bal + e.debit - e.credit;
    } else {
      // both: treat customer-side (debit-credit) for sales/service, supplier for purchases
      if (e.type === "purchase") bal = bal + e.credit - e.debit;
      else bal = bal + e.debit - e.credit;
    }
    ledger.push({ ...e, balance: bal });
  }

  const totalDebit = ledger.reduce((a, e) => a + e.debit, 0);
  const totalCredit = ledger.reduce((a, e) => a + e.credit, 0);

  return NextResponse.json({
    data: {
      contact: {
        _id: contact._id,
        name: contact.name,
        nameBn: contact.nameBn,
        mobile: contact.mobile,
        address: contact.address,
        type: contact.type,
        balance: Number(contact.balance || 0),
        openingBalance: opening,
      },
      entries: ledger,
      summary: {
        openingBalance: opening,
        totalDebit,
        totalCredit,
        closingBalance: bal,
        entryCount: ledger.length,
      },
    },
  });
}
