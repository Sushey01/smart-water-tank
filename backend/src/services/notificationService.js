import { modelsFor, resolveSubsystem } from "../db.js";
import { sendTelegram } from "../notifications/telegram.js";
import { latestField } from "../rules/conditions.js";

export function buildMessage(incident, latests = []) {
  const level = latestField(latests, "tank_level", "level_pct");
  const levelText = level === undefined || level === null ? "an unknown level" : `${level}%`;
  const temp = latestField(latests, "room_temperature", "temp_c");
  const tempText = temp === undefined || temp === null ? "an unknown temperature" : `${temp}°C`;
  const action = incident.action_taken?.type;
  if (incident.severity === "manual_override") {
    if (action === "lamp_study") return "Study desk: the lamp was set to study mode, 6500 K at full brightness.";
    if (action === "lamp_off") return "Study desk: the lamp was switched off.";
    if (action === "hvac_on") return `Living room: cooling was switched on at ${tempText}.`;
    if (action === "hvac_off") return `Living room: cooling was switched off at ${tempText}.`;
    if (action === "motor_on") return `Roof tank: the pump was switched on at ${levelText}.`;
    return `Roof tank: the pump was switched off at ${levelText}.`;
  }
  const messages = {
    warning: `Roof tank warning: level is ${levelText} and the pump is still on.`,
    overflow_prevented: `Roof tank cutoff: level is ${levelText}. The pump was switched off.`,
    dry_run: "Roof tank dry-run: the pump is on and there is no water at the inlet.",
    pump_failure: "Roof tank pump failure: the pump is on, water is present, and the level is not rising.",
    abnormal_flow: "Roof tank abnormal flow: water is moving while the pump is off.",
    confirmed_fault: "Roof tank fault: the pump was told to stop and is still on.",
    low_water: `Roof tank low: level is ${levelText} and the pump is off.`,
    study_mode: "Study desk: someone is sitting down. The lamp is set to 6500 K at full brightness.",
    lamp_idle: "Study desk: the desk is empty. The lamp is off.",
    cooling_started: `Living room: temperature is ${tempText}. Cooling started.`,
    cooling_stopped: `Living room: temperature is ${tempText}. Cooling stopped.`,
  };
  return messages[incident.severity] || `Home alert: ${incident.severity}.`;
}

export async function notify(incident, latests = []) {
  const message = buildMessage(incident, latests);
  const telegram = await sendTelegram(message);
  const route = await resolveSubsystem(incident.subsystem_id || incident.tank_id);
  const { Notification } = route ? route.models : modelsFor("water_tank");
  const stored = new Notification({
    notification_id: `ntf_${Date.now()}`,
    incident_id: incident.incident_id,
    home_id: incident.home_id,
    subsystem_id: incident.subsystem_id || incident.tank_id,
    tank_id: incident.tank_id,
    severity: incident.severity,
    message,
    channel: telegram.attempted ? "telegram" : "status_page",
    delivered: telegram.attempted ? telegram.delivered : true,
    error: telegram.error || "",
    created_at: new Date(),
  });
  await stored.save({ writeConcern: { w: 1 } });
  if (telegram.error) {
    console.log(`Notification stored, Telegram not sent: ${telegram.error}`);
  } else if (telegram.delivered && telegram.attempted) {
    console.log(`Telegram sent for ${incident.incident_id}`);
  }
  return stored.toObject();
}
