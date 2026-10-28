"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Banknote, CheckCircle2, Wallet } from "lucide-react";
import { EmptyState, Field, KpiCard, PageHeader } from "@/components/ui";
import { EmployeeDocsFields, type EmployeeDocsValue } from "@/components/EmployeeDocsFields";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { docsCount, EMPLOYEE_WORK_TYPES, workSpecialistLabel } from "@/lib/employee-profile";
import { computePayrollTotals, snapshotFromEmployee } from "@/lib/payroll";

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
  joinDate?: string;
  nid?: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  presentAddress?: string;
  permanentAddress?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  bankName?: string;
  bankAccount?: string;
  workType?: string;
  speciality?: string;
  nidFrontUrl?: string;
  nidBackUrl?: string;
  certificates?: { title?: string; url: string; at?: string }[];
};

type Slip = {
  _id: string;
  slipNo: string;
  periodKey?: string;
  periodLabel?: string;
  netPay: number;
  status: string;
  paidAt?: string;
  createdAt?: string;
};

export default function EmployeeSalaryPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const [emp, setEmp] = useState<Employee | null>(null);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    nameBn: "",
    mobile: "",
    email: "",
    address: "",
    designation: "",
    department: "",
    basicSalary: "0",
    houseRent: "0",
    medical: "0",
    conveyance: "0",
    incentive: "0",
    campaign: "0",
    yearlyCollection: "0",
    nid: "",
    fatherName: "",
    motherName: "",
    dateOfBirth: "",
    gender: "male",
    bloodGroup: "",
    presentAddress: "",
    permanentAddress: "",
    emergencyName: "",
    emergencyPhone: "",
    bankName: "",
    bankAccount: "",
    joinDate: "",
    workType: "office",
    speciality: "",
  });
  const [docs, setDocs] = useState<EmployeeDocsValue>({ nidFrontUrl: "", nidBackUrl: "", certificates: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        fetch(`/api/contacts/${id}`).then((r) => r.json()),
        fetch(`/api/payslips?employeeId=${id}&limit=200`).then((r) => r.json()),
      ]);
      if (c.error) throw new Error(c.error);
      setEmp(c.data);
      setForm({
        name: c.data?.name || "",
        nameBn: c.data?.nameBn || "",
        mobile: c.data?.mobile || "",
        email: c.data?.email || "",
        address: c.data?.address || "",
        designation: c.data?.designation || "",
        department: c.data?.department || "",
        basicSalary: String(c.data?.basicSalary ?? 0),
        houseRent: String(c.data?.houseRent ?? 0),
        medical: String(c.data?.medical ?? 0),
        conveyance: String(c.data?.conveyance ?? 0),
        incentive: String(c.data?.incentive ?? 0),
        campaign: String(c.data?.campaign ?? 0),
        yearlyCollection: String(c.data?.yearlyCollection ?? 0),
        nid: c.data?.nid || "",
        fatherName: c.data?.fatherName || "",
        motherName: c.data?.motherName || "",
        dateOfBirth: c.data?.dateOfBirth ? String(c.data.dateOfBirth).slice(0, 10) : "",
        gender: c.data?.gender || "male",
        bloodGroup: c.data?.bloodGroup || "",
        presentAddress: c.data?.presentAddress || "",
        permanentAddress: c.data?.permanentAddress || "",
        emergencyName: c.data?.emergencyName || "",
        emergencyPhone: c.data?.emergencyPhone || "",
        bankName: c.data?.bankName || "",
        bankAccount: c.data?.bankAccount || "",
        joinDate: c.data?.joinDate ? String(c.data.joinDate).slice(0, 10) : "",
        workType: c.data?.workType || "office",
        speciality: c.data?.speciality || "",
      });
      setDocs({
        nidFrontUrl: c.data?.nidFrontUrl || "",
        nidBackUrl: c.data?.nidBackUrl || "",
        certificates: c.data?.certificates || [],
      });
      setSlips(p.data || []);
    } catch {
      setMsg(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      computePayrollTotals(
        snapshotFromEmployee({
          basicSalary: Number(form.basicSalary || 0),
          houseRent: Number(form.houseRent || 0),
          medical: Number(form.medical || 0),
          conveyance: Number(form.conveyance || 0),
          incentive: Number(form.incentive || 0),
          campaign: Number(form.campaign || 0),
          yearlyCollection: Number(form.yearlyCollection || 0),
        }),
      ),
    [form.basicSalary, form.houseRent, form.medical, form.conveyance, form.incentive, form.campaign, form.yearlyCollection],
  );

  const paid = slips.filter((s) => s.status === "paid");
  const paidSum = paid.reduce((a, s) => a + Number(s.netPay || 0), 0);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "employee",
          name: form.name.trim(),
          nameBn: form.nameBn.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          designation: form.designation.trim(),
          department: form.department.trim(),
          basicSalary: Number(form.basicSalary || 0),
          houseRent: Number(form.houseRent || 0),
          medical: Number(form.medical || 0),
          conveyance: Number(form.conveyance || 0),
          incentive: Number(form.incentive || 0),
          campaign: Number(form.campaign || 0),
          yearlyCollection: Number(form.yearlyCollection || 0),
          nid: form.nid.trim(),
          fatherName: form.fatherName.trim(),
          motherName: form.motherName.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender,
          bloodGroup: form.bloodGroup.trim(),
          presentAddress: form.presentAddress.trim(),
          permanentAddress: form.permanentAddress.trim(),
          emergencyName: form.emergencyName.trim(),
          emergencyPhone: form.emergencyPhone.trim(),
          bankName: form.bankName.trim(),
          bankAccount: form.bankAccount.trim(),
          joinDate: form.joinDate || undefined,
          workType: form.workType,
          speciality: form.speciality.trim(),
          nidFrontUrl: docs.nidFrontUrl,
          nidBackUrl: docs.nidBackUrl,
          certificates: docs.certificates,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "fail");
      setEmp(json.data);
      setMsg(bn ? "স্যালারি মাস্টার সেভ হয়েছে" : "Salary master saved");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <EmptyState message={t("app.loading")} />;
  if (!emp) return <EmptyState message={t("common.noData")} />;

  const name = bn && emp.nameBn ? emp.nameBn : emp.name;

  return (
    <div className="gp-desk">
      <PageHeader
        title={name}
        subtitle={bn ? "স্যালারি মাস্টার ও পেস্লিপ হিস্ট্রি" : "Salary master and payslip history"}
        actions={
          <>
            <Link href="/contacts/employees" className="gp-btn gp-btn-ghost">
              <ArrowLeft className="h-4 w-4" />
              {bn ? "তালিকা" : "List"}
            </Link>
            <Link href={`/contacts/${id}/statement`} className="gp-btn gp-btn-ghost">
              {bn ? "স্টেটমেন্ট" : "Statement"}
            </Link>
            <Link href="/hr/leaves" className="gp-btn gp-btn-ghost">
              {bn ? "ছুটি" : "Leaves"}
            </Link>
            <Link href="/hr/payroll" className="gp-btn gp-btn-primary">
              {bn ? "পে-রোল" : "Payroll"}
            </Link>
          </>
        }
      />

      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={bn ? "মাসিক নেট" : "Monthly net"} value={formatBDT(totals.netPay, locale)} icon={Wallet} />
        <KpiCard label={bn ? "পেস্লিপ" : "Payslips"} value={String(slips.length)} icon={Banknote} />
        <KpiCard
          label={bn ? "মোট পেইড" : "Paid to date"}
          value={formatBDT(paidSum, locale)}
          icon={CheckCircle2}
          tone="info"
        />
      </div>

      <div className="gp-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">{bn ? "নাম" : "Name"}</p>
          <p className="mt-1 font-bold">{name}</p>
        </div>
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">{bn ? "রোল" : "Role"}</p>
          <p className="mt-1 font-bold">{emp.designation || "—"}</p>
        </div>
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">{bn ? "স্যালারি" : "Salary"}</p>
          <p className="mt-1 font-bold">{formatBDT(totals.netPay, locale)}</p>
        </div>
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">{bn ? "জয়েনিং ডেট" : "Joining date"}</p>
          <p className="mt-1 font-bold">{emp.joinDate ? formatDateBD(emp.joinDate, locale) : "—"}</p>
        </div>
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">{bn ? "ওয়ার্ক টাইপ / স্পেশালিস্ট" : "Work type / specialist"}</p>
          <p className="mt-1 font-bold">{workSpecialistLabel(emp.workType || (emp.department === "Service" ? "field" : "office"), emp.speciality, bn) || "—"}</p>
        </div>
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">{bn ? "পার্সোনাল ডকুমেন্ট" : "Personal documents"}</p>
          <p className="mt-1 font-bold">{docsCount(docs) ? `${docsCount(docs)} ${bn ? "ফাইল" : "files"}` : "—"}</p>
        </div>
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">NID</p>
          <p className="mt-1 font-mono font-bold">{emp.nid || "—"}</p>
        </div>
        <div>
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wide text-[var(--gp-text-2)]">{bn ? "ফোন" : "Phone"}</p>
          <p className="mt-1 font-bold">
            {emp.mobile ? (
              <a className="text-[var(--gp-primary)]" href={`tel:${emp.mobile}`}>
                {emp.mobile}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="gp-card mb-6 grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={bn ? "নাম" : "Name"}>
          <input className="gp-input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={bn ? "নাম (বাংলা)" : "Name (Bangla)"}>
          <input className="gp-input" value={form.nameBn} onChange={(e) => setForm((f) => ({ ...f, nameBn: e.target.value }))} />
        </Field>
        <Field label={bn ? "ফোন" : "Phone"}>
          <input className="gp-input" required value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
        </Field>
        <Field label="NID *">
          <input className="gp-input" required value={form.nid} onChange={(e) => setForm((f) => ({ ...f, nid: e.target.value }))} />
        </Field>
        <Field label={bn ? "রোল / পদবি" : "Role"}>
          <input className="gp-input" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
        </Field>
        <Field label={bn ? "জয়েনিং ডেট" : "Joining date"}>
          <input type="date" className="gp-input" value={form.joinDate} onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))} />
        </Field>
        <Field label={bn ? "স্যালারি (বেসিক)" : "Salary (basic)"}>
          <input type="number" min={0} className="gp-input" value={form.basicSalary} onChange={(e) => setForm((f) => ({ ...f, basicSalary: e.target.value }))} />
        </Field>
        <Field label={bn ? "ওয়ার্ক টাইপ" : "Work type"}>
          <select className="gp-input" value={form.workType} onChange={(e) => setForm((f) => ({ ...f, workType: e.target.value }))}>
            {EMPLOYEE_WORK_TYPES.map((row) => (
              <option key={row.id} value={row.id}>
                {bn ? row.bn : row.en}
              </option>
            ))}
          </select>
        </Field>
        <Field label={bn ? "স্পেশালিস্ট" : "Specialist"}>
          <input className="gp-input" value={form.speciality} onChange={(e) => setForm((f) => ({ ...f, speciality: e.target.value }))} />
        </Field>
        <Field label={bn ? "ইমেইল" : "Email"}>
          <input className="gp-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label={bn ? "বিভাগ" : "Department"}>
          <input className="gp-input" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <EmployeeDocsFields employeeId={id} value={docs} onChange={setDocs} bn={bn} disabled={saving} />
        </div>
        <Field label={bn ? "বাড়ি ভাড়া" : "House rent"}>
          <input type="number" min={0} className="gp-input" value={form.houseRent} onChange={(e) => setForm((f) => ({ ...f, houseRent: e.target.value }))} />
        </Field>
        <Field label={bn ? "মেডিকেল" : "Medical"}>
          <input type="number" min={0} className="gp-input" value={form.medical} onChange={(e) => setForm((f) => ({ ...f, medical: e.target.value }))} />
        </Field>
        <Field label={bn ? "যাতায়াত" : "Conveyance"}>
          <input type="number" min={0} className="gp-input" value={form.conveyance} onChange={(e) => setForm((f) => ({ ...f, conveyance: e.target.value }))} />
        </Field>
        <Field label={bn ? "ইনসেন্টিভ" : "Incentive"}>
          <input type="number" min={0} className="gp-input" value={form.incentive} onChange={(e) => setForm((f) => ({ ...f, incentive: e.target.value }))} />
        </Field>
        <Field label={bn ? "ক্যাম্পেইন" : "Campaign"}>
          <input type="number" min={0} className="gp-input" value={form.campaign} onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))} />
        </Field>
        <Field label={bn ? "ইয়ারলি কালেকশন" : "Yearly collection"}>
          <input type="number" min={0} className="gp-input" value={form.yearlyCollection} onChange={(e) => setForm((f) => ({ ...f, yearlyCollection: e.target.value }))} />
        </Field>
        <Field label={bn ? "পিতার নাম" : "Father"}>
          <input className="gp-input" value={form.fatherName} onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))} />
        </Field>
        <Field label={bn ? "মাতার নাম" : "Mother"}>
          <input className="gp-input" value={form.motherName} onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))} />
        </Field>
        <Field label={bn ? "জন্ম তারিখ" : "Date of birth"}>
          <input type="date" className="gp-input" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
        </Field>
        <Field label={bn ? "লিঙ্গ" : "Gender"}>
          <select className="gp-input" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
            <option value="male">{bn ? "পুরুষ" : "Male"}</option>
            <option value="female">{bn ? "নারী" : "Female"}</option>
            <option value="other">{bn ? "অন্য" : "Other"}</option>
          </select>
        </Field>
        <Field label={bn ? "রক্তের গ্রুপ" : "Blood group"}>
          <input className="gp-input" value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))} />
        </Field>
        <Field label={bn ? "জরুরি যোগাযোগ" : "Emergency"}>
          <input className="gp-input" value={form.emergencyName} onChange={(e) => setForm((f) => ({ ...f, emergencyName: e.target.value }))} />
        </Field>
        <Field label={bn ? "জরুরি ফোন" : "Emergency phone"}>
          <input className="gp-input" value={form.emergencyPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))} />
        </Field>
        <Field label={bn ? "ব্যাংক" : "Bank"}>
          <input className="gp-input" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
        </Field>
        <Field label={bn ? "অ্যাকাউন্ট" : "Account"}>
          <input className="gp-input" value={form.bankAccount} onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))} />
        </Field>
        <Field label={bn ? "বর্তমান ঠিকানা" : "Present address"}>
          <input className="gp-input" value={form.presentAddress} onChange={(e) => setForm((f) => ({ ...f, presentAddress: e.target.value }))} />
        </Field>
        <Field label={bn ? "স্থায়ী ঠিকানা" : "Permanent address"}>
          <input className="gp-input" value={form.permanentAddress} onChange={(e) => setForm((f) => ({ ...f, permanentAddress: e.target.value }))} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-sm font-semibold">
            {bn ? "গ্রস" : "Gross"} {formatBDT(totals.grossPay, locale)} · {bn ? "নেট" : "Net"} {formatBDT(totals.netPay, locale)}
          </p>
          <button type="submit" className="gp-btn gp-btn-primary" disabled={saving}>
            {saving ? "..." : t("common.save")}
          </button>
        </div>
      </form>

      <h2 className="mb-3 text-lg font-bold">{bn ? "পেস্লিপ হিস্ট্রি" : "Payslip history"}</h2>
      {slips.length === 0 ? (
        <EmptyState message={bn ? "এখনও কোনো পেস্লিপ নেই" : "No payslips yet"} />
      ) : (
        <div className="gp-table-wrap">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{bn ? "নং" : "No"}</th>
                <th>{bn ? "পিরিয়ড" : "Period"}</th>
                <th>{bn ? "নেট" : "Net"}</th>
                <th>{bn ? "স্ট্যাটাস" : "Status"}</th>
                <th>{bn ? "তারিখ" : "Date"}</th>
              </tr>
            </thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s._id}>
                  <td>
                    <Link href={`/contacts/payslips/${s._id}`} className="font-semibold text-primary hover:underline">
                      {s.slipNo}
                    </Link>
                  </td>
                  <td>{s.periodLabel || s.periodKey || "—"}</td>
                  <td className="gp-money">{formatBDT(s.netPay, locale)}</td>
                  <td>{s.status === "paid" ? (bn ? "পেইড" : "Paid") : bn ? "ড্রাফট" : "Draft"}</td>
                  <td>{formatDateBD(s.paidAt || s.createdAt || "", locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
