"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { calendarDateDhaka, formatBDT, formatDateBD } from "@/lib/utils";

type Acc = { _id: string; code: string; name: string };
type Party = { _id: string; name: string };
type Entry = {
  _id: string;
  entryNo: string;
  entryDate: string;
  memo?: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
};

export function JournalPaymentPage({
  kind,
}: {
  kind: "customer" | "supplier";
}) {
  const t = useTranslations();
  const locale = useLocale();
  const isCustomer = kind === "customer";
  const title = isCustomer
    ? locale === "bn" ? "কাস্টমার পেমেন্ট" : "Customer Payment"
    : locale === "bn" ? "সাপ্লায়ার পেমেন্ট" : "Supplier Payment";
  const memoPrefix = isCustomer ? "Customer Payment" : "Supplier Payment";

  const [rows, setRows] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [entryDate, setEntryDate] = useState(() => calendarDateDhaka());
  const [memo, setMemo] = useState(memoPrefix);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const partyType = isCustomer ? "customer" : "supplier";
      const [j, a, p] = await Promise.all([
        fetch("/api/journals?limit=100").then((r) => r.json()),
        fetch("/api/ledger-accounts").then((r) => r.json()),
        fetch(`/api/contacts?type=${partyType}&limit=200`).then((r) => r.json()),
      ]);
      const all = (j.data || []) as Entry[];
      setRows(all.filter((row) => String(row.memo || "").startsWith(memoPrefix)));
      setAccounts(a.data || []);
      setParties(p.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [isCustomer, memoPrefix, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const partyName = useMemo(
    () => parties.find((p) => p._id === partyId)?.name || "",
    [parties, partyId],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount || 0);
    if (value <= 0 || !debitAccountId || !creditAccountId || debitAccountId === creditAccountId) {
      setMsg(locale === "bn" ? "হিসাব ও পরিমাণ সঠিকভাবে দিন" : "Select two different accounts and a valid amount");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memo: `${memoPrefix}${partyName ? ` — ${partyName}` : ""}${memo && memo !== memoPrefix ? ` — ${memo}` : ""}`.trim(),
          entryDate,
          post: true,
          lines: [
            { accountId: debitAccountId, debit: value, credit: 0 },
            { accountId: creditAccountId, debit: 0, credit: value },
          ],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          json.error === "unbalanced"
            ? locale === "bn" ? "ডেবিট ও ক্রেডিট সমান হতে হবে" : "Debits must equal credits"
            : t("common.error"),
        );
        return;
      }
      setOpen(false);
      setAmount("");
      setPartyId("");
      setMemo(memoPrefix);
      await load();
      setMsg(locale === "bn" ? "পেমেন্ট সংরক্ষিত" : "Payment saved");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={title}
        subtitle={locale === "bn" ? "জার্নাল এন্ট্রি পেমেন্ট" : "Journal entry payment"}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title={title} onClose={() => setOpen(false)} wide>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={locale === "bn" ? "তারিখ" : "Date"}>
              <input type="date" className="gp-input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
            <Field label={isCustomer ? (locale === "bn" ? "গ্রাহক" : "Customer") : (locale === "bn" ? "সরবরাহকারী" : "Supplier")}>
              <select className="gp-input" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">—</option>
                {parties.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label={locale === "bn" ? "পরিমাণ" : "Amount"}>
              <input type="number" min={0} step="0.01" className="gp-input" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label={locale === "bn" ? "বিবরণ" : "Memo"}>
              <input className="gp-input" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </Field>
            <Field label={locale === "bn" ? "ডেবিট হিসাব" : "Debit account"}>
              <select className="gp-input" required value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)}>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </Field>
            <Field label={locale === "bn" ? "ক্রেডিট হিসাব" : "Credit account"}>
              <select className="gp-input" required value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)}>
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </Field>
          </div>
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
