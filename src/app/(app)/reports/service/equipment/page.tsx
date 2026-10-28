"use client";

import { useLocale } from "next-intl";
import { ServiceReportBoard } from "@/components/service/ServiceReportBoard";

export default function EquipmentHistoryReportPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  return (
    <ServiceReportBoard
      kind="equipment"
      title={bn ? "ইকুইপমেন্ট হিস্ট্রি" : "Equipment history"}
      subtitle={bn ? "মেশিন অনুযায়ী জব ও বিল।" : "Jobs and billed amount by machine."}
    />
  );
}
