"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { calendarDateDhaka, formatDateBD } from "@/lib/utils";

type LeaveRow = {
  _id: string;
  employeeId: string;
  employeeName?: string;
  leaveType: string;
  from: string;
  to: string;
  days: number;
  reason?: string;
  status: string;
};

type Employee = { _id: string; name: string; nameBn?: string; nid?: string };
type StatusFilter = "all" | "pending" | "approved" | "rejected";

const TYPES = ["casual", "sick", "annual", "unpaid", "maternity", "paternity"] as const;

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "LV";
}

function typeLabel(type: string, bn: boolean) {
  const map: Record<string, { bn: string; en: string }> = {
    casual: { bn: "নৈমিত্তিক", en: "Casual" },
    sick: { bn: "অসুস্থতা", en: "Sick" },
    annual: { bn: "বার্ষিক", en: "Annual" },
    unpaid: { bn: "বেতনহীন", en: "Unpaid" },
    maternity: { bn: "মাতৃত্ব", en: "Maternity" },
    paternity: { bn: "পিতৃত্ব", en: "Paternity" },
  };
  return map[type] ? (bn ? map[type].bn : map[type].en) : type;
}

function statusLabel(status: string, bn: boolean) {
  if (status === "approved") return bn ? "অ্যাপ্রুভড" : "Approved";
  if (status === "rejected") return bn ? "রিজেক্টেড" : "Rejected";
  return bn ? "পেন্ডিং" : "Pending";
}

function cardTone(status: string) {
  if (status === "approved") return "is-ok";
  if (status === "rejected") return "is-danger";
  return "is-warn";
}

export default function HrLeavesPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [leaveType, setLeaveType] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    leaveType: "casual",
    from: "",
    to: "",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, e] = await Promise.all([
        fetch("/api/hr/leaves").then((r) => r.json()),
        fetch("/api/contacts?type=employee&limit=200").then((r) => r.json()),
      ]);
      setRows(l.data || []);
      setEmployees(e.data || []);
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "ছুটি লোড হয়নি।" : "Could not load leaves.");
    } finally {
      setLoading(false);
    }
  }, [bn]);

  useEffect(() => {
    void load();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [load]);

  function openCreate() {
    const today = calendarDateDhaka();
    setForm({ employeeId: "", leaveType: "casual", from: today, to: today, reason: "" });
    setNotice("");
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.from || !form.to) {
      setError(bn ? "কর্মচারী ও তারিখ আবশ্যক।" : "Employee and dates are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/hr/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setOpen(false);
      setForm({ employeeId: "", leaveType: "casual", from: "", to: "", reason: "" });
      setNotice(bn ? "ছুটি যোগ হয়েছে।" : "Leave added.");
      await load();
    } catch {
      setError(bn ? "সেভ হয়নি।" : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, next: "approved" | "rejected") {
    setDeciding(id);
    try {
      const res = await fetch("/api/hr/leaves", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) throw new Error("fail");
      setNotice(next === "approved" ? (bn ? "অ্যাপ্রুভ হয়েছে।" : "Approved.") : bn ? "রিজেক্ট হয়েছে।" : "Rejected.");
      await load();
    } catch {
      setError(bn ? "আপডেট হয়নি।" : "Could not update.");
    } finally {
      setDeciding("");
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (leaveType && row.leaveType !== leaveType) return false;
      if (!needle) return true;
      return [row.employeeName, row.leaveType, row.reason, row.status]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [leaveType, rows, search, status]);

  const pendingN = rows.filter((r) => r.status === "pending").length;
  const approvedN = rows.filter((r) => r.status === "approved").length;
  const rejectedN = rows.filter((r) => r.status === "rejected").length;
  const daysN = rows.reduce((n, r) => n + Number(r.days || 0), 0);

  const pills: { id: StatusFilter; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All", bn: "সব", n: rows.length },
    { id: "pending", en: "Pending", bn: "পেন্ডিং", n: pendingN },
    { id: "approved", en: "Approved", bn: "অ্যাপ্রুভড", n: approvedN },
    { id: "rejected", en: "Rejected", bn: "রিজেক্টেড", n: rejectedN },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "এইচআর ও পে-রোল" : "HR & payroll"}
        title={bn ? "ছুটি" : "Leaves"}
        subtitle={bn
          ? "আবেদন, অনুমোদন ও হিস্ট্রি — এক স্ক্রিনে।"
          : "Requests, approval and history — one screen."}
        stats={[
          { value: rows.length, label: bn ? "আবেদন" : "requests" },
          { value: pendingN, label: bn ? "পেন্ডিং" : "pending" },
          { value: approvedN, label: bn ? "অ্যাপ্রুভ" : "approved" },
          { value: daysN, label: bn ? "দিন" : "days" },
        ]}
        actions={
          <>
            <input
              className="gp-input desk-hero-search"
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                setQ(value);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => setSearch(value), 200);
              }}
              placeholder={bn ? "নাম / ধরন / কারণ" : "Name / type / reason"}
            />
            <button type="button" className="gp-btn gp-btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {bn ? "নতুন" : "Add"}
            </button>
          </>
        }
      />

      <div className="dash-panel fu-toolbar">
        <div className="fu-pills">
          {pills.map((pill) => (
            <button key={pill.id} type="button" className={status === pill.id ? "on" : ""} onClick={() => setStatus(pill.id)}>
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <Link href="/contacts/employees" className="gp-btn gp-btn-ghost">{bn ? "কর্মচারী" : "Employees"}</Link>
        <Link href="/hr/attendance" className="gp-btn gp-btn-ghost">{bn ? "হাজিরা" : "Attendance"}</Link>
        <Link href="/hr/payroll" className="gp-btn gp-btn-ghost">{bn ? "পে-রোল" : "Payroll"}</Link>
      </div>

      <div className="fu-views">
        <button type="button" className={leaveType === "" ? "on" : ""} onClick={() => setLeaveType("")}>
          {bn ? "সব ধরন" : "All types"}
        </button>
        {TYPES.map((t) => {
          const n = rows.filter((r) => r.leaveType === t).length;
          return (
            <button key={t} type="button" className={leaveType === t ? "on" : ""} onClick={() => setLeaveType(t)}>
              {typeLabel(t, bn)}
              {n ? <em>{n}</em> : null}
            </button>
          );
        })}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}
      {notice ? <p className="fu-filter-note">{notice}</p> : null}

      <div className="quote-board">
        {open ? (
          <form onSubmit={onSubmit} className="eq-add-panel amc-new">
            <b>{bn ? "নতুন ছুটি" : "New leave"}</b>
            <div className="eq-add-fields">
              <Field label={bn ? "কর্মচারী" : "Employee"}>
                <select
                  className="gp-input"
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                >
                  <option value="">{bn ? "বেছে নিন" : "Select"}</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {bn && emp.nameBn ? emp.nameBn : emp.name}
                      {emp.nid ? ` · NID ${emp.nid}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={bn ? "ধরন" : "Type"}>
                <select className="gp-input" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{typeLabel(t, bn)}</option>
                  ))}
                </select>
              </Field>
              <Field label={bn ? "থেকে" : "From"}>
                <input type="date" required className="gp-input" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
              </Field>
              <Field label={bn ? "পর্যন্ত" : "To"}>
                <input type="date" required className="gp-input" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
              </Field>
              <Field label={bn ? "কারণ" : "Reason"} className="span-2">
                <textarea className="gp-input min-h-16" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </Field>
            </div>
            <div className="amc-new-actions">
              <button type="button" className="gp-btn" onClick={() => setOpen(false)}>{bn ? "বাতিল" : "Cancel"}</button>
              <button type="submit" disabled={busy} className="gp-btn gp-btn-primary">
                {busy ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title={bn ? "ছুটি নেই" : "No leaves"}
            message={
              rows.length === 0
                ? (bn ? "নতুন ছুটি আবেদন যোগ করুন।" : "Add a leave request.")
                : (bn ? "এই ফিল্টারে কিছু নেই।" : "Nothing in this filter.")
            }
          />
        ) : null}

        <div className="fu-list">
          {filtered.map((row) => {
            const tone = cardTone(row.status);
            const href = `/contacts/employees/${row.employeeId}`;
            return (
              <article key={row._id} className={`fu-card ${tone}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(row.employeeName || "")}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={href}>{row.employeeName || "—"}</Link>
                    </strong>
                    <p>
                      {typeLabel(row.leaveType, bn)}
                      {` · ${row.days} ${bn ? "দিন" : row.days === 1 ? "day" : "days"}`}
                    </p>
                  </div>
                  <span className={`fu-chip ${tone}`}>{statusLabel(row.status, bn)}</span>
                </div>
                {row.reason ? <p className="fu-note">{row.reason}</p> : null}
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {formatDateBD(row.from, locale)}
                    {` → ${formatDateBD(row.to, locale)}`}
                  </p>
                  <Link className="fld-act" href={href}>{bn ? "প্রোফাইল" : "Profile"}</Link>
                  {row.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        className="fld-act"
                        disabled={deciding === row._id}
                        onClick={() => void decide(row._id, "approved")}
                      >
                        {bn ? "অ্যাপ্রুভ" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="fld-act fu-del"
                        disabled={deciding === row._id}
                        onClick={() => void decide(row._id, "rejected")}
                      >
                        {bn ? "রিজেক্ট" : "Reject"}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
