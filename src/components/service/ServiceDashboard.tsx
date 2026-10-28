"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { AlertTriangle, CalendarClock, MapPin, Plus, Radio, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { formatDateBD } from "@/lib/utils";

type DeskJob = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  status?: string;
  priority?: string;
  issueDescription?: string;
  siteName?: string;
  siteLocation?: string;
  reportedAt?: string | null;
  scheduledDate?: string | null;
  checkedInAt?: string | null;
  completedAt?: string | null;
  slaOverdue?: boolean;
  slaHours?: number;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  technicianName?: string;
  machineLabel?: string;
};

type DueMachine = {
  _id: string;
  label?: string;
  siteName?: string;
  siteLocation?: string;
  nextServiceDue?: string | null;
  daysOverdue?: number;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
};

type Desk = {
  openJobs?: number;
  dueUnits?: number;
  upcomingUnits?: number;
  complaints?: number;
  slaOverdue?: number;
  onSite?: number;
  completedToday?: number;
  amcActive?: number;
  technicians?: number;
  unassigned?: number;
  emergencies?: number;
  inProgress?: number;
  empty?: boolean;
  byKind?: Record<string, number>;
  openList?: DeskJob[];
  dueList?: DueMachine[];
  todayList?: DeskJob[];
  complaintList?: DeskJob[];
  completedList?: DeskJob[];
};

const KIND: Record<string, [string, string]> = {
  complaint: ["Complaint", "কমপ্লেইন"],
  scheduled: ["Scheduled", "শিডিউল"],
  emergency: ["Emergency", "ইমার্জেন্সি"],
  amc: ["AMC", "এএমসি"],
  installation: ["Install", "ইনস্টল"],
  complimentary: ["Complimentary", "কমপ্লিমেন্টারি"],
};

const STATUS: Record<string, [string, string]> = {
  pending: ["Pending", "পেন্ডিং"],
  reported: ["Reported", "রিপোর্টেড"],
  assigned: ["Assigned", "অ্যাসাইনড"],
  in_progress: ["In progress", "চলছে"],
  waiting_parts: ["Parts", "পার্টস"],
  on_site: ["On site", "অন সাইট"],
  completed: ["Done", "সম্পন্ন"],
  closed: ["Closed", "বন্ধ"],
  resolved: ["Resolved", "সমাধান"],
  cancelled: ["Cancelled", "বাতিল"],
};

function kindLabel(kind: string | undefined, bn: boolean) {
  const row = KIND[String(kind || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : kind || "—";
}

function statusLabel(status: string | undefined, bn: boolean) {
  const row = STATUS[String(status || "").toLowerCase()];
  return row ? row[bn ? 1 : 0] : status || "—";
}

function chipTone(job: DeskJob) {
  if (job.slaOverdue || job.jobKind === "emergency" || job.priority === "urgent") return "is-danger";
  if (job.priority === "high" || job.jobKind === "complaint") return "is-warn";
  if (job.status === "completed" || job.status === "closed" || job.status === "resolved") return "is-ok";
  return "is-info";
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "S";
}

function safeDate(iso: string | null | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateBD(iso, locale);
}

function JobRow({ job, bn, locale, extra }: { job: DeskJob; bn: boolean; locale: string; extra?: string }) {
  const title = job.customerName || job.siteName || job.jobNo || "—";
  const site = [job.siteName, job.siteLocation].filter(Boolean).join(" · ");
  return (
    <article className={`fu-card ${chipTone(job)}`}>
      <div className="fu-card-top">
        <span className="fu-avatar">{initials(title)}</span>
        <div className="min-w-0 flex-1">
          <strong>
            <Link href={`/services/${job._id}`}>{job.jobNo || title}</Link>
          </strong>
          <p>
            {job.customerId ? (
              <Link href={`/contacts/${job.customerId}/statement`}>{job.customerName || "—"}</Link>
            ) : (
              job.customerName || "—"
            )}
            {site ? ` · ${site}` : ""}
          </p>
        </div>
        <span className={`fu-chip ${chipTone(job)}`}>{statusLabel(job.status, bn)}</span>
      </div>
      {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
      <div className="fu-card-foot svc-home-foot">
        <p className="fu-meta">
          {kindLabel(job.jobKind, bn)}
          {job.technicianName ? ` · ${job.technicianName}` : bn ? " · আনঅ্যাসাইনড" : " · Unassigned"}
          {extra ? ` · ${extra}` : ` · ${safeDate(job.scheduledDate || job.reportedAt || undefined, locale)}`}
          {job.machineLabel ? ` · ${job.machineLabel}` : ""}
        </p>
        <Link className="fld-act" href={`/services/${job._id}`}>
          {bn ? "খুলুন" : "Open"}
        </Link>
      </div>
    </article>
  );
}

export function ServiceDashboard() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [desk, setDesk] = useState<Desk>({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/services?summary=desk");
      const json = (await res.json()) as Desk & { error?: string };
      if (!res.ok) throw new Error(json.error || "load");
      setDesk(json || {});
      setError("");
    } catch {
      setDesk({});
      setError(bn ? "ডেস্ক লোড হয়নি।" : "Could not load the desk.");
    } finally {
      setLoading(false);
    }
  }, [bn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function seedDemo() {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "seed"));
      await load();
    } catch {
      setError(bn ? "ডেমো ডেটা লোড হয়নি।" : "Could not load demo data.");
    } finally {
      setSeeding(false);
    }
  }

  const empty = !loading && (desk.empty || ((desk.openJobs || 0) + (desk.dueUnits || 0) + (desk.amcActive || 0) + (desk.technicians || 0) === 0));
  const openList = desk.openList || [];
  const dueList = desk.dueList || [];
  const todayList = desk.todayList || [];
  const complaintList = desk.complaintList || [];
  const completedList = desk.completedList || [];

  const pills = [
    { href: "/services/dispatch", n: desk.unassigned || 0, en: "Unassigned", bn: "আনঅ্যাসাইনড", tone: "is-warn" },
    { href: "/services/technical", n: desk.emergencies || 0, en: "Emergency", bn: "ইমার্জেন্সি", tone: "is-danger" },
    { href: "/services/jobs", n: desk.slaOverdue || 0, en: "SLA overdue", bn: "SLA বকেয়া", tone: "is-danger" },
    { href: "/services/complaints", n: desk.complaints || 0, en: "Complaints", bn: "কমপ্লেইন", tone: "is-warn" },
    { href: "/services/due", n: desk.dueUnits || 0, en: "Due units", bn: "ডিউ ইউনিট", tone: "is-warn" },
    { href: "/services/upcoming", n: desk.upcomingUnits || 0, en: "Upcoming PM", bn: "আপকামিং", tone: "is-info" },
    { href: "/services/jobs/in-progress", n: desk.inProgress || 0, en: "In progress", bn: "চলছে", tone: "is-info" },
    { href: "/services/amc", n: desk.amcActive || 0, en: "Active AMC", bn: "এএমসি", tone: "is-ok" },
  ];

  const links = [
    { href: "/services/jobs", en: "Work orders", bn: "ওয়ার্ক অর্ডার", tone: "dash-qa-blue", n: desk.openJobs || 0 },
    { href: "/services/complaints", en: "Complaints", bn: "কমপ্লেইন", tone: "dash-qa-orange", n: desk.complaints || 0 },
    { href: "/services/machines", en: "Equipment", bn: "ইকুইপমেন্ট", tone: "dash-qa-purple", n: desk.dueUnits || 0 },
    { href: "/services/upcoming", en: "Upcoming PM", bn: "আপকামিং", tone: "dash-qa-green", n: desk.upcomingUnits || 0 },
    { href: "/services/due", en: "Overdue", bn: "ডিউ", tone: "dash-qa-amber", n: desk.dueUnits || 0 },
    { href: "/services/dispatch", en: "Dispatch", bn: "ডিসপ্যাচ", tone: "dash-qa-blue", n: desk.unassigned || 0 },
    { href: "/services/amc", en: "AMC contracts", bn: "এএমসি", tone: "dash-qa-mint", n: desk.amcActive || 0 },
    { href: "/m", en: "Field today", bn: "ফিল্ড আজকে", tone: "dash-qa-green", n: desk.onSite || 0 },
  ];

  return (
    <div className="gp-desk quote-desk svc-home">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "সার্ভিস ডেস্ক" : "Service desk"}
        subtitle={bn
          ? "ওপেন জব, ডিউ মেশিন, আজকের ভিজিট ও এএমসি — এক স্ক্রিনে।"
          : "Open jobs, due machines, today’s visits and AMC — one screen."}
        stats={[
          { value: desk.openJobs || 0, label: bn ? "ওপেন" : "open" },
          { value: desk.dueUnits || 0, label: bn ? "ডিউ" : "overdue" },
          { value: desk.slaOverdue || 0, label: "SLA" },
          { value: desk.onSite || 0, label: bn ? "অন সাইট" : "on site" },
          { value: desk.completedToday || 0, label: bn ? "আজ সম্পন্ন" : "done today" },
          { value: desk.technicians || 0, label: bn ? "টেকনিশিয়ান" : "techs" },
        ]}
        actions={
          <>
            <Link href="/m" className="gp-btn">
              <Radio className="h-4 w-4" />
              {bn ? "ফিল্ড" : "Field"}
            </Link>
            <Link href="/services/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন জব" : "New job"}
            </Link>
          </>
        }
      />

      <div className="svc-attn" aria-label={bn ? "অ্যাটেনশন" : "Attention"}>
        {pills.map((pill) => (
          <Link key={pill.href + pill.en} href={pill.href} className={pill.n ? pill.tone : ""}>
            {bn ? pill.bn : pill.en}
            <em>({pill.n})</em>
          </Link>
        ))}
      </div>

      <div className="quote-board svc-home-board">
        {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}

        {!loading && empty ? (
          <div className="svc-home-empty">
            <Wrench />
            <b>{bn ? "সার্ভিস রেকর্ড নেই" : "No service records yet"}</b>
            <p>
              {bn
                ? "ইন-মেমরি ডাটাবেস খালি। ডেমো ওয়ার্ক অর্ডার, মেশিন, এএমসি ও টেকনিশিয়ান লোড করুন — অথবা নতুন জব খুলুন।"
                : "The in-memory database is empty. Load demo work orders, machines, AMC and technicians — or create a job."}
            </p>
            <div>
              <button type="button" className="gp-btn gp-btn-primary" disabled={seeding} onClick={() => void seedDemo()}>
                {seeding ? (bn ? "লোড হচ্ছে..." : "Loading...") : bn ? "ডেমো ডেটা লোড করুন" : "Load demo data"}
              </button>
              <Link href="/services/new" className="gp-btn">{bn ? "নতুন জব" : "New job"}</Link>
            </div>
          </div>
        ) : null}

        {!loading && !empty ? (
          <>
            <div className="dash-stat-grid svc-home-kpis">
              <article className="dash-stat dash-stat-warn">
                <span>{bn ? "আনঅ্যাসাইনড" : "Unassigned"}</span>
                <b>{desk.unassigned || 0}</b>
                <em>{bn ? "ডিসপ্যাচ বাকি" : "Waiting for dispatch"}</em>
              </article>
              <article className="dash-stat dash-stat-danger">
                <span>{bn ? "ইমার্জেন্সি" : "Emergency"}</span>
                <b>{desk.emergencies || 0}</b>
                <em>{bn ? "৪ ঘণ্টা SLA" : "4-hour SLA"}</em>
              </article>
              <article className="dash-stat">
                <span>{bn ? "আপকামিং পিএম" : "Upcoming PM"}</span>
                <b>{desk.upcomingUnits || 0}</b>
                <em>{bn ? "আগামী ৩০ দিন" : "Next 30 days"}</em>
              </article>
              <article className="dash-stat dash-stat-info">
                <span>{bn ? "সক্রিয় এএমসি" : "Active AMC"}</span>
                <b>{desk.amcActive || 0}</b>
                <em>{bn ? `${desk.technicians || 0} টেক রোস্টার` : `${desk.technicians || 0} techs on roster`}</em>
              </article>
            </div>

            <div className="svc-home-grid">
              <section className="svc-home-panel">
                <div className="svc-home-head">
                  <b>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {bn ? "ওপেন ওয়ার্ক অর্ডার" : "Open work orders"}
                  </b>
                  <Link href="/services/jobs">{bn ? `সব ${desk.openJobs || 0}` : `All ${desk.openJobs || 0}`}</Link>
                </div>
                {openList.length === 0 ? (
                  <p className="svc-home-none">{bn ? "ওপেন জব নেই।" : "No open jobs."}</p>
                ) : (
                  <div className="fu-list svc-home-list">
                    {openList.map((job) => (
                      <JobRow
                        key={job._id}
                        job={job}
                        bn={bn}
                        locale={locale}
                        extra={job.slaOverdue ? (bn ? `SLA ${job.slaHours}ঘ` : `SLA ${job.slaHours}h`) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="svc-home-panel">
                <div className="svc-home-head">
                  <b>
                    <CalendarClock className="h-3.5 w-3.5" />
                    {bn ? "ডিউ ইকুইপমেন্ট" : "Due equipment"}
                  </b>
                  <Link href="/services/due">{bn ? `সব ${desk.dueUnits || 0}` : `All ${desk.dueUnits || 0}`}</Link>
                </div>
                {dueList.length === 0 ? (
                  <p className="svc-home-none">{bn ? "ডিউ মেশিন নেই।" : "No overdue units."}</p>
                ) : (
                  <div className="fu-list svc-home-list">
                    {dueList.map((row) => (
                      <article key={row._id} className="fu-card is-warn">
                        <div className="fu-card-top">
                          <span className="fu-avatar">{initials(row.customerName || row.label || "M")}</span>
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
                          <span className="fu-chip is-warn">
                            {row.daysOverdue ? (bn ? `${row.daysOverdue} দিন` : `${row.daysOverdue}d`) : bn ? "আজ" : "today"}
                          </span>
                        </div>
                        <div className="fu-card-foot svc-home-foot">
                          <p className="fu-meta">
                            {bn ? "ডিউ " : "Due "}
                            {safeDate(row.nextServiceDue || undefined, locale)}
                            {row.customerMobile ? ` · ${row.customerMobile}` : ""}
                          </p>
                          <Link className="fld-act" href={`/services/new${row.customerId ? `?customerId=${row.customerId}` : ""}`}>
                            {bn ? "ভিজিট" : "Visit"}
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="svc-home-grid">
              <section className="svc-home-panel">
                <div className="svc-home-head">
                  <b>
                    <MapPin className="h-3.5 w-3.5" />
                    {bn ? "আজকের ভিজিট" : "Today’s visits"}
                  </b>
                  <Link href="/services/dispatch">{bn ? "ডিসপ্যাচ" : "Dispatch"}</Link>
                </div>
                {todayList.length === 0 ? (
                  <p className="svc-home-none">{bn ? "আজ শিডিউল নেই।" : "Nothing scheduled today."}</p>
                ) : (
                  <div className="fu-list svc-home-list">
                    {todayList.map((job) => (
                      <JobRow key={job._id} job={job} bn={bn} locale={locale} extra={job.checkedInAt ? (bn ? "চেক-ইন" : "checked in") : undefined} />
                    ))}
                  </div>
                )}
              </section>

              <section className="svc-home-panel">
                <div className="svc-home-head">
                  <b>
                    <Wrench className="h-3.5 w-3.5" />
                    {complaintList.length
                      ? bn ? "ওপেন কমপ্লেইন" : "Open complaints"
                      : bn ? "আজ সম্পন্ন" : "Completed today"}
                  </b>
                  <Link href={complaintList.length ? "/services/complaints" : "/services/jobs/completed"}>
                    {complaintList.length ? (bn ? `সব ${desk.complaints || 0}` : `All ${desk.complaints || 0}`) : (bn ? "হিস্ট্রি" : "History")}
                  </Link>
                </div>
                {(complaintList.length ? complaintList : completedList).length === 0 ? (
                  <p className="svc-home-none">{bn ? "আজ সম্পন্ন জব নেই।" : "No jobs closed today."}</p>
                ) : (
                  <div className="fu-list svc-home-list">
                    {(complaintList.length ? complaintList : completedList).map((job) => (
                      <JobRow
                        key={job._id}
                        job={job}
                        bn={bn}
                        locale={locale}
                        extra={complaintList.length ? (bn ? "কমপ্লেইন" : "complaint") : safeDate(job.completedAt || undefined, locale)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="dash-qa-grid">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className={`dash-qa ${link.tone}`}>
                  {bn ? link.bn : link.en} <em>({link.n})</em>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
