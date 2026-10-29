"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  ShoppingCart,
  Wrench,
  HardHat,
  Package,
  Users,
  BarChart3,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Languages,
  ShieldCheck,
  ClipboardCheck,
  MapPin,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountHint, setAccountHint] = useState("");
  const passwordInput = useRef<HTMLInputElement>(null);
  const demoMode = process.env.NODE_ENV !== "production";

  async function signIn(nextEmail: string, nextPassword: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "invalid" || res.status === 401) {
          setError(t("auth.invalid"));
        } else if (data.error === "db" || res.status === 503) {
          setError(t("auth.dbError"));
        } else {
          setError(t("common.error"));
        }
        return;
      }
      if (demoMode) await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void signIn(email, password);
  }

  function fillDemo(targetRole: "admin" | "manager" = "admin") {
    if (!demoMode) {
      setEmail(BRAND.adminLoginEmail);
      setError("");
      if (password) {
        void signIn(BRAND.adminLoginEmail, password);
      } else {
        setAccountHint(bn ? "অ্যাডমিন নির্বাচন করা হয়েছে। আপনার পাসওয়ার্ড লিখুন।" : "Admin selected. Enter your password.");
        passwordInput.current?.focus();
      }
      return;
    }
    if (targetRole === "manager") {
      void signIn(BRAND.demoManagerEmail, BRAND.demoManagerPassword);
    } else {
      void signIn(BRAND.demoEmail, BRAND.demoPassword);
    }
  }

  async function switchLocale() {
    const next = locale === "bn" ? "en" : "bn";
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
  }

  const modules = [
    {
      icon: ShoppingCart,
      title: bn ? "সেলস ও সিআরএম" : "Sales & CRM",
      text: bn
        ? "কাস্টমার, লিড, কোটেশন, প্রস্তাবনা, অর্ডার ও ইনভয়েস এক ফ্লোতে।"
        : "Customers, leads, quotations, proposals, orders and invoices in one flow.",
    },
    {
      icon: Wrench,
      title: bn ? "টেকনিক্যাল সার্ভিস" : "Technical service",
      text: bn
        ? "ব্রেকডাউন, ইমার্জেন্সি, পিএম জব, চেকলিস্ট ও SLA ট্র্যাকিং।"
        : "Breakdown, emergency and PM jobs with checklists and SLA.",
    },
    {
      icon: HardHat,
      title: bn ? "প্রজেক্ট ও ইনস্টল" : "Project & install",
      text: bn
        ? "লিফট ইনস্টলেশন, সাইট প্রগ্রেস ও হ্যান্ডওভার রেকর্ড।"
        : "Lift installation, site progress and handover records.",
    },
    {
      icon: Package,
      title: bn ? "স্টক ও স্পেয়ার" : "Stock & spares",
      text: bn
        ? "ক্যাটালগ, সাপ্লায়ার, ক্রয়, স্টক অ্যালার্ট ও পার্টস ইস্যু।"
        : "Catalog, suppliers, purchasing, stock alerts and parts issue.",
    },
    {
      icon: Users,
      title: bn ? "এইচআর ও পে-রোল" : "HR & payroll",
      text: bn
        ? "কর্মচারী, হাজিরা, ছুটি, স্যালারি ও পেস্লিপ।"
        : "Staff, attendance, leave, salary and payslips.",
    },
    {
      icon: BarChart3,
      title: bn ? "রিপোর্ট ও হিসাব" : "Reports & accounts",
      text: bn
        ? "বিক্রি, সার্ভিস, খরচ, স্টক ও প্রফিট-লস ড্রিলডাউন।"
        : "Sales, service, expense, stock and P&L drill-down.",
    },
  ];

  const stats = [
    { value: bn ? "অফিস + ফিল্ড" : "Office + field", label: bn ? "একই ডেস্ক" : "One operations desk" },
    { value: "বাংলা + EN", label: bn ? "দ্বিভাষিক ওয়ার্কস্পেস" : "Bilingual workspace" },
    { value: bn ? "চেকলিস্ট" : "Checklists", label: bn ? "সার্ভিস জবাবদিহি" : "Service accountability" },
  ];

  const chips = bn
    ? ["লিড → কোটেশন → চালান → বিল", "কাস্টমার ও মেশিন রেজিস্টার", "টেকনিশিয়ান ডিসপ্যাচ", "পে-রোল"]
    : ["Lead → quote → challan → bill", "Customer & machine register", "Technician dispatch", "Payroll"];

  return (
    <div className="erp-login-grid">
      <aside className="erp-login-panel">
        <div className="erp-login-brand">
          <span className="erp-login-mark">{BRAND.logoMark}</span>
          <div>
            <p className="text-[0.95rem] font-extrabold leading-tight">{bn ? BRAND.appNameBn : BRAND.appName}</p>
            <p className="erp-login-soft mt-0.5 text-[0.8125rem]">
              {bn ? "এলিভেটর, স্পেয়ার পার্টস ও টেকনিক্যাল সার্ভিস প্রোভাইডার" : BRAND.documentTagline}
            </p>
          </div>
        </div>

        <div className="erp-login-hero">
          <p className="erp-login-kicker">{bn ? "সিগমা অপারেশন ডেস্ক" : "Sigma operations desk"}</p>
          <h1>
            {bn ? (
              <>
                লিফট বিক্রি থেকে সার্ভিস, <span className="erp-login-accent">এক সিস্টেমে</span>
              </>
            ) : (
              <>
                From lift sales to service, <span className="erp-login-accent">one system</span>
              </>
            )}
          </h1>
          <p>
            {bn
              ? "কাস্টমার, কোটেশন, স্পেয়ার স্টক, টেকনিক্যাল জব, ডিসপ্যাচ ও পে-রোল — পুরো অফিস এক স্ক্রিনে।"
              : "Customers, quotations, spares, technical jobs, dispatch and payroll — the whole office on one screen."}
          </p>
        </div>

        <div className="erp-login-stats">
          {stats.map((row) => (
            <div key={row.value} className="erp-login-stat">
              <b>{row.value}</b>
              <span>{row.label}</span>
            </div>
          ))}
        </div>

        <div className="erp-login-modules">
          {modules.map(({ icon: Icon, title, text }) => (
            <article key={title} className="erp-login-mod">
              <span className="erp-login-mod__icon">
                <Icon />
              </span>
              <div>
                <b>{title}</b>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="erp-login-flow">
          {chips.map((chip) => (
            <span key={chip} className="erp-login-chip">
              {chip}
            </span>
          ))}
        </div>

        <p className="erp-login-panel-foot">
          {bn
            ? `${BRAND.companyBn} · ${BRAND.infoEmail} · শুধু অনুমোদিত স্টাফ লগইন করবেন।`
            : `${BRAND.company} · ${BRAND.infoEmail} · Authorized staff only.`}
        </p>
      </aside>

      <div className="erp-login-form">
        <form onSubmit={onSubmit} className="erp-login-card">
          <div className="erp-login-card-top">
            <div className="erp-login-card-brand">
              <span className="erp-login-mark">{BRAND.logoMark}</span>
              <div>
                <p className="erp-login-card-name">{bn ? BRAND.appNameBn : BRAND.appName}</p>
                <p className="erp-login-hint">{bn ? "অনুমোদিত স্টাফ পোর্টাল" : "Authorized staff portal"}</p>
              </div>
            </div>
            <button
              type="button"
              className="gp-icon-btn shrink-0"
              onClick={() => void switchLocale()}
              title={bn ? "English" : "বাংলা"}
              aria-label={bn ? "Switch to English" : "বাংলায় যান"}
            >
              <Languages className="h-4 w-4" />
            </button>
          </div>

          <h2 className="erp-login-card-title">{bn ? "অফিসে প্রবেশ করুন" : "Sign in to the desk"}</h2>
          <p className="erp-login-hint erp-login-card-lead">
            {bn
              ? "সেলস, সার্ভিস জব, স্টক ও পে-রোল — আপনার রোল অনুযায়ী মেনু খুলবে।"
              : "Sales, service jobs, stock and payroll open by your role."}
          </p>

          <div className="erp-login-fields">
            <label className="erp-login-field">
              <span className="erp-login-label">{bn ? "অফিস ইমেইল" : "Office email"}</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gp-primary-light)]" />
                <input
                  className="gp-input gp-input-icon-left"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder={demoMode ? BRAND.demoEmail : BRAND.adminLoginEmail}
                  required
                />
              </span>
            </label>
            <label className="erp-login-field">
              <span className="erp-login-label">{bn ? "পাসওয়ার্ড" : "Password"}</span>
              <span className="relative block">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gp-primary-light)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  ref={passwordInput}
                  className="gp-input gp-input-icon-both"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#9eb0c7] hover:text-white"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            {error ? (
              <p className="erp-login-error">{error}</p>
            ) : null}
            {accountHint && !error ? <p role="status" className="erp-login-hint">{accountHint}</p> : null}
            <button type="submit" disabled={loading} className="gp-btn gp-btn-primary erp-login-submit">
              {loading ? t("auth.loggingIn") : t("auth.login")}
              {!loading ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </div>

          <div className={`mt-2.5 grid gap-2 ${demoMode ? "grid-cols-2" : "grid-cols-1"}`}>
            <button
              type="button"
              disabled={loading}
              onClick={() => fillDemo("admin")}
              className="erp-login-demo !mt-0 p-2 hover:border-blue-400/50 hover:bg-blue-500/10 transition-all text-left"
            >
              <div className="erp-login-demo-head flex items-center justify-between text-xs">
                <span className="font-bold text-blue-300">{bn ? "অ্যাডমিন" : "Admin"}</span>
                <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-200 px-1.5 py-0.5 rounded">
                  {bn ? "লগইন" : "Sign in"}
                </span>
              </div>
              <div className="mt-1 text-[11px] leading-tight text-slate-300 font-mono truncate">
                {demoMode ? BRAND.demoEmail : BRAND.adminLoginEmail}
              </div>
            </button>

            {demoMode ? <button
              type="button"
              onClick={() => fillDemo("manager")}
              className="erp-login-demo !mt-0 p-2 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-all text-left"
            >
              <div className="erp-login-demo-head flex items-center justify-between text-xs text-emerald-400">
                <span className="font-bold text-emerald-300">{bn ? "ম্যানেজার" : "Manager"}</span>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded">
                  {bn ? "লগইন" : "Sign in"}
                </span>
              </div>
              <div className="mt-1 text-[11px] leading-tight text-slate-300 font-mono truncate">
                {BRAND.demoManagerEmail}
              </div>
            </button> : null}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#9eb0c7]">
            <span className="flex items-center gap-1 font-medium">
              <ClipboardCheck className="h-3.5 w-3.5 text-[var(--gp-primary-light)]" />
              {bn ? "ড্যাশবোর্ড" : "Dashboard"}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <MapPin className="h-3.5 w-3.5 text-[var(--gp-primary-light)]" />
              {bn ? "ফিল্ড জবস" : "Field"}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--gp-primary-light)]" />
              {bn ? "রোল সিকিউরিটি" : "Role Guard"}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
