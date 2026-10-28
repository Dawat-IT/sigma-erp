"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";

function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

type Unit = {
  _id: string;
  label?: string;
  machineType?: string;
  siteName?: string;
  siteLocation?: string;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  queued?: boolean;
  amc?: { cycleDays?: number; visitsUsed?: number; visitsIncluded?: number } | null;
};

type Tech = {
  _id: string;
  name?: string;
  mobile?: string;
  speciality?: string;
  used?: number;
  cap?: number;
  remaining?: number;
};

type Plan = {
  date?: string;
  units?: Unit[];
  roster?: Tech[];
  ready?: number;
  queued?: number;
  slots?: number;
  techs?: number;
  cap?: number;
  existing?: number;
};

type Result = {
  created?: number;
  skipped?: number;
  unassigned?: number;
  overload?: number;
  date?: string;
  jobs?: { _id: string; jobNo: string; technicianName: string; machineLabel: string }[];
};

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AD";
}

export default function AmcDispatchPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [date, setDate] = useState(addDays(1));
  const [plan, setPlan] = useState<Plan>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(async (nextDate = date) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/services/amc/generate?date=${nextDate}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      setPlan(json || {});
      setError("");
    } catch {
      setPlan({});
      setError(bn ? "প্রিভিউ লোড হয়নি।" : "Could not load the dispatch preview.");
    } finally {
      setLoading(false);
    }
  }, [bn, date]);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/services/amc/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      const code = String(json.error || "failed");
      setError(
        code === "invalid_date"
          ? bn ? "তারিখ ঠিক নয়।" : "Invalid date."
          : code === "forbidden" || code === "unauthorized"
            ? bn ? "ডিসপ্যাচ করার অনুমতি নেই।" : "You cannot run auto dispatch."
            : bn ? "জব তৈরি হয়নি।" : "Could not generate jobs.",
      );
      return;
    }
    setResult(json);
    await load(date);
  }

  const units = plan.units || [];
  const roster = plan.roster || [];
  const ready = plan.ready || 0;
  const jobs = result?.jobs || [];

  const quick = [
    { id: ymd(), en: "Today", bn: "আজ" },
    { id: addDays(1), en: "Tomorrow", bn: "কাল" },
    { id: addDays(2), en: "+2 days", bn: "+২ দিন" },
    { id: addDays(7), en: "+7 days", bn: "+৭ দিন" },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "এএমসি অটো ডিসপ্যাচ" : "AMC auto dispatch"}
        subtitle={bn
          ? "যে তারিখে ডিউ আছে সেই ইউনিটের শিডিউল জব ও রাউন্ড-রবিন টেকনিশিয়ান।"
          : "Create scheduled jobs for units due on this date and round-robin technicians."}
        stats={[
          { value: units.length, label: bn ? "ডিউ ইউনিট" : "due units" },
          { value: ready, label: bn ? "তৈরি হবে" : "to create" },
          { value: plan.queued || 0, label: bn ? "আগে থেকে" : "already set" },
          { value: plan.slots || 0, label: bn ? "স্লট" : "tech slots" },
        ]}
        actions={
          <>
            <input
              type="date"
              className="gp-input desk-hero-search"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setResult(null);
              }}
            />
            <button
              type="submit"
              form="amc-dispatch-form"
              disabled={pending || loading || !ready}
              className="gp-btn gp-btn-primary"
            >
              {pending ? (bn ? "তৈরি হচ্ছে..." : "Generating...") : bn ? "জব তৈরি" : "Generate jobs"}
            </button>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {quick.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={date === pill.id ? "on" : ""}
              onClick={() => {
                setDate(pill.id);
                setResult(null);
              }}
            >
              {bn ? pill.bn : pill.en}
            </button>
          ))}
        </div>
        <Link href="/services/amc" className="gp-btn gp-btn-ghost">{bn ? "চুক্তি" : "Contracts"}</Link>
        <Link href={`/services/dispatch`} className="gp-btn gp-btn-ghost">{bn ? "আজকের ভিজিট" : "Today's visits"}</Link>
        <Link href="/services/due" className="gp-btn gp-btn-ghost">{bn ? "ডিউ" : "Due"}</Link>
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <form id="amc-dispatch-form" onSubmit={onSubmit} className="quote-board">
        {result ? (
          <div className="dash-stat-grid svc-home-kpis">
            <article className="dash-stat dash-stat-info">
              <span>{bn ? "তৈরি" : "Created"}</span>
              <b>{result.created || 0}</b>
              <em>{result.date}</em>
            </article>
            <article className="dash-stat">
              <span>{bn ? "স্কিপ" : "Skipped"}</span>
              <b>{result.skipped || 0}</b>
              <em>{bn ? "আগে থেকে জব আছে" : "Already had a job"}</em>
            </article>
            <article className="dash-stat dash-stat-warn">
              <span>{bn ? "আনঅ্যাসাইনড" : "Unassigned"}</span>
              <b>{result.unassigned || 0}</b>
              <em>{bn ? "স্লট শেষ" : "No free slot"}</em>
            </article>
            <article className="dash-stat dash-stat-danger">
              <span>{bn ? "ওভারলোড" : "Overload"}</span>
              <b>{result.overload || 0}</b>
              <em>{bn ? `ক্যাপ ${plan.cap || 4}/টেক` : `Cap ${plan.cap || 4}/tech`}</em>
            </article>
          </div>
        ) : null}

        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}

        <div className="eq-add-grid">
          <section className="svc-home-panel">
            <div className="svc-home-head">
              <b>{bn ? "ডিউ ইউনিট" : "Units due this date"}</b>
              <span className="fu-meta">{bn ? `${ready} তৈরি হবে` : `${ready} will be created`}</span>
            </div>
            {!loading && units.length === 0 ? (
              <EmptyState
                title={bn ? "এই তারিখে ডিউ নেই" : "Nothing due on this date"}
                message={bn ? "অন্য তারিখ বাছুন, অথবা ডিউ বোর্ড দেখুন।" : "Pick another date, or open the due board."}
              />
            ) : null}
            <div className="fu-list svc-home-list">
              {units.map((row) => (
                <article key={row._id} className={`fu-card ${row.queued ? "is-info" : "is-warn"}`}>
                  <div className="fu-card-top">
                    <span className="fu-avatar">{initials(row.customerName || row.label || "U")}</span>
                    <div className="min-w-0 flex-1">
                      <strong>
                        <Link href={`/services/machines/${row._id}`}>{row.label || "—"}</Link>
                      </strong>
                      <p>
                        {row.customerId ? (
                          <Link href={`/contacts/${row.customerId}/statement`}>{row.customerName || "—"}</Link>
                        ) : (
                          row.customerName || "—"
                        )}
                        {row.siteName || row.siteLocation ? ` · ${[row.siteName, row.siteLocation].filter(Boolean).join(" · ")}` : ""}
                      </p>
                    </div>
                    <span className={`fu-chip ${row.queued ? "is-info" : "is-warn"}`}>
                      {row.queued ? (bn ? "জব আছে" : "Queued") : bn ? "নতুন জব" : "New job"}
                    </span>
                  </div>
                  <div className="fu-card-foot eq-foot">
                    <p className="fu-meta">
                      {row.machineType || "—"}
                      {row.customerMobile ? ` · ${row.customerMobile}` : ""}
                      {row.amc
                        ? ` · AMC ${row.amc.visitsUsed || 0}/${row.amc.visitsIncluded || 0} · ${row.amc.cycleDays || 90}d`
                        : bn ? " · এএমসি নেই" : " · no AMC"}
                    </p>
                    <Link className="fld-act" href={`/services/new${row.customerId ? `?customerId=${row.customerId}` : ""}`}>
                      {bn ? "ম্যানুয়াল" : "Manual"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="svc-home-panel">
            <div className="svc-home-head">
              <b>{bn ? "টেকনিশিয়ান স্লট" : "Technician slots"}</b>
              <span className="fu-meta">{bn ? `${plan.slots || 0} খালি · ক্যাপ ${plan.cap || 4}` : `${plan.slots || 0} free · cap ${plan.cap || 4}`}</span>
            </div>
            {!loading && roster.length === 0 ? (
              <p className="svc-home-none">{bn ? "সক্রিয় টেকনিশিয়ান নেই।" : "No active technicians."}</p>
            ) : null}
            <div className="fu-list svc-home-list">
              {roster.map((tech) => {
                const pct = tech.cap ? Math.round(((tech.used || 0) / tech.cap) * 100) : 0;
                return (
                  <article key={tech._id} className={`fu-card ${(tech.remaining || 0) === 0 ? "is-warn" : "is-ok"}`}>
                    <div className="fu-card-top">
                      <span className="fu-avatar">{initials(tech.name || "T")}</span>
                      <div className="min-w-0 flex-1">
                        <strong>
                          <Link href={`/services/technicians/${tech._id}`}>{tech.name || "—"}</Link>
                        </strong>
                        <p>{[tech.speciality, tech.mobile].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                      <span className={`fu-chip ${(tech.remaining || 0) === 0 ? "is-warn" : "is-ok"}`}>
                        {tech.used || 0}/{tech.cap || 4}
                      </span>
                    </div>
                    <div className="inst-progress">
                      <span className="inst-bar" style={{ ["--pct" as string]: `${Math.min(100, pct)}%` }}><i /></span>
                      <em>{bn ? `${tech.remaining || 0} খালি` : `${tech.remaining || 0} free`}</em>
                    </div>
                  </article>
                );
              })}
            </div>

            {jobs.length ? (
              <>
                <div className="svc-home-head">
                  <b>{bn ? "এইমাত্র তৈরি" : "Just created"}</b>
                  <Link href="/services/dispatch">{bn ? "ভিজিট বোর্ড" : "Visit board"}</Link>
                </div>
                <div className="fu-list svc-home-list">
                  {jobs.map((job) => (
                    <article key={job._id} className="fu-card is-ok">
                      <div className="fu-card-top">
                        <span className="fu-avatar">{initials(job.jobNo || "J")}</span>
                        <div className="min-w-0 flex-1">
                          <strong>
                            <Link href={`/services/${job._id}`}>{job.jobNo}</Link>
                          </strong>
                          <p>{job.machineLabel}{job.technicianName ? ` · ${job.technicianName}` : bn ? " · আনঅ্যাসাইনড" : " · Unassigned"}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </div>
      </form>
    </div>
  );
}
