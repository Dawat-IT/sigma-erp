"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui";
import { formatBDT, formatDateBD } from "@/lib/utils";
import { PaymentStatusBadge } from "@/components/InvoiceActions";
import { formatClock, formatDuration } from "@/lib/service-visit";

export type ServiceJobRow = {
  _id: string;
  jobNo?: string;
  jobKind?: string;
  status?: string;
  issueDescription?: string;
  visitCharge?: number;
  serviceCharges?: number;
  serviceLines?: { name?: string; qty?: number }[];
  grandTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  receivedDate?: string;
  reportedAt?: string;
  customerId?: { name?: string; address?: string; location?: string; mobile?: string };
  technicianId?: { _id?: string; name?: string };
  siteName?: string;
  siteLocation?: string;
  siteAddress?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  durationMinutes?: number;
};

export function ServiceJobsTable({
  rows,
  loading,
  hideTechnician,
}: {
  rows: ServiceJobRow[];
  loading?: boolean;
  hideTechnician?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const bn = locale === "bn";

  return (
    <div className="gp-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="gp-table">
          <thead>
            <tr>
              <th>{bn ? "জব" : "Job"}</th>
              <th>{bn ? "কাস্টমার" : "Customer"}</th>
              {!hideTechnician ? <th>{bn ? "টেকনিশিয়ান" : "Technician"}</th> : null}
              <th>{bn ? "সার্ভিস (পরিমাণ)" : "Services (qty)"}</th>
              <th>{bn ? "চার্জ" : "Charges"}</th>
              <th>{bn ? "সময়" : "Time"}</th>
              <th>{bn ? "মোট / বাকি" : "Total / due"}</th>
              <th>{bn ? "স্ট্যাটাস" : "Status"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={hideTechnician ? 8 : 9} className="p-6 text-muted">{t("common.loading")}</td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={hideTechnician ? 8 : 9}>
                  <EmptyState message={bn ? "এই টেকনিশিয়ানের কোনো সার্ভিস জব নেই।" : "No service jobs yet."} />
                </td>
              </tr>
            ) : rows.map((job) => {
              const lines = (job.serviceLines || []).filter((row) => row.name);
              const techId = job.technicianId?._id;
              return (
                <tr key={job._id}>
                  <td>
                    <Link href={job.jobKind === "complaint" ? `/services/complaints/${job._id}` : `/services/${job._id}`} className="font-semibold text-[#2563eb]">{job.jobNo}</Link>
                    <p className="max-w-xs truncate text-xs text-muted">{job.issueDescription}</p>
                    <p className="text-xs text-muted">{formatDateBD(job.receivedDate || job.reportedAt || "", locale)}</p>
                  </td>
                  <td>
                    {job.customerId?.name || job.siteName || "—"}
                    {job.siteLocation || job.customerId?.location ? (
                      <p className="text-xs font-medium text-[#2563eb]">{job.siteLocation || job.customerId?.location}</p>
                    ) : null}
                    {job.siteAddress || job.customerId?.address ? (
                      <p className="max-w-[14rem] text-xs text-muted">{job.siteAddress || job.customerId?.address}</p>
                    ) : null}
                  </td>
                  {!hideTechnician ? (
                    <td>
                      {techId ? (
                        <Link href={`/services/technicians/${techId}`} className="font-medium text-[#2563eb]">
                          {job.technicianId?.name}
                        </Link>
                      ) : (
                        <span className="text-muted">{bn ? "অ্যাসাইন হয়নি" : "Unassigned"}</span>
                      )}
                    </td>
                  ) : null}
                  <td className="text-sm">
                    {lines.length
                      ? lines.map((row, i) => <p key={i}>{row.name} × {row.qty || 1}</p>)
                      : <span className="text-muted">{bn ? "লাইন নেই" : "No lines"}</span>}
                  </td>
                  <td className="whitespace-nowrap">
                    <p className="gp-money">{formatBDT(Number(job.serviceCharges || job.visitCharge || 0), locale)}</p>
                    <p className="text-xs text-muted">{bn ? "ভিজিট" : "Visit"} {formatBDT(Number(job.visitCharge || 0), locale)}</p>
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    <p>{bn ? "ইন" : "In"} {formatClock(job.checkedInAt, bn ? "bn" : "en")}</p>
                    <p>{bn ? "আউট" : "Out"} {formatClock(job.checkedOutAt, bn ? "bn" : "en")}</p>
                    <p className="font-semibold">
                      {job.checkedInAt ? formatDuration(Number(job.durationMinutes || 0), bn ? "bn" : "en") : "—"}
                    </p>
                  </td>
                  <td>
                    <p className="font-semibold">{formatBDT(Number(job.grandTotal || 0), locale)}</p>
                    <PaymentStatusBadge grandTotal={Number(job.grandTotal || 0)} paidAmount={Number(job.paidAmount || 0)} />
                  </td>
                  <td className="capitalize">{job.status}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/services/${job._id}`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "বিস্তারিত" : "Details"}</Link>
                    <Link href={`/services/${job._id}/invoice`} className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs">{bn ? "ইনভয়েস" : "Invoice"}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
