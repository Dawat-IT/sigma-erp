"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Eye, FileText, Plus, Printer, Search } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDateBD } from "@/lib/utils";

type ChallanRow = {
  _id: string;
  shipmentNo?: string;
  saleId?: string;
  customerName?: string;
  referenceNo?: string;
  invoiceNo?: string;
  status?: string;
  shippedDate?: string;
};

export default function ChallanListPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [rows, setRows] = useState<ChallanRow[]>([]);
  const [q, setQ] = useState("");
  const [loadError, setLoadError] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/modules/shipments?limit=200");
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) {
        setLoadError(true);
        setRows([]);
        return;
      }
      setLoadError(false);
      setRows(json.data);
    } catch {
      setLoadError(true);
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.shipmentNo, row.customerName, row.referenceNo, row.invoiceNo, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [q, rows]);

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "সব চালান" : "All Challan"}
        subtitle={locale === "bn" ? "ডেলিভারি চালান তালিকা" : "Delivery challan list"}
        actions={
          <Link href="/pos?mode=challan" className="gp-btn gp-btn-primary shrink-0">
            <Plus className="h-4 w-4" />
            {locale === "bn" ? "চালান যোগ" : "Add Challan"}
          </Link>
        }
      />

      <div className="gp-card flex items-center gap-3 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          className="gp-input min-h-10 border-0 bg-transparent py-1 shadow-none focus:shadow-none"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("common.search")}
        />
      </div>

      <div className="gp-table-wrap !overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState message={loadError ? t("common.error") : t("common.noData")} />
        ) : (
          <table className="gp-table w-full min-w-[860px]">
            <thead>
              <tr>
                <th>{locale === "bn" ? "চালান নং" : "Challan No"}</th>
                <th>{t("common.date")}</th>
                <th>{t("sales.customer")}</th>
                <th>{t("sales.referenceNo")}</th>
                <th>{t("sales.invoiceNo")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const saleId = row.saleId ? String(row.saleId) : "";
                const viewHref = saleId ? `/sales/${saleId}/challan` : "";
                const printHref = saleId ? `/sales/${saleId}/challan?print=1` : "";
                const pdfHref = saleId ? `/api/sales/${saleId}/challan?format=pdf&locale=${locale}` : "";
                return (
                  <tr key={row._id}>
                    <td className="font-semibold">
                      {viewHref ? (
                        <Link href={viewHref} className="text-primary hover:underline">
                          {row.shipmentNo || "—"}
                        </Link>
                      ) : (
                        row.shipmentNo || "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {row.shippedDate ? formatDateBD(row.shippedDate, locale) : "—"}
                    </td>
                    <td>{row.customerName || "—"}</td>
                    <td className="break-words font-mono text-sm">{row.referenceNo || "—"}</td>
                    <td>{row.invoiceNo || "—"}</td>
                    <td>
                      <span className="gp-badge gp-badge-success capitalize">{row.status || "—"}</span>
                    </td>
                    <td className="overflow-visible whitespace-nowrap">
                      {viewHref ? (
                        <div className="flex items-center gap-1">
                          <Link
                            href={viewHref}
                            className="gp-btn gp-btn-ghost inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-visible p-0 text-[var(--gp-ink)]"
                            title={locale === "bn" ? "চালান দেখুন" : "View Delivery Challan"}
                          >
                            <Eye className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
                          </Link>
                          <Link
                            href={printHref}
                            className="gp-btn gp-btn-ghost inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-visible p-0 text-[var(--gp-ink)]"
                            title="Print"
                          >
                            <Printer className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
                          </Link>
                          <a
                            href={pdfHref}
                            target="_blank"
                            rel="noreferrer"
                            className="gp-btn gp-btn-ghost inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-visible p-0 text-[var(--gp-ink)]"
                            title="PDF"
                          >
                            <FileText className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
                          </a>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
