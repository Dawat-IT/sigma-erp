"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { calendarDateDhaka, formatBDT, formatDateBD } from "@/lib/utils";

type Acc = { _id: string; code: string; name: string; nameBn?: string; type: string; balance?: number };
type Line = { accountId: string; debit: string; credit: string };
type Entry = {
  _id: string;
  entryNo: string;
  entryDate: string;
  memo?: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
  lines: { accountName?: string; debit: number; credit: number }[];
};

const emptyLines = (): Line[] => [
  { accountId: "", debit: "", credit: "" },
  { accountId: "", debit: "", credit: "" },
];

export default function JournalsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [rows, setRows] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [memo, setMemo] = useState("");
  const [entryDate, setEntryDate] = useState(() => calendarDateDhaka());
  const [lines, setLines] = useState<Line[]>(emptyLines());
  const [postNow, setPostNow] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([
        fetch("/api/journals?limit=100").then((r) => r.json()),
        fetch("/api/ledger-accounts").then((r) => r.json()),
      ]);
      setRows(j.data || []);
      setAccounts(a.data || []);
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
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memo,
          entryDate,
          post: postNow,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          json.error === "unbalanced"
            ? locale === "bn"
              ? "ডেবিট ও ক্রেডিট সমান হতে হবে"
              : "Debits must equal credits"
            : t("common.error"),
        );
        return;
      }
      setOpen(false);
      setMemo("");
      setLines(emptyLines());
      await load();
      setMsg(locale === "bn" ? "জার্নাল এন্ট্রি সংরক্ষিত" : "Journal entry saved");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function postDraft(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/journals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, post: true }),
      });
      if (!res.ok) throw new Error("fail");
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
        title={locale === "bn" ? "জার্নাল এন্ট্রি" : "Journal entries"}
        subtitle={locale === "bn" ? "ডেবিট/ক্রেডিট পোস্টিং" : "Debit / credit posting"}
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
        <EmptyState message={t("common.noData")} />
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{locale === "bn" ? "নং" : "No"}</th>
                <th>{locale === "bn" ? "তারিখ" : "Date"}</th>
                <th>{locale === "bn" ? "বিবরণ" : "Memo"}</th>
                <th>{locale === "bn" ? "ডেবিট" : "Debit"}</th>
                <th>{locale === "bn" ? "ক্রেডিট" : "Credit"}</th>
                <th>{locale === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td className="font-semibold">{r.entryNo}</td>
                  <td>{formatDateBD(r.entryDate, locale)}</td>
                  <td>{r.memo || "—"}</td>
                  <td className="gp-money">{formatBDT(r.totalDebit, locale)}</td>
                  <td className="gp-money">{formatBDT(r.totalCredit, locale)}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.status === "draft" ? (
                      <button
                        type="button"
                        className="gp-btn gp-btn-ghost min-h-9 px-2.5"
                        disabled={busy}
                        onClick={() => postDraft(r._id)}
                      >
                        {locale === "bn" ? "পোস্ট" : "Post"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title={locale === "bn" ? "নতুন জার্নাল" : "New journal"} onClose={() => setOpen(false)} wide>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={locale === "bn" ? "তারিখ" : "Date"}>
              <input type="date" className="gp-input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
            <Field label={locale === "bn" ? "বিবরণ" : "Memo"}>
              <input className="gp-input" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </Field>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <Field label={locale === "bn" ? "হিসাব" : "Account"}>
                <select
                  className="gp-input"
                  required
                  value={line.accountId}
                  onChange={(e) =>
                    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, accountId: e.target.value } : l)))
                  }
                >
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={locale === "bn" ? "ডেবিট" : "Debit"}>
                <input
                  type="number"
                  min={0}
                  className="gp-input"
                  value={line.debit}
                  onChange={(e) =>
                    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, debit: e.target.value } : l)))
                  }
                />
              </Field>
              <Field label={locale === "bn" ? "ক্রেডিট" : "Credit"}>
                <input
                  type="number"
                  min={0}
                  className="gp-input"
                  value={line.credit}
                  onChange={(e) =>
                    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, credit: e.target.value } : l)))
                  }
                />
              </Field>
            </div>
          ))}
          <button
            type="button"
            className="gp-btn gp-btn-ghost"
            onClick={() => setLines((prev) => [...prev, { accountId: "", debit: "", credit: "" }])}
          >
            + {locale === "bn" ? "লাইন" : "Line"}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={postNow} onChange={(e) => setPostNow(e.target.checked)} />
            {locale === "bn" ? "এখনই পোস্ট করুন" : "Post immediately"}
          </label>
          <div className="flex justify-end gap-2">
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
