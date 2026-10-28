"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { DocumentExportBar, InvoiceActions } from "@/components/InvoiceActions";
import { NesTradeDocument } from "@/components/NesTradeDocument";
import { EmptyState, Field } from "@/components/ui";

type ChallanItem = {
  name?: string;
  sku?: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
  qty?: number;
};

type ChallanDoc = {
  _id: string;
  shipmentNo: string;
  invoiceNo?: string;
  referenceNo?: string;
  customerName?: string;
  shippingAddress?: string;
  status?: string;
  shippedDate?: string;
  items?: ChallanItem[];
};

type SaleDoc = {
  _id: string;
  invoiceNo?: string;
  quotationNo?: string;
  salesOrderNo?: string;
  referenceNo?: string;
  poNo?: string;
  poDate?: string;
  subject?: string;
  status?: string;
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  saleDate: string;
  soldByName?: string;
  items: ChallanItem[];
};

type BusinessDoc = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
};

export default function DeliveryChallanPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [challan, setChallan] = useState<ChallanDoc | null>(null);
  const [sale, setSale] = useState<SaleDoc | null>(null);
  const [business, setBusiness] = useState<BusinessDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showChrome, setShowChrome] = useState(true);
  const [quoteLookup, setQuoteLookup] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/sales/${id}/challan?format=json`);
        if (!res.ok) {
          setError(t("common.noData"));
          return;
        }
        const json = await res.json();
        setChallan(json.data);
        setSale(json.sale);
        setBusiness(json.business);
      } catch {
        setError(t("common.error"));
      } finally {
        setLoading(false);
      }
    }
    if (id) void load();
  }, [id, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowChrome(new URLSearchParams(window.location.search).get("hf") !== "0");
  }, []);

  async function loadQuotationChallan() {
    const no = quoteLookup.trim().toUpperCase();
    if (!no) return;
    setLookupMsg("");
    try {
      const res = await fetch(`/api/sales?quotationNo=${encodeURIComponent(no)}&status=quotation&limit=1`);
      const json = await res.json();
      const quote = json.data?.[0];
      if (!quote?._id) {
        setLookupMsg("Quotation not found");
        return;
      }
      if (String(quote._id) === String(id)) return;
      router.push(`/sales/${quote._id}/challan`);
    } catch {
      setLookupMsg(t("common.error"));
    }
  }

  useEffect(() => {
    if (loading || !challan || !sale) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [loading, challan, sale]);

  if (loading) {
    return <p className="p-8 text-center text-muted">{t("common.loading")}</p>;
  }

  if (error || !challan || !sale) {
    return (
      <div className="space-y-4">
        <Link href="/sales" className="gp-btn gp-btn-ghost inline-flex">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Link>
        <EmptyState message={error || t("common.noData")} />
      </div>
    );
  }

  const pdfHref = `/api/sales/${sale._id}/challan?format=pdf&locale=${locale}`;

  return (
    <div className="gp-desk">
      <div className="gp-page-header no-print">
        <div className="flex items-center gap-3">
          <Link href={`/sales/${sale._id}/invoice`} className="gp-btn gp-btn-ghost min-h-10 px-3">
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <div>
            <h1 className="gp-display text-2xl font-bold">{t("invoice.deliveryChallan")}</h1>
            <p className="text-sm text-muted">
              {challan.shipmentNo}
              {sale.referenceNo ? ` · ${sale.referenceNo}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <DocumentExportBar printBase={`/sales/${sale._id}/challan`} pdfHref={pdfHref} />
          <InvoiceActions saleId={sale._id} saleStatus={sale.status} hidePrintPdf />
        </div>
      </div>

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-end gap-2">
        <Field label={t("pos.quotationPiNo")}>
          <input
            className="gp-input"
            value={quoteLookup}
            onChange={(e) => setQuoteLookup(e.target.value.toUpperCase())}
            placeholder="SIG202600001"
          />
        </Field>
        <button type="button" className="gp-btn gp-btn-ghost min-h-10 px-3" onClick={() => void loadQuotationChallan()}>
          {t("pos.loadQuotation")}
        </button>
        {lookupMsg ? <p className="text-sm text-muted">{lookupMsg}</p> : null}
      </div>

      <NesTradeDocument kind="challan" sale={sale} business={business} challan={challan} showChrome={showChrome} />
    </div>
  );
}
