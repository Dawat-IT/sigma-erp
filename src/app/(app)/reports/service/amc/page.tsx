"use client";

import { useLocale } from "next-intl";
import { ServiceReportBoard } from "@/components/service/ServiceReportBoard";

export default function AmcReportPage() {
  const locale = useLocale();
  const bn = locale === "bn";
  return (
    <ServiceReportBoard
      kind="amc"
      title={bn ? "এএমসি রিপোর্ট" : "AMC report"}
      subtitle={bn ? "চুক্তি স্ট্যাটাস, অ্যামাউন্ট ও ভিজিট কোটা।" : "Contract status, amount and visit quota."}
    />
  );
}
