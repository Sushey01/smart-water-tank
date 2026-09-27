import { DeviceLatest } from "../models/index.js";

function field(latests, deviceType, name) {
  const doc = latests.find((item) => item.device_type === deviceType);
  return doc?.reading?.[name] ?? null;
}

export function deriveCurrent(tank, latests) {
  const levelPct = field(latests, "tank_level", "level_pct");
  const flow = field(latests, "water_flow", "flow_rate_lpm");
  const pump = field(latests, "motor_state", "state");
  const capacity = Number(tank.capacity_litres);
  const cutoffPct = Number(tank.thresholds?.overflow_pct ?? 98);
  const litresInTank = levelPct === null || !capacity ? null : Math.round((capacity * Number(levelPct)) / 10) / 10;
  const cutoffLitres = capacity ? (capacity * cutoffPct) / 100 : null;
  const litresToCutoff = litresInTank === null || cutoffLitres === null || Number(levelPct) >= cutoffPct
    ? null
    : Math.round((cutoffLitres - litresInTank) * 10) / 10;
  const minutesToCutoff = litresToCutoff === null || pump !== "on" || !(Number(flow) > 0)
    ? null
    : Math.round((litresToCutoff / Number(flow)) * 10) / 10;
  return {
    level_pct: levelPct,
    level_cm: field(latests, "tank_level", "level_cm"),
    litres_in_tank: litresInTank,
    litres_to_cutoff: litresToCutoff,
    minutes_to_cutoff: minutesToCutoff,
    flow_rate_lpm: flow,
    cumulative_litres: field(latests, "water_flow", "cumulative_litres"),
    pump_state: pump,
    runtime_seconds: field(latests, "motor_state", "runtime_seconds"),
    water_present: field(latests, "source_presence", "water_present"),
    updated_at: latests.reduce((latest, item) => {
      if (!latest || item.timestamp > latest) return item.timestamp;
      return latest;
    }, null),
  };
}

export async function withCurrent(tank) {
  const latests = await DeviceLatest.find({ tank_id: tank.tank_id }).lean();
  return { ...tank, current: deriveCurrent(tank, latests) };
}
