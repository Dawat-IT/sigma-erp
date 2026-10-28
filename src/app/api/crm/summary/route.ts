import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { Lead, CrmFollowUp, CrmDeal, CrmCampaign, CrmClient } from "@/models";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    leadTotal,
    leadOpen,
    leadWon,
    leadLost,
    hot,
    warm,
    cold,
    followTotal,
    followOverdue,
    followToday,
    followUpcoming,
    dealTotal,
    dealValue,
    campaignTotal,
    clientTotal,
    recentLeads,
    overdueFollows,
    recentDeals,
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ status: "open" }),
    Lead.countDocuments({ status: "won" }),
    Lead.countDocuments({ status: "lost" }),
    Lead.countDocuments({ rating: "hot" }),
    Lead.countDocuments({ rating: "warm" }),
    Lead.countDocuments({ rating: "cold" }),
    CrmFollowUp.countDocuments(),
    CrmFollowUp.countDocuments({
      scheduledAt: { $lt: todayStart },
      status: { $nin: ["completed"] },
    }),
    CrmFollowUp.countDocuments({ scheduledAt: { $gte: todayStart, $lte: todayEnd } }),
    CrmFollowUp.countDocuments({
      scheduledAt: { $gt: todayEnd, $lte: weekEnd },
      status: { $nin: ["completed"] },
    }),
    CrmDeal.countDocuments(),
    CrmDeal.aggregate([{ $group: { _id: null, total: { $sum: "$value" } } }]),
    CrmCampaign.countDocuments(),
    CrmClient.countDocuments(),
    Lead.find().sort("-createdAt").limit(8).lean(),
    CrmFollowUp.find({
      scheduledAt: { $lt: todayStart },
      status: { $nin: ["completed"] },
    })
      .sort("scheduledAt")
      .limit(8)
      .lean(),
    CrmDeal.find().sort("-updatedAt").limit(8).lean(),
  ]);

  const dealsByStage = await CrmDeal.aggregate([{ $group: { _id: "$stage", count: { $sum: 1 }, value: { $sum: "$value" } } }]);

  return NextResponse.json({
    data: {
      leads: { total: leadTotal, open: leadOpen, won: leadWon, lost: leadLost, hot, warm, cold },
      followups: {
        total: followTotal,
        overdue: followOverdue,
        today: followToday,
        upcoming: followUpcoming,
      },
      deals: { total: dealTotal, value: dealValue[0]?.total || 0, byStage: dealsByStage },
      campaigns: { total: campaignTotal },
      clients: { total: clientTotal },
      recentLeads,
      overdueFollows,
      recentDeals,
    },
  });
}
