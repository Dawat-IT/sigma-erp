"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { KpiCard, PageHeader, EmptyState } from "@/components/ui";
import { formatBDT } from "@/lib/utils";

type Sale = {
  _id: string;
  invoiceNo?: string;
  customerName?: string;
  grandTotal?: number;
  dueAmount?: number;
  status?: string;
  saleDate?: string;
};

export default function HrAccountPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [sales, setSales] = useState<Sale[]>([]);
  const [due, setDue] = useState<Sale[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/sales?status=final&limit=8").then((r) => r.json()),
      fetch("/api/dashboard?breakdown=due").then((r) => r.json()),
    ]).then(([s, d]) => {
      setSales(s.data || s.items || []);
      setDue(d.rows || []);
    });
  }, []);

  const outstanding = due.reduce((sum, row) => sum + Number(row.dueAmount || 0), 0);
  const rows = (due.length ? due : sales).slice(0, 12);

  return (
    <div className="gp-desk">
      <PageHeader
        title={bn ? "অ্যাকাউন্ট" : "Account"}
        subtitle={bn ? "ইনভয়েস, বাকি বিল ও কাস্টমার পেমেন্ট।" : "Receivables desk — invoices, overdue balances and customer payments."}
        actions={<Link href="/sales" className="gp-btn gp-btn-primary">{bn ? "সব বিক্রি" : "All sales"}</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={bn ? "সাম্প্রতিক ইনভয়েস" : "Recent invoices"} value={String(sales.length)} />
        <KpiCard label={bn ? "বাকি সারি" : "Overdue rows"} value={String(due.length)} tone="danger" />
        <KpiCard label={bn ? "বাকি টাকা" : "Overdue outstanding"} value={formatBDT(outstanding)} tone="warn" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/accounts/journals/customer-payment" className="gp-btn gp-btn-ghost">{bn ? "কাস্টমার পেমেন্ট" : "Customer payment"}</Link>
        <Link href="/accounts/chart" className="gp-btn gp-btn-ghost">{bn ? "চার্ট অব অ্যাকাউন্টস" : "Chart of accounts"}</Link>
        <Link href="/contacts/customers" className="gp-btn gp-btn-ghost">{bn ? "কাস্টমার লেজার" : "Customer ledgers"}</Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState message={bn ? "এখনো কোনো ইনভয়েস নেই" : "No invoices yet."} />
      ) : (
        <div className="gp-card overflow-hidden">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "ইনভয়েস" : "Invoice"}</th>
                <th>{bn ? "কাস্টমার" : "Customer"}</th>
                <th>{bn ? "মোট" : "Total"}</th>
                <th>{bn ? "বাকি" : "Due"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="font-semibold">{row.invoiceNo || "—"}</td>
                  <td>{row.customerName || "—"}</td>
                  <td>{formatBDT(row.grandTotal || 0)}</td>
                  <td>{formatBDT(row.dueAmount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
