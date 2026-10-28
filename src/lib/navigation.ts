import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  ShoppingCart,
  Wallet,
  BarChart3,
  Settings,
  UserCircle,
  Wrench,
  FileText,
  List,
  Cog,
  Briefcase,
  CalendarDays,
  Clock,
  ScrollText,
  Smartphone,
  Building2,
  SlidersHorizontal,
  Radio,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";

export type NavItem = {
  href?: string;
  labelKey: string;
  icon?: LucideIcon;
  moduleId?: string;
  defaultOpen?: boolean;
  children?: NavItem[];
};

/** Slim Sigma desk (~21 links). Hidden leftover routes still work by URL. */
export const NAV_TREE: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/m", labelKey: "nav.fieldToday", icon: Smartphone },
  {
    labelKey: "nav.salesCrm",
    icon: ShoppingCart,
    defaultOpen: true,
    children: [
      { href: "/contacts/customers", labelKey: "nav.customers", icon: Building2, moduleId: "customers" },
      { href: "/crm/leads", labelKey: "nav.allLeads", moduleId: "crm-leads" },
      { href: "/crm/followups", labelKey: "crm.followups", moduleId: "crm-followups" },
      { href: "/crm/client-followups", labelKey: "nav.clientFollowups", moduleId: "crm-followups" },
      { href: "/pos?mode=quotation", labelKey: "nav.pos", icon: FileText, moduleId: "pos" },
      { href: "/pos", labelKey: "nav.newOrder", icon: ShoppingCart, moduleId: "sales" },
      { href: "/sales/proposals", labelKey: "nav.listProposals", icon: ScrollText, moduleId: "sales-proposals" },
      { href: "/sales/quotations", labelKey: "nav.listQuotations", icon: FileText, moduleId: "sales-quotes" },
      { href: "/sales", labelKey: "nav.allSales", icon: List, moduleId: "sales" },
    ],
  },
  {
    labelKey: "nav.services",
    icon: Wrench,
    defaultOpen: true,
    children: [
      { href: "/services", labelKey: "nav.serviceDesk", icon: LayoutDashboard, moduleId: "services" },
      {
        labelKey: "nav.equipment",
        icon: Cog,
        children: [
          { href: "/services/machines", labelKey: "nav.equipmentList", moduleId: "machines" },
          { href: "/services/machines/new", labelKey: "nav.addEquipment", moduleId: "machines" },
          { href: "/services/projects", labelKey: "nav.installationHistory", moduleId: "services" },
          { href: "/services/history", labelKey: "nav.serviceHistory", moduleId: "services" },
        ],
      },
      {
        labelKey: "nav.maintenance",
        icon: CalendarDays,
        children: [
          { href: "/services/schedule", labelKey: "nav.maintenanceSchedule", moduleId: "machines" },
          { href: "/services/upcoming", labelKey: "nav.upcomingService", moduleId: "machines" },
          { href: "/services/due", labelKey: "nav.dueService", moduleId: "machines" },
          { href: "/services/amc", labelKey: "nav.amcContracts", moduleId: "machines" },
          { href: "/services/amc/dispatch", labelKey: "nav.autoDispatch", moduleId: "services" },
        ],
      },
      {
        labelKey: "nav.complaints",
        icon: AlertTriangle,
        children: [
          { href: "/services/complaints", labelKey: "nav.complaintList", moduleId: "services" },
          { href: "/services/complaints/new", labelKey: "nav.newComplaint", moduleId: "services" },
          { href: "/services/complaints/history", labelKey: "nav.complaintHistory", moduleId: "services" },
        ],
      },
      {
        labelKey: "nav.workOrders",
        icon: ClipboardList,
        children: [
          { href: "/services/jobs", labelKey: "nav.allWorkOrders", moduleId: "services" },
          { href: "/services/new", labelKey: "nav.newWorkOrder", moduleId: "services" },
          { href: "/services/jobs/pending", labelKey: "nav.woPending", moduleId: "services" },
          { href: "/services/jobs/in-progress", labelKey: "nav.woInProgress", moduleId: "services" },
          { href: "/services/jobs/completed", labelKey: "nav.woCompleted", moduleId: "services" },
          { href: "/services/jobs/cancelled", labelKey: "nav.woCancelled", moduleId: "services" },
        ],
      },
      {
        labelKey: "nav.technicianDispatch",
        icon: Clock,
        children: [
          { href: "/services/dispatch/assign", labelKey: "nav.assignTechnician", moduleId: "services" },
          { href: "/services/dispatch", labelKey: "nav.todaysVisits", moduleId: "services" },
          { href: "/services/dispatch/live", labelKey: "nav.liveTechnician", icon: Radio, moduleId: "services" },
        ],
      },
      { href: "/services/technicians", labelKey: "nav.technicians", moduleId: "technicians" },
      {
        labelKey: "nav.serviceReports",
        icon: BarChart3,
        children: [
          { href: "/reports/service", labelKey: "reports.service", moduleId: "report-service" },
          { href: "/reports/service/technician", labelKey: "nav.techPerformance", moduleId: "report-service" },
          { href: "/reports/service/equipment", labelKey: "nav.equipmentHistory", moduleId: "report-service" },
          { href: "/reports/service/parts", labelKey: "nav.partsUsage", moduleId: "report-service" },
          { href: "/reports/service/amc", labelKey: "nav.amcReport", moduleId: "report-service" },
          { href: "/reports/service/complaints", labelKey: "nav.complaintReport", moduleId: "report-service" },
          { href: "/reports/service/sla", labelKey: "nav.slaReport", moduleId: "report-service" },
        ],
      },
    ],
  },
  {
    labelKey: "nav.hrPayroll",
    icon: Briefcase,
    children: [
      { href: "/contacts/employees", labelKey: "nav.employees", moduleId: "payroll" },
      { href: "/hr/leaves", labelKey: "nav.leaves", moduleId: "payroll" },
      { href: "/hr/attendance", labelKey: "nav.attendance", moduleId: "payroll" },
      { href: "/hr/payroll", labelKey: "nav.payroll", icon: CalendarDays, moduleId: "payroll" },
    ],
  },
  {
    labelKey: "nav.products",
    icon: Package,
    children: [
      { href: "/products", labelKey: "nav.listProducts", moduleId: "products" },
    ],
  },
  {
    labelKey: "nav.purchases",
    icon: Truck,
    children: [
      { href: "/purchases", labelKey: "nav.listPurchases", moduleId: "purchases" },
    ],
  },
  {
    labelKey: "nav.adjustments",
    icon: SlidersHorizontal,
    children: [
      { href: "/stock/adjustments", labelKey: "nav.listAdjustments", moduleId: "stock-adjustments" },
    ],
  },
  {
    labelKey: "nav.expenses",
    icon: Wallet,
    children: [
      { href: "/expenses", labelKey: "nav.listExpenses", moduleId: "expenses" },
    ],
  },
  {
    labelKey: "nav.reports",
    icon: BarChart3,
    children: [
      { href: "/reports/profit-loss", labelKey: "reports.profitLoss", moduleId: "report-profit-loss" },
      { href: "/reports/stock", labelKey: "reports.stock", moduleId: "report-stock" },
    ],
  },
  {
    labelKey: "nav.settings",
    icon: Settings,
    children: [
      { href: "/settings", labelKey: "nav.businessSettings", moduleId: "settings-business" },
    ],
  },
  { href: "/users", labelKey: "nav.users", icon: Users, moduleId: "users" },
  { href: "/profile", labelKey: "nav.profile", icon: UserCircle, moduleId: "profile" },
];

const VIEWER_HREFS = new Set([
  "/dashboard",
  "/m",
  "/contacts/customers",
  "/services/dispatch",
  "/services",
  "/services/history",
  "/services/upcoming",
  "/services/due",
  "/services/machines",
  "/services/jobs",
  "/services/jobs/pending",
  "/services/jobs/in-progress",
  "/services/jobs/completed",
  "/services/jobs/cancelled",
  "/services/complaints",
  "/services/complaints/history",
  "/services/schedule",
  "/services/amc",
  "/services/dispatch",
  "/services/dispatch/assign",
  "/services/dispatch/live",
  "/reports/service",
  "/reports/service/technician",
  "/reports/service/equipment",
  "/reports/service/parts",
  "/reports/service/amc",
  "/reports/service/complaints",
  "/reports/service/sla",
  "/hr/arm",
  "/reports/profit-loss",
  "/reports/stock",
  "/reports/service",
  "/profile",
]);

const CASHIER_HREFS = new Set([
  "/dashboard",
  "/m",
  "/contacts/customers",
  "/pos?mode=quotation",
  "/pos",
  "/sales/quotations",
  "/sales",
  "/products",
  "/services/dispatch",
  "/profile",
]);

const ACCOUNTANT_HREFS = new Set([
  "/dashboard",
  "/hr/payroll",
  "/contacts/employees",
  "/hr/leaves",
  "/hr/attendance",
  "/purchases",
  "/stock/adjustments",
  "/expenses",
  "/reports/profit-loss",
  "/reports/stock",
  "/reports/service",
  "/settings",
  "/profile",
]);

function hrefAllowed(href: string | undefined, allow: Set<string> | null) {
  if (!href) return true;
  if (!allow) return true;
  return allow.has(href);
}

function filterTree(items: NavItem[], allow: Set<string> | null): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    const children = item.children ? filterTree(item.children, allow) : undefined;
    const selfOk = hrefAllowed(item.href, allow);
    if (item.href && selfOk) {
      out.push({ ...item, children: children?.length ? children : undefined });
    } else if (children?.length) {
      out.push({ ...item, children });
    }
  }
  return out;
}

const MANAGER_EXCLUDE_HREFS = new Set([
  "/users",
  "/settings",
  "/contacts/employees",
  "/hr/leaves",
  "/hr/attendance",
  "/hr/payroll",
  "/contacts/payslips",
]);

function filterTreeExcluding(items: NavItem[], exclude: Set<string>): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.href && exclude.has(item.href)) {
      continue;
    }
    const children = item.children ? filterTreeExcluding(item.children, exclude) : undefined;
    if (item.href) {
      out.push({ ...item, children: children?.length ? children : undefined });
    } else if (children?.length) {
      out.push({ ...item, children });
    }
  }
  return out;
}

export function navForRole(role: string): NavItem[] {
  if (role === "viewer") return filterTree(NAV_TREE, VIEWER_HREFS);
  if (role === "cashier") return filterTree(NAV_TREE, CASHIER_HREFS);
  if (role === "accountant") return filterTree(NAV_TREE, ACCOUNTANT_HREFS);
  if (role === "manager") return filterTreeExcluding(NAV_TREE, MANAGER_EXCLUDE_HREFS);
  return NAV_TREE;
}

export function flattenNav(items: NavItem[] = NAV_TREE): { href: string; moduleId?: string }[] {
  const out: { href: string; moduleId?: string }[] = [];
  for (const item of items) {
    if (item.href) out.push({ href: item.href, moduleId: item.moduleId });
    if (item.children) out.push(...flattenNav(item.children));
  }
  return out;
}
