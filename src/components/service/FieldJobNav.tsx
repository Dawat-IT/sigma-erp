"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Camera, ClipboardCheck, Clock, FileText, Package, ShieldCheck } from "lucide-react";

const STEPS = [
  { href: "clock", en: "Clock", bn: "ক্লক", icon: Clock },
  { href: "checklist", en: "Checklist", bn: "চেকলিস্ট", icon: ClipboardCheck },
  { href: "photos", en: "Photos", bn: "ছবি", icon: Camera },
  { href: "parts", en: "Parts", bn: "পার্টস", icon: Package },
  { href: "report", en: "Report", bn: "রিপোর্ট", icon: FileText },
  { href: "confirm", en: "Confirm", bn: "কনফার্ম", icon: ShieldCheck },
] as const;

export function FieldJobNav({ id }: { id: string }) {
  const locale = useLocale();
  const bn = locale === "bn";
  return (
    <nav className="fld-steps">
      {STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <Link key={step.href} href={`/m/${id}/${step.href}`}>
            <Icon className="h-4 w-4" />
            {bn ? step.bn : step.en}
          </Link>
        );
      })}
    </nav>
  );
}
