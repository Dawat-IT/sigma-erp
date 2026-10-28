"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { CrudForm } from "@/components/CrudForm";
import { InvoiceActions } from "@/components/InvoiceActions";
import { AlertBanner, EmptyState, Field, FilterBar, Modal, PageHeader, TableSkeleton } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { getModule, type ModuleDef } from "@/lib/module-registry";
import { getCrudConfig, isReadOnlyModule, type CrudConfig } from "@/lib/crud-config";
import { useDebouncedValue } from "@/lib/hooks";
import { animateIn, animateStagger } from "@/lib/gsap";

function cellValue(
  row: Record<string, unknown>,
  key: string,
  format: ModuleDef["columns"][0]["format"],
  locale: string,
) {
  const v = row[key];
  if (v == null) return "";
  if (format === "money") return formatBDT(Number(v), locale);
  if (format === "date") return formatDateBD(String(v), locale);
  if (Array.isArray(v)) {
    return v
      .map((item) => (item == null ? "" : String(item)))
      .filter(Boolean)
      .join(" : ");
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("name" in obj) return String(obj.name);
    return Object.values(obj)
      .map((item) => (item == null ? "" : String(item)))
      .filter(Boolean)
      .join(" : ");
  }
  if (typeof v === "string" && v.trim().startsWith("[") && v.trim().endsWith("]")) {
    try {
      const parsed = JSON.parse(v) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean).join(" : ");
      }
    } catch {
      // keep as plain string
    }
  }
  return String(v);
}

function postUrl(config: CrudConfig) {
  return config.itemPath;
}

function itemUrl(config: CrudConfig, id: string) {
  return `${config.itemPath}/${id}`;
}

export function ModulePage({ moduleId }: { moduleId: string }) {
  const mod = getModule(moduleId);
  const crud = getCrudConfig(moduleId);
  const t = useTranslations();
  const locale = useLocale();
  const pageRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const listApi = mod?.apiPath || crud?.listPath || "";

  const load = useCallback(async () => {
    if (!listApi) return;
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100" });
    if (debouncedQ) qs.set("q", debouncedQ);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const sep = listApi.includes("?") ? "&" : "?";
    try {
      const res = await fetch(`${listApi}${sep}${qs}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "error");
      setRows(d.data || d.rows || d.summary || []);
    } catch {
      setRows([]);
      setBanner({ tone: "error", message: t("common.error") });
    } finally {
      setLoading(false);
    }
  }, [listApi, debouncedQ, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    animateIn(pageRef.current, { y: 18 });
  }, []);

  useEffect(() => {
    if (!loading && tableRef.current) {
      animateStagger(tableRef.current.querySelectorAll("tr"));
    }
  }, [loading, rows]);

  async function saveRecord(data: Record<string, unknown>) {
    if (!crud) return;
    setSaving(true);
    setBanner(null);
    try {
      const res = editing?._id
        ? await fetch(itemUrl(crud, String(editing._id)), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          })
        : await fetch(postUrl(crud), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({
          tone: "error",
          message:
            json.error === "missing_customer"
              ? locale === "bn"
                ? "গ্রাহক নির্বাচন করুন"
                : "Please select a customer"
              : t("common.error"),
        });
        return;
      }

      setFormOpen(false);
      setEditing(null);
      setBanner({
        tone: "success",
        message: editing
          ? locale === "bn"
            ? "আপডেট হয়েছে"
            : "Updated successfully"
          : locale === "bn"
            ? "যোগ হয়েছে"
            : "Added successfully",
      });
      await load();
    } catch {
      setBanner({ tone: "error", message: t("common.error") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(row: Record<string, unknown>) {
    if (!crud || !row._id) return;
    const msg = locale === "bn" ? "এই রেকর্ড মুছে ফেলবেন?" : "Delete this record?";
    if (!confirm(msg)) return;
    setBanner(null);
    const res = await fetch(itemUrl(crud, String(row._id)), { method: "DELETE" });
    if (!res.ok) {
      setBanner({ tone: "error", message: t("common.error") });
      return;
    }
    setBanner({
      tone: "success",
      message: locale === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted successfully",
    });
    await load();
  }

  if (!mod) {
    return <EmptyState message={t("common.noData")} />;
  }

  const title = locale === "bn" ? mod.titleBn : mod.titleEn;
  const readOnly = isReadOnlyModule(moduleId);
  const showCrud = crud && !readOnly;
  const hasInvoiceCol = moduleId !== "sell-returns" && mod.columns.some((c) => c.key === "invoiceNo");
  const statementModules = new Set(["customers", "suppliers"]);
  const canOpenStatement = statementModules.has(moduleId);
  const showActions = showCrud || hasInvoiceCol || canOpenStatement;

  return (
    <div ref={pageRef} className="gp-desk">
      <PageHeader
        kicker={locale === "bn" ? "মডিউল" : "Module"}
        title={title}
        subtitle={t("reports.drillHint")}
        stats={[{ value: rows.length, label: locale === "bn" ? "রেকর্ড" : "records" }]}
        actions={
          <>
            {showCrud && crud.canCreate ? (
              moduleId === "sell-returns" ? (
                <Link href="/sales/returns/add" className="gp-btn gp-btn-primary">
                  <Plus className="h-5 w-5" />
                  {t("common.add")}
                </Link>
              ) : (
              <button
                type="button"
                className="gp-btn gp-btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-5 w-5" />
                {t("common.add")}
              </button>
              )
            ) : null}
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => window.print()}>
              <Download className="h-5 w-5" />
              {t("common.exportPdf")}
            </button>
          </>
        }
      />

      {banner ? (
        <AlertBanner tone={banner.tone} message={banner.message} onClose={() => setBanner(null)} />
      ) : null}

      <FilterBar>
        <Field label={t("common.search")}>
          <input
            className="gp-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common.search")}
          />
        </Field>
        <Field label={t("dashboard.fromDate")}>
          <input type="date" className="gp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("dashboard.toDate")}>
          <input type="date" className="gp-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <button type="button" className="gp-btn gp-btn-primary w-full" onClick={load}>
            {t("dashboard.apply")}
          </button>
        </div>
      </FilterBar>

      <div className="gp-table-wrap overflow-auto">
        {loading && rows.length === 0 ? (
          <TableSkeleton rows={6} cols={mod.columns.length + (showActions ? 1 : 0)} />
        ) : rows.length === 0 ? (
          <EmptyState message={debouncedQ ? (locale === "bn" ? "কোনো ফলাফল নেই" : "No matching records") : t("common.noData")} />
        ) : (
          <table className="gp-table">
            <thead>
              <tr>
                {mod.columns.map((c) => (
                  <th key={c.key}>{locale === "bn" ? c.labelBn : c.labelEn}</th>
                ))}
                {showActions ? <th>{t("common.actions")}</th> : null}
              </tr>
            </thead>
            <tbody ref={tableRef} className={loading ? "opacity-60" : undefined}>
              {rows.map((row, i) => {
                const rowId = String(row._id || row.id || "");
                const showInvoice = hasInvoiceCol && !!rowId && !!row.invoiceNo;
                return (
                  <tr key={rowId || String(i)}>
                    {mod.columns.map((c) => (
                      <td key={c.key} className={c.format === "money" ? "font-semibold" : ""}>
                        {c.key === "invoiceNo" && showInvoice ? (
                          <a
                            href={`/sales/${rowId}/invoice`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {cellValue(row, c.key, c.format, locale)}
                          </a>
                        ) : canOpenStatement && (c.key === "name" || c.key === "nameBn") && rowId ? (
                          <Link
                            href={`/contacts/${rowId}/statement`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {cellValue(row, c.key, c.format, locale)}
                          </Link>
                        ) : (
                          cellValue(row, c.key, c.format, locale)
                        )}
                      </td>
                    ))}
                    {showActions ? (
                      <td>
                        <div className="flex flex-nowrap items-center gap-1">
                          {canOpenStatement && rowId ? (
                            <Link
                              href={`/contacts/${rowId}/statement`}
                              className="gp-btn gp-btn-ghost px-2"
                              title={locale === "bn" ? "স্টেটমেন্ট" : "Statement"}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                          {showInvoice ? <InvoiceActions saleId={rowId} compact /> : null}
                          {showCrud && crud.canUpdate ? (
                            moduleId === "sell-returns" && rowId ? (
                              <Link
                                href={`/sales/returns/${rowId}`}
                                className="gp-btn gp-btn-ghost px-2"
                                title={t("common.edit")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            ) : (
                            <button
                              type="button"
                              className="gp-btn gp-btn-ghost px-2"
                              onClick={() => {
                                setEditing(row);
                                setFormOpen(true);
                              }}
                              title={t("common.edit")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            )
                          ) : null}
                          {showCrud && crud.canDelete ? (
                            <button
                              type="button"
                              className="gp-btn gp-btn-danger px-2"
                              onClick={() => deleteRecord(row)}
                              title={t("common.delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={formOpen && !!crud}
        title={editing ? t("common.edit") : t("common.add")}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        wide={!!crud && crud.fields.length > 4 && crud.createDefaults?.type !== "supplier"}
        fit={crud?.createDefaults?.type === "supplier"}
      >
        {crud ? (
          <CrudForm
            config={crud}
            initial={editing || undefined}
            isEdit={!!editing}
            saving={saving}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSubmit={saveRecord}
          />
        ) : null}
      </Modal>
    </div>
  );
}
