"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { TechnicalJobForm } from "@/components/service/TechnicalJobForm";

export default function NewProjectPage() {
  return (
    <div className="gp-desk">
      <PageHeader
        title="New installation project"
        subtitle="Commissioning checklist loads from the equipment line (lift, generator, ARD, …)."
        actions={<Link href="/services/projects" className="gp-btn">Back</Link>}
      />
      <TechnicalJobForm title="Project details" jobKind="installation" />
    </div>
  );
}
