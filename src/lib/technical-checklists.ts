/** Equipment-specific service checks from Sigma Elevator / Power Solution ERP blueprint §6. */

export type EquipmentLineValue =
  | "Lift"
  | "Escalator"
  | "Generator"
  | "SubStation"
  | "VoltageStabilizer"
  | "ARD";

export type TechnicalJobKind = "complaint" | "scheduled" | "emergency" | "installation";

export type ChecklistRow = { item: string; done?: boolean; note?: string };
export type ReadingRow = { key: string; label: string; value?: string; unit?: string };

export type TechnicalJobLike = {
  status?: string;
  type?: string;
  jobKind?: string;
  priority?: string;
  reportedAt?: string | Date;
  createdAt?: string | Date;
  customerConfirmation?: string;
  supervisorNote?: string;
  travelNotes?: string;
  nextAction?: string;
  symptom?: string;
  billable?: boolean;
  labourHours?: number;
  parts?: unknown[];
  partsUsed?: unknown[];
  checklist?: ChecklistRow[];
  diagnosis?: string;
  resolution?: string;
  fieldStatus?: string;
  technicianId?: unknown;
  assignedTechnicians?: unknown[];
  readings?: ReadingRow[];
};

export const EQUIPMENT_LINES = [
  {
    value: "Lift",
    label: "Lift & Elevator",
    summary: "Door, motor, VVVF/controller, brake, safety circuit, emergency rescue.",
  },
  {
    value: "Escalator",
    label: "Escalator",
    summary: "Step/chain, handrail, motor, brake, sensors, emergency stop, lubrication.",
  },
  {
    value: "Generator",
    label: "Generator",
    summary: "Engine, alternator, battery, ATS/AMF, fuel, load test, voltage/frequency.",
  },
  {
    value: "SubStation",
    label: "Sub-station",
    summary: "Transformer, HT/LT panel, switchgear, protection, cable, testing.",
  },
  {
    value: "VoltageStabilizer",
    label: "Voltage stabilizer",
    summary: "Online/offline AVR, I/O test, PCB, component replacement, PM.",
  },
  {
    value: "ARD",
    label: "ARD",
    summary: "Battery, charger, rescue test, control panel, fault diagnosis.",
  },
];

export const TECHNICAL_JOB_TYPES = [
  { value: "complaint", label: "Breakdown" },
  { value: "scheduled", label: "Preventive" },
  { value: "emergency", label: "Emergency" },
];

export const PROJECT_STATUSES = [
  { value: "reported", label: "Planned" },
  { value: "assigned", label: "Site assigned" },
  { value: "in_progress", label: "Installing" },
  { value: "resolved", label: "Commissioned" },
  { value: "closed", label: "Handed over" },
];

const CHECKLISTS: Record<string, string[]> = {
  Lift: [
    "Door system inspection",
    "Motor / machine room",
    "VVVF / controller",
    "Brake test",
    "Safety circuit",
    "Emergency rescue / ARD",
    "Preventive maintenance",
    "Spare parts recorded",
  ],
  Escalator: [
    "Step and chain inspection",
    "Handrail",
    "Motor",
    "Brake",
    "Safety sensors",
    "Emergency stop",
    "Lubrication",
    "Breakdown service notes",
  ],
  Generator: [
    "Engine",
    "Alternator",
    "Battery",
    "Charger",
    "ATS / AMF",
    "Fuel system",
    "Load test",
    "Oil / coolant",
    "Output voltage and frequency",
  ],
  SubStation: [
    "Transformer",
    "HT / LT panel",
    "Switchgear",
    "Protection system",
    "Cable / connection",
    "Testing and commissioning",
  ],
  VoltageStabilizer: [
    "Online / offline mode",
    "AVR",
    "Input / output testing",
    "PCB inspection / repair",
    "Component replacement",
    "Preventive maintenance",
  ],
  ARD: [
    "Installation check",
    "Battery",
    "Charger",
    "Emergency rescue test",
    "Control panel",
    "Fault diagnosis / replacement",
  ],
};

const INSTALL_CHECKLISTS: Record<string, string[]> = {
  Lift: [
    "Site / shaft readiness",
    "Delivery and positioning",
    "Guide rail and car installation",
    "Door system installation",
    "Motor, VVVF and controller",
    "Brake and safety circuit",
    "Testing and commissioning",
    "Emergency rescue / ARD handover",
    "Customer confirmation",
  ],
  Escalator: [
    "Site readiness",
    "Truss and step installation",
    "Handrail installation",
    "Motor and brake",
    "Safety sensors and emergency stop",
    "Testing and commissioning",
    "Customer confirmation",
  ],
  Generator: [
    "Foundation and positioning",
    "Engine–alternator coupling",
    "Fuel, battery and charger",
    "ATS / AMF wiring",
    "Load test",
    "Voltage / frequency commissioning",
    "Handover",
  ],
  SubStation: [
    "Transformer positioning",
    "HT / LT panel installation",
    "Switchgear and protection",
    "Cable termination",
    "Testing and commissioning",
    "Handover",
  ],
  VoltageStabilizer: [
    "Mounting / positioning",
    "Input / output connection",
    "AVR setup",
    "Input / output testing",
    "Commissioning",
    "Handover",
  ],
  ARD: [
    "Unit installation",
    "Battery and charger",
    "Control panel",
    "Emergency rescue test",
    "Commissioning",
    "Customer confirmation",
  ],
};

export function equipmentLine(type?: string) {
  return EQUIPMENT_LINES.find((line) => line.value === type) || null;
}

export function checklistItemsFor(type?: string, jobType = "complaint") {
  if (jobType === "installation") {
    return INSTALL_CHECKLISTS[type || ""] || INSTALL_CHECKLISTS.Lift;
  }
  return CHECKLISTS[type || ""] || CHECKLISTS.Lift;
}

export function checklistForEquipment(type?: string, jobType = "complaint") {
  return checklistItemsFor(type, jobType).map((item) => ({ item, done: false }));
}

export function projectStatusLabel(status?: string) {
  return PROJECT_STATUSES.find((row) => row.value === status)?.label || status || "—";
}

export function checklistProgress(checklist?: ChecklistRow[]) {
  const items = Array.isArray(checklist) ? checklist : [];
  if (!items.length) return { done: 0, total: 0, percent: 0, label: "—" };
  const done = items.filter((row) => row.done).length;
  const percent = Math.round((done / items.length) * 100);
  return { done, total: items.length, percent, label: `${done}/${items.length}` };
}

export const TECHNICAL_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const FIELD_STATUSES = [
  { value: "assigned", label: "Assigned" },
  { value: "en_route", label: "On the way" },
  { value: "on_site", label: "On site" },
  { value: "working", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export const OFFICE_STATUSES = [
  { value: "reported", label: "Reported", hint: "Complaint logged, waiting for dispatch." },
  { value: "assigned", label: "Assigned", hint: "Technician named. Next: on the way." },
  { value: "in_progress", label: "In progress", hint: "On site — diagnosis, checklist, parts." },
  { value: "resolved", label: "Resolved", hint: "Repair done. Get customer confirmation." },
  { value: "completed", label: "Completed", hint: "Billed. Invoice is ready." },
  { value: "closed", label: "Closed", hint: "History updated. Invoice if billable." },
];

export const EQUIPMENT_KNOWLEDGE: Record<
  string,
  {
    label: string;
    skill: string;
    pmDays: number;
    workflow: string;
    inspect: string[];
    faults: string[];
    safety: string[];
    tools: string[];
    typicalParts: string[];
    closeout: string;
  }
> = {
  Lift: {
    label: "Lift & Elevator",
    skill: "Lift technician",
    pmDays: 30,
    workflow: "Door → motor/VVVF → brake → safety circuit → emergency rescue.",
    inspect: [
      "Door operator, locks and landing sills",
      "Motor, gearbox and machine-room temperature",
      "VVVF / controller faults and error codes",
      "Brake air-gap and holding torque",
      "Safety circuit, overspeed governor, buffers",
      "Emergency rescue / ARD battery and test run",
    ],
    faults: [
      "Door not closing / repeated reopen",
      "Car not leveling at floor",
      "Drive/inverter fault trip",
      "Brake slip or noisy machine",
      "Safety chain open — will not run",
      "Car trapped between floors",
    ],
    safety: [
      "Lock out landing doors before shaft work.",
      "Never ride the car roof without a trained second person.",
      "Prove safety circuit closed before returning to service.",
    ],
    tools: ["Multimeter", "Door gap gauge", "Brake feeler", "Controller laptop / HHT", "Lock-out kit"],
    typicalParts: ["Door roller / belt", "Lock contact", "Brake lining", "Contactor", "ARD battery"],
    closeout: "Test full door cycle, leveling, rescue run, then customer sign-off.",
  },
  Escalator: {
    label: "Escalator",
    skill: "Escalator technician",
    pmDays: 30,
    workflow: "Steps/chain → handrail → motor/brake → sensors → lubrication.",
    inspect: [
      "Step and chain tension, missing or damaged steps",
      "Handrail speed vs step speed",
      "Motor, brake and gearbox oil",
      "Comb plate, safety sensors, emergency stop",
      "Lubrication of chain and tracks",
    ],
    faults: [
      "Step sag or chain noise",
      "Handrail slip",
      "Nuisance emergency-stop trips",
      "Overheat / brake not releasing",
      "Comb-plate damage",
    ],
    safety: ["Barrier the landing before removing steps.", "Prove emergency stop after every visit."],
    tools: ["Chain gauge", "Handrail speed meter", "Grease gun", "Barrier tape", "Multimeter"],
    typicalParts: ["Step insert", "Comb segment", "Handrail", "Proximity sensor", "Chain pin"],
    closeout: "Run both directions, prove E-stop, record lubrication, then sign-off.",
  },
  Generator: {
    label: "Generator",
    skill: "Generator / electrical technician",
    pmDays: 30,
    workflow: "Engine → alternator → battery/charger → ATS/AMF → load test → oil/coolant → voltage/Hz.",
    inspect: [
      "Engine oil, coolant, belts, leaks",
      "Alternator connections and heating",
      "Battery voltage, charger, cranking",
      "ATS/AMF transfer and fail-to-mains",
      "Fuel level, water in fuel, filters",
      "Load test: voltage, frequency, kW",
    ],
    faults: [
      "Fail to start / weak battery",
      "ATS not transferring",
      "Unstable voltage or Hz under load",
      "Overheating or low oil pressure",
      "Fuel contamination",
    ],
    safety: ["Exhaust and fuel isolation before work.", "Never load-test without confirming cable rating."],
    tools: ["Clamp meter", "Load bank / building load", "Hydrometer", "Oil sample bottle"],
    typicalParts: ["Battery", "Fuel filter", "Oil filter", "AVR", "ATS contactor"],
    closeout: "Record V/Hz/kW under load, oil/coolant levels, next PM due.",
  },
  SubStation: {
    label: "Sub-station",
    skill: "HT/LT electrician (permit-to-work)",
    pmDays: 90,
    workflow: "Transformer → HT/LT panel → switchgear → protection → cables → testing.",
    inspect: [
      "Transformer oil level, temperature, noise",
      "HT/LT panel tightness and labelling",
      "Switchgear, interlocks, earthing",
      "Protection relays and trip history",
      "Cable terminations and heat marks",
    ],
    faults: [
      "Earth fault / overcurrent trip",
      "Hot termination",
      "Buchholz or temperature alarm",
      "Panel door / interlock failure",
    ],
    safety: ["Permit-to-work and HT isolation before opening panels.", "Prove dead. PPE for arc flash."],
    tools: ["Insulation tester", "Thermal camera / IR gun", "Earth tester", "Torque wrench"],
    typicalParts: ["HT fuse", "Relay", "Bushing", "Cable lug", "Silica gel"],
    closeout: "Restore isolation, prove protection, log IR readings, handover.",
  },
  VoltageStabilizer: {
    label: "Voltage stabilizer",
    skill: "Electronics / AVR technician",
    pmDays: 60,
    workflow: "Mode → AVR → input/output test → PCB → components → PM.",
    inspect: [
      "Online vs offline / bypass mode",
      "AVR response to input swing",
      "Input and output voltage, current, heat",
      "PCB, relays, carbon brushes / servo",
      "Capacitors and wiring tightness",
    ],
    faults: ["Output hunting or no regulation", "Stuck in bypass", "PCB burn or relay chatter", "Overload trip"],
    safety: ["Confirm input isolation.", "Discharge capacitors before PCB work."],
    tools: ["Multimeter", "Variac / input swing", "Soldering iron", "IR thermometer"],
    typicalParts: ["AVR board", "Relay", "Carbon brush", "Capacitor", "Servo motor"],
    closeout: "Record I/O voltages across swing, confirm not in bypass, sign-off.",
  },
  ARD: {
    label: "ARD (Automatic Rescue Device)",
    skill: "Lift + ARD technician",
    pmDays: 30,
    workflow: "Battery → charger → rescue test → control panel → fault diagnosis.",
    inspect: [
      "Battery bank voltage and age",
      "Charger output and float",
      "Rescue run to nearest floor",
      "Control panel inputs from lift controller",
      "Changeover contactors",
    ],
    faults: [
      "No rescue on power-cut",
      "Battery not taking charge",
      "False rescue or door lock not proving",
      "Contactor not changing over",
    ],
    safety: ["Test rescue only with landing clear.", "Do not jump batteries of mixed age."],
    tools: ["Multimeter", "Battery tester", "Controller interface"],
    typicalParts: ["Battery bank", "Charger board", "Changeover contactor", "Control fuse"],
    closeout: "Simulate mains fail, confirm nearest-floor rescue and door open, log battery V.",
  },
};

export const JOB_TYPE_HELP = {
  complaint: {
    label: "Breakdown",
    slaHours: 24,
    intent: "Unit failed in service. Restore safely, then record root cause so the same serial does not repeat.",
    steps: [
      "Log client, unit serial, fault and reporter",
      "Assign a skill-matched technician",
      "On the way → on site",
      "Diagnose + digital checklist + readings",
      "Issue parts and labour hours",
      "Customer confirmation",
      "Close, update asset history, invoice if billable",
    ],
  },
  emergency: {
    label: "Emergency",
    slaHours: 4,
    intent: "People trapped, no power, or unsafe equipment. Make-safe first; full repair can follow.",
    steps: [
      "Dispatch immediately (SLA 4 hours)",
      "On site rescue / isolation",
      "Make-safe",
      "Temporary or full repair",
      "Supervisor note + follow-up PM if needed",
    ],
  },
  scheduled: {
    label: "Preventive",
    slaHours: 72,
    intent: "Calendar PM from the asset register. Tick the full type checklist and set the next due date.",
    steps: [
      "Open from PM-due list or schedule date",
      "Run the equipment-type PM checklist",
      "Record site readings",
      "Log any parts consumed",
      "Set next service due on the unit",
    ],
  },
  installation: {
    label: "Installation",
    slaHours: 168,
    intent: "Site install through commissioning and handover. Use the installation checklist for this equipment line.",
    steps: [
      "Confirm site readiness",
      "Assign installation crew",
      "Install per equipment playbook",
      "Test, commission, customer confirmation",
      "Hand over and set first PM due",
    ],
  },
};

export function knowledgeFor(type?: string) {
  return (type && EQUIPMENT_KNOWLEDGE[type]) || null;
}

export function slaHoursFor(jobType?: string, priority?: string) {
  if (priority === "urgent" || jobType === "emergency") return 4;
  if (priority === "high" || jobType === "complaint") return 24;
  if (priority === "low") return 120;
  return JOB_TYPE_HELP[jobType as keyof typeof JOB_TYPE_HELP]?.slaHours || 48;
}

export function slaState(record?: TechnicalJobLike) {
  if (["resolved", "closed", "completed", "delivered"].includes(String(record?.status || ""))) return { key: "done", label: "Closed loop", hours: 0 };
  const start = new Date(record?.reportedAt || record?.createdAt || Date.now()).getTime();
  const hours = (Date.now() - start) / 36e5;
  const limit = slaHoursFor(record?.jobKind || record?.type, record?.priority);
  if (hours > limit) return { key: "overdue", label: `Overdue ${Math.round(hours - limit)}h`, hours };
  if (hours > limit * 0.7) return { key: "due", label: `${Math.max(0, Math.round(limit - hours))}h left`, hours };
  return { key: "ok", label: `${Math.round(limit - hours)}h SLA`, hours };
}

export function fieldStatusLabel(value?: string) {
  return FIELD_STATUSES.find((row) => row.value === value)?.label || value || "—";
}

export function officeStatusLabel(value?: string) {
  return OFFICE_STATUSES.find((row) => row.value === value)?.label || value || "—";
}

export function jobTypeLabel(value?: string) {
  return TECHNICAL_JOB_TYPES.find((row) => row.value === value)?.label || value || "—";
}

/** 10-step service lifecycle from Sigma Power Solution ERP blueprint. */
export const SERVICE_SOP = [
  { key: "request", label: "Service request", hint: "Client, unit, fault, priority." },
  { key: "assign", label: "Assign technician", hint: "Skill-match the equipment line." },
  { key: "en_route", label: "On the way", hint: "Field: dispatched." },
  { key: "on_site", label: "On site", hint: "Lock-out, inspect, safety." },
  { key: "diagnose", label: "Diagnose", hint: "Readings, error codes, root cause." },
  { key: "checklist", label: "Digital checklist", hint: "Tick every item for this unit type." },
  { key: "parts", label: "Parts & labour", hint: "Issue parts, record hours." },
  { key: "repair", label: "Repair & test", hint: "Make-safe, test run, photos." },
  { key: "confirm", label: "Customer confirm", hint: "Name / sign-off." },
  { key: "close", label: "Close & bill", hint: "History, next PM due, invoice if billable." },
];

export const READING_FIELDS: Record<string, { key: string; label: string; unit: string }[]> = {
  Lift: [
    { key: "lineVoltage", label: "Line voltage", unit: "V" },
    { key: "motorCurrent", label: "Motor current", unit: "A" },
    { key: "brakeGap", label: "Brake air-gap", unit: "mm" },
    { key: "leveling", label: "Leveling error", unit: "mm" },
    { key: "doorTime", label: "Door cycle", unit: "s" },
    { key: "ardBattery", label: "ARD battery", unit: "V" },
  ],
  Escalator: [
    { key: "handrailSpeed", label: "Handrail vs step", unit: "%" },
    { key: "motorCurrent", label: "Motor current", unit: "A" },
    { key: "chainTension", label: "Chain tension", unit: "mm" },
    { key: "brakeTest", label: "Brake stop distance", unit: "mm" },
  ],
  Generator: [
    { key: "batteryV", label: "Battery", unit: "V" },
    { key: "oilPressure", label: "Oil pressure", unit: "bar" },
    { key: "coolantTemp", label: "Coolant temp", unit: "°C" },
    { key: "voltage", label: "Output voltage", unit: "V" },
    { key: "frequency", label: "Frequency", unit: "Hz" },
    { key: "loadKw", label: "Load", unit: "kW" },
  ],
  SubStation: [
    { key: "oilTemp", label: "Oil temperature", unit: "°C" },
    { key: "htVoltage", label: "HT voltage", unit: "kV" },
    { key: "ltVoltage", label: "LT voltage", unit: "V" },
    { key: "earthOhm", label: "Earth resistance", unit: "Ω" },
    { key: "irMohm", label: "Insulation", unit: "MΩ" },
  ],
  VoltageStabilizer: [
    { key: "inputV", label: "Input voltage", unit: "V" },
    { key: "outputV", label: "Output voltage", unit: "V" },
    { key: "loadA", label: "Load current", unit: "A" },
    { key: "tempC", label: "Cabinet temp", unit: "°C" },
  ],
  ARD: [
    { key: "batteryV", label: "Battery bank", unit: "V" },
    { key: "chargerV", label: "Charger output", unit: "V" },
    { key: "rescueTime", label: "Rescue time", unit: "s" },
  ],
};

export function blankReadings(type?: string) {
  return (READING_FIELDS[type || ""] || []).map((row) => ({ ...row, value: "" }));
}

export function mergeReadings(type?: string, existing?: ReadingRow[]) {
  const map = Object.fromEntries((existing || []).map((row) => [row.key, row]));
  return blankReadings(type).map((row) => ({
    ...row,
    value: map[row.key]?.value ?? row.value ?? "",
  }));
}

export function sopStepIndex(record?: TechnicalJobLike) {
  if (!record) return 0;
  if (record.status === "closed") return 9;
  if (record.status === "resolved" || record.customerConfirmation) return 8;
  if (record.resolution) return 7;
  if ((record.partsUsed || record.parts || []).length || Number(record.labourHours) > 0) return 6;
  if ((record.checklist || []).some((row) => row.done)) return 5;
  if (record.diagnosis) return 4;
  if (record.fieldStatus === "on_site" || record.fieldStatus === "working") return 3;
  if (record.fieldStatus === "en_route") return 2;
  if (record.status === "assigned" || record.technicianId || (record.assignedTechnicians || []).length) return 1;
  return 0;
}

export function nextSopHint(record?: TechnicalJobLike) {
  const closed = record?.status === "closed";
  const index = Math.min(sopStepIndex(record) + (closed ? 0 : 1), SERVICE_SOP.length - 1);
  const step = SERVICE_SOP[closed ? 9 : index];
  return step ? `${step.label} — ${step.hint}` : "";
}
