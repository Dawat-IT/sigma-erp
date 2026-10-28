"use client";

import { useEffect, useState } from "react";
import { formatClock, formatDuration, minutesBetween } from "@/lib/service-visit";

export type VisitTimes = {
  checkedInAt?: string | Date | null;
  checkedOutAt?: string | Date | null;
  durationMinutes?: number;
};

export function VisitClock({
  visit,
  pending,
  canCheckIn = true,
  locale,
  onCheckIn,
  onCheckOut,
  onReset,
}: {
  visit: VisitTimes;
  pending?: boolean;
  canCheckIn?: boolean;
  locale: string;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onReset?: () => void;
}) {
  const bn = locale === "bn";
  const [tick, setTick] = useState(0);
  const onSite = Boolean(visit.checkedInAt) && !visit.checkedOutAt;

  useEffect(() => {
    if (!onSite) return;
    setTick(Date.now());
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [onSite, visit.checkedInAt]);

  const minutes = visit.checkedOutAt
    ? Number(visit.durationMinutes || minutesBetween(visit.checkedInAt, visit.checkedOutAt))
    : minutesBetween(visit.checkedInAt, tick ? new Date(tick) : visit.checkedInAt);

  return (
    <div className="gp-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {bn ? "কাস্টমার চেক-ইন / চেক-আউট" : "Customer check-in / check-out"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {bn
          ? "লিফট সার্ভিসে কতক্ষণ লাগল — চেক-ইন ও চেক-আউট থেকে হিসাব।"
          : "Tracks how long the lift service took at this customer."}
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">{bn ? "চেক-ইন" : "Check-in"}</dt>
          <dd className="font-semibold">{formatClock(visit.checkedInAt, bn ? "bn" : "en")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{bn ? "চেক-আউট" : "Check-out"}</dt>
          <dd className="font-semibold">{formatClock(visit.checkedOutAt, bn ? "bn" : "en")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{bn ? "সময়" : "Duration"}</dt>
          <dd className="font-semibold">
            {visit.checkedInAt ? formatDuration(minutes, bn ? "bn" : "en") : "—"}
            {onSite ? <span className="ml-2 text-xs font-bold text-emerald-700">{bn ? "লাইভ" : "live"}</span> : null}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="gp-btn gp-btn-primary"
          disabled={pending || !canCheckIn || onSite}
          onClick={onCheckIn}
        >
          {bn ? "কাস্টমারে চেক-ইন" : "Check in at customer"}
        </button>
        <button
          type="button"
          className="gp-btn"
          disabled={pending || !onSite}
          onClick={onCheckOut}
        >
          {bn ? "চেক-আউট" : "Check out"}
        </button>
        {visit.checkedInAt && onReset ? (
          <button type="button" className="gp-btn gp-btn-ghost" disabled={pending} onClick={onReset}>
            {bn ? "ক্লক মুছুন" : "Clear clock"}
          </button>
        ) : null}
      </div>
      {!canCheckIn ? (
        <p className="mt-2 text-xs text-muted">{bn ? "আগে টেকনিশিয়ান অ্যাসাইন করুন।" : "Assign a technician first."}</p>
      ) : null}
    </div>
  );
}
