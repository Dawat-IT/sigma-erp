import mongoose from "mongoose";

export function idOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "_id" in value) return String((value as { _id: unknown })._id);
  return String(value);
}

export function idsFromUnknown(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value.map((row) => idOf(row)).filter(Boolean))];
  const one = idOf(value);
  return one ? [one] : [];
}

export function normalizeCrew(leadId: unknown, extra?: unknown) {
  const unique = [...new Set([...idsFromUnknown(leadId), ...idsFromUnknown(extra)])];
  return {
    technicianId: unique[0] || undefined,
    technicianIds: unique,
  };
}

export function jobCrewIds(job: { technicianId?: unknown; technicianIds?: unknown }) {
  return normalizeCrew(job.technicianId, job.technicianIds).technicianIds;
}

export function isCrewMember(job: { technicianId?: unknown; technicianIds?: unknown }, techId: unknown) {
  const id = idOf(techId);
  return Boolean(id && jobCrewIds(job).includes(id));
}

export function assignedTechMatch(techId: unknown) {
  const id = idOf(techId);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return { technicianId: id };
  return { $or: [{ technicianId: id }, { technicianIds: id }] };
}
