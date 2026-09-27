import { Incident, Rule, Tank } from "../models/index.js";
import { DeviceLatest } from "../models/index.js";
import { escalateStale, openIncident, resolvePending } from "./actions.js";
import { compare, isPumpFailure, latestField, readingsAreCurrent, withTankThresholds } from "./conditions.js";

const SEVERITY_ORDER = ["overflow_prevented", "dry_run", "pump_failure", "abnormal_flow", "warning"];

async function matches(rule, latests, tank) {
  const conditions = withTankThresholds(rule, tank);
  const deviceTypes = rule.kind === "pump_failure"
    ? ["motor_state", "source_presence", "water_flow", "tank_level"]
    : [...new Set(conditions.map((condition) => condition.device_type))];
  if (!readingsAreCurrent(latests, deviceTypes)) {
    return false;
  }
  if (rule.severity === "abnormal_flow" || rule.kind === "pump_failure") {
    const motor = latests.find((item) => item.device_type === "motor_state");
    const flow = latests.find((item) => item.device_type === "water_flow");
    if (!motor || !flow || new Date(flow.timestamp) < new Date(motor.timestamp)) {
      return false;
    }
  }
  if (rule.kind === "pump_failure") {
    return isPumpFailure(latests, tank.tank_id);
  }
  if (!conditions.length) {
    return false;
  }
  return conditions.every((condition) => {
    const actual = latestField(latests, condition.device_type, condition.field);
    if (actual === undefined || actual === null) {
      return false;
    }
    return compare(actual, condition.operator, condition.value);
  });
}

export async function evaluate(tankId) {
  const tank = await Tank.findOne({ tank_id: tankId }).lean();
  if (!tank) {
    return;
  }
  const latests = await DeviceLatest.find({ tank_id: tankId }).lean();
  await resolvePending(tankId, latests);
  await escalateStale(tankId, latests);

  const rules = await Rule.find({ tank_id: tankId, enabled: true }).lean();
  rules.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  for (const rule of rules) {
    if (rule.severity === "warning") {
      const level = Number(latestField(latests, "tank_level", "level_pct"));
      if (level >= (tank.thresholds?.overflow_pct ?? 98)) {
        continue;
      }
    }
    if (!(await matches(rule, latests, tank))) {
      continue;
    }
    const existing = await Incident.findOne({
      tank_id: tankId,
      rule_id: rule.rule_id,
      open: true,
    }).lean();
    if (existing) {
      continue;
    }
    await openIncident(rule, tank, latests);
  }
}
