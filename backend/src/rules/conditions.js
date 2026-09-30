import { modelsFor } from "../db.js";

const MAX_SKEW_MS = 400;

export function readingsAreCurrent(latests, deviceTypes) {
  const docs = deviceTypes.map((type) => latests.find((item) => item.device_type === type));
  if (docs.some((doc) => !doc)) {
    return false;
  }
  const times = docs.map((doc) => new Date(doc.timestamp).getTime());
  const newest = Math.max(...times);
  return times.every((time) => newest - time <= MAX_SKEW_MS);
}

export function latestField(latests, deviceType, field) {
  const doc = latests.find((item) => item.device_type === deviceType);
  return doc?.reading?.[field];
}

export function compare(actual, operator, expected) {
  if (operator === "==") {
    return actual === expected;
  }
  const left = Number(actual);
  const right = Number(expected);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return false;
  }
  if (operator === ">=") return left >= right;
  if (operator === ">") return left > right;
  if (operator === "<=") return left <= right;
  if (operator === "<") return left < right;
  return false;
}

export function withTankThresholds(rule, tank) {
  return (rule.conditions || []).map((condition) => {
    if (condition.device_type !== "tank_level" || condition.field !== "level_pct") {
      return condition;
    }
    if (rule.severity === "warning") {
      return { ...condition, value: tank.thresholds?.warning_pct ?? condition.value };
    }
    if (rule.severity === "overflow_prevented") {
      return { ...condition, value: tank.thresholds?.overflow_pct ?? condition.value };
    }
    return condition;
  });
}

export async function isPumpFailure(latests, tankId) {
  const motor = latestField(latests, "motor_state", "state");
  const present = latestField(latests, "source_presence", "water_present");
  const flow = Number(latestField(latests, "water_flow", "flow_rate_lpm"));
  if (motor !== "on" || present !== true || !(flow <= 0.2)) {
    return false;
  }
  const levels = await modelsFor("water_tank").Telemetry.find({ tank_id: tankId, device_type: "tank_level" })
    .sort({ timestamp: -1 })
    .limit(2)
    .lean();
  if (levels.length < 2) {
    return false;
  }
  return levels[0].reading.level_pct <= levels[1].reading.level_pct + 0.05;
}
