"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Crosshair, Hash, LogIn, LogOut, RotateCcw, UserRound } from "lucide-react";
import { AlertBanner } from "@/components/ui";
import { FieldJobNav } from "@/components/service/FieldJobNav";
import { fetchJson } from "@/lib/fetch-json";
import { jobParam, writeStoredJob } from "@/lib/field-job";
import {
  formatClock,
  formatDuration,
  labourHoursFromMinutes,
  minutesBetween,
} from "@/lib/service-visit";

type Ref = { _id?: string; name?: string; mobile?: string };
type Job = {
  _id: string;
  jobNo?: string;
  status?: string;
  house?: string;
  siteName?: string;
  location?: string;
  address?: string;
  lift?: string;
  issueDescription?: string;
  technicianId?: string | Ref;
  customerId?: string | Ref;
  checkedInAt?: string;
  checkedOutAt?: string;
  durationMinutes?: number;
  labourHours?: number;
  checkInLat?: number;
  checkInLng?: number;
  lat?: number;
  lng?: number;
};

function nameOf(value?: string | Ref) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || "";
}

function mobileOf(value?: string | Ref) {
  if (!value || typeof value === "string") return "";
  return value.mobile || "";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "C";
}

function formatHms(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function gpsText(job: Job) {
  if (job.checkInLat != null && job.checkInLng != null) {
    return `${Number(job.checkInLat).toFixed(5)}, ${Number(job.checkInLng).toFixed(5)}`;
  }
  if (job.lat != null && job.lng != null) {
    return `${Number(job.lat).toFixed(5)}, ${Number(job.lng).toFixed(5)}`;
  }
  return "";
}

export default function FieldClockPage() {
  const params = useParams<{ id: string }>();
  const id = jobParam(params.id);
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(0);

  async function load() {
    const res = await fetchJson<{ data?: Job }>(`/api/services/${id}`);
    if (!res.ok || !res.data?.data) {
      setError(t("common.error"));
      return;
    }
    setJob(res.data.data);
    setError("");
  }

  useEffect(() => {
    if (!id) return;
    writeStoredJob(id);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSite = Boolean(job?.checkedInAt) && !job?.checkedOutAt;

  useEffect(() => {
    setNow(Date.now());
    if (!onSite) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [onSite, job?.checkedInAt]);

  async function send(action: "check_in" | "check_out" | "reset_clock") {
    if (!job?._id) return;
    setPending(true);
    setError("");
    const body: Record<string, unknown> = { action };
    const put = async () => {
      const res = await fetchJson<{ data?: Job; error?: string }>(`/api/services/${job._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(
          res.error === "need_technician"
            ? bn
              ? "আগে টেকনিশিয়ান অ্যাসাইন করুন"
              : "Assign a technician first"
            : res.error || t("common.error"),
        );
        setPending(false);
        return;
      }
      await load();
      setPending(false);
    };
    if (action !== "reset_clock" && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          body.lat = pos.coords.latitude;
          body.lng = pos.coords.longitude;
          body.accuracy = pos.coords.accuracy;
          void put();
        },
        () => {
          void put();
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
      return;
    }
    await put();
  }

  if (!id) return <AlertBanner tone="error" message={t("common.error")} />;
  if (error && !job) return <AlertBanner tone="error" message={error} />;
  if (!job) return <p className="text-muted">{t("common.loading")}</p>;

  const customer = job.house || job.siteName || nameOf(job.customerId) || (bn ? "কাস্টমার" : "Customer");
  const tech = nameOf(job.technicianId) || (bn ? "অ্যাসাইন নেই" : "Unassigned");
  const techMobile = mobileOf(job.technicianId);
  const canCheckIn = Boolean(job.technicianId);
  const phase = job.checkedOutAt ? "done" : onSite ? "live" : "wait";
  const startAt = job.checkedInAt ? new Date(job.checkedInAt).getTime() : 0;
  const endAt = job.checkedOutAt ? new Date(job.checkedOutAt).getTime() : now || startAt;
  const elapsedMs = startAt ? Math.max(0, endAt - startAt) : 0;
  const liveMinutes = job.checkedOutAt
    ? Number(job.durationMinutes || minutesBetween(job.checkedInAt, job.checkedOutAt))
    : job.checkedInAt
      ? minutesBetween(job.checkedInAt, new Date(endAt))
      : 0;
  const hours = Number(job.labourHours || labourHoursFromMinutes(liveMinutes));
  const pin = gpsText(job);
  const phaseLabel =
    phase === "live" ? (bn ? "অন সাইট · লাইভ" : "On site · live") : phase === "done" ? (bn ? "ভিজিট সম্পন্ন" : "Visit complete") : bn ? "চেক-ইন হয়নি" : "Not checked in";

  return (
    <div className="gp-desk fld-day fld-sitepage fld-clockpage">
      {error ? <AlertBanner tone="error" message={error} /> : null}

      <section className="fld-hero">
        <div className="fld-ident">
          <span className="fld-ident-avatar">{initials(customer)}</span>
          <div>
            <p className="fld-hero-kicker">{job.jobNo || t("field.clock")}</p>
            <h1>{customer}</h1>
            <p className="fld-lead">{job.lift || job.issueDescription || (bn ? "সার্ভিস ভিজিট" : "Service visit")}</p>
          </div>
        </div>
        <div className="fld-hero-stats">
          <b>{phaseLabel}</b>
          <b>{tech}</b>
          <b>{String(job.status || "—").replace(/_/g, " ")}</b>
        </div>
      </section>

      <section className="fld-panel">
        <div className="fld-sitebody">
          <div className="fld-sitecol">
            <section className="fld-clockface" data-state={phase}>
              <p>{phaseLabel}</p>
              <time dateTime={job.checkedInAt || undefined}>{job.checkedInAt ? formatHms(elapsedMs) : "00:00:00"}</time>
              <small>
                {!canCheckIn
                  ? bn
                    ? "আগে টেকনিশিয়ান অ্যাসাইন করুন"
                    : "Assign a technician first"
                  : job.checkedInAt
                    ? `${formatDuration(liveMinutes, bn ? "bn" : "en")} · ${hours} ${bn ? "শ্রম ঘণ্টা" : "labour hrs"}`
                    : bn
                      ? "চেক-ইন করলে সময় গণনা শুরু হবে"
                      : "Time starts when you check in"}
              </small>
            </section>

            <div className="fld-toolbar">
              <button
                type="button"
                className={phase === "wait" ? "fld-cta" : "fld-act"}
                disabled={pending || !canCheckIn || onSite}
                onClick={() => void send("check_in")}
              >
                <LogIn className="h-4 w-4" />
                {bn ? "চেক-ইন" : "Check in"}
              </button>
              <button
                type="button"
                className={phase === "live" ? "fld-cta" : "fld-act"}
                disabled={pending || !onSite}
                onClick={() => void send("check_out")}
              >
                <LogOut className="h-4 w-4" />
                {bn ? "চেক-আউট" : "Check out"}
              </button>
              <button
                type="button"
                className="fld-act"
                disabled={pending || !job.checkedInAt}
                onClick={() => void send("reset_clock")}
              >
                <RotateCcw className="h-4 w-4" />
                {bn ? "ক্লক মুছুন" : "Clear clock"}
              </button>
            </div>

            <div className="fld-facts">
              <article className="fld-fact">
                <LogIn className="h-4 w-4" />
                <span>{bn ? "চেক-ইন" : "Check-in"}</span>
                <strong>{formatClock(job.checkedInAt, bn ? "bn" : "en")}</strong>
                <em>{job.checkedInAt ? (bn ? "সাইটে প্রবেশ" : "Arrived on site") : bn ? "এখনো হয়নি" : "Not yet"}</em>
              </article>
              <article className="fld-fact">
                <LogOut className="h-4 w-4" />
                <span>{bn ? "চেক-আউট" : "Check-out"}</span>
                <strong>{formatClock(job.checkedOutAt, bn ? "bn" : "en")}</strong>
                <em>{job.checkedOutAt ? (bn ? "ভিজিট শেষ" : "Visit closed") : onSite ? (bn ? "চলছে" : "In progress") : "—"}</em>
              </article>
              <article className="fld-fact">
                <Clock className="h-4 w-4" />
                <span>{bn ? "সময়" : "Duration"}</span>
                <strong>{job.checkedInAt ? formatDuration(liveMinutes, bn ? "bn" : "en") : "—"}</strong>
                <em>{job.checkedInAt ? `${hours} ${bn ? "ঘণ্টা শ্রম" : "hrs labour"}` : bn ? "অপেক্ষমাণ" : "Waiting"}</em>
              </article>
              <article className="fld-fact">
                <Crosshair className="h-4 w-4" />
                <span>Lat / Long</span>
                <strong>{pin ? pin.split(",")[0] : "—"}</strong>
                <em>{pin ? pin.split(",")[1]?.trim() : (bn ? "চেক-ইনে সেভ" : "Saved on check-in")}</em>
              </article>
            </div>
          </div>

          <aside className="fld-mapcard">
            <div className="fld-maphead">
              <Clock className="h-4 w-4" />
              <div>
                <strong>{bn ? "ভিজিট টাইমলাইন" : "Visit timeline"}</strong>
                <small>{job.jobNo || id} · {tech}</small>
              </div>
            </div>
            <ol className="fld-timeline">
              <li data-on={job.checkedInAt ? "1" : "0"}>
                <i />
                <div>
                  <span>{bn ? "চেক-ইন" : "Check-in"}</span>
                  <strong>{formatClock(job.checkedInAt, bn ? "bn" : "en")}</strong>
                  <em>{pin || (bn ? "চেক-ইনে lat/long সেভ" : "lat/long on check-in")}</em>
                </div>
              </li>
              <li data-on={onSite ? "1" : "0"} data-live={onSite ? "1" : "0"}>
                <i />
                <div>
                  <span>{bn ? "অন সাইট" : "On site"}</span>
                  <strong>{onSite ? formatHms(elapsedMs) : job.checkedOutAt ? formatDuration(liveMinutes, bn ? "bn" : "en") : "—"}</strong>
                  <em>{onSite ? (bn ? "লাইভ গণনা" : "Live elapsed") : job.checkedOutAt ? (bn ? "সময় লক" : "Time locked") : bn ? "চেক-ইনের পর" : "After check-in"}</em>
                </div>
              </li>
              <li data-on={job.checkedOutAt ? "1" : "0"}>
                <i />
                <div>
                  <span>{bn ? "চেক-আউট" : "Check-out"}</span>
                  <strong>{formatClock(job.checkedOutAt, bn ? "bn" : "en")}</strong>
                  <em>{job.checkedOutAt ? `${hours} ${bn ? "শ্রম ঘণ্টা" : "labour hrs"}` : bn ? "এখনো খোলা" : "Still open"}</em>
                </div>
              </li>
            </ol>
            <div className="fld-clockmeta">
              <article>
                <Hash className="h-4 w-4" />
                <span>{bn ? "জব" : "Job"}</span>
                <strong>{job.jobNo || "—"}</strong>
                <em>{String(job.status || "—").replace(/_/g, " ")}</em>
              </article>
              <article>
                <UserRound className="h-4 w-4" />
                <span>{bn ? "টেকনিশিয়ান" : "Technician"}</span>
                <strong>{tech}</strong>
                <em>{techMobile || "—"}</em>
              </article>
            </div>
          </aside>
        </div>
        <FieldJobNav id={id} />
      </section>
    </div>
  );
}
