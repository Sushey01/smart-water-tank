import { modelsFor, resolveSubsystem } from "../db.js";
import { escalateStale, openIncident, openRoomIncident, resolveCleared, resolveLowWater, resolvePending, resolveRoom } from "./actions.js";
import { compare, isPumpFailure, latestField, readingsAreCurrent, withTankThresholds } from "./conditions.js";

const SEVERITY_ORDER = ["overflow_prevented", "dry_run", "pump_failure", "abnormal_flow", "warning", "low_water"];

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

const ROOM_DEVICES = {
  lamp_study: ["desk_presence", "ambient_light", "desk_lamp"],
  lamp_off: ["desk_presence", "ambient_light", "desk_lamp"],
  hvac_on: ["room_temperature", "hvac"],
  hvac_off: ["room_temperature", "hvac"],
};

function matchesRoom(rule, latests) {
  const deviceTypes = ROOM_DEVICES[rule.action?.type] || [...new Set((rule.conditions || []).map((condition) => condition.device_type))];
  if (!readingsAreCurrent(latests, deviceTypes)) {
    return false;
  }
  if (!rule.conditions?.length) {
    return false;
  }
  return rule.conditions.every((condition) => {
    const actual = latestField(latests, condition.device_type, condition.field);
    if (actual === undefined || actual === null) {
      return false;
    }
    return compare(actual, condition.operator, condition.value);
  });
}

function alreadySatisfied(rule, latests) {
  if (rule.action?.type === "lamp_study") {
    return latestField(latests, "desk_lamp", "state") === "on" && latestField(latests, "desk_lamp", "mode") === "study";
  }
  if (rule.action?.type === "lamp_off") {
    return latestField(latests, "desk_lamp", "state") === "off";
  }
  return false;
}

async function evaluateRoom(subsystem) {
  const { DeviceLatest, Incident, Rule } = modelsFor(subsystem.type);
  const latests = await DeviceLatest.find({ subsystem_id: subsystem.subsystem_id }).lean();
  await resolveRoom(subsystem, latests);
  const rules = await Rule.find({ subsystem_id: subsystem.subsystem_id, enabled: true }).lean();
  for (const rule of rules) {
    if (!matchesRoom(rule, latests) || alreadySatisfied(rule, latests)) {
      continue;
    }
    const existing = await Incident.findOne({
      subsystem_id: subsystem.subsystem_id,
      rule_id: rule.rule_id,
      open: true,
    }).lean();
    if (existing) {
      continue;
    }
    await openRoomIncident(rule, subsystem, latests);
  }
}

export async function evaluate(subsystemId) {
  const route = await resolveSubsystem(subsystemId);
  if (!route) {
    return;
  }
  if (route.type !== "water_tank") {
    return evaluateRoom(route.subsystem);
  }
  return evaluateWater(subsystemId);
}

async function evaluateWater(tankId) {
  const { DeviceLatest, Incident, Rule, Tank } = modelsFor("water_tank");
  const tank = await Tank.findOne({ tank_id: tankId }).lean();
  if (!tank) {
    return;
  }
  const latests = await DeviceLatest.find({ tank_id: tankId }).lean();
  await resolvePending(tankId, latests);
  await resolveLowWater(tankId, latests);
  await resolveCleared(tankId, latests);
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
