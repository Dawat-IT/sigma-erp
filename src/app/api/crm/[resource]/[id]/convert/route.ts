import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { canWrite, requireSession } from "@/lib/rbac";
import { Lead, CrmClient, CrmFollowUp, Contact } from "@/models";

type Ctx = { params: Promise<{ resource: string; id: string }> };

function mobileKey(value: unknown) {
  return String(value || "").replace(/\s+/g, "").trim();
}

/** Convert a won / accepted lead into a house Contact + CRM client. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error || !session) return error!;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { resource, id } = await ctx.params;
  if (resource !== "leads") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await connectDB();
  const lead = await Lead.findById(id);
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const mobile = mobileKey(lead.mobile) || `L${String(lead._id).slice(-10)}`;
  let contact = await Contact.findOne({
    isActive: { $ne: false },
    type: { $in: ["customer", "both"] },
    $or: [{ mobile }, { supplierContact: mobile }],
  });
  if (!contact) {
    contact = await Contact.create({
      type: "customer",
      name: lead.name,
      mobile,
      email: lead.email,
      address: lead.company,
      notes: lead.notes,
      supplierName: lead.name,
      supplierContact: mobile,
    });
  }

  lead.status = "won";
  lead.lifeStage = "won";
  lead.set("customerId", contact._id);
  await lead.save();

  let client = await CrmClient.findOne({ leadId: lead._id });
  if (!client) {
    client = await CrmClient.create({
      name: lead.name,
      mobile: lead.mobile || mobile,
      email: lead.email,
      company: lead.company,
      leadId: lead._id,
      contactId: contact._id,
      notes: lead.notes,
      status: "active",
    });
  } else {
    client.set("contactId", contact._id);
    await client.save();
  }

  await CrmFollowUp.updateMany(
    { leadId: lead._id },
    { $set: { clientId: client._id, clientName: client.name, houseId: contact._id, kind: "client" } },
  );

  const clientObj = client.toObject();
  return NextResponse.json({
    data: clientObj,
    client: clientObj,
    lead: lead.toObject(),
    contact: contact.toObject(),
  });
}
