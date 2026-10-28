"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { InvoiceActions, DocumentExportBar } from "@/components/InvoiceActions";
import { NesTradeDocument } from "@/components/NesTradeDocument";
import { EmptyState, Field } from "@/components/ui";

type SaleDoc = {
  _id: string;
  invoiceNo?: string;
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
  payments?: { method: string; amount: number }[];
  previousDue?: number;
  customerCompanyName?: string;
  customerContactPerson?: string;
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

export default function InvoiceViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [sale, setSale] = useState<SaleDoc | null>(null);
  const [business, setBusiness] = useState<BusinessDoc | null>(null);
  const [shipment, setShipment] = useState<{ shipmentNo?: string; status?: string; shippedDate?: string } | null>(
    null,
  );
  const [locationName, setLocationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payMessage, setPayMessage] = useState("");
  const [showChrome, setShowChrome] = useState(true);
  const [quoteLookup, setQuoteLookup] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [billLayout, setBillLayout] = useState<"local" | "company" | "due_paid">("local");

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
      setShipment(json.shipment);
      setLocationName(json.location?.name || "");
      if (json.data?.dueAmount > 0) {
        setPayAmount(String(json.data.dueAmount));
      } else {
        setPayAmount("");
      }
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

  async function loadQuotationBill() {
    const no = quoteLookup.trim().toUpperCase();
    if (!no) return;
    setLookupMsg("");
    try {
      const res = await fetch(`/api/sales?quotationNo=${encodeURIComponent(no)}&limit=20`);
      const json = await res.json();
      const list = (json.data || []) as { _id: string; status?: string }[];
      const bill = list.find((s) => s.status === "final");
      const quote = list.find((s) => s.status === "quotation");
      const target = bill || quote;
      if (!target?._id) {
        setLookupMsg("Quotation not found");
        return;
      }
      if (String(target._id) === String(id)) return;
      router.push(
        target.status === "final" ? `/sales/${target._id}/invoice` : `/sales/${target._id}/quotation`,
      );
    } catch {
      setLookupMsg(t("common.error"));
    }
  }

  async function recordPayment() {
    if (!sale) return;
    const amount = Number(payAmount || 0);
    if (amount <= 0) return;
    setPayBusy(true);
    setPayMessage("");
    try {
      const res = await fetch(`/api/sales/${sale._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: payMethod, amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setPayMessage(t("sales.paymentRecorded"));
      await load();
    } catch {
      setPayMessage(t("common.error"));
    } finally {
      setPayBusy(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-muted">{t("common.loading")}</p>;
  }

  if (error || !sale) {
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

  return (
    <div className="gp-desk">
      <div className="gp-page-header no-print">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="gp-btn gp-btn-ghost min-h-10 px-3">
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <div>
            <h1 className="gp-display text-2xl font-bold">{t("invoice.title")}</h1>
            <p className="text-sm text-muted">
              {sale.invoiceNo || "—"}
              {sale.referenceNo ? ` · ${sale.referenceNo}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setBillLayout("local")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                billLayout === "local"
                  ? "bg-[var(--gp-primary)] text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              🏪 {locale === "bn" ? "লোকাল কাস্টমার বিল" : "Local Customer Bill"}
            </button>
            <button
              type="button"
              onClick={() => setBillLayout("company")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                billLayout === "company"
                  ? "bg-[var(--gp-primary)] text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              🏢 {locale === "bn" ? "কোম্পানি বিল ফরম্যাট" : "Company Bill Format"}
            </button>
            <button
              type="button"
              onClick={() => setBillLayout("due_paid")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                billLayout === "due_paid"
                  ? "bg-[var(--gp-primary)] text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              💳 {locale === "bn" ? "বাকি পরিশোধ রশিদ" : "Due Paid Receipt"}
            </button>
          </div>
          <DocumentExportBar
            printBase={`/sales/${sale._id}/invoice`}
            pdfHref={`/api/sales/${sale._id}/invoice?format=pdf&locale=${locale}`}
          />
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
        <button type="button" className="gp-btn gp-btn-ghost min-h-10 px-3" onClick={() => void loadQuotationBill()}>
          {t("pos.loadQuotation")}
        </button>
        {lookupMsg ? <p className="text-sm text-muted">{lookupMsg}</p> : null}
      </div>

      <NesTradeDocument
        kind="bill"
        sale={sale}
        business={business}
        challan={shipment}
        locationName={locationName}
        showChrome={showChrome}
        layout={billLayout}
      />

      {sale.status === "final" && sale.dueAmount > 0 ? (
        <div className="no-print mx-auto mt-6 max-w-4xl rounded-2xl border border-line bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold">{t("sales.recordPayment")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label={t("sales.paymentMethod")}>
              <select
                className="gp-input"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                <option value="cash">{t("sales.cash")}</option>
                <option value="bkash">{t("sales.bkash")}</option>
                <option value="nagad">{t("sales.nagad")}</option>
                <option value="rocket">{t("sales.rocket")}</option>
                <option value="card">{t("sales.card")}</option>
                <option value="cheque">{t("sales.cheque")}</option>
                <option value="bank">{t("sales.bank")}</option>
              </select>
            </Field>
            <Field label={t("common.amount")}>
              <input
                type="number"
                min={0.01}
                max={sale.dueAmount}
                step="0.01"
                className="gp-input"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className="gp-btn gp-btn-primary w-full"
                disabled={payBusy || Number(payAmount || 0) <= 0}
                onClick={() => void recordPayment()}
              >
                {payBusy ? "..." : t("sales.recordPayment")}
              </button>
            </div>
          </div>
          {payMessage ? <p className="mt-2 text-sm font-semibold text-primary">{payMessage}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
