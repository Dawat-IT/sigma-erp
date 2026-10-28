"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/ui";
import { TechnicalWorkPanel } from "@/components/service/TechnicalWorkPanel";

export default function TechnicalJobDetailPage() {
  const { id } = useParams<{ id: string }>();
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
  if (!job) return <p className="text-muted">Loading job...</p>;

  return (
    <div className="gp-desk">
      <PageHeader
        title={String(job.jobNo || "Technical job")}
        subtitle={String(job.issueDescription || "")}
        actions={
          <>
            <Link href="/services/technical" className="gp-btn">All jobs</Link>
            <Link href={`/services/${id}/invoice`} className="gp-btn">Invoice</Link>
          </>
        }
      />
      <TechnicalWorkPanel job={job as never} technicians={technicians} />
    </div>
  );
}
