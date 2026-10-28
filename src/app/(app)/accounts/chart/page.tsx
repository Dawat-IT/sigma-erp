"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";

type Acc = {
  _id: string;
  code: string;
  name: string;
  nameBn?: string;
  type: string;
  balance?: number;
};

const TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

export default function ChartOfAccountsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [rows, setRows] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    nameBn: "",
    type: "income",
    openingBalance: "0",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ledger-accounts");
      const json = await res.json();
      setRows(json.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/ledger-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          openingBalance: Number(form.openingBalance || 0),
        }),
      });
      if (!res.ok) throw new Error("fail");
      setOpen(false);
      setForm({ code: "", name: "", nameBn: "", type: "income", openingBalance: "0" });
      await load();
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "চার্ট অব অ্যাকাউন্টস" : "Chart of accounts"}
        subtitle={locale === "bn" ? "পণ্য অ্যাকাউন্টিং ম্যাপিংয়ের জন্য" : "For product accounting mapping"}
        actions={
          <button type="button" className="gp-btn gp-btn-primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("common.add")}
          </button>
        }
      />
      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {msg}
        </p>
      ) : null}
      {loading ? (
        <EmptyState message={t("app.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            locale === "bn"
              ? "কোনো হিসাব নেই — সিড রান করুন বা নতুন যোগ করুন"
              : "No accounts — run seed or add new"
          }
        />
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{locale === "bn" ? "কোড" : "Code"}</th>
                <th>{locale === "bn" ? "নাম" : "Name"}</th>
                <th>{locale === "bn" ? "ধরন" : "Type"}</th>
                <th>{locale === "bn" ? "ব্যালেন্স" : "Balance"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td className="gp-money">{r.code}</td>
                  <td className="font-semibold">{locale === "bn" && r.nameBn ? r.nameBn : r.name}</td>
                  <td>{r.type}</td>
                  <td className="gp-money">{formatBDT(r.balance || 0, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title={locale === "bn" ? "নতুন হিসাব" : "New account"} onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field label={locale === "bn" ? "কোড" : "Code"}>
            <input
              className="gp-input"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "ধরন" : "Type"}>
            <select
              className="gp-input"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </select>
          </Field>
          <Field label={locale === "bn" ? "নাম" : "Name"}>
            <input
              className="gp-input"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label={locale === "bn" ? "নাম (বাংলা)" : "Name (Bangla)"}>
            <input
              className="gp-input"
              value={form.nameBn}
              onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {t("common.save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
