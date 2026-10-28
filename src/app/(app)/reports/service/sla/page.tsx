"use client";

import { useLocale } from "next-intl";
import { ServiceReportBoard } from "@/components/service/ServiceReportBoard";

export default function SlaReportPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  return (
    <ServiceReportBoard
      kind="sla"
      title={bn ? "এসএলএ রিপোর্ট" : "SLA report"}
      subtitle={bn ? "ওপেন জব যেগুলো সময়সীমা পেরিয়েছে।" : "Open jobs past their response window."}
    />
  );
}
