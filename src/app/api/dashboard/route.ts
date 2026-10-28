import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import {
  Sale,
  Purchase,
  Expense,
  Product,
  Location,
  SellReturn,
  PurchaseReturn,
  Shipment,
  PurchaseRequisition,
} from "@/models";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const locationId = searchParams.get("locationId");
  const breakdown = searchParams.get("breakdown");

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  const saleMatch: Record<string, unknown> = { status: "final" };
  if (Object.keys(dateFilter).length) saleMatch.saleDate = dateFilter;
  if (locationId) saleMatch.locationId = locationId;

  const purchaseMatch: Record<string, unknown> = {
    status: { $in: ["received", "ordered"] },
  };
  if (Object.keys(dateFilter).length) purchaseMatch.purchaseDate = dateFilter;
  if (locationId) purchaseMatch.locationId = locationId;

  const expenseMatch: Record<string, unknown> = {};
  if (Object.keys(dateFilter).length) expenseMatch.expenseDate = dateFilter;
  if (locationId) expenseMatch.locationId = locationId;

  if (breakdown === "sales") {
    return NextResponse.json({
      rows: await Sale.find(saleMatch).sort({ saleDate: -1 }).limit(100).lean(),
    });
  }
  if (breakdown === "due") {
    return NextResponse.json({
      rows: await Sale.find({ ...saleMatch, dueAmount: { $gt: 0 } })
        .sort({ dueAmount: -1 })
        .limit(100)
        .lean(),
    });
  }
  if (breakdown === "purchase-due") {
    return NextResponse.json({
      rows: await Purchase.find({ dueAmount: { $gt: 0 } })
        .sort({ dueAmount: -1 })
        .limit(100)
        .lean(),
    });
  }
  if (breakdown === "expenses") {
    return NextResponse.json({
      rows: await Expense.find(expenseMatch)
        .sort({ expenseDate: -1 })
        .limit(100)
        .lean(),
    });
  }
  if (breakdown === "purchases") {
    return NextResponse.json({
      rows: await Purchase.find(purchaseMatch)
        .sort({ purchaseDate: -1 })
        .limit(100)
        .lean(),
    });
  }
  if (breakdown === "sell-returns") {
    return NextResponse.json({
      rows: await SellReturn.find().sort({ returnDate: -1 }).limit(100).lean(),
    });
  }
  if (breakdown === "purchase-returns") {
    return NextResponse.json({
      rows: await PurchaseReturn.find()
        .sort({ returnDate: -1 })
        .limit(100)
        .lean(),
    });
  }
  if (breakdown === "requisitions") {
    return NextResponse.json({
      rows: await PurchaseRequisition.find({ status: "pending" })
        .limit(100)
        .lean(),
    });
  }
  if (breakdown === "shipments") {
    return NextResponse.json({
      rows: await Shipment.find({ status: "pending" }).limit(100).lean(),
    });
  }
  if (breakdown === "lowstock") {
    const products = await Product.find({ isActive: true }).lean();
    const rows = products
      .map((p) => {
        const qty = (p.stocks || [])
          .filter(
            (s: { locationId?: unknown; qty?: number }) =>
              !locationId || String(s.locationId) === locationId,
          )
          .reduce((a: number, s: { qty?: number }) => a + (s.qty || 0), 0);
        return { ...p, qty };
      })
      .filter((p) => p.qty <= (p.alertQty || 10))
      .sort((a, b) => a.qty - b.qty);
    return NextResponse.json({ rows });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthSaleMatch = {
    ...saleMatch,
    saleDate: Object.keys(dateFilter).length
      ? dateFilter
      : { $gte: thirtyDaysAgo },
  };

  const [
    todayAgg,
    monthAgg,
    dueAgg,
    purchaseDueAgg,
    purchaseTotalAgg,
    expenseAgg,
    sellReturnAgg,
    purchaseReturnAgg,
    trend,
    recentSales,
    locations,
    products,
    dueSalesList,
    duePurchasesList,
    requisitions,
    pendingShipments,
    salesByStatusAgg,
    expensesByCategoryAgg,
  ] = await Promise.all([
    Sale.aggregate([
      { $match: { ...saleMatch, saleDate: { $gte: startOfToday } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      { $match: monthSaleMatch },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" },
          paid: { $sum: "$paidAmount" },
          due: { $sum: "$dueAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          status: "final",
          dueAmount: { $gt: 0 },
          ...(locationId ? { locationId } : {}),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$dueAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Purchase.aggregate([
      {
        $match: {
          dueAmount: { $gt: 0 },
          ...(locationId ? { locationId } : {}),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$dueAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Purchase.aggregate([
      { $match: purchaseMatch },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Expense.aggregate([
      {
        $match: Object.keys(dateFilter).length
          ? expenseMatch
          : { expenseDate: { $gte: thirtyDaysAgo } },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    SellReturn.aggregate([
      {
        $match: Object.keys(dateFilter).length
          ? { returnDate: dateFilter }
          : {},
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    PurchaseReturn.aggregate([
      {
        $match: Object.keys(dateFilter).length
          ? { returnDate: dateFilter }
          : {},
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Sale.aggregate([
      {
        $match: {
          status: "final",
          saleDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          ...(locationId ? { locationId } : {}),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$saleDate",
              timezone: "Asia/Dhaka",
            },
          },
          total: { $sum: "$grandTotal" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Sale.find(saleMatch).sort({ saleDate: -1 }).limit(8).lean(),
    Location.find({ isActive: true }).lean(),
    Product.find({ isActive: true }).lean(),
    Sale.find({ dueAmount: { $gt: 0 } })
      .sort({ dueAmount: -1 })
      .limit(10)
      .lean(),
    Purchase.find({ dueAmount: { $gt: 0 } })
      .sort({ dueAmount: -1 })
      .limit(10)
      .lean(),
    PurchaseRequisition.find({ status: "pending" }).limit(10).lean(),
    Shipment.find({ status: "pending" }).limit(10).lean(),
    Sale.aggregate([
      { 
        $match: {
          ...(Object.keys(dateFilter).length ? dateFilter : { saleDate: { $gte: thirtyDaysAgo } }),
          ...(locationId ? { locationId } : {})
        }
      },
      { $group: { _id: "$status", total: { $sum: "$grandTotal" } } },
    ]),
    Expense.aggregate([
      {
        $match: Object.keys(dateFilter).length
          ? expenseMatch
          : { expenseDate: { $gte: thirtyDaysAgo } },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]),
  ]);

  const lowStock = products
    .map((p) => {
      const qty = (p.stocks || [])
        .filter(
          (s: { locationId?: unknown; qty?: number }) =>
            !locationId || String(s.locationId) === locationId,
        )
        .reduce((a: number, s: { qty?: number }) => a + (s.qty || 0), 0);
      return {
        id: p._id,
        name: p.name,
        nameBn: p.nameBn,
        sku: p.sku,
        qty,
        alertQty: p.alertQty,
      };
    })
    .filter((p) => p.qty <= (p.alertQty || 10))
    .slice(0, 10);

  const monthTotal = monthAgg[0]?.total || 0;
  const monthPaid = monthAgg[0]?.paid || 0;
  const expenses = expenseAgg[0]?.total || 0;
  const net = monthPaid - expenses;

  return NextResponse.json({
    kpis: {
      totalSales: monthTotal,
      net,
      invoiceDue: dueAgg[0]?.total || 0,
      sellReturn: sellReturnAgg[0]?.total || 0,
      totalPurchase: purchaseTotalAgg[0]?.total || 0,
      purchaseDue: purchaseDueAgg[0]?.total || 0,
      purchaseReturn: purchaseReturnAgg[0]?.total || 0,
      expenses,
      todaySales: todayAgg[0]?.total || 0,
      lowStockCount: lowStock.length,
    },
    trend,
    recentSales,
    lowStock,
    locations,
    charts: {
      salesByStatus: salesByStatusAgg,
      expensesByCategory: expensesByCategoryAgg,
    },
    widgets: {
      salesPaymentDue: dueSalesList,
      purchasePaymentDue: duePurchasesList,
      purchaseRequisitions: requisitions,
      pendingShipments,
    },
  });
}
