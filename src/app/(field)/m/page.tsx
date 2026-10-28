"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Clock,
  Copy,
  MapPin,
  Phone,
  Radio,
  MessageCircle,
} from "lucide-react";
import { AlertBanner, EmptyState } from "@/components/ui";
import { fetchJson } from "@/lib/fetch-json";
import { readStoredJob, writeStoredJob } from "@/lib/field-job";
import {
  formatClock,
  mapsSearchUrl,
  parseLatLng,
  todayKey,
  waLink,
  type GeoPin,
} from "@/lib/service-visit";

type FieldJob = {
  _id: string;
  jobNo?: string;
  status?: string;
  house?: string;
  location?: string;
  address?: string;
  mobile?: string;
  phone?: string;
  whatsapp?: string;
  lift?: string;
  issueDescription?: string;
  scheduledDate?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  durationMinutes?: number;
  lat?: number;
  lng?: number;
  technicianId?: string | { _id?: string; name?: string };
  customerId?: string | { _id?: string; name?: string };
};

type Filter = "all" | "planned" | "onsite" | "done";
type HouseVisit = {
  key: string;
  jobs: FieldJob[];
  focus: FieldJob;
  state: Exclude<Filter, "all">;
};

function customerInitial(job: FieldJob) {
  return String(job.house || job.jobNo || "C").trim().charAt(0).toUpperCase();
}

function niceDate(bn: boolean) {
  return new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date());
}

function jobPin(job: FieldJob): GeoPin | null {
  return parseLatLng(job.lat, job.lng);
}

function statusKey(status?: string) {
  return String(status || "").toLowerCase().replace(/-/g, "_");
}

function isOnSite(job: FieldJob) {
  const key = statusKey(job.status);
  return Boolean(job.checkedInAt && !job.checkedOutAt) || key === "in_progress" || key === "onsite" || key === "on_site";
}

function isDone(job: FieldJob) {
  const key = statusKey(job.status);
  return Boolean(job.checkedOutAt) || key === "completed" || key === "done" || key === "closed" || key === "delivered";
}

function statusLabel(job: FieldJob, bn: boolean) {
  if (isOnSite(job)) return bn ? "অন সাইট" : "On site";
  if (isDone(job)) return bn ? "সম্পন্ন" : "Done";
  const key = statusKey(job.status);
  if (key === "assigned") return bn ? "অ্যাসাইনড" : "Assigned";
  if (key === "pending") return bn ? "পেন্ডিং" : "Pending";
  if (key === "cancelled" || key === "canceled") return bn ? "বাতিল" : "Cancelled";
  if (key === "skipped") return bn ? "স্কিপ" : "Skipped";
  return bn ? "পরিকল্পিত" : "Planned";
}

function statusChip(job: FieldJob) {
  if (isOnSite(job)) return "warn";
  if (isDone(job)) return "ok";
  return "";
}

function remember(id: string) {
  writeStoredJob(id);
}

function customerRef(job: FieldJob) {
  const c = job.customerId;
  if (c && typeof c === "object" && c._id) return String(c._id);
  if (typeof c === "string" && c) return c;
  return "";
}

function houseKey(job: FieldJob) {
  const id = customerRef(job);
  if (id) return `c:${id}`;
  const house = String(job.house || "").trim().toLowerCase();
  const loc = String(job.location || job.address || "").trim().toLowerCase();
  if (house) return `h:${house}|${loc}`;
  return `j:${job._id}`;
}

function pickFocus(list: FieldJob[]) {
  return list.find(isOnSite) || list.find((job) => !isDone(job)) || list[0];
}

function houseState(list: FieldJob[]): HouseVisit["state"] {
  if (list.some(isOnSite)) return "onsite";
  if (list.length && list.every(isDone)) return "done";
  return "planned";
}

function uniqueJobs(list: FieldJob[]) {
  const seen = new Set<string>();
  const next: FieldJob[] = [];
  for (const job of list) {
    if (!job?._id || seen.has(job._id)) continue;
    seen.add(job._id);
    next.push(job);
  }
  return next;
}

function readGps(): Promise<GeoPin | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  });
}

function openExternal(url: string) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function FieldTodayPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const bn = locale === "bn";
  const [activeId, setActiveId] = useState("");
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const date = todayKey();
    const me = await fetchJson<{ jobs?: FieldJob[]; error?: string }>(`/api/me/today?date=${date}`);
    if (me.ok && me.data) {
      setMine(true);
      setJobs(uniqueJobs((me.data.jobs || []) as FieldJob[]));
      setLoading(false);
      return;
    }
    const board = await fetchJson<{
      boards?: { jobs?: FieldJob[] }[];
      unassigned?: FieldJob[];
      summary?: { housesToday?: number; onSite?: number; completed?: number };
    }>(`/api/services/dispatch?date=${date}`);
    if (!board.ok) {
      setError(t("common.error"));
      setLoading(false);
      return;
    }
    setMine(false);
    const list = uniqueJobs([
      ...(board.data?.boards || []).flatMap((row) => row.jobs || []),
      ...(board.data?.unassigned || []),
    ]);
    list.sort((a, b) => Number(isOnSite(b)) - Number(isOnSite(a)));
    setJobs(list);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      setActiveId(readStoredJob());
    } catch {
      setActiveId("");
    }
  }, [jobs]);

  function openCustomer(id: string) {
    remember(id);
    setActiveId(id);
    router.push(`/m/${id}`);
  }

  const houses = useMemo<HouseVisit[]>(() => {
    const map = new Map<string, FieldJob[]>();
    for (const job of jobs) {
      const key = houseKey(job);
      const list = map.get(key) || [];
      list.push(job);
      map.set(key, list);
    }
    const rows: HouseVisit[] = [];
    for (const [key, list] of map) {
      const ranked = [...list].sort((a, b) => Number(isOnSite(b)) - Number(isOnSite(a)) || Number(isDone(a)) - Number(isDone(b)));
      rows.push({ key, jobs: ranked, focus: pickFocus(ranked), state: houseState(ranked) });
    }
    rows.sort((a, b) => {
      const rank = { onsite: 0, planned: 1, done: 2 };
      const delta = rank[a.state] - rank[b.state];
      if (delta) return delta;
      return String(a.focus.house || a.focus.jobNo || "").localeCompare(String(b.focus.house || b.focus.jobNo || ""));
    });
    return rows;
  }, [jobs]);

  const counts = useMemo(() => {
    let planned = 0;
    let onSite = 0;
    let done = 0;
    for (const row of houses) {
      if (row.state === "onsite") onSite += 1;
      else if (row.state === "done") done += 1;
      else planned += 1;
    }
    return { planned, onSite, done };
  }, [houses]);

  const visible = useMemo(() => {
    if (filter === "all") return houses;
    return houses.filter((row) => row.state === filter);
  }, [filter, houses]);

  async function copyText(value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice(bn ? "কপি হয়েছে" : "Copied");
    } catch {
      setNotice(bn ? "কপি হয়নি" : "Could not copy");
    }
  }

  function goMap(job: FieldJob) {
    const pin = jobPin(job);
    const url = pin
      ? `https://www.google.com/maps?q=${pin.lat},${pin.lng}`
      : mapsSearchUrl(job.address, job.location, pin);
    if (!url) {
      setNotice(bn ? "lat/long নেই" : "No lat/long");
      return;
    }
    openExternal(url);
  }

  async function clock(job: FieldJob, action: "check_in" | "check_out") {
    setBusyId(job._id);
    setError("");
    const live = await readGps();
    const res = await fetchJson(`/api/services/${job._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, lat: live?.lat, lng: live?.lng }),
    });
    setBusyId("");
    if (!res.ok) {
      setError(
        res.error === "need_technician"
          ? bn
            ? "আগে টেকনিশিয়ান অ্যাসাইন করুন"
            : "Assign a technician first"
          : res.error || t("common.error"),
      );
      return;
    }
    await load();
  }

  return (
    <div className="fld-day gp-desk fld-todaypage">
      <section className="fld-hero">
        <div>
          <p className="fld-hero-kicker">{niceDate(bn)}</p>
          <h1>{t("field.todayTitle")}</h1>
          <p className="fld-lead">{mine ? t("field.todayMine") : t("field.todayOffice")}</p>
        </div>
        <div className="fld-hero-stats">
          {(
            [
              { id: "planned" as const, label: bn ? "পরিকল্পিত" : "planned", value: counts.planned },
              { id: "onsite" as const, label: bn ? "অন সাইট" : "on site", value: counts.onSite },
              { id: "done" as const, label: bn ? "সম্পন্ন" : "done", value: counts.done },
            ] as const
          ).map((stat) => (
            <button
              key={stat.id}
              type="button"
              className={filter === stat.id ? "on" : ""}
              onClick={() => setFilter(filter === stat.id ? "all" : stat.id)}
            >
              {stat.label} <em>({stat.value})</em>
            </button>
          ))}
        </div>
      </section>
      {error ? <AlertBanner tone="error" message={error} /> : null}
      {notice ? <AlertBanner tone="success" message={notice} onClose={() => setNotice("")} /> : null}

      {!loading ? (
        <div className="fld-boardhead">
          <p>
            {visible.length}{" "}
            {filter === "onsite"
              ? bn
                ? "অন সাইট"
                : "on site"
              : filter === "done"
                ? bn
                  ? "সম্পন্ন"
                  : "completed"
                : filter === "planned"
                  ? bn
                    ? "পরিকল্পিত"
                    : "planned"
                  : bn
                    ? "কাস্টমার ভিজিট"
                    : bn
                      ? "কাস্টমার"
                      : "customers"}
          </p>
          {filter !== "all" ? (
            <button type="button" onClick={() => setFilter("all")}>
              {bn ? "সব দেখুন" : "Show all"}
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : !visible.length ? (
        <EmptyState message={t("field.noHouses")} />
      ) : (
        <div className="fld-todayboard">
          <ul className="fld-list">
            {visible.map((row) => {
              const job = row.focus;
              const extra = row.jobs.filter((item) => item._id !== job._id);
              const pin = jobPin(job);
              const phone = job.mobile || job.phone || "";
              const wa = waLink(job.whatsapp || phone);
              const coords = pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "";
              const onSite = isOnSite(job);
              const done = isDone(job);
              const place = [job.location, coords].filter(Boolean).join(" · ");
              const selected = row.jobs.some((item) => item._id === activeId);
              return (
                <li
                  key={row.key}
                  className={`fld-visit ${onSite ? "is-onsite" : done ? "is-done" : ""} ${selected ? "is-selected" : ""}`}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a, button")) return;
                    openCustomer(job._id);
                  }}
                >
                <div className="fld-visit-top">
                  <div className="fld-avatar">{customerInitial(job)}</div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/m/${job._id}`} onClick={() => { remember(job._id); setActiveId(job._id); }}>
                      {job.house || job.jobNo || (bn ? "কাস্টমার" : "Customer")}
                    </Link>
                      <p className="fld-sub">
                        {row.jobs.length > 1 ? `${row.jobs.length} ${bn ? "ভিজিট" : "visits"} · ` : ""}
                        {row.jobs.map((item) => item.jobNo).filter(Boolean).join(" · ")}
                        {job.lift ? ` · ${job.lift}` : ` · ${bn ? "লিফট" : "Lift"}`}
                      {job.checkedInAt
                        ? ` · ${bn ? "ইন" : "In"} ${formatClock(job.checkedInAt, bn ? "bn" : "en")}`
                        : job.scheduledDate
                          ? ` · ${formatClock(job.scheduledDate, bn ? "bn" : "en")}`
                          : ""}
                    </p>
                  </div>
                    <span className={`fld-chip ${statusChip(job)}`}>{statusLabel(job, bn)}</span>
                </div>

                {job.address || job.location || coords ? (
                  <button type="button" className="fld-site" onClick={() => goMap(job)}>
                    <MapPin className="h-4 w-4" />
                    <span>
                      <p>{job.address || job.location || coords}</p>
                      {place ? <small>{place}</small> : null}
                    </span>
                  </button>
                ) : (
                  <p className="fld-gps mute">{bn ? "lat/long নেই" : "No lat/long"}</p>
                )}

                {job.issueDescription ? <p className="fld-note">{job.issueDescription}</p> : null}
                {extra.length ? (
                  <p className="fld-note">
                    {extra.map((item) => `${item.jobNo || "—"} · ${statusLabel(item, bn)}`).join(" · ")}
                  </p>
                ) : null}

                <div className="fld-actions">
                  {!done ? (
                    <button
                      type="button"
                      className="fld-cta"
                      disabled={busyId === job._id}
                      onClick={() => void clock(job, onSite ? "check_out" : "check_in")}
                    >
                      <Clock className="h-4 w-4" />
                      {onSite ? (bn ? "চেক-আউট" : "Check out") : (bn ? "চেক-ইন" : "Check in")}
                    </button>
                  ) : null}
                  <Link className={done ? "fld-cta" : "fld-act"} href={`/m/${job._id}/clock`} onClick={() => { remember(job._id); setActiveId(job._id); }}>
                    <Clock className="h-4 w-4" />
                    {t("field.clock")}
                  </Link>
                  {phone ? (
                    <a className="fld-act" href={`tel:${phone}`} title={phone}>
                      <Phone className="h-3.5 w-3.5" />
                      {bn ? "কল" : "Call"}
                    </a>
                  ) : null}
                  {wa ? (
                    <a className="fld-act" href={wa} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  ) : null}
                  {coords ? (
                    <button type="button" className="fld-act" onClick={() => goMap(job)}>
                      <MapPin className="h-3.5 w-3.5" />
                      {coords}
                    </button>
                  ) : null}
                  <div className="fld-iconrow">
                    {job.address ? (
                      <button type="button" className="fld-ico" title={bn ? "কপি" : "Copy"} onClick={() => void copyText(job.address || "")}>
                        <Copy className="h-4 w-4" />
                      </button>
                    ) : null}
                    <Link className="fld-ico" href={`/m/${job._id}`} onClick={() => { remember(job._id); setActiveId(job._id); }} title={bn ? "জব খুলুন" : "Open job"}>
                      <Radio className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
          </ul>
        </div>
      )}
    </div>
  );
}
