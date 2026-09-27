import { parseTelemetryTopic } from "../constants.js";
import { DeviceLatest, Telemetry } from "../models/index.js";
import { evaluate } from "../rules/engine.js";
import { validateReading } from "../validateReading.js";
import { httpError } from "../middleware/errorHandler.js";

const chains = new Map();

function normalize(input) {
  const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw httpError(400, "timestamp is not a valid date");
  }
  return {
    home_id: input.home_id,
    tank_id: input.tank_id,
    device_id: input.device_id,
    device_type: input.device_type,
    reading: input.reading,
    timestamp,
  };
}

export async function record(input) {
  const doc = normalize(input);
  for (const field of ["home_id", "tank_id", "device_id", "device_type"]) {
    if (!doc[field]) {
      throw httpError(400, `${field} is required`);
    }
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
        tank_id: doc.tank_id,
        device_type: doc.device_type,
        reading: doc.reading,
        timestamp: doc.timestamp,
      },
    },
    { upsert: true, writeConcern: { w: 1 } }
  );
  await evaluate(doc.tank_id);
  return telemetry.toObject();
}

export function recordSerialized(input) {
  const key = input.tank_id || "unknown";
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
  for (const field of ["home_id", "tank_id", "device_id", "device_type"]) {
    if (body[field] && body[field] !== parsed[field]) {
      throw httpError(400, `${field} does not match the MQTT topic`);
    }
  }
  return recordSerialized({ ...parsed, reading: body.reading, timestamp: body.timestamp });
}
