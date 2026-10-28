import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { canManagePayroll } from "@/lib/rbac";

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session || !canManagePayroll(session.role)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
