import { DeviceLatest } from "../models/index.js";

function field(latests, deviceType, name) {
  const doc = latests.find((item) => item.device_type === deviceType);
  return doc?.reading?.[name] ?? null;
}

export async function withCurrent(tank) {
  const latests = await DeviceLatest.find({ tank_id: tank.tank_id }).lean();
  return {
    ...tank,
    current: {
      level_pct: field(latests, "tank_level", "level_pct"),
      level_cm: field(latests, "tank_level", "level_cm"),
      flow_rate_lpm: field(latests, "water_flow", "flow_rate_lpm"),
      pump_state: field(latests, "motor_state", "state"),
      water_present: field(latests, "source_presence", "water_present"),
      updated_at: latests.reduce((latest, item) => {
        if (!latest || item.timestamp > latest) return item.timestamp;
        return latest;
      }, null),
    },
  };
}
