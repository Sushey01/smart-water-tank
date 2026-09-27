import { commandTopic } from "../constants.js";
import { publish } from "../mqtt.js";
import { latestField } from "./conditions.js";
import { Incident } from "../models/index.js";

const MAJORITY = { writeConcern: { w: "majority" } };

export async function openIncident(rule, tank, latests) {
  const flow = Number(latestField(latests, "water_flow", "flow_rate_lpm") || 0);
  const cutoff = rule.severity === "overflow_prevented";
  const actionType = rule.action?.type || "none";
  const target = rule.action?.target_device || tank.motor_device_id;
  const incident = new Incident({
    incident_id: `inc_${Date.now()}`,
    home_id: tank.home_id,
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
        tank_id: tank.tank_id,
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
  return incident;
}

export async function resolvePending(tankId, latests) {
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

export async function escalateStale(tankId, latests) {
  if (latestField(latests, "motor_state", "state") !== "on") {
    return;
  }
  const cutoff = new Date(Date.now() - 30_000);
  await Incident.updateMany(
    {
      tank_id: tankId,
      open: true,
      escalated: false,
      "action_taken.type": "motor_off",
      "action_taken.status": "pending",
      triggered_at: { $lte: cutoff },
    },
    {
      $set: {
        escalated: true,
        severity: "confirmed_fault",
      },
    },
    MAJORITY
  );
}
