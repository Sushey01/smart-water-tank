import { commandTopic } from "../constants.js";
import { publish } from "../mqtt.js";
import { latestField } from "./conditions.js";
import { modelsFor } from "../db.js";
import { notify } from "../services/notificationService.js";

const MAJORITY = { writeConcern: { w: "majority" } };

export async function openIncident(rule, tank, latests) {
  const { Incident } = modelsFor("water_tank");
  const flow = Number(latestField(latests, "water_flow", "flow_rate_lpm") || 0);
  const cutoff = rule.severity === "overflow_prevented";
  const actionType = rule.action?.type || "none";
  const target = rule.action?.target_device || tank.motor_device_id;
  const incident = new Incident({
    incident_id: `inc_${Date.now()}`,
    home_id: tank.home_id,
    subsystem_id: tank.tank_id,
    tank_id: tank.tank_id,
    rule_id: rule.rule_id,
    severity: rule.severity,
    origin_severity: rule.severity,
    triggered_at: new Date(),
    triggered_by: latests.map((item) => ({
      device_id: item.device_id,
      device_type: item.device_type,
      value: item.reading,
    })),
    action_taken: {
      type: actionType,
      target_device: target,
      status: actionType === "motor_off" ? "pending" : "none",
    },
    escalated: false,
    open: true,
    litres_saved: cutoff ? flow * 20 : 0,
    assumed_unattended_minutes: cutoff ? 20 : 0,
    flow_rate_lpm_at_trigger: flow,
  });
  await incident.save(MAJORITY);
  if (actionType === "motor_off") {
    const sent = publish(
      commandTopic({
        home_id: tank.home_id,
        subsystem_id: tank.tank_id,
        device_type: "motor_state",
        device_id: target,
      }),
      { command: "off", reason: rule.severity, incident_id: incident.incident_id },
      { qos: 1 }
    );
    if (!sent) {
      incident.action_taken.status = "mqtt_unavailable";
      await incident.save(MAJORITY);
    }
  }
  console.log(`Incident ${incident.incident_id} ${incident.severity}`);
  await notify(incident.toObject(), latests);
  return incident;
}

export async function resolvePending(tankId, latests) {
  const { Incident } = modelsFor("water_tank");
  if (latestField(latests, "motor_state", "state") !== "off") {
    return;
  }
  const now = new Date();
  await Incident.updateMany(
    {
      tank_id: tankId,
      open: true,
      "action_taken.type": "motor_off",
      "action_taken.status": "pending",
    },
    {
      $set: {
        open: false,
        resolved_at: now,
        "action_taken.status": "success",
      },
    },
    MAJORITY
  );
  await Incident.updateMany(
    { tank_id: tankId, open: true, severity: "warning" },
    { $set: { open: false, resolved_at: now, "action_taken.status": "cleared" } },
    MAJORITY
  );
}

export async function resolveLowWater(tankId, latests) {
  const { Incident } = modelsFor("water_tank");
  const level = Number(latestField(latests, "tank_level", "level_pct"));
  const motor = latestField(latests, "motor_state", "state");
  if (motor === "off" && !Number.isNaN(level) && level <= 15) {
    return;
  }
  await Incident.updateMany(
    { tank_id: tankId, open: true, severity: "low_water" },
    { $set: { open: false, resolved_at: new Date(), "action_taken.status": "cleared" } },
    MAJORITY
  );
}

export async function resolveCleared(tankId, latests) {
  const { Incident } = modelsFor("water_tank");
  const motor = latestField(latests, "motor_state", "state");
  const flow = Number(latestField(latests, "water_flow", "flow_rate_lpm"));
  const now = new Date();
  const cleared = { $set: { open: false, resolved_at: now, "action_taken.status": "cleared" } };
  if (motor !== "on" || flow > 0.2) {
    await Incident.updateMany({ tank_id: tankId, open: true, severity: "pump_failure" }, cleared, MAJORITY);
  }
  if (motor === "on" || !(flow > 0)) {
    await Incident.updateMany({ tank_id: tankId, open: true, severity: "abnormal_flow" }, cleared, MAJORITY);
  }
  if (motor === "on") {
    await Incident.updateMany(
      { tank_id: tankId, open: true, severity: "manual_override", "action_taken.type": "motor_on", "action_taken.status": "pending" },
      { $set: { open: false, resolved_at: now, "action_taken.status": "success" } },
      MAJORITY
    );
  }
}

export async function escalateStale(tankId, latests) {
  const { Incident } = modelsFor("water_tank");
  if (latestField(latests, "motor_state", "state") !== "on") {
    return;
  }
  const cutoff = new Date(Date.now() - 30_000);
  const stale = await Incident.find({
    tank_id: tankId,
    open: true,
    escalated: false,
    "action_taken.type": "motor_off",
    "action_taken.status": "pending",
    triggered_at: { $lte: cutoff },
  }).lean();
  if (!stale.length) {
    return;
  }
  await Incident.updateMany(
    { incident_id: { $in: stale.map((item) => item.incident_id) } },
    { $set: { escalated: true, severity: "confirmed_fault" } },
    MAJORITY
  );
  for (const incident of stale) {
    await notify({ ...incident, severity: "confirmed_fault" }, latests);
  }
}

const ROOM_COMMANDS = {
  lamp_study: { device_type: "desk_lamp", payload: { command: "study", mode: "study", color_temp_k: 6500, brightness_pct: 100 } },
  lamp_off: { device_type: "desk_lamp", payload: { command: "off" } },
  hvac_on: { device_type: "hvac", payload: { command: "cool" } },
  hvac_off: { device_type: "hvac", payload: { command: "off" } },
};

export async function openRoomIncident(rule, subsystem, latests) {
  const { Incident } = modelsFor(subsystem.type);
  const actionType = rule.action?.type || "none";
  const target = rule.action?.target_device;
  const command = ROOM_COMMANDS[actionType];
  const incident = new Incident({
    incident_id: `inc_${Date.now()}`,
    home_id: subsystem.home_id,
    subsystem_id: subsystem.subsystem_id,
    rule_id: rule.rule_id,
    severity: rule.severity,
    origin_severity: rule.severity,
    triggered_at: new Date(),
    triggered_by: latests.map((item) => ({
      device_id: item.device_id,
      device_type: item.device_type,
      value: item.reading,
    })),
    action_taken: {
      type: actionType,
      target_device: target,
      status: command ? "pending" : "none",
    },
    escalated: false,
    open: true,
  });
  await incident.save(MAJORITY);
  if (command && target) {
    const sent = publish(
      commandTopic({
        home_id: subsystem.home_id,
        subsystem_id: subsystem.subsystem_id,
        device_type: command.device_type,
        device_id: target,
      }),
      { ...command.payload, reason: rule.severity, incident_id: incident.incident_id },
      { qos: 1 }
    );
    if (!sent) {
      incident.action_taken.status = "mqtt_unavailable";
      await incident.save(MAJORITY);
    }
  }
  console.log(`Incident ${incident.incident_id} ${incident.severity}`);
  await notify(incident.toObject(), latests);
  return incident;
}

function roomActionDone(incident, latests) {
  const type = incident.action_taken?.type;
  if (type === "lamp_study") {
    return latestField(latests, "desk_lamp", "state") === "on" && latestField(latests, "desk_lamp", "mode") === "study";
  }
  if (type === "lamp_off") {
    return latestField(latests, "desk_lamp", "state") === "off";
  }
  if (type === "hvac_on") {
    return latestField(latests, "hvac", "state") === "cooling";
  }
  if (type === "hvac_off") {
    return latestField(latests, "hvac", "state") === "off";
  }
  return false;
}

export async function resolveRoom(subsystem, latests) {
  const { Incident } = modelsFor(subsystem.type);
  const pending = await Incident.find({
    subsystem_id: subsystem.subsystem_id,
    open: true,
    "action_taken.status": "pending",
  }).lean();
  const done = pending.filter((incident) => roomActionDone(incident, latests));
  if (!done.length) {
    return;
  }
  await Incident.updateMany(
    { incident_id: { $in: done.map((incident) => incident.incident_id) } },
    { $set: { open: false, resolved_at: new Date(), "action_taken.status": "success" } },
    MAJORITY
  );
}
