"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { CalendarDays, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ServiceJobsTable, type ServiceJobRow } from "@/components/service/ServiceJobsTable";

type Props = {
  title: string;
  subtitle: string;
  jobKind?: string;
  status?: string;
  scope?: string;
  newHref?: string;
  newLabel?: string;
};

export function JobListBoard({ title, subtitle, jobKind, status, scope, newHref, newLabel }: Props) {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<ServiceJobRow[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100" });
    if (jobKind) qs.set("jobKind", jobKind);
    if (status) qs.set("status", status);
    if (scope) qs.set("scope", scope);
    if (q.trim()) qs.set("q", q.trim());
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/services?${qs}`);
    const json = await res.json();
    setRows(json.data || json.items || []);
    setLoading(false);
  }, [from, jobKind, q, scope, status, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="gp-desk">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          newHref ? (
            <Link href={newHref} className="gp-btn gp-btn-primary">
              <Plus className="h-4 w-4" />
              {newLabel || (bn ? "নতুন" : "New")}
            </Link>
          ) : null
        }
      />
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="relative min-w-[200px] flex-1 max-w-md">
          <span className="gp-field-label">{bn ? "খুঁজুন" : "Search"}</span>
          <Search className="pointer-events-none absolute left-3 top-[1.85rem] h-4 w-4 text-muted" />
          <input className="gp-input gp-input-icon-left" value={q} onChange={(e) => setQ(e.target.value)} placeholder={bn ? "জব, সমস্যা" : "Job, issue"} />
        </label>
        <label>
          <span className="gp-field-label inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {bn ? "থেকে" : "From"}
          </span>
          <input type="date" className="gp-input min-w-[11rem]" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span className="gp-field-label">{bn ? "পর্যন্ত" : "To"}</span>
          <input type="date" className="gp-input min-w-[11rem]" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="gp-btn gp-btn-primary">{bn ? "ফিল্টার" : "Filter"}</button>
      </form>
      <ServiceJobsTable rows={rows} loading={loading} />
    </div>
  );
}
