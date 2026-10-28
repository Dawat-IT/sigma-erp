"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";

type Summary = {
  leads: { total: number; open: number; won: number; lost: number; hot: number; warm: number; cold: number };
  followups: { total: number; overdue: number; today: number; upcoming: number };
  deals: { total: number; value: number; byStage: { _id: string; count: number; value: number }[] };
  campaigns: { total: number };
  clients: { total: number };
  recentLeads: { _id: string; name: string; status?: string; rating?: string; mobile?: string }[];
  overdueFollows: { _id: string; leadName?: string; clientName?: string; scheduledAt: string; status?: string }[];
  recentDeals: { _id: string; title: string; stage?: string; value?: number }[];
};

export default function CrmPage() {
  const t = useTranslations();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/crm/summary");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "error");
      setData(json.data);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="gp-desk">
      <PageHeader
        kicker="CRM"
        title={t("nav.crmDashboard")}
        subtitle={t("crm.subtitle")}
        stats={data ? [
          { value: data.leads.open, label: t("crm.open") },
          { value: data.followups.overdue, label: t("crm.overdue") },
          { value: data.clients.total, label: t("crm.clients") },
        ] : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/crm/leads" className="gp-btn gp-btn-ghost">
              {t("crm.leads")}
            </Link>
            <Link href="/crm/followups" className="gp-btn gp-btn-ghost">
              {t("crm.followups")}
            </Link>
            <Link href="/crm/clients" className="gp-btn gp-btn-primary">
              {t("crm.clients")}
            </Link>
          </div>
        }
      />
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-muted">{t("common.loading")}</p> : null}
      {!loading && data ? (
        <>
          <div className="dash-stat-grid">
            <article className="dash-stat">
              <span>{t("crm.leads")}</span>
              <b>{data.leads.total}</b>
              <em>{data.leads.open} {t("crm.open")}</em>
            </article>
            <article className="dash-stat dash-stat-warn">
              <span>{t("crm.followups")}</span>
              <b>{data.followups.total}</b>
              <em>{data.followups.overdue} {t("crm.overdue")}</em>
            </article>
            <article className="dash-stat dash-stat-info">
              <span>{t("crm.deals")}</span>
              <b>{data.deals.total}</b>
              <em>{formatBDT(data.deals.value)}</em>
            </article>
            <article className="dash-stat">
              <span>{t("crm.clients")}</span>
              <b>{data.clients.total}</b>
              <em>{data.campaigns.total} {t("crm.campaigns")}</em>
            </article>
          </div>
          {data.followups.overdue > 0 ? (
            <div className="rounded-xl border border-[var(--gp-danger-border)] bg-[var(--gp-danger-soft)] p-4">
              <p className="font-semibold text-[var(--gp-danger)]">
                {data.followups.overdue} {t("crm.overdueNeedAttention")}
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="dash-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{t("crm.recentLeads")}</p>
                <Link href="/crm/leads" className="text-sm text-[var(--gp-primary)]">
                  {t("common.view")}
                </Link>
              </div>
              {data.recentLeads.length === 0 ? (
                <EmptyState message={t("common.noData")} />
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.recentLeads.map((row) => (
                    <li key={row._id} className="flex justify-between gap-2 border-b border-line pb-2">
                      <span>{row.name}</span>
                      <span className="text-muted">{row.status || "open"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="dash-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{t("crm.overdueFollowUps")}</p>
                <Link href="/crm/followups" className="text-sm text-[var(--gp-primary)]">
                  {t("common.view")}
                </Link>
              </div>
              {data.overdueFollows.length === 0 ? (
                <EmptyState message={t("common.noData")} />
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.overdueFollows.map((row) => (
                    <li key={row._id} className="flex justify-between gap-2 border-b border-line pb-2">
                      <span>{row.leadName || row.clientName || t("crm.followups")}</span>
                      <span className="text-muted">{formatDateBD(row.scheduledAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="dash-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{t("crm.pipeline")}</p>
                <Link href="/crm/deals" className="text-sm text-[var(--gp-primary)]">
                  {t("common.view")}
                </Link>
              </div>
              {data.recentDeals.length === 0 ? (
                <EmptyState message={t("common.noData")} />
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.recentDeals.map((row) => (
                    <li key={row._id} className="flex justify-between gap-2 border-b border-line pb-2">
                      <span>{row.title}</span>
                      <span className="text-muted">
                        {row.stage} · {formatBDT(row.value || 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
