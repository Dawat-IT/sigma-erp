"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { KpiCard, PageHeader, EmptyState } from "@/components/ui";

type Lead = { _id: string; name: string; source?: string; status?: string; company?: string; updatedAt?: string };

export default function BusinessDevPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followDue, setFollowDue] = useState(0);

  useEffect(() => {
    void Promise.all([
      fetch("/api/crm/leads?limit=200").then((r) => r.json()),
      fetch("/api/crm/summary").then((r) => r.json()),
    ]).then(([l, s]) => {
      setLeads(l.data || []);
      setFollowDue(s.data?.followups?.overdue || 0);
    });
  }, []);

  const pipeline = leads.filter((row) => !["won", "lost"].includes(row.status || ""));
  const quoted = leads.filter((row) => ["proposal", "quoted", "negotiation"].includes(row.status || ""));

  return (
    <div className="gp-desk">
      <PageHeader
        title={bn ? "বিজনেস ডেভ" : "Business Dev"}
        subtitle={bn ? "লিড, সাইট ফলো-আপ ও কোটেশন।" : "Leads, site follow-ups and quotations for the sales / BD desk."}
        actions={<Link href="/crm/leads" className="gp-btn gp-btn-primary">{bn ? "সব লিড" : "All leads"}</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={bn ? "ওপেন পাইপলাইন" : "Open pipeline"} value={String(pipeline.length)} />
        <KpiCard label={bn ? "কোট / নেগোসিয়েশন" : "Quoted / negotiation"} value={String(quoted.length)} tone="info" />
        <KpiCard label={bn ? "ওভারডিউ ফলো-আপ" : "Follow-ups overdue"} value={String(followDue)} tone="warn" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/crm/followups" className="gp-btn">{bn ? "ফলো-আপ" : "Follow-ups"}</Link>
        <Link href="/sales/proposals" className="gp-btn">{bn ? "প্রস্তাব" : "Proposals"}</Link>
        <Link href="/sales/quotations" className="gp-btn">{bn ? "কোটেশন" : "Quotations"}</Link>
        <Link href="/pos?mode=proposal" className="gp-btn">{bn ? "নতুন প্রস্তাব" : "New proposal"}</Link>
      </div>
      {pipeline.length === 0 ? (
        <EmptyState message={bn ? "কোনো ওপেন লিড নেই" : "No open leads."} />
      ) : (
        <div className="gp-card overflow-hidden">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "লিড" : "Lead"}</th>
                <th>{bn ? "কোম্পানি" : "Company"}</th>
                <th>{bn ? "সোর্স" : "Source"}</th>
                <th>{bn ? "স্ট্যাটাস" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.slice(0, 12).map((row) => (
                <tr key={row._id}>
                  <td className="font-semibold">{row.name}</td>
                  <td>{row.company || "—"}</td>
                  <td>{row.source || "—"}</td>
                  <td>{row.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
