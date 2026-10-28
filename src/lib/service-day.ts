import { ServiceJob, Technician } from "@/models";
import { dayBounds, houseLabel, minutesBetween, sitePin, todayKey } from "@/lib/service-visit";
import { publicJob } from "@/lib/service-field";

export const DAY_DONE = new Set(["completed", "delivered", "closed"]);

export function parseDateKey(value: string | null | undefined, fallback = todayKey()) {
  const date = String(value || fallback);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date;
}

export function tomorrowKey(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return todayKey(d);
}

export function dayJobMatch(from: Date, to: Date) {
  return {
    $or: [
      { scheduledDate: { $gte: from, $lte: to } },
      { checkedInAt: { $gte: from, $lte: to } },
      { reportedAt: { $gte: from, $lte: to } },
    ],
  };
}

export async function loadDayJobs(date: string, extra: Record<string, unknown> = {}) {
  const { from, to } = dayBounds(date);
  const extraOr = extra.$or;
  const rest = { ...extra };
  delete rest.$or;
  const and: Record<string, unknown>[] = [dayJobMatch(from, to)];
  if (Array.isArray(extraOr) && extraOr.length) and.push({ $or: extraOr });
  if (Object.keys(rest).length) and.push(rest);
  const jobs = await ServiceJob.find({ $and: and })
    .populate("customerId", "name mobile phone whatsapp address location city lat lng")
    .populate("machineId", "brand model serialNo machineType siteName siteLocation siteAddress lat lng")
    .populate("technicianId", "name mobile speciality userId")
    .populate("technicianIds", "name mobile speciality")
    .sort({ scheduledDate: 1, checkedInAt: 1, reportedAt: 1 })
    .limit(500)
    .lean();
  return { from, to, jobs: jobs.map((job) => decorateDayJob(job as Record<string, unknown>)) };
}

export function decorateDayJob(raw: Record<string, unknown>): Record<string, unknown> {
  const customer = raw.customerId && typeof raw.customerId === "object" ? (raw.customerId as Record<string, unknown>) : null;
  const label = houseLabel({
    siteName: raw.siteName as string,
    siteLocation: raw.siteLocation as string,
    siteAddress: raw.siteAddress as string,
    customerId: raw.customerId as never,
    machineId: raw.machineId as never,
    equipmentType: raw.equipmentType as string,
  });
  const pin = sitePin({
    lat: raw.lat,
    lng: raw.lng,
    customerId: raw.customerId as never,
    machineId: raw.machineId as never,
  });
  const durationMinutes = Number(raw.durationMinutes || minutesBetween(raw.checkedInAt as Date, raw.checkedOutAt as Date));
  return publicJob({
    ...raw,
    durationMinutes,
    ...label,
    lat: pin?.lat ?? raw.lat,
    lng: pin?.lng ?? raw.lng,
    whatsapp: (customer?.whatsapp as string) || "",
    phone: (customer?.phone as string) || "",
  });
}

export function techIdOf(job: Record<string, unknown>) {
  const tech = job.technicianId;
  if (tech && typeof tech === "object" && "_id" in tech) return String((tech as { _id: unknown })._id);
  return tech ? String(tech) : "";
}

export function houseCounts(jobs: Record<string, unknown>[]) {
  let planned = 0;
  let onSite = 0;
  let done = 0;
  let skipped = 0;
  for (const job of jobs) {
    const status = String(job.status || "");
    if (status === "cancelled") {
      skipped += 1;
      continue;
    }
    planned += 1;
    if (DAY_DONE.has(status)) done += 1;
    else if (job.checkedInAt && !job.checkedOutAt) onSite += 1;
  }
  return { planned, onSite, done, skipped };
}

export async function loadActiveTechnicians() {
  return Technician.find({ isActive: true }).sort({ name: 1 }).lean();
}
