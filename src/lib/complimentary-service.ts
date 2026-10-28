import { Machine, ServiceJob } from "@/models";

export function periodKeyOf(value: Date | string = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function commissionedMonth(machine: { commissionedAt?: unknown; purchaseDate?: unknown } | null | undefined) {
  const raw = machine?.commissionedAt || machine?.purchaseDate;
  if (!raw) return "";
  return periodKeyOf(new Date(String(raw)));
}

export async function complimentaryForJob(opts: {
  machineId?: unknown;
  jobKind?: string;
  jobId?: unknown;
  when?: Date;
}) {
  if (!opts.machineId) return { complimentary: false };
  if (String(opts.jobKind || "") === "installation") return { complimentary: false };
  const machine = await Machine.findById(opts.machineId).lean();
  if (!machine) return { complimentary: false };
  const month = commissionedMonth(machine);
  const now = periodKeyOf(opts.when || new Date());
  if (!month || month !== now) return { complimentary: false };
  const used = (machine as { complimentaryServiceJobId?: unknown }).complimentaryServiceJobId;
  if (used && String(used) !== String(opts.jobId || "")) return { complimentary: false };
  return { complimentary: true, machine };
}

export async function markComplimentaryUsed(machineId: unknown, jobId: unknown, when = new Date()) {
  if (!machineId || !jobId) return;
  await Machine.updateOne(
    {
      _id: machineId,
      $or: [{ complimentaryServiceJobId: { $exists: false } }, { complimentaryServiceJobId: null }],
    },
    { $set: { complimentaryServiceJobId: jobId, complimentaryPeriodKey: periodKeyOf(when) } },
  );
}

export async function complimentaryAlreadyUsed(machineId: unknown, excludeJobId?: unknown) {
  if (!machineId) return false;
  const existing = await ServiceJob.findOne({
    machineId,
    complimentary: true,
    ...(excludeJobId ? { _id: { $ne: excludeJobId } } : {}),
  }).select("_id");
  return Boolean(existing);
}
