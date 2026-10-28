import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session || session.role !== "admin") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
