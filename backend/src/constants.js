export const DEVICE_TYPES = ["tank_level", "water_flow", "motor_state", "source_presence"];

export const READING_FIELDS = {
  tank_level: ["level_pct", "level_cm"],
  water_flow: ["flow_rate_lpm", "cumulative_litres", "direction"],
  motor_state: ["state", "runtime_seconds"],
  source_presence: ["water_present"],
};

export function telemetryTopic({ home_id, tank_id, device_type, device_id }) {
  return `ioThings/${home_id}/${tank_id}/${device_type}/${device_id}/telemetry`;
}

export function commandTopic({ home_id, tank_id, device_id }) {
  return `ioThings/${home_id}/${tank_id}/motor/${device_id}/command`;
}

export function parseTelemetryTopic(topic) {
  const parts = topic.split("/");
  if (parts.length !== 6 || parts[0] !== "ioThings" || parts[5] !== "telemetry") {
    return null;
  }
  return {
    home_id: parts[1],
    tank_id: parts[2],
    device_type: parts[3],
    device_id: parts[4],
  };
}
