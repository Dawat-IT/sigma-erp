import type { SessionUser } from "@/lib/auth";
import { roleRank } from "@/lib/rbac";

export const GEOFENCE_METERS = 300;

export function serverNow() {
  return new Date();
}

export type ClockJob = {
  technicianId?: unknown;
  technicianIds?: unknown;
  lat?: unknown;
  lng?: unknown;
};

export type ClockDeny = { error: string; status: number };

export async function assertCanClock(session: SessionUser, job: ClockJob): Promise<ClockDeny | null> {
  if (roleRank(session.role) >= roleRank("manager")) return null;
  const { Technician } = await import("@/models");
  const tech = await Technician.findOne({ userId: session.id, isActive: true }).select("_id");
  if (!tech) return { error: "not_own_job", status: 400 };
  if (!job.technicianId && !(job as { technicianIds?: unknown[] }).technicianIds?.length) return { error: "need_technician", status: 400 };
  const { isCrewMember } = await import("@/lib/job-crew");
  if (!isCrewMember(job as { technicianId?: unknown; technicianIds?: unknown }, tech._id)) {
    return { error: "not_own_job", status: 400 };
  }
  return null;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function jobPin(job: ClockJob): { lat: number; lng: number } | null {
  const lat = Number(job.lat);
  const lng = Number(job.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function geofenceOk(job: ClockJob, lat: number, lng: number, maxM = GEOFENCE_METERS) {
  const pin = jobPin(job);
  if (!pin) return true;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return haversineMeters(pin, { lat, lng }) <= maxM;
}
