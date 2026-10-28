/** House-visit clock: check-in, check-out, how long the lift service took. */

export function minutesBetween(from?: Date | string | null, to?: Date | string | null, fallbackTo = new Date()) {
  if (!from) return 0;
  const start = from instanceof Date ? from : new Date(from);
  const end = to ? (to instanceof Date ? to : new Date(to)) : fallbackTo;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function labourHoursFromMinutes(minutes: number) {
  return Math.round((Math.max(0, minutes) / 60) * 100) / 100;
}

export function formatDuration(minutes: number, locale: "bn" | "en" = "en") {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (locale === "bn") {
    if (h && min) return `${h} ঘণ্টা ${min} মিনিট`;
    if (h) return `${h} ঘণ্টা`;
    return `${min} মিনিট`;
  }
  if (h && min) return `${h}h ${min}m`;
  if (h) return `${h}h`;
  return `${min}m`;
}

export function dayBounds(dateKey: string) {
  const [ys, ms, ds] = dateKey.split("-").map(Number);
  return {
    from: new Date(ys, (ms || 1) - 1, ds || 1, 0, 0, 0, 0),
    to: new Date(ys, (ms || 1) - 1, ds || 1, 23, 59, 59, 999),
  };
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toDateTimeLocal(value?: Date | string | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDayStart(value?: string | Date | null) {
  if (!value) return undefined;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dayBounds(value).from;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function dateKeyFrom(value?: Date | string | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return todayKey(d);
}

export function formatClock(value?: Date | string | null, locale: "bn" | "en" = "en") {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export type HouseSiteInput = {
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  customerId?: {
    name?: string;
    mobile?: string;
    address?: string;
    location?: string;
    city?: string;
  } | string | null;
  machineId?: {
    siteName?: string;
    siteLocation?: string;
    siteAddress?: string;
    brand?: string;
    model?: string;
    serialNo?: string;
    machineType?: string;
  } | string | null;
  equipmentType?: string;
};

export function resolveHouseSite(job: HouseSiteInput) {
  const customer = job.customerId && typeof job.customerId === "object" ? job.customerId : null;
  const machine = job.machineId && typeof job.machineId === "object" ? job.machineId : null;
  const siteName = String(job.siteName || machine?.siteName || customer?.name || "").trim();
  const siteLocation = String(job.siteLocation || machine?.siteLocation || customer?.location || customer?.city || "").trim();
  const siteAddress = String(job.siteAddress || machine?.siteAddress || customer?.address || "").trim();
  const lift = [machine?.brand, machine?.model, machine?.serialNo].filter(Boolean).join(" · ");
  return {
    house: siteName || "—",
    location: siteLocation,
    address: siteAddress,
    siteName,
    siteLocation,
    siteAddress,
    mobile: customer?.mobile || "",
    lift: lift || machine?.machineType || job.equipmentType || "Lift",
  };
}

export function houseLabel(job: HouseSiteInput) {
  return resolveHouseSite(job);
}

export type GeoPin = { lat: number; lng: number };

export function parseLatLng(lat?: unknown, lng?: unknown): GeoPin | null {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

export function sitePin(
  job: HouseSiteInput & { lat?: unknown; lng?: unknown },
): GeoPin | null {
  const own = parseLatLng(job.lat, job.lng);
  if (own) return own;
  const machine = job.machineId && typeof job.machineId === "object" ? job.machineId : null;
  const fromMachine = parseLatLng(
    (machine as { lat?: unknown } | null)?.lat,
    (machine as { lng?: unknown } | null)?.lng,
  );
  if (fromMachine) return fromMachine;
  const customer = job.customerId && typeof job.customerId === "object" ? job.customerId : null;
  return parseLatLng(
    (customer as { lat?: unknown } | null)?.lat,
    (customer as { lng?: unknown } | null)?.lng,
  );
}

export function mapsSearchUrl(address?: string, location?: string, pin?: GeoPin | null) {
  if (pin) return `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;
  const q = [address, location].filter(Boolean).join(", ");
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function mapsEmbedUrl(address?: string, location?: string, pin?: GeoPin | null) {
  const q = pin ? `${pin.lat},${pin.lng}` : [address, location].filter(Boolean).join(", ");
  if (!q) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

export function mapsDirectionsUrl(
  dest: { pin?: GeoPin | null; address?: string; location?: string },
  origin?: GeoPin | null,
) {
  const destination = dest.pin
    ? `${dest.pin.lat},${dest.pin.lng}`
    : [dest.address, dest.location].filter(Boolean).join(", ");
  if (!destination) return "";
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?api=1&${params.toString()}`;
}

export function haversineMeters(a: GeoPin, b: GeoPin) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatDistanceM(meters: number, bn = false) {
  const m = Math.max(0, Math.round(meters));
  if (m < 1000) return bn ? `${m} মি` : `${m} m`;
  const km = m / 1000;
  const text = km >= 10 ? km.toFixed(0) : km.toFixed(1);
  return bn ? `${text} কিমি` : `${text} km`;
}

export function waLink(mobile?: string) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  const intl = digits.startsWith("880") ? digits : digits.startsWith("0") ? `88${digits}` : digits;
  return `https://wa.me/${intl}`;
}
