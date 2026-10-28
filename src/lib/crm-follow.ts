import { Lead, CrmClient, Contact } from "@/models";

function oid(value: unknown) {
  const id = String(value || "").trim();
  return id || undefined;
}

export async function resolveFollowUpParty(body: {
  leadId?: string;
  clientId?: string;
  houseId?: string;
  kind?: string;
  leadName?: string;
  clientName?: string;
}) {
  let leadName = String(body.leadName || "").trim();
  let clientName = String(body.clientName || "").trim();
  let leadId = oid(body.leadId);
  let clientId = oid(body.clientId);
  let houseId = oid(body.houseId);
  let kind = body.kind === "client" || clientId || houseId ? "client" : "lead";

  if (leadId) {
    const lead = await Lead.findById(leadId).lean();
    if (lead) {
      leadName = leadName || lead.name;
      if (!houseId && lead.customerId) houseId = String(lead.customerId);
      if (!clientId && lead.status === "won") {
        const linked = await CrmClient.findOne({ leadId: lead._id }).lean();
        if (linked) {
          clientId = String(linked._id);
          clientName = clientName || linked.name;
          kind = "client";
          if (!houseId && linked.contactId) houseId = String(linked.contactId);
        }
      }
    }
  }

  if (clientId) {
    const client = await CrmClient.findById(clientId).lean();
    if (client) {
      clientName = clientName || client.name;
      kind = "client";
      if (!houseId && client.contactId) houseId = String(client.contactId);
      if (!leadId && client.leadId) {
        leadId = String(client.leadId);
        if (!leadName) {
          const lead = await Lead.findById(client.leadId).select("name").lean();
          leadName = lead?.name || clientName;
        }
      }
    }
  }

  if (houseId) {
    const house = await Contact.findById(houseId).lean();
    if (house) {
      kind = "client";
      clientName = clientName || house.name;
      leadName = leadName || house.name;
      if (!clientId) {
        const linked = await CrmClient.findOne({ contactId: house._id }).lean();
        if (linked) {
          clientId = String(linked._id);
          clientName = clientName || linked.name;
          if (!leadId && linked.leadId) leadId = String(linked.leadId);
        }
      }
    }
  }

  return {
    leadId: leadId || undefined,
    clientId: clientId || undefined,
    houseId: houseId || undefined,
    kind,
    leadName,
    clientName,
  };
}

export async function stampLeadNextFollowUp(leadId: string | undefined, scheduledAt: Date) {
  if (!leadId) return;
  await Lead.updateOne({ _id: leadId }, { $set: { nextFollowUp: scheduledAt } });
}
