"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui";
import { BarChart3 } from "lucide-react";

const REPORT_LINKS = [
  { href: "/reports/profit-loss", key: "profitLoss" },
  { href: "/reports/stock", key: "stock" },
  { href: "/reports/service", key: "service" },
  { href: "/reports/expense", key: "expense" },
  { href: "/reports/activity-log", key: "activityLog" },
] as const;

const TILE_TONES = [
  "bg-[#eff6ff] text-[var(--gp-primary)]",
  "bg-[#ecfdf5] text-[#059669]",
  "bg-[#f5f3ff] text-[#7c3aed]",
  "bg-[#fff7ed] text-[#ea580c]",
  "bg-[#fdf2f8] text-[#db2777]",
  "bg-[#ecfeff] text-[#0891b2]",
] as const;

export default function ReportsPage() {
  const t = useTranslations();

  return (
    <div className="reports-premium gp-desk">
      <PageHeader kicker={t("reports.title")} title={t("reports.title")} subtitle={t("reports.drillHint")} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_LINKS.map((r, i) => (
          <Link key={r.key} href={r.href} className="report-tile">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${TILE_TONES[i % TILE_TONES.length]}`}>
              <BarChart3 className="h-4 w-4" />
            </span>
            <p className="mt-2 text-[0.95rem] font-extrabold tracking-tight">{t(`reports.${r.key}`)}</p>
            <p className="mt-1 text-[0.78rem] text-muted">{t("dashboard.clickBreakdown")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
