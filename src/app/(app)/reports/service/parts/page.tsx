"use client";

import { useLocale } from "next-intl";
import { ServiceReportBoard } from "@/components/service/ServiceReportBoard";

export default function PartsUsageReportPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  return (
    <ServiceReportBoard
      kind="parts"
      title={bn ? "পার্টস ব্যবহার" : "Parts usage"}
      subtitle={bn ? "সার্ভিস জবে ব্যবহৃত পার্টস ও পরিমাণ।" : "Parts consumed on service jobs."}
    />
  );
}
