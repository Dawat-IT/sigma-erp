"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { TechnicalWorkPanel } from "@/components/service/TechnicalWorkPanel";

export default function ComplaintTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const bn = locale === "bn";
  const [job, setJob] = useState<null | Record<string, unknown>>(null);
  const [technicians, setTechnicians] = useState<{ _id: string; name: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch(`/api/services/${id}`).then((r) => r.json()),
      fetch("/api/technicians").then((r) => r.json()),
    ]).then(([j, t]) => {
      if (j.error) setError(j.error);
      else setJob(j.data);
      setTechnicians(t.data || []);
    });
  }, [id]);

  if (error) return <EmptyState message={error} />;
  if (!job) return <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p>;

  const history = Array.isArray(job.statusHistory) ? (job.statusHistory as { status?: string; note?: string; changedAt?: string }[]) : [];

  return (
    <div className="gp-desk">
      <PageHeader
        title={String(job.jobNo || "Complaint")}
        subtitle={String(job.issueDescription || "")}
        actions={
          <>
            <Link href="/services/complaints" className="gp-btn">{bn ? "সব কমপ্লেইন" : "All complaints"}</Link>
            <Link href={`/services/${id}/invoice`} className="gp-btn">{bn ? "ইনভয়েস" : "Invoice"}</Link>
          </>
        }
      />
      {history.length ? (
        <ol className="gp-card mb-3 space-y-2 p-4 text-sm">
          {history.map((row, i) => (
            <li key={i} className="flex justify-between gap-2 border-b border-line pb-2 last:border-0">
              <span className="font-semibold">{row.status}</span>
              <span className="text-muted">{row.note || row.changedAt || ""}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <TechnicalWorkPanel job={job as never} technicians={technicians} />
    </div>
  );
}
