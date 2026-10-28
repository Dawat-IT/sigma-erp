"use client";

import { useLocale } from "next-intl";
import { ServiceReportBoard } from "@/components/service/ServiceReportBoard";

export default function ComplaintReportPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  return (
    <ServiceReportBoard
      kind="complaints"
      title={bn ? "কমপ্লেইন রিপোর্ট" : "Complaint report"}
      subtitle={bn ? "ব্রেকডাউন টিকিট ও স্ট্যাটাস।" : "Breakdown tickets and status."}
    />
  );
}
