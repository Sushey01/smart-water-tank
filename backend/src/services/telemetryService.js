import { parseTelemetryTopic } from "../constants.js";
import { resolveSubsystem } from "../db.js";
import { evaluate } from "../rules/engine.js";
import { validateReading } from "../validateReading.js";
import { httpError } from "../middleware/errorHandler.js";

const chains = new Map();

function normalize(input) {
  const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw httpError(400, "timestamp is not a valid date");
  }
  const subsystem_id = input.subsystem_id || input.tank_id;
  return {
    home_id: input.home_id,
    subsystem_id,
    tank_id: input.tank_id || null,
    device_id: input.device_id,
    device_type: input.device_type,
    reading: input.reading,
    timestamp,
  };
}

export async function record(input) {
  const doc = normalize(input);
  for (const field of ["home_id", "subsystem_id", "device_id", "device_type"]) {
    if (!doc[field]) {
      throw httpError(400, `${field} is required`);
    }
  }
  const route = await resolveSubsystem(doc.subsystem_id);
  if (!route) {
    throw httpError(400, `Unknown subsystem '${doc.subsystem_id}'`);
  }
  const { Telemetry, DeviceLatest } = route.models;
  if (route.type === "water_tank") {
    doc.tank_id = doc.subsystem_id;
  }
  if (!doc.tank_id) {
    delete doc.tank_id;
  }
  validateReading(doc.device_type, doc.reading);
  const telemetry = new Telemetry(doc);
  await telemetry.save({ writeConcern: { w: 1 } });
  const existing = await DeviceLatest.findOne({ device_id: doc.device_id }).lean();
  if (existing && existing.timestamp > doc.timestamp) {
    return telemetry.toObject();
  }
  await DeviceLatest.findOneAndUpdate(
    { device_id: doc.device_id },
    {
      $set: {
        home_id: doc.home_id,
        subsystem_id: doc.subsystem_id,
        ...(doc.tank_id ? { tank_id: doc.tank_id } : {}),
        device_type: doc.device_type,
        reading: doc.reading,
        timestamp: doc.timestamp,
      },
    },
    { upsert: true, writeConcern: { w: 1 } }
  );
  await evaluate(doc.subsystem_id);
  return telemetry.toObject();
}

export function recordSerialized(input) {
  const key = input.subsystem_id || input.tank_id || "unknown";
  const previous = chains.get(key) || Promise.resolve();
  const next = previous.then(() => record(input));
  chains.set(key, next.catch(() => {}));
  return next;
}

export async function recordFromTopic(topic, body) {
  const parsed = parseTelemetryTopic(topic);
  if (!parsed) {
    throw httpError(400, "Unrecognised telemetry topic");
  }
  for (const field of ["home_id", "device_id", "device_type"]) {
    if (body[field] && body[field] !== parsed[field]) {
      throw httpError(400, `${field} does not match the MQTT topic`);
    }
  }
  if (body.subsystem_id && body.subsystem_id !== parsed.subsystem_id) {
    throw httpError(400, "subsystem_id does not match the MQTT topic");
  }
  if (body.tank_id && body.tank_id !== parsed.subsystem_id) {
    throw httpError(400, "tank_id does not match the MQTT topic");
  }
  return recordSerialized({
    ...parsed,
    tank_id: body.tank_id,
    reading: body.reading,
    timestamp: body.timestamp,
  });
}
