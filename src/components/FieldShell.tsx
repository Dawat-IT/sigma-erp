"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Clock, Home, LogOut, Languages, MapPin, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { readStoredJob, writeStoredJob } from "@/lib/field-job";

const TABS = [
  { id: "today", icon: Home, labelKey: "field.today" },
  { id: "house", icon: MapPin, labelKey: "field.house" },
  { id: "clock", icon: Clock, labelKey: "field.clock" },
  { id: "parts", icon: Package, labelKey: "field.parts" },
] as const;

function tabHref(id: string, jobId: string) {
  if (id === "today") return "/m";
  if (!jobId) return "/m";
  if (id === "house") return `/m/${jobId}`;
  if (id === "clock") return `/m/${jobId}/clock`;
  return `/m/${jobId}/parts`;
}

function activeTab(pathname: string) {
  if (pathname === "/m") return "today";
  if (pathname.endsWith("/clock")) return "clock";
  if (pathname.endsWith("/parts")) return "parts";
  if (pathname.startsWith("/m/")) return "house";
  return "today";
}

export function FieldShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const bn = locale === "bn";
  const [storedJob, setStoredJob] = useState("");
  const [needJob, setNeedJob] = useState(false);
  const jobMatch = pathname.match(/^\/m\/([^/]+)/);
  const pathJob = jobMatch ? jobMatch[1] : "";
  const current = activeTab(pathname);
  const jobId = pathJob || storedJob;

  useEffect(() => {
    if (pathJob) {
      writeStoredJob(pathJob);
      setStoredJob(pathJob);
      setNeedJob(false);
      return;
    }
    const stored = readStoredJob();
    if (stored) setStoredJob(stored);
  }, [pathname, pathJob]);

  function hrefFor(tabId: (typeof TABS)[number]["id"]) {
    if (tabId === "today") return "/m";
    return tabHref(tabId, jobId);
  }

  function onTabClick(tabId: (typeof TABS)[number]["id"]) {
    if (tabId === "today") {
      setNeedJob(false);
      return;
    }
    const id = jobId || readStoredJob();
    if (!id) {
      setNeedJob(true);
      return;
    }
    writeStoredJob(id);
    setStoredJob(id);
    setNeedJob(false);
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="fld-app flex min-h-dvh flex-col">
      <a href="#field-main" className="gp-skip">
        {bn ? "মূল কন্টেন্টে যান" : "Skip to content"}
      </a>
      <header className="fld-head sticky top-0 z-30 flex items-center gap-2.5">
        <button
          type="button"
          className="fld-head-back"
          aria-label={t("common.back")}
          onClick={() => router.push(current === "today" ? "/dashboard" : "/m")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9rem] font-bold tracking-tight text-[var(--gp-ink)]">{t("app.name")}</p>
          <p className="truncate text-[0.75rem] text-[var(--gp-text-2)]">{userName}</p>
        </div>
        <button
          type="button"
          className="gp-icon-btn"
          onClick={() => void switchLocale()}
          title={locale === "bn" ? "English" : "বাংলা"}
          aria-label={locale === "bn" ? "Switch to English" : "বাংলায় যান"}
        >
          <Languages className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="gp-icon-btn gp-icon-btn-danger"
          onClick={() => void logout()}
          title={t("nav.logout")}
          aria-label={t("nav.logout")}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>
      {needJob && current === "today" ? (
        <p className="fld-needjob">
          {bn ? "ক্লক বা পার্টস খুলতে আগে একটা কাস্টমার ট্যাপ করুন।" : "Tap a customer first to open Clock or Parts."}
        </p>
      ) : null}
      <main id="field-main" className="gp-desk min-w-0 flex-1 overflow-x-clip px-3 pb-32 pt-3 sm:px-4">
        {children}
      </main>
      <nav className="fld-tabbar fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const on = current === tab.id;
          return (
            <Link
              key={tab.id}
              href={hrefFor(tab.id)}
              className={cn("fld-tab flex flex-col items-center justify-center text-[0.7rem] font-bold", on && "on")}
              onClick={() => onTabClick(tab.id)}
            >
              <span>
                <Icon className="h-5 w-5" />
              </span>
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
