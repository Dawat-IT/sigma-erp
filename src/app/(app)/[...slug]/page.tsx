import { notFound, redirect } from "next/navigation";
import { ModulePage } from "@/components/ModulePage";
import { resolveModuleFromPath } from "@/lib/path-module-map";
import { readSession } from "@/lib/auth";

const ADD_REDIRECTS: Record<string, string> = {
  "products-add": "/products",
  "purchases-add": "/purchases",
  "sales-add": "/pos",
  "sales-draft-add": "/pos",
  "sales-quote-add": "/pos",
  "expenses-add": "/expenses",
  "stock-transfers-add": "/stock/transfers",
  "stock-adjustments-add": "/stock/adjustments",
};

const ADMIN_ONLY_MODULES = new Set(["users", "roles"]);
const HR_PAYROLL_MODULES = new Set(["employees", "payroll", "payslips"]);

export default async function CatchAllModulePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (slug?.[0] === "api") notFound();
  const moduleId = resolveModuleFromPath(slug);
  if (!moduleId) notFound();
  if (ADD_REDIRECTS[moduleId]) redirect(ADD_REDIRECTS[moduleId]);

  if (ADMIN_ONLY_MODULES.has(moduleId)) {
    const session = await readSession();
    if (session?.role !== "admin") {
      redirect("/dashboard");
    }
  }

  if (HR_PAYROLL_MODULES.has(moduleId)) {
    const session = await readSession();
    if (session?.role !== "admin" && session?.role !== "accountant") {
      redirect("/dashboard");
    }
  }

  return <ModulePage moduleId={moduleId} />;
}
