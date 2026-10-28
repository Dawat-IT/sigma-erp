import mongoose from "mongoose";
import crypto from "node:crypto";
import type { SessionUser } from "@/lib/auth";
import { roleRank } from "@/lib/rbac";
import {
  GEOFENCE_METERS,
  assertCanClock,
  geofenceOk,
  haversineMeters,
  jobPin,
  type ClockJob,
} from "@/lib/service-clock";

export { GEOFENCE_METERS, geofenceOk, haversineMeters, jobPin };

export const OTP_TTL_MS = 10 * 60 * 1000;
export const PHOTO_KINDS = ["site", "selfie", "checklist"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export type FieldFlags = {
  requireGps: boolean;
  requireOtp: boolean;
  requirePhoto: boolean;
};

export function parseCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

export function hashOtp(code: string) {
  return crypto.createHash("sha256").update(String(code || "").trim()).digest("hex");
}

export function randomOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function publicJob(job: Record<string, unknown>): Record<string, unknown> {
  const next = { ...job };
  delete next.otpHash;
  return next;
}

export async function ensureServiceFieldSchema() {
  const { Contact, Machine, ServiceJob, Business } = await import("@/models");
  if (!Contact.schema.path("lat")) Contact.schema.add({ lat: Number, lng: Number });
  if (!Machine.schema.path("lat")) Machine.schema.add({ lat: Number, lng: Number });
  if (!ServiceJob.schema.path("lat")) {
    ServiceJob.schema.add({
      lat: Number,
      lng: Number,
      checkInLat: Number,
      checkInLng: Number,
      checkInAccuracyM: Number,
      otpHash: String,
      otpExpiresAt: Date,
      otpVerifiedAt: Date,
      photos: [
        {
          url: { type: String, required: true },
          kind: { type: String, enum: ["site", "selfie", "checklist"], default: "site" },
          at: { type: Date, default: Date.now },
          by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        },
      ],
    });
  }
  if (!Business.schema.path("requireGps")) {
    Business.schema.add({
      requireGps: { type: Boolean, default: false },
      requireOtp: { type: Boolean, default: false },
      requirePhoto: { type: Boolean, default: false },
    });
  }
}

export async function readFieldFlags(): Promise<FieldFlags> {
  await ensureServiceFieldSchema();
  const { Business } = await import("@/models");
  const biz = await Business.findOne().select("requireGps requireOtp requirePhoto").lean();
  return {
    requireGps: Boolean(biz?.requireGps),
    requireOtp: Boolean(biz?.requireOtp),
    requirePhoto: Boolean(biz?.requirePhoto),
  };
}

export async function resolveHousePin(job: ClockJob & { customerId?: unknown; machineId?: unknown }) {
  const own = jobPin(job);
  if (own) return own;
  const { Machine, Contact } = await import("@/models");
  if (job.machineId) {
    const machine = await Machine.findById(job.machineId).select("lat lng").lean();
    const pin = jobPin(machine || {});
    if (pin) return pin;
  }
  if (job.customerId) {
    const contact = await Contact.findById(job.customerId).select("lat lng").lean();
    const pin = jobPin(contact || {});
    if (pin) return pin;
  }
  return null;
}

export async function assertCanFieldAct(session: SessionUser, job: ClockJob) {
  if (roleRank(session.role) >= roleRank("manager")) return null;
  return assertCanClock(session, job);
}

export async function countGeofenceOverrides(technicianId: unknown) {
  if (!technicianId) return 0;
  const { ActivityLog } = await import("@/models");
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return ActivityLog.countDocuments({
    action: "override_geofence",
    details: new RegExp(`tech:${String(technicianId)}`),
    createdAt: { $gte: from },
  });
}

export type GeoCheck =
  | { ok: true; pin: null; noPin: true }
  | { ok: true; pin: { lat: number; lng: number }; skipped: true }
  | { ok: true; pin: { lat: number; lng: number }; lat: number; lng: number; dist: number; override?: boolean; reason?: string }
  | { ok: false; error: "too_far"; status: 400; dist?: number };

export async function assertCheckInGeo(
  _session: SessionUser,
  job: ClockJob & { customerId?: unknown; machineId?: unknown },
  body: { lat?: unknown; lng?: unknown; override?: unknown; reason?: unknown },
  _flags: FieldFlags,
): Promise<GeoCheck> {
  const pin = await resolveHousePin(job);
  const gps = parseCoord(body.lat, body.lng);
  if (!gps) {
    if (!pin) return { ok: true, pin: null, noPin: true };
    return { ok: true, pin, skipped: true };
  }
  const dist = pin ? haversineMeters(pin, gps) : 0;
  return { ok: true, pin: pin || gps, lat: gps.lat, lng: gps.lng, dist };
}

export function hasSitePhoto(photos: unknown) {
  return (Array.isArray(photos) ? photos : []).some((row) => {
    const kind = String((row as { kind?: string })?.kind || "site");
    const url = String((row as { url?: string })?.url || "");
    return url && kind === "site";
  });
}
