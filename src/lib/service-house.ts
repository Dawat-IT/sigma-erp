import mongoose from "mongoose";
import { Contact, Machine } from "@/models";
import { resolveHouseSite } from "@/lib/service-visit";
import { jobPin, parseCoord } from "@/lib/service-field";

export async function houseSiteFromIds(body: {
  customerId?: unknown;
  machineId?: unknown;
  siteName?: unknown;
  siteLocation?: unknown;
  siteAddress?: unknown;
  lat?: unknown;
  lng?: unknown;
}) {
  const customerId = String(body.customerId || "");
  const machineId = String(body.machineId || "");
  const [customer, machine] = await Promise.all([
    mongoose.isValidObjectId(customerId)
      ? Contact.findById(customerId).select("name mobile address location city lat lng").lean()
      : null,
    mongoose.isValidObjectId(machineId)
      ? Machine.findById(machineId).select("siteName siteLocation siteAddress brand model serialNo machineType lat lng").lean()
      : null,
  ]);
  const pin = parseCoord(body.lat, body.lng) || jobPin(machine || {}) || jobPin(customer || {});
  return {
    ...resolveHouseSite({
      siteName: String(body.siteName || ""),
      siteLocation: String(body.siteLocation || ""),
      siteAddress: String(body.siteAddress || ""),
      customerId: customer,
      machineId: machine,
    }),
    ...(pin || {}),
  };
}
