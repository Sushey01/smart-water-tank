import { DEVICE_TYPES, READING_FIELDS } from "./constants.js";
import { httpError } from "./middleware/errorHandler.js";

export function validateReading(deviceType, reading) {
  if (!DEVICE_TYPES.includes(deviceType)) {
    throw httpError(400, `Unknown device_type '${deviceType}'`);
  }
  if (!reading || typeof reading !== "object") {
    throw httpError(400, "reading object is required");
  }
  for (const field of READING_FIELDS[deviceType]) {
    if (reading[field] === undefined || reading[field] === null) {
      throw httpError(400, `reading.${field} is required for ${deviceType}`);
    }
  }
  if (deviceType === "tank_level") {
    const level = Number(reading.level_pct);
    if (Number.isNaN(level) || level < 0 || level > 100) {
      throw httpError(400, "level_pct must be between 0 and 100");
    }
  }
  if (deviceType === "water_flow" && !["inflow", "outflow"].includes(reading.direction)) {
    throw httpError(400, "direction must be inflow or outflow");
  }
  if (deviceType === "motor_state" && !["on", "off"].includes(reading.state)) {
    throw httpError(400, "state must be on or off");
  }
  if (deviceType === "source_presence" && typeof reading.water_present !== "boolean") {
    throw httpError(400, "water_present must be a boolean");
  }
}
