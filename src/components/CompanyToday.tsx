"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AlertBanner } from "@/components/ui";
import { formatBDT } from "@/lib/utils";

export type CompanyTodayData = {
  date?: string;
  houses?: { planned?: number; onSite?: number; done?: number; skipped?: number };
  flags?: { type?: string; label?: string; id?: string }[];
  money?: { service?: number; parts?: number; undepositedCash?: number };
  pipeline?: { proposal?: number; quotation?: number; final?: number };
  followupsOverdue?: number;
  payrollRisk?: { employeeId?: string; visits?: number; expected?: number; pct?: number; flag?: boolean }[];
};

function dashTk(amount: number, locale: string) {
  return formatBDT(amount, locale).replace(/\.00$/, "");
}

export function CompanyToday({
  data,
  error,
  locale,
}: {
  data: CompanyTodayData | null;
  error?: string;
  locale: string;
}) {
  const bn = locale === "bn";
  const houses = data?.houses || {};
  const planned = Number(houses.planned || 0);
  const done = Number(houses.done || 0);
  const flags = data?.flags || [];
  const money = data?.money || {};
  const pipeline = data?.pipeline || {};
  const risk = (data?.payrollRisk || []).filter((row) => row.flag);
  const serviceParts = Number(money.service || 0) + Number(money.parts || 0);

  return (
    <section className="dash-today">
      {error ? <AlertBanner tone="error" message={error} /> : null}
      <div className="dash-stat-grid">
        <article className="dash-stat">
          <span>{bn ? "কাস্টমার ভিজিট" : "Customer visits"}</span>
          <b>{done}/{planned || 0}</b>
          <em>{bn ? `${houses.onSite || 0} অন সাইট · ${houses.skipped || 0} স্কিপ` : `${houses.onSite || 0} on site · ${houses.skipped || 0} skipped`}</em>
        </article>
        <article className="dash-stat dash-stat-info">
          <span>{bn ? "সার্ভিস + পার্টস" : "Service + parts"}</span>
          <b>{dashTk(serviceParts, locale)}</b>
          <em>{bn ? "নগদ বাকি" : "Cash in van"} {dashTk(Number(money.undepositedCash || 0), locale)}</em>
        </article>
        <article className="dash-stat">
          <span>{bn ? "নতুন লিফট" : "New lifts"}</span>
          <b>{pipeline.proposal || 0}/{pipeline.quotation || 0}/{pipeline.final || 0}</b>
          <em>{bn ? "প্রস্তাবনা / কোটেশন / অর্ডার" : "Proposal / quotation / order"}</em>
        </article>
        <article className={`dash-stat ${(data?.followupsOverdue || 0) > 0 || risk.length ? "dash-stat-warn" : ""}`}>
          <span>{bn ? "ফলো-আপ বাকি" : "Overdue follow-ups"}</span>
          <b>{data?.followupsOverdue || 0}</b>
          <em>{risk.length ? (bn ? `${risk.length} জন অনুপস্থিত` : `${risk.length} with 0 visits`) : (bn ? "পে-রোল ঝুঁকি নেই" : "No payroll flags")}</em>
        </article>
      </div>
      {flags.length ? (
        <div className="dash-flags">
          <p>
            <AlertTriangle className="h-3.5 w-3.5" />
            {bn ? "অনুপস্থিত" : "Absent"}
          </p>
          <ul>
            {flags.slice(0, 6).map((flag) => (
              <li key={`${flag.type}-${flag.id}`}>
                {flag.type === "too_fast" || flag.type === "too_far" ? (
                  <Link href={`/services/${flag.id}`}>{flag.label}</Link>
                ) : (
                  flag.label
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
