"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { formatClock, formatDuration, mapsSearchUrl, todayKey } from "@/lib/service-visit";

type VisitJob = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  status?: string;
  fieldStatus?: string;
  issueDescription?: string;
  house?: string;
  location?: string;
  address?: string;
  mobile?: string;
  lift?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  durationMinutes?: number;
  parts?: { name?: string; qty?: number }[];
  partsTotal?: number;
};

type Board = {
  technician: { _id: string; name: string; mobile?: string; speciality?: string };
  jobs: VisitJob[];
  houseCount: number;
  onSite: number;
  done: number;
  minutes: number;
  partsQty: number;
  partsTotal: number;
};

type Summary = {
  technicians: number;
  workingTechs: number;
  housesToday: number;
  onSite: number;
  completed: number;
  avgMinutes: number;
  partsQty: number;
  partsTotal: number;
  overload: number;
};

type Row = VisitJob & { techId: string; techName: string; techLoad: number };

type Scope = "all" | "waiting" | "onsite" | "done" | "unassigned";

const DONE = new Set(["completed", "delivered", "closed", "resolved"]);

function ymdShift(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "VS";
}

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function jobHref(job: VisitJob) {
  if (job.jobKind === "complaint") return `/services/complaints/${job._id}`;
  if (job.jobKind === "installation") return `/services/projects/${job._id}`;
  return `/services/${job._id}`;
}

function isOnSite(job: VisitJob) {
  return Boolean(job.checkedInAt) && !job.checkedOutAt;
}

function isDone(job: VisitJob) {
  return Boolean(job.checkedOutAt) || DONE.has(String(job.status || "").toLowerCase());
}

function visitState(job: Row): Scope {
  if (!job.techId) return "unassigned";
  if (isDone(job)) return "done";
  if (isOnSite(job)) return "onsite";
  return "waiting";
}

function cardTone(job: Row) {
  const state = visitState(job);
  if (state === "done") return "is-ok";
  if (state === "onsite") return "is-info";
  if (state === "unassigned" || job.techLoad > 4) return "is-warn";
  return "is-info";
}

function chipLabel(job: Row, bn: boolean) {
  const state = visitState(job);
  if (state === "done") return bn ? "সম্পন্ন" : "Done";
  if (state === "onsite") return bn ? "অন সাইট" : "On site";
  if (state === "unassigned") return bn ? "আনঅ্যাসাইনড" : "Unassigned";
  return bn ? "অপেক্ষা" : "Waiting";
}

export default function DispatchPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [date, setDate] = useState(todayKey());
  const [boards, setBoards] = useState<Board[]>([]);
  const [unassigned, setUnassigned] = useState<VisitJob[]>([]);
  const [summary, setSummary] = useState<Summary>({
    technicians: 0,
    workingTechs: 0,
    housesToday: 0,
    onSite: 0,
    completed: 0,
    avgMinutes: 0,
    partsQty: 0,
    partsTotal: 0,
    overload: 0,
  });
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [techId, setTechId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (nextDate = date) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/services/dispatch?date=${nextDate}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setBoards(json.boards || []);
      setUnassigned(json.unassigned || []);
      if (json.summary) setSummary(json.summary);
    } catch {
      setBoards([]);
      setUnassigned([]);
      setError(bn ? "ভিজিট লোড হয়নি।" : "Could not load visits.");
    } finally {
      setLoading(false);
    }
  }, [bn, date]);

  useEffect(() => {
    void load(date);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    for (const board of boards) {
      for (const job of board.jobs) {
        list.push({
          ...job,
          techId: board.technician._id,
          techName: board.technician.name,
          techLoad: board.houseCount,
        });
      }
    }
    for (const job of unassigned) {
      list.push({ ...job, techId: "", techName: "", techLoad: 0 });
    }
    return list;
  }, [boards, unassigned]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((job) => {
      if (techId === "unassigned" && job.techId) return false;
      if (techId && techId !== "unassigned" && job.techId !== techId) return false;
      const state = visitState(job);
      if (scope !== "all" && state !== scope) return false;
      if (!needle) return true;
      return [job.jobNo, job.house, job.location, job.issueDescription, job.techName, job.mobile, job.lift]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [rows, scope, search, techId]);

  const waitingN = rows.filter((job) => visitState(job) === "waiting").length;
  const onsiteN = rows.filter((job) => visitState(job) === "onsite").length;
  const doneN = rows.filter((job) => visitState(job) === "done").length;

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All visits", bn: "সব ভিজিট", n: rows.length },
    { id: "waiting", en: "Waiting", bn: "অপেক্ষা", n: waitingN },
    { id: "onsite", en: "On site", bn: "অন সাইট", n: onsiteN },
    { id: "done", en: "Done", bn: "সম্পন্ন", n: doneN },
    { id: "unassigned", en: "Unassigned", bn: "আনঅ্যাসাইনড", n: unassigned.length },
  ];

  const quick = [
    { id: ymdShift(-1), en: "Yesterday", bn: "গতকাল" },
    { id: todayKey(), en: "Today", bn: "আজ" },
    { id: ymdShift(1), en: "Tomorrow", bn: "কাল" },
  ];

  async function clock(jobId: string, action: "check_in" | "check_out") {
    setBusyId(jobId);
    setError("");
    try {
      const res = await fetch(`/api/services/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {
          need_technician: bn ? "আগে টেকনিশিয়ান অ্যাসাইন করুন।" : "Assign a technician first.",
          already_on_site: bn ? "এই কাস্টমারে ইতিমধ্যে চেক-ইন আছে।" : "Already checked in at this customer.",
          need_checkin: bn ? "আগে চেক-ইন করুন।" : "Check in first.",
        };
        throw new Error(map[String(json.error)] || json.error || "failed");
      }
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "সার্ভিস মেইনটেন্যান্স" : "Service maintenance"}
        title={bn ? "আজকের কাস্টমার ভিজিট" : "Today's visits"}
        subtitle={bn
          ? "প্রতি টেক ৩–৪ কাস্টমার — চেক-ইন, সময় ও পার্টস এক স্ক্রিনে।"
          : "3–4 customers per tech — check-in, time and parts on one screen."}
        stats={[
          { value: summary.housesToday || rows.length, label: bn ? "ভিজিট" : "visits" },
          { value: `${summary.workingTechs}/${summary.technicians}`, label: bn ? "টেক আউট" : "techs out" },
          { value: summary.onSite, label: bn ? "অন সাইট" : "on site" },
          { value: unassigned.length, label: bn ? "আনঅ্যাসাইনড" : "unassigned" },
        ]}
        actions={
          <>
            <input
              className="gp-input desk-hero-search"
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                setQ(value);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => setSearch(value), 200);
              }}
              placeholder={bn ? "জব / কাস্টমার" : "Job / customer"}
            />
            <Link href="/services/new" className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {bn ? "নতুন জব" : "New job"}
            </Link>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {pills.map((pill) => (
            <button key={pill.id} type="button" className={scope === pill.id ? "on" : ""} onClick={() => setScope(pill.id)}>
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        {quick.map((pill) => (
          <button
            key={pill.id}
            type="button"
            className={`gp-btn gp-btn-ghost ${date === pill.id ? "on" : ""}`}
            onClick={() => setDate(pill.id)}
          >
            {bn ? pill.bn : pill.en}
          </button>
        ))}
        <Link href="/services/dispatch/assign" className="gp-btn gp-btn-ghost">{bn ? "অ্যাসাইন" : "Assign"}</Link>
        <Link href="/services/dispatch/live" className="gp-btn gp-btn-ghost">{bn ? "লাইভ" : "Live"}</Link>
        <input
          type="date"
          aria-label={bn ? "তারিখ" : "Date"}
          className="gp-input fu-search"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="fu-views">
        <button type="button" className={techId === "" ? "on" : ""} onClick={() => setTechId("")}>
          {bn ? "সব টেক" : "All techs"}
        </button>
        <button type="button" className={techId === "unassigned" ? "on" : ""} onClick={() => setTechId("unassigned")}>
          {bn ? "আনঅ্যাসাইনড" : "Unassigned"}
          {unassigned.length ? <em>{unassigned.length}</em> : null}
        </button>
        {boards.map((board) => (
          <button
            key={board.technician._id}
            type="button"
            className={techId === board.technician._id ? "on" : ""}
            onClick={() => setTechId(board.technician._id)}
          >
            {board.technician.name}
            <em>{board.houseCount}</em>
          </button>
        ))}
      </div>

      {summary.overload ? (
        <p className="fu-filter-note">
          {bn ? `${summary.overload} জনের আজ ৪টার বেশি কাস্টমার।` : `${summary.overload} tech(s) over 4 customers today.`}
        </p>
      ) : null}
      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}

      <div className="quote-board">
        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "এই দিনে ভিজিট নেই" : "No visits this day"}
            message={bn ? "অ্যাসাইন করুন, অথবা অন্য তারিখ বাছুন।" : "Assign a job, or pick another date."}
          />
        ) : null}

        <div className="fu-list">
          {filtered.map((job) => {
            const onSite = isOnSite(job);
            const parts = (job.parts || []).filter((row) => Number(row.qty) > 0);
            const href = jobHref(job);
            const map = mapsSearchUrl(job.address, job.location);
            const tone = cardTone(job);
            return (
              <article key={`${job.techId || "u"}-${job._id}`} className={`fu-card ${tone}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(job.house || job.jobNo || "VS")}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={href}>{job.jobNo || "—"}</Link>
                    </strong>
                    <p>
                      {job.house || "—"}
                      {job.location ? ` · ${job.location}` : ""}
                      {job.techName ? ` · ${job.techName}` : bn ? " · আনঅ্যাসাইনড" : " · Unassigned"}
                    </p>
                  </div>
                  <span className={`fu-chip ${tone}`}>{chipLabel(job, bn)}</span>
                </div>
                {job.issueDescription ? <p className="fu-note">{job.issueDescription}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {job.lift || "—"}
                    {` · ${bn ? "ইন" : "In"} ${formatClock(job.checkedInAt, bn ? "bn" : "en")}`}
                    {` → ${bn ? "আউট" : "Out"} ${formatClock(job.checkedOutAt, bn ? "bn" : "en")}`}
                    {job.checkedInAt ? ` · ${formatDuration(Number(job.durationMinutes || 0), bn ? "bn" : "en")}` : ""}
                    {parts.length ? ` · ${parts.map((row) => `${row.name} × ${row.qty}`).join(", ")}` : ""}
                    {Number(job.partsTotal || 0) > 0 ? ` · ${moneyShort(Number(job.partsTotal || 0), locale)}` : ""}
                    {job.mobile ? ` · ${job.mobile}` : ""}
                    {job.techLoad > 4 ? ` · ${job.techLoad}/4` : ""}
                  </p>
                  {job.techId ? (
                    <>
                      <button
                        type="button"
                        className="fld-act"
                        disabled={busyId === job._id || onSite || isDone(job)}
                        onClick={() => void clock(job._id, "check_in")}
                      >
                        {bn ? "চেক-ইন" : "Check in"}
                      </button>
                      <button
                        type="button"
                        className="fld-act"
                        disabled={busyId === job._id || !onSite}
                        onClick={() => void clock(job._id, "check_out")}
                      >
                        {bn ? "চেক-আউট" : "Check out"}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link className="fld-act" href="/services/dispatch/assign">{bn ? "অ্যাসাইন" : "Assign"}</Link>
                      {map ? (
                        <a className="fld-act" href={map} target="_blank" rel="noreferrer">{bn ? "ম্যাপ" : "Map"}</a>
                      ) : (
                        <Link className="fld-act" href={`/m/${job._id}`}>{bn ? "ফিল্ড" : "Field"}</Link>
                      )}
                    </>
                  )}
                  <Link className="fld-act" href={href}>{bn ? "খুলুন" : "Open"}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
