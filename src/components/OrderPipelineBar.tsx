"use client";

import { useLocale } from "next-intl";
import { FileCheck, FileText, ScrollText } from "lucide-react";
import { orderStageIndex } from "@/lib/sale-pipeline";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, icon: ScrollText, en: "Proposal", bn: "প্রস্তাবনা" },
  { id: 2, icon: FileText, en: "Quotation", bn: "কোটেশন" },
  { id: 3, icon: FileCheck, en: "Confirm order", bn: "অর্ডার কনফার্ম" },
] as const;

export function OrderPipelineBar({ status, className }: { status?: string; className?: string }) {
  const locale = useLocale();
  const current = orderStageIndex(status);
  return (
    <ol className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      {STEPS.map((step, idx) => {
        const done = current > step.id || (current === 3 && step.id === 3);
        const active = current === step.id || (current === 0 && step.id === 1);
        const Icon = step.icon;
        return (
          <li key={step.id} className="flex items-center gap-2">
            {idx > 0 ? <span className="hidden text-muted sm:inline">→</span> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
                done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : active
                    ? "border-[var(--gp-primary)] bg-[var(--gp-primary-soft)] text-[var(--gp-ink)]"
                    : "border-line bg-white text-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {step.id}. {locale === "bn" ? step.bn : step.en}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
