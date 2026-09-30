import { deviceSchema } from "./Device.js";
import { deviceLatestSchema } from "./DeviceLatest.js";
import { incidentSchema } from "./Incident.js";
import { notificationSchema } from "./Notification.js";
import { ruleSchema } from "./Rule.js";
import { subsystemSchema } from "./Subsystem.js";
import { tankSchema } from "./Tank.js";
import { telemetrySchema } from "./Telemetry.js";

export function registerModels(connection, { withTanks = false } = {}) {
  const models = {
    Subsystem: connection.model("Subsystem", subsystemSchema),
    Device: connection.model("Device", deviceSchema),
    Telemetry: connection.model("Telemetry", telemetrySchema),
    DeviceLatest: connection.model("DeviceLatest", deviceLatestSchema),
    Rule: connection.model("Rule", ruleSchema),
    Incident: connection.model("Incident", incidentSchema),
    Notification: connection.model("Notification", notificationSchema),
  };
  if (withTanks) {
    models.Tank = connection.model("Tank", tankSchema);
  }
  return models;
}
