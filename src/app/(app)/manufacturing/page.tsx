"use client";

import { useLocale, useTranslations } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";

export default function ManufacturingPage() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <div className="gp-desk">
      <PageHeader
        title={t("manufacturing.title")}
        subtitle={t("manufacturing.notUsed")}
      />
      <EmptyState
        title={locale === "bn" ? "এই মডিউল লুকানো" : "Module not in use"}
        message={t("manufacturing.notUsed")}
      />
    </div>
  );
}
