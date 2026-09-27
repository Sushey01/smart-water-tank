import { Notification } from "../models/index.js";
import { sendTelegram } from "../notifications/telegram.js";
import { latestField } from "../rules/conditions.js";

export function buildMessage(incident, latests = []) {
  const level = latestField(latests, "tank_level", "level_pct");
  const levelText = level === undefined || level === null ? "an unknown level" : `${level}%`;
  const messages = {
    warning: `Roof tank warning: level is ${levelText} and the pump is still on.`,
    overflow_prevented: `Roof tank cutoff: level is ${levelText}. The pump was switched off.`,
    dry_run: "Roof tank dry-run: the pump is on and there is no water at the inlet.",
    pump_failure: "Roof tank pump failure: the pump is on, water is present, and the level is not rising.",
    abnormal_flow: "Roof tank abnormal flow: water is moving while the pump is off.",
    confirmed_fault: "Roof tank fault: the pump was told to stop and is still on.",
    low_water: `Roof tank low: level is ${levelText} and the pump is off.`,
    manual_override: incident.action_taken?.type === "motor_on"
      ? `Roof tank: the pump was switched on at ${levelText}.`
      : `Roof tank: the pump was switched off at ${levelText}.`,
  };
  return messages[incident.severity] || `Roof tank alert: ${incident.severity}.`;
}

export async function notify(incident, latests = []) {
  const message = buildMessage(incident, latests);
  const telegram = await sendTelegram(message);
  const stored = new Notification({
    notification_id: `ntf_${Date.now()}`,
    incident_id: incident.incident_id,
    home_id: incident.home_id,
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
