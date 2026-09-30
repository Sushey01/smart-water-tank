export const DEVICE_TYPES = [
  "tank_level",
  "water_flow",
  "motor_state",
  "source_presence",
  "desk_presence",
  "ambient_light",
  "desk_lamp",
  "room_temperature",
  "hvac",
];

export const READING_FIELDS = {
  tank_level: ["level_pct", "level_cm"],
  water_flow: ["flow_rate_lpm", "cumulative_litres", "direction"],
  motor_state: ["state", "runtime_seconds"],
  source_presence: ["water_present"],
  desk_presence: ["present"],
  ambient_light: ["lux"],
  desk_lamp: ["state", "mode", "color_temp_k", "brightness_pct"],
  room_temperature: ["temp_c"],
  hvac: ["state"],
};

export function telemetryTopic({ home_id, subsystem_id, tank_id, device_type, device_id }) {
  const scope = subsystem_id || tank_id;
  return `ioThings/${home_id}/${scope}/${device_type}/${device_id}/telemetry`;
}

export function commandTopic({ home_id, subsystem_id, tank_id, device_type, device_id }) {
  const scope = subsystem_id || tank_id;
  return `ioThings/${home_id}/${scope}/${device_type}/${device_id}/command`;
}

export function parseTelemetryTopic(topic) {
  const parts = topic.split("/");
  if (parts.length !== 6 || parts[0] !== "ioThings" || parts[5] !== "telemetry") {
    return null;
  }
  return {
    home_id: parts[1],
    subsystem_id: parts[2],
    device_type: parts[3],
    device_id: parts[4],
  };
}
