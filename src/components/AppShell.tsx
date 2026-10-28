"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  LogOut,
  Languages,
  Building2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { NavSidebar } from "@/components/NavSidebar";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 800_000;

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("invalid"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("too_large"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

export function AppShell({
  children,
  userName,
  role,
  logoUrl,
  avatarUrl,
  canUploadBranding,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
  logoUrl?: string;
  avatarUrl?: string;
  canUploadBranding?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logo, setLogo] = useState(logoUrl || "");
  const [avatar, setAvatar] = useState(avatarUrl || "");
  const [imageError, setImageError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sigma_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sigma_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    setLogo(logoUrl || "");
  }, [logoUrl]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("gp-nav-lock", menuOpen);
    return () => document.body.classList.remove("gp-nav-lock");
  }, [menuOpen]);

  useEffect(() => {
    setAvatar(avatarUrl || "");
  }, [avatarUrl]);

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

  async function persistLogo(dataUrl: string) {
    const res = await fetch("/api/meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "business", logoUrl: dataUrl }),
    });
    if (!res.ok) {
      setImageError(locale === "bn" ? "লোগো সংরক্ষণ হয়নি" : "Could not save logo");
      return;
    }
    setLogo(dataUrl);
    router.refresh();
  }

  async function persistAvatar(dataUrl: string) {
    const res = await fetch("/api/meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "profile", avatarUrl: dataUrl }),
    });
    if (!res.ok) {
      setImageError(locale === "bn" ? "প্রোফাইল ছবি সংরক্ষণ হয়নি" : "Could not save profile image");
      return;
    }
    setAvatar(dataUrl);
    router.refresh();
  }

  async function onPick(kind: "logo" | "avatar", file?: File) {
    if (!file || !canUploadBranding) return;
    setImageError("");
    try {
      const dataUrl = await readImageFile(file);
      if (kind === "logo") {
        setLogo(dataUrl);
        await persistLogo(dataUrl);
      } else {
        setAvatar(dataUrl);
        await persistAvatar(dataUrl);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setImageError(
        code === "too_large"
          ? locale === "bn"
            ? "ছবি ৮০০KB এর কম হতে হবে"
            : "Image must be under 800KB"
          : locale === "bn"
            ? "শুধু ছবি ফাইল আপলোড করুন"
            : "Please upload an image file",
      );
    }
  }

  const initial = (userName || "A").trim().charAt(0).toUpperCase();
  const roleLabels: Record<string, { bn: string; en: string }> = {
    admin: { bn: "অ্যাডমিন", en: "Admin" },
    manager: { bn: "ম্যানেজার", en: "Manager" },
    cashier: { bn: "ক্যাশিয়ার", en: "Cashier" },
    accountant: { bn: "অ্যাকাউন্ট্যান্ট", en: "Accountant" },
    viewer: { bn: "ভিউয়ার", en: "Viewer" },
  };
  const roleCopy = roleLabels[role] || roleLabels.admin;
  const adminLabel = locale === "bn" ? roleCopy.bn : roleCopy.en;

  const sidebarBody = (
    <>
      <div
        className={cn(
          "shrink-0 border-b border-white/10 px-3 py-3 transition-all",
          collapsed && "lg:px-2 lg:py-2.5 flex flex-col items-center gap-2",
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-2.5 w-full", collapsed && "lg:justify-center")}>
          {canUploadBranding ? (
            <button
              type="button"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--gp-primary)] text-white cursor-pointer"
              onClick={() => logoInputRef.current?.click()}
              title={locale === "bn" ? "কোম্পানি লোগো আপলোড" : "Upload company logo"}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-full w-full object-contain bg-white" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--gp-primary)] text-white">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-full w-full object-contain bg-white" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </div>
          )}
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
            <p className="gp-sidebar-brand text-[0.95rem] font-bold leading-tight">
              {t("app.name")}
            </p>
            <p className="mt-0.5 text-[0.8rem] font-medium leading-snug text-[#e8eef8]">
              {locale === "en" ? "Elevator ERP" : "এলিভেটর ইআরপি"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#c5d4e8] hover:bg-white/10 hover:text-white transition-colors cursor-pointer",
              collapsed && "hidden",
            )}
            title={locale === "bn" ? "সাইডবার সঙ্কুচিত করুন" : "Collapse sidebar"}
            aria-label={locale === "bn" ? "সাইডবার সঙ্কুচিত করুন" : "Collapse sidebar"}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-[#c5d4e8] hover:bg-white/10 hover:text-white transition-colors cursor-pointer mt-1"
            title={locale === "bn" ? "সাইডবার প্রসারিত করুন" : "Expand sidebar"}
            aria-label={locale === "bn" ? "সাইডবার প্রসারিত করুন" : "Expand sidebar"}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onPick("logo", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p
        className={cn(
          "px-3 pt-3 text-[0.8rem] font-semibold tracking-[0.04em] text-[#e8eef8]",
          collapsed && "lg:hidden",
        )}
      >
        {locale === "bn" ? "মডিউল" : "Modules"}
      </p>
      {collapsed && <div className="hidden lg:block my-1 border-t border-white/10 mx-2" />}
      <Suspense fallback={null}>
        <NavSidebar
          role={role}
          collapsed={collapsed}
          onExpandSidebar={() => setCollapsed(false)}
        />
      </Suspense>
      <div
        className={cn(
          "mt-auto shrink-0 border-t border-white/10 p-2.5",
          collapsed && "lg:p-2 lg:flex lg:flex-col lg:items-center",
        )}
      >
        {imageError ? <p className="gp-sidebar-error mb-2 px-1 text-[0.75rem]">{imageError}</p> : null}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-2 py-2",
            collapsed && "lg:px-1 lg:justify-center",
          )}
        >
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--gp-primary)] text-xs font-bold text-white cursor-pointer"
            onClick={() => canUploadBranding && avatarInputRef.current?.click()}
            title={canUploadBranding ? (locale === "bn" ? "প্রোফাইল ছবি আপলোড" : "Upload profile image") : userName}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </button>
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
            <p className="truncate text-[0.82rem] font-semibold leading-tight text-white">{userName}</p>
            <p className="truncate text-[0.72rem] font-medium leading-tight text-[#e8eef8]">{adminLabel}</p>
          </div>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onPick("avatar", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh overflow-x-clip bg-[var(--gp-bg)]">
      <a href="#app-main" className="gp-skip">
        {locale === "bn" ? "মূল কন্টেন্টে যান" : "Skip to content"}
      </a>
      {menuOpen ? (
        <button type="button" className="gp-nav-scrim" aria-label={locale === "bn" ? "মেনু বন্ধ" : "Close menu"} onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside
        id="app-sidebar"
        className={cn(
          "gp-app-sidebar sticky top-0 z-40 flex h-dvh shrink-0 flex-col overflow-hidden bg-[var(--gp-sidebar)] text-[#f1f5fb] transition-[width] duration-200 ease-in-out",
          collapsed ? "lg:w-[68px] w-[268px]" : "w-[268px]",
          menuOpen && "is-open",
        )}
      >
        {sidebarBody}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="gp-topbar sticky top-0 z-30 flex h-[52px] items-center gap-2.5 border-b border-line px-3 sm:px-4">
          <button
            type="button"
            className="gp-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
            aria-label={locale === "bn" ? "সাইডবার টগল" : "Toggle sidebar"}
            title={
              locale === "bn"
                ? (collapsed ? "সাইডবার প্রসারিত করুন" : "সাইডবার সঙ্কুচিত করুন")
                : (collapsed ? "Expand sidebar" : "Collapse sidebar")
            }
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 960) {
                setMenuOpen((open) => !open);
              } else {
                toggleCollapsed();
              }
            }}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--gp-primary)] text-white">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-full w-full bg-white object-contain" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.82rem] font-bold leading-tight tracking-tight text-[var(--gp-ink)]">{t("app.name")}</p>
            <p className="truncate text-[0.8125rem] text-[var(--gp-text-2)]">
              {adminLabel} · {userName}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
          </div>
        </header>
        <main id="app-main" className="gp-page min-w-0 px-3 py-3 sm:px-4 lg:px-5">
          {children}
        </main>
      </div>
    </div>
  );
}
