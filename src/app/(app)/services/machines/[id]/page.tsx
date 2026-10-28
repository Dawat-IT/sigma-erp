"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { ServiceJobsTable, type ServiceJobRow } from "@/components/service/ServiceJobsTable";
import { formatDateBD } from "@/lib/utils";

type Machine = {
  _id: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  machineType?: string;
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  nextServiceDue?: string;
  warrantyExpiryDate?: string;
  commissionedAt?: string;
  notes?: string;
  customerId?: { _id?: string; name?: string; mobile?: string; address?: string };
};

export default function EquipmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const bn = locale === "bn";
  const [machine, setMachine] = useState<Machine | null>(null);
  const [jobs, setJobs] = useState<ServiceJobRow[]>([]);
  const [tab, setTab] = useState<"info" | "install" | "service">("info");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/machines/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setMachine(json.data);
          setJobs(json.jobs || []);
        }
      });
  }, [id]);

  const installs = useMemo(
    () => jobs.filter((j) => j.jobKind === "installation" || (j as { type?: string }).type === "installation"),
    [jobs],
  );
  const services = useMemo(
    () => jobs.filter((j) => j.jobKind !== "installation" && (j as { type?: string }).type !== "installation"),
    [jobs],
  );

  if (error) return <EmptyState message={error} />;
  if (!machine) return <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p>;

  return (
    <div className="gp-desk">
      <PageHeader
        title={[machine.brand, machine.model, machine.serialNo].filter(Boolean).join(" · ") || (bn ? "মেশিন" : "Machine")}
        subtitle={machine.customerId?.name || ""}
        actions={
          <>
            <Link href="/services/machines" className="gp-btn">{bn ? "তালিকা" : "List"}</Link>
            <Link href={`/services/new?customerId=${machine.customerId?._id || ""}`} className="gp-btn gp-btn-primary">{bn ? "নতুন জব" : "New job"}</Link>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {([["info", bn ? "ডিটেইলস" : "Details"], ["install", bn ? "ইনস্টলেশন" : "Installation"], ["service", bn ? "সার্ভিস হিস্ট্রি" : "Service history"]] as const).map(([key, label]) => (
          <button key={key} type="button" className={`gp-btn min-h-8 px-3 text-xs ${tab === key ? "gp-btn-primary" : ""}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === "info" ? (
        <div className="gp-card grid gap-2 p-5 text-sm sm:grid-cols-2">
          <p><span className="text-muted">{bn ? "কাস্টমার" : "Customer"} · </span>{machine.customerId?.name} {machine.customerId?.mobile}</p>
          <p><span className="text-muted">{bn ? "ধরন" : "Type"} · </span>{machine.machineType || "—"}</p>
          <p><span className="text-muted">{bn ? "সাইট" : "Site"} · </span>{machine.siteLocation || machine.siteName || "—"}</p>
          <p><span className="text-muted">{bn ? "ঠিকানা" : "Address"} · </span>{machine.siteAddress || machine.customerId?.address || "—"}</p>
          <p><span className="text-muted">{bn ? "পরবর্তী সার্ভিস" : "Next service"} · </span>{machine.nextServiceDue ? formatDateBD(machine.nextServiceDue, locale) : "—"}</p>
          <p><span className="text-muted">{bn ? "ওয়ারেন্টি" : "Warranty"} · </span>{machine.warrantyExpiryDate ? formatDateBD(machine.warrantyExpiryDate, locale) : "—"}</p>
          <p><span className="text-muted">{bn ? "কমিশন" : "Commissioned"} · </span>{machine.commissionedAt ? formatDateBD(machine.commissionedAt, locale) : "—"}</p>
          {machine.notes ? <p className="sm:col-span-2">{machine.notes}</p> : null}
        </div>
      ) : (
        <ServiceJobsTable rows={tab === "install" ? installs : services} hideTechnician={false} />
      )}
    </div>
  );
}
