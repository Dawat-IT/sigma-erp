export function leaveDays(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function attendanceMinutes(punchIn?: Date | null, punchOut?: Date | null) {
  if (!punchIn || !punchOut) return 0;
  return Math.max(0, Math.round((punchOut.getTime() - punchIn.getTime()) / 60000));
}

export const EMPLOYEE_PERSONAL_FIELDS = [
  "nid",
  "fatherName",
  "motherName",
  "dateOfBirth",
  "gender",
  "bloodGroup",
  "presentAddress",
  "permanentAddress",
  "emergencyName",
  "emergencyPhone",
  "bankName",
  "bankAccount",
  "bankRouting",
  "nidFrontUrl",
  "nidBackUrl",
  "workType",
  "speciality",
] as const;
