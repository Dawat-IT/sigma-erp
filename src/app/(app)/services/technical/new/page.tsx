"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { TechnicalJobForm } from "@/components/service/TechnicalJobForm";

export default function NewTechnicalJobPage() {
  return (
    <div className="gp-desk">
      <PageHeader
        title="New technical job"
        subtitle="Log a breakdown, emergency or preventive visit. The equipment-line checklist loads automatically."
        actions={<Link href="/services/technical" className="gp-btn">Back</Link>}
      />
      <TechnicalJobForm title="Job details" jobKind="complaint" />
    </div>
  );
}
