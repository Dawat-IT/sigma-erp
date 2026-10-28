"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { cn, formatBDT } from "@/lib/utils";
import { animateModalIn, animateModalOut, animateCardsIn } from "@/lib/gsap";

export function PageHeader({
  title,
  subtitle,
  kicker,
  stats,
  actions,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  stats?: { label: string; value: string | number }[];
  actions?: React.ReactNode;
}) {
  return (
    <section className="fld-hero desk-hero">
      <div>
        {kicker ? <p className="fld-hero-kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="fld-lead">{subtitle}</p> : null}
      </div>
      <div className="desk-hero-side">
        {stats?.length ? (
          <div className="fld-hero-stats">
            {stats.map((stat) => (
              <b key={stat.label}>
                {stat.label} <em>({stat.value})</em>
              </b>
            ))}
          </div>
        ) : null}
        {actions ? <div className="desk-hero-actions">{actions}</div> : null}
      </div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  onClick,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: any;
  onClick?: () => void;
  tone?: "default" | "warn" | "danger" | "info";
  compact?: boolean;
}) {
  const clickable = typeof onClick === "function";
  const iconWrap =
    tone === "warn"
      ? "bg-[var(--gp-warn)] text-white"
      : tone === "danger"
        ? "bg-[var(--gp-danger)] text-white"
        : tone === "info"
          ? "bg-[var(--gp-info)] text-white"
          : "bg-[var(--gp-primary)] text-white";
  const className = cn(
    "gp-card gp-kpi-card flex min-h-0 w-full flex-col text-left",
    compact ? "p-2.5 pl-3.5" : "p-3 pl-4",
    tone === "warn" && "gp-kpi-warn",
    tone === "danger" && "gp-kpi-danger",
    tone === "info" && "gp-kpi-info",
    clickable && "cursor-pointer transition-colors hover:border-[var(--gp-primary)]",
  );
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className="font-extrabold uppercase leading-snug tracking-wide text-[0.75rem] text-[var(--gp-text-2)]"
        >
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              compact ? "h-7 w-7" : "h-8 w-8",
              iconWrap,
            )}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </span>
        ) : null}
      </div>
      <div className={compact ? "mt-1.5" : "mt-2"}>
        <p
          className={cn(
            "gp-money leading-none tracking-tight text-[var(--gp-ink)]",
            compact ? "text-[1.2rem]" : "text-[1.35rem]",
          )}
        >
          {typeof value === "number" ? formatBDT(value) : value}
        </p>
        {hint ? <p className="mt-1.5 text-[0.8125rem] font-medium text-[var(--gp-text-muted)]">{hint}</p> : null}
      </div>
    </>
  );
  if (clickable) {
    return (
      <button type="button" data-animate="card" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return (
    <div data-animate="card" className={className}>
      {body}
    </div>
  );
}

export function EmptyState({ message, title }: { message: string; title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-[var(--gp-surface-2)] px-4 py-8 text-center">
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gp-primary-soft)] text-[var(--gp-primary)] text-sm font-bold">
        —
      </span>
      {title ? <p className="mb-1 text-sm font-bold text-[var(--gp-ink)]">{title}</p> : null}
      <p className="max-w-md text-sm leading-snug text-[var(--gp-text-2)]">{message}</p>
    </div>
  );
}

export function AlertBanner({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error" | "info";
  message: string;
  onClose?: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "border-[var(--gp-success-border,#bbf7d0)] bg-[var(--gp-success-bg,#f0fdf4)] text-[var(--gp-success,#15803d)]"
      : tone === "error"
        ? "border-[var(--gp-danger-border,#fecaca)] bg-[var(--gp-danger-bg,#fef2f2)] text-[var(--gp-danger,#b91c1c)]"
        : "border-line bg-[var(--gp-bg)] text-[var(--gp-ink)]";

  return (
    <div
      className={cn(
        "mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium",
        toneClass,
      )}
      role="status"
    >
      <span>{message}</span>
      {onClose ? (
        <button
          type="button"
          className="shrink-0 opacity-70 hover:opacity-100"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="gp-table-wrap overflow-x-auto">
      <table className="gp-table w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="gp-skeleton h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <div className="gp-skeleton h-4 w-full max-w-[140px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-panel desk-toolbar grid gap-2 p-2.5 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="gp-field-label">{label}</span>
      {children}
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
  compact,
  fit,
  scrollBody,
  noScroll,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  compact?: boolean;
  fit?: boolean;
  scrollBody?: boolean;
  noScroll?: boolean;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (open && !visible.current) {
      visible.current = true;
      requestAnimationFrame(() => {
        animateModalIn(backdropRef.current, panelRef.current);
        panelRef.current?.focus();
      });
    }
    if (!open) visible.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        animateModalOut(backdropRef.current, panelRef.current, onClose);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function close() {
    animateModalOut(backdropRef.current, panelRef.current, onClose);
  }

  if (!open || !ready) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(21,32,51,0.4)] p-4 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gp-modal-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "gp-modal-panel rounded-xl border border-line bg-white shadow-xl",
          wide
            ? noScroll
              ? "w-[min(1080px,calc(100vw-1.5rem))]"
              : scrollBody
                ? "w-full max-w-6xl"
                : "w-full max-w-5xl"
            : compact
              ? "w-full max-w-[420px]"
              : fit
                ? "w-full max-w-[560px]"
                : "w-full max-w-[480px]",
          noScroll
            ? "overflow-hidden max-md:max-h-[calc(100dvh-1.5rem)] max-md:overflow-auto"
            : scrollBody
              ? "flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden"
              : fit
                ? "overflow-visible"
                : "max-h-[min(90vh,720px)] overflow-auto",
        )}
      >
        <div
          className={cn(
            "sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-line bg-white",
            noScroll || compact ? "px-4 py-2" : "px-4 py-3",
          )}
        >
          <h2 id="gp-modal-title" className="text-base font-bold text-[var(--gp-ink)]">{title}</h2>
          <button type="button" className="gp-btn gp-btn-ghost min-h-8 px-2.5" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div
          className={cn(
            scrollBody && "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
            noScroll && "overflow-hidden max-md:overflow-visible",
            compact || noScroll ? "p-3" : "p-4",
            scrollBody && compact && "p-2.5",
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PageAnimator({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = ref.current;
    if (!root?.querySelector("[data-animate='card']")) return;
    animateCardsIn(root);
  }, [pathname]);

  return (
    <div ref={ref} className="gp-desk">
      {children}
    </div>
  );
}
