"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, FileText } from "lucide-react";
import { DocumentExportBar } from "@/components/InvoiceActions";
import { NesTradeDocument } from "@/components/NesTradeDocument";
import { OrderPipelineBar } from "@/components/OrderPipelineBar";
import { EmptyState } from "@/components/ui";

type SaleDoc = {
  _id: string;
  invoiceNo?: string;
  proposalNo?: string;
  quotationNo?: string;
  salesOrderNo?: string;
  referenceNo?: string;
  poNo?: string;
  poDate?: string;
  subject?: string;
  terms?: string;
  status: string;
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  items: {
    name?: string;
    sku?: string;
    unit?: string;
    description?: string;
    imageUrl?: string;
    qty: number;
    unitPrice: number;
    discount?: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  note?: string;
  soldByName?: string;
  saleDate: string;
};

type BusinessDoc = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
};

export default function ProposalViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [sale, setSale] = useState<SaleDoc | null>(null);
  const [business, setBusiness] = useState<BusinessDoc | null>(null);
  const [locationName, setLocationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChrome, setShowChrome] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/${id}`);
      if (!res.ok) {
        setError(t("common.noData"));
        return;
      }
      const json = await res.json();
      setSale(json.data);
      setBusiness(json.business);
      setLocationName(json.location?.name || "");
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowChrome(new URLSearchParams(window.location.search).get("hf") !== "0");
  }, []);

  useEffect(() => {
    if (loading || !sale) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [loading, sale]);

  async function issueQuotation() {
    if (!sale) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/${sale._id}/issue-quotation`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      router.push(`/sales/${json.data?._id || sale._id}/quotation`);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-muted">{t("common.loading")}</p>;
  }

  if (error || !sale) {
    return (
      <div className="space-y-4">
        <Link href="/sales/proposals" className="gp-btn gp-btn-ghost inline-flex">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
        <EmptyState message={error || t("common.noData")} />
      </div>
    );
  }

  const pdfHref = `/api/sales/${sale._id}/proposal?format=pdf&locale=${locale}`;

  return (
    <div className="gp-desk">
      <div className="gp-page-header no-print">
        <div className="flex items-center gap-3">
          <Link href="/sales/proposals" className="gp-btn gp-btn-ghost min-h-10 px-3">
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <div>
            <h1 className="gp-display text-2xl font-bold">{t("nav.listProposals")}</h1>
            <p className="text-sm text-muted">
              {sale.proposalNo || "—"}
              {sale.referenceNo ? ` · ${sale.referenceNo}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <DocumentExportBar printBase={`/sales/${sale._id}/proposal`} pdfHref={pdfHref} />
          {sale.status === "proposal" ? (
            <button
              type="button"
              className="gp-btn gp-btn-primary"
              disabled={busy}
              onClick={() => void issueQuotation()}
            >
              <FileText className="h-4 w-4" />
              {busy ? "..." : t("sales.issueQuotation")}
            </button>
          ) : sale.status === "quotation" ? (
            <Link href={`/sales/${sale._id}/quotation`} className="gp-btn gp-btn-primary">
              {t("sales.viewQuotation")}
            </Link>
          ) : (
            <Link href={`/sales/${sale._id}/invoice`} className="gp-btn gp-btn-primary">
              {t("invoice.show")}
            </Link>
          )}
        </div>
      </div>

      <OrderPipelineBar status={sale.status} className="no-print mb-4" />

      <NesTradeDocument
        kind="proposal"
        sale={sale}
        business={business}
        locationName={locationName}
        showChrome={showChrome}
      />
    </div>
  );
}
