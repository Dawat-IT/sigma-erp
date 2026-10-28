import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Business, User } from "@/models";
import { isSuperAdmin } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { PageAnimator } from "@/components/ui";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  await connectDB();
  const [business, user] = await Promise.all([
    Business.findOne().lean(),
    User.findById(session.id).select("avatarUrl").lean(),
  ]);

  return (
    <AppShell
      userName={session.name}
      role={session.role}
      logoUrl={(business as { logoUrl?: string } | null)?.logoUrl || ""}
      avatarUrl={(user as { avatarUrl?: string } | null)?.avatarUrl || ""}
      canUploadBranding={isSuperAdmin(session.role)}
    >
      <PageAnimator>{children}</PageAnimator>
    </AppShell>
  );
}
