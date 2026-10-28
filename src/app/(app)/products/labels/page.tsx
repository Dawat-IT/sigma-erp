"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, Field, PageHeader, TableSkeleton } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks";

type Product = {
  _id: string;
  name: string;
  nameBn?: string;
  sku: string;
  sellPrice: number;
  barcode?: string;
};

export default function PrintLabelsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [rows, setRows] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100" });
    if (debouncedQ) qs.set("q", debouncedQ);
    const res = await fetch(`/api/products?${qs}`);
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  }, [debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const picked = rows.filter((r) => selected[r._id]);

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "লেবেল প্রিন্ট" : "Print Labels"}
        subtitle={
          locale === "bn"
            ? "পণ্য সিলেক্ট করে লেবেল প্রিন্ট করুন"
            : "Select products and print price labels"
        }
        actions={
          <button
            type="button"
            className="gp-btn gp-btn-primary"
            disabled={!picked.length}
            onClick={() => window.print()}
          >
            {t("common.print")}
          </button>
        }
      />

      <div className="gp-card mb-4 p-3.5 no-print">
        <Field label={t("common.search")}>
          <input className="gp-input" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="no-print">
          {loading && !rows.length ? (
            <TableSkeleton rows={6} cols={3} />
          ) : rows.length === 0 ? (
            <EmptyState message={t("common.noData")} />
          ) : (
            <div className="gp-table-wrap overflow-auto">
              <table className="gp-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t("products.name")}</th>
                    <th>{t("products.sku")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[p._id]}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [p._id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td>{locale === "bn" && p.nameBn ? p.nameBn : p.name}</td>
                      <td>{p.sku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 print:grid-cols-3">
          {picked.length === 0 ? (
            <div className="col-span-2 no-print">
              <EmptyState
                message={
                  locale === "bn" ? "লেবেলের জন্য পণ্য সিলেক্ট করুন" : "Select products for labels"
                }
              />
            </div>
          ) : (
            picked.map((p) => (
              <div
                key={p._id}
                className="rounded-lg border border-line bg-white p-3 text-center shadow-sm"
              >
                <p className="text-sm font-bold leading-tight">
                  {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">{p.sku}</p>
                <p className="gp-money mt-2 text-lg font-bold">{formatBDT(p.sellPrice, locale)}</p>
                <p className="mt-1 font-mono text-[0.65rem] tracking-widest">
                  *{p.barcode || p.sku}*
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
