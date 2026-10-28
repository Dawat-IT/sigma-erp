"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { AlertBanner, PageHeader, KpiCard, EmptyState } from "@/components/ui";
import {
  EQUIPMENT_LINES,
  TECHNICAL_JOB_TYPES,
  OFFICE_STATUSES,
  knowledgeFor,
  checklistProgress,
  jobTypeLabel,
  officeStatusLabel,
  slaState,
  SERVICE_SOP,
} from "@/lib/technical-checklists";
import { AlertTriangle, Clock, UserX, Wrench } from "lucide-react";

type JobRow = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  equipmentType?: string;
  status?: string;
  priority?: string;
  issueDescription?: string;
  reportedAt?: string;
  createdAt?: string;
  checklist?: { item: string; done?: boolean }[];
  customerId?: { name?: string };
  technicianId?: { _id?: string; name?: string };
};

export default function TechnicalServiceRoute() {
  return (
    <Suspense fallback={<p className="text-muted">...</p>}>
      <TechnicalServicePage />
    </Suspense>
  );
}

function TechnicalServicePage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const equipmentType = searchParams.get("equipmentType") || "";
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState({
    openCount: 0,
    emergencyCount: 0,
    unassignedCount: 0,
    overdueCount: 0,
    dueUnits: 0,
    byLine: [] as { _id?: string; open?: number }[],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const listQuery = new URLSearchParams({
      limit: "40",
      jobKind: type || "complaint,scheduled,emergency",
    });
    if (equipmentType) listQuery.set("equipmentType", equipmentType);
    if (status) listQuery.set("status", status);
    void Promise.all([
      fetch(`/api/services?${listQuery}`).then((r) => r.json()),
      fetch("/api/services?summary=technical").then((r) => r.json()),
    ]).then(([list, sum]) => {
      setJobs(list.data || list.items || []);
      setSummary({
        openCount: sum.openCount || 0,
        emergencyCount: sum.emergencyCount || 0,
        unassignedCount: sum.unassignedCount || 0,
        overdueCount: sum.overdueCount || 0,
        dueUnits: sum.dueUnits || 0,
        byLine: sum.byLine || [],
      });
      setError("");
      setLoading(false);
    }).catch(() => {
      setError(bn ? "লোড হয়নি" : "Could not load");
      setLoading(false);
    });
  }, [equipmentType, type, status]);

  const knowledge = knowledgeFor(equipmentType);

  function href(next: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { equipmentType, type, status, ...next };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const q = params.toString();
    return q ? `/services/technical?${q}` : "/services/technical";
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={bn ? "টেকনিক্যাল সার্ভিস" : "Technical service"}
        subtitle={bn ? "ব্রেকডাউন, ইমার্জেন্সি ও প্রিভেন্টিভ জব — চেকলিস্ট ও SLA।" : "Breakdown, emergency and preventive jobs with checklists and SLA."}
        actions={
          <>
            <Link href="/services/dispatch" className="gp-btn gp-btn-ghost">{bn ? "আজকের ভিজিট" : "Today's visits"}</Link>
            <Link href="/services/technical/new" className="gp-btn gp-btn-primary">
              {bn ? "নতুন জব" : "New technical job"}
            </Link>
          </>
        }
      />
      {error ? <AlertBanner tone="error" message={error} /> : null}

      <div className="gp-kpi-grid">
        <KpiCard label={bn ? "ওপেন জব" : "Open jobs"} value={String(summary.openCount)} icon={Wrench} />
        <KpiCard label={bn ? "ইমার্জেন্সি" : "Emergency"} value={String(summary.emergencyCount)} icon={AlertTriangle} tone="danger" />
        <KpiCard label={bn ? "আনঅ্যাসাইন্ড" : "Unassigned"} value={String(summary.unassignedCount)} icon={UserX} tone="warn" />
        <KpiCard label={bn ? "ওভারডিউ / পিএম" : "Overdue / PM due"} value={`${summary.overdueCount} / ${summary.dueUnits}`} icon={Clock} tone="info" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {EQUIPMENT_LINES.map((line) => {
          const count = summary.byLine.find((row) => row._id === line.value)?.open || 0;
          const active = equipmentType === line.value;
          return (
            <Link key={line.value} href={active ? "/services/technical" : href({ equipmentType: line.value })} className={`gp-card p-4 ${active ? "ring-2 ring-[var(--gp-primary)]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{line.label}</p>
                <span className="text-sm text-muted">{count} open</span>
              </div>
              <p className="mt-1 text-sm text-muted">{line.summary}</p>
            </Link>
          );
        })}
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/services/technical">
        {equipmentType ? <input type="hidden" name="equipmentType" value={equipmentType} /> : null}
        <select name="type" defaultValue={type} className="gp-input max-w-[180px]">
          <option value="">All job types</option>
          {TECHNICAL_JOB_TYPES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select>
        <select name="status" defaultValue={status} className="gp-input max-w-[180px]">
          <option value="">All statuses</option>
          {OFFICE_STATUSES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select>
        <button className="gp-btn gp-btn-primary" type="submit">Filter</button>
      </form>

      {knowledge ? (
        <div className="gp-card mb-4 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{knowledge.label} playbook</p>
          <p className="mt-2 text-sm">{knowledge.workflow}</p>
          <p className="mt-2 text-sm text-muted">Skill: {knowledge.skill} · PM every {knowledge.pmDays} days</p>
        </div>
      ) : (
        <div className="gp-card mb-4 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Service lifecycle</p>
          <p className="mt-2 text-sm">{SERVICE_SOP.map((s) => s.label).join(" → ")}</p>
        </div>
      )}

      <div className="gp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gp-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Client / unit</th>
                <th>Type</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Checklist</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-muted">Loading...</td></tr>
              ) : !jobs.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="No technical jobs yet." />
                  </td>
                </tr>
              ) : jobs.map((job) => {
                const sla = slaState(job);
                const progress = checklistProgress(job.checklist);
                return (
                  <tr key={job._id}>
                    <td>
                      <Link href={`/services/technical/${job._id}`} className="font-semibold text-[var(--gp-primary)]">
                        {job.jobNo}
                      </Link>
                      <p className="max-w-xs truncate text-xs text-muted">{job.issueDescription}</p>
                    </td>
                    <td>
                      <p>{job.customerId?.name || "—"}</p>
                      <p className="text-xs text-muted">
                        {job.equipmentType || "—"} ·{" "}
                        {job.technicianId?._id ? (
                          <Link href={`/services/technicians/${job.technicianId._id}`} className="text-[var(--gp-primary)]">
                            {job.technicianId.name}
                          </Link>
                        ) : "Unassigned"}
                      </p>
                    </td>
                    <td>{jobTypeLabel(job.jobKind)}</td>
                    <td>{officeStatusLabel(job.status)}</td>
                    <td className={sla.key === "overdue" ? "font-semibold text-danger" : ""}>{sla.label}</td>
                    <td>{progress.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
