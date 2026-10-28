"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { docsCount, EMPLOYEE_WORK_TYPES, workTypeLabel } from "@/lib/employee-profile";
import { computePayrollTotals, hasSalarySetup, snapshotFromEmployee } from "@/lib/payroll";

type Employee = {
  _id: string;
  name: string;
  nameBn?: string;
  mobile?: string;
  email?: string;
  address?: string;
  designation?: string;
  department?: string;
  basicSalary?: number;
  houseRent?: number;
  medical?: number;
  conveyance?: number;
  incentive?: number;
  campaign?: number;
  yearlyCollection?: number;
  nid?: string;
  joinDate?: string;
  workType?: string;
  speciality?: string;
  nidFrontUrl?: string;
  nidBackUrl?: string;
  certificates?: { title?: string; url: string }[];
};

type Scope = "all" | "payroll" | "field" | "office" | "gap";
type FormState = {
  name: string;
  nameBn: string;
  mobile: string;
  nid: string;
  designation: string;
  department: string;
  joinDate: string;
  workType: string;
  speciality: string;
  basicSalary: string;
};

const emptyForm: FormState = {
  name: "",
  nameBn: "",
  mobile: "",
  nid: "",
  designation: "",
  department: "",
  joinDate: "",
  workType: "office",
  speciality: "",
  basicSalary: "0",
};

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "EM";
}

function moneyShort(n: number, locale: string) {
  return formatBDT(n, locale).replace(/\.00$/, "");
}

function displayName(row: Employee, bn: boolean) {
  return bn && row.nameBn ? row.nameBn : row.name;
}

function monthlyGross(row: Employee) {
  return computePayrollTotals(snapshotFromEmployee(row)).grossPay;
}

function workOf(row: Employee) {
  return row.workType || (row.department === "Service" ? "field" : "office");
}

function isGap(row: Employee) {
  return !String(row.nid || "").trim() || !hasSalarySetup(row);
}

function cardTone(row: Employee) {
  if (isGap(row)) return "is-warn";
  if (workOf(row) === "field") return "is-info";
  return "is-ok";
}

export default function EmployeesPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  const [rows, setRows] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [dept, setDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contacts?type=employee&limit=200");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load");
      setRows(json.data || []);
      setError("");
    } catch {
      setRows([]);
      setError(bn ? "কর্মচারী লোড হয়নি।" : "Could not load employees.");
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
    setEditing(null);
    setForm(emptyForm);
    setNotice("");
    setOpen(true);
  }

  function openEdit(row: Employee) {
    setEditing(row);
    setForm({
      name: row.name || "",
      nameBn: row.nameBn || "",
      mobile: row.mobile || "",
      nid: row.nid || "",
      designation: row.designation || "",
      department: row.department || "",
      joinDate: row.joinDate ? String(row.joinDate).slice(0, 10) : "",
      workType: workOf(row),
      speciality: row.speciality || "",
      basicSalary: String(row.basicSalary ?? 0),
    });
    setNotice("");
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim() || !form.nid.trim()) {
      setError(bn ? "নাম, মোবাইল ও NID আবশ্যক।" : "Name, mobile and NID are required.");
      return;
    }
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = {
      ...(editing || {}),
      type: "employee",
      name: form.name.trim(),
      nameBn: form.nameBn.trim(),
      mobile: form.mobile.trim(),
      nid: form.nid.trim(),
      designation: form.designation.trim(),
      department: form.department.trim(),
      joinDate: form.joinDate || undefined,
      workType: form.workType,
      speciality: form.speciality.trim(),
      basicSalary: Number(form.basicSalary || 0),
    };
    if (!editing) payload.balance = 0;
    try {
      const res = await fetch(editing ? `/api/contacts/${editing._id}` : "/api/contacts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "fail");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setNotice(bn ? (editing ? "আপডেট হয়েছে।" : "কর্মচারী যোগ হয়েছে।") : editing ? "Employee updated." : "Employee added.");
      await load();
    } catch {
      setError(bn ? "সেভ হয়নি।" : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(bn ? "কর্মচারী মুছবেন?" : "Delete this employee?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("fail");
      setNotice(bn ? "মুছে ফেলা হয়েছে।" : "Employee deleted.");
      await load();
    } catch {
      setError(bn ? "মুছা যায়নি।" : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  const depts = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const d = String(row.department || "").trim();
      if (d) set.add(d);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const work = workOf(row);
      if (dept && String(row.department || "") !== dept) return false;
      if (scope === "payroll" && !hasSalarySetup(row)) return false;
      if (scope === "field" && work === "office") return false;
      if (scope === "office" && work === "field") return false;
      if (scope === "gap" && !isGap(row)) return false;
      if (!needle) return true;
      return [row.name, row.nameBn, row.mobile, row.nid, row.designation, row.department, row.speciality]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [dept, rows, scope, search]);

  const payrollN = rows.filter((r) => hasSalarySetup(r)).length;
  const fieldN = rows.filter((r) => workOf(r) !== "office").length;
  const officeN = rows.filter((r) => workOf(r) === "office").length;
  const gapN = rows.filter(isGap).length;
  const payrollTotal = rows.reduce((n, r) => n + monthlyGross(r), 0);

  const pills: { id: Scope; en: string; bn: string; n: number }[] = [
    { id: "all", en: "All staff", bn: "সব স্টাফ", n: rows.length },
    { id: "payroll", en: "On payroll", bn: "পে-রোল", n: payrollN },
    { id: "field", en: "Field", bn: "ফিল্ড", n: fieldN },
    { id: "office", en: "Office", bn: "অফিস", n: officeN },
    { id: "gap", en: "Incomplete", bn: "অসম্পূর্ণ", n: gapN },
  ];

  return (
    <div className="gp-desk quote-desk">
      <PageHeader
        kicker={bn ? "এইচআর ও পে-রোল" : "HR & payroll"}
        title={bn ? "কর্মচারী" : "Employees"}
        subtitle={bn
          ? "স্যালারি মাস্টার, ফিল্ড/অফিস ও পেস্লিপ — এক স্ক্রিনে।"
          : "Salary master, field/office and payslips — one screen."}
        stats={[
          { value: rows.length, label: bn ? "স্টাফ" : "staff" },
          { value: payrollN, label: bn ? "পে-রোল" : "payroll" },
          { value: fieldN, label: bn ? "ফিল্ড" : "field" },
          { value: moneyShort(payrollTotal, locale), label: bn ? "গ্রস" : "gross" },
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
              placeholder={bn ? "নাম / মোবাইল / NID" : "Name / mobile / NID"}
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
            <button key={pill.id} type="button" className={scope === pill.id ? "on" : ""} onClick={() => setScope(pill.id)}>
              {bn ? pill.bn : pill.en} <em>({pill.n})</em>
            </button>
          ))}
        </div>
        <Link href="/hr/leaves" className="gp-btn gp-btn-ghost">{bn ? "ছুটি" : "Leaves"}</Link>
        <Link href="/hr/attendance" className="gp-btn gp-btn-ghost">{bn ? "হাজিরা" : "Attendance"}</Link>
        <Link href="/hr/payroll" className="gp-btn gp-btn-ghost">{bn ? "পে-রোল" : "Payroll"}</Link>
      </div>

      <div className="fu-views">
        <button type="button" className={dept === "" ? "on" : ""} onClick={() => setDept("")}>
          {bn ? "সব বিভাগ" : "All depts"}
        </button>
        {depts.map((d) => (
          <button key={d} type="button" className={dept === d ? "on" : ""} onClick={() => setDept(d)}>
            {d}
            <em>{rows.filter((r) => r.department === d).length}</em>
          </button>
        ))}
      </div>

      {error ? <p className="fu-filter-note" style={{ color: "var(--gp-danger)" }}>{error}</p> : null}
      {notice ? <p className="fu-filter-note">{notice}</p> : null}

      <div className="quote-board">
        {open ? (
          <form onSubmit={onSubmit} className="eq-add-panel amc-new">
            <b>{editing ? (bn ? "এডিট" : "Edit") : bn ? "নতুন কর্মচারী" : "New employee"}</b>
            <div className="eq-add-fields">
              <Field label={bn ? "নাম" : "Name"}>
                <input required className="gp-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={bn ? "নাম (বাংলা)" : "Name (Bangla)"}>
                <input className="gp-input" value={form.nameBn} onChange={(e) => setForm({ ...form, nameBn: e.target.value })} />
              </Field>
              <Field label={bn ? "মোবাইল" : "Mobile"}>
                <input required className="gp-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </Field>
              <Field label="NID">
                <input required className="gp-input" value={form.nid} onChange={(e) => setForm({ ...form, nid: e.target.value })} />
              </Field>
              <Field label={bn ? "পদবি" : "Role"}>
                <input className="gp-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </Field>
              <Field label={bn ? "বিভাগ" : "Department"}>
                <input className="gp-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </Field>
              <Field label={bn ? "ওয়ার্ক টাইপ" : "Work type"}>
                <select className="gp-input" value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })}>
                  {EMPLOYEE_WORK_TYPES.map((row) => (
                    <option key={row.id} value={row.id}>{bn ? row.bn : row.en}</option>
                  ))}
                </select>
              </Field>
              <Field label={bn ? "দক্ষতা" : "Speciality"}>
                <input className="gp-input" value={form.speciality} onChange={(e) => setForm({ ...form, speciality: e.target.value })} placeholder={bn ? "লিফট / অ্যাকাউন্টস" : "Lift / accounts"} />
              </Field>
              <Field label={bn ? "জয়েন" : "Joined"}>
                <input type="date" className="gp-input" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
              </Field>
              <Field label={bn ? "বেসিক স্যালারি" : "Basic salary"}>
                <input type="number" min={0} className="gp-input" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
              </Field>
            </div>
            <div className="amc-new-actions">
              <button type="button" className="gp-btn" onClick={() => { setOpen(false); setEditing(null); }}>{bn ? "বাতিল" : "Cancel"}</button>
              {editing ? <Link href={`/contacts/employees/${editing._id}`} className="gp-btn">{bn ? "প্রোফাইল" : "Profile"}</Link> : null}
              <button type="submit" disabled={busy} className="gp-btn gp-btn-primary">
                {busy ? (bn ? "সেভ হচ্ছে..." : "Saving...") : bn ? "সেভ" : "Save"}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-muted">{bn ? "লোড হচ্ছে..." : "Loading..."}</p> : null}
        {!loading && filtered.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title={bn ? "কর্মচারী নেই" : "No employees"}
              message={
                rows.length === 0
                  ? (bn ? "ডেমো ডেটা লোড করুন, অথবা নতুন স্টাফ যোগ করুন।" : "Load demo data, or add staff.")
                  : (bn ? "এই ফিল্টারে কেউ নেই।" : "Nobody in this filter.")
              }
            />
            {rows.length === 0 ? (
              <button
                type="button"
                className="gp-btn gp-btn-primary"
                disabled={seeding}
                onClick={() => {
                  setSeeding(true);
                  void fetch("/api/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
                    .then((res) => {
                      if (!res.ok) throw new Error("seed");
                      return load();
                    })
                    .catch(() => setError(bn ? "ডেমো ডেটা লোড হয়নি।" : "Could not load demo data."))
                    .finally(() => setSeeding(false));
                }}
              >
                {seeding ? (bn ? "লোড হচ্ছে..." : "Loading...") : bn ? "ডেমো ডেটা লোড করুন" : "Load demo data"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="fu-list">
          {filtered.map((row) => {
            const tone = cardTone(row);
            const href = `/contacts/employees/${row._id}`;
            const files = docsCount(row);
            const gross = monthlyGross(row);
            return (
              <article key={row._id} className={`fu-card ${tone}`}>
                <div className="fu-card-top">
                  <span className="fu-avatar">{initials(displayName(row, bn))}</span>
                  <div className="min-w-0 flex-1">
                    <strong>
                      <Link href={href}>{displayName(row, bn)}</Link>
                    </strong>
                    <p>
                      {row.designation || (bn ? "পদবি নেই" : "No role")}
                      {row.department ? ` · ${row.department}` : ""}
                      {row.mobile ? ` · ${row.mobile}` : ""}
                    </p>
                  </div>
                  <span className={`fu-chip ${tone}`}>
                    {hasSalarySetup(row) ? moneyShort(gross, locale) : bn ? "স্যালারি নেই" : "No salary"}
                  </span>
                </div>
                <div className="fu-card-foot">
                  <p className="fu-meta">
                    {workTypeLabel(workOf(row), bn) || (bn ? "অফিস" : "Office")}
                    {row.speciality ? ` · ${row.speciality}` : ""}
                    {row.joinDate ? ` · ${formatDateBD(row.joinDate, locale)}` : ""}
                    {row.nid ? ` · NID ${row.nid}` : ` · ${bn ? "NID নেই" : "No NID"}`}
                    {files ? ` · ${files} ${bn ? "ফাইল" : "files"}` : ""}
                  </p>
                  <Link className="fld-act" href={href}>{bn ? "স্যালারি" : "Salary"}</Link>
                  <button type="button" className="fld-act" onClick={() => openEdit(row)}>{bn ? "এডিট" : "Edit"}</button>
                  <button type="button" className="fld-act" disabled={busy} onClick={() => void onDelete(row._id)}>{bn ? "মুছুন" : "Delete"}</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
