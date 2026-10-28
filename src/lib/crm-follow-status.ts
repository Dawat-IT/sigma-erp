export function followUpStatusLabel(status: string | undefined, bn: boolean) {
  const key = String(status || "").toLowerCase().replace(/-/g, "_");
  if (key === "scheduled") return bn ? "শিডিউলড" : "Scheduled";
  if (key === "ongoing") return bn ? "চলমান" : "Ongoing";
  if (key === "on_hold") return bn ? "হোল্ড" : "On hold";
  if (key === "unreachable") return bn ? "ধরা যায়নি" : "Unreachable";
  if (key === "completed") return bn ? "সম্পন্ন" : "Completed";
  if (key === "missed") return bn ? "মিসড" : "Missed";
  return status || "—";
}

export function followUpStatusTone(status: string | undefined) {
  const key = String(status || "").toLowerCase().replace(/-/g, "_");
  if (key === "completed") return "gp-badge-success";
  if (key === "ongoing" || key === "scheduled") return "bg-[var(--gp-primary-soft)] text-[var(--gp-primary)]";
  if (key === "missed" || key === "unreachable") return "gp-badge-danger";
  if (key === "on_hold") return "gp-badge-warn";
  return "gp-badge-warn";
}
