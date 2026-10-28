import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { FieldShell } from "@/components/FieldShell";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  return <FieldShell userName={session.name}>{children}</FieldShell>;
}
