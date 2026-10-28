import { Lead, CrmFollowUp, CrmClient, CrmDeal, CrmCampaign } from "@/models";

export const CRM_RESOURCES = {
  leads: {
    model: Lead,
    search: ["name", "mobile", "email", "company", "product", "ownerName", "source"],
    required: ["name"],
  },
  followups: {
    model: CrmFollowUp,
    search: ["leadName", "clientName", "notes", "status"],
    required: ["scheduledAt"],
  },
  clients: {
    model: CrmClient,
    search: ["name", "mobile", "email", "company"],
    required: ["name"],
  },
  deals: {
    model: CrmDeal,
    search: ["title", "clientName", "leadName", "stage"],
    required: ["title"],
  },
  campaigns: {
    model: CrmCampaign,
    search: ["name", "source", "status", "notes"],
    required: ["name"],
  },
} as const;

export type CrmResource = keyof typeof CRM_RESOURCES;

export function isCrmResource(value: string): value is CrmResource {
  return value in CRM_RESOURCES;
}
