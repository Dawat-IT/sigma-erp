"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { flattenNav, navForRole, type NavItem } from "@/lib/navigation";

const NAV_HREFS = [...new Set(flattenNav().map((n) => n.href.split("?")[0]))];

function hrefPath(href: string) {
  return href.split("?")[0];
}

function hrefMode(href: string) {
  const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  return q ? new URLSearchParams(q).get("mode") : null;
}

function navLabel(t: ReturnType<typeof useTranslations>, locale: string, key: string) {
  try {
    const value = t(key);
    if (value && value !== key) return value;
  } catch {
    /* missing key */
  }
  if (key === "nav.challanList") return locale === "bn" ? "সব চালান" : "All Challan";
  if (key === "nav.sellReturnForm") return locale === "bn" ? "সেল রিটার্ন" : "Sell Return";
  if (key === "nav.sellReturnList") return locale === "bn" ? "সেল রিটার্ন তালিকা" : "Sell Return List";
  if (key === "nav.customerPayment") return locale === "bn" ? "কাস্টমার পেমেন্ট" : "Customer Payment";
  if (key === "nav.supplierPayment") return locale === "bn" ? "সাপ্লায়ার পেমেন্ট" : "Supplier Payment";
  if (key === "nav.allLeads") return locale === "bn" ? "সব লিড" : "All Leads";
  if (key === "nav.clients") return locale === "bn" ? "ক্লায়েন্ট" : "Clients";
  if (key === "nav.dealsPipeline") return locale === "bn" ? "ডিল পাইপলাইন" : "Deals Pipeline";
  if (key === "nav.salesCrm") return locale === "bn" ? "সেলস ও সিআরএম" : "Sales & CRM";
  if (key === "nav.serviceRecords") return locale === "bn" ? "সার্ভিস রেকর্ড" : "Service records";
  if (key === "nav.technicalService") return locale === "bn" ? "টেকনিক্যাল সার্ভিস" : "Technical service";
  if (key === "nav.projectInstall") return locale === "bn" ? "প্রজেক্ট ও ইনস্টলেশন" : "Project & Installation";
  if (key === "nav.hrPayroll") return locale === "bn" ? "এইচআর ও পে-রোল" : "HR & Payroll";
  if (key === "nav.businessDev") return locale === "bn" ? "বিজনেস ডেভ" : "Business Dev";
  if (key === "nav.hrAccount") return locale === "bn" ? "অ্যাকাউন্ট" : "Account";
  if (key === "nav.arm") return locale === "bn" ? "এআরএম" : "ARM";
  if (key === "nav.payroll") return locale === "bn" ? "পে-রোল" : "Payroll";
  if (key === "nav.salaries") return locale === "bn" ? "স্যালারি" : "Salaries";
  if (key === "nav.payslips") return locale === "bn" ? "পেস্লিপ" : "Payslips";
  if (key === "nav.listProposals") return locale === "bn" ? "প্রস্তাবনা" : "Proposals";
  if (key === "nav.addProposal") return locale === "bn" ? "প্রস্তাবনা যোগ" : "Add Proposal";
  if (key === "nav.newOrder") return locale === "bn" ? "নতুন অর্ডার" : "New order";
  if (key === "nav.fieldToday") return locale === "bn" ? "ফিল্ড আজকে" : "Field today";
  if (key === "nav.housesDue") return locale === "bn" ? "ডিউ সার্ভিস" : "Due service";
  if (key === "nav.serviceHistory") return locale === "bn" ? "সার্ভিস হিস্ট্রি" : "Service history";
  if (key === "nav.upcomingService") return locale === "bn" ? "আপকামিং সার্ভিস" : "Upcoming service";
  if (key === "nav.dueService") return locale === "bn" ? "ডিউ সার্ভিস" : "Due service";
  if (key === "nav.customers") return locale === "bn" ? "কাস্টমার" : "Customers";
  return key;
}

/** Longest matching href wins so /sales and /sales/quotations cannot both be active. */
function isNavActive(href: string | undefined, pathname: string, posMode?: string | null) {
  if (!href) return false;
  const path = hrefPath(href);
  const mode = hrefMode(href);
  if (pathname === "/pos") {
    if (posMode === "challan") return path === "/sales/challans";
    if (posMode === "proposal") return path === "/sales/proposals/add" || mode === "proposal";
    if (posMode === "quotation") return path === "/pos" && mode === "quotation";
    return path === "/pos" && !mode;
  }
  if (path === "/sales/returns" && pathname.startsWith("/sales/returns/")) return false;
  if (path === "/sales/returns/add" && pathname.startsWith("/sales/returns/") && pathname !== "/sales/returns") {
    return true;
  }
  if (pathname === path) return true;
  if (path === "/") return false;
  if (!pathname.startsWith(`${path}/`)) return false;
  return !NAV_HREFS.some(
    (other) =>
      other !== path &&
      other.startsWith(`${path}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

function childIsActive(item: NavItem, pathname: string, posMode?: string | null): boolean {
  return !!item.children?.some(
    (c) => isNavActive(c.href, pathname, posMode) || childIsActive(c, pathname, posMode),
  );
}

function NavLeaf({
  item,
  pathname,
  posMode,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  posMode?: string | null;
  collapsed?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const Icon = item.icon;
  const active = isNavActive(item.href, pathname, posMode);
  const label = navLabel(t, locale, item.labelKey);

  return (
    <Link
      href={item.href!}
      title={label}
      className={cn(
        "group flex min-h-8 items-center gap-2 rounded-md border border-transparent px-2 py-1 text-[0.8125rem] font-semibold leading-tight tracking-[-0.005em] transition-colors duration-150",
        active
          ? "border-white/10 bg-[var(--gp-primary)] text-white shadow-sm"
          : "text-[#e8eef8] hover:border-white/5 hover:bg-white/[0.07] hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      {Icon ? (
        <Icon className={cn("h-4 w-4 shrink-0 stroke-[1.7]", active ? "text-white" : "text-[#c5d4e8] group-hover:text-white")} />
      ) : null}
      {!collapsed && (
        <span className="min-w-0 truncate leading-tight">
          {label}
        </span>
      )}
    </Link>
  );
}

function NestedNavGroup({
  child,
  item,
  pathname,
  posMode,
  collapsed,
}: {
  child: NavItem;
  item: NavItem;
  pathname: string;
  posMode?: string | null;
  collapsed?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const ChildIcon = child.icon || item.icon;
  const parentActive = isNavActive(child.href, pathname, posMode);
  const hasActiveChild = !!child.children?.some((n) => isNavActive(n.href, pathname, posMode));
  const [isOpen, setIsOpen] = useState(() => parentActive || hasActiveChild || !!child.defaultOpen);

  useEffect(() => {
    if (parentActive || hasActiveChild) {
      setIsOpen(true);
    }
  }, [parentActive, hasActiveChild]);

  const label = navLabel(t, locale, child.labelKey);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        {child.href ? (
          <Link
            href={child.href}
            title={label}
            className={cn(
              "flex flex-1 min-h-7 items-center gap-2 rounded-md border border-transparent px-2 py-1 text-[0.8rem] font-semibold leading-tight tracking-[-0.005em] transition-all duration-150",
              parentActive
                ? "border-white/10 bg-[var(--gp-primary)] text-white shadow-sm"
                : "text-[#e8eef8] hover:border-white/5 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            {ChildIcon ? (
              <ChildIcon className={cn("h-3.5 w-3.5 shrink-0 stroke-[1.7]", parentActive ? "text-white" : "text-[#c5d4e8]")} />
            ) : null}
            <span className="min-w-0 truncate leading-tight">{label}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex flex-1 min-h-7 items-center justify-between gap-1 rounded-md px-2 py-1 text-left text-[0.78rem] font-semibold tracking-wide text-[#e8eef8] hover:bg-white/[0.06] transition-colors"
            title={label}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {ChildIcon ? <ChildIcon className="h-3.5 w-3.5 shrink-0 text-[#c5d4e8]" /> : null}
              <span className="truncate">{label}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 text-[#c5d4e8] transition-transform duration-200",
                !isOpen && "-rotate-90",
              )}
            />
          </button>
        )}
        {child.href && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex h-6 w-6 items-center justify-center rounded text-[#c5d4e8] hover:bg-white/10 hover:text-white transition-colors"
            title={isOpen ? (locale === "bn" ? "সঙ্কুচিত করুন" : "Collapse") : (locale === "bn" ? "প্রসারিত করুন" : "Expand")}
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                !isOpen && "-rotate-90",
              )}
            />
          </button>
        )}
      </div>

      {isOpen && !collapsed && (
        <div className="ml-[0.85rem] space-y-0.5 border-l border-white/10 pl-2">
          {child.children?.map((nested) => {
            if (!nested.href) return null;
            const active = isNavActive(nested.href, pathname, posMode);
            const NestedIcon = nested.icon || ChildIcon;
            const nestedLabel = navLabel(t, locale, nested.labelKey);
            return (
              <Link
                key={nested.href}
                href={nested.href}
                title={nestedLabel}
                className={cn(
                  "flex min-h-7 items-center gap-2 rounded-md border border-transparent px-2 py-1 text-[0.8rem] font-semibold leading-tight tracking-[-0.005em] transition-all duration-150",
                  active
                    ? "border-white/10 bg-[var(--gp-primary)] text-white shadow-sm"
                    : "text-[#e8eef8] hover:border-white/5 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                {NestedIcon ? (
                  <NestedIcon className={cn("h-3.5 w-3.5 shrink-0 stroke-[1.7]", active ? "text-white" : "text-[#c5d4e8]")} />
                ) : null}
                <span className="min-w-0 truncate leading-tight">{nestedLabel}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavGroup({
  item,
  pathname,
  posMode,
  collapsed,
  onExpandSidebar,
}: {
  item: NavItem;
  pathname: string;
  posMode?: string | null;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const Icon = item.icon;
  const childActive = childIsActive(item, pathname, posMode);
  const [isOpen, setIsOpen] = useState(() => childActive || !!item.defaultOpen);

  useEffect(() => {
    if (childActive) {
      setIsOpen(true);
    }
  }, [childActive]);

  const handleHeaderClick = () => {
    if (collapsed && onExpandSidebar) {
      onExpandSidebar();
      setIsOpen(true);
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const label = navLabel(t, locale, item.labelKey);

  return (
    <div>
      <button
        type="button"
        onClick={handleHeaderClick}
        className={cn(
          "flex min-h-8 w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left text-[0.8125rem] font-semibold leading-tight tracking-[-0.005em] transition-colors duration-150 cursor-pointer",
          childActive
            ? "border-white/5 bg-white/10 text-white"
            : "text-[#e8eef8] hover:border-white/5 hover:bg-white/[0.07] hover:text-white",
          collapsed && "justify-center px-0",
        )}
        title={label}
        aria-expanded={isOpen}
      >
        {Icon ? (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 stroke-[1.7]",
              childActive ? "text-[var(--gp-primary-light)]" : "text-[#c5d4e8] group-hover:text-white",
            )}
          />
        ) : null}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate leading-tight">
              {label}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-[#c5d4e8] transition-transform duration-200",
                !isOpen && "-rotate-90",
              )}
            />
          </>
        )}
      </button>

      {isOpen && !collapsed && (
        <div className="ml-[1.05rem] mt-0.5 space-y-px border-l border-white/10 pl-2">
          {item.children?.map((child) => {
            if (child.children?.length) {
              return (
                <NestedNavGroup
                  key={child.labelKey}
                  child={child}
                  item={item}
                  pathname={pathname}
                  posMode={posMode}
                  collapsed={collapsed}
                />
              );
            }
            if (!child.href) return null;
            const ChildIcon = child.icon || item.icon;
            const active = isNavActive(child.href, pathname, posMode);
            const childLabel = navLabel(t, locale, child.labelKey);
            return (
              <Link
                key={child.href}
                href={child.href}
                title={childLabel}
                className={cn(
                  "flex min-h-7 items-center gap-2 rounded-md border border-transparent px-2 py-1 text-[0.8rem] font-semibold leading-tight tracking-[-0.005em] transition-all duration-150",
                  active
                    ? "border-white/10 bg-[var(--gp-primary)] text-white shadow-sm"
                    : "text-[#e8eef8] hover:border-white/5 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                {ChildIcon ? (
                  <ChildIcon className={cn("h-3.5 w-3.5 shrink-0 stroke-[1.7]", active ? "text-white" : "text-[#c5d4e8]")} />
                ) : null}
                <span className="min-w-0 truncate leading-tight">{childLabel}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NavSidebar({
  role,
  collapsed,
  onExpandSidebar,
}: {
  role?: string;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posMode = searchParams.get("mode");
  const tree = navForRole(role || "admin");

  return (
    <nav className="erp-nav-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {tree.map((item) => {
        if (!item.children?.length) {
          return (
            <NavLeaf
              key={item.labelKey}
              item={item}
              pathname={pathname}
              posMode={posMode}
              collapsed={collapsed}
            />
          );
        }
        return (
          <NavGroup
            key={item.labelKey}
            item={item}
            pathname={pathname}
            posMode={posMode}
            collapsed={collapsed}
            onExpandSidebar={onExpandSidebar}
          />
        );
      })}
    </nav>
  );
}
