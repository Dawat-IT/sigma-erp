"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { EmptyState, Field, PageHeader } from "@/components/ui";

type AttendanceRow = {
  _id: string;
  employeeId: string;
  employeeName?: string;
  dateKey: string;
  punchIn?: string;
  punchOut?: string;
  minutes?: number;
  status: string;
  source?: string;
};

type Employee = { _id: string; name: string; nameBn?: string };

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeValue(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HrAttendancePage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [dateKey, setDateKey] = useState(todayKey());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    employeeId: "",
    punchIn: "08:00",
    punchOut: "17:00",
    status: "present",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([
        fetch(`/api/hr/attendance?date=${dateKey}`).then((r) => r.json()),
        fetch("/api/contacts?type=employee&limit=200").then((r) => r.json()),
      ]);
      setRows(a.data || []);
      setEmployees(e.data || []);
      setMsg("");
    } catch {
      setMsg(bn ? "লোড হয়নি" : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [dateKey, bn]);

  useEffect(() => {
    void load();
  }, [load]);

  const marked = useMemo(() => new Set(rows.map((r) => String(r.employeeId))), [rows]);
  const missing = employees.filter((e) => !marked.has(e._id));

  async function saveRow(payload: Record<string, unknown>) {
    setBusy(String(payload.employeeId || "new"));
    try {
      const res = await fetch("/api/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      await load();
    } catch {
      setMsg(bn ? "সেভ হয়নি" : "Could not save");
    } finally {
      setBusy("");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await saveRow({
      employeeId: form.employeeId,
      dateKey,
      punchIn: form.punchIn ? `${dateKey}T${form.punchIn}:00` : undefined,
      punchOut: form.punchOut ? `${dateKey}T${form.punchOut}:00` : undefined,
      status: form.status,
      source: "office",
    });
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={bn ? "হাজিরা" : "Attendance"}
        subtitle={bn ? "প্রতিদিনের পাঞ্চ-ইন / পাঞ্চ-আউট ও অনুপস্থিতি।" : "Daily punch in/out and absences."}
        actions={
          <Link href="/hr/leaves" className="gp-btn gp-btn-ghost">
            {bn ? "ছুটি" : "Leaves"}
          </Link>
        }
      />
      {msg ? <p className="mb-3 text-sm text-red-600">{msg}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label={bn ? "তারিখ" : "Date"}>
          <input type="date" className="gp-input" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
        </Field>
        <p className="text-sm text-muted">
          {bn ? "মার্কড" : "Marked"}: {rows.length} · {bn ? "বাকি" : "Missing"}: {missing.length}
        </p>
      </div>

      <form onSubmit={onSubmit} className="gp-card mb-5 grid gap-3 p-4 sm:grid-cols-5">
        <Field label={bn ? "কর্মচারী" : "Employee"}>
          <select
            required
            className="gp-input"
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          >
            <option value="">{bn ? "বেছে নিন" : "Select"}</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {bn && emp.nameBn ? emp.nameBn : emp.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={bn ? "ইন" : "In"}>
          <input type="time" className="gp-input" value={form.punchIn} onChange={(e) => setForm({ ...form, punchIn: e.target.value })} />
        </Field>
        <Field label={bn ? "আউট" : "Out"}>
          <input type="time" className="gp-input" value={form.punchOut} onChange={(e) => setForm({ ...form, punchOut: e.target.value })} />
        </Field>
        <Field label={bn ? "স্ট্যাটাস" : "Status"}>
          <select className="gp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="present">{bn ? "উপস্থিত" : "Present"}</option>
            <option value="absent">{bn ? "অনুপস্থিত" : "Absent"}</option>
            <option value="leave">{bn ? "ছুটি" : "Leave"}</option>
            <option value="half_day">{bn ? "হাফ ডে" : "Half day"}</option>
            <option value="holiday">{bn ? "ছুটির দিন" : "Holiday"}</option>
          </select>
        </Field>
        <div className="flex items-end">
          <button type="submit" className="gp-btn gp-btn-primary w-full" disabled={!!busy}>
            {bn ? "মার্ক" : "Mark"}
          </button>
        </div>
      </form>

      {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
      {!loading && rows.length === 0 ? <EmptyState message={bn ? "এই দিনে হাজিরা নেই" : "No attendance for this day"} /> : null}
      {!loading && rows.length ? (
        <div className="gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "কর্মচারী" : "Employee"}</th>
                <th>{bn ? "ইন" : "In"}</th>
                <th>{bn ? "আউট" : "Out"}</th>
                <th>{bn ? "মিনিট" : "Minutes"}</th>
                <th>{bn ? "স্ট্যাটাস" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>
                    <Link href={`/contacts/employees/${row.employeeId}`} className="font-semibold text-primary hover:underline">
                      {row.employeeName || "—"}
                    </Link>
                    <p className="text-xs text-muted">{row.source || "office"}</p>
                  </td>
                  <td>{timeValue(row.punchIn) || "—"}</td>
                  <td>{timeValue(row.punchOut) || "—"}</td>
                  <td>{row.minutes || 0}</td>
                  <td className="capitalize">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
