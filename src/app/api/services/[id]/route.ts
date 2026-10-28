import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { requireDelete, requireWrite, roleRank } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { assertCanClock, serverNow } from "@/lib/service-clock";
import {
  assertCheckInGeo,
  ensureServiceFieldSchema,
  parseCoord,
  publicJob,
  readFieldFlags,
} from "@/lib/service-field";
import { ServiceJob, Product, Contact, Machine, Location } from "@/models";
import mongoose from "mongoose";
import { computeServiceTotals, completionGaps } from "@/lib/service-totals";
import { labourHoursFromMinutes, minutesBetween, parseDayStart, resolveHouseSite, sitePin } from "@/lib/service-visit";
import { houseSiteFromIds } from "@/lib/service-house";
import { normalizeCrew } from "@/lib/job-crew";
import { complimentaryForJob, markComplimentaryUsed } from "@/lib/complimentary-service";

const COMPLETE_STATUSES = new Set(["completed", "delivered", "closed"]);
const DONE_STATUSES = new Set(["completed", "delivered", "closed"]);

function applyTotals(job: mongoose.Document & Record<string, unknown>, totals: ReturnType<typeof computeServiceTotals>) {
  job.visitCharge = totals.visitCharge;
  job.serviceLines = totals.serviceLines;
  job.serviceLinesTotal = totals.serviceLinesTotal;
  job.serviceCharges = totals.serviceCharges;
  job.parts = totals.parts;
  job.partsTotal = totals.partsTotal;
  job.discount = totals.discount;
  job.tax = totals.tax;
  job.grandTotal = totals.grandTotal;
  job.paidAmount = totals.paidAmount;
  job.dueAmount = totals.dueAmount;
  job.markModified("serviceLines");
  job.markModified("parts");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  await ensureServiceFieldSchema();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const job = await ServiceJob.findById(id)
    .populate("customerId", "name mobile phone whatsapp address location city lat lng")
    .populate("machineId", "brand model serialNo machineType siteName siteLocation siteAddress lat lng")
    .populate("technicianId", "name mobile")
    .populate("technicianIds", "name mobile")
    .lean();

  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const site = resolveHouseSite(job);
  const pin = sitePin(job);
  return NextResponse.json({
    data: publicJob({
      ...job,
      ...site,
      lat: pin?.lat ?? (job as { lat?: number }).lat,
      lng: pin?.lng ?? (job as { lng?: number }).lng,
    } as Record<string, unknown>),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireWrite();
  if (error || !session) return error!;

  await connectDB();
  await ensureServiceFieldSchema();
  if (!ServiceJob.schema.path("checkedInAt")) {
    ServiceJob.schema.add({
      checkedInAt: Date,
      checkedOutAt: Date,
      durationMinutes: { type: Number, default: 0 },
    });
  }
  const { id } = await params;
  const body = await req.json();
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (Number(body.discount) > 0 && roleRank(session.role) < roleRank("manager")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  try {
    const existingJob = await ServiceJob.findById(id).session(mongoSession);
    if (!existingJob) {
      await mongoSession.abortTransaction();
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const storedClock = await ServiceJob.collection.findOne(
      { _id: existingJob._id },
      { projection: { checkedInAt: 1, checkedOutAt: 1, durationMinutes: 1, labourHours: 1, siteName: 1, siteLocation: 1, siteAddress: 1 } },
    );
    const storedIn = existingJob.get("checkedInAt") || storedClock?.checkedInAt || null;
    const storedOut = existingJob.get("checkedOutAt") || storedClock?.checkedOutAt || null;

    const previousStatus = existingJob.status;
    const newStatus = body.status || existingJob.status;

    if (body.status) existingJob.status = body.status;
    if (body.technicianId !== undefined || body.technicianIds !== undefined) {
      const crew = normalizeCrew(
        body.technicianId !== undefined ? body.technicianId : existingJob.technicianId,
        body.technicianIds !== undefined ? body.technicianIds : existingJob.technicianIds,
      );
      existingJob.technicianId = crew.technicianId;
      existingJob.set("technicianIds", crew.technicianIds);
    }
    if (body.issueDescription) existingJob.issueDescription = body.issueDescription;
    if (body.notes !== undefined) existingJob.notes = body.notes;
    if (body.customerId) existingJob.customerId = body.customerId;
    if (body.machineId !== undefined) existingJob.machineId = body.machineId || undefined;
    if (body.jobKind) existingJob.jobKind = body.jobKind;
    if (body.equipmentType !== undefined) existingJob.equipmentType = body.equipmentType;
    if (body.fieldStatus) existingJob.fieldStatus = body.fieldStatus;
    if (body.priority) existingJob.priority = body.priority;
    if (body.reportedBy !== undefined) existingJob.reportedBy = body.reportedBy;
    if (body.symptom !== undefined) existingJob.symptom = body.symptom;
    if (body.diagnosis !== undefined) existingJob.diagnosis = body.diagnosis;
    if (body.resolution !== undefined) existingJob.resolution = body.resolution;
    if (body.customerConfirmation !== undefined) existingJob.customerConfirmation = body.customerConfirmation;
    if (body.supervisorNote !== undefined) existingJob.supervisorNote = body.supervisorNote;
    if (body.travelNotes !== undefined) existingJob.travelNotes = body.travelNotes;
    if (body.nextAction !== undefined) existingJob.nextAction = body.nextAction;
    if (body.labourHours != null) existingJob.labourHours = Number(body.labourHours);
    if (body.billable != null) existingJob.billable = Boolean(body.billable);

    const siteTouched =
      body.siteName !== undefined ||
      body.siteLocation !== undefined ||
      body.siteAddress !== undefined ||
      body.customerId != null ||
      body.machineId !== undefined;
    const site = siteTouched
      ? await houseSiteFromIds({
          customerId: body.customerId ?? existingJob.customerId,
          machineId: body.machineId !== undefined ? body.machineId : existingJob.machineId,
          siteName: body.siteName ?? storedClock?.siteName,
          siteLocation: body.siteLocation ?? storedClock?.siteLocation,
          siteAddress: body.siteAddress ?? storedClock?.siteAddress,
        })
      : resolveHouseSite({
          siteName: storedClock?.siteName || existingJob.get("siteName"),
          siteLocation: storedClock?.siteLocation || existingJob.get("siteLocation"),
          siteAddress: storedClock?.siteAddress || existingJob.get("siteAddress"),
        });
    existingJob.siteName = site.siteName;
    existingJob.siteLocation = site.siteLocation;
    existingJob.siteAddress = site.siteAddress;
    const sitePatch = {
      siteName: site.siteName,
      siteLocation: site.siteLocation,
      siteAddress: site.siteAddress,
    };

    const action = String(body.action || "");
    const checkIn = action === "check_in" || body.checkIn === true;
    const checkOut = action === "check_out" || body.checkOut === true;
    if ((body.checkedInAt || body.checkedOutAt) && !checkIn && !checkOut) {
      await mongoSession.abortTransaction();
      return NextResponse.json({ error: "clock_locked" }, { status: 400 });
    }
    if (checkIn || checkOut) {
      const clockDeny = await assertCanClock(session, existingJob);
      if (clockDeny) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: clockDeny.error }, { status: clockDeny.status });
      }
    }
    const pinCoords = parseCoord(body.lat, body.lng);
    const clearPin = body.clearPin === true;
    if (pinCoords && !checkIn && !checkOut) {
      existingJob.set("lat", pinCoords.lat);
      existingJob.set("lng", pinCoords.lng);
    }
    if (clearPin && !checkIn && !checkOut) {
      existingJob.set("lat", undefined);
      existingJob.set("lng", undefined);
    }
    let clockPatch: {
      checkedInAt: Date | null;
      checkedOutAt: Date | null;
      durationMinutes: number;
      labourHours: number;
      checkInLat?: number | null;
      checkInLng?: number | null;
      checkInAccuracyM?: number | null;
      lat?: number;
      lng?: number;
    } | null = null;
    let checkInNoPin = false;
    let geoOverride: { reason: string; dist?: number } | null = null;
    if (checkIn) {
      if (!existingJob.technicianId) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: "need_technician" }, { status: 400 });
      }
      if (storedIn && !storedOut) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: "already_on_site" }, { status: 400 });
      }
      const flags = await readFieldFlags();
      const geo = await assertCheckInGeo(session, existingJob, body, flags);
      if (!geo.ok) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: geo.error, dist: geo.dist }, { status: geo.status });
      }
      if ("noPin" in geo) checkInNoPin = true;
      if ("override" in geo && geo.override) {
        geoOverride = { reason: geo.reason || "", dist: geo.dist };
      }
      const when = serverNow();
      const openOthers = await ServiceJob.find({
        _id: { $ne: existingJob._id },
        technicianId: existingJob.technicianId,
        checkedInAt: { $exists: true, $ne: null },
        $or: [{ checkedOutAt: { $exists: false } }, { checkedOutAt: null }],
      }).session(mongoSession);
      for (const other of openOthers) {
        other.checkedOutAt = when;
        other.durationMinutes = minutesBetween(other.checkedInAt, when);
        other.labourHours = labourHoursFromMinutes(other.durationMinutes);
        if (other.fieldStatus === "on_site") other.fieldStatus = "working";
        await other.save({ session: mongoSession });
      }
      existingJob.checkedInAt = when;
      existingJob.checkedOutAt = null;
      existingJob.durationMinutes = 0;
      existingJob.labourHours = 0;
      existingJob.fieldStatus = "on_site";
      const accuracy = Number(body.accuracy);
      clockPatch = { checkedInAt: when, checkedOutAt: null, durationMinutes: 0, labourHours: 0 };
      if (geo.ok && "lat" in geo && geo.lat != null) {
        existingJob.set("checkInLat", geo.lat);
        existingJob.set("checkInLng", geo.lng);
        if (Number.isFinite(accuracy)) existingJob.set("checkInAccuracyM", accuracy);
        clockPatch.checkInLat = geo.lat;
        clockPatch.checkInLng = geo.lng;
        clockPatch.checkInAccuracyM = Number.isFinite(accuracy) ? accuracy : null;
      }
      if (geo.ok && "pin" in geo && geo.pin && existingJob.get("lat") == null) {
        existingJob.set("lat", geo.pin.lat);
        existingJob.set("lng", geo.pin.lng);
        clockPatch.lat = geo.pin.lat;
        clockPatch.lng = geo.pin.lng;
      }
      if (["pending", "reported", "assigned"].includes(String(existingJob.status))) {
        existingJob.status = "in_progress";
      }
      if (!existingJob.scheduledDate) existingJob.scheduledDate = when;
    }
    if (checkOut) {
      if (!storedIn) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: "need_checkin" }, { status: 400 });
      }
      const when = serverNow();
      if (when.getTime() < new Date(storedIn).getTime()) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: "checkout_before_checkin" }, { status: 400 });
      }
      existingJob.checkedOutAt = when;
      existingJob.durationMinutes = minutesBetween(storedIn, when);
      existingJob.labourHours = labourHoursFromMinutes(existingJob.durationMinutes);
      clockPatch = {
        checkedInAt: new Date(storedIn),
        checkedOutAt: when,
        durationMinutes: existingJob.durationMinutes,
        labourHours: existingJob.labourHours,
      };
      if (existingJob.fieldStatus === "on_site") existingJob.fieldStatus = "working";
    }
    const resetClock = action === "reset_clock";
    if (resetClock) {
      const clockDeny = await assertCanClock(session, existingJob);
      if (clockDeny) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: clockDeny.error }, { status: clockDeny.status });
      }
      existingJob.checkedInAt = undefined;
      existingJob.checkedOutAt = undefined;
      existingJob.durationMinutes = 0;
      existingJob.labourHours = 0;
      existingJob.set("checkInLat", undefined);
      existingJob.set("checkInLng", undefined);
      existingJob.set("checkInAccuracyM", undefined);
      if (existingJob.fieldStatus === "on_site" || existingJob.fieldStatus === "working") {
        existingJob.fieldStatus = "assigned";
      }
      clockPatch = { checkedInAt: null, checkedOutAt: null, durationMinutes: 0, labourHours: 0 };
    }
    if (body.warrantyDays != null) existingJob.warrantyDays = Number(body.warrantyDays);
    if (Array.isArray(body.checklist)) existingJob.checklist = body.checklist;
    if (Array.isArray(body.readings)) existingJob.readings = body.readings;
    if (Array.isArray(body.payments)) existingJob.payments = body.payments;
    if (body.scheduledDate) {
      const scheduled = parseDayStart(body.scheduledDate);
      if (scheduled) existingJob.scheduledDate = scheduled;
    }
    if (body.expectedDeliveryDate) existingJob.expectedDeliveryDate = new Date(body.expectedDeliveryDate);
    if (body.statusHistoryNote || body.status !== previousStatus || body.fieldStatus) {
      existingJob.statusHistory = [
        ...(existingJob.statusHistory || []),
        {
          status: existingJob.status,
          fieldStatus: existingJob.fieldStatus,
          note: body.statusHistoryNote || "",
          changedAt: new Date(),
          changedBy: session.id,
        },
      ];
    }

    const billingTouched =
      body.serviceLines != null ||
      body.visitCharge != null ||
      body.parts != null ||
      body.discount != null ||
      body.tax != null ||
      body.payments != null ||
      body.paidAmount != null ||
      body.serviceCharges != null;

    const existingLines = Array.isArray(existingJob.serviceLines) ? existingJob.serviceLines : [];
    const visitChargeRaw =
      body.visitCharge != null
        ? body.visitCharge
        : existingJob.visitCharge ||
          (!existingLines.length && body.serviceCharges == null ? existingJob.serviceCharges : existingJob.visitCharge);
    const free = await complimentaryForJob({
      machineId: existingJob.machineId,
      jobKind: String(existingJob.jobKind || ""),
      jobId: existingJob._id,
    });
    if (free.complimentary) existingJob.complimentary = true;
    const visitCharge = free.complimentary ? 0 : visitChargeRaw;

    if (billingTouched || COMPLETE_STATUSES.has(String(newStatus))) {
      const totals = computeServiceTotals({
        serviceLines: body.serviceLines ?? existingJob.serviceLines,
        parts: body.parts ?? existingJob.parts,
        visitCharge: body.visitCharge != null ? body.visitCharge : visitCharge,
        discount: body.discount ?? existingJob.discount,
        tax: body.tax ?? existingJob.tax,
        payments: body.payments !== undefined
          ? body.payments
          : body.paidAmount != null
            ? undefined
            : existingJob.payments,
        paidAmount: body.paidAmount ?? existingJob.paidAmount,
      });
      applyTotals(existingJob as mongoose.Document & Record<string, unknown>, totals);
    } else if (body.serviceCharges != null && !existingLines.length) {
      existingJob.visitCharge = Number(body.serviceCharges);
      existingJob.serviceCharges = Number(body.serviceCharges);
      existingJob.grandTotal = Number(existingJob.partsTotal || 0) + Number(body.serviceCharges)
        - Number(existingJob.discount || 0) + Number(existingJob.tax || 0);
      existingJob.dueAmount = Math.max(0, existingJob.grandTotal - Number(existingJob.paidAmount || 0));
    }

    if (body.nextServiceDue && existingJob.machineId) {
      await Machine.updateOne(
        { _id: existingJob.machineId },
        { nextServiceDue: new Date(body.nextServiceDue) },
        { session: mongoSession },
      );
    }

    if (
      !DONE_STATUSES.has(String(previousStatus)) &&
      COMPLETE_STATUSES.has(String(newStatus))
    ) {
      const flags = await readFieldFlags();
      const gaps = completionGaps({
        technicianId: existingJob.technicianId,
        technicianIds: existingJob.get("technicianIds"),
        serviceLines: existingJob.serviceLines,
        parts: existingJob.parts,
        visitCharge: existingJob.visitCharge,
        resolution: existingJob.resolution,
        customerConfirmation: existingJob.customerConfirmation,
        checkedInAt: storedIn || existingJob.checkedInAt,
        otpVerifiedAt: existingJob.get("otpVerifiedAt"),
        photos: existingJob.get("photos") as { kind?: string; url?: string }[] | undefined,
        requireOtp: flags.requireOtp,
        requirePhoto: flags.requirePhoto,
      });
      const parts = Array.isArray(existingJob.parts) ? existingJob.parts : [];
      let locationId = body.locationId;
      if (!locationId && parts.length) {
        const loc = await Location.findOne().session(mongoSession);
        locationId = loc?._id;
      }
      if (parts.some((it: { productId?: unknown; qty?: number }) => it.productId && Number(it.qty) > 0) && !locationId) {
        gaps.push("location");
      }
      if (gaps.length) {
        await mongoSession.abortTransaction();
        return NextResponse.json({ error: "incomplete", gaps }, { status: 400 });
      }

      if (locationId) {
        for (const it of parts as { productId?: unknown; qty?: number; name?: string }[]) {
          const need = Number(it.qty || 0);
          if (!it.productId || need <= 0) continue;
          const product = await Product.findById(it.productId)
            .select("sku name stocks")
            .session(mongoSession);
          const row = (product?.stocks || []).find(
            (stock: { locationId?: unknown; qty?: number }) => String(stock.locationId) === String(locationId),
          );
          const have = Number(row?.qty || 0);
          if (have < need) {
            await mongoSession.abortTransaction();
            return NextResponse.json(
              { error: "insufficient_stock", sku: product?.sku || it.name, have, need },
              { status: 400 },
            );
          }
        }
      }

      existingJob.billable = true;
      existingJob.completedAt = existingJob.completedAt || new Date();
      if (storedIn && !storedOut) {
        existingJob.checkedOutAt = existingJob.completedAt;
        existingJob.durationMinutes = minutesBetween(storedIn, existingJob.checkedOutAt);
        existingJob.labourHours = labourHoursFromMinutes(existingJob.durationMinutes);
        clockPatch = {
          checkedInAt: new Date(storedIn),
          checkedOutAt: new Date(existingJob.checkedOutAt),
          durationMinutes: existingJob.durationMinutes,
          labourHours: existingJob.labourHours,
        };
      }
      if (!existingJob.fieldStatus || existingJob.fieldStatus === "working") {
        existingJob.fieldStatus = "completed";
      }
      if (newStatus === "delivered") {
        existingJob.deliveredDate = new Date();
      }

      if (locationId) {
        for (const it of parts) {
          if (!it.productId) continue;
          await Product.updateOne(
            { _id: it.productId, "stocks.locationId": locationId },
            { $inc: { "stocks.$.qty": -Number(it.qty || 0), quantity: -Number(it.qty || 0) } },
            { session: mongoSession },
          );
        }
      }

      if (existingJob.customerId && existingJob.dueAmount > 0) {
        await Contact.updateOne(
          { _id: existingJob.customerId },
          { $inc: { balance: existingJob.dueAmount } },
          { session: mongoSession },
        );
      }
    }

    if (existingJob.customerId && (body.contact || pinCoords || clearPin)) {
      const contact = (body.contact || {}) as Record<string, unknown>;
      const contactSet: Record<string, unknown> = {};
      if (typeof contact.name === "string" && contact.name.trim()) contactSet.name = contact.name.trim();
      if (typeof contact.mobile === "string" && contact.mobile.trim()) contactSet.mobile = contact.mobile.trim();
      if (contact.whatsapp !== undefined) contactSet.whatsapp = String(contact.whatsapp || "").trim();
      if (contact.address !== undefined) contactSet.address = String(contact.address || "").trim();
      if (contact.location !== undefined) contactSet.location = String(contact.location || "").trim();
      if (pinCoords) {
        contactSet.lat = pinCoords.lat;
        contactSet.lng = pinCoords.lng;
      }
      const contactUnset: Record<string, 1> = {};
      if (clearPin) {
        contactUnset.lat = 1;
        contactUnset.lng = 1;
      }
      if (Object.keys(contactSet).length || Object.keys(contactUnset).length) {
        await Contact.updateOne(
          { _id: existingJob.customerId },
          {
            ...(Object.keys(contactSet).length ? { $set: contactSet } : {}),
            ...(Object.keys(contactUnset).length ? { $unset: contactUnset } : {}),
          },
          { session: mongoSession },
        );
      }
    }
    if (existingJob.machineId && (siteTouched || pinCoords || clearPin)) {
      const machineSet: Record<string, unknown> = {};
      if (siteTouched) {
        machineSet.siteName = site.siteName;
        machineSet.siteLocation = site.siteLocation;
        machineSet.siteAddress = site.siteAddress;
      }
      if (pinCoords) {
        machineSet.lat = pinCoords.lat;
        machineSet.lng = pinCoords.lng;
      }
      const machineUnset: Record<string, 1> = {};
      if (clearPin) {
        machineUnset.lat = 1;
        machineUnset.lng = 1;
      }
      if (Object.keys(machineSet).length || Object.keys(machineUnset).length) {
        await Machine.updateOne(
          { _id: existingJob.machineId },
          {
            ...(Object.keys(machineSet).length ? { $set: machineSet } : {}),
            ...(Object.keys(machineUnset).length ? { $unset: machineUnset } : {}),
          },
          { session: mongoSession },
        );
      }
    }

    await existingJob.save({ session: mongoSession });
    const clock = clockPatch || {
      checkedInAt: existingJob.checkedInAt || null,
      checkedOutAt: existingJob.checkedOutAt || null,
      durationMinutes: Number(existingJob.durationMinutes || 0),
      labourHours: Number(existingJob.labourHours || 0),
    };
    const unsetFields: Record<string, 1> = {};
    if (clearPin) {
      unsetFields.lat = 1;
      unsetFields.lng = 1;
    }
    if (resetClock) {
      unsetFields.checkInLat = 1;
      unsetFields.checkInLng = 1;
      unsetFields.checkInAccuracyM = 1;
    }
    await ServiceJob.collection.updateOne(
      { _id: existingJob._id },
      {
        $set: { ...clock, ...sitePatch },
        ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
      },
      { session: mongoSession },
    );
    if (existingJob.complimentary && existingJob.machineId) {
      await markComplimentaryUsed(existingJob.machineId, existingJob._id);
    }
    await mongoSession.commitTransaction();
    if (checkIn) {
      await writeAudit({
        userId: session.id,
        userName: session.name,
        action: "check_in",
        entityType: "ServiceJob",
        entityId: String(existingJob._id),
        details: existingJob.jobNo,
      });
      if (checkInNoPin) {
        await writeAudit({
          userId: session.id,
          userName: session.name,
          action: "check_in_no_pin",
          entityType: "ServiceJob",
          entityId: String(existingJob._id),
          details: existingJob.jobNo,
        });
      }
      if (geoOverride) {
        await writeAudit({
          userId: session.id,
          userName: session.name,
          action: "override_geofence",
          entityType: "ServiceJob",
          entityId: String(existingJob._id),
          details: `tech:${String(existingJob.technicianId)} ${geoOverride.reason}`,
        });
      }
    }
    if (checkOut) {
      await writeAudit({
        userId: session.id,
        userName: session.name,
        action: "check_out",
        entityType: "ServiceJob",
        entityId: String(existingJob._id),
        details: existingJob.jobNo,
      });
    }
    if (resetClock) {
      await writeAudit({
        userId: session.id,
        userName: session.name,
        action: "reset_clock",
        entityType: "ServiceJob",
        entityId: String(existingJob._id),
        details: existingJob.jobNo,
      });
    }
    if (!DONE_STATUSES.has(String(previousStatus)) && COMPLETE_STATUSES.has(String(newStatus))) {
      await writeAudit({
        userId: session.id,
        userName: session.name,
        action: "complete_job",
        entityType: "ServiceJob",
        entityId: String(existingJob._id),
        details: existingJob.jobNo,
      });
    }
    if (Number(body.discount) > 0) {
      await writeAudit({
        userId: session.id,
        userName: session.name,
        action: "discount",
        entityType: "ServiceJob",
        entityId: String(existingJob._id),
        details: String(body.discount),
      });
    }
    return NextResponse.json({
      data: publicJob({ ...existingJob.toObject(), ...clock, ...sitePatch } as Record<string, unknown>),
    });
  } catch (e) {
    await mongoSession.abortTransaction();
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  } finally {
    mongoSession.endSession();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireDelete();
  if (error || !session) return error!;

  await connectDB();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const deleted = await ServiceJob.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
