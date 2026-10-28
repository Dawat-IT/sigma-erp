export type AuditAction =
  | "check_in"
  | "check_out"
  | "complete_job"
  | "void_sale"
  | "pay_slip"
  | "pay_all"
  | "stock_adjust"
  | "discount"
  | "otp_send"
  | "otp_verify"
  | "override_geofence"
  | "check_in_no_pin"
  | "amc_generate";

export async function writeAudit(input: {
  userId: string;
  userName?: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: string;
  details?: string;
}) {
  try {
    const { connectDB } = await import("@/lib/db");
    const { ActivityLog, User } = await import("@/models");
    await connectDB();
    let userName = input.userName?.trim();
    if (!userName) {
      const user = await User.findById(input.userId).select("name");
      userName = user?.name || "unknown";
    }
    await ActivityLog.create({
      userId: input.userId,
      userName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || "",
      details: input.details || "",
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
