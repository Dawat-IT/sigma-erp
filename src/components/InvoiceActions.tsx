"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileCheck, FileText, MoreHorizontal, Pencil, Printer, Trash2, Truck } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { paymentStatusBadgeClass, paymentStatusFromAmounts } from "@/lib/sale-finance";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PaymentStatusBadge({
  grandTotal,
  paidAmount,
}: {
  grandTotal: number;
  paidAmount: number;
}) {
  const t = useTranslations();
  const status = paymentStatusFromAmounts(grandTotal, paidAmount);
  const label =
    status === "paid"
      ? t("sales.paymentPaid")
      : status === "partial"
        ? t("sales.paymentPartial")
        : t("sales.paymentDue");
  return <span className={cn(paymentStatusBadgeClass(status), "capitalize")}>{label}</span>;
}

export function DocumentExportBar({
  printBase,
  pdfHref,
}: {
  printBase: string;
  pdfHref: string;
}) {
  function withQuery(url: string, extra: string) {
    return url.includes("?") ? `${url}&${extra}` : `${url}?${extra}`;
  }
  const btn = "gp-btn gp-btn-ghost min-h-10 px-3 text-sm";
  return (
    <>
      <Link href={withQuery(printBase, "print=1")} className={btn}>
        Print with Header & Footer
      </Link>
      <Link href={withQuery(printBase, "print=1&hf=0")} className={btn}>
        Print without Header & Footer
      </Link>
      <a href={pdfHref} target="_blank" rel="noreferrer" className={btn}>
        PDF with Header & Footer
      </a>
      <a href={withQuery(pdfHref, "hf=0")} target="_blank" rel="noreferrer" className={btn}>
        PDF without Header & Footer
      </a>
    </>
  );
}

export function InvoiceActions({
  saleId,
  compact,
  inline,
  showPrint,
  hidePrintPdf,
  saleStatus,
  className,
  iconOnly,
  iconOnlyCore,
  asMenu,
  onEdit,
  onDelete,
}: {
  saleId: string;
  compact?: boolean;
  inline?: boolean;
  showPrint?: boolean;
  hidePrintPdf?: boolean;
  saleStatus?: string;
  className?: string;
  iconOnly?: boolean;
  iconOnlyCore?: boolean;
  asMenu?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pdfHref = `/api/sales/${saleId}/invoice?format=pdf&locale=${locale}`;
  const viewHref = `/sales/${saleId}/invoice`;
  const quotationHref = `/sales/${saleId}/quotation`;
  const quotationPdf = `/api/sales/${saleId}/quotation?format=pdf&locale=${locale}`;
  const proposalHref = `/sales/${saleId}/proposal`;
  const proposalPdf = `/api/sales/${saleId}/proposal?format=pdf&locale=${locale}`;
  const challanView = `/sales/${saleId}/challan`;
  const challanPdf = `/api/sales/${saleId}/challan?format=pdf&locale=${locale}`;
  const isQuotation = saleStatus === "quotation";
  const isProposal = saleStatus === "proposal";
  const stacked = compact && !inline;

  const btn = iconOnly
    ? "gp-btn gp-btn-ghost min-h-8 min-w-8 px-2 lg:min-h-7 lg:min-w-7 lg:shrink-0 lg:px-1.5"
    : stacked
    ? "gp-btn gp-btn-ghost min-h-9 w-full justify-start whitespace-nowrap px-2.5 text-sm"
    : inline
      ? "gp-btn gp-btn-ghost min-h-8 px-2 text-xs whitespace-nowrap"
      : "gp-btn gp-btn-ghost min-h-10 px-3 text-sm whitespace-nowrap";

  async function convert() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/finalize`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) router.push(`/sales/${json.data?._id || saleId}/invoice`);
    } finally {
      setBusy(false);
    }
  }

  async function issueQuotation() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/issue-quotation`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) router.push(`/sales/${json.data?._id || saleId}/quotation`);
    } finally {
      setBusy(false);
    }
  }

  const printQuotationHref = `${quotationHref}?print=1`;
  const printInvoiceHref = `${viewHref}?print=1`;
  const printChallanHref = `${challanView}?print=1`;

  const [menuOpen, setMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (menuBtnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function toggleMenu() {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (r) {
      const estimated = 280;
      const top = r.bottom + 4 + estimated > window.innerHeight ? Math.max(8, r.top - estimated) : r.bottom + 4;
      setMenuPos({ top, right: Math.max(8, window.innerWidth - r.right) });
    }
    setMenuOpen((open) => !open);
  }

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--gp-ink)] hover:bg-[var(--gp-primary-soft)]";

  const menu =
    asMenu && menuOpen && portalReady
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[120] min-w-[13.5rem] rounded-lg border border-line bg-white py-1 shadow-xl"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {isProposal ? (
              <>
                <Link href={proposalHref} className={itemClass} onClick={() => setMenuOpen(false)}>
                  <Eye className="h-4 w-4" /> View proposal
                </Link>
                {hidePrintPdf ? null : (
                  <a href={proposalPdf} target="_blank" rel="noreferrer" className={itemClass} onClick={() => setMenuOpen(false)}>
                    <FileText className="h-4 w-4 text-[var(--gp-info)]" /> PDF
                  </a>
                )}
                <button type="button" className={itemClass} disabled={busy} onClick={() => { setMenuOpen(false); void issueQuotation(); }}>
                  <FileCheck className="h-4 w-4" /> {t("sales.issueQuotation")}
                </button>
              </>
            ) : isQuotation ? (
              <>
                <Link href={quotationHref} className={itemClass} onClick={() => setMenuOpen(false)}>
                  <Eye className="h-4 w-4" /> View
                </Link>
                {hidePrintPdf ? null : showPrint ? (
                  <button type="button" className={itemClass} onClick={() => { setMenuOpen(false); window.print(); }}>
                    <Printer className="h-4 w-4" /> Print
                  </button>
                ) : (
                  <Link href={printQuotationHref} className={itemClass} onClick={() => setMenuOpen(false)}>
                    <Printer className="h-4 w-4" /> Print
                  </Link>
                )}
                {hidePrintPdf ? null : (
                  <a href={quotationPdf} target="_blank" rel="noreferrer" className={itemClass} onClick={() => setMenuOpen(false)}>
                    <FileText className="h-4 w-4 text-[var(--gp-info)]" /> PDF
                  </a>
                )}
                <button type="button" className={itemClass} disabled={busy} onClick={() => { setMenuOpen(false); void convert(); }}>
                  <FileCheck className="h-4 w-4" /> {t("sales.convertToOrder")}
                </button>
              </>
            ) : (
              <>
                <Link href={viewHref} className={itemClass} onClick={() => setMenuOpen(false)}>
                  <Eye className="h-4 w-4" /> View Invoice
                </Link>
                {hidePrintPdf ? null : showPrint ? (
                  <button type="button" className={itemClass} onClick={() => { setMenuOpen(false); window.print(); }}>
                    <Printer className="h-4 w-4" /> Print
                  </button>
                ) : (
                  <Link href={printInvoiceHref} className={itemClass} onClick={() => setMenuOpen(false)}>
                    <Printer className="h-4 w-4" /> Print
                  </Link>
                )}
                {hidePrintPdf ? null : (
                  <a href={pdfHref} target="_blank" rel="noreferrer" className={itemClass} onClick={() => setMenuOpen(false)}>
                    <FileText className="h-4 w-4 text-[var(--gp-danger)]" /> Invoice PDF
                  </a>
                )}
                <Link href={challanView} className={itemClass} onClick={() => setMenuOpen(false)}>
                  <Truck className="h-4 w-4" /> View Delivery Challan
                </Link>
                <Link href={printChallanHref} className={itemClass} onClick={() => setMenuOpen(false)}>
                  <Printer className="h-4 w-4" /> Print Delivery Challan
                </Link>
                <a href={challanPdf} target="_blank" rel="noreferrer" className={itemClass} onClick={() => setMenuOpen(false)}>
                  <FileText className="h-4 w-4" /> Delivery Challan PDF
                </a>
              </>
            )}
            {onEdit ? (
              <button type="button" className={itemClass} onClick={() => { setMenuOpen(false); onEdit(); }}>
                <Pencil className="h-4 w-4" /> {t("common.edit")}
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className={cn(itemClass, "text-[var(--gp-danger)]")}
                onClick={() => { setMenuOpen(false); onDelete(); }}
              >
                <Trash2 className="h-4 w-4" /> {t("common.delete")}
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  if (asMenu) {
    return (
      <div className={cn("relative flex justify-end overflow-visible", className)}>
        <button
          ref={menuBtnRef}
          type="button"
          className="gp-btn gp-btn-ghost inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-visible p-0 text-[var(--gp-ink)]"
          aria-label={t("common.actions")}
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <MoreHorizontal className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div
      className={cn(
        stacked
          ? "flex min-w-[13rem] flex-col items-stretch gap-1"
          : "flex flex-wrap items-center gap-1.5",
        inline && "gap-1",
        className,
      )}
    >
      {isProposal ? (
        <>
          <Link href={proposalHref} className={btn} title="View proposal">
            <Eye className="h-4 w-4" />
            <span className={iconOnly || iconOnlyCore ? "sr-only" : undefined}>View</span>
          </Link>
          {hidePrintPdf ? null : (
          <a href={proposalPdf} target="_blank" rel="noreferrer" className={btn} title="PDF">
            <FileText className="h-4 w-4 text-[var(--gp-info)]" />
            <span className={iconOnly ? "sr-only" : undefined}>PDF</span>
          </a>
          )}
          <button
            type="button"
            className={cn(
              inline
                ? "gp-btn gp-btn-primary min-h-8 px-2 text-xs whitespace-nowrap"
                : "gp-btn gp-btn-primary min-h-9 px-2.5 text-sm",
              stacked && "w-full justify-start",
            )}
            disabled={busy}
            onClick={() => void issueQuotation()}
            title={t("sales.issueQuotation")}
          >
            <FileCheck className="h-4 w-4" />
            <span className={iconOnly ? "sr-only" : undefined}>{t("sales.issueQuotation")}</span>
          </button>
        </>
      ) : isQuotation ? (
        <>
          <Link href={quotationHref} className={btn} title="View">
            <Eye className="h-4 w-4" />
            <span className={iconOnly || iconOnlyCore ? "sr-only" : undefined}>View</span>
          </Link>
          {hidePrintPdf ? null : showPrint ? (
            <button type="button" className={btn} onClick={() => window.print()} title="Print">
              <Printer className="h-4 w-4" />
              <span className={iconOnly || iconOnlyCore ? "sr-only" : undefined}>Print</span>
            </button>
          ) : (
            <Link href={printQuotationHref} className={btn} title="Print">
              <Printer className="h-4 w-4" />
              <span className={iconOnly || iconOnlyCore ? "sr-only" : undefined}>Print</span>
            </Link>
          )}
          {hidePrintPdf ? null : (
          <a href={quotationPdf} target="_blank" rel="noreferrer" className={btn} title="PDF">
            <FileText className="h-4 w-4 text-[var(--gp-info)]" />
            <span className={iconOnly ? "sr-only" : undefined}>PDF</span>
          </a>
          )}
          <button
            type="button"
            className={cn(
              inline
                ? "gp-btn gp-btn-primary min-h-8 px-2 text-xs whitespace-nowrap"
                : "gp-btn gp-btn-primary min-h-9 px-2.5 text-sm",
              stacked && "w-full justify-start",
            )}
            disabled={busy}
            onClick={() => void convert()}
            title={t("sales.convertToOrder")}
          >
            <FileCheck className="h-4 w-4" />
            <span className={iconOnly ? "sr-only" : undefined}>{t("sales.convertToOrder")}</span>
          </button>
        </>
      ) : (
        <>
          <Link href={viewHref} className={btn} title="View Invoice">
            <Eye className="h-4 w-4" />
            <span className={iconOnly ? "sr-only" : undefined}>View Invoice</span>
          </Link>
          {hidePrintPdf ? null : showPrint ? (
            <button type="button" className={btn} onClick={() => window.print()} title="Print">
              <Printer className="h-4 w-4" />
              <span className={iconOnly ? "sr-only" : undefined}>Print</span>
            </button>
          ) : (
            <Link href={printInvoiceHref} className={btn} title="Print">
              <Printer className="h-4 w-4" />
              <span className={iconOnly ? "sr-only" : undefined}>Print</span>
            </Link>
          )}
          {hidePrintPdf ? null : (
          <a href={pdfHref} target="_blank" rel="noreferrer" className={btn} title="Invoice PDF">
            <FileText className="h-4 w-4 text-[var(--gp-danger)]" />
            <span className={iconOnly ? "sr-only" : undefined}>Invoice PDF</span>
          </a>
          )}
          <Link href={challanView} className={btn} title="View Delivery Challan">
            <Truck className="h-4 w-4" />
            <span className={iconOnly ? "sr-only" : undefined}>View Delivery Challan</span>
          </Link>
          <Link href={printChallanHref} className={btn} title="Print Delivery Challan">
            <Printer className="h-4 w-4" />
            <span className={iconOnly ? "sr-only" : undefined}>Print Delivery Challan</span>
          </Link>
          <a href={challanPdf} target="_blank" rel="noreferrer" className={btn} title="Delivery Challan PDF">
            <FileText className="h-4 w-4" />
            <span className={iconOnly ? "sr-only" : undefined}>Delivery Challan PDF</span>
          </a>
        </>
      )}
    </div>
  );
}
