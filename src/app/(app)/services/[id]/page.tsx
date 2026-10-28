"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { ServiceJobForm } from "@/components/service/ServiceJobForm";

export default function ServiceJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const bn = locale === "bn";
  const [job, setJob] = useState<null | Record<string, unknown>>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/services/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setJob(json.data);
      });
  }, [id]);

  if (error) return <EmptyState message={error} />;
  if (!job) return <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading job..."}</p>;

  return (
    <div className="gp-desk">
      <PageHeader
        title={String(job.jobNo || (bn ? "সার্ভিস জব" : "Service job"))}
        subtitle={String(job.issueDescription || "")}
        actions={
          <>
            <Link href="/services/jobs" className="gp-btn">{bn ? "সব জব" : "All jobs"}</Link>
            <Link href={`/services/${id}/invoice`} className="gp-btn gp-btn-primary">{bn ? "ইনভয়েস" : "Invoice"}</Link>
          </>
        }
      />
      <ServiceJobForm job={job as never} />
    </div>
  );
}
